# CorAI

CorAI is an AI course builder that turns a topic or uploaded materials into a private, structured learning path with lectures, explanations, practice tasks, embedded quizzes, YouTube recommendations, progress tracking, study plans, and lecture-specific AI chat.

The app is now prepared for a production-style Vercel + Supabase deployment. The UI says **lectures**; internal database and route names still use `modules` in places for compatibility.

## Current Status

- React/Vite frontend.
- Google sign-in through Supabase OAuth.
- Supabase Postgres persistence instead of browser-only `localStorage`.
- Supabase Row Level Security so each user can access only their own data.
- Private Supabase Storage bucket for uploaded course materials.
- Vercel serverless API routes for Gemini, YouTube, and course generation.
- Gemini and YouTube keys are server-only and must not use `VITE_` names.
- `.env.local`, `dist/`, `.vercel/`, and `node_modules/` are ignored and should not be pushed.

## Features

- Continue with Google and sign out.
- Create a course from uploaded TXT, Markdown, DOCX, PPTX, or a typed topic.
- Choose course level, study duration, and goal.
- Generate sequential lectures with real course structure.
- Generate module/lecture-specific explanations, examples, practice tasks, and quizzes.
- Recommend lecture-specific YouTube videos while filtering Shorts, playlists, broad full courses, and overly long videos.
- Take quizzes inside the lecture page after practice is complete.
- Show inline quiz scores, explanations, weak topics, retake, and review actions.
- Ask CorAI about the current lecture directly under the Short Explanation section.
- Render AI replies with paragraphs, bullets, and bold markdown.
- Keep old quiz URLs as compatibility redirects/fallbacks.

## Tech Stack

- React 18
- Vite
- React Router
- Tailwind CSS
- Lucide icons
- Supabase Auth, Postgres, Storage
- Vercel serverless functions under `api/`
- Gemini API
- YouTube Data API v3
- `mammoth` for DOCX text extraction
- `jszip` for PPTX text extraction

## Local Development

Install dependencies:

```bash
npm install
```

Create `.env.local` from `.env.example`:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
YOUTUBE_API_KEY=
APP_ORIGIN=http://127.0.0.1:5173
```

Run the app:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

Build:

```bash
npm run build
```

## Supabase Setup

1. Create a Supabase project.
2. Copy the Project URL into `VITE_SUPABASE_URL`.
3. Copy the anon public key into `VITE_SUPABASE_ANON_KEY`.
4. Copy the service role key into `SUPABASE_SERVICE_ROLE_KEY`.
5. Enable the Google provider in Supabase Authentication.
6. In Google Cloud, create an OAuth client for this app.
7. Add your app URLs as Authorized JavaScript origins, for example:

```text
http://127.0.0.1:5173
http://localhost:5173
https://your-vercel-production-url.vercel.app
```

8. Add the Supabase Auth callback as an Authorized redirect URI in Google Cloud:

```text
https://your-project-ref.supabase.co/auth/v1/callback
```

9. Paste the Google OAuth client ID and secret into the Supabase Google provider settings.
10. Run the SQL migration in `supabase/migrations/20260517000000_initial_backend.sql`.
11. Confirm the private Storage bucket `course-materials` exists. The migration creates it.
12. Add Supabase Auth redirect URLs:

```text
http://127.0.0.1:5173/*
http://localhost:5173/*
https://your-vercel-preview-url.vercel.app/*
https://your-vercel-production-url.vercel.app/*
```

## Google Gemini Setup

1. Create or renew a Gemini API key in Google AI Studio.
2. Store it only as `GEMINI_API_KEY`.
3. Do not create `VITE_GEMINI_API_KEY` for production.

## YouTube API Setup

1. In Google Cloud, enable **YouTube Data API v3**.
2. Create an API key.
3. Restrict the key to YouTube Data API v3.
4. Store it only as `YOUTUBE_API_KEY`.
5. Do not create `VITE_YOUTUBE_API_KEY` for production.

## Vercel Deployment

1. Import the GitHub repo into Vercel.
2. Set the build command:

```bash
npm run build
```

3. Set the output directory:

```text
dist
```

4. Add environment variables in Vercel:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
YOUTUBE_API_KEY=
APP_ORIGIN=https://your-vercel-url.vercel.app
```

5. Deploy a beta preview first.
6. Add the preview URL to Supabase Auth redirect URLs.
7. Test Google sign-in, course creation, videos, lecture chat, quizzes, and persistence.
8. Promote to production after testing.
9. Add a custom domain later if needed.

## Data Model

Supabase tables:

- `courses`
- `sources`
- `modules`
- `lessons`
- `videos`
- `quizzes`
- `questions`
- `attempts`
- `progress`
- `study_plan`
- `messages`

Each table includes `user_id` and has RLS policies that allow users to manage only their own rows.

Uploaded course files are stored in the private `course-materials` bucket under:

```text
{user_id}/{course_id}/{file_id}-{safe_filename}
```

## Server APIs

- `POST /api/courses/generate`
  - Requires Supabase Auth bearer token.
  - Calls Gemini server-side.
  - Creates courses, lectures/modules, lessons, quizzes, questions, sources, and study plan rows.
  - Returns `{ courseId }` and file upload targets.

- `POST /api/ai/chat`
  - Requires auth.
  - Loads course and lecture context from Supabase.
  - Calls Gemini server-side.
  - Saves user and assistant messages.

- `POST /api/videos/search`
  - Requires auth.
  - Loads lecture-specific video search data.
  - Calls YouTube server-side.
  - Filters and ranks videos.
  - Stores cached rows with `query_signature`.

## Git And Secret Safety

- Do not commit `.env.local`.
- Do not commit `dist/`.
- Do not push real API keys, Supabase service role keys, screenshots containing keys, or logs containing keys.
- Use only these public browser variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Keep these server-only:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `GEMINI_API_KEY`
  - `YOUTUBE_API_KEY`

Useful checks before pushing:

```bash
git status --short --ignored
git check-ignore -v .env.local dist/
npm run build
```

## Production Test Checklist

- Google sign-in, sign out, and route protection.
- User A cannot read User B courses, attempts, messages, progress, or files.
- Topic-based course creation works.
- TXT, Markdown, DOCX, and PPTX uploads work.
- Gemini failure creates fallback course content instead of crashing.
- Lecture videos load through `/api/videos/search`.
- Shorts and broad full-course videos are avoided when better lecture-specific videos exist.
- Lecture chat calls `/api/ai/chat`.
- AI replies render bold text and bullets correctly.
- Quiz submit appears only on the last question.
- Quiz results show inline and persist after refresh.
- Progress and study plan data persist after refresh.
- Built assets do not contain server-only keys.
