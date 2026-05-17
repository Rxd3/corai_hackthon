import { BookOpenCheck, CheckCircle2, Circle, FileText, ListChecks, Sparkles, UploadCloud, Youtube } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CourseOptions } from "../components/createCourse/CourseOptions";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { useLearningData } from "../contexts/LearningDataContext";
import { cn } from "../lib/classNames";

const sourceTabs = [
  { id: "upload", label: "Upload Materials", Icon: UploadCloud },
  { id: "topic", label: "Create From Topic", Icon: Sparkles },
];

const helpSteps = [
  "Choose materials or a topic.",
  "Set the level, duration, and goal.",
  "CorAI creates lectures, videos, practice, and quizzes.",
];

const generationSteps = [
  {
    title: "Analyzing your topic...",
    detail: "Reading your prompt and any uploaded study materials.",
    Icon: Sparkles,
  },
  {
    title: "Building your study plan...",
    detail: "Sequencing lessons into a clear learning path.",
    Icon: ListChecks,
  },
  {
    title: "Creating lessons...",
    detail: "Writing explanations, examples, and practice tasks.",
    Icon: BookOpenCheck,
  },
  {
    title: "Preparing quizzes...",
    detail: "Creating checks for understanding and weak-topic signals.",
    Icon: CheckCircle2,
  },
  {
    title: "Finding lecture videos...",
    detail: "Searching YouTube and attaching recommended videos to each lecture.",
    Icon: Youtube,
  },
  {
    title: "Finalizing your course...",
    detail: "Saving your course, videos, schedule, and progress structure.",
    Icon: UploadCloud,
  },
];

export function CreateCoursePage() {
  const navigate = useNavigate();
  const { createCourse } = useLearningData();
  const inputRef = useRef(null);
  const [activeTab, setActiveTab] = useState("upload");
  const [topic, setTopic] = useState("");
  const [files, setFiles] = useState([]);
  const [options, setOptions] = useState({
    level: "Beginner",
    duration: "1 Month",
    goal: "Full Course",
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);

  useEffect(() => {
    if (!loading) {
      setGenerationStep(0);
      return undefined;
    }

    const timer = window.setInterval(() => {
      setGenerationStep((step) => Math.min(step + 1, generationSteps.length - 1));
    }, 1800);

    return () => window.clearInterval(timer);
  }, [loading]);

  function handleFiles(nextFiles) {
    setFiles(Array.from(nextFiles || []));
  }

  async function handleGenerate() {
    setStatus("");
    setError("");

    const payload =
      activeTab === "upload"
        ? { topic: "", files, ...options }
        : { topic, files: [], ...options };

    if (!payload.topic && !payload.files?.length) {
      setError("Add a topic or choose at least one material file.");
      return;
    }

    setLoading(true);
    setGenerationStep(0);
    try {
      const result = await createCourse(payload);
      navigate(`/courses/${result.courseId}`);
      setStatus(result.message);
    } catch (generateError) {
      setError(generateError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Create a New Course"
        subtitle="Turn any material or topic into a structured learning path."
      />
      {loading ? <GenerationStatus step={generationStep} hasFiles={activeTab === "upload" && files.length > 0} /> : null}
      {status ? <p className="mb-5 rounded-[22px] bg-lime px-5 py-4 text-sm font-bold text-navy">{status}</p> : null}
      {error ? <p className="mb-5 rounded-[22px] bg-[#fff0ea] px-5 py-4 text-sm font-bold text-[#d44724]">{error}</p> : null}

      <div className="grid w-full gap-6 2xl:grid-cols-[minmax(760px,1fr)_340px]">
        <section className="soft-card overflow-hidden">
          <div className="border-b border-divider px-4 py-4 sm:px-6">
            <div className="grid gap-2 sm:grid-cols-2">
              {sourceTabs.map(({ id, label, Icon }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    disabled={loading}
                    className={cn(
                      "focus-ring flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-extrabold transition",
                      active ? "bg-navy text-white shadow-card" : "bg-gray-100 text-muted hover:bg-white hover:text-navy",
                    )}
                  >
                    <Icon size={18} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-5 sm:p-7">
            {activeTab === "upload" ? (
              <div>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept=".docx,.pptx,.txt,.md,.markdown"
                  className="hidden"
                  onChange={(event) => handleFiles(event.target.files)}
                />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (loading) return;
                    handleFiles(event.dataTransfer.files);
                  }}
                  disabled={loading}
                  className="focus-ring flex min-h-[300px] w-full flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-divider bg-gray-50 p-6 text-center transition hover:border-navy hover:bg-white"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-lavender text-navy">
                    <FileText size={28} />
                  </span>
                  <span className="mt-5 block text-lg font-extrabold text-ink">Drop your materials here</span>
                  <span className="mt-2 block text-sm font-bold text-muted">
                    {files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "or browse DOCX, PPTX, TXT, or Markdown files"}
                  </span>
                </button>
                {files.length ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {files.map((file) => (
                      <p key={`${file.name}-${file.size}`} className="truncate rounded-2xl bg-gray-50 px-4 py-3 text-xs font-bold text-muted">
                        {file.name}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <label className="block">
                <span className="mb-3 block text-sm font-extrabold text-ink">Topic</span>
                <textarea
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  disabled={loading}
                  rows={9}
                  placeholder="Example: I want to learn Python for data analysis"
                  className="focus-ring min-h-[300px] w-full resize-none rounded-[24px] border border-divider bg-gray-50 p-5 text-sm font-semibold leading-6 text-ink outline-none transition placeholder:text-muted focus:bg-white"
                />
              </label>
            )}

            <div className="mt-7 border-t border-divider pt-6">
              <h2 className="mb-5 text-lg font-extrabold text-ink">Course Settings</h2>
              <CourseOptions value={options} onChange={setOptions} />
            </div>

            <Button className="mt-7 w-full" onClick={handleGenerate} disabled={loading}>
              {loading ? generationSteps[generationStep].title : "Generate Course"}
            </Button>
          </div>
        </section>

        <aside className="soft-card h-fit p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime text-navy">
            <CheckCircle2 size={22} />
          </div>
          <h2 className="mt-5 text-lg font-extrabold text-ink">How It Works</h2>
          <div className="mt-5 space-y-4">
            {helpSteps.map((step, index) => (
              <div key={step} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xs font-extrabold text-navy">
                  {index + 1}
                </span>
                <p className="pt-1 text-sm font-bold leading-5 text-muted">{step}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function CreateCourseRightPanel() {
  return null;
}

function GenerationStatus({ step, hasFiles }) {
  const progress = Math.round(((step + 1) / generationSteps.length) * 100);
  const activeStep = generationSteps[step];
  const ActiveIcon = activeStep.Icon;

  return (
    <section className="mb-5 overflow-hidden rounded-[28px] bg-navy p-5 text-white shadow-soft sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-lime text-navy">
            <ActiveIcon size={24} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-normal text-white/60">
              Course generation in progress
            </p>
            <h2 className="mt-1 text-2xl font-extrabold">{activeStep.title}</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/70">
              {hasFiles ? "Uploaded files can take a little longer while CorAI extracts the useful context. " : ""}
              {activeStep.detail}
            </p>
          </div>
        </div>
        <div className="min-w-[180px]">
          <div className="mb-2 flex justify-between text-xs font-extrabold text-white/70">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-lime transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-5">
        {generationSteps.map(({ title }, index) => {
          const complete = index < step;
          const active = index === step;
          return (
            <div
              key={title}
              className={cn(
                "rounded-2xl px-3 py-3 text-xs font-extrabold transition",
                active ? "bg-white text-navy" : complete ? "bg-white/15 text-white" : "bg-white/5 text-white/50",
              )}
            >
              <span className="mb-2 flex items-center gap-2">
                {complete ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                Step {index + 1}
              </span>
              <span className="block leading-5">{title}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
