import {
  Bot,
  CalendarDays,
  GraduationCap,
  Home,
  MessageCircleQuestion,
  PlusCircle,
  RotateCcw,
  Settings,
} from "lucide-react";
import { navItems } from "../../lib/navItems";
import { cn } from "../../lib/classNames";

const iconMap = {
  dashboard: Home,
  create: PlusCircle,
  courses: GraduationCap,
  "study-plan": CalendarDays,
  "ask-ai": MessageCircleQuestion,
  settings: Settings,
};

export function Sidebar({ activePage, onNavigate, onLogout }) {
  return (
    <aside className="hidden w-[232px] shrink-0 flex-col border-r border-divider/80 px-5 py-7 lg:flex">
      <button
        type="button"
        onClick={() => onNavigate("dashboard")}
        className="focus-ring mb-9 flex items-center gap-3 rounded-2xl text-left"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy text-lime shadow-card">
          <Bot size={24} strokeWidth={2.4} />
        </span>
        <span>
          <span className="block text-xl font-extrabold text-navy">CorAI</span>
          <span className="block text-xs font-bold text-muted">AI Course Builder</span>
        </span>
      </button>

      <nav className="flex flex-1 flex-col gap-2">
        {navItems.map((item) => {
          const Icon = iconMap[item.id];
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={cn(
                "focus-ring group relative flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-bold transition",
                active ? "bg-white text-navy shadow-card" : "text-muted hover:bg-white/75 hover:text-navy",
              )}
            >
              <span
                className={cn(
                  "absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full transition",
                  active ? "bg-navy" : "bg-transparent",
                )}
              />
              <Icon size={19} strokeWidth={2.2} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onLogout}
        className="focus-ring mt-8 flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-bold text-muted transition hover:bg-white hover:text-navy"
      >
        <RotateCcw size={19} />
        Reset demo
      </button>
    </aside>
  );
}
