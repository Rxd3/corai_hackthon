import { Bot, Send, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { useLearningData } from "../contexts/LearningDataContext";

const quickActions = ["Explain simpler", "Give example", "Generate flashcards", "Create practice question", "Summarize this lesson"];

export function AskAIPage() {
  const params = useParams();
  const data = useLearningData();
  const [courseId, setCourseId] = useState(params.courseId || data.courses[0]?.id || "");
  const [moduleId, setModuleId] = useState("");
  const [message, setMessage] = useState("");
  const [localAnswer, setLocalAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const modules = useMemo(() => data.modules.filter((module) => module.course_id === courseId), [courseId, data.modules]);
  const messages = data.messages.filter((item) => item.course_id === courseId && (!moduleId || item.module_id === moduleId));

  useEffect(() => {
    if (!moduleId && modules[0]) {
      setModuleId(modules[0].id);
    }
  }, [moduleId, modules]);

  useEffect(() => {
    function handleQuickAction(event) {
      setMessage(event.detail || "");
    }

    window.addEventListener("corai:quick-action", handleQuickAction);
    return () => window.removeEventListener("corai:quick-action", handleQuickAction);
  }, []);

  async function handleSend() {
    if (!message.trim()) return;

    setLoading(true);
    setError("");
    setLocalAnswer("");

    try {
      const result = await data.askAi({ courseId, moduleId, message });
      setLocalAnswer(result.answer);
      setMessage("");
    } catch (askError) {
      setError(askError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="Ask CorAI" subtitle="Get help with your course materials." />
      <section className="soft-card flex min-h-[560px] flex-col p-5 sm:p-6">
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <select
            value={courseId}
            onChange={(event) => {
              setCourseId(event.target.value);
              setModuleId("");
            }}
            className="focus-ring rounded-2xl border border-divider bg-gray-50 px-4 py-3 text-sm font-bold text-ink outline-none"
          >
            {data.courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
          <select
            value={moduleId}
            onChange={(event) => setModuleId(event.target.value)}
            className="focus-ring rounded-2xl border border-divider bg-gray-50 px-4 py-3 text-sm font-bold text-ink outline-none"
          >
            {modules.map((module) => (
              <option key={module.id} value={module.id}>
                Lesson {module.position}: {module.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto">
          {!data.courses.length ? (
            <p className="rounded-[22px] bg-gray-50 px-5 py-4 text-sm font-semibold leading-6 text-muted">
              Create a course first, then CorAI can answer questions using your course context.
            </p>
          ) : null}
          {messages.slice(-8).map((item) =>
            item.role === "user" ? (
              <div key={item.id} className="flex justify-end">
                <div className="max-w-[78%] rounded-[22px] bg-navy px-5 py-4 text-sm font-semibold leading-6 text-white">
                  {item.content}
                </div>
              </div>
            ) : (
              <AssistantBubble key={item.id} text={item.content} />
            ),
          )}
          {localAnswer ? <AssistantBubble text={localAnswer} /> : null}
          {error ? <p className="rounded-2xl bg-[#fff0ea] p-4 text-sm font-bold text-[#d44724]">{error}</p> : null}
        </div>
        <div className="mt-6 flex flex-col gap-3 rounded-[24px] bg-gray-50 p-3 sm:flex-row">
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSend();
            }}
            className="focus-ring min-h-12 flex-1 rounded-2xl bg-white px-4 text-sm font-semibold outline-none placeholder:text-muted"
            placeholder="Ask anything about your course..."
          />
          <Button onClick={handleSend} disabled={loading || !courseId}>
            <Send size={17} />
            {loading ? "Sending..." : "Send"}
          </Button>
        </div>
      </section>
    </div>
  );
}

export function AskAIRightPanel() {
  const data = useLearningData();
  const course = data.courses[0];
  const module = course ? data.modules.find((item) => item.course_id === course.id) : null;

  return (
    <>
      <section className="soft-card p-5">
        <h2 className="text-lg font-extrabold text-ink">Context Selector</h2>
        <p className="mt-4 text-sm font-bold text-muted">Ask about:</p>
        <div className="mt-3 rounded-[20px] bg-navy p-4 text-white">
          <p className="text-sm font-extrabold">{course?.title || "No course selected"}</p>
          <p className="mt-1 text-xs font-bold text-white/65">
            {module ? `Lesson ${module.position}: ${module.title}` : "Create a course to start"}
          </p>
        </div>
      </section>
      <section className="soft-card p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lavender text-navy">
            <Sparkles size={18} />
          </span>
          <h2 className="text-lg font-extrabold text-ink">Quick Actions</h2>
        </div>
        <div className="mt-5 grid gap-2">
          {quickActions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("corai:quick-action", { detail: action }))}
              className="focus-ring rounded-2xl bg-gray-50 px-4 py-3 text-left text-sm font-bold text-muted transition hover:bg-white hover:text-navy hover:shadow-card"
            >
              {action}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function AssistantBubble({ text }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-lime text-navy">
        <Bot size={18} />
      </span>
      <div className="max-w-[82%] rounded-[22px] bg-gray-50 px-5 py-4 text-sm font-semibold leading-6 text-muted">
        {text}
      </div>
    </div>
  );
}
