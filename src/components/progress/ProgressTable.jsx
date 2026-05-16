import { StatusPill } from "../ui/StatusPill";
import { SectionCard } from "../ui/SectionCard";

export function ProgressTable({ modules = [] }) {
  return (
    <SectionCard>
      <h2 className="text-xl font-extrabold text-ink">Course Progress</h2>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-y-2 text-left">
          <thead>
            <tr className="text-xs font-extrabold uppercase tracking-normal text-muted">
              <th className="px-4 py-2">Lesson</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Quiz Score</th>
            </tr>
          </thead>
          <tbody>
            {modules.map((module) => (
              <tr key={module.id} className="bg-gray-50 text-sm font-bold text-ink">
                <td className="rounded-l-2xl px-4 py-4">{module.title}</td>
                <td className="px-4 py-4">
                  <StatusPill status={module.status} />
                </td>
                <td className="rounded-r-2xl px-4 py-4 text-muted">{module.quizScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
