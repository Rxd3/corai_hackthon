import { Bot } from "lucide-react";
import { useParams } from "react-router-dom";
import { StatsCard } from "../components/dashboard/StatsCard";
import { ProgressOverview } from "../components/progress/ProgressOverview";
import { ProgressTable } from "../components/progress/ProgressTable";
import { StudyActivityChart } from "../components/progress/StudyActivityChart";
import { WeakTopicHeatmap } from "../components/progress/WeakTopicHeatmap";
import { PageHeader } from "../components/ui/PageHeader";
import { useLearningData } from "../contexts/LearningDataContext";
import { buildStudyPlanItems } from "../lib/studyPlan";

export function ProgressTrackingPage() {
  const { courseId } = useParams();
  const data = useLearningData();
  const course = courseId ? data.getCourse(courseId) : data.courses[0];
  const modules = course ? data.getModules(course.id) : [];
  const attempts = course ? data.attempts.filter((attempt) => attempt.course_id === course.id) : data.attempts;
  const average = attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length) : 0;

  return (
    <div>
      <PageHeader title="Progress Tracking" subtitle="Track your courses, quiz scores, weak topics, and study activity." />
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <StatsCard value={`${course?.progress || 0}%`} label="Overall Progress" />
        <StatsCard value={modules.filter((module) => module.progress >= 100).length} label="Lectures Completed" />
        <StatsCard value={`${average}%`} label="Average Quiz Score" />
        <StatsCard value={studyStreak(attempts)} label="Days Study Streak" />
      </div>
      <div className="mt-6 space-y-5">
        <ProgressOverview course={course} modules={modules} />
        <ProgressTable modules={modules} />
        <WeakTopicHeatmap topics={weakTopicCards(attempts)} />
        <StudyActivityChart activityBars={activityBars(attempts)} />
      </div>
    </div>
  );
}

export function ProgressRightPanel() {
  const { courseId } = useParams();
  const data = useLearningData();
  const course = courseId ? data.getCourse(courseId) : data.courses[0];
  const weakTopic = course ? data.getCourseWeakTopics(course.id)[0] : null;
  const planItems = buildStudyPlanItems(data, { courseId: course?.id });
  const nextItem = planItems.find((item) => !item.completed);

  return (
    <>
      <section className="soft-card p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lime text-navy">
            <Bot size={18} />
          </span>
          <h2 className="text-lg font-extrabold text-ink">AI Recommendation</h2>
        </div>
        <p className="mt-4 text-sm font-semibold leading-6 text-muted">
          {weakTopic ? `Spend 30 minutes reviewing ${weakTopic}, then retake the related quiz.` : "Complete a quiz to unlock personalized recommendations."}
        </p>
      </section>
      <section className="soft-card p-5">
        <h2 className="text-lg font-extrabold text-ink">Upcoming Study Plan</h2>
        <div className="mt-4 space-y-3 text-sm font-bold text-muted">
          <p>{nextItem?.lessonTitle || "No upcoming items yet"}</p>
          <p>{nextItem ? `${nextItem.estimatedMinutes} min · ${nextItem.statusLabel}` : "Generate a course to create a plan"}</p>
          <p>{nextItem?.dueDateLabel || "Flexible"}</p>
        </div>
      </section>
    </>
  );
}

function weakTopicCards(attempts) {
  const scoresByTopic = new Map();

  for (const attempt of attempts) {
    for (const topic of attempt.weak_topics || []) {
      const values = scoresByTopic.get(topic) || [];
      values.push(attempt.score);
      scoresByTopic.set(topic, values);
    }
  }

  return [...scoresByTopic.entries()].slice(0, 3).map(([topic, scores]) => {
    const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    return {
      label: average < 60 ? "Needs Review" : "Medium",
      topic,
      score: `${average}%`,
      className: average < 60 ? "bg-[#fff0ea] text-[#d44724]" : "bg-peach text-navy",
    };
  });
}

function activityBars(attempts) {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hours = new Array(7).fill(0);

  for (const attempt of attempts) {
    const date = new Date(attempt.created_at);
    hours[date.getDay()] += 0.5;
  }

  return labels.map((day, index) => ({ day, hours: hours[index] }));
}

function studyStreak(attempts) {
  const days = new Set(attempts.map((attempt) => new Date(attempt.created_at).toDateString()));
  let streak = 0;
  const cursor = new Date();

  while (days.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
