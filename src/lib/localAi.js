import JSZip from "jszip";
import mammoth from "mammoth";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 45000;
const YOUTUBE_TIMEOUT_MS = 15000;

export async function generateLocalCourse({ topic, files = [], level, duration, goal }) {
  const fileContexts = await Promise.all(files.map(extractLocalFileContext));
  const materialText = fileContexts.map((file) => `File: ${file.name}\n${file.text}`).join("\n\n").trim();

  if (hasGeminiKey()) {
    try {
      const generated = await generateGeminiCourse({ topic, materialText, level, duration, goal });
      return { course: normalizeCourse(generated), fallback: false, fileContexts };
    } catch (error) {
      return { course: fallbackCourse({ topic, materialText, level, duration, goal }), fallback: true, fileContexts, error: error.message };
    }
  }

  return { course: fallbackCourse({ topic, materialText, level, duration, goal }), fallback: true, fileContexts };
}

export async function answerLocalQuestion({ message, course, module, lesson, history = [] }) {
  const context = [
    course ? `Course: ${course.title}\n${course.description || ""}` : "",
    module ? `Lesson: ${module.title}\n${module.explanation || ""}` : "",
    lesson?.content || "",
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!hasGeminiKey()) {
    return `Local AI key is not configured yet. Based on the current lesson context: ${context.slice(0, 500) || "create a course first, then ask again."}`;
  }

  const prompt = `
You are CorAI, a concise study assistant.
Use the course context and answer like a helpful tutor.

Recent chat:
${history.map((item) => `${item.role}: ${item.content}`).join("\n")}

Course context:
${context.slice(0, 12000)}

Student question:
${message}
`;

  return generateGeminiText(prompt);
}

export async function searchYouTubeVideos(queryInput) {
  ensureYouTubeConfigured();
  const query = normalizeVideoQuery(queryInput);
  const searches = [
    await fetchYouTubeSearchResults(query, "medium"),
    await fetchYouTubeSearchResults(query, "long"),
  ];
  const videoIds = [...new Set(searches.flat().map((item) => item.id?.videoId).filter(Boolean))];
  const details = await fetchYouTubeVideoDetails(videoIds);

  return details
    .filter((video) => isLessonVideo(video, query))
    .slice(0, 3)
    .map((video) => ({
      title: video.title,
      url: `https://www.youtube.com/watch?v=${video.id}`,
      thumbnail_url: video.thumbnail_url,
      channel_title: video.channel_title,
      source: "youtube",
    }));
}

async function fetchYouTubeSearchResults(query, videoDuration) {
  const params = new URLSearchParams({
    key: import.meta.env.VITE_YOUTUBE_API_KEY,
    part: "snippet",
    q: `${query.searchText} tutorial lesson explained -shorts -#shorts`,
    maxResults: "8",
    order: "relevance",
    type: "video",
    safeSearch: "strict",
    videoEmbeddable: "true",
    videoDuration,
  });

  const response = await fetchWithTimeout(
    `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
    {},
    YOUTUBE_TIMEOUT_MS,
    "YouTube search",
  );
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error?.message || "YouTube search failed");
  }

  return payload.items || [];
}

async function fetchYouTubeVideoDetails(videoIds) {
  if (!videoIds.length) {
    return [];
  }

  const params = new URLSearchParams({
    key: import.meta.env.VITE_YOUTUBE_API_KEY,
    part: "snippet,contentDetails",
    id: videoIds.join(","),
  });

  const response = await fetchWithTimeout(
    `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`,
    {},
    YOUTUBE_TIMEOUT_MS,
    "YouTube video details",
  );
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error?.message || "YouTube video details failed");
  }

  return (payload.items || []).map((item) => ({
    id: item.id,
    title: item.snippet?.title || "Recommended video",
    description: item.snippet?.description || "",
    durationSeconds: parseYouTubeDuration(item.contentDetails?.duration),
    thumbnail_url: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || "",
    channel_title: item.snippet?.channelTitle || "YouTube",
  }));
}

async function generateGeminiCourse({ topic, materialText, level, duration, goal }) {
  const source = materialText
    ? `Use these local study materials as the main source:\n${materialText.slice(0, 24000)}`
    : `Build the course from this topic: ${topic}`;

  const prompt = `
You are CorAI, an AI course builder. Create a practical course.

Preferences:
- Level: ${level}
- Study duration: ${duration}
- Goal: ${goal}
- Topic: ${topic || "derived from uploaded materials"}

${source}

Return only valid JSON:
{
  "title": "Course title",
  "description": "One sentence description",
  "estimatedTime": "4 weeks",
  "learningOutcomes": ["outcome"],
  "modules": [
    {
      "title": "Lesson title",
      "summary": "Short summary",
      "explanation": "Clear teaching explanation in 1-3 paragraphs",
      "keyConcepts": ["concept"],
      "examples": ["example"],
      "practiceTasks": ["task"],
      "estimatedMinutes": 35,
      "quiz": {
        "title": "Quiz title",
        "questions": [
          {
            "prompt": "Question",
            "options": ["A", "B", "C", "D"],
            "correctOptionIndex": 0,
            "explanation": "Why the answer is correct",
            "topic": "Weak-topic label"
          }
        ]
      }
    }
  ]
}

Rules:
- Create 4 to 6 lessons.
- Create exactly 5 quiz questions per lesson.
- Every question has exactly 4 options and a zero-based correctOptionIndex.
`;

  const text = await generateGeminiText(prompt, true);
  return JSON.parse(cleanJson(text));
}

async function generateGeminiText(prompt, json = false) {
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": import.meta.env.VITE_GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          responseMimeType: json ? "application/json" : "text/plain",
        },
      }),
    },
    GEMINI_TIMEOUT_MS,
    "Gemini request",
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error?.message || "Gemini request failed");
  }

  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return text;
}

async function extractLocalFileContext(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (["txt", "md", "csv"].includes(extension)) {
    return { name: file.name, text: await file.text() };
  }

  if (extension === "docx") {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { name: file.name, text: result.value || "" };
  }

  if (extension === "pptx") {
    return { name: file.name, text: await extractPptxText(await file.arrayBuffer()) };
  }

  return {
    name: file.name,
    text: `Local browser mode cannot extract ${extension?.toUpperCase() || "this"} file text yet. Use the filename and topic as context for now.`,
  };
}

async function extractPptxText(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const slideEntries = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const text = [];
  for (const entry of slideEntries) {
    const xml = await zip.files[entry].async("text");
    text.push(...[...xml.matchAll(/<a:t>(.*?)<\/a:t>/g)].map((match) => decodeXml(match[1])));
  }

  return text.join(" ");
}

function fallbackCourse({ topic, materialText, level, duration, goal }) {
  const title = topic?.trim() || inferTitle(materialText) || "Generated Learning Path";
  const concepts = pickConcepts(title, materialText);

  return normalizeCourse({
    title,
    description: `A focused ${level.toLowerCase()} course for ${goal.toLowerCase()}.`,
    estimatedTime: duration,
    learningOutcomes: [
      `Explain the core ideas behind ${title}.`,
      "Apply the main concepts through guided practice.",
      "Check understanding with short quizzes.",
      "Identify weak topics for review.",
    ],
    modules: concepts.slice(0, 5).map((concept, index) => ({
      title: concept,
      summary: `Learn the essentials of ${concept}.`,
      explanation: `${concept} is an important part of ${title}. Study the definition, common patterns, and practical examples before moving to the quiz.`,
      keyConcepts: [concept, "Definition", "Use cases", "Common mistakes"],
      examples: [`Example: describe how ${concept.toLowerCase()} appears in a practical question.`],
      practiceTasks: [`Write a short explanation of ${concept.toLowerCase()} and create one example question.`],
      estimatedMinutes: 30 + index * 5,
      quiz: {
        title: `${concept} Check`,
        questions: Array.from({ length: 5 }, () => ({
          prompt: `Which statement best describes ${concept}?`,
          options: [
            `${concept} is a core concept in this course.`,
            `${concept} is unrelated to the course.`,
            `${concept} only means memorizing terms.`,
            `${concept} cannot be practiced.`,
          ],
          correctOptionIndex: 0,
          explanation: `${concept} is part of the generated learning path and should be understood through examples.`,
          topic: concept,
        })),
      },
    })),
  });
}

function normalizeCourse(course) {
  return {
    title: text(course?.title, "Generated Course"),
    description: text(course?.description, "A personalized course generated by CorAI."),
    estimatedTime: text(course?.estimatedTime, "4 weeks"),
    learningOutcomes: stringArray(course?.learningOutcomes).slice(0, 8),
    modules: (Array.isArray(course?.modules) ? course.modules : []).slice(0, 8).map(normalizeModule),
  };
}

function normalizeModule(module, index) {
  const title = text(module?.title, `Lesson ${index + 1}`);
  const questions = (Array.isArray(module?.quiz?.questions) ? module.quiz.questions : []).slice(0, 5).map((question) => normalizeQuestion(question, title));

  while (questions.length < 5) {
    questions.push(normalizeQuestion({}, title));
  }

  return {
    title,
    summary: text(module?.summary, `Learn ${title}.`),
    explanation: text(module?.explanation, `This lesson explains ${title} with concise examples and practice.`),
    keyConcepts: stringArray(module?.keyConcepts).slice(0, 8),
    examples: stringArray(module?.examples).slice(0, 5),
    practiceTasks: stringArray(module?.practiceTasks).slice(0, 5),
    estimatedMinutes: number(module?.estimatedMinutes, 35, 15, 120),
    quiz: {
      title: text(module?.quiz?.title, `${title} Quiz`),
      questions,
    },
  };
}

function normalizeQuestion(question, topic) {
  const options = stringArray(question?.options).slice(0, 4);
  while (options.length < 4) {
    options.push(`Option ${options.length + 1}`);
  }

  return {
    prompt: text(question?.prompt, `Question about ${topic}`),
    options,
    correctOptionIndex: number(question?.correctOptionIndex, 0, 0, 3),
    explanation: text(question?.explanation, "Review the related lesson section for the explanation."),
    topic: text(question?.topic, topic),
  };
}

function hasGeminiKey() {
  return Boolean(import.meta.env.VITE_GEMINI_API_KEY);
}

export function ensureYouTubeConfigured() {
  if (!hasYouTubeKey()) {
    throw new Error("Course was not saved because YouTube videos are required. Add VITE_YOUTUBE_API_KEY or YOUTUBE_API_KEY to .env.local, then restart npm run dev.");
  }
}

function hasYouTubeKey() {
  return Boolean(import.meta.env.VITE_YOUTUBE_API_KEY);
}

function normalizeVideoQuery(input) {
  if (typeof input === "string") {
    return {
      courseTitle: "",
      lessonTitle: input,
      searchText: input,
      courseKeywords: [],
      lessonKeywords: keywordsFrom(input),
    };
  }

  const courseTitle = text(input?.courseTitle, "");
  const lessonTitle = text(input?.lessonTitle, "");
  const searchText = [courseTitle, lessonTitle].filter(Boolean).join(" ");

  return {
    courseTitle,
    lessonTitle,
    searchText,
    courseKeywords: keywordsFrom(courseTitle),
    lessonKeywords: keywordsFrom(lessonTitle),
  };
}

function isLessonVideo(video, query) {
  const searchableText = normalizeWords(`${video.title} ${video.description}`);
  if (/(^|\s|#)shorts?($|\s|#)/.test(searchableText) || video.durationSeconds < 240) {
    return false;
  }

  const lessonMatches = countKeywordMatches(searchableText, query.lessonKeywords);
  const courseMatches = countKeywordMatches(searchableText, query.courseKeywords);

  if (!query.lessonKeywords.length) {
    return courseMatches >= Math.min(2, query.courseKeywords.length || 1);
  }

  return lessonMatches >= Math.min(1, query.lessonKeywords.length) && (courseMatches >= 1 || lessonMatches >= 2 || !query.courseKeywords.length);
}

function parseYouTubeDuration(value = "") {
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) {
    return 0;
  }

  const [, hours = 0, minutes = 0, seconds = 0] = match.map((part) => Number(part || 0));
  return hours * 3600 + minutes * 60 + seconds;
}

function keywordsFrom(value = "") {
  const keywords = normalizeWords(value).split(/\s+/).filter((word) => word.length >= 3 && !VIDEO_STOP_WORDS.has(word));
  return [
    ...new Set(
      keywords.flatMap((word) => {
        const variants = [word];
        if (word.endsWith("s") && word.length > 4) {
          variants.push(word.slice(0, -1));
        }
        return variants;
      }),
    ),
  ];
}

function countKeywordMatches(textValue, keywords) {
  return keywords.filter((keyword) => textValue.includes(keyword)).length;
}

function normalizeWords(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9#+]+/g, " ").trim();
}

const VIDEO_STOP_WORDS = new Set([
  "and",
  "for",
  "the",
  "with",
  "from",
  "into",
  "module",
  "lesson",
  "course",
  "tutorial",
  "explained",
  "introduction",
  "intro",
  "overview",
  "basic",
  "basics",
  "foundation",
  "foundations",
  "core",
  "concept",
  "concepts",
  "practice",
  "review",
  "example",
  "examples",
  "worked",
]);

async function fetchWithTimeout(url, options = {}, timeoutMs, label) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)} seconds. Check your API key or network, then try again.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function cleanJson(text) {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
}

function text(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function number(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function inferTitle(textValue = "") {
  return textValue.split(/\s+/).filter((word) => /^[A-Za-z][A-Za-z-]{3,}$/.test(word)).slice(0, 4).join(" ");
}

function pickConcepts(title, materialText = "") {
  const candidates = [...title.split(/\s+/), ...materialText.split(/\s+/)]
    .map((word) => word.replace(/[^A-Za-z0-9 -]/g, "").trim())
    .filter((word) => word.length > 4);

  const unique = [...new Set(candidates)].slice(0, 5);
  return unique.length >= 4 ? unique : ["Foundations", "Core Concepts", "Worked Examples", "Practice", "Review"];
}

function decodeXml(value) {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
