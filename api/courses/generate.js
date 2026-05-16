import { readJson } from "../_shared/http.js";
import { requireUser } from "../_shared/supabase.js";
import { generateCourse, makeCourseRows } from "../_shared/generation.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { supabase, user } = await requireUser(req);
    const payload = await readJson(req);
    const fileContexts = Array.isArray(payload.fileContexts) ? payload.fileContexts : [];

    if (!payload.topic && !fileContexts.length) {
      return res.status(400).json({ error: "Add a topic or upload at least one material file." });
    }

    const generated = await generateCourse({
      topic: payload.topic || "",
      fileContexts,
      level: payload.level || "Beginner",
      duration: payload.duration || "1 Month",
      goal: payload.goal || "Full Course",
    });

    const rows = makeCourseRows({ userId: user.id, course: generated.course, payload, fileContexts });

    try {
      await insertOrThrow(supabase, "courses", rows.courseRow);
      if (rows.sources.length) await insertOrThrow(supabase, "sources", rows.sources);
      await insertOrThrow(supabase, "modules", rows.modules);
      await insertOrThrow(supabase, "lessons", rows.lessons);
      await insertOrThrow(supabase, "quizzes", rows.quizzes);
      await insertOrThrow(supabase, "questions", rows.questions);
      await insertOrThrow(supabase, "study_plan", rows.studyPlan);
    } catch (insertError) {
      await supabase.from("courses").delete().eq("id", rows.courseRow.id).eq("user_id", user.id);
      throw insertError;
    }

    return res.status(200).json({
      courseId: rows.courseRow.id,
      fallback: generated.fallback,
      message: generated.fallback
        ? generated.error
          ? `Course created with fallback content. ${friendlyGeminiMessage(generated.error)}`
          : "Course created with fallback content."
        : "Course generated with Gemini.",
      sourceUploads: rows.sources.map((source) => ({
        sourceId: source.id,
        fileName: source.file_name,
        storagePath: source.storage_path,
      })),
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Course generation failed" });
  }
}

async function insertOrThrow(supabase, table, rows) {
  const { error } = await supabase.from(table).insert(rows);
  if (error) {
    throw error;
  }
}

function friendlyGeminiMessage(message = "") {
  return message === "Missing GEMINI_API_KEY"
    ? "Add GEMINI_API_KEY to your server environment for AI-generated course content."
    : `Gemini issue: ${message}`;
}
