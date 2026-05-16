import { CheckCircle2, Circle, PlayCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AskAIBox } from "../components/module/AskAIBox";
import { ExamplesCard } from "../components/module/ExamplesCard";
import { ExplanationCard } from "../components/module/ExplanationCard";
import { KeyConceptsCard } from "../components/module/KeyConceptsCard";
import { PracticeTaskCard } from "../components/module/PracticeTaskCard";
import { VideoLessonCard } from "../components/module/VideoLessonCard";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { ProgressBar } from "../components/ui/ProgressBar";
import { useLearningData } from "../contexts/LearningDataContext";
import { normalizeArray } from "../lib/learningTransforms";

export function ModuleLessonPage() {
  const { courseId, moduleId } = useParams();
  const data = useLearningData();
  const module = data.getModule(moduleId);
  const course = data.getCourse(courseId);
  const videos = data.getVideos(moduleId);
  const [videoStatus, setVideoStatus] = useState("");
  const [videoLoading, setVideoLoading] = useState(false);

  useEffect(() => {
    if (!course || !module || videos.length || videoLoading || videoStatus) return;

    let active = true;
    setVideoLoading(true);
    data
      .loadVideosForModule({ course, module })
      .then((result) => {
        if (!active) return;
        setVideoStatus(result.videos.length ? "" : "No non-Shorts YouTube videos were found for this lesson.");
      })
      .catch((error) => active && setVideoStatus(error.message))
      .finally(() => active && setVideoLoading(false));

    return () => {
      active = false;
    };
  }, [course, data, module, videoLoading, videoStatus, videos.length]);

  async function markPracticeComplete() {
    if (!module || !course) return;
    await data.updateModuleProgress({ courseId: course.id, moduleId: module.id, section: "practice", percent: 70 });
  }

  if (!module || !course) {
    return <p className="soft-card p-6 text-sm font-bold text-muted">Lesson not found.</p>;
  }

  return (
    <div>
      <PageHeader title={`Lesson ${module.position}: ${module.title}`} subtitle={course.title} />
      <div className="mb-6 rounded-[22px] bg-white p-4 shadow-card">
        <div className="mb-2 flex justify-between text-sm font-extrabold text-muted">
          <span>Progress</span>
          <span>{module.progress}% complete</span>
        </div>
        <ProgressBar value={module.progress} />
      </div>

      {videoLoading ? (
        <p className="mb-5 rounded-[20px] bg-navy px-4 py-3 text-sm font-bold text-white">Searching YouTube for this lesson...</p>
      ) : null}
      {videoStatus ? <p className="mb-5 rounded-[20px] bg-peach px-4 py-3 text-sm font-bold text-navy">{videoStatus}</p> : null}

      <div className="space-y-5">
        <VideoLessonCard video={videos[0]} moduleTitle={module.title} />
        <ExplanationCard explanation={module.explanation} />
        <KeyConceptsCard concepts={normalizeArray(module.key_concepts)} />
        <ExamplesCard examples={normalizeArray(module.examples)} />
        <PracticeTaskCard tasks={normalizeArray(module.practice_tasks)} onComplete={markPracticeComplete} />
      </div>
    </div>
  );
}

export function ModuleLessonRightPanel() {
  const navigate = useNavigate();
  const { courseId, moduleId } = useParams();
  const data = useLearningData();
  const module = data.getModule(moduleId);
  const quiz = data.getQuizForModule(moduleId);

  if (!module) return null;

  return (
    <>
      <section className="soft-card p-5">
        <h2 className="text-lg font-extrabold text-ink">Lesson Progress</h2>
        <p className="mt-5 text-5xl font-extrabold text-navy">{module.progress}%</p>
        <ProgressBar value={module.progress} className="mt-4" />
        <div className="mt-5 space-y-3 text-sm font-bold text-muted">
          <p className="flex items-center gap-2">
            <CheckCircle2 size={17} className="text-navy" />
            Lesson opened
          </p>
          <p className="flex items-center gap-2">
            {module.progress >= 70 ? <CheckCircle2 size={17} className="text-navy" /> : <Circle size={17} />}
            Practice {module.progress >= 70 ? "complete" : "pending"}
          </p>
          <p className="flex items-center gap-2">
            {module.progress >= 100 ? <CheckCircle2 size={17} className="text-navy" /> : <Circle size={17} />}
            Quiz {module.progress >= 100 ? "completed" : "not completed"}
          </p>
        </div>
      </section>
      <AskAIBox courseId={courseId} moduleId={moduleId} />
      <section className="soft-card p-5">
        <h2 className="text-lg font-extrabold text-ink">Next Quiz</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-muted">
          Answer {quiz ? data.getQuestions(quiz.id).length : 0} questions on {module.title}.
        </p>
        <Button className="mt-5 w-full" onClick={() => navigate(`/courses/${courseId}/modules/${moduleId}/quiz`)}>
          <PlayCircle size={17} />
          Start Quiz
        </Button>
      </section>
    </>
  );
}
