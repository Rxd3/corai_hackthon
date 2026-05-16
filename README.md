# CorAI

CorAI is an AI course builder for students. The idea is simple: a learner can type a subject or upload class materials, and CorAI turns that input into a structured learning path with modules, explanations, key concepts, examples, practice tasks, quizzes, video lessons, progress tracking, and an AI tutor chat.

The current version is intentionally **local-first**. It is built so the product flow can be tested quickly without Supabase, Vercel, login, serverless functions, or a database. Data is stored in the browser with `localStorage`.

## What The App Does

- Creates a course from a topic or uploaded material.
- Uses Gemini locally when a Gemini API key is configured.
- Falls back to generated demo content when Gemini is not configured or fails.
- Extracts local text from TXT, Markdown, DOCX, and PPTX files.
- Creates modules with explanations, concepts, examples, practice tasks, and quizzes.
- Searches YouTube for lesson videos when a YouTube API key is configured.
- Saves quiz attempts, scores, weak topics, module progress, study plans, and AI chat history locally.
- Lets the user ask CorAI questions about the selected course/module.

## Tech Stack

- React 18
- Vite
- React Router
- Tailwind CSS
- Lucide icons
- Gemini API for local AI generation/chat
- YouTube Data API v3 for video recommendations
- `localStorage` for local persistence
- `mammoth` for DOCX text extraction
- `jszip` for PPTX text extraction

## Running Locally

Install dependencies:

```bash
npm install
```

Start the app:

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

## Environment Variables

Create `.env.local` in the project root.

For Gemini course generation and Ask CorAI:

```env
VITE_GEMINI_API_KEY=your_gemini_api_key
```

The app also accepts the older backend-style name:

```env
GEMINI_API_KEY=your_gemini_api_key
```

For YouTube video recommendations:

```env
VITE_YOUTUBE_API_KEY=your_youtube_api_key
```

or:

```env
YOUTUBE_API_KEY=your_youtube_api_key
```

After changing `.env.local`, restart `npm run dev`.

Do not deploy this local-key version publicly. Vite exposes `VITE_*` variables to the browser bundle, and this project also maps the non-`VITE_` local keys into the browser for testing convenience.

## Project Structure

```text
src/
  App.jsx                         App routes and local shell wiring
  main.jsx                        React entrypoint
  index.css                       Tailwind layers and shared visual classes

  contexts/
    LearningDataContext.jsx       Main local data store and app actions

  lib/
    localAi.js                    Gemini calls, YouTube search, local file extraction, fallback generator
    learningTransforms.js         Converts stored rows into UI-friendly course/module/progress data
    navItems.js                   Sidebar/mobile navigation config
    classNames.js                 Utility for joining CSS class strings

  pages/
    DashboardPage.jsx             Overview, stats, recommended tasks
    CreateCoursePage.jsx          Topic/file course creation flow
    MyCoursesPage.jsx             Course list/search/filter
    CourseDetailsPage.jsx         Course overview, outcomes, roadmap, module cards
    ModuleLessonPage.jsx          Lesson content, YouTube video, practice, module AI box
    QuizPage.jsx                  Quiz answering and scoring
    QuizResultPage.jsx            Attempt result and weak topics
    ProgressTrackingPage.jsx      Progress table, weak topics, activity chart
    StudyPlanPage.jsx             Local generated study schedule
    AskAIPage.jsx                 Course/module scoped AI chat
    SettingsPage.jsx              Settings placeholder/cards

  components/
    layout/                       Sidebar, top bar, mobile nav, app shell
    ui/                           Shared buttons, cards, headers, progress/status components
    dashboard/                    Dashboard-specific cards
    createCourse/                 Upload/topic input/options components
    course/                       Course header, roadmap, outcomes, module cards
    module/                       Lesson, examples, practice, video, AI box
    quiz/                         Quiz question/result cards
    progress/                     Progress overview/table/charts
```

## Data Flow

1. `CreateCoursePage` collects topic, files, level, duration, and goal.
2. `LearningDataContext.createCourse()` calls `generateLocalCourse()` from `localAi.js`.
3. `localAi.js` extracts text from supported files and calls Gemini if a key exists.
4. If Gemini succeeds, its JSON response becomes the course. If not, a fallback course is created.
5. `LearningDataContext` converts the generated course into local records: courses, modules, lessons, quizzes, questions, and study plan items.
6. The records are saved to `localStorage` under `corai.local.v1`.
7. Pages read from `LearningDataContext` and transform records for display.

## AI And Video Behavior

Gemini is used for:

- Course generation
- Lesson/module structure
- Quiz generation
- Ask CorAI chat answers

YouTube Data API is used for:

- Searching videos by course title and module title
- Caching found videos in localStorage per module

If Gemini or YouTube are not configured, the app still runs. Gemini falls back to local generated content. YouTube shows a setup/status message.

## Local Limitations

- PDF text extraction is not enabled in browser-only mode.
- There is no real user account system in the current local-first version.
- Data is only saved in the current browser.
- API keys used in this mode are exposed to the browser and should only be used for local testing.

## Future Backend Direction

When the product flow is stable, the next production step is to move sensitive work back to a backend:

- Auth and private user data with Supabase.
- File storage in Supabase Storage.
- Server-side Gemini calls so API keys are not exposed.
- Server-side YouTube lookup and caching.
- Postgres tables for courses, modules, quizzes, progress, chat history, and uploaded material chunks.
- Vector search/RAG for Ask CorAI over uploaded documents.

This local version is the fast product-validation layer before that backend work.
