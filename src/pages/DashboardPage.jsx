import { BarChart3, BookOpenCheck, GraduationCap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AITipCard } from "../components/dashboard/AITipCard";
import { CalendarPanel } from "../components/dashboard/CalendarPanel";
import { HeroProgress } from "../components/dashboard/HeroProgress";
import { RecommendedTasks } from "../components/dashboard/RecommendedTasks";
import { StatsCard } from "../components/dashboard/StatsCard";
import { UpcomingCard } from "../components/dashboard/UpcomingCard";
import { useLearningData } from "../contexts/LearningDataContext";

export function DashboardPage() {
  const navigate = useNavigate();
  const data = useLearningData();
  const completedModules = data.modules.filter((module) => module.progress >= 100 || module.status === "completed").length;
  const studyHours = Math.max(0.5, Math.round((data.attempts.length * 0.35 + completedModules * 0.5) * 10) / 10);
  const tasks = buildRecommendedTasks(data);

  function handleTask(task) {
    if (task.quizPath) {
      navigate(task.quizPath);
      return;
    }

    if (task.modulePath) {
      navigate(task.modulePath);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">My Learning Progress</h1>
      </div>

      <HeroProgress
        courses={data.courses}
        userName="there"
        onCreate={() => navigate("/create")}
        onCourseOpen={(courseId) => navigate(`/courses/${courseId}`)}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard value={data.courses.length} label="Courses Generated" icon={GraduationCap} />
        <StatsCard value={completedModules} label="Modules Completed" icon={BookOpenCheck} />
        <StatsCard value={`${studyHours}h`} label="Study Hours This Week" icon={BarChart3} chart />
      </div>

      <RecommendedTasks tasks={tasks} onTask={handleTask} />
    </div>
  );
}

export function DashboardRightPanel() {
  const data = useLearningData();
  const weakTopic = data.attempts.flatMap((attempt) => attempt.weak_topics || [])[0];

  return (
    <>
      <CalendarPanel />
      <UpcomingCard item={data.studyPlan.find((item) => !item.completed)} />
      <AITipCard
        tip={
          weakTopic
            ? `Review ${weakTopic}, then retake the related quiz to improve your score.`
            : "Generate a course and complete a quiz to get personalized AI study tips."
        }
      />
    </>
  );
}

function buildRecommendedTasks(data) {
  const firstCourse = data.courses[0];
  if (!firstCourse) {
    return [];
  }

  const courseModules = data.modules.filter((module) => module.course_id === firstCourse.id);
  const reviewModule = courseModules.find((module) => module.status === "needs review") || courseModules.find((module) => module.progress < 100);

  if (!reviewModule) {
    return [
      {
        type: "Review",
        title: firstCourse.title,
        course: firstCourse.title,
        date: "Anytime",
        color: "bg-lime",
        modulePath: `/courses/${firstCourse.id}`,
      },
    ];
  }

  return [
    {
      type: "Take Quiz",
      title: reviewModule.title,
      course: firstCourse.title,
      date: "Today",
      color: "bg-lavender",
      quizPath: `/courses/${firstCourse.id}/modules/${reviewModule.id}#module-quiz`,
    },
    {
      type: "Watch Lesson",
      title: reviewModule.title,
      course: firstCourse.title,
      date: "Next",
      color: "bg-peach",
      modulePath: `/courses/${firstCourse.id}/modules/${reviewModule.id}`,
    },
  ];
}
