import JSZip from "jszip";
import mammoth from "mammoth";

const GEMINI_MODEL = "gemini-2.5-flash";
const VIDEO_SEARCH_VERSION = "module-video-v3";
const MIN_LESSON_VIDEO_SECONDS = 240;
const MAX_LESSON_VIDEO_SECONDS = 1500;
const BROAD_VIDEO_PATTERNS = [
  /\bfull course\b/i,
  /\bcomplete course\b/i,
  /\bcrash course\b/i,
  /\bmasterclass\b/i,
  /\bbootcamp\b/i,
  /\bzero to hero\b/i,
  /\ball[- ]?in[- ]?one\b/i,
  /\bplaylist\b/i,
  /\broadmap\b/i,
];
const SHORT_VIDEO_PATTERNS = [/\bshorts?\b/i, /#shorts?\b/i, /\byoutube shorts?\b/i];
const EDUCATIONAL_PATTERNS = [/\btutorial\b/i, /\blesson\b/i, /\bexplained\b/i, /\bintroduction\b/i, /\bbeginner/i, /\bguide\b/i];
const INTRO_PATTERNS = [/\bintro\b/i, /\bintroduction\b/i, /\bbeginner/i, /\bbasics\b/i, /\bfoundations?\b/i, /\bgetting started\b/i];
const GENERIC_MODULE_TITLES = new Set(["foundations", "core concepts", "worked examples", "practice", "review", "introduction", "overview", "basics"]);
const VIDEO_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "course",
  "for",
  "from",
  "how",
  "in",
  "into",
  "is",
  "learn",
  "lesson",
  "module",
  "of",
  "on",
  "or",
  "part",
  "the",
  "to",
  "tutorial",
  "with",
]);

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

export function buildModuleVideoSearchProfile({ course, module }) {
  const rawCourseTitle = cleanSearchText(course?.title || course?.source_label || "course");
  const courseTitle = cleanCourseTitle(rawCourseTitle) || rawCourseTitle;
  const moduleTitle = cleanSearchText(module?.title || "module");
  const modulePosition = number(module?.position || module?.number, 1, 1, 99);
  const keyConcepts = stringArray(module?.key_concepts || module?.keyConcepts).slice(0, 5);
  const videoKeywords = uniqueStrings([...stringArray(module?.video_keywords || module?.videoKeywords), ...keyConcepts, ...tokenizeSearchText(moduleTitle)]).slice(0, 8);
  const storedQuery = cleanVideoSearchQuery(module?.video_search_query || module?.videoSearchQuery || "");
  const query = storedQuery || buildModuleVideoSearchQuery({ courseTitle, moduleTitle, modulePosition, keyConcepts });
  const signature = createVideoSearchSignature({ query, videoKeywords, moduleTitle, modulePosition });

  return {
    query,
    keywords: videoKeywords,
    signature,
    modulePosition,
    moduleTitle,
    courseTitle,
  };
}

export function improveStoredModuleForCourse({ course, module }) {
  const modulePosition = number(module?.position || module?.number, 1, 1, 99);
  const keyConcepts = stringArray(module?.key_concepts || module?.keyConcepts).slice(0, 8);
  const title = repairModuleTitle({
    title: text(module?.title, `Module ${modulePosition}`),
    courseTitle: course?.title || course?.source_label || "Generated Course",
    keyConcepts,
    index: modulePosition - 1,
  });
  const courseTitle = cleanCourseTitle(course?.title || course?.source_label || "") || cleanSearchText(course?.title || course?.source_label || "course");
  const videoKeywords = uniqueStrings([...stringArray(module?.video_keywords || module?.videoKeywords), ...keyConcepts, ...tokenizeSearchText(title)]).slice(0, 8);

  return {
    ...module,
    title,
    video_search_query: buildModuleVideoSearchQuery({ courseTitle, moduleTitle: title, modulePosition, keyConcepts }),
    video_keywords: videoKeywords,
  };
}

export async function searchYouTubeVideos(input) {
  if (!hasYouTubeKey()) {
    throw new Error("Add YOUTUBE_API_KEY or VITE_YOUTUBE_API_KEY to .env.local, then restart npm run dev.");
  }

  const profile = typeof input === "string" ? buildVideoSearchProfileFromQuery(input) : buildModuleVideoSearchProfile(input);
  const params = new URLSearchParams({
    key: import.meta.env.VITE_YOUTUBE_API_KEY,
    part: "snippet",
    q: buildYouTubeQuery(profile.query),
    maxResults: "12",
    order: "relevance",
    relevanceLanguage: "en",
    regionCode: "US",
    type: "video",
    safeSearch: "strict",
    videoEmbeddable: "true",
    videoDuration: "medium",
  });

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error?.message || "YouTube search failed");
  }

  const candidates = (payload.items || [])
    .filter((item) => item.id?.videoId)
    .map((item) => ({
      video_id: item.id.videoId,
      title: item.snippet?.title || "Recommended video",
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      thumbnail_url: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || "",
      channel_title: item.snippet?.channelTitle || "YouTube",
      description: item.snippet?.description || "",
      source: "youtube",
    }));

  const durations = await loadYouTubeDurations(candidates.map((video) => video.video_id));

  const ranked = uniqueVideos(candidates)
    .map((video) => {
      const durationSeconds = durations.get(video.video_id) || 0;
      return {
        ...video,
        duration_seconds: durationSeconds,
        search_query: profile.query,
        query_signature: profile.signature,
        match_score: scoreVideoMatch(video, profile, durationSeconds),
      };
    })
    .filter((video) => isAcceptableLessonVideo(video))
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 3);

  return ranked.map(({ description, ...video }) => video);
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
      "videoSearchQuery": "Specific YouTube search phrase for this exact module only",
      "videoKeywords": ["module keyword"],
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
- Module titles must be concrete lesson sections in the real course order, such as "Python Setup and First Program" or "Variables, Data Types, and Operators".
- Do not use generic module titles like Introduction, Foundations, Core Concepts, Practice, Review, Overview, or Basics by themselves.
- Make modules distinct and sequential; each module should teach one clear part of the course and should not repeat the course title alone.
- videoSearchQuery must target only that module, not the full course. For the first module, prefer a beginner search phrase for the exact first section.
- Do not use full course, complete course, crash course, masterclass, playlist, or all-in-one in videoSearchQuery.
- videoSearchQuery must not ask for Shorts.
- Create exactly 5 quiz questions per module.
- Quiz questions must test only that module's title and keyConcepts.
- Every module quiz must have varied prompts; do not repeat the same wording across questions.
- Wrong answers must be plausible misconceptions, not obvious placeholders.
- Do not use generic answers like "Option 1", "unrelated to the course", "cannot be practiced", or "only means memorizing terms".
- Each question topic must be a concrete weak-topic label from that module, not the whole course.
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
  const subject = inferCourseSubject(title, materialText);
  const modules = buildFallbackModules(title, materialText);

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
    modules: modules.map((module, index) => ({
      title: module.title,
      summary: module.summary,
      explanation: `${module.title} is a focused part of ${title}. Study ${module.keyConcepts.slice(0, 3).join(", ")} through clear examples before moving to the quiz.`,
      keyConcepts: module.keyConcepts,
      examples: module.examples,
      practiceTasks: module.practiceTasks,
      estimatedMinutes: 30 + index * 5,
      videoSearchQuery: buildModuleVideoSearchQuery({
        courseTitle: subject,
        moduleTitle: module.title,
        modulePosition: index + 1,
        keyConcepts: module.keyConcepts,
      }),
      videoKeywords: module.keyConcepts,
      quiz: {
        title: `${module.title} Check`,
        questions: buildModuleQuizQuestions({ courseTitle: title, moduleTitle: module.title, keyConcepts: module.keyConcepts }),
      },
    })),
  });
}

function normalizeCourse(course) {
  const title = text(course?.title, "Generated Course");
  return {
    title,
    description: text(course?.description, "A personalized course generated by CorAI."),
    estimatedTime: text(course?.estimatedTime, "4 weeks"),
    learningOutcomes: stringArray(course?.learningOutcomes).slice(0, 8),
    modules: (Array.isArray(course?.modules) ? course.modules : []).slice(0, 8).map((module, index) => normalizeModule(module, index, title)),
  };
}

function normalizeModule(module, index, courseTitle = "Generated Course") {
  const originalTitle = text(module?.title, `Module ${index + 1}`);
  const keyConcepts = stringArray(module?.keyConcepts).slice(0, 8);
  const title = repairModuleTitle({ title: originalTitle, courseTitle, keyConcepts, index });
  const questions = normalizeModuleQuestions({
    courseTitle,
    moduleTitle: title,
    keyConcepts,
    questions: Array.isArray(module?.quiz?.questions) ? module.quiz.questions : [],
  });
  const videoKeywords = uniqueStrings([...stringArray(module?.videoKeywords || module?.video_keywords), ...keyConcepts, ...tokenizeSearchText(title)]).slice(0, 8);

  return {
    title,
    summary: text(module?.summary, `Learn ${title}.`),
    explanation: text(module?.explanation, `This module explains ${title} with concise examples and practice.`),
    keyConcepts,
    examples: stringArray(module?.examples).slice(0, 5),
    practiceTasks: stringArray(module?.practiceTasks).slice(0, 5),
    estimatedMinutes: number(module?.estimatedMinutes, 35, 15, 120),
    videoSearchQuery: text(
      module?.videoSearchQuery || module?.video_search_query,
      buildModuleVideoSearchQuery({ courseTitle, moduleTitle: title, modulePosition: index + 1, keyConcepts })
    ),
    videoKeywords,
    quiz: {
      title: text(module?.quiz?.title, `${title} Quiz`),
      questions,
    },
  };
}

export function buildModuleQuizQuestions({ courseTitle = "Course", moduleTitle, keyConcepts = [] }) {
  const title = cleanSearchText(moduleTitle || "this module");
  const concepts = uniqueStrings([...keyConcepts, ...tokenizeSearchText(title)]).slice(0, 5);
  while (concepts.length < 5) {
    concepts.push(`${title} concept ${concepts.length + 1}`);
  }

  const subject = inferCourseSubject(courseTitle);
  const [primary, second, third, fourth, fifth] = concepts;
  const optionSets = [
    {
      prompt: `What is the main purpose of ${primary} in ${title}?`,
      options: [
        `It helps you complete the core task taught in ${title}.`,
        `It is only used to decorate code without changing behavior.`,
        `It should be skipped until after every advanced topic is finished.`,
        `It replaces the need to understand the rest of ${subject}.`,
      ],
      explanation: `${primary} is one of the core ideas for completing the work in ${title}.`,
      topic: primary,
    },
    {
      prompt: `Which example best shows ${second} being used correctly?`,
      options: [
        `Using ${second} to solve a small, focused problem from the module.`,
        `Choosing ${second} randomly before knowing the problem.`,
        `Avoiding ${second} because practice makes mistakes visible.`,
        `Using ${second} only as a word to memorize for the quiz.`,
      ],
      explanation: `A correct use of ${second} connects the concept to a concrete problem or example.`,
      topic: second,
    },
    {
      prompt: `What mistake should you watch for when working with ${third}?`,
      options: [
        `Applying the idea without checking how it fits the current step.`,
        `Writing a small test example before moving forward.`,
        `Reading the module explanation before attempting practice.`,
        `Comparing your answer with the expected behavior.`,
      ],
      explanation: `${third} is easier to use correctly when you connect it to the current step and verify the result.`,
      topic: third,
    },
    {
      prompt: `After studying ${title}, what should you be able to explain about ${fourth}?`,
      options: [
        `When to use it, what it does, and one simple example.`,
        `Only the spelling of the term.`,
        `Why it has no relationship to the module practice.`,
        `Why examples should be avoided until the final project.`,
      ],
      explanation: `A useful understanding of ${fourth} includes purpose, timing, and a short example.`,
      topic: fourth,
    },
    {
      prompt: `Which practice step would best reinforce ${fifth}?`,
      options: [
        `Build a small example, predict the result, then check and explain it.`,
        `Copy a final answer without running or reviewing it.`,
        `Move to a new module without trying an example.`,
        `Memorize the course title instead of practicing the module skill.`,
      ],
      explanation: `${fifth} becomes stronger through prediction, practice, checking, and explanation.`,
      topic: fifth,
    },
  ];

  return optionSets.map((question) => ({
    prompt: question.prompt,
    options: question.options,
    correctOptionIndex: 0,
    explanation: question.explanation,
    topic: question.topic,
  }));
}

export function improveStoredQuestionsForModule({ course, module, questions = [] }) {
  const keyConcepts = stringArray(module?.key_concepts || module?.keyConcepts);
  const moduleTitle = cleanSearchText(module?.title || "Module");
  const normalized = [...questions]
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .slice(0, 5)
    .map((question) => normalizeQuestion(question, moduleTitle));

  if (!isWeakQuestionSet(normalized, moduleTitle)) {
    return questions;
  }

  const replacements = buildModuleQuizQuestions({
    courseTitle: course?.title || course?.source_label || "Course",
    moduleTitle,
    keyConcepts,
  });

  return questions.map((question, index) => {
    const replacement = replacements[index % replacements.length];
    return {
      ...question,
      prompt: replacement.prompt,
      options: replacement.options,
      correct_option_index: replacement.correctOptionIndex,
      explanation: replacement.explanation,
      topic: replacement.topic,
    };
  });
}

function normalizeModuleQuestions({ courseTitle, moduleTitle, keyConcepts = [], questions = [] }) {
  const normalized = questions.slice(0, 5).map((question) => normalizeQuestion(question, moduleTitle));

  if (isWeakQuestionSet(normalized, moduleTitle)) {
    return buildModuleQuizQuestions({ courseTitle, moduleTitle, keyConcepts });
  }

  const generated = buildModuleQuizQuestions({ courseTitle, moduleTitle, keyConcepts });
  while (normalized.length < 5) {
    normalized.push(generated[normalized.length]);
  }

  return normalized.slice(0, 5);
}

function normalizeQuestion(question, topic) {
  const options = stringArray(question?.options).slice(0, 4);
  while (options.length < 4) {
    options.push(`Option ${options.length + 1}`);
  }

  return {
    prompt: text(question?.prompt, `Question about ${topic}`),
    options,
    correctOptionIndex: number(question?.correctOptionIndex ?? question?.correct_option_index, 0, 0, 3),
    explanation: text(question?.explanation, "Review the related lesson section for the explanation."),
    topic: text(question?.topic, topic),
  };
}

function isWeakQuestionSet(questions, moduleTitle = "") {
  if (questions.length < 5) {
    return true;
  }

  const prompts = questions.map((question) => cleanSearchText(question.prompt).toLowerCase());
  const uniquePrompts = new Set(prompts);
  const genericPromptCount = prompts.filter((prompt) => (
    prompt.startsWith("question about ") ||
    prompt.startsWith("which statement best matches ") ||
    prompt.startsWith("which statement best describes ")
  )).length;
  const moduleOnlyPromptCount = prompts.filter((prompt) => prompt === `question about ${moduleTitle.toLowerCase()}`).length;
  const placeholderOptionCount = questions.flatMap((question) => question.options || []).filter((option) => (
    /^option\s+\d+$/i.test(option) ||
    /unrelated to the course/i.test(option) ||
    /cannot be practiced/i.test(option) ||
    /only means memorizing terms/i.test(option)
  )).length;

  return uniquePrompts.size < questions.length || genericPromptCount >= 3 || moduleOnlyPromptCount > 0 || placeholderOptionCount > 0;
}

function hasGeminiKey() {
  return Boolean(import.meta.env?.VITE_GEMINI_API_KEY);
}

function hasYouTubeKey() {
  return Boolean(import.meta.env?.VITE_YOUTUBE_API_KEY);
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

function buildFallbackModules(title, materialText = "") {
  const subject = inferCourseSubject(title, materialText);
  const normalizedSubject = subject.toLowerCase();

  if (/\bpython\b/.test(normalizedSubject)) {
    return [
      moduleBlueprint("Python Setup and First Program", ["Python interpreter", "code editor", "print", "running scripts"]),
      moduleBlueprint("Variables, Data Types, and Operators", ["variables", "strings", "numbers", "booleans", "operators"]),
      moduleBlueprint("Control Flow with Conditions and Loops", ["if statements", "for loops", "while loops", "comparison operators"]),
      moduleBlueprint("Functions and Reusable Code", ["functions", "parameters", "return values", "scope"]),
      moduleBlueprint("Files, Errors, and Mini Projects", ["file handling", "exceptions", "debugging", "mini project"]),
      moduleBlueprint("Practice Project and Next Steps", ["project planning", "review", "testing", "next steps"]),
    ];
  }

  if (/\bjavascript|js\b/.test(normalizedSubject)) {
    return [
      moduleBlueprint("JavaScript Syntax and Browser Console", ["syntax", "console", "variables", "expressions"]),
      moduleBlueprint("Values, Functions, and Scope", ["data types", "functions", "scope", "callbacks"]),
      moduleBlueprint("Arrays, Objects, and Data Access", ["arrays", "objects", "methods", "iteration"]),
      moduleBlueprint("DOM Events and Page Interactions", ["DOM", "events", "selectors", "event listeners"]),
      moduleBlueprint("Async JavaScript and APIs", ["promises", "fetch", "async await", "APIs"]),
      moduleBlueprint("Build a Small Interactive Project", ["project", "state", "debugging", "polish"]),
    ];
  }

  if (/\breact\b/.test(normalizedSubject)) {
    return [
      moduleBlueprint("React Components and JSX", ["components", "JSX", "props", "rendering"]),
      moduleBlueprint("State, Events, and Forms", ["state", "events", "forms", "controlled inputs"]),
      moduleBlueprint("Effects and Data Fetching", ["useEffect", "fetching data", "loading states", "errors"]),
      moduleBlueprint("Routing and App Structure", ["routing", "layouts", "navigation", "pages"]),
      moduleBlueprint("Reusable UI and Project Polish", ["component reuse", "styling", "accessibility", "refactoring"]),
      moduleBlueprint("Build and Review a React App", ["project", "testing", "deployment", "review"]),
    ];
  }

  const concepts = pickSpecificConcepts(subject, materialText);
  return [
    moduleBlueprint(`${subject} Orientation and First Example`, [subject, "first example", "setup", "learning goals"]),
    moduleBlueprint(`${concepts[0]} Fundamentals`, [concepts[0], "definition", "basic patterns", "common mistakes"]),
    moduleBlueprint(`${concepts[1]} with Worked Examples`, [concepts[1], "examples", "step by step", "application"]),
    moduleBlueprint(`${concepts[2]} Practice and Problem Solving`, [concepts[2], "practice", "problem solving", "feedback"]),
    moduleBlueprint(`${subject} Mini Project`, [subject, "project", "integration", "review"]),
  ];
}

function moduleBlueprint(title, keyConcepts) {
  return {
    title,
    summary: `Learn ${title.toLowerCase()} through focused examples.`,
    keyConcepts,
    examples: [`Example: apply ${keyConcepts[0]} in a short guided exercise.`],
    practiceTasks: [`Create a short practice example using ${keyConcepts[0]}.`],
  };
}

function inferCourseSubject(title, materialText = "") {
  const cleanedTitle = cleanCourseTitle(title);
  if (cleanedTitle && cleanedTitle.toLowerCase() !== "generated learning path") {
    return cleanedTitle;
  }

  const inferred = inferTitle(materialText);
  return cleanCourseTitle(inferred) || "Core Skills";
}

function cleanCourseTitle(value = "") {
  return cleanSearchText(value)
    .replace(/\b(full|complete|beginner|advanced|professional)\b/gi, "")
    .replace(/\b(course|tutorial|class|lesson|training|bootcamp|masterclass)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanVideoSearchQuery(value = "") {
  return cleanSearchText(value)
    .replace(/\b(full|complete|crash)\s+course\b/gi, "")
    .replace(/\b(shorts?|playlist|masterclass|bootcamp|all[- ]?in[- ]?one)\b/gi, "")
    .replace(/\bcourse\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickSpecificConcepts(title, materialText = "") {
  const candidates = [...title.split(/\s+/), ...materialText.split(/\s+/)]
    .map((word) => word.replace(/[^A-Za-z0-9+#.-]/g, "").trim())
    .filter((word) => word.length > 4 && !VIDEO_STOP_WORDS.has(word.toLowerCase()));

  const unique = [...new Set(candidates)].slice(0, 5);
  return [...unique, "Core Concepts", "Worked Examples", "Applied Practice"].slice(0, 3);
}

function repairModuleTitle({ title, courseTitle, keyConcepts = [], index }) {
  const normalizedTitle = cleanSearchText(title);
  const titleKey = normalizedTitle.toLowerCase();
  const courseSubject = inferCourseSubject(courseTitle);
  const firstConcept = keyConcepts.find((concept) => cleanSearchText(concept).length > 3);

  if (!GENERIC_MODULE_TITLES.has(titleKey) && !/^module\s+\d+$/i.test(titleKey) && titleKey !== courseSubject.toLowerCase()) {
    return normalizedTitle;
  }

  if (index === 0) {
    return `${courseSubject} Orientation and First Example`;
  }

  if (firstConcept) {
    return `${firstConcept} in ${courseSubject}`;
  }

  return `${courseSubject} Module ${index + 1}`;
}

function buildModuleVideoSearchQuery({ courseTitle, moduleTitle, modulePosition = 1, keyConcepts = [] }) {
  const normalizedModuleTitle = cleanSearchText(moduleTitle);
  const normalizedCourseTitle = cleanSearchText(courseTitle);
  const focusConcept = keyConcepts.find((concept) => cleanSearchText(concept).toLowerCase() !== normalizedModuleTitle.toLowerCase()) || "";
  const genericModuleTitle = GENERIC_MODULE_TITLES.has(normalizedModuleTitle.toLowerCase());
  const moduleAlreadyNamesCourse = normalizedModuleTitle.toLowerCase().includes(normalizedCourseTitle.toLowerCase());
  const focus = genericModuleTitle && focusConcept
    ? `${normalizedCourseTitle} ${focusConcept}`
    : moduleAlreadyNamesCourse
      ? normalizedModuleTitle
      : `${normalizedCourseTitle} ${normalizedModuleTitle}`;
  const introAlreadyNamed = INTRO_PATTERNS.some((pattern) => pattern.test(normalizedModuleTitle));
  const levelPhrase = modulePosition <= 1 ? (introAlreadyNamed ? "for beginners" : "introduction for beginners") : "explained with examples";
  return cleanSearchText(`${focus} ${levelPhrase}`);
}

function buildYouTubeQuery(query) {
  return `${query} tutorial lesson -shorts -playlist -masterclass -bootcamp -"full course" -"complete course" -"crash course" -"all in one"`;
}

function buildVideoSearchProfileFromQuery(queryValue) {
  const query = cleanSearchText(queryValue);
  const keywords = tokenizeSearchText(query).slice(0, 8);

  return {
    query,
    keywords,
    signature: createVideoSearchSignature({ query, videoKeywords: keywords, moduleTitle: query, modulePosition: 1 }),
    modulePosition: 1,
    moduleTitle: query,
    courseTitle: query,
  };
}

async function loadYouTubeDurations(videoIds) {
  const uniqueIds = [...new Set(videoIds.filter(Boolean))];
  if (!uniqueIds.length) {
    return new Map();
  }

  const params = new URLSearchParams({
    key: import.meta.env.VITE_YOUTUBE_API_KEY,
    part: "contentDetails",
    id: uniqueIds.join(","),
  });

  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return new Map();
  }

  return new Map((payload.items || []).map((item) => [item.id, parseIsoDuration(item.contentDetails?.duration)]));
}

function scoreVideoMatch(video, profile, durationSeconds) {
  const titleValue = video.title || "";
  const descriptionValue = video.description || "";
  const titleLower = decodeHtml(titleValue).toLowerCase();
  const descriptionLower = decodeHtml(descriptionValue).toLowerCase();
  const combinedLower = `${titleLower} ${descriptionLower}`;
  const moduleTitleLower = profile.moduleTitle.toLowerCase();
  let score = 0;

  if (titleLower.includes(moduleTitleLower)) {
    score += 10;
  }

  for (const keyword of profile.keywords) {
    const normalizedKeyword = keyword.toLowerCase();
    if (titleLower.includes(normalizedKeyword)) score += 4;
    if (descriptionLower.includes(normalizedKeyword)) score += 1;
  }

  if (EDUCATIONAL_PATTERNS.some((pattern) => pattern.test(titleValue))) {
    score += 3;
  }

  if (profile.modulePosition <= 1 && INTRO_PATTERNS.some((pattern) => pattern.test(titleValue))) {
    score += 7;
  }

  if (BROAD_VIDEO_PATTERNS.some((pattern) => pattern.test(titleValue))) {
    score -= 35;
  }

  if (BROAD_VIDEO_PATTERNS.some((pattern) => pattern.test(descriptionValue))) {
    score -= 12;
  }

  if (SHORT_VIDEO_PATTERNS.some((pattern) => pattern.test(titleValue)) || SHORT_VIDEO_PATTERNS.some((pattern) => pattern.test(descriptionValue))) {
    score -= 40;
  }

  if (profile.modulePosition > 1 && INTRO_PATTERNS.some((pattern) => pattern.test(titleValue)) && !titleLower.includes(moduleTitleLower)) {
    score -= 3;
  }

  if (durationSeconds > 3600) {
    score -= 45;
  } else if (durationSeconds > 2700) {
    score -= 35;
  } else if (durationSeconds > 1800) {
    score -= 20;
  } else if (durationSeconds > 0 && durationSeconds < MIN_LESSON_VIDEO_SECONDS) {
    score -= 50;
  }

  if (combinedLower.includes(profile.courseTitle.toLowerCase())) {
    score += 1;
  }

  return score;
}

function isAcceptableLessonVideo(video) {
  const titleValue = video.title || "";
  const descriptionValue = video.description || "";
  const durationSeconds = video.duration_seconds || 0;

  if (SHORT_VIDEO_PATTERNS.some((pattern) => pattern.test(titleValue)) || SHORT_VIDEO_PATTERNS.some((pattern) => pattern.test(descriptionValue))) {
    return false;
  }

  if (BROAD_VIDEO_PATTERNS.some((pattern) => pattern.test(titleValue))) {
    return false;
  }

  if (durationSeconds > 0 && (durationSeconds < MIN_LESSON_VIDEO_SECONDS || durationSeconds > MAX_LESSON_VIDEO_SECONDS)) {
    return false;
  }

  return true;
}

function createVideoSearchSignature({ query, videoKeywords, moduleTitle, modulePosition }) {
  return [
    VIDEO_SEARCH_VERSION,
    cleanSearchText(query).toLowerCase(),
    cleanSearchText(moduleTitle).toLowerCase(),
    modulePosition,
    uniqueStrings(videoKeywords).join("|").toLowerCase(),
  ].join("::");
}

function uniqueVideos(videos) {
  const seen = new Set();
  return videos.filter((video) => {
    if (!video.video_id || seen.has(video.video_id)) {
      return false;
    }
    seen.add(video.video_id);
    return true;
  });
}

function tokenizeSearchText(value = "") {
  return cleanSearchText(value)
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9+#.-]/g, ""))
    .filter((word) => word.length > 2 && !VIDEO_STOP_WORDS.has(word));
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => cleanSearchText(value)).filter(Boolean))];
}

function cleanSearchText(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseIsoDuration(duration = "") {
  const match = duration.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) {
    return 0;
  }

  const [, days = 0, hours = 0, minutes = 0, seconds = 0] = match;
  return Number(days) * 86400 + Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function decodeHtml(value = "") {
  const textarea = typeof document !== "undefined" ? document.createElement("textarea") : null;
  if (!textarea) {
    return value;
  }
  textarea.innerHTML = value;
  return textarea.value;
}

function decodeXml(value) {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
