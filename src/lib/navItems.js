export const navItems = [
  { id: "dashboard", label: "Dashboard", path: "/" },
  { id: "create", label: "Create Course", path: "/create" },
  { id: "courses", label: "My Courses", path: "/courses" },
  { id: "study-plan", label: "Study Plan", path: "/study-plan" },
  { id: "ask-ai", label: "Ask AI", path: "/ask-ai" },
  { id: "settings", label: "Settings", path: "/settings" },
];

export const pathByNavId = Object.fromEntries(navItems.map((item) => [item.id, item.path]));
