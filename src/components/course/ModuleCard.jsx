import { BookOpen, Clock3, HelpCircle, Video } from "lucide-react";
import { StatusPill } from "../ui/StatusPill";
import { ProgressBar } from "../ui/ProgressBar";
import { Button } from "../ui/Button";

export function ModuleCard({ module, onOpen }) {
  return (
    <article className="soft-card flex flex-col p-5 transition hover:-translate-y-1 hover:shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-normal text-muted">Lesson {module.number}</p>
          <h3 className="mt-1 text-xl font-extrabold text-ink">{module.title}</h3>
        </div>
        <StatusPill status={module.status} />
      </div>

      <div className="mt-5 grid gap-3 text-sm font-semibold text-muted">
        <span className="flex items-center gap-2">
          <Video size={17} className="text-navy" />
          Video lesson included
        </span>
        <span className="flex items-center gap-2">
          <BookOpen size={17} className="text-navy" />
          {module.concepts} key concepts
        </span>
        <span className="flex items-center gap-2">
          <HelpCircle size={17} className="text-navy" />
          {module.questions} quiz questions
        </span>
        <span className="flex items-center gap-2">
          <Clock3 size={17} className="text-navy" />
          Estimated time: {module.time}
        </span>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex justify-between text-xs font-extrabold text-muted">
          <span>Progress</span>
          <span>{module.progress}%</span>
        </div>
        <ProgressBar value={module.progress} />
      </div>

      <Button className="mt-6" onClick={onOpen}>
        Open Lesson
      </Button>
    </article>
  );
}
