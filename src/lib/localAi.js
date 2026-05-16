import JSZip from "jszip";
import mammoth from "mammoth";

const GEMINI_MODEL = "gemini-2.5-flash";

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
    module ? `Module: ${module.title}\n${module.explanation || ""}` : "",
    lesson?.content || "",
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!hasGeminiKey()) {
    return `Local AI key is not configured yet. Based on the current module context: ${context.slice(0, 500) || "create a course first, then ask again."}`;
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

export async function searchYouTubeVideos(query) {
  if (!hasYouTubeKey()) {
    throw new Error("Add YOUTUBE_API_KEY or VITE_YOUTUBE_API_KEY to .env.local, then restart npm run dev.");
  }

  const params = new URLSearchParams({
    key: import.meta.env.VITE_YOUTUBE_API_KEY,
    part: "snippet",
    q: `${query} tutorial lesson`,
    maxResults: "3",
    type: "video",
    safeSearch: "strict",
    videoEmbeddable: "true",
  });

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error?.message || "YouTube search failed");
  }

  return (payload.items || [])
    .filter((item) => item.id?.videoId)
    .map((item) => ({
      title: item.snippet?.title || "Recommended video",
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      thumbnail_url: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || "",
      channel_title: item.snippet?.channelTitle || "YouTube",
      source: "youtube",
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
      "title": "Module title",
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
- Create 4 to 6 modules.
- Create exactly 5 quiz questions per module.
- Every question has exactly 4 options and a zero-based correctOptionIndex.
`;

  const text = await generateGeminiText(prompt, true);
  return JSON.parse(cleanJson(text));
}

async function generateGeminiText(prompt, json = false) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
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
  });

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
  const title = text(module?.title, `Module ${index + 1}`);
  const questions = (Array.isArray(module?.quiz?.questions) ? module.quiz.questions : []).slice(0, 5).map((question) => normalizeQuestion(question, title));

  while (questions.length < 5) {
    questions.push(normalizeQuestion({}, title));
  }

  return {
    title,
    summary: text(module?.summary, `Learn ${title}.`),
    explanation: text(module?.explanation, `This module explains ${title} with concise examples and practice.`),
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

function hasYouTubeKey() {
  return Boolean(import.meta.env.VITE_YOUTUBE_API_KEY);
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
