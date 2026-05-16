# CorAI Production Setup

This project is prepared for Supabase + Vercel. You still need to create the third-party projects and add their keys before publishing.

## 1. Supabase

1. Create a Supabase project.
2. Copy the Project URL to `VITE_SUPABASE_URL`.
3. Copy the anon public key to `VITE_SUPABASE_ANON_KEY`.
4. Copy the service role key to `SUPABASE_SERVICE_ROLE_KEY`.
5. Enable the Google provider in Authentication.
6. In Google Cloud, create an OAuth client.
7. Add your app URLs as Authorized JavaScript origins:

```text
http://127.0.0.1:5173
http://localhost:5173
https://your-vercel-production-url.vercel.app
```

8. Add the Supabase callback URL as an Authorized redirect URI in Google Cloud:

```text
https://your-project-ref.supabase.co/auth/v1/callback
```

9. Paste the Google OAuth client ID and secret into the Supabase Google provider settings.
10. Run `supabase/migrations/20260517000000_initial_backend.sql` in the Supabase SQL editor or through the Supabase CLI.
11. Confirm the private `course-materials` bucket exists.
12. Add redirect URLs:

```text
http://127.0.0.1:5173/*
http://localhost:5173/*
https://your-vercel-preview-url.vercel.app/*
https://your-vercel-production-url.vercel.app/*
```

## 2. Gemini

1. Create or renew a Gemini API key in Google AI Studio.
2. Add it to `.env.local` locally and Vercel in production as:

```env
GEMINI_API_KEY=
```

Do not use a `VITE_` Gemini key.

## 3. YouTube Data API

1. Open Google Cloud Console.
2. Enable **YouTube Data API v3**.
3. Create an API key.
4. Restrict the key to YouTube Data API v3.
5. Add it to `.env.local` locally and Vercel in production as:

```env
YOUTUBE_API_KEY=
```

Do not use a `VITE_` YouTube key.

## 4. Local Run

Create `.env.local`:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
YOUTUBE_API_KEY=
APP_ORIGIN=http://127.0.0.1:5173
```

Then run:

```bash
npm install
npm run dev
```

## 5. Vercel

1. Import the GitHub repo into Vercel.
2. Set build command to `npm run build`.
3. Set output directory to `dist`.
4. Add these environment variables:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
YOUTUBE_API_KEY=
APP_ORIGIN=https://your-vercel-url.vercel.app
```

5. Deploy a beta preview.
6. Add the preview URL to Supabase Auth redirects.
7. Test Google sign-in, course creation, uploads, videos, chat, quizzes, and refresh persistence.
8. Promote to production when the beta works.

## 6. Before Pushing

Run:

```bash
npm run build
git status --short --ignored
git check-ignore -v .env.local dist/
```

Do not commit `.env.local`, `dist/`, `.vercel/`, `node_modules/`, or any real API key.
