const DAY_MS = 86400000;

export function buildStudyPlanItems(data, { courseId } = {}) {
  const sourceItems = data.studyPlan?.length ? data.studyPlan : buildLegacyPlan(data);

  return sourceItems
    .filter((item) => !courseId || item.course_id === courseId)
    .map((item, index) => decorateStudyPlanItem(item, data, index))
    .sort(compareStudyPlanItems);
}

export function summarizeStudyPlan(items) {
  const total = items.length;
  const completed = items.filter((item) => item.completed).length;
  const remaining = Math.max(total - completed, 0);
  const estimatedMinutes = items
    .filter((item) => !item.completed)
    .reduce((sum, item) => sum + item.estimatedMinutes, 0);

  return {
    total,
    completed,
    remaining,
    estimatedMinutes,
    percent: total ? Math.round((completed / total) * 100) : 0,
  };
}

export function groupStudyPlanByDate(items) {
  const groups = new Map();

  for (const item of items) {
    const key = item.dueDateKey || "flexible";
    const group = groups.get(key) || {
      key,
      label: item.dueDateLabel,
      date: item.dueDate,
      items: [],
    };
    group.items.push(item);
    groups.set(key, group);
  }

  return [...groups.values()].sort((a, b) => {
    if (a.key === "flexible") return 1;
    if (b.key === "flexible") return -1;
    return a.date - b.date;
  });
}

export function formatPlanDate(value, options = { weekday: "short", month: "short", day: "numeric" }) {
  const date = parsePlanDate(value);
  if (!date) return "Flexible";
  return date.toLocaleDateString(undefined, options);
}

export function formatStudyMinutes(minutes) {
  if (minutes === null || minutes === undefined || Number.isNaN(Number(minutes))) return "Flexible";

  const roundedMinutes = Math.max(0, Math.round(Number(minutes)));
  if (roundedMinutes === 0) return "0 min";
  if (roundedMinutes < 60) return `${roundedMinutes} min`;

  const hours = Math.floor(roundedMinutes / 60);
  const remainder = roundedMinutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function planDateKey(value) {
  const date = parsePlanDate(value);
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parsePlanDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function decorateStudyPlanItem(item, data, index) {
  const module = item.module_id ? findById(data.modules, item.module_id) : null;
  const course = item.course_id ? findById(data.courses, item.course_id) : null;
  const progress = clampPercent(module?.progress ?? (item.completed ? 100 : 0));
  const completed = Boolean(item.completed || progress >= 100 || module?.status === "completed");
  const dueDate = parsePlanDate(item.due_date);
  const dueDateKey = planDateKey(item.due_date);
  const estimatedMinutes = module?.estimated_minutes || parseMinutes(item.meta) || 30;

  return {
    ...item,
    order: index + 1,
    module,
    course,
    progress,
    completed,
    estimatedMinutes,
    dueDate,
    dueDateKey,
    dueDateLabel: dueDate ? formatPlanDate(item.due_date) : "Flexible",
    courseTitle: course?.title || "Course",
    lessonTitle: module ? `Lecture ${module.position}: ${module.title}` : item.title,
    statusLabel: completed ? "Completed" : progress > 0 ? "In progress" : "Not started",
    path: item.course_id && item.module_id ? `/courses/${item.course_id}/modules/${item.module_id}` : null,
  };
}

function buildLegacyPlan(data) {
  return (data.modules || []).slice(0, 7).map((module, index) => ({
    id: module.id,
    course_id: module.course_id,
    module_id: module.id,
    title: `Lecture ${module.position}: ${module.title}`,
    meta: `${module.estimated_minutes || 30} min lecture + quiz`,
    kind: "lesson",
    due_date: offsetDateKey(index),
    completed: module.progress >= 100,
  }));
}

function compareStudyPlanItems(a, b) {
  if (!a.dueDate && !b.dueDate) return a.order - b.order;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;

  const diff = a.dueDate - b.dueDate;
  return diff || a.order - b.order;
}

function findById(items = [], id) {
  return items.find((item) => item.id === id);
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function parseMinutes(value = "") {
  const match = String(value).match(/(\d+)\s*min/i);
  return match ? Number(match[1]) : 0;
}

function offsetDateKey(days) {
  const date = new Date(Date.now() + days * DAY_MS);
  return planDateKey(date);
}
