import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { generateLocalCourse, answerLocalQuestion, ensureYouTubeConfigured, searchYouTubeVideos } from "../lib/localAi";
import {
  courseProgress,
  decorateCourse,
  decorateModule,
  latestAttemptForModule,
  latestAttemptForQuiz,
  normalizeArray,
} from "../lib/learningTransforms";

const LearningDataContext = createContext(null);
const STORAGE_KEY = "corai.local.v1";
const VIDEO_FILTER_VERSION = "subject-non-shorts-v1";
const localUserId = "local-demo-user";

const emptyState = {
  courses: [],
  sources: [],
  modules: [],
  lessons: [],
  videos: [],
  quizzes: [],
  questions: [],
  attempts: [],
  progress: [],
  studyPlan: [],
  messages: [],
};

export function LearningDataProvider({ children }) {
  const [state, setState] = useState(() => loadState());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const refresh = useCallback(async () => {
    setState(loadState());
  }, []);

  const createCourse = useCallback(async (payload) => {
    setLoading(true);
    setError("");

    try {
      ensureYouTubeConfigured();
      const generated = await generateLocalCourse(payload);
      const moduleVideos = await loadGeneratedCourseVideos(generated.course);
      const nextState = buildCourseState(loadState(), generated.course, payload, generated.fileContexts, moduleVideos);
      setState(nextState);
      return {
        courseId: nextState.courses[0].id,
        fallback: generated.fallback,
        message: generated.fallback
          ? generated.error
            ? `Course created with local fallback content and YouTube videos. Gemini issue: ${generated.error}`
            : "Course created with local fallback content and YouTube videos. Add VITE_GEMINI_API_KEY for real AI generation."
          : "Course generated with Gemini and YouTube videos.",
      };
    } catch (createError) {
      setError(createError.message);
      throw createError;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateModuleProgress = useCallback(async ({ courseId, moduleId, section = "practice", percent = 70 }) => {
    setState((current) => {
      const existing = current.progress.find((item) => item.module_id === moduleId);
      const completedSections = new Set(normalizeArray(existing?.completed_sections));
      completedSections.add(section);

      const row = {
        id: existing?.id || id("progress"),
        user_id: localUserId,
        course_id: courseId,
        module_id: moduleId,
        completed_sections: [...completedSections],
        percent: Math.max(existing?.percent || 0, percent),
        completed_at: percent >= 100 ? new Date().toISOString() : existing?.completed_at || null,
        updated_at: new Date().toISOString(),
      };

      return {
        ...current,
        progress: [row, ...current.progress.filter((item) => item.module_id !== moduleId)],
      };
    });
  }, []);

  const saveQuizAttempt = useCallback(async ({ course, module, quiz, questions, answers }) => {
    const incorrectTopics = [];
    let correctCount = 0;

    for (const question of questions) {
      if (answers[question.id] === question.correct_option_index) {
        correctCount += 1;
      } else if (question.topic) {
        incorrectTopics.push(question.topic);
      }
    }

    const score = Math.round((correctCount / questions.length) * 100);
    const attempt = {
      id: id("attempt"),
      user_id: localUserId,
      course_id: course.id,
      module_id: module.id,
      quiz_id: quiz.id,
      answers,
      score,
      total_questions: questions.length,
      correct_count: correctCount,
      weak_topics: [...new Set(incorrectTopics)],
      created_at: new Date().toISOString(),
    };

    setState((current) => ({
      ...current,
      attempts: [attempt, ...current.attempts],
      progress: [
        {
          id: id("progress"),
          user_id: localUserId,
          course_id: course.id,
          module_id: module.id,
          completed_sections: score >= 60 ? ["lesson", "practice", "quiz"] : ["lesson", "practice"],
          percent: score >= 60 ? 100 : Math.max(70, score),
          completed_at: score >= 60 ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        ...current.progress.filter((item) => item.module_id !== module.id),
      ],
    }));

    return attempt;
  }, []);

  const askAi = useCallback(async ({ courseId, moduleId, message }) => {
    const current = loadState();
    const course = current.courses.find((item) => item.id === courseId);
    const module = current.modules.find((item) => item.id === moduleId);
    const lesson = current.lessons.find((item) => item.module_id === moduleId);
    const history = current.messages.filter((item) => item.course_id === courseId && (!moduleId || item.module_id === moduleId)).slice(-8);
    const answer = await answerLocalQuestion({ message, course, module, lesson, history });
    const now = new Date().toISOString();

    setState((latest) => ({
      ...latest,
      messages: [
        ...latest.messages,
        { id: id("msg"), user_id: localUserId, course_id: courseId, module_id: moduleId, role: "user", content: message, created_at: now },
        { id: id("msg"), user_id: localUserId, course_id: courseId, module_id: moduleId, role: "assistant", content: answer, created_at: now },
      ],
    }));

    return { answer };
  }, []);

  const loadVideosForModule = useCallback(async ({ course, module }) => {
    const current = loadState();
    const cached = current.videos.filter((video) => video.module_id === module.id && video.filter_version === VIDEO_FILTER_VERSION);
    if (cached.length) {
      return { videos: cached, cached: true };
    }

    const videos = await searchYouTubeVideos({ courseTitle: course.title, lessonTitle: module.title });
    const now = new Date().toISOString();
    const rows = videos.map((video) => ({
      id: id("video"),
      user_id: localUserId,
      course_id: course.id,
      module_id: module.id,
      title: video.title,
      url: video.url,
      thumbnail_url: video.thumbnail_url,
      channel_title: video.channel_title,
      source: video.source,
      filter_version: VIDEO_FILTER_VERSION,
      created_at: now,
    }));

    setState((latest) => ({
      ...latest,
      videos: [...latest.videos.filter((video) => video.module_id !== module.id), ...rows],
    }));

    return { videos: rows, cached: false };
  }, []);

  const resetData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState(emptyState);
  }, []);

  const value = useMemo(() => {
    const decoratedCourses = state.courses.map((course) => decorateCourse(course, state));
    const decoratedModules = state.modules.map((module) => decorateModule(module, state));

    return {
      ...state,
      courses: decoratedCourses,
      modules: decoratedModules,
      raw: state,
      loading,
      error,
      refresh,
      createCourse,
      updateModuleProgress,
      saveQuizAttempt,
      askAi,
      loadVideosForModule,
      resetData,
      getCourse: (courseId) => decoratedCourses.find((course) => course.id === courseId),
      getModules: (courseId) => decoratedModules.filter((module) => module.course_id === courseId),
      getModule: (moduleId) => decoratedModules.find((module) => module.id === moduleId),
      getLesson: (moduleId) => state.lessons.find((lesson) => lesson.module_id === moduleId),
      getVideos: (moduleId) => state.videos.filter((video) => video.module_id === moduleId),
      getQuizForModule: (moduleId) => state.quizzes.find((quiz) => quiz.module_id === moduleId),
      getQuestions: (quizId) => state.questions.filter((question) => question.quiz_id === quizId),
      getLatestAttemptForQuiz: (quizId) => latestAttemptForQuiz(quizId, state),
      getLatestAttemptForModule: (moduleId) => latestAttemptForModule(moduleId, state),
      getCourseProgress: (courseId) => courseProgress(courseId, state),
      getCourseWeakTopics: (courseId) => {
        const weakTopics = state.attempts
          .filter((attempt) => attempt.course_id === courseId)
          .flatMap((attempt) => normalizeArray(attempt.weak_topics));
        return [...new Set(weakTopics)].slice(0, 8);
      },
    };
  }, [askAi, createCourse, error, loadVideosForModule, loading, refresh, resetData, saveQuizAttempt, state, updateModuleProgress]);

  return <LearningDataContext.Provider value={value}>{children}</LearningDataContext.Provider>;
}

export function useLearningData() {
  const context = useContext(LearningDataContext);
  if (!context) {
    throw new Error("useLearningData must be used inside LearningDataProvider");
  }

  return context;
}

async function loadGeneratedCourseVideos(course) {
  if (!course.modules.length) {
    throw new Error("Course was not saved because no lessons were generated, so videos could not be attached.");
  }

  const moduleVideos = [];
  for (const module of course.modules) {
    const videos = await searchYouTubeVideos({ courseTitle: course.title, lessonTitle: module.title });
    if (!videos.length) {
      throw new Error(`Course was not saved because no non-Shorts YouTube lesson videos matched "${module.title}".`);
    }
    moduleVideos.push(videos);
  }

  return moduleVideos;
}

function buildCourseState(current, course, payload, fileContexts, moduleVideos = []) {
  const now = new Date().toISOString();
  const courseId = id("course");
  const courseRow = {
    id: courseId,
    user_id: localUserId,
    title: course.title,
    description: course.description,
    level: payload.level,
    duration: payload.duration,
    goal: payload.goal,
    source_type: payload.files?.length ? "file" : "topic",
    source_label: payload.topic || fileContexts.map((file) => file.name).join(", "),
    source_file: fileContexts[0]?.name || null,
    estimated_time: course.estimatedTime,
    learning_outcomes: course.learningOutcomes,
    weak_topics: [],
    card_color: ["lavender", "peach", "lime"][current.courses.length % 3],
    created_at: now,
    updated_at: now,
  };

  const modules = [];
  const lessons = [];
  const videos = [];
  const quizzes = [];
  const questions = [];
  const studyPlan = [];

  course.modules.forEach((module, index) => {
    const moduleId = id("module");
    const quizId = id("quiz");
    modules.push({
      id: moduleId,
      user_id: localUserId,
      course_id: courseId,
      position: index + 1,
      title: module.title,
      summary: module.summary,
      explanation: module.explanation,
      key_concepts: module.keyConcepts,
      examples: module.examples,
      practice_tasks: module.practiceTasks,
      estimated_minutes: module.estimatedMinutes,
      created_at: now,
      updated_at: now,
    });

    lessons.push({
      id: id("lesson"),
      user_id: localUserId,
      course_id: courseId,
      module_id: moduleId,
      content: module.explanation,
      created_at: now,
    });

    (moduleVideos[index] || []).forEach((video) => {
      videos.push({
        id: id("video"),
        user_id: localUserId,
        course_id: courseId,
        module_id: moduleId,
        title: video.title,
        url: video.url,
        thumbnail_url: video.thumbnail_url,
        channel_title: video.channel_title,
        source: video.source,
        filter_version: VIDEO_FILTER_VERSION,
        created_at: now,
      });
    });

    quizzes.push({
      id: quizId,
      user_id: localUserId,
      course_id: courseId,
      module_id: moduleId,
      title: module.quiz.title,
      created_at: now,
    });

    module.quiz.questions.forEach((question, questionIndex) => {
      questions.push({
        id: id("question"),
        user_id: localUserId,
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
      id: id("plan"),
      user_id: localUserId,
      course_id: courseId,
      module_id: moduleId,
      title: `Lesson ${index + 1}: ${module.title}`,
      meta: `${module.estimatedMinutes} min lesson + quiz`,
      kind: "lesson",
      due_date: addDays(index),
      completed: false,
      created_at: now,
    });
  });

  return {
    ...current,
    courses: [courseRow, ...current.courses],
    sources: [
      ...fileContexts.map((file) => ({
        id: id("source"),
        user_id: localUserId,
        course_id: courseId,
        kind: "file",
        file_name: file.name,
        text_excerpt: file.text.slice(0, 2000),
        created_at: now,
      })),
      ...current.sources,
    ],
    modules: [...modules, ...current.modules],
    lessons: [...lessons, ...current.lessons],
    videos: [...videos, ...current.videos],
    quizzes: [...quizzes, ...current.quizzes],
    questions: [...questions, ...current.questions],
    studyPlan: [...studyPlan, ...current.studyPlan],
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return parsed ? { ...emptyState, ...parsed } : emptyState;
  } catch {
    return emptyState;
  }
}

function id(prefix) {
  return `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
