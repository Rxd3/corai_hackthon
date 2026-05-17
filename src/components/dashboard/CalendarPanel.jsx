import { cn } from "../../lib/classNames";
import { planDateKey } from "../../lib/studyPlan";

const days = ["M", "T", "W", "T", "F", "S", "S"];

export function CalendarPanel({ items = [] }) {
  const today = new Date();
  const anchorDate = getAnchorDate(items, today);
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const blanks = Array.from({ length: (firstDay.getDay() + 6) % 7 }, (_, index) => `blank-${index}`);
  const dates = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const itemsByDate = groupItemsByDate(items);
  const openItems = items.filter((item) => !item.completed);
  const nextItem = openItems.find((item) => item.dueDate) || openItems[0];

  return (
    <section className="soft-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-ink">
            {anchorDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </h2>
          <p className="mt-1 text-xs font-bold text-muted">
            {openItems.length ? `${openItems.length} study session${openItems.length === 1 ? "" : "s"} left` : "Plan complete"}
          </p>
        </div>
        <span className="rounded-full bg-lime px-3 py-1 text-xs font-extrabold text-navy">
          Schedule
        </span>
      </div>
      <div className="mt-5 grid grid-cols-7 gap-2 text-center">
        {days.map((day, index) => (
          <span key={`${day}-${index}`} className="text-xs font-extrabold text-muted">
            {day}
          </span>
        ))}
        {blanks.map((blank) => (
          <span key={blank} />
        ))}
        {dates.map((date) => {
          const currentDate = new Date(year, month, date);
          const key = planDateKey(currentDate);
          const dayItems = itemsByDate.get(key) || [];
          const hasPlan = dayItems.length > 0;
          const completed = hasPlan && dayItems.every((item) => item.completed);
          const inProgress = hasPlan && dayItems.some((item) => item.progress > 0 && !item.completed);
          const selected = planDateKey(today) === key;
          return (
            <div key={date} className="flex h-10 flex-col items-center justify-center gap-1" title={calendarTitle(dayItems)}>
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold",
                  selected
                    ? "bg-navy text-white"
                    : hasPlan
                      ? "bg-white text-navy shadow-sm"
                      : "text-muted",
                )}
              >
                {date}
              </span>
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  completed ? "bg-navy" : inProgress ? "bg-peach" : hasPlan ? "bg-lime" : "bg-transparent",
                )}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-5 rounded-[20px] bg-gray-50 p-4">
        <p className="text-xs font-extrabold uppercase tracking-normal text-muted">Next from Study Plan</p>
        <p className="mt-2 text-sm font-extrabold leading-5 text-ink">
          {nextItem?.lessonTitle || "Create a course to build your schedule"}
        </p>
        <p className="mt-1 text-xs font-bold text-muted">
          {nextItem ? `${nextItem.dueDateLabel} · ${nextItem.courseTitle}` : "Your calendar will update from the same Study Plan."}
        </p>
      </div>
    </section>
  );
}

function getAnchorDate(items, today) {
  const nextItem = items.find((item) => !item.completed && item.dueDate);
  const firstItem = items.find((item) => item.dueDate);
  return nextItem?.dueDate || firstItem?.dueDate || today;
}

function groupItemsByDate(items) {
  return items.reduce((groups, item) => {
    if (!item.dueDateKey) return groups;
    const dayItems = groups.get(item.dueDateKey) || [];
    dayItems.push(item);
    groups.set(item.dueDateKey, dayItems);
    return groups;
  }, new Map());
}

function calendarTitle(items) {
  if (!items.length) return "";
  return items.map((item) => item.lessonTitle).join("\n");
}
