import { readJson } from "../_shared/http.js";
import { requireUser } from "../_shared/supabase.js";
import { buildVideoProfile, makeVideoRows, searchYouTube } from "../_shared/youtube.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { supabase, user } = await requireUser(req);
    const { courseId, moduleId } = await readJson(req);

    const [courseResult, moduleResult] = await Promise.all([
      supabase.from("courses").select("*").eq("id", courseId).eq("user_id", user.id).single(),
      supabase.from("modules").select("*").eq("id", moduleId).eq("user_id", user.id).single(),
    ]);

    if (courseResult.error || !courseResult.data) return res.status(404).json({ error: "Course not found" });
    if (moduleResult.error || !moduleResult.data) return res.status(404).json({ error: "Lecture not found" });

    const profile = buildVideoProfile({ course: courseResult.data, module: moduleResult.data });
    const cached = await supabase
      .from("videos")
      .select("*")
      .eq("user_id", user.id)
      .eq("module_id", moduleId)
      .eq("query_signature", profile.signature)
      .order("match_score", { ascending: false });

    if (cached.data?.length) {
      return res.status(200).json({ videos: cached.data, cached: true });
    }

    const videos = await searchYouTube(profile);
    const rows = makeVideoRows({ userId: user.id, courseId, moduleId, videos });

    await supabase.from("videos").delete().eq("user_id", user.id).eq("module_id", moduleId).eq("query_signature", profile.signature);
    const { data, error } = rows.length
      ? await supabase.from("videos").insert(rows).select("*").order("match_score", { ascending: false })
      : { data: [], error: null };
    if (error) throw error;

    return res.status(200).json({ videos: data || [], cached: false });
  } catch (error) {
    const message = error.message === "Missing YOUTUBE_API_KEY"
      ? "Add YOUTUBE_API_KEY to your server environment, then retry this lecture."
      : error.message || "YouTube search failed";
    return res.status(error.status || 500).json({ error: message });
  }
}
