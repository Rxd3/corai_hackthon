import { RefreshCw, Rocket } from "lucide-react";
import { Button } from "../ui/Button";
import { ProgressBar } from "../ui/ProgressBar";

export function CourseHeader({ course, onContinue }) {
  return (
    <section className="rounded-[28px] bg-navy p-6 text-white shadow-soft sm:p-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold text-white/60">Generated from: {course.sourceFile}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-normal sm:text-4xl">{course.title}</h1>
          <div className="mt-5 flex flex-wrap gap-3 text-sm font-bold text-white/72">
            <span>{course.modules} lessons</span>
            <span>{course.quizzes} quizzes</span>
            <span>Estimated time: {course.duration}</span>
            <span>Progress: {course.progress}%</span>
          </div>
          <ProgressBar value={course.progress} tone="lime" className="mt-6 max-w-md bg-white/16" />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={onContinue}>
            <Rocket size={18} />
            Continue Learning
          </Button>
          <Button variant="peach">
            <RefreshCw size={18} />
            Regenerate Course
          </Button>
        </div>
      </div>
    </section>
  );
}
