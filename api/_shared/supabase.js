import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./http.js";

export function adminClient() {
  return createClient(requireEnv("VITE_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function requireUser(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    const error = new Error("Authentication required");
    error.status = 401;
    throw error;
  }

  const supabase = adminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    const authError = new Error("Invalid or expired session");
    authError.status = 401;
    throw authError;
  }

  return { supabase, user: data.user, token };
}
