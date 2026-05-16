import { BarChart3, ChevronRight, Target } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { CourseHeader } from "../components/course/CourseHeader";
import { CourseRoadmap } from "../components/course/CourseRoadmap";
import { LearningOutcomesCard } from "../components/course/LearningOutcomesCard";
import { ModuleCard } from "../components/course/ModuleCard";
import { Button } from "../components/ui/Button";
import { ProgressBar } from "../components/ui/ProgressBar";
import { useLearningData } from "../contexts/LearningDataContext";

export function CourseDetailsPage() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const data = useLearningData();
  const course = data.getCourse(courseId);
  const modules = data.getModules(courseId);

  if (!course) {
    return <MissingCourse />;
  }

  const nextModule = modules.find((module) => module.progress < 100) || modules[0];

  return (
    <div className="space-y-6">
      <CourseHeader
        course={course}
        onContinue={() => navigate(nextModule ? `/courses/${course.id}/modules/${nextModule.id}` : `/courses/${course.id}`)}
      />

      <div className="grid gap-5 2xl:grid-cols-[0.85fr_1.15fr]">
        <LearningOutcomesCard outcomes={course.learning_outcomes || []} />
        <CourseRoadmap modules={modules} />
      </div>

      <section>
        <h2 className="mb-4 text-xl font-extrabold text-ink">Lessons</h2>
        <div className="grid gap-5 md:grid-cols-2">
          {modules.map((module) => (
            <ModuleCard key={module.id} module={module} onOpen={() => navigate(`/courses/${course.id}/modules/${module.id}`)} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function CourseDetailsRightPanel() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const data = useLearningData();
  const course = data.getCourse(courseId);
  const modules = data.getModules(courseId);
  const weakTopics = data.getCourseWeakTopics(courseId);

  if (!course) {
    return null;
  }

  const passedQuizzes = modules.filter((module) => data.getLatestAttemptForModule(module.id)?.score >= 60).length;
  const nextModule = modules.find((module) => module.progress < 100) || modules[0];

  return (
    <>
      <section className="soft-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-ink">Course Progress</h2>
          <BarChart3 size={19} className="text-navy" />
        </div>
        <p className="mt-5 text-5xl font-extrabold text-navy">{course.progress}%</p>
        <ProgressBar value={course.progress} className="mt-4" />
        <div className="mt-5 space-y-3 text-sm font-bold text-muted">
          <p>Completed: {modules.filter((module) => module.progress >= 100).length} / {modules.length} lessons</p>
          <p>Quizzes passed: {passedQuizzes} / {modules.length}</p>
          <p>Average score: {averageScore(data.attempts.filter((attempt) => attempt.course_id === course.id))}%</p>
        </div>
        <Button className="mt-5 w-full" variant="outline" onClick={() => navigate(`/progress/${course.id}`)}>
          View Progress
        </Button>
      </section>

      <section className="soft-card p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff0ea] text-[#d44724]">
            <Target size={18} />
          </span>
          <h2 className="text-lg font-extrabold text-ink">Weak Topics</h2>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {(weakTopics.length ? weakTopics : ["Complete a quiz to detect weak topics"]).map((topic) => (
            <span key={topic} className="rounded-2xl bg-gray-100 px-3 py-2 text-xs font-extrabold text-muted">
              {topic}
            </span>
          ))}
        </div>
      </section>

      <section className="soft-card p-5">
        <h2 className="text-lg font-extrabold text-ink">Next Step</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-muted">
          {nextModule ? `Continue ${nextModule.title} and complete the quiz.` : "Create a lesson to continue."}
        </p>
        <Button className="mt-5 w-full" onClick={() => nextModule && navigate(`/courses/${course.id}/modules/${nextModule.id}`)}>
          Open Plan
          <ChevronRight size={17} />
        </Button>
      </section>
    </>
  );
}

function MissingCourse() {
  const navigate = useNavigate();

  return (
    <div className="soft-card p-6">
      <h1 className="text-2xl font-extrabold text-ink">Course not found</h1>
      <p className="mt-2 text-sm font-semibold text-muted">Choose another course or create a new one.</p>
      <Button className="mt-5" onClick={() => navigate("/courses")}>
        Back to Courses
      </Button>
    </div>
  );
}

function averageScore(attempts) {
  if (!attempts.length) {
    return 0;
  }

  return Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length);
}
