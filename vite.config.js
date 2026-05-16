import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const geminiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || "";
  const youtubeKey = env.VITE_YOUTUBE_API_KEY || env.YOUTUBE_API_KEY || "";

  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_GEMINI_API_KEY": JSON.stringify(geminiKey),
      "import.meta.env.VITE_YOUTUBE_API_KEY": JSON.stringify(youtubeKey),
    },
  };
});
