import { readJson } from "../_shared/http.js";
import { requireUser } from "../_shared/supabase.js";
import { generateCourse, makeCourseRows } from "../_shared/generation.js";
import { buildVideoRowsForModule } from "../_shared/youtube.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { supabase, user } = await requireUser(req);
    const payload = await readJson(req);
    const rawFileContexts = Array.isArray(payload.fileContexts) ? payload.fileContexts : [];
    const fileContexts = rawFileContexts.filter(hasReadableFileContext);

    if (!payload.topic && !fileContexts.length) {
      return res.status(400).json({ error: "Add a topic or upload at least one readable material file." });
    }

    const generated = await generateCourse({
      topic: payload.topic || "",
      fileContexts,
      level: payload.level || "Beginner",
      duration: payload.duration || "1 Month",
      goal: payload.goal || "Full Course",
    });

    const rows = makeCourseRows({ userId: user.id, course: generated.course, payload, fileContexts });
    let videoSummary = { totalVideos: 0, modulesWithVideos: 0, totalModules: rows.modules.length };

    try {
      await insertOrThrow(supabase, "courses", rows.courseRow);
      if (rows.sources.length) await insertOrThrow(supabase, "sources", rows.sources);
      await insertOrThrow(supabase, "modules", rows.modules);
      await insertOrThrow(supabase, "lessons", rows.lessons);
      await insertOrThrow(supabase, "quizzes", rows.quizzes);
      await insertOrThrow(supabase, "questions", rows.questions);
      await insertOrThrow(supabase, "study_plan", rows.studyPlan);

      const videoRowsByModule = await Promise.all(rows.modules.map(async (module) => {
        try {
          return await buildVideoRowsForModule({ userId: user.id, course: rows.courseRow, module });
        } catch {
          return [];
        }
      }));
      const videoRows = videoRowsByModule.flat();
      if (videoRows.length) await insertOrThrow(supabase, "videos", videoRows);
      videoSummary = {
        totalVideos: videoRows.length,
        modulesWithVideos: videoRowsByModule.filter((moduleVideos) => moduleVideos.length > 0).length,
        totalModules: rows.modules.length,
      };
    } catch (insertError) {
      await supabase.from("courses").delete().eq("id", rows.courseRow.id).eq("user_id", user.id);
      throw insertError;
    }

    return res.status(200).json({
      courseId: rows.courseRow.id,
      fallback: generated.fallback,
      message: courseGenerationMessage(generated, videoSummary),
      videos: videoSummary,
      sourceUploads: rows.sources.map((source) => ({
        sourceId: source.id,
        fileName: source.file_name,
        storagePath: source.storage_path,
      })),
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: friendlyGenerationError(error.message) });
  }
}

function hasReadableFileContext(file) {
  const chunkText = Array.isArray(file?.chunks)
    ? file.chunks.map((chunk) => chunk?.text || "").join("\n")
    : "";
  const pageText = Array.isArray(file?.pages)
    ? file.pages.map((page) => page?.text || "").join("\n")
    : "";
  const text = `${file?.text || ""}\n${chunkText}\n${pageText}`.replace(/\s+/g, "");
  return text.length >= 40;
}

async function insertOrThrow(supabase, table, rows) {
  const { error } = await supabase.from(table).insert(rows);
  if (error) {
    throw error;
  }
}

function friendlyOpenAIMessage(message = "") {
  return message === "Missing OPENAI_API_KEY"
    ? "Add OPENAI_API_KEY to your server environment for AI-generated course content."
    : `OpenAI issue: ${message}`;
}

function friendlyGenerationError(message = "") {
  if (message === "Missing OPENAI_API_KEY") {
    return "Add OPENAI_API_KEY to your server environment for AI-generated course content.";
  }

  if (message === "Missing YOUTUBE_API_KEY") {
    return "Add YOUTUBE_API_KEY to your server environment before generating courses with lecture videos.";
  }

  return message || "Course generation failed";
}

function courseGenerationMessage(generated, videoSummary) {
  const baseMessage = generated.fallback
    ? generated.error
      ? `Course created with fallback content. ${friendlyOpenAIMessage(generated.error)}`
      : "Course created with fallback content."
    : "Course generated with OpenAI.";

  if (!videoSummary.totalModules) {
    return baseMessage;
  }

  if (!videoSummary.totalVideos) {
    return `${baseMessage} Lessons, quizzes, and study plan are ready. Video suggestions are available inside each lecture.`;
  }

  const lectureText = `${videoSummary.modulesWithVideos}/${videoSummary.totalModules} lecture${videoSummary.totalModules === 1 ? "" : "s"}`;
  const videoText = `${videoSummary.totalVideos} YouTube video${videoSummary.totalVideos === 1 ? "" : "s"}`;
  return `${baseMessage} Added ${videoText} across ${lectureText}; lectures without exact matches include search suggestions.`;
}
