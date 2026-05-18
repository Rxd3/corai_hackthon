import { randomUUID } from "node:crypto";
import { generateStructuredJson, generateText } from "./openai.js";

const GENERIC_MODULE_TITLES = new Set(["foundations", "core concepts", "worked examples", "practice", "review", "introduction", "overview", "basics"]);
const STOP_WORDS = new Set(["a", "an", "and", "are", "as", "at", "by", "course", "for", "from", "in", "into", "is", "lesson", "module", "of", "on", "or", "part", "the", "to", "tutorial", "with"]);
const COURSE_LEVELS = new Set(["Beginner", "Intermediate", "Advanced"]);
const STUDY_DURATIONS = new Set(["1 Week", "1 Month", "3 Months"]);
const COURSE_GOALS = new Set(["Exam Preparation", "Full Course", "Quick Revision"]);
const MATERIAL_PROMPT_CHAR_LIMIT = 56000;
const MATERIAL_CHUNK_CHAR_LIMIT = 6000;

const LEVEL_PROFILES = {
  Beginner: {
    explanationStyle: "Explain from zero with easy language, short steps, definitions before technical terms, and at least two simple examples per lesson.",
    quizStyle: "Start each quiz with easy recall and comprehension questions, then gradually add simple application questions.",
    practiceStyle: "Use guided practice tasks with small steps and visible hints.",
    videoIntent: "beginner friendly introduction basics explained",
    minutesDelta: -5,
    difficultyLabel: "beginner-friendly",
  },
  Intermediate: {
    explanationStyle: "Assume the learner knows the basics; use normal technical explanations, practical examples, and moderate depth.",
    quizStyle: "Use moderate quizzes with applied questions and realistic misconceptions.",
    practiceStyle: "Use practical exercises that require applying concepts to realistic scenarios.",
    videoIntent: "practical tutorial explained examples",
    minutesDelta: 0,
    difficultyLabel: "intermediate",
  },
  Advanced: {
    explanationStyle: "Use deeper explanations, technical details, edge cases, tradeoffs, and advanced terminology where useful.",
    quizStyle: "Use challenging quizzes with scenario, analysis, and troubleshooting questions.",
    practiceStyle: "Use harder exercises, extension tasks, and advanced implementation or reasoning prompts.",
    videoIntent: "advanced in depth technical deep dive",
    minutesDelta: 10,
    difficultyLabel: "advanced",
  },
};

const DURATION_PROFILES = {
  "1 Week": {
    cadence: "intensive 1-week sprint",
    planStyle: "Daily or near-daily tasks focused on essentials.",
    baseLessons: 4,
    maxLessons: 5,
    dueOffsets: [0, 1, 2, 3, 4],
    reviewFrequency: 0,
    minutesMultiplier: 1.2,
    videoIntent: "essential concise tutorial",
  },
  "1 Month": {
    cadence: "balanced 1-month plan",
    planStyle: "Reasonable lesson distribution with quizzes and review time.",
    baseLessons: 6,
    maxLessons: 7,
    dueOffsets: [0, 4, 8, 12, 16, 20, 24],
    reviewFrequency: 3,
    minutesMultiplier: 1,
    videoIntent: "tutorial lesson examples",
  },
  "3 Months": {
    cadence: "slower 3-month deep plan",
    planStyle: "More lessons, slower weekly progression, review sessions, and deeper practice.",
    baseLessons: 8,
    maxLessons: 8,
    dueOffsets: [0, 7, 14, 21, 28, 35, 42, 49],
    reviewFrequency: 2,
    minutesMultiplier: 0.9,
    videoIntent: "detailed in depth tutorial",
  },
};

const GOAL_PROFILES = {
  "Exam Preparation": {
    structure: "Prioritize high-yield exam topics, important definitions, common traps, and checkpoint reviews.",
    quizStyle: "Use exam-style questions with plausible distractors and explanations that mention why wrong options are wrong.",
    practiceStyle: "Add timed practice, revision checkpoints, and high-yield topic review.",
    lessonDelta: 1,
    reviewFrequency: 2,
    videoIntent: "exam preparation practice questions high yield",
    titlePrefix: "Exam checkpoint",
  },
  "Full Course": {
    structure: "Generate a complete structured course in logical order with all main concepts, practice, quizzes, and reviews.",
    quizStyle: "Use balanced quizzes that cover definitions, examples, application, and common mistakes.",
    practiceStyle: "Add practice tasks that build toward a complete understanding of the subject.",
    lessonDelta: 0,
    reviewFrequency: 0,
    videoIntent: "complete lesson tutorial examples",
    titlePrefix: "Review",
  },
  "Quick Revision": {
    structure: "Create a shorter revision-focused path with summaries, formulas, definitions, key points, and common mistakes.",
    quizStyle: "Use fast review quizzes focused on key facts, formulas, definitions, and common mistakes.",
    practiceStyle: "Add short recall tasks and summary checks instead of long projects.",
    lessonDelta: -1,
    reviewFrequency: 0,
    videoIntent: "revision summary key points common mistakes",
    titlePrefix: "Revision checkpoint",
  },
};

export async function generateCourse({ topic, fileContexts = [], level, duration, goal }) {
  const materialText = buildMaterialText(fileContexts);
  const settings = resolveCourseSettings({ level, duration, goal });
  const hasUploadedMaterials = fileContexts.length > 0;

  if (hasUploadedMaterials && !materialText) {
    throw new Error("Uploaded material has no readable text. Please upload a text-based PDF or another readable material file.");
  }

  try {
    const sourceMode = hasUploadedMaterials ? "uploaded_materials" : "topic";
    const generated = await generateOpenAICourse({ topic, materialText, settings, sourceMode });
    return {
      course: normalizeCourse(generated, {
        ...settings,
        sourceMode,
        requireSourceGrounding: hasUploadedMaterials,
      }),
      fallback: false,
    };
  } catch (error) {
    if (isFatalGenerationError(error) || hasUploadedMaterials) {
      throw error;
    }
    return { course: fallbackCourse({ topic, materialText, settings }), fallback: true, error: error.message };
  }
}

export async function answerLectureQuestion({ message, course, module, lesson, history = [] }) {
  const context = [
    course ? `Course: ${course.title}\n${course.description || ""}` : "",
    module ? `Lecture: ${module.title}\n${module.explanation || ""}` : "",
    lesson?.content || "",
  ].filter(Boolean).join("\n\n");

  const instructions = `
You are CorAI, a concise study assistant.
Use the course context and answer like a helpful tutor.
Start directly with the answer. Do not use greetings like "Hey there", "Hi", or "Sure".
Keep the answer focused on the current lecture only.
Use short paragraphs and bullet lists when they make the answer easier to scan.
Avoid markdown tables, decorative headings, and long full-course explanations.
`;

  const input = `
Recent chat:
${history.map((item) => `${item.role}: ${item.content}`).join("\n")}

Course context:
${context.slice(0, 12000)}

Student question:
${message}
`;

  try {
    return cleanTutorAnswer(await generateText({ instructions, input }));
  } catch (error) {
    return buildLocalLectureAnswer({ message, course, module, lesson, reason: "OpenAI is unavailable right now." });
  }
}

export function makeCourseRows({ userId, course, payload, fileContexts = [] }) {
  const now = new Date().toISOString();
  const settings = resolveCourseSettings(payload);
  const courseId = randomUUID();
  const courseRow = {
    id: courseId,
    user_id: userId,
    title: course.title,
    description: course.description,
    level: settings.level,
    duration: settings.duration,
    goal: settings.goal,
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
      text_excerpt: sourceTextExcerpt(file),
      created_at: now,
    };
  });

  const modules = [];
  const lessons = [];
  const quizzes = [];
  const questions = [];
  const studyModules = [];

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

    studyModules.push({ id: moduleId, title: module.title, estimatedMinutes: module.estimatedMinutes, position: index + 1 });
  });

  const studyPlan = makeStudyPlanRows({ userId, courseId, modules: studyModules, settings, now });

  return { courseRow, sources, modules, lessons, quizzes, questions, studyPlan };
}

function buildMaterialText(fileContexts = []) {
  const readableFiles = fileContexts.filter((file) => hasReadableMaterial(file));
  const sections = [];
  let remaining = MATERIAL_PROMPT_CHAR_LIMIT;

  for (const file of readableFiles) {
    if (remaining <= 0) break;
    const section = buildMaterialFileSection(file, remaining);
    if (!section) continue;
    sections.push(section);
    remaining -= section.length + 2;
  }

  if (readableFiles.length > sections.length) {
    sections.push("[Some uploaded material was omitted safely because the combined text is very long.]");
  }

  return sections.join("\n\n").trim();
}

function buildMaterialFileSection(file, budget) {
  const header = [
    `File: ${file.name || "Uploaded material"}`,
    file.fileType ? `Type: ${file.fileType}` : "",
    file.pageCount ? `Pages: ${file.pageCount}` : "",
  ].filter(Boolean).join("\n");
  const chunks = normalizeMaterialChunks(file);
  if (!chunks.length) return "";

  let section = `${header}\n`;
  for (const [index, chunk] of chunks.entries()) {
    const chunkHeader = `Source chunk ${index + 1}${chunk.pageRange ? ` (${chunk.pageRange})` : ""}:`;
    const chunkText = `${chunkHeader}\n${chunk.text}`.trim();
    if (section.length + chunkText.length + 2 > budget) {
      break;
    }
    section = `${section}\n${chunkText}\n`;
  }

  if (section.trim() === header.trim()) {
    const firstChunk = chunks[0];
    const available = Math.max(0, budget - header.length - 40);
    if (!available) return "";
    section = `${header}\nSource chunk 1${firstChunk.pageRange ? ` (${firstChunk.pageRange})` : ""}:\n${String(firstChunk.text).slice(0, available).trim()}`;
  }

  if (file.truncated) {
    section = `${section.trim()}\n[This file was truncated safely after extraction because it is very long.]`;
  }

  return section.trim();
}

function normalizeMaterialChunks(file) {
  const providedChunks = Array.isArray(file.chunks)
    ? file.chunks.map((chunk) => ({
      text: cleanMaterialText(chunk?.text || ""),
      pageRange: cleanSearchText(chunk?.pageRange || ""),
    })).filter((chunk) => chunk.text)
    : [];
  if (providedChunks.length) return providedChunks;

  const pages = Array.isArray(file.pages)
    ? file.pages.map((page) => ({
      text: cleanMaterialText(page?.text || ""),
      pageRange: page?.page ? `Page ${page.page}` : "",
    })).filter((page) => page.text)
    : [];
  if (pages.length) return pages;

  return chunkMaterialText(cleanMaterialText(file.text || ""));
}

function chunkMaterialText(textValue) {
  if (!textValue) return [];
  const chunks = [];
  const pageMatches = [...textValue.matchAll(/^Page\s+(\d+):\n([\s\S]*?)(?=^Page\s+\d+:\n|\s*$)/gm)];
  if (pageMatches.length) {
    return pageMatches.map((match) => ({
      text: cleanMaterialText(`Page ${match[1]}:\n${match[2]}`),
      pageRange: `Page ${match[1]}`,
    })).filter((chunk) => chunk.text);
  }

  const paragraphs = textValue.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  let current = "";
  for (const paragraph of paragraphs.length ? paragraphs : [textValue]) {
    if (current && current.length + paragraph.length + 2 > MATERIAL_CHUNK_CHAR_LIMIT) {
      chunks.push({ text: current.trim() });
      current = "";
    }
    current = `${current}\n\n${paragraph}`.trim();
  }
  if (current) chunks.push({ text: current.trim() });
  return chunks;
}

function sourceTextExcerpt(file) {
  return normalizeMaterialChunks(file).map((chunk) => chunk.text).join("\n\n").slice(0, 2000);
}

function hasReadableMaterial(file) {
  return normalizeMaterialChunks(file).some((chunk) => cleanMaterialText(chunk.text).replace(/\s+/g, "").length >= 40);
}

function cleanMaterialText(value = "") {
  return String(value)
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isFatalGenerationError(error) {
  const message = String(error?.message || "");
  return (
    message === "Missing OPENAI_API_KEY" ||
    message.includes("OpenAI returned invalid JSON") ||
    message.includes("OpenAI returned an empty structured response")
  );
}

const COURSE_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "estimatedTime", "learningOutcomes", "modules"],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    estimatedTime: { type: "string" },
    learningOutcomes: { type: "array", items: { type: "string" } },
    modules: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "summary", "explanation", "keyConcepts", "examples", "practiceTasks", "estimatedMinutes", "videoSearchQuery", "videoKeywords", "quiz"],
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          explanation: { type: "string" },
          keyConcepts: { type: "array", items: { type: "string" } },
          examples: { type: "array", items: { type: "string" } },
          practiceTasks: { type: "array", items: { type: "string" } },
          estimatedMinutes: { type: "number" },
          videoSearchQuery: { type: "string" },
          videoKeywords: { type: "array", items: { type: "string" } },
          quiz: {
            type: "object",
            additionalProperties: false,
            required: ["title", "questions"],
            properties: {
              title: { type: "string" },
              questions: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["prompt", "options", "correctOptionIndex", "explanation", "topic"],
                  properties: {
                    prompt: { type: "string" },
                    options: { type: "array", items: { type: "string" } },
                    correctOptionIndex: { type: "number" },
                    explanation: { type: "string" },
                    topic: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

async function generateOpenAICourse({ topic, materialText, settings, sourceMode }) {
  const source = materialText
    ? `Use these uploaded study materials as the main source. They are safely chunked and labeled by file/page; preserve source order and page references when building the course:\n${materialText}`
    : `Build the course from this topic: ${topic}`;

  const instructions = `
You are CorAI, an AI course builder. Create a practical course as structured JSON.
Use only the uploaded material when source mode is uploaded_materials. Do not invent unsupported topics in uploaded-materials mode.
If a PDF/page label is available, mention page or section references naturally in explanations, examples, practice tasks, quiz prompts, or quiz explanations.
Make every lesson quiz lesson-specific and source-grounded.
`;

  const input = `
Source mode: ${sourceMode}

Course settings selected by the user:
- Level: ${settings.level}
- Study duration: ${settings.duration}
- Goal: ${settings.goal}
- Topic: ${topic || "derived from uploaded materials"}

These settings are requirements, not decoration:
- Level behavior: ${settings.levelProfile.explanationStyle}
- Level quiz behavior: ${settings.levelProfile.quizStyle}
- Level practice behavior: ${settings.levelProfile.practiceStyle}
- Duration behavior: ${settings.durationProfile.cadence}; ${settings.durationProfile.planStyle}
- Goal behavior: ${settings.goalProfile.structure}
- Goal quiz behavior: ${settings.goalProfile.quizStyle}
- Goal practice behavior: ${settings.goalProfile.practiceStyle}
- Generate exactly ${settings.lessonCount} lessons in the modules array.

${source}

Rules:
- Create exactly ${settings.lessonCount} lessons in the modules array.
- Lecture titles must be concrete sections in real course order.
- 1 Week plans must focus on essentials and must not look like a 3-month deep course.
- 3 Months plans must be more detailed and must not compress everything into a short sprint.
- Quick Revision plans must be concise and revision-focused, not a full long course.
- Exam Preparation plans must include high-yield exam topics, revision checkpoints, and exam-style questions.
- Beginner courses must explain from zero and use easier language.
- Advanced courses must include deeper technical details and harder exercises.
- When uploaded materials include pages, chapters, sections, formulas, examples, or exercises, structure lessons around the actual material order.
- Quizzes, practice, schedule, and video queries must reflect the uploaded material, not generic/static content.
- If uploaded material includes exercises, convert some of them into quiz questions and practice tasks.
- If uploaded material includes definitions, formulas, examples, or key concepts, use them in the matching lesson quiz.
- In uploaded-materials mode, include page/section references wherever possible without making every sentence repetitive.
- videoSearchQuery must target only that lecture, not a full course.
- videoSearchQuery must match the selected settings using this intent: ${settings.videoIntent}.
- Good query examples: "Beginner signals and systems convolution tutorial", "Exam preparation probability distributions solved problems", "Advanced machine learning regularization lecture".
- Do not use Shorts, full course, complete course, crash course, playlist, masterclass, bootcamp, or all-in-one in videoSearchQuery.
- Create exactly 5 varied quiz questions per lecture.
- Wrong answers must be plausible misconceptions, not placeholders.
- Every question has exactly 4 options and a zero-based correctOptionIndex.
`;

  return generateStructuredJson({
    instructions,
    input,
    name: "course_generation",
    description: "A PDF- or topic-grounded course with lesson quizzes and specialized resource search queries.",
    schema: COURSE_RESPONSE_SCHEMA,
  });
}

function normalizeCourse(course, settings = resolveCourseSettings({})) {
  const title = text(course?.title, "Generated Course");
  const sourceModules = Array.isArray(course?.modules) ? course.modules : [];
  if (settings.requireSourceGrounding && sourceModules.length < settings.lessonCount) {
    throw new Error("OpenAI did not return enough PDF-based lessons. Please try again with a clearer text-based PDF.");
  }

  const modules = sourceModules
    .slice(0, settings.lessonCount)
    .map((module, index) => normalizeModule(module, index, title, settings));
  while (modules.length < settings.lessonCount) {
    const fallbackModule = moduleBlueprint(`${title} Practice Extension ${modules.length + 1}`, [title, "practice", "review", "application"]);
    modules.push(normalizeModule(fallbackModule, modules.length, title, settings));
  }

  return {
    title,
    description: text(course?.description, `A ${settings.level.toLowerCase()} ${settings.goal.toLowerCase()} path for ${settings.duration.toLowerCase()}.`),
    estimatedTime: text(course?.estimatedTime, settings.duration),
    learningOutcomes: stringArray(course?.learningOutcomes).slice(0, 8),
    modules,
  };
}

function normalizeModule(module, index, courseTitle, settings = resolveCourseSettings({})) {
  const originalTitle = text(module?.title, `Lecture ${index + 1}`);
  const keyConcepts = stringArray(module?.keyConcepts).slice(0, 8);
  const title = repairModuleTitle({ title: originalTitle, courseTitle, keyConcepts, index });
  const videoKeywords = uniqueStrings([...stringArray(module?.videoKeywords || module?.video_keywords), ...keyConcepts, ...tokenizeSearchText(title)]).slice(0, 8);
  const defaultMinutes = lessonMinutesForSettings({ settings, index });
  const examples = normalizeExamplesForSettings({ examples: module?.examples, title, keyConcepts, settings });
  const practiceTasks = normalizePracticeForSettings({ tasks: module?.practiceTasks, title, keyConcepts, settings });

  return {
    title,
    summary: text(module?.summary, `${settings.levelProfile.difficultyLabel} lesson: ${title}.`),
    explanation: text(module?.explanation, `${settings.levelProfile.explanationStyle} This lesson explains ${title} with examples and practice.`),
    keyConcepts,
    examples,
    practiceTasks,
    estimatedMinutes: number(module?.estimatedMinutes, defaultMinutes, 15, 140),
    videoSearchQuery: text(module?.videoSearchQuery || module?.video_search_query, buildModuleVideoSearchQuery({ courseTitle, moduleTitle: title, modulePosition: index + 1, keyConcepts, settings })),
    videoKeywords,
    quiz: {
      title: text(module?.quiz?.title, `${title} Quiz`),
      questions: normalizeQuestions({ courseTitle, moduleTitle: title, keyConcepts, questions: module?.quiz?.questions || [], settings }),
    },
  };
}

function normalizeQuestions({ courseTitle, moduleTitle, keyConcepts, questions, settings = resolveCourseSettings({}) }) {
  if (settings.requireSourceGrounding && (!Array.isArray(questions) || questions.length < 5)) {
    throw new Error(`OpenAI did not return enough PDF-based quiz questions for "${moduleTitle}". Please try again with a clearer text-based PDF.`);
  }
  if (settings.requireSourceGrounding && questions.slice(0, 5).some((question) => !Array.isArray(question?.options) || question.options.length !== 4)) {
    throw new Error(`OpenAI returned incomplete PDF-based answer options for "${moduleTitle}". Please try again with a clearer text-based PDF.`);
  }

  const fallback = buildModuleQuizQuestions({ courseTitle, moduleTitle, keyConcepts, settings });
  const normalized = questions.slice(0, 5).map((question, index) => ({
    prompt: text(question?.prompt, fallback[index]?.prompt || `Question about ${moduleTitle}`),
    options: normalizeOptions(question?.options, fallback[index]?.options),
    correctOptionIndex: number(question?.correctOptionIndex ?? question?.correct_option_index, fallback[index]?.correctOptionIndex || 0, 0, 3),
    explanation: text(question?.explanation, fallback[index]?.explanation || "Review the lecture explanation."),
    topic: text(question?.topic, fallback[index]?.topic || moduleTitle),
  }));

  if (settings.requireSourceGrounding && normalized.some((question) => !question.prompt || question.options.length !== 4 || question.options.some((option) => /^option\s+\d+$/i.test(option)))) {
    throw new Error(`OpenAI returned an incomplete PDF-based quiz for "${moduleTitle}". Please try again with a clearer text-based PDF.`);
  }

  while (normalized.length < 5) {
    normalized.push(fallback[normalized.length]);
  }

  return normalized;
}

function buildModuleQuizQuestions({ courseTitle = "Course", moduleTitle, keyConcepts = [], settings = resolveCourseSettings({}) }) {
  const title = cleanSearchText(moduleTitle || "this lecture");
  const concepts = uniqueStrings([...keyConcepts, ...tokenizeSearchText(title)]).slice(0, 5);
  while (concepts.length < 5) concepts.push(`${title} concept ${concepts.length + 1}`);

  const subject = inferCourseSubject(courseTitle);
  const [primary, second, third, fourth, fifth] = concepts;
  const promptPrefix = settings.goal === "Exam Preparation"
    ? "Exam-style"
    : settings.goal === "Quick Revision"
      ? "Quick review"
      : settings.level === "Advanced"
        ? "Advanced"
        : "";

  return [
    {
      prompt: `${promptPrefix ? `${promptPrefix}: ` : ""}What is the main purpose of ${primary} in ${title}?`,
      options: [`It helps you complete the core task taught in ${title}.`, "It is only used to decorate code without changing behavior.", "It should be skipped until after every advanced topic is finished.", `It replaces the need to understand the rest of ${subject}.`],
      correctOptionIndex: 0,
      explanation: `${primary} is one of the core ideas for completing the work in ${title}.`,
      topic: primary,
    },
    {
      prompt: `${settings.level === "Advanced" ? "Which scenario" : "Which example"} best shows ${second} being used correctly?`,
      options: [`Using ${second} to solve a small, focused problem from the lecture.`, `Choosing ${second} randomly before knowing the problem.`, `Avoiding ${second} because practice makes mistakes visible.`, `Using ${second} only as a word to memorize for the quiz.`],
      correctOptionIndex: 0,
      explanation: `A correct use of ${second} connects the concept to a concrete problem or example.`,
      topic: second,
    },
    {
      prompt: `${settings.goal === "Quick Revision" ? "Which common mistake" : "What mistake"} should you watch for when working with ${third}?`,
      options: ["Applying the idea without checking how it fits the current step.", "Writing a small test example before moving forward.", "Reading the lecture explanation before attempting practice.", "Comparing your answer with the expected behavior."],
      correctOptionIndex: 0,
      explanation: `${third} is easier to use correctly when you connect it to the current step and verify the result.`,
      topic: third,
    },
    {
      prompt: `After studying this ${settings.level.toLowerCase()} lesson, what should you be able to explain about ${fourth}?`,
      options: ["When to use it, what it does, and one simple example.", "Only the spelling of the term.", "Why it has no relationship to the lecture practice.", "Why examples should be avoided until the final project."],
      correctOptionIndex: 0,
      explanation: `A useful understanding of ${fourth} includes purpose, timing, and a short example.`,
      topic: fourth,
    },
    {
      prompt: `Which ${settings.goal === "Exam Preparation" ? "exam prep" : "practice"} step would best reinforce ${fifth}?`,
      options: ["Build a small example, predict the result, then check and explain it.", "Copy a final answer without running or reviewing it.", "Move to a new lecture without trying an example.", "Memorize the course title instead of practicing the lecture skill."],
      correctOptionIndex: 0,
      explanation: `${fifth} becomes stronger through prediction, practice, checking, and explanation.`,
      topic: fifth,
    },
  ];
}

function fallbackCourse({ topic, materialText, settings }) {
  const title = topic?.trim() || inferTitle(materialText) || "Generated Learning Path";
  const subject = inferCourseSubject(title, materialText);
  const modules = buildFallbackModules(title, materialText, settings);

  return normalizeCourse({
    title,
    description: `A ${settings.level.toLowerCase()} ${settings.goal.toLowerCase()} plan for ${settings.duration.toLowerCase()}.`,
    estimatedTime: settings.duration,
    learningOutcomes: settings.learningOutcomes(title),
    modules: modules.map((module, index) => ({
      title: module.title,
      summary: module.summary,
      explanation: buildFallbackExplanation({ courseTitle: title, module, settings }),
      keyConcepts: module.keyConcepts,
      examples: buildExamplesForSettings(module, settings),
      practiceTasks: buildPracticeTasksForSettings(module, settings),
      estimatedMinutes: lessonMinutesForSettings({ settings, index }),
      videoSearchQuery: buildModuleVideoSearchQuery({ courseTitle: subject, moduleTitle: module.title, modulePosition: index + 1, keyConcepts: module.keyConcepts, settings }),
      videoKeywords: uniqueStrings([...module.keyConcepts, ...settings.videoKeywords]),
      quiz: { title: `${module.title} ${settings.goal === "Quick Revision" ? "Review" : "Check"}`, questions: buildModuleQuizQuestions({ courseTitle: title, moduleTitle: module.title, keyConcepts: module.keyConcepts, settings }) },
    })),
  }, settings);
}

function buildFallbackModules(title, materialText = "", settings = resolveCourseSettings({})) {
  const subject = inferCourseSubject(title, materialText);
  const base = /\bpython\b/i.test(subject)
    ? [
      moduleBlueprint("Python Setup and First Program", ["Python interpreter", "code editor", "print", "running scripts"]),
      moduleBlueprint("Variables, Data Types, and Operators", ["variables", "strings", "numbers", "booleans"]),
      moduleBlueprint("Control Flow with Conditions and Loops", ["if statements", "for loops", "while loops", "comparison operators"]),
      moduleBlueprint("Functions and Reusable Code", ["functions", "parameters", "return values", "scope"]),
      moduleBlueprint("Files, Errors, and Mini Projects", ["file handling", "exceptions", "debugging", "mini project"]),
      moduleBlueprint("Python Review and Common Mistakes", ["common mistakes", "debugging", "review", "quiz practice"]),
      moduleBlueprint("Python Applied Project Practice", ["project planning", "testing", "refactoring", "next steps"]),
      moduleBlueprint("Advanced Python Patterns", ["comprehensions", "modules", "environments", "performance"]),
    ]
    : buildGenericFallbackModules(subject, materialText);

  const goalAdjusted = adjustModulesForGoal(base, subject, settings);
  return ensureLessonCount(goalAdjusted, subject, settings.lessonCount);
}

function resolveCourseSettings({ level, duration, goal } = {}) {
  const normalizedLevel = COURSE_LEVELS.has(level) ? level : "Beginner";
  const normalizedDuration = STUDY_DURATIONS.has(duration) ? duration : "1 Month";
  const normalizedGoal = COURSE_GOALS.has(goal) ? goal : "Full Course";
  const levelProfile = LEVEL_PROFILES[normalizedLevel];
  const durationProfile = DURATION_PROFILES[normalizedDuration];
  const goalProfile = GOAL_PROFILES[normalizedGoal];
  const lessonCount = resolveLessonCount({ durationProfile, goalProfile, goal: normalizedGoal });
  const videoKeywords = uniqueStrings([
    ...levelProfile.videoIntent.split(/\s+/),
    ...durationProfile.videoIntent.split(/\s+/),
    ...goalProfile.videoIntent.split(/\s+/),
  ]);

  return {
    level: normalizedLevel,
    duration: normalizedDuration,
    goal: normalizedGoal,
    levelProfile,
    durationProfile,
    goalProfile,
    lessonCount,
    videoIntent: `${levelProfile.videoIntent} ${durationProfile.videoIntent} ${goalProfile.videoIntent}`,
    videoKeywords,
    learningOutcomes: (title) => learningOutcomesForSettings(title, normalizedLevel, normalizedDuration, normalizedGoal),
  };
}

function resolveLessonCount({ durationProfile, goalProfile, goal }) {
  if (goal === "Quick Revision") {
    return Math.max(3, Math.min(durationProfile.maxLessons, durationProfile.baseLessons + goalProfile.lessonDelta));
  }

  return Math.max(4, Math.min(durationProfile.maxLessons, durationProfile.baseLessons + goalProfile.lessonDelta));
}

function learningOutcomesForSettings(title, level, duration, goal) {
  const base = [
    `Explain the key ideas behind ${title} at a ${level.toLowerCase()} level.`,
    `Use the main concepts in ${goal.toLowerCase()} practice tasks.`,
    `Track weak topics with quizzes matched to a ${duration.toLowerCase()} plan.`,
  ];

  if (goal === "Exam Preparation") {
    return [...base, "Answer exam-style questions and review high-yield checkpoints."];
  }

  if (goal === "Quick Revision") {
    return [...base, "Recall definitions, formulas, key points, and common mistakes quickly."];
  }

  return [...base, "Build a complete understanding through lessons, quizzes, practice, and review."];
}

function lessonMinutesForSettings({ settings, index }) {
  const base = settings.goal === "Quick Revision" ? 25 : settings.goal === "Exam Preparation" ? 40 : 35;
  const progression = settings.level === "Beginner" ? Math.min(index * 3, 12) : Math.min(index * 5, 20);
  return Math.round((base + settings.levelProfile.minutesDelta + progression) * settings.durationProfile.minutesMultiplier);
}

function buildFallbackExplanation({ courseTitle, module, settings }) {
  const concepts = module.keyConcepts.slice(0, 3).join(", ");
  if (settings.level === "Beginner") {
    return `${module.title} starts from zero in ${courseTitle}. First define ${concepts}, then work through simple examples step by step before trying the quiz.`;
  }
  if (settings.level === "Advanced") {
    return `${module.title} examines ${concepts} in ${courseTitle} with deeper technical detail, tradeoffs, edge cases, and harder practice.`;
  }
  return `${module.title} is a practical lesson in ${courseTitle}. Study ${concepts}, connect them to realistic examples, then test yourself with moderate quiz questions.`;
}

function buildExamplesForSettings(module, settings) {
  const base = [`Example: apply ${module.keyConcepts[0]} in a short guided exercise.`];
  if (settings.level === "Beginner") {
    return [...base, `Step-by-step example: identify ${module.keyConcepts[1] || module.keyConcepts[0]}, use it once, then explain the result in plain language.`];
  }
  if (settings.level === "Advanced") {
    return [...base, `Advanced example: compare two approaches involving ${module.keyConcepts[0]} and explain the tradeoff.`];
  }
  return [...base, `Practical example: use ${module.keyConcepts[0]} in a realistic task and describe the decision you made.`];
}

function buildPracticeTasksForSettings(module, settings) {
  if (settings.goal === "Quick Revision") {
    return [
      `Write a concise summary of ${module.keyConcepts[0]}.`,
      `List two common mistakes involving ${module.keyConcepts[1] || module.keyConcepts[0]}.`,
    ];
  }
  if (settings.goal === "Exam Preparation") {
    return [
      `Create three exam-style questions about ${module.keyConcepts[0]}.`,
      `Review the high-yield facts and common traps for ${module.keyConcepts[1] || module.keyConcepts[0]}.`,
    ];
  }
  if (settings.level === "Advanced") {
    return [
      `Solve a harder scenario using ${module.keyConcepts[0]} and explain edge cases.`,
      `Extend the lesson with one deeper technical example.`,
    ];
  }
  return [`Create a short practice example using ${module.keyConcepts[0]}.`];
}

function normalizeExamplesForSettings({ examples, title, keyConcepts, settings }) {
  const result = stringArray(examples).slice(0, 5);
  const primary = keyConcepts[0] || title;

  if (settings.level === "Beginner") {
    while (result.length < 2) {
      result.push(`Beginner example: use ${primary} in one small step, then explain what changed in plain language.`);
    }
  } else if (settings.level === "Advanced" && result.length < 2) {
    result.push(`Advanced example: compare two approaches to ${primary} and explain the tradeoff.`);
  } else if (!result.length) {
    result.push(`Practical example: apply ${primary} in a realistic lesson task.`);
  }

  return result.slice(0, 5);
}

function normalizePracticeForSettings({ tasks, title, keyConcepts, settings }) {
  const result = stringArray(tasks).slice(0, 5);
  const primary = keyConcepts[0] || title;

  if (settings.goal === "Exam Preparation" && !result.some((task) => /exam|question|timed/i.test(task))) {
    result.push(`Answer three exam-style questions about ${primary} and explain each mistake.`);
  } else if (settings.goal === "Quick Revision" && !result.some((task) => /summary|mistake|revision/i.test(task))) {
    result.push(`Write a 5-bullet revision summary for ${primary}, including one common mistake.`);
  } else if (settings.level === "Advanced" && !result.some((task) => /advanced|edge|tradeoff|scenario/i.test(task))) {
    result.push(`Solve an advanced scenario using ${primary} and describe the tradeoffs.`);
  } else if (!result.length) {
    result.push(`Create a short practice example using ${primary}.`);
  }

  return result.slice(0, 5);
}

function buildGenericFallbackModules(subject, materialText = "") {
  const concepts = pickSpecificConcepts(subject, materialText);
  return [
    moduleBlueprint(`${subject} Orientation and First Example`, [subject, "first example", "setup", "learning goals"]),
    moduleBlueprint(`${concepts[0]} Fundamentals`, [concepts[0], "definition", "basic patterns", "common mistakes"]),
    moduleBlueprint(`${concepts[1]} with Worked Examples`, [concepts[1], "examples", "step by step", "application"]),
    moduleBlueprint(`${concepts[2]} Practice and Problem Solving`, [concepts[2], "practice", "problem solving", "feedback"]),
    moduleBlueprint(`${subject} Integration Practice`, [subject, "integration", "practice", "feedback"]),
    moduleBlueprint(`${subject} Review and Common Mistakes`, [subject, "review", "common mistakes", "checkpoint"]),
    moduleBlueprint(`${subject} Applied Project`, [subject, "project", "application", "next steps"]),
    moduleBlueprint(`${subject} Advanced Extensions`, [subject, "advanced techniques", "tradeoffs", "deeper practice"]),
  ];
}

function adjustModulesForGoal(modules, subject, settings) {
  if (settings.goal === "Quick Revision") {
    return modules.map((module) => ({
      ...module,
      title: module.title.includes("Review") ? module.title : `${module.title} Revision`,
      summary: `Quickly revise ${module.title.toLowerCase()} with key points and common mistakes.`,
      keyConcepts: uniqueStrings([...module.keyConcepts, "key points", "common mistakes"]).slice(0, 6),
    }));
  }

  if (settings.goal === "Exam Preparation") {
    return [
      ...modules.map((module) => ({
        ...module,
        summary: `Study ${module.title.toLowerCase()} through high-yield exam ideas and practice questions.`,
        keyConcepts: uniqueStrings([...module.keyConcepts, "exam traps", "high-yield review"]).slice(0, 6),
      })),
      moduleBlueprint(`${subject} Exam Strategy and Mock Review`, ["exam strategy", "mock questions", "time management", "weak topic review"]),
    ];
  }

  return modules;
}

function ensureLessonCount(modules, subject, count) {
  const result = [...modules];
  while (result.length < count) {
    result.push(moduleBlueprint(`${subject} Practice Extension ${result.length + 1}`, [subject, "practice", "extension", "review"]));
  }
  return result.slice(0, count);
}

function makeStudyPlanRows({ userId, courseId, modules, settings, now }) {
  const rows = [];

  modules.forEach((module, index) => {
    const dueOffset = dueOffsetForLesson(index, settings);
    rows.push({
      id: randomUUID(),
      user_id: userId,
      course_id: courseId,
      module_id: module.id,
      title: `Lecture ${module.position}: ${module.title}`,
      meta: studyPlanMetaForLesson(module, settings),
      kind: "lesson",
      due_date: addDays(dueOffset),
      completed: false,
      created_at: now,
    });

    const shouldAddReview = shouldAddReviewCheckpoint(index, modules.length, settings);
    if (shouldAddReview) {
      const frequency = settings.goalProfile.reviewFrequency || settings.durationProfile.reviewFrequency || 1;
      rows.push({
        id: randomUUID(),
        user_id: userId,
        course_id: courseId,
        module_id: null,
        title: `${settings.goalProfile.titlePrefix}: Lessons ${Math.max(1, index + 1 - frequency + 1)}-${index + 1}`,
        meta: reviewMetaForSettings(settings),
        kind: "review",
        due_date: addDays(dueOffset + reviewOffsetForSettings(settings)),
        completed: false,
        created_at: now,
      });
    }
  });

  if (settings.goal === "Exam Preparation" || settings.duration === "3 Months") {
    rows.push({
      id: randomUUID(),
      user_id: userId,
      course_id: courseId,
      module_id: null,
      title: settings.goal === "Exam Preparation" ? "Final mock exam review" : "Final long-form review",
      meta: settings.goal === "Exam Preparation" ? "Timed exam-style review + weak-topic cleanup" : "Cumulative review + deeper practice",
      kind: "review",
      due_date: addDays(finalReviewOffset(settings)),
      completed: false,
      created_at: now,
    });
  }

  return rows.sort((a, b) => String(a.due_date || "").localeCompare(String(b.due_date || "")));
}

function dueOffsetForLesson(index, settings) {
  const offsets = settings.durationProfile.dueOffsets;
  if (index < offsets.length) return offsets[index];
  return offsets[offsets.length - 1] + (index - offsets.length + 1) * (settings.duration === "3 Months" ? 7 : 3);
}

function shouldAddReviewCheckpoint(index, total, settings) {
  const frequency = settings.goalProfile.reviewFrequency || settings.durationProfile.reviewFrequency;
  if (!frequency) return false;
  const lessonNumber = index + 1;
  return lessonNumber < total && lessonNumber % frequency === 0;
}

function reviewOffsetForSettings(settings) {
  if (settings.duration === "1 Week") return 1;
  if (settings.duration === "3 Months") return 3;
  return 2;
}

function finalReviewOffset(settings) {
  if (settings.duration === "1 Week") return 6;
  if (settings.duration === "3 Months") return 80;
  return 27;
}

function studyPlanMetaForLesson(module, settings) {
  const purpose = settings.goal === "Quick Revision"
    ? "quick revision quiz"
    : settings.goal === "Exam Preparation"
      ? "exam-style quiz"
      : "lesson quiz";
  return `${module.estimatedMinutes} min ${settings.level.toLowerCase()} lesson + ${purpose}`;
}

function reviewMetaForSettings(settings) {
  if (settings.goal === "Exam Preparation") return "High-yield revision checkpoint + exam-style practice";
  if (settings.goal === "Quick Revision") return "Fast summary checkpoint + common mistakes";
  return "Review checkpoint + practice cleanup";
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

function buildModuleVideoSearchQuery({ courseTitle, moduleTitle, modulePosition = 1, keyConcepts = [], settings = resolveCourseSettings({}) }) {
  const normalizedModuleTitle = cleanSearchText(moduleTitle);
  const normalizedCourseTitle = cleanSearchText(courseTitle);
  const focusConcept = keyConcepts.find((concept) => cleanSearchText(concept).toLowerCase() !== normalizedModuleTitle.toLowerCase()) || "";
  const generic = GENERIC_MODULE_TITLES.has(normalizedModuleTitle.toLowerCase());
  const focus = generic && focusConcept ? `${normalizedCourseTitle} ${focusConcept}` : `${normalizedCourseTitle} ${normalizedModuleTitle}`;
  const firstLessonIntent = settings.level === "Beginner" || modulePosition <= 1 ? "introduction basics" : "";
  return cleanSearchText(`${focus} ${settings.videoIntent} ${firstLessonIntent}`);
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
