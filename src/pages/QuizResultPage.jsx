import { Navigate, useParams } from "react-router-dom";
import { useLearningData } from "../contexts/LearningDataContext";

export function QuizResultPage() {
  const { attemptId } = useParams();
  const data = useLearningData();
  const attempt = data.attempts.find((item) => item.id === attemptId);
  const module = attempt ? data.getModule(attempt.module_id) : null;
  const course = attempt ? data.getCourse(attempt.course_id) : null;

  if (!attempt || !module || !course) {
    return <p className="soft-card p-6 text-sm font-bold text-muted">Quiz result not found.</p>;
  }

  return <Navigate to={`/courses/${course.id}/modules/${module.id}#module-quiz`} replace />;
}
