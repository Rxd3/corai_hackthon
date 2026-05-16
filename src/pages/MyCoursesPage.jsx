import { CalendarClock, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { ProgressBar } from "../components/ui/ProgressBar";
import { useLearningData } from "../contexts/LearningDataContext";
import { cn } from "../lib/classNames";

const filters = ["All", "In Progress", "Completed", "Needs Review"];
const cardStyles = {
  lavender: "bg-lavender",
  peach: "bg-peach",
  lime: "bg-lime",
};

export function MyCoursesPage() {
  const navigate = useNavigate();
  const { courses, modules } = useLearningData();
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");

  const visibleCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesSearch = course.title.toLowerCase().includes(query.toLowerCase());
      if (filter === "All") return matchesSearch;
      if (filter === "Completed") return matchesSearch && course.progress >= 100;
      if (filter === "Needs Review") {
        return matchesSearch && modules.some((module) => module.course_id === course.id && module.status === "needs review");
      }
      return matchesSearch && course.progress > 0 && course.progress < 100;
    });
  }, [courses, filter, modules, query]);

  function continueCourse(courseId) {
    const nextModule = modules.find((module) => module.course_id === courseId && module.progress < 100) || modules.find((module) => module.course_id === courseId);
    navigate(nextModule ? `/courses/${courseId}/modules/${nextModule.id}` : `/courses/${courseId}`);
  }

  return (
    <div>
      <PageHeader
        title="My Courses"
        subtitle="All your AI-generated learning paths in one place."
        action={<Button onClick={() => navigate("/create")}>Create New Course</Button>}
      />

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={cn(
                "focus-ring rounded-2xl px-4 py-2 text-sm font-bold transition",
                filter === item ? "bg-navy text-white" : "bg-white text-muted hover:text-navy",
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-navy flex min-h-11 items-center gap-3 rounded-2xl bg-white px-4 shadow-card lg:w-72">
          <Search size={17} className="text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-muted"
            placeholder="Search courses..."
          />
        </label>
      </div>

      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {visibleCourses.map((course) => (
          <article
            key={course.id}
            className={cn("rounded-[26px] p-5 text-navy shadow-card transition hover:-translate-y-1 hover:shadow-soft", cardStyles[course.cardColor])}
          >
            <p className="text-xs font-extrabold opacity-70">{course.source}</p>
            <h2 className="mt-2 min-h-14 text-2xl font-extrabold leading-tight">{course.title}</h2>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm font-bold">
              <span className="rounded-2xl bg-white/45 px-3 py-2">{course.modules} lessons</span>
              <span className="rounded-2xl bg-white/45 px-3 py-2">{course.progress}% progress</span>
            </div>
            <ProgressBar value={course.progress} className="mt-5 bg-white/45" />
            <p className="mt-4 flex items-center gap-2 text-sm font-bold opacity-70">
              <CalendarClock size={17} />
              Last studied: {course.lastStudied}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => continueCourse(course.id)}>
                Continue
              </Button>
              <Button onClick={() => navigate(`/courses/${course.id}`)}>View Details</Button>
            </div>
          </article>
        ))}
      </div>
      {!visibleCourses.length ? (
        <div className="soft-card p-6 text-sm font-bold text-muted">
          No courses found. Create your first course from a topic or uploaded materials.
        </div>
      ) : null}
    </div>
  );
}
