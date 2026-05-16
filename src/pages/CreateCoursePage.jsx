import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopicInputCard } from "../components/createCourse/TopicInputCard";
import { UploadMaterialsCard } from "../components/createCourse/UploadMaterialsCard";
import { PageHeader } from "../components/ui/PageHeader";
import { useLearningData } from "../contexts/LearningDataContext";

const steps = [
  "Upload or type a topic",
  "AI extracts learning outcomes",
  "AI builds lessons",
  "AI adds quizzes and videos",
  "You track your progress",
];

export function CreateCoursePage() {
  const navigate = useNavigate();
  const { createCourse } = useLearningData();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGenerate(payload) {
    setStatus("");
    setError("");

    if (!payload.topic && !payload.files?.length) {
      setError("Add a topic or choose at least one material file.");
      return;
    }

    setLoading(true);
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
    <div>
      <PageHeader
        title="Create a New Course"
        subtitle="Turn any material or topic into a structured learning path."
      />
      <div className="mb-5 rounded-[22px] bg-peach px-5 py-4 text-sm font-bold leading-6 text-navy">
        Local AI mode: data is saved in this browser only. Courses are saved only after non-Shorts YouTube videos are found for every lesson.
      </div>
      {loading ? (
        <p className="mb-5 rounded-[22px] bg-navy px-5 py-4 text-sm font-bold leading-6 text-white" aria-live="polite">
          Generating your course and finding lesson videos. The course will not be saved unless videos are ready.
        </p>
      ) : null}
      {status ? <p className="mb-5 rounded-[22px] bg-lime px-5 py-4 text-sm font-bold text-navy">{status}</p> : null}
      {error ? (
        <p className="mb-5 rounded-[22px] bg-[#fff0ea] px-5 py-4 text-sm font-bold leading-6 text-[#d44724]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid gap-5 2xl:grid-cols-2">
        <UploadMaterialsCard onGenerate={handleGenerate} disabled={loading} />
        <TopicInputCard onBuild={handleGenerate} disabled={loading} />
      </div>
    </div>
  );
}

export function CreateCourseRightPanel() {
  return (
    <section className="soft-card p-5">
      <h2 className="text-lg font-extrabold text-ink">How CorAI Works</h2>
      <div className="mt-5 space-y-4">
        {steps.map((step, index) => (
          <div key={step} className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-navy text-xs font-extrabold text-white">
              {index + 1}
            </span>
            <p className="pt-1 text-sm font-bold leading-5 text-muted">{step}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-[20px] bg-lime p-4 text-navy">
        <CheckCircle2 size={22} />
        <p className="mt-3 text-sm font-extrabold leading-5">Local-first mode lets you test the product before adding Supabase.</p>
      </div>
    </section>
  );
}
