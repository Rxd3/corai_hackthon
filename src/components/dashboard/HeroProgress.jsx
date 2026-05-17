import { FileUp, Plus } from "lucide-react";
import { Button } from "../ui/Button";
import { CourseCard } from "./CourseCard";

export function HeroProgress({ courses, onCreate, onCourseOpen, userName = "there" }) {
  return (
    <section className="overflow-hidden rounded-[32px] bg-navy p-6 text-white shadow-soft sm:p-8 lg:p-10">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
        <div className="flex flex-col justify-start">
          <p className="text-base font-semibold text-white/70">Hi, {userName}!</p>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl lg:text-3xl">
            What would you like to learn today?
          </h1>
          <p className="mt-5 text-sm font-medium leading-6 text-white/60">
            Upload your materials or create a course from any topic.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" onClick={onCreate}>
              <FileUp size={18} />
              Upload Materials
            </Button>
            <Button variant="peach" onClick={onCreate}>
              <Plus size={18} />
              Create from Topic
            </Button>
          </div>
        </div>

        <div className="flex flex-col">
          {courses.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
              {courses.slice(0, 3).map((course) => (
                <CourseCard key={course.id} course={course} compact onOpen={() => onCourseOpen(course.id)} />
              ))}
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center rounded-[28px] bg-white/5 backdrop-blur-sm">
              <p className="text-center text-sm font-medium text-white/50">
                Your generated courses will appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
