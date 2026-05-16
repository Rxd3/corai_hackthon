import { readJson } from "../_shared/http.js";
import { requireUser } from "../_shared/supabase.js";
import { answerLectureQuestion } from "../_shared/generation.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { supabase, user } = await requireUser(req);
    const { courseId, moduleId, message } = await readJson(req);

    if (!message?.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    const [courseResult, moduleResult, lessonResult, historyResult] = await Promise.all([
      supabase.from("courses").select("*").eq("id", courseId).eq("user_id", user.id).single(),
      moduleId ? supabase.from("modules").select("*").eq("id", moduleId).eq("user_id", user.id).single() : Promise.resolve({ data: null, error: null }),
      moduleId ? supabase.from("lessons").select("*").eq("module_id", moduleId).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      supabase
        .from("messages")
        .select("*")
        .eq("user_id", user.id)
        .eq("course_id", courseId)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    if (courseResult.error || !courseResult.data) {
      return res.status(404).json({ error: "Course not found" });
    }
    if (moduleId && (moduleResult.error || !moduleResult.data)) {
      return res.status(404).json({ error: "Lecture not found" });
    }

    const history = (historyResult.data || []).reverse();
    const answer = await answerLectureQuestion({
      message,
      course: courseResult.data,
      module: moduleResult.data,
      lesson: lessonResult.data,
      history,
    });

    const now = new Date().toISOString();
    const rows = [
      { user_id: user.id, course_id: courseId, module_id: moduleId || null, role: "user", content: message, created_at: now },
      { user_id: user.id, course_id: courseId, module_id: moduleId || null, role: "assistant", content: answer, created_at: now },
    ];
    const { data: inserted, error } = await supabase.from("messages").insert(rows).select("*");
    if (error) throw error;

    return res.status(200).json({ answer, messages: inserted || [] });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "AI chat failed" });
  }
}
