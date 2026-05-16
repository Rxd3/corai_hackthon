import { CalendarCheck2, SlidersHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { useLearningData } from "../contexts/LearningDataContext";

export function StudyPlanPage() {
  const navigate = useNavigate();
  const data = useLearningData();
  const items = data.studyPlan.length ? data.studyPlan : fallbackPlan(data);

  return (
    <div>
      <PageHeader title="Study Plan" subtitle="Your personalized weekly learning schedule." />
      <div className="soft-card p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {items.map((item, index) => (
            <button
              key={item.id || `${item.title}-${index}`}
              type="button"
              onClick={() => item.module_id && navigate(`/courses/${item.course_id}/modules/${item.module_id}`)}
              className="focus-ring rounded-[24px] bg-gray-50 p-5 text-left transition hover:-translate-y-1 hover:bg-white hover:shadow-card"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-navy text-sm font-extrabold text-white">
                {index + 1}
              </span>
              <h2 className="mt-5 text-lg font-extrabold text-ink">{formatDate(item.due_date)}</h2>
              <p className="mt-3 text-sm font-extrabold leading-5 text-navy">{item.title}</p>
              <p className="mt-2 text-xs font-bold leading-5 text-muted">{item.meta}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StudyPlanRightPanel() {
  const data = useLearningData();
  const openItems = data.studyPlan.filter((item) => !item.completed);

  return (
    <section className="soft-card p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lavender text-navy">
          <CalendarCheck2 size={18} />
        </span>
        <h2 className="text-lg font-extrabold text-ink">This Week</h2>
      </div>
      <div className="mt-5 space-y-3 text-sm font-bold text-muted">
        <p>{openItems.length} study sessions</p>
        <p>{data.quizzes.length} quizzes</p>
        <p>{data.getCourseWeakTopics(data.courses[0]?.id).length || 0} review topics</p>
        <p>Estimated time: {Math.round(data.modules.reduce((sum, module) => sum + (module.estimated_minutes || 0), 0) / 60)} hours</p>
      </div>
      <Button className="mt-6 w-full">
        <SlidersHorizontal size={17} />
        Adjust Plan
      </Button>
    </section>
  );
}

function fallbackPlan(data) {
  return data.modules.slice(0, 7).map((module, index) => ({
    id: module.id,
    course_id: module.course_id,
    module_id: module.id,
    title: `Lesson ${module.position}: ${module.title}`,
    meta: `${module.estimated_minutes} min lesson + quiz`,
    due_date: addDays(index),
  }));
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "Flexible";
  return new Date(value).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}
