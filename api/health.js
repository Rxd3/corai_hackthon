import { sendJson } from "./_lib/http.js";

export default function handler(_req, res) {
  sendJson(res, 200, {
    ok: true,
    service: "corai-api",
    timestamp: new Date().toISOString(),
    env: {
      supabaseUrl: Boolean(process.env.VITE_SUPABASE_URL),
      supabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      gemini: Boolean(process.env.GEMINI_API_KEY),
      youtube: Boolean(process.env.YOUTUBE_API_KEY),
    },
  });
}
