# CorAI MVP Setup

## 1. Supabase

1. Create a Supabase project.
2. Open the SQL editor and run `supabase/migrations/001_corai_mvp.sql`.
3. Enable Email Auth.
4. Enable Google Auth if you want the Google login button to work.
5. Add local and deployed redirect URLs in Supabase Auth settings:
   - `http://localhost:5173`
   - your Vercel production URL

## 2. Environment Variables

Copy `.env.example` to `.env.local` and fill:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
YOUTUBE_API_KEY=
APP_ORIGIN=http://localhost:5173
```

Add the same values in Vercel Project Settings.

## 3. Local Development

Use Vite for frontend-only checks. This mode does not run `/api/*`, so course generation and Ask CorAI will return 404:

```bash
npm run dev:ui
```

Use Vercel Dev for the full app with `/api/*` functions:

```bash
npm run dev:full
```

Then open `http://localhost:5173`. If port 5173 is already used by Vite, stop the old terminal first.

## 4. Demo Privacy

The app is configured for demo/non-sensitive materials while using Gemini free tier. Do not upload private or sensitive documents until you switch to a paid/private AI data handling setup.

## 5. Vercel Deployment Checks

After deploying, open this URL:

```text
https://YOUR-VERCEL-APP.vercel.app/api/health
```

Expected response:

```json
{
  "ok": true,
  "service": "corai-api"
}
```

If `/api/health` is 404:

1. Confirm the `api/` folder is committed and pushed to GitHub.
2. In Vercel Project Settings, confirm **Root Directory** is this repo root, not `dist`, `src`, or another subfolder.
3. Redeploy from Vercel after pushing the latest code.
4. Do not deploy only the `dist/` folder; Vercel needs the project source so it can build serverless functions.

If `/api/health` works but course generation fails, check the `env` booleans in the health response and add any missing variable in Vercel Project Settings.
