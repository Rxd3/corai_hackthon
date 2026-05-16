import { ProgressBar } from "../ui/ProgressBar";
import { SectionCard } from "../ui/SectionCard";

export function ProgressOverview({ course, modules = [] }) {
  const completed = modules.filter((module) => module.progress >= 100).length;
  const next = modules.find((module) => module.progress < 100);

  return (
    <SectionCard>
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-ink">{course?.title || "No course yet"}</h2>
          <p className="mt-2 text-sm font-bold text-muted">{course?.progress || 0}% Complete</p>
        </div>
        <div className="grid grid-cols-1 gap-3 text-sm font-bold text-muted sm:grid-cols-3">
          <span className="rounded-2xl bg-gray-50 px-4 py-3">Completed: {completed} lessons</span>
          <span className="rounded-2xl bg-gray-50 px-4 py-3">Remaining: {Math.max(0, modules.length - completed)} lessons</span>
          <span className="rounded-2xl bg-gray-50 px-4 py-3">Next: {next?.title || "All done"}</span>
        </div>
      </div>
      <ProgressBar value={course?.progress || 0} className="mt-6" />
    </SectionCard>
  );
}
