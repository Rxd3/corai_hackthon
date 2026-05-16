import { supabase } from "./supabaseClient";

export async function apiFetch(path, options = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("You need to sign in again.");
  }

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 404 && path.startsWith("/api/")) {
      const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
      throw new Error(
        isLocal
          ? "API route not found. Stop Vite-only dev mode and run `npm run dev:full` so Vercel serves /api functions."
          : "API route not found on Vercel. Redeploy after pushing the `api/` folder, confirm the Vercel Root Directory is the repo root, then open `/api/health` on your deployed URL.",
      );
    }

    throw new Error(payload.error || "Request failed");
  }

  return payload;
}

export function buildCourseFormData({ topic, files, level, duration, goal }) {
  const formData = new FormData();
  formData.set("topic", topic || "");
  formData.set("level", level);
  formData.set("duration", duration);
  formData.set("goal", goal);

  for (const file of files || []) {
    formData.append("materials", file);
  }

  return formData;
}
