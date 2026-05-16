import { Bot, Chrome, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/ui/Button";
import { useLearningData } from "../contexts/LearningDataContext";

export function AuthPage() {
  const { signInWithGoogle, isSupabaseConfigured } = useLearningData();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setError("");

    if (!isSupabaseConfigured) {
      setError("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }

    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (authError) {
      setError(authError.message);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-shell px-4 py-8 text-ink">
      <section className="w-full max-w-md rounded-[32px] bg-white p-7 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy text-lime">
            <Bot size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-navy">CorAI</h1>
            <p className="text-sm font-bold text-muted">Sign in to your learning workspace.</p>
          </div>
        </div>

        <div className="mt-7 rounded-[24px] bg-gray-50 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lime text-navy">
              <Sparkles size={18} />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-ink">Continue With Google</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-muted">
                Use your Google account to create a private CorAI workspace.
              </p>
            </div>
          </div>

          <Button className="mt-5 w-full" onClick={handleGoogleSignIn} disabled={loading || !isSupabaseConfigured}>
            <Chrome size={18} />
            {loading ? "Opening Google..." : "Continue with Google"}
          </Button>
        </div>

        {!isSupabaseConfigured ? (
          <p className="mt-5 rounded-2xl bg-[#fff0ea] p-4 text-sm font-bold leading-6 text-[#d44724]">
            Supabase is not configured yet. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then redeploy.
          </p>
        ) : null}
        {error ? <p className="mt-5 rounded-2xl bg-[#fff0ea] p-4 text-sm font-bold leading-6 text-[#d44724]">{error}</p> : null}

        <div className="mt-5 flex gap-3 rounded-[22px] border border-divider p-4">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-navy" />
          <p className="text-xs font-bold leading-5 text-muted">
            Google handles the sign-in screen. CorAI uses the returned session to keep courses, files, quizzes, and chats private.
          </p>
        </div>
      </section>
    </main>
  );
}
