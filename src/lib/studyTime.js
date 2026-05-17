const MAX_SESSION_MS = 4 * 60 * 60 * 1000;
const STORE_PREFIX = "corai.studyTime.v1";

export function startStoredStudySession({ userId, courseId, moduleId }) {
  if (!canStore() || !userId || !courseId || !moduleId) return;

  const store = readStore(userId);
  const key = activeSessionKey(courseId, moduleId);
  const now = Date.now();
  const active = store.active[key];

  store.active[key] = active && now - active.startedAt < MAX_SESSION_MS
    ? { ...active, lastSeenAt: new Date(now).toISOString() }
    : {
        courseId,
        moduleId,
        startedAt: now,
        startedAtIso: new Date(now).toISOString(),
        lastSeenAt: new Date(now).toISOString(),
      };

  writeStore(userId, store);
}

export function finishStoredStudySession({ userId, courseId, moduleId, completedBy }) {
  if (!canStore() || !userId || !courseId || !moduleId) return null;

  const store = readStore(userId);
  const key = activeSessionKey(courseId, moduleId);
  const active = store.active[key];
  const now = Date.now();

  if (!active?.startedAt || now <= active.startedAt) {
    return null;
  }

  const durationMs = Math.min(now - active.startedAt, MAX_SESSION_MS);
  const endedAt = new Date(now).toISOString();
  const session = {
    id: `${key}-${now}`,
    courseId,
    moduleId,
    completedBy: completedBy || "study",
    startedAt: active.startedAtIso || new Date(active.startedAt).toISOString(),
    endedAt,
    durationMs,
    weekKey: weekKeyForDate(new Date(now)),
  };

  store.sessions = [...(store.sessions || []), session].slice(-200);
  delete store.active[key];

  writeStore(userId, store);
  return session;
}

export function getStudyTimeSummary(userId, date = new Date()) {
  if (!canStore() || !userId) {
    return emptySummary();
  }

  const store = readStore(userId);
  const currentWeekKey = weekKeyForDate(date);
  const weeklySessions = (store.sessions || []).filter((session) => session.weekKey === currentWeekKey);
  const totalMs = weeklySessions.reduce((sum, session) => sum + (Number(session.durationMs) || 0), 0);

  return {
    weekKey: currentWeekKey,
    sessions: weeklySessions,
    totalMs,
    totalMinutes: Math.round(totalMs / 60000),
    totalHours: Math.round((totalMs / 3600000) * 10) / 10,
  };
}

export function formatStudyHours(summary) {
  const minutes = summary?.totalMinutes || 0;
  if (minutes <= 0) return "0h";
  if (minutes < 60) return `${minutes}m`;
  return `${summary.totalHours}h`;
}

function readStore(userId) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(userId)) || "{}");
    return {
      active: parsed.active && typeof parsed.active === "object" ? parsed.active : {},
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch {
    return { active: {}, sessions: [] };
  }
}

function writeStore(userId, store) {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(store));
  } catch {
    // Study time tracking should never block course progress.
  }
}

function storageKey(userId) {
  return `${STORE_PREFIX}.${userId}`;
}

function activeSessionKey(courseId, moduleId) {
  return `${courseId}:${moduleId}`;
}

function weekKeyForDate(date) {
  const start = startOfWeek(date);
  const year = start.getFullYear();
  const month = String(start.getMonth() + 1).padStart(2, "0");
  const day = String(start.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + offset);
  return start;
}

function emptySummary() {
  return {
    weekKey: weekKeyForDate(new Date()),
    sessions: [],
    totalMs: 0,
    totalMinutes: 0,
    totalHours: 0,
  };
}

function canStore() {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    return false;
  }
}
