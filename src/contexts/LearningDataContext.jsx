import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../lib/apiClient";
import {
  buildModuleVideoSearchProfile,
  extractLocalFileContext,
  improveStoredModuleForCourse,
  improveStoredQuestionsForModule,
} from "../lib/localAi";
import {
  courseProgress,
  decorateCourse,
  decorateModule,
  latestAttemptForModule,
  latestAttemptForQuiz,
  normalizeArray,
} from "../lib/learningTransforms";
import { finishStoredStudySession, getStudyTimeSummary, startStoredStudySession } from "../lib/studyTime";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

const LearningDataContext = createContext(null);

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
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [state, setState] = useState(emptyState);
  const [studyTimeSummary, setStudyTimeSummary] = useState(getStudyTimeSummary(null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return undefined;
    }

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session || null);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase || !session?.user) {
      setState(emptyState);
      return emptyState;
    }

    const userId = session.user.id;
    const [
      courses,
      sources,
      modules,
      lessons,
      videos,
      quizzes,
      questions,
      attempts,
      progress,
      studyPlan,
      messages,
    ] = await Promise.all([
      selectRows("courses", userId, { order: "created_at", ascending: false }),
      selectRows("sources", userId, { order: "created_at", ascending: false }),
      selectRows("modules", userId, { order: "position", ascending: true }),
      selectRows("lessons", userId, { order: "created_at", ascending: true }),
      selectRows("videos", userId, { order: "match_score", ascending: false }),
      selectRows("quizzes", userId, { order: "created_at", ascending: true }),
      selectRows("questions", userId, { order: "position", ascending: true }),
      selectRows("attempts", userId, { order: "created_at", ascending: false }),
      selectRows("progress", userId, { order: "updated_at", ascending: false }),
      selectRows("study_plan", userId, { order: "due_date", ascending: true }),
      selectRows("messages", userId, { order: "created_at", ascending: true }),
    ]);

    const nextState = migrateState({
      courses,
      sources,
      modules,
      lessons,
      videos,
      quizzes,
      questions,
      attempts,
      progress,
      studyPlan,
      messages,
    });
    setState(nextState);
    return nextState;
  }, [session]);

  useEffect(() => {
    if (!authLoading) {
      refresh().catch((refreshError) => setError(refreshError.message));
    }
  }, [authLoading, refresh]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error: googleError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (googleError) throw googleError;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setState(emptyState);
    setStudyTimeSummary(getStudyTimeSummary(null));
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    setStudyTimeSummary(getStudyTimeSummary(userId));

    if (typeof window === "undefined") return undefined;

    const timer = window.setInterval(() => {
      setStudyTimeSummary(getStudyTimeSummary(userId));
    }, 60000);

    return () => window.clearInterval(timer);
  }, [session?.user?.id]);

  const startStudySession = useCallback(({ courseId, moduleId }) => {
    if (!session?.user) return;
    startStoredStudySession({ userId: session.user.id, courseId, moduleId });
  }, [session]);

  const finishStudySession = useCallback(({ courseId, moduleId, completedBy }) => {
    if (!session?.user) return null;

    const completedSession = finishStoredStudySession({
      userId: session.user.id,
      courseId,
      moduleId,
      completedBy,
    });
    setStudyTimeSummary(getStudyTimeSummary(session.user.id));
    return completedSession;
  }, [session]);

  const createCourse = useCallback(async (payload) => {
    setLoading(true);
    setError("");

    try {
      const files = Array.from(payload.files || []);
      const fileContexts = await Promise.all(files.map(extractLocalFileContext));
      const result = await apiRequest("/api/courses/generate", {
        topic: payload.topic || "",
        level: payload.level,
        duration: payload.duration,
        goal: payload.goal,
        fileContexts: fileContexts.map((file, index) => ({
          name: file.name,
          text: file.text,
          size: files[index]?.size || 0,
          type: files[index]?.type || "",
        })),
      });

      const uploadFailures = await uploadCourseFiles(files, result.sourceUploads || []);
      await refresh();

      return {
        courseId: result.courseId,
        fallback: result.fallback,
        message: uploadFailures.length
          ? `${result.message} Some original files could not be uploaded to storage.`
          : result.message,
      };
    } catch (createError) {
      setError(createError.message);
      throw createError;
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const updateModuleProgress = useCallback(async ({ courseId, moduleId, section = "practice", percent = 70 }) => {
    if (!supabase || !session?.user) return;
    const existing = state.progress.find((item) => item.module_id === moduleId);
    const completedSections = new Set(normalizeArray(existing?.completed_sections));
    completedSections.add(section);

    const row = {
      id: existing?.id || id(),
      user_id: session.user.id,
      course_id: courseId,
      module_id: moduleId,
      completed_sections: [...completedSections],
      percent: Math.max(existing?.percent || 0, percent),
      completed_at: percent >= 100 ? new Date().toISOString() : existing?.completed_at || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error: progressError } = await supabase
      .from("progress")
      .upsert(row, { onConflict: "user_id,module_id" })
      .select("*")
      .single();
    if (progressError) throw progressError;

    setState((current) => ({
      ...current,
      progress: [data, ...current.progress.filter((item) => item.module_id !== moduleId)],
    }));
    finishStudySession({ courseId, moduleId, completedBy: section });
  }, [finishStudySession, session, state.progress]);

  const saveQuizAttempt = useCallback(async ({ course, module, quiz, questions, answers }) => {
    if (!supabase || !session?.user) throw new Error("Sign in again to save this quiz.");

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
    const attemptRow = {
      id: id(),
      user_id: session.user.id,
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

    const { data: attempt, error: attemptError } = await supabase.from("attempts").insert(attemptRow).select("*").single();
    if (attemptError) throw attemptError;

    const existing = state.progress.find((item) => item.module_id === module.id);
    const progressRow = {
      id: existing?.id || id(),
      user_id: session.user.id,
      course_id: course.id,
      module_id: module.id,
      completed_sections: score >= 60 ? ["lesson", "practice", "quiz"] : ["lesson", "practice"],
      percent: score >= 60 ? 100 : Math.max(70, score),
      completed_at: score >= 60 ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    const { data: progressRowSaved, error: progressError } = await supabase
      .from("progress")
      .upsert(progressRow, { onConflict: "user_id,module_id" })
      .select("*")
      .single();
    if (progressError) throw progressError;

    setState((current) => ({
      ...current,
      attempts: [attempt, ...current.attempts],
      progress: [progressRowSaved, ...current.progress.filter((item) => item.module_id !== module.id)],
    }));

    finishStudySession({ courseId: course.id, moduleId: module.id, completedBy: "quiz" });

    return attempt;
  }, [finishStudySession, session, state.progress]);

  const askAi = useCallback(async ({ courseId, moduleId, message }) => {
    const result = await apiRequest("/api/ai/chat", { courseId, moduleId, message });
    setState((current) => ({
      ...current,
      messages: [...current.messages, ...(result.messages || [])],
    }));
    return { answer: result.answer };
  }, []);

  const loadVideosForModule = useCallback(async ({ course, module }) => {
    const result = await apiRequest("/api/videos/search", { courseId: course.id, moduleId: module.id });
    const videos = result.videos || [];
    const profile = buildModuleVideoSearchProfile({ course, module });

    setState((current) => ({
      ...current,
      videos: [
        ...current.videos.filter((video) => video.module_id !== module.id || video.query_signature !== profile.signature),
        ...videos,
      ],
    }));

    return { videos, cached: result.cached };
  }, []);

  const value = useMemo(() => {
    const decoratedCourses = state.courses.map((course) => decorateCourse(course, state));
    const decoratedModules = state.modules.map((module) => decorateModule(module, state));

    return {
      ...state,
      courses: decoratedCourses,
      modules: decoratedModules,
      raw: state,
      user: session?.user || null,
      session,
      isSupabaseConfigured,
      authLoading,
      loading,
      error,
      studyTimeSummary,
      weeklyStudyMinutes: studyTimeSummary.totalMinutes,
      weeklyStudyHours: studyTimeSummary.totalHours,
      refresh,
      signInWithGoogle,
      signOut,
      resetData: signOut,
      createCourse,
      startStudySession,
      finishStudySession,
      updateModuleProgress,
      saveQuizAttempt,
      askAi,
      loadVideosForModule,
      getCourse: (courseId) => decoratedCourses.find((course) => course.id === courseId),
      getModules: (courseId) => decoratedModules.filter((module) => module.course_id === courseId).sort((a, b) => a.position - b.position),
      getModule: (moduleId) => decoratedModules.find((module) => module.id === moduleId),
      getLesson: (moduleId) => state.lessons.find((lesson) => lesson.module_id === moduleId),
      getVideos: (moduleId) => {
        const module = decoratedModules.find((item) => item.id === moduleId);
        const course = module ? decoratedCourses.find((item) => item.id === module.course_id) : null;
        if (!module || !course) return [];
        const profile = buildModuleVideoSearchProfile({ course, module });
        const moduleVideos = state.videos
          .filter((video) => video.module_id === moduleId)
          .sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
        const exactVideos = moduleVideos.filter((video) => video.query_signature === profile.signature);
        return exactVideos.length ? exactVideos : moduleVideos;
      },
      getQuizForModule: (moduleId) => state.quizzes.find((quiz) => quiz.module_id === moduleId),
      getQuestions: (quizId) => state.questions.filter((question) => question.quiz_id === quizId).sort((a, b) => a.position - b.position),
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
  }, [
    askAi,
    authLoading,
    createCourse,
    error,
    loadVideosForModule,
    loading,
    refresh,
    saveQuizAttempt,
    session,
    signInWithGoogle,
    signOut,
    startStudySession,
    finishStudySession,
    state,
    studyTimeSummary,
    updateModuleProgress,
  ]);

  return <LearningDataContext.Provider value={value}>{children}</LearningDataContext.Provider>;
}

export function useLearningData() {
  const context = useContext(LearningDataContext);
  if (!context) {
    throw new Error("useLearningData must be used inside LearningDataProvider");
  }

  return context;
}

async function selectRows(table, userId, { order, ascending }) {
  let query = supabase.from(table).select("*").eq("user_id", userId);
  if (order) {
    query = query.order(order, { ascending });
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function uploadCourseFiles(files, uploadTargets) {
  if (!supabase || !files.length || !uploadTargets.length) return [];
  const failures = [];

  await Promise.all(files.map(async (file, index) => {
    const target = uploadTargets[index];
    if (!target?.storagePath) return;

    const { error } = await supabase.storage
      .from("course-materials")
      .upload(target.storagePath, file, { upsert: true });
    if (error) failures.push({ file: file.name, error });
  }));

  return failures;
}

function migrateState(state) {
  const coursesById = new Map(state.courses.map((course) => [course.id, course]));
  const modules = state.modules.map((module) => {
    const course = coursesById.get(module.course_id);
    return course ? improveStoredModuleForCourse({ course, module }) : module;
  });
  const modulesById = new Map(modules.map((module) => [module.id, module]));
  const questionsByModuleId = state.questions.reduce((groups, question) => {
    const current = groups.get(question.module_id) || [];
    current.push(question);
    groups.set(question.module_id, current);
    return groups;
  }, new Map());
  const repairedQuestionsById = new Map();

  for (const [moduleId, questions] of questionsByModuleId.entries()) {
    const module = modulesById.get(moduleId);
    const course = module ? coursesById.get(module.course_id) : null;
    if (!module || !course) continue;
    for (const question of improveStoredQuestionsForModule({ course, module, questions })) {
      repairedQuestionsById.set(question.id, question);
    }
  }

  return {
    ...state,
    modules,
    questions: state.questions.map((question) => repairedQuestionsById.get(question.id) || question),
  };
}

function id() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
