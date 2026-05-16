import { ArrowLeft, ArrowRight, CheckCircle2, Circle, PlayCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AskAIBox } from "../components/module/AskAIBox";
import { ExamplesCard } from "../components/module/ExamplesCard";
import { ExplanationCard } from "../components/module/ExplanationCard";
import { KeyConceptsCard } from "../components/module/KeyConceptsCard";
import { ModuleQuizCard } from "../components/module/ModuleQuizCard";
import { PracticeTaskCard } from "../components/module/PracticeTaskCard";
import { VideoLessonCard } from "../components/module/VideoLessonCard";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { ProgressBar } from "../components/ui/ProgressBar";
import { SectionCard } from "../components/ui/SectionCard";
import { useLearningData } from "../contexts/LearningDataContext";
import { normalizeArray } from "../lib/learningTransforms";

export function ModuleLessonPage() {
  const { courseId, moduleId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const data = useLearningData();
  const module = data.getModule(moduleId);
  const course = data.getCourse(courseId);
  const videos = data.getVideos(moduleId);
  const quiz = data.getQuizForModule(moduleId);
  const questions = quiz ? data.getQuestions(quiz.id) : [];
  const latestAttempt = quiz ? data.getLatestAttemptForQuiz(quiz.id) : null;
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

  useEffect(() => {
    if (location.hash !== "#module-quiz") return;

    window.requestAnimationFrame(() => {
      document.getElementById("module-quiz")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [location.hash, questions.length]);

  async function markPracticeComplete() {
    if (!module || !course) return;
    await data.updateModuleProgress({ courseId: course.id, moduleId: module.id, section: "practice", percent: 70 });
  }

  if (!module || !course) {
    return <p className="soft-card p-6 text-sm font-bold text-muted">Lesson not found.</p>;
  }

  const courseModules = data.getModules(course.id).sort((a, b) => a.position - b.position);
  const moduleIndex = courseModules.findIndex((item) => item.id === module.id);
  const previousModule = moduleIndex > 0 ? courseModules[moduleIndex - 1] : null;
  const nextModule = moduleIndex >= 0 && moduleIndex < courseModules.length - 1 ? courseModules[moduleIndex + 1] : null;

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
        <ModuleQuizCard
          course={course}
          module={module}
          quiz={quiz}
          questions={questions}
          latestAttempt={latestAttempt}
          onSaveAttempt={data.saveQuizAttempt}
        />
        <ModuleNavigationCard
          previousModule={previousModule}
          nextModule={nextModule}
          onPrevious={() => previousModule && navigate(`/courses/${course.id}/modules/${previousModule.id}`)}
          onNext={() => nextModule && navigate(`/courses/${course.id}/modules/${nextModule.id}`)}
        />
      </div>
    </div>
  );
}

function ModuleNavigationCard({ previousModule, nextModule, onPrevious, onNext }) {
  if (!previousModule && !nextModule) {
    return null;
  }

  return (
    <SectionCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {previousModule ? (
          <Button variant="outline" onClick={onPrevious}>
            <ArrowLeft size={17} />
            Previous Module
          </Button>
        ) : (
          <span />
        )}
        {nextModule ? (
          <Button onClick={onNext}>
            Next Module
            <ArrowRight size={17} />
          </Button>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 text-sm font-bold text-muted sm:grid-cols-2">
        {previousModule ? <p>Back: {previousModule.title}</p> : <p />}
        {nextModule ? <p className="sm:text-right">Next: {nextModule.title}</p> : null}
      </div>
    </SectionCard>
  );
}

export function ModuleLessonRightPanel() {
  const { courseId, moduleId } = useParams();
  const data = useLearningData();
  const module = data.getModule(moduleId);
  const quiz = data.getQuizForModule(moduleId);
  const latestAttempt = quiz ? data.getLatestAttemptForQuiz(quiz.id) : null;

  if (!module) return null;

  function focusQuiz() {
    window.history.replaceState(null, "", `/courses/${courseId}/modules/${moduleId}#module-quiz`);
    document.getElementById("module-quiz")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
        <h2 className="text-lg font-extrabold text-ink">Module Quiz</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-muted">
          {latestAttempt ? `Latest score: ${latestAttempt.score}%` : `Answer ${quiz ? data.getQuestions(quiz.id).length : 0} questions on ${module.title}.`}
        </p>
        <Button className="mt-5 w-full" onClick={focusQuiz}>
          <PlayCircle size={17} />
          {latestAttempt ? "View Quiz" : "Take Quiz"}
        </Button>
      </section>
    </>
  );
}
