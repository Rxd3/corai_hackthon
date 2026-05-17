import { ArrowRight, BookOpenCheck, CalendarCheck2, CheckCircle2, Circle, Clock3, ListChecks } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { ProgressBar } from "../components/ui/ProgressBar";
import { useLearningData } from "../contexts/LearningDataContext";
import { cn } from "../lib/classNames";
import { buildStudyPlanItems, formatStudyMinutes, groupStudyPlanByDate, summarizeStudyPlan } from "../lib/studyPlan";

export function StudyPlanPage() {
  const navigate = useNavigate();
  const data = useLearningData();
  const items = buildStudyPlanItems(data);
  const groups = groupStudyPlanByDate(items);
  const summary = summarizeStudyPlan(items);
  const nextItem = items.find((item) => !item.completed);

  return (
    <div>
      <PageHeader title="Study Plan" subtitle="Your personalized schedule, lessons, and progress in one place." />

      {!items.length ? (
        <section className="soft-card p-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[22px] bg-lavender text-navy">
            <CalendarCheck2 size={24} />
          </span>
          <h2 className="mt-5 text-xl font-extrabold text-ink">No study plan yet</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm font-semibold leading-6 text-muted">
            Generate a course and CorAI will create a lesson-by-lesson study plan with dates, quizzes, and progress.
          </p>
          <Button className="mt-6" onClick={() => navigate("/create")}>
            Create Course
          </Button>
        </section>
      ) : (
        <div className="space-y-6">
          <section className="soft-card p-5 sm:p-6">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime text-navy">
                    <BookOpenCheck size={21} />
                  </span>
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-normal text-muted">Next to study</p>
                    <h2 className="mt-1 text-2xl font-extrabold text-ink">
                      {nextItem?.lessonTitle || "All planned lessons are complete"}
                    </h2>
                  </div>
                </div>
                <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-muted">
                  {nextItem
                    ? `${nextItem.courseTitle} · ${nextItem.dueDateLabel} · ${formatStudyMinutes(nextItem.estimatedMinutes)}`
                    : "Your current Study Plan is fully complete. Create another course when you are ready for a new path."}
                </p>
                {nextItem ? (
                  <div className="mt-5 max-w-xl">
                    <div className="mb-2 flex justify-between text-xs font-extrabold text-muted">
                      <span>Lesson progress</span>
                      <span>{nextItem.progress}%</span>
                    </div>
                    <ProgressBar value={nextItem.progress} />
                  </div>
                ) : null}
                {nextItem?.path ? (
                  <Button className="mt-6" onClick={() => navigate(nextItem.path)}>
                    Continue Lesson
                    <ArrowRight size={17} />
                  </Button>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <PlanMetric icon={ListChecks} label="Lessons" value={`${summary.completed}/${summary.total}`} />
                <PlanMetric icon={Clock3} label="Remaining Time" value={formatStudyMinutes(summary.estimatedMinutes)} />
                <PlanMetric icon={CalendarCheck2} label="Plan Progress" value={`${summary.percent}%`} />
              </div>
            </div>
          </section>

          <section className="soft-card p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-ink">Study Schedule</h2>
                <p className="mt-1 text-sm font-semibold text-muted">
                  Built directly from your Study Plan and updated with lesson progress.
                </p>
              </div>
              <span className="rounded-full bg-white px-4 py-2 text-xs font-extrabold text-muted shadow-card">
                {summary.remaining} remaining
              </span>
            </div>

            <div className="mt-6 space-y-6">
              {groups.map((group) => (
                <div key={group.key} className="border-t border-divider pt-5 first:border-t-0 first:pt-0">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-extrabold text-navy">{group.label}</h3>
                    <span className="text-xs font-bold text-muted">
                      {group.items.length} lesson{group.items.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {group.items.map((item) => (
                      <PlanRow key={item.id || `${item.title}-${item.order}`} item={item} onOpen={() => item.path && navigate(item.path)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export function StudyPlanRightPanel() {
  const navigate = useNavigate();
  const data = useLearningData();
  const items = buildStudyPlanItems(data);
  const summary = summarizeStudyPlan(items);
  const openItems = items.filter((item) => !item.completed);
  const nextItems = openItems.slice(0, 3);

  return (
    <section className="soft-card p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lavender text-navy">
          <CalendarCheck2 size={18} />
        </span>
        <h2 className="text-lg font-extrabold text-ink">This Week</h2>
      </div>
      <div className="mt-5">
        <div className="mb-2 flex justify-between text-xs font-extrabold text-muted">
          <span>Plan progress</span>
          <span>{summary.percent}%</span>
        </div>
        <ProgressBar value={summary.percent} />
      </div>
      <div className="mt-5 grid gap-3 text-sm font-bold text-muted">
        <p>{openItems.length} study sessions left</p>
        <p>{data.quizzes.length} quizzes available</p>
        <p>{formatStudyMinutes(summary.estimatedMinutes)} remaining</p>
      </div>
      <div className="mt-5 space-y-2">
        {nextItems.map((item) => (
          <button
            key={item.id || item.title}
            type="button"
            onClick={() => item.path && navigate(item.path)}
            className="focus-ring w-full rounded-2xl bg-gray-50 px-4 py-3 text-left transition hover:bg-white hover:shadow-card"
          >
            <p className="text-sm font-extrabold leading-5 text-ink">{item.lessonTitle}</p>
            <p className="mt-1 text-xs font-bold text-muted">{item.dueDateLabel}</p>
          </button>
        ))}
        {!nextItems.length ? (
          <p className="rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold text-muted">
            Your current plan is complete.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function PlanMetric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-[20px] bg-gray-50 p-4">
      <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-normal text-muted">
        <Icon size={15} />
        {label}
      </div>
      <p className="mt-2 text-xl font-extrabold text-navy">{value}</p>
    </div>
  );
}

function PlanRow({ item, onOpen }) {
  const content = (
    <>
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
          item.completed ? "bg-navy text-white" : item.progress > 0 ? "bg-peach text-navy" : "bg-white text-muted",
        )}
      >
        {item.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold leading-5 text-ink">{item.lessonTitle}</span>
        <span className="mt-1 block text-xs font-bold leading-5 text-muted">
          {item.courseTitle} · {formatStudyMinutes(item.estimatedMinutes)} · {item.statusLabel}
        </span>
        <span className="mt-3 block max-w-sm">
          <ProgressBar value={item.progress} />
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-2 text-right">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-muted">
          {item.progress}%
        </span>
        {item.path ? <ArrowRight size={17} className="text-muted" /> : null}
      </span>
    </>
  );

  if (!item.path) {
    return (
      <div className="grid gap-4 rounded-[20px] bg-gray-50 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="focus-ring grid w-full gap-4 rounded-[20px] bg-gray-50 p-4 text-left transition hover:bg-white hover:shadow-card sm:grid-cols-[auto_1fr_auto] sm:items-center"
    >
      {content}
    </button>
  );
}
