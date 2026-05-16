import { Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { useLearningData } from "../../contexts/LearningDataContext";
import { Button } from "../ui/Button";

export function AskAIBox({ courseId, moduleId }) {
  const data = useLearningData();
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAsk() {
    if (!message.trim()) return;
    setLoading(true);
    setError("");

    try {
      const result = await data.askAi({ courseId, moduleId, message });
      setAnswer(result.answer);
      setMessage("");
    } catch (askError) {
      setError(askError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="soft-card p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lime text-navy">
          <Sparkles size={18} />
        </span>
        <h2 className="text-lg font-extrabold text-ink">Ask CorAI</h2>
      </div>
      <label className="mt-4 block">
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="focus-ring w-full rounded-2xl border border-divider bg-gray-50 px-4 py-3 text-sm font-semibold outline-none placeholder:text-muted focus:bg-white"
          placeholder="Ask about this lesson..."
        />
      </label>
      {answer ? <p className="mt-3 rounded-2xl bg-gray-50 p-3 text-sm font-semibold leading-6 text-muted">{answer}</p> : null}
      {error ? <p className="mt-3 rounded-2xl bg-[#fff0ea] p-3 text-sm font-bold text-[#d44724]">{error}</p> : null}
      <Button className="mt-3 w-full" onClick={handleAsk} disabled={loading}>
        <Send size={17} />
        {loading ? "Asking..." : "Ask"}
      </Button>
    </section>
  );
}
