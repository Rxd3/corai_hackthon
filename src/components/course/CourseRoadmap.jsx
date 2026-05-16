import { Check, Circle, Flag, Play, RotateCcw } from "lucide-react";
import { cn } from "../../lib/classNames";

const styles = {
  completed: "bg-navy text-white border-navy",
  "in progress": "bg-peach text-navy border-peach",
  "needs review": "bg-[#fff0ea] text-[#d44724] border-[#ffb49d]",
  "not started": "bg-white text-muted border-divider",
};

export function CourseRoadmap({ modules = [] }) {
  const roadmap = [
    { label: "Start", status: modules.some((module) => module.progress > 0) ? "completed" : "not started", Icon: Check },
    ...modules.map((module) => ({
      label: `Lesson ${module.position}: ${module.title}`,
      status: module.status,
      Icon: module.status === "completed" ? Check : module.status === "in progress" ? Play : module.status === "needs review" ? RotateCcw : Circle,
    })),
    { label: "Final Quiz", status: modules.every((module) => module.status === "completed") && modules.length ? "in progress" : "not started", Icon: Flag },
  ];

  return (
    <section className="soft-card p-5 sm:p-6">
      <h2 className="text-xl font-extrabold text-ink">Course Roadmap</h2>
      <div className="mt-5 grid gap-3">
        {roadmap.map(({ label, status, Icon }, index) => (
          <div key={label} className="grid grid-cols-[36px_1fr] gap-3">
            <div className="flex flex-col items-center">
              <span className={cn("flex h-9 w-9 items-center justify-center rounded-2xl border", styles[status])}>
                <Icon size={17} />
              </span>
              {index < roadmap.length - 1 ? <span className="h-7 w-px bg-divider" /> : null}
            </div>
            <div className={cn("rounded-[18px] border px-4 py-3 text-sm font-extrabold", styles[status])}>{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
