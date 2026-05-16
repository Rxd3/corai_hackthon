import { CheckCircle2 } from "lucide-react";
import { Button } from "../ui/Button";
import { SectionCard } from "../ui/SectionCard";

export function PracticeTaskCard({ tasks = [], onComplete }) {
  return (
    <SectionCard>
      <h2 className="text-xl font-extrabold text-ink">Practice Task</h2>
      <div className="mt-4 rounded-[20px] bg-gray-50 p-5 text-sm font-semibold leading-7 text-muted">
        <ol className="list-inside list-decimal space-y-1">
          {(tasks.length ? tasks : ["Write a short summary of this lesson in your own words."]).map((task) => (
            <li key={task}>{task}</li>
          ))}
        </ol>
      </div>
      <Button className="mt-5" onClick={onComplete}>
        <CheckCircle2 size={18} />
        Mark Practice Complete
      </Button>
    </SectionCard>
  );
}
