import { Search } from "lucide-react";

export function TopBar({ user }) {
  const initials = getInitials(user);

  return (
    <header className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <label className="focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-navy flex min-h-12 w-full items-center gap-3 rounded-2xl bg-white px-4 shadow-card xl:max-w-xl">
        <Search size={18} className="text-muted" />
        <input
          className="w-full bg-transparent text-sm font-semibold text-ink outline-none placeholder:text-muted"
          placeholder="Search for a course, lecture, quiz, or topic..."
        />
      </label>

      <div className="flex items-center gap-3 self-end xl:self-auto">
        <button
          type="button"
          aria-label="Profile"
          className="focus-ring flex h-12 w-12 items-center justify-center rounded-full bg-navy text-sm font-extrabold text-white shadow-card"
        >
          {initials}
        </button>
      </div>
    </header>
  );
}

function getInitials(user) {
  const name = user?.user_metadata?.full_name || user?.email || "CO";
  const parts = name.split(/[ @._-]/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
