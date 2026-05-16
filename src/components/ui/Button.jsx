import { cn } from "../../lib/classNames";

const variants = {
  primary: "bg-navy text-white hover:bg-[#1d1c35]",
  secondary: "bg-white text-navy hover:bg-gray-50",
  peach: "bg-peach text-navy hover:bg-[#ffdba7]",
  ghost: "bg-transparent text-muted hover:bg-white/70 hover:text-navy",
  outline: "border border-divider bg-white text-navy hover:border-navy",
};

export function Button({ children, className, variant = "primary", type = "button", ...props }) {
  return (
    <button
      type={type}
      className={cn(
        "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold transition duration-200 active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
