import { Search, Youtube } from "lucide-react";
import { SectionCard } from "../ui/SectionCard";

export function VideoLessonCard({ video, moduleTitle, loading = false, status = "", suggestions = [] }) {
  const embedUrl = video?.url?.includes("watch?v=") ? video.url.replace("watch?v=", "embed/") : "";

  return (
    <SectionCard>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-extrabold text-ink">Video Lecture</h2>
        <Youtube className="text-danger" size={24} />
      </div>
      {embedUrl ? (
        <>
          <div className="mt-5 overflow-hidden rounded-[24px] bg-navy shadow-card">
            <div className="relative aspect-video">
            <iframe
              title={video.title}
              src={embedUrl}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            </div>
          </div>
          <p className="mt-4 text-sm font-semibold text-muted">
            {video.title} by {video.channel_title || "YouTube"}
          </p>
        </>
      ) : (
        <div className="mt-5 rounded-[24px] border border-divider bg-gray-50 p-5">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-lavender text-navy">
              <Search size={19} />
            </span>
            <div>
              <p className="text-sm font-extrabold text-ink">
                {loading ? "Searching YouTube for this lecture..." : status || "No exact video match found. Here are useful search suggestions for this lesson."}
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                {loading
                  ? "CorAI is trying exact and broader searches before showing suggestions."
                  : "These are search suggestions only, not fake video links."}
              </p>
            </div>
          </div>
          {!loading && suggestions.length ? (
            <div className="mt-4 grid gap-2">
              {suggestions.map((suggestion) => (
                <p key={suggestion} className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-navy shadow-sm">
                  {suggestion}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}
