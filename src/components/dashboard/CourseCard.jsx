import { ArrowUpRight } from "lucide-react";
import { cn } from "../../lib/classNames";
import { ProgressBar } from "../ui/ProgressBar";

const cardStyles = {
  lavender: "bg-lavender text-navy",
  peach: "bg-peach text-navy",
  lime: "bg-lime text-navy",
};

export function CourseCard({ course, onOpen, compact = false }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "focus-ring group flex h-full flex-col rounded-[24px] text-left shadow-card transition duration-200 hover:-translate-y-1 hover:shadow-soft",
        cardStyles[course.cardColor],
        compact ? "min-h-[160px] p-5" : "min-h-[190px] p-5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-extrabold uppercase tracking-wide opacity-70">{course.number}</span>
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/40 transition group-hover:bg-white">
          <ArrowUpRight size={18} />
        </span>
      </div>
      <div className="flex-1">
        <h3 className="mt-4 line-clamp-3 font-extrabold leading-snug text-base">
          {course.title}
        </h3>
        <div className="mt-3 space-y-1">
          <p className="text-xs font-semibold opacity-75">
            {course.modules} lectures
          </p>
          <p className="text-xs font-medium opacity-65">{course.source}</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold opacity-75">Progress</span>
          <span className="text-xs font-bold opacity-80">{course.progress}%</span>
        </div>
        <ProgressBar value={course.progress} tone="navy" className="bg-white/35" />
      </div>
    </button>
  );
}
