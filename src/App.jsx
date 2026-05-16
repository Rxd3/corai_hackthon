import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { LearningDataProvider, useLearningData } from "./contexts/LearningDataContext";
import { pathByNavId } from "./lib/navItems";
import { AskAIPage, AskAIRightPanel } from "./pages/AskAIPage";
import { CourseDetailsPage, CourseDetailsRightPanel } from "./pages/CourseDetailsPage";
import { CreateCoursePage, CreateCourseRightPanel } from "./pages/CreateCoursePage";
import { DashboardPage, DashboardRightPanel } from "./pages/DashboardPage";
import { ModuleLessonPage, ModuleLessonRightPanel } from "./pages/ModuleLessonPage";
import { MyCoursesPage } from "./pages/MyCoursesPage";
import { ProgressRightPanel, ProgressTrackingPage } from "./pages/ProgressTrackingPage";
import { QuizPage, QuizRightPanel } from "./pages/QuizPage";
import { QuizResultPage } from "./pages/QuizResultPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StudyPlanPage, StudyPlanRightPanel } from "./pages/StudyPlanPage";

const localUser = {
  email: "local@corai.test",
  user_metadata: { full_name: "Local Tester" },
};

function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-shell px-4 text-ink">
      <div className="rounded-[28px] bg-white p-7 text-center shadow-soft">
        <p className="text-lg font-extrabold text-navy">Loading CorAI...</p>
        <p className="mt-2 text-sm font-semibold text-muted">Preparing your local learning workspace.</p>
      </div>
    </main>
  );
}

function ShellRoute({ activePage, rightPanel, children }) {
  const navigate = useNavigate();
  const { resetData } = useLearningData();

  function handleNavigate(pageId) {
    navigate(pathByNavId[pageId] || "/");
  }

  function handleReset() {
    if (window.confirm("Clear all local CorAI demo data?")) {
      resetData();
      navigate("/");
    }
  }

  return (
    <AppShell activePage={activePage} onNavigate={handleNavigate} rightPanel={rightPanel} user={localUser} onLogout={handleReset}>
      {children}
    </AppShell>
  );
}

function AppRoutes() {
  const { loading } = useLearningData();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <ShellRoute activePage="dashboard" rightPanel={<DashboardRightPanel />}>
            <DashboardPage />
          </ShellRoute>
        }
      />
      <Route
        path="/create"
        element={
          <ShellRoute activePage="create" rightPanel={<CreateCourseRightPanel />}>
            <CreateCoursePage />
          </ShellRoute>
        }
      />
      <Route
        path="/courses"
        element={
          <ShellRoute activePage="courses">
            <MyCoursesPage />
          </ShellRoute>
        }
      />
      <Route
        path="/courses/:courseId"
        element={
          <ShellRoute activePage="courses" rightPanel={<CourseDetailsRightPanel />}>
            <CourseDetailsPage />
          </ShellRoute>
        }
      />
      <Route
        path="/courses/:courseId/modules/:moduleId"
        element={
          <ShellRoute activePage="courses" rightPanel={<ModuleLessonRightPanel />}>
            <ModuleLessonPage />
          </ShellRoute>
        }
      />
      <Route
        path="/courses/:courseId/modules/:moduleId/quiz"
        element={
          <ShellRoute activePage="quiz" rightPanel={<QuizRightPanel />}>
            <QuizPage />
          </ShellRoute>
        }
      />
      <Route
        path="/quiz"
        element={
          <ShellRoute activePage="quiz" rightPanel={<QuizRightPanel />}>
            <QuizPage />
          </ShellRoute>
        }
      />
      <Route
        path="/quiz-result/:attemptId"
        element={
          <ShellRoute activePage="quiz">
            <QuizResultPage />
          </ShellRoute>
        }
      />
      <Route
        path="/progress"
        element={
          <ShellRoute activePage="courses" rightPanel={<ProgressRightPanel />}>
            <ProgressTrackingPage />
          </ShellRoute>
        }
      />
      <Route
        path="/progress/:courseId"
        element={
          <ShellRoute activePage="courses" rightPanel={<ProgressRightPanel />}>
            <ProgressTrackingPage />
          </ShellRoute>
        }
      />
      <Route
        path="/study-plan"
        element={
          <ShellRoute activePage="study-plan" rightPanel={<StudyPlanRightPanel />}>
            <StudyPlanPage />
          </ShellRoute>
        }
      />
      <Route
        path="/ask-ai"
        element={
          <ShellRoute activePage="ask-ai" rightPanel={<AskAIRightPanel />}>
            <AskAIPage />
          </ShellRoute>
        }
      />
      <Route
        path="/ask-ai/:courseId"
        element={
          <ShellRoute activePage="ask-ai" rightPanel={<AskAIRightPanel />}>
            <AskAIPage />
          </ShellRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ShellRoute activePage="settings">
            <SettingsPage />
          </ShellRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <LearningDataProvider>
      <AppRoutes />
    </LearningDataProvider>
  );
}
