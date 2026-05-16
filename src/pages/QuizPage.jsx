import { Navigate, useParams } from "react-router-dom";
import { useLearningData } from "../contexts/LearningDataContext";

export function QuizPage() {
  const { courseId, moduleId } = useParams();
  const data = useLearningData();
  const module = moduleId ? data.getModule(moduleId) : data.modules.find((item) => item.progress < 100) || data.modules[0];
  const course = courseId ? data.getCourse(courseId) : data.getCourse(module?.course_id);

  if (!module || !course) {
    return <p className="soft-card p-6 text-sm font-bold text-muted">No quiz is available yet. Generate a course first.</p>;
  }

  return <Navigate to={`/courses/${course.id}/modules/${module.id}#module-quiz`} replace />;
}

export function QuizRightPanel() {
  return null;
}
