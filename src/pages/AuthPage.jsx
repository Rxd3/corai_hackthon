import { Bot, LockKeyhole, Mail } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/ui/Button";
import { useLearningData } from "../contexts/LearningDataContext";

export function AuthPage() {
  const { signIn, signUp, isSupabaseConfigured } = useLearningData();
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("");
    setError("");

    if (!isSupabaseConfigured) {
      setError("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signin") {
        await signIn({ email, password });
      } else {
        await signUp({ name, email, password });
        setStatus("Account created. Check your email if confirmation is enabled, then sign in.");
        setMode("signin");
      }
    } catch (authError) {
      setError(authError.message);
    } finally {
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

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={mode === "signin" ? "rounded-xl bg-white px-3 py-2 text-sm font-extrabold text-navy shadow-sm" : "rounded-xl px-3 py-2 text-sm font-extrabold text-muted"}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={mode === "signup" ? "rounded-xl bg-white px-3 py-2 text-sm font-extrabold text-navy shadow-sm" : "rounded-xl px-3 py-2 text-sm font-extrabold text-muted"}
          >
            Sign Up
          </button>
        </div>

        {!isSupabaseConfigured ? (
          <p className="mt-5 rounded-2xl bg-[#fff0ea] p-4 text-sm font-bold leading-6 text-[#d44724]">
            Supabase is not configured yet. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.local`, then restart the dev server.
          </p>
        ) : null}
        {status ? <p className="mt-5 rounded-2xl bg-lime p-4 text-sm font-bold text-navy">{status}</p> : null}
        {error ? <p className="mt-5 rounded-2xl bg-[#fff0ea] p-4 text-sm font-bold text-[#d44724]">{error}</p> : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "signup" ? (
            <label className="block">
              <span className="mb-2 block text-sm font-extrabold text-ink">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="focus-ring min-h-12 w-full rounded-2xl border border-divider bg-gray-50 px-4 text-sm font-semibold text-ink outline-none focus:bg-white"
                placeholder="Your name"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="mb-2 block text-sm font-extrabold text-ink">Email</span>
            <span className="focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-navy flex min-h-12 items-center gap-3 rounded-2xl border border-divider bg-gray-50 px-4 focus-within:bg-white">
              <Mail size={17} className="text-muted" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
                placeholder="you@example.com"
                required
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-extrabold text-ink">Password</span>
            <span className="focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-navy flex min-h-12 items-center gap-3 rounded-2xl border border-divider bg-gray-50 px-4 focus-within:bg-white">
              <LockKeyhole size={17} className="text-muted" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
                placeholder="At least 6 characters"
                required
              />
            </span>
          </label>

          <Button type="submit" className="w-full" disabled={loading || !isSupabaseConfigured}>
            {loading ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
          </Button>
        </form>
      </section>
    </main>
  );
}
