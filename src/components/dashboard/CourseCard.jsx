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
        compact ? "min-h-[132px] p-4" : "min-h-[190px] p-5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-extrabold opacity-75">{course.number}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/50 transition group-hover:bg-white">
          <ArrowUpRight size={17} />
        </span>
      </div>
      <div className={cn("flex-1", compact ? "mt-3" : "mt-5")}>
        <h3 className={cn("break-words font-extrabold leading-tight", compact ? "text-base" : "text-lg")}>{course.title}</h3>
        <p className="mt-2 text-xs font-bold leading-4 opacity-75">
          {course.modules} lessons | {course.progress}%
        </p>
        <p className="mt-1 text-xs font-semibold opacity-70">{course.source}</p>
      </div>
      <ProgressBar value={course.progress} tone="navy" className={cn("bg-white/45", compact ? "mt-4" : "mt-5")} />
    </button>
  );
}
