import { cn } from "../../lib/classNames";

export function SectionCard({ children, className, ...props }) {
  return (
    <section className={cn("soft-card p-5 sm:p-6", className)} {...props}>
      {children}
    </section>
  );
}
