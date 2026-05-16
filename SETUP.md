# CorAI Local Test Setup

CorAI is now in local-first test mode. It does not require Supabase, Vercel, login, serverless functions, or database setup.

## Run Locally

```bash
npm install
npm run dev
```

Open the URL Vite prints, usually:

```text
http://127.0.0.1:5173
```

## Optional Gemini AI

To test real AI generation locally, create `.env.local`:

```bash
VITE_GEMINI_API_KEY=your_gemini_api_key
```

If you already have this from the earlier backend setup, it also works:

```bash
GEMINI_API_KEY=your_gemini_api_key
```

Then restart:

```bash
npm run dev
```

If both Gemini keys are missing or Gemini fails, the app still works with local fallback course content.

## Optional YouTube Videos

To load real lesson videos locally, add one of these to `.env.local`:

```bash
VITE_YOUTUBE_API_KEY=your_youtube_api_key
```

or, if you already have the earlier backend variable:

```bash
YOUTUBE_API_KEY=your_youtube_api_key
```

Then restart `npm run dev`. In Google Cloud, enable **YouTube Data API v3** for that key. For local browser testing, either leave the key unrestricted while testing or allow HTTP referrers for `http://127.0.0.1:5173/*` and `http://localhost:5173/*`.

## What Works Locally

- Create course from a topic.
- Upload TXT, Markdown, DOCX, and PPTX materials for local text extraction.
- Generate modules, lessons, key concepts, examples, practice tasks, and quizzes.
- Ask CorAI questions about the current course/module.
- Take quizzes, save attempts, track progress, weak topics, and study plan.
- All data is saved in browser `localStorage`.

## Current Local Limitations

- PDF text extraction is not enabled in browser-only mode.
- YouTube lookup works locally when a YouTube API key is configured.
- Do not deploy this local Gemini-key version publicly because `VITE_GEMINI_API_KEY` is exposed to the browser.

## Later: Supabase + Vercel

Once the local product flow feels good, add a backend again so API keys and uploaded files are private. The current app deliberately avoids Supabase/Vercel while you test the learning flow.
