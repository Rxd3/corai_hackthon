import { Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/Button";
import { CourseOptions } from "./CourseOptions";

export function TopicInputCard({ onBuild, disabled = false }) {
  const [topic, setTopic] = useState("");
  const [options, setOptions] = useState({
    level: "Beginner",
    duration: "1 Month",
    goal: "Full Course",
  });

  return (
    <section className="soft-card p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime text-navy">
          <Sparkles size={21} />
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-ink">Create From Topic</h2>
          <p className="mt-1 text-sm font-semibold text-muted">Type anything you want to learn.</p>
        </div>
      </div>

      <label className="mt-6 block">
        <textarea
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          rows={7}
          placeholder="I want to learn Python for data analysis"
          className="focus-ring w-full resize-none rounded-[24px] border border-divider bg-gray-50 p-5 text-sm font-semibold leading-6 text-ink outline-none transition placeholder:text-muted focus:bg-white"
        />
      </label>

      <div className="mt-6">
        <CourseOptions value={options} onChange={setOptions} />
      </div>

      <Button className="mt-7 w-full" onClick={() => onBuild({ topic, files: [], ...options })} disabled={disabled}>
        {disabled ? "Generating..." : "Build My Course"}
      </Button>
    </section>
  );
}
