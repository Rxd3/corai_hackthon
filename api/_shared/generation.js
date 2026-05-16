import { randomUUID } from "node:crypto";
import { requireEnv } from "./http.js";

const GEMINI_MODEL = "gemini-2.5-flash";
const GENERIC_MODULE_TITLES = new Set(["foundations", "core concepts", "worked examples", "practice", "review", "introduction", "overview", "basics"]);
const STOP_WORDS = new Set(["a", "an", "and", "are", "as", "at", "by", "course", "for", "from", "in", "into", "is", "lesson", "module", "of", "on", "or", "part", "the", "to", "tutorial", "with"]);

export async function generateCourse({ topic, fileContexts = [], level, duration, goal }) {
  const materialText = fileContexts.map((file) => `File: ${file.name}\n${file.text || ""}`).join("\n\n").trim();

  try {
    const generated = await generateGeminiCourse({ topic, materialText, level, duration, goal });
    return { course: normalizeCourse(generated), fallback: false };
  } catch (error) {
    return { course: fallbackCourse({ topic, materialText, level, duration, goal }), fallback: true, error: error.message };
  }
}

export async function answerLectureQuestion({ message, course, module, lesson, history = [] }) {
  const context = [
    course ? `Course: ${course.title}\n${course.description || ""}` : "",
    module ? `Lecture: ${module.title}\n${module.explanation || ""}` : "",
    lesson?.content || "",
  ].filter(Boolean).join("\n\n");

  const prompt = `
You are CorAI, a concise study assistant.
Use the course context and answer like a helpful tutor.
Start directly with the answer. Do not use greetings like "Hey there", "Hi", or "Sure".
Keep the answer focused on the current lecture only.
Use short paragraphs and bullet lists when they make the answer easier to scan.
Avoid markdown tables, decorative headings, and long full-course explanations.

Recent chat:
${history.map((item) => `${item.role}: ${item.content}`).join("\n")}

Course context:
${context.slice(0, 12000)}

Student question:
${message}
`;

  try {
    return cleanTutorAnswer(await generateGeminiText(prompt));
  } catch (error) {
    return buildLocalLectureAnswer({ message, course, module, lesson, reason: "Gemini is unavailable right now." });
  }
}

export function makeCourseRows({ userId, course, payload, fileContexts = [] }) {
  const now = new Date().toISOString();
  const courseId = randomUUID();
  const courseRow = {
    id: courseId,
    user_id: userId,
    title: course.title,
    description: course.description,
    level: payload.level,
    duration: payload.duration,
    goal: payload.goal,
    source_type: fileContexts.length ? "file" : "topic",
    source_label: payload.topic || fileContexts.map((file) => file.name).join(", "),
    source_file: fileContexts[0]?.name || null,
    estimated_time: course.estimatedTime,
    learning_outcomes: course.learningOutcomes,
    weak_topics: [],
    card_color: "lavender",
    created_at: now,
    updated_at: now,
  };

  const sources = fileContexts.map((file) => {
    const sourceId = randomUUID();
    return {
      id: sourceId,
      user_id: userId,
      course_id: courseId,
      kind: "file",
      file_name: file.name,
      storage_path: `${userId}/${courseId}/${sourceId}-${safeFileName(file.name)}`,
      text_excerpt: String(file.text || "").slice(0, 2000),
      created_at: now,
    };
  });

  const modules = [];
  const lessons = [];
  const quizzes = [];
  const questions = [];
  const studyPlan = [];

  course.modules.forEach((module, index) => {
    const moduleId = randomUUID();
    const quizId = randomUUID();
    modules.push({
      id: moduleId,
      user_id: userId,
      course_id: courseId,
      position: index + 1,
      title: module.title,
      summary: module.summary,
      explanation: module.explanation,
      key_concepts: module.keyConcepts,
      examples: module.examples,
      practice_tasks: module.practiceTasks,
      estimated_minutes: module.estimatedMinutes,
      video_search_query: module.videoSearchQuery,
      video_keywords: module.videoKeywords,
      created_at: now,
      updated_at: now,
    });

    lessons.push({
      id: randomUUID(),
      user_id: userId,
      course_id: courseId,
      module_id: moduleId,
      content: module.explanation,
      created_at: now,
    });

    quizzes.push({
      id: quizId,
      user_id: userId,
      course_id: courseId,
      module_id: moduleId,
      title: module.quiz.title,
      created_at: now,
    });

    module.quiz.questions.forEach((question, questionIndex) => {
      questions.push({
        id: randomUUID(),
        user_id: userId,
        course_id: courseId,
        module_id: moduleId,
        quiz_id: quizId,
        position: questionIndex + 1,
        prompt: question.prompt,
        options: question.options,
        correct_option_index: question.correctOptionIndex,
        explanation: question.explanation,
        topic: question.topic,
        created_at: now,
      });
    });

    studyPlan.push({
      id: randomUUID(),
      user_id: userId,
      course_id: courseId,
      module_id: moduleId,
      title: `Lecture ${index + 1}: ${module.title}`,
      meta: `${module.estimatedMinutes} min lecture + quiz`,
      kind: "lesson",
      due_date: addDays(index),
      completed: false,
      created_at: now,
    });
  });

  return { courseRow, sources, modules, lessons, quizzes, questions, studyPlan };
}

async function generateGeminiCourse({ topic, materialText, level, duration, goal }) {
  const source = materialText
    ? `Use these study materials as the main source:\n${materialText.slice(0, 24000)}`
    : `Build the course from this topic: ${topic}`;

  const prompt = `
You are CorAI, an AI course builder. Create a practical course.

Preferences:
- Level: ${level}
- Study duration: ${duration}
- Goal: ${goal}
- Topic: ${topic || "derived from uploaded materials"}

${source}

Return only valid JSON with this shape:
{
  "title": "Course title",
  "description": "One sentence description",
  "estimatedTime": "4 weeks",
  "learningOutcomes": ["outcome"],
  "modules": [
    {
      "title": "Lecture title",
      "summary": "Short summary",
      "explanation": "Clear teaching explanation in 1-3 paragraphs",
      "keyConcepts": ["concept"],
      "examples": ["example"],
      "practiceTasks": ["task"],
      "estimatedMinutes": 35,
      "videoSearchQuery": "Specific YouTube search phrase for this exact lecture only",
      "videoKeywords": ["lecture keyword"],
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
- Create 4 to 6 lectures in the modules array.
- Lecture titles must be concrete sections in real course order.
- videoSearchQuery must target only that lecture, not a full course.
- Do not use Shorts, full course, complete course, crash course, playlist, masterclass, bootcamp, or all-in-one in videoSearchQuery.
- Create exactly 5 varied quiz questions per lecture.
- Wrong answers must be plausible misconceptions, not placeholders.
- Every question has exactly 4 options and a zero-based correctOptionIndex.
`;

  return JSON.parse(cleanJson(await generateGeminiText(prompt, true)));
}

async function generateGeminiText(prompt, json = false) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": requireEnv("GEMINI_API_KEY"),
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

function normalizeModule(module, index, courseTitle) {
  const originalTitle = text(module?.title, `Lecture ${index + 1}`);
  const keyConcepts = stringArray(module?.keyConcepts).slice(0, 8);
  const title = repairModuleTitle({ title: originalTitle, courseTitle, keyConcepts, index });
  const videoKeywords = uniqueStrings([...stringArray(module?.videoKeywords || module?.video_keywords), ...keyConcepts, ...tokenizeSearchText(title)]).slice(0, 8);

  return {
    title,
    summary: text(module?.summary, `Learn ${title}.`),
    explanation: text(module?.explanation, `This lecture explains ${title} with concise examples and practice.`),
    keyConcepts,
    examples: stringArray(module?.examples).slice(0, 5),
    practiceTasks: stringArray(module?.practiceTasks).slice(0, 5),
    estimatedMinutes: number(module?.estimatedMinutes, 35, 15, 120),
    videoSearchQuery: text(module?.videoSearchQuery || module?.video_search_query, buildModuleVideoSearchQuery({ courseTitle, moduleTitle: title, modulePosition: index + 1, keyConcepts })),
    videoKeywords,
    quiz: {
      title: text(module?.quiz?.title, `${title} Quiz`),
      questions: normalizeQuestions({ courseTitle, moduleTitle: title, keyConcepts, questions: module?.quiz?.questions || [] }),
    },
  };
}

function normalizeQuestions({ courseTitle, moduleTitle, keyConcepts, questions }) {
  const fallback = buildModuleQuizQuestions({ courseTitle, moduleTitle, keyConcepts });
  const normalized = questions.slice(0, 5).map((question, index) => ({
    prompt: text(question?.prompt, fallback[index]?.prompt || `Question about ${moduleTitle}`),
    options: normalizeOptions(question?.options, fallback[index]?.options),
    correctOptionIndex: number(question?.correctOptionIndex ?? question?.correct_option_index, fallback[index]?.correctOptionIndex || 0, 0, 3),
    explanation: text(question?.explanation, fallback[index]?.explanation || "Review the lecture explanation."),
    topic: text(question?.topic, fallback[index]?.topic || moduleTitle),
  }));

  while (normalized.length < 5) {
    normalized.push(fallback[normalized.length]);
  }

  return normalized;
}

function buildModuleQuizQuestions({ courseTitle = "Course", moduleTitle, keyConcepts = [] }) {
  const title = cleanSearchText(moduleTitle || "this lecture");
  const concepts = uniqueStrings([...keyConcepts, ...tokenizeSearchText(title)]).slice(0, 5);
  while (concepts.length < 5) concepts.push(`${title} concept ${concepts.length + 1}`);

  const subject = inferCourseSubject(courseTitle);
  const [primary, second, third, fourth, fifth] = concepts;
  return [
    {
      prompt: `What is the main purpose of ${primary} in ${title}?`,
      options: [`It helps you complete the core task taught in ${title}.`, "It is only used to decorate code without changing behavior.", "It should be skipped until after every advanced topic is finished.", `It replaces the need to understand the rest of ${subject}.`],
      correctOptionIndex: 0,
      explanation: `${primary} is one of the core ideas for completing the work in ${title}.`,
      topic: primary,
    },
    {
      prompt: `Which example best shows ${second} being used correctly?`,
      options: [`Using ${second} to solve a small, focused problem from the lecture.`, `Choosing ${second} randomly before knowing the problem.`, `Avoiding ${second} because practice makes mistakes visible.`, `Using ${second} only as a word to memorize for the quiz.`],
      correctOptionIndex: 0,
      explanation: `A correct use of ${second} connects the concept to a concrete problem or example.`,
      topic: second,
    },
    {
      prompt: `What mistake should you watch for when working with ${third}?`,
      options: ["Applying the idea without checking how it fits the current step.", "Writing a small test example before moving forward.", "Reading the lecture explanation before attempting practice.", "Comparing your answer with the expected behavior."],
      correctOptionIndex: 0,
      explanation: `${third} is easier to use correctly when you connect it to the current step and verify the result.`,
      topic: third,
    },
    {
      prompt: `After studying ${title}, what should you be able to explain about ${fourth}?`,
      options: ["When to use it, what it does, and one simple example.", "Only the spelling of the term.", "Why it has no relationship to the lecture practice.", "Why examples should be avoided until the final project."],
      correctOptionIndex: 0,
      explanation: `A useful understanding of ${fourth} includes purpose, timing, and a short example.`,
      topic: fourth,
    },
    {
      prompt: `Which practice step would best reinforce ${fifth}?`,
      options: ["Build a small example, predict the result, then check and explain it.", "Copy a final answer without running or reviewing it.", "Move to a new lecture without trying an example.", "Memorize the course title instead of practicing the lecture skill."],
      correctOptionIndex: 0,
      explanation: `${fifth} becomes stronger through prediction, practice, checking, and explanation.`,
      topic: fifth,
    },
  ];
}

function fallbackCourse({ topic, materialText, level, duration, goal }) {
  const title = topic?.trim() || inferTitle(materialText) || "Generated Learning Path";
  const subject = inferCourseSubject(title, materialText);
  const modules = buildFallbackModules(title, materialText);

  return normalizeCourse({
    title,
    description: `A focused ${String(level || "Beginner").toLowerCase()} course for ${String(goal || "Full Course").toLowerCase()}.`,
    estimatedTime: duration || "1 Month",
    learningOutcomes: [`Explain the core ideas behind ${title}.`, "Apply the main concepts through guided practice.", "Check understanding with short quizzes."],
    modules: modules.map((module, index) => ({
      title: module.title,
      summary: module.summary,
      explanation: `${module.title} is a focused lecture in ${title}. Study ${module.keyConcepts.slice(0, 3).join(", ")} through clear examples before moving to the quiz.`,
      keyConcepts: module.keyConcepts,
      examples: module.examples,
      practiceTasks: module.practiceTasks,
      estimatedMinutes: 30 + index * 5,
      videoSearchQuery: buildModuleVideoSearchQuery({ courseTitle: subject, moduleTitle: module.title, modulePosition: index + 1, keyConcepts: module.keyConcepts }),
      videoKeywords: module.keyConcepts,
      quiz: { title: `${module.title} Check`, questions: buildModuleQuizQuestions({ courseTitle: title, moduleTitle: module.title, keyConcepts: module.keyConcepts }) },
    })),
  });
}

function buildFallbackModules(title, materialText = "") {
  const subject = inferCourseSubject(title, materialText);
  if (/\bpython\b/i.test(subject)) {
    return [
      moduleBlueprint("Python Setup and First Program", ["Python interpreter", "code editor", "print", "running scripts"]),
      moduleBlueprint("Variables, Data Types, and Operators", ["variables", "strings", "numbers", "booleans"]),
      moduleBlueprint("Control Flow with Conditions and Loops", ["if statements", "for loops", "while loops", "comparison operators"]),
      moduleBlueprint("Functions and Reusable Code", ["functions", "parameters", "return values", "scope"]),
      moduleBlueprint("Files, Errors, and Mini Projects", ["file handling", "exceptions", "debugging", "mini project"]),
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

function buildLocalLectureAnswer({ message, course, module, lesson, reason }) {
  const moduleTitle = text(module?.title, "this lecture");
  const explanation = text(module?.explanation || lesson?.content, "Review the lecture explanation, examples, and practice task for this lecture.");
  const concepts = stringArray(module?.key_concepts || module?.keyConcepts).slice(0, 5);
  const lowerMessage = String(message || "").toLowerCase();
  const setupNote = reason ? `Using saved lecture notes for now because ${reason}\n\n` : "";
  if (lowerMessage.includes("summar")) {
    return `${setupNote}${moduleTitle} summary:\n\n- ${explanation}\n${concepts.map((concept) => `- ${concept}`).join("\n")}`;
  }
  return `${setupNote}For ${moduleTitle}:\n\n${explanation}\n\nUseful focus areas:\n${concepts.length ? concepts.map((concept) => `- ${concept}`).join("\n") : "- The lecture explanation\n- The examples\n- The practice task"}`;
}

function cleanTutorAnswer(answer) {
  return String(answer || "").trim()
    .replace(/^(hey there|hi there|hello there|hey|hi|hello|sure|of course|absolutely)[,!.\s-]+/i, "")
    .replace(/^(let'?s dive in|let'?s jump in|here'?s|here is)[,!.\s-]+/i, "")
    .trim();
}

function normalizeOptions(options, fallback = []) {
  const result = stringArray(options).slice(0, 4);
  while (result.length < 4) result.push(fallback[result.length] || `Option ${result.length + 1}`);
  return result;
}

function moduleBlueprint(title, keyConcepts) {
  return { title, summary: `Learn ${title.toLowerCase()} through focused examples.`, keyConcepts, examples: [`Example: apply ${keyConcepts[0]} in a short guided exercise.`], practiceTasks: [`Create a short practice example using ${keyConcepts[0]}.`] };
}

function repairModuleTitle({ title, courseTitle, keyConcepts = [], index }) {
  const normalizedTitle = cleanSearchText(title);
  const titleKey = normalizedTitle.toLowerCase();
  const courseSubject = inferCourseSubject(courseTitle);
  const firstConcept = keyConcepts.find((concept) => cleanSearchText(concept).length > 3);
  if (!GENERIC_MODULE_TITLES.has(titleKey) && !/^module\s+\d+$/i.test(titleKey) && titleKey !== courseSubject.toLowerCase()) return normalizedTitle;
  if (index === 0) return `${courseSubject} Orientation and First Example`;
  if (firstConcept) return `${firstConcept} in ${courseSubject}`;
  return `${courseSubject} Lecture ${index + 1}`;
}

function buildModuleVideoSearchQuery({ courseTitle, moduleTitle, modulePosition = 1, keyConcepts = [] }) {
  const normalizedModuleTitle = cleanSearchText(moduleTitle);
  const normalizedCourseTitle = cleanSearchText(courseTitle);
  const focusConcept = keyConcepts.find((concept) => cleanSearchText(concept).toLowerCase() !== normalizedModuleTitle.toLowerCase()) || "";
  const generic = GENERIC_MODULE_TITLES.has(normalizedModuleTitle.toLowerCase());
  const focus = generic && focusConcept ? `${normalizedCourseTitle} ${focusConcept}` : `${normalizedCourseTitle} ${normalizedModuleTitle}`;
  return cleanSearchText(`${focus} ${modulePosition <= 1 ? "introduction for beginners" : "explained with examples"}`);
}

function inferCourseSubject(title, materialText = "") {
  const cleaned = cleanCourseTitle(title);
  if (cleaned && cleaned.toLowerCase() !== "generated learning path") return cleaned;
  return cleanCourseTitle(inferTitle(materialText)) || "Core Skills";
}

function inferTitle(value = "") {
  return String(value).split(/\s+/).filter((word) => /^[A-Za-z][A-Za-z-]{3,}$/.test(word)).slice(0, 4).join(" ");
}

function cleanCourseTitle(value = "") {
  return cleanSearchText(value).replace(/\b(full|complete|beginner|advanced|professional|course|tutorial|class|lesson|training|bootcamp|masterclass)\b/gi, "").replace(/\s+/g, " ").trim();
}

function pickSpecificConcepts(title, materialText = "") {
  const candidates = [...String(title).split(/\s+/), ...String(materialText).split(/\s+/)]
    .map((word) => word.replace(/[^A-Za-z0-9+#.-]/g, "").trim())
    .filter((word) => word.length > 4 && !STOP_WORDS.has(word.toLowerCase()));
  return [...new Set(candidates), "Core Concepts", "Worked Examples", "Applied Practice"].slice(0, 3);
}

function tokenizeSearchText(value = "") {
  return cleanSearchText(value).toLowerCase().split(/\s+/).map((word) => word.replace(/[^a-z0-9+#.-]/g, "")).filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function cleanJson(value = "") {
  return String(value).replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
}

function text(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => cleanSearchText(value)).filter(Boolean))];
}

function cleanSearchText(value = "") {
  return String(value).replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function number(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function safeFileName(name = "material") {
  return String(name).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "material";
}
