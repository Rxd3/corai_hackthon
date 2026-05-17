import { ArrowRight, Clock3 } from "lucide-react";
import { ProgressBar } from "../ui/ProgressBar";

export function UpcomingCard({ item, onOpen }) {
  return (
    <section className="soft-card p-5">
      <h2 className="text-lg font-extrabold text-ink">Upcoming</h2>
      <div className="mt-4 rounded-[20px] bg-navy p-4 text-white">
        <div className="flex items-center gap-2 text-xs font-bold text-white/65">
          <Clock3 size={15} />
          {item?.dueDateLabel || "Flexible"}
        </div>
        <p className="mt-3 text-sm font-extrabold leading-5">
          {item?.lessonTitle || "Create your first course"}
        </p>
        <p className="mt-1 text-xs font-bold leading-5 text-white/65">
          {item ? `${item.courseTitle} · ${item.estimatedMinutes} min` : "Your next lesson will appear here."}
        </p>
        {item ? (
          <div className="mt-4">
            <div className="mb-2 flex justify-between text-xs font-extrabold text-white/70">
              <span>Progress</span>
              <span>{item.progress}%</span>
            </div>
            <ProgressBar value={item.progress} tone="lime" />
          </div>
        ) : null}
      </div>
      {item?.path ? (
        <button
          type="button"
          onClick={() => onOpen?.(item)}
          className="focus-ring mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-extrabold text-navy shadow-card transition hover:bg-gray-50"
        >
          Continue Lesson
          <ArrowRight size={16} />
        </button>
      ) : null}
    </section>
  );
}
