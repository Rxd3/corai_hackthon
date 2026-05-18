import { requireEnv } from "./http.js";

const VIDEO_SEARCH_VERSION = "module-video-v4-settings";
const MIN_VIDEO_SECONDS = 240;
const MAX_VIDEO_SECONDS = 1500;
const BROAD_PATTERNS = [/\bfull course\b/i, /\bcomplete course\b/i, /\bcrash course\b/i, /\bmasterclass\b/i, /\bbootcamp\b/i, /\bzero to hero\b/i, /\ball[- ]?in[- ]?one\b/i, /\bplaylist\b/i, /\broadmap\b/i];
const SHORT_PATTERNS = [/\bshorts?\b/i, /#shorts?\b/i, /\byoutube shorts?\b/i];
const EDUCATIONAL_PATTERNS = [/\btutorial\b/i, /\blesson\b/i, /\bexplained\b/i, /\bintroduction\b/i, /\bbeginner/i, /\bguide\b/i];
const INTRO_PATTERNS = [/\bintro\b/i, /\bintroduction\b/i, /\bbeginner/i, /\bbasics\b/i, /\bfoundations?\b/i, /\bgetting started\b/i];
const STOP_WORDS = new Set(["a", "an", "and", "are", "as", "at", "course", "for", "from", "how", "in", "is", "lesson", "module", "of", "on", "or", "part", "the", "to", "tutorial", "with"]);
const SETTING_VIDEO_PROFILES = {
  Beginner: {
    queryTerms: "beginner friendly basics introduction explained",
    boost: [/\bbeginner/i, /\bbasics?\b/i, /\bintro/i, /\bfoundations?\b/i, /\bexplained\b/i],
    avoid: [/\badvanced\b/i, /\bdeep dive\b/i, /\bexpert\b/i],
    maxSeconds: 1500,
  },
  Intermediate: {
    queryTerms: "practical examples tutorial",
    boost: [/\bpractical\b/i, /\bexample/i, /\bproject\b/i, /\btutorial\b/i],
    avoid: [],
    maxSeconds: 1500,
  },
  Advanced: {
    queryTerms: "advanced technical in depth deep dive",
    boost: [/\badvanced\b/i, /\bin depth\b/i, /\bdeep dive\b/i, /\btechnical\b/i, /\barchitecture\b/i],
    avoid: [/\bfor beginners\b/i, /\bbasics?\b/i],
    maxSeconds: 2100,
  },
  "Exam Preparation": {
    queryTerms: "exam preparation practice questions high yield",
    boost: [/\bexam\b/i, /\bpractice questions?\b/i, /\bhigh[- ]?yield\b/i, /\btest prep\b/i, /\brevision\b/i],
    avoid: [],
    maxSeconds: 1500,
  },
  "Full Course": {
    queryTerms: "lesson tutorial examples",
    boost: [/\blesson\b/i, /\btutorial\b/i, /\bexamples?\b/i],
    avoid: [],
    maxSeconds: 1800,
  },
  "Quick Revision": {
    queryTerms: "revision summary key points common mistakes",
    boost: [/\brevision\b/i, /\bsummary\b/i, /\bkey points?\b/i, /\bcommon mistakes?\b/i, /\bcheat sheet\b/i],
    avoid: [/\bfull course\b/i, /\bcomplete course\b/i, /\bmasterclass\b/i],
    maxSeconds: 900,
  },
  "1 Week": {
    queryTerms: "essentials concise guide",
    boost: [/\bessentials?\b/i, /\bquick guide\b/i, /\bconcise\b/i],
    avoid: [],
    maxSeconds: 1200,
  },
  "1 Month": {
    queryTerms: "tutorial lesson examples",
    boost: [/\btutorial\b/i, /\blesson\b/i, /\bexamples?\b/i],
    avoid: [],
    maxSeconds: 1500,
  },
  "3 Months": {
    queryTerms: "detailed in depth tutorial",
    boost: [/\bdetailed\b/i, /\bin depth\b/i, /\bdeep dive\b/i],
    avoid: [],
    maxSeconds: 2100,
  },
};

export function buildVideoProfile({ course, module }) {
  const courseTitle = cleanCourseTitle(course?.title || course?.source_label || "course") || cleanText(course?.title || "course");
  const moduleTitle = cleanText(module?.title || "module");
  const modulePosition = clampNumber(module?.position, 1, 1, 99);
  const keyConcepts = array(module?.key_concepts).slice(0, 5);
  const settings = normalizeSettings(course);
  const settingKeywords = tokens(settings.videoIntent);
  const keywords = unique([...array(module?.video_keywords), ...keyConcepts, ...tokens(moduleTitle), ...settingKeywords]).slice(0, 12);
  const query = cleanVideoQuery(module?.video_search_query || "") || buildQuery({ courseTitle, moduleTitle, modulePosition, keyConcepts, settings });
  const signature = [
    VIDEO_SEARCH_VERSION,
    settings.level,
    settings.duration,
    settings.goal,
    query.toLowerCase(),
    moduleTitle.toLowerCase(),
    modulePosition,
    keywords.join("|").toLowerCase(),
  ].join("::");
  return { courseTitle, moduleTitle, modulePosition, keywords, query, signature, settings };
}

export async function searchYouTube(profile) {
  for (const fallbackProfile of buildSearchProfiles(profile)) {
    const durationsToSearch = fallbackProfile.settings.allowLongVideos ? ["medium", "long"] : ["medium"];
    const results = await Promise.all(durationsToSearch.map((duration) => searchYouTubeCandidates(fallbackProfile, duration)));
    const candidates = results.flat();
    const durations = await loadDurations(candidates.map((video) => video.video_id));
    const videos = uniqueVideos(candidates)
      .map((video) => {
        const duration = durations.get(video.video_id) || 0;
        return {
          ...video,
          duration_seconds: duration,
          search_query: fallbackProfile.query,
          query_signature: profile.signature,
          match_score: score(video, fallbackProfile, duration),
        };
      })
      .filter((video) => acceptable(video, fallbackProfile))
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 3)
      .map(({ description, ...video }) => video);

    if (videos.length) return videos;
  }

  return [];
}

async function searchYouTubeCandidates(profile, videoDuration) {
  const params = new URLSearchParams({
    key: requireEnv("YOUTUBE_API_KEY"),
    part: "snippet",
    q: `${profile.query} ${profile.settings.videoIntent} -shorts -playlist -masterclass -bootcamp -"full course" -"complete course" -"crash course" -"all in one"`,
    maxResults: "12",
    order: "relevance",
    relevanceLanguage: "en",
    regionCode: "US",
    type: "video",
    safeSearch: "strict",
    videoEmbeddable: "true",
    videoDuration,
  });

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || "YouTube search failed");

  return (payload.items || []).filter((item) => item.id?.videoId).map((item) => ({
    video_id: item.id.videoId,
    title: item.snippet?.title || "Recommended video",
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    thumbnail_url: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || "",
    channel_title: item.snippet?.channelTitle || "YouTube",
    description: item.snippet?.description || "",
    source: "youtube",
  }));
}

export async function buildVideoRowsForModule({ userId, course, module }) {
  const profile = buildVideoProfile({ course, module });
  const videos = await searchYouTube(profile);
  return makeVideoRows({
    userId,
    courseId: course.id,
    moduleId: module.id,
    videos,
  });
}

export function buildVideoSuggestions(profile) {
  return buildSearchProfiles(profile)
    .map((item) => item.query)
    .filter(Boolean)
    .slice(0, 5)
    .map((query) => `Search on YouTube: ${query}`);
}

export function makeVideoRows({ userId, courseId, moduleId, videos }) {
  return videos.map((video) => ({
    user_id: userId,
    course_id: courseId,
    module_id: moduleId,
    video_id: video.video_id,
    title: video.title,
    url: video.url,
    thumbnail_url: video.thumbnail_url,
    channel_title: video.channel_title,
    source: video.source,
    search_query: video.search_query,
    query_signature: video.query_signature,
    match_score: video.match_score,
    duration_seconds: video.duration_seconds,
  }));
}

async function loadDurations(videoIds) {
  const ids = [...new Set(videoIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const params = new URLSearchParams({ key: requireEnv("YOUTUBE_API_KEY"), part: "contentDetails", id: ids.join(",") });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return new Map();
  return new Map((payload.items || []).map((item) => [item.id, parseDuration(item.contentDetails?.duration)]));
}

function score(video, profile, duration) {
  const title = decodeHtml(video.title || "").toLowerCase();
  const description = decodeHtml(video.description || "").toLowerCase();
  const combined = `${title} ${description}`;
  let value = 0;
  if (title.includes(profile.moduleTitle.toLowerCase())) value += 10;
  for (const keyword of profile.keywords) {
    const normalized = keyword.toLowerCase();
    if (title.includes(normalized)) value += 4;
    if (description.includes(normalized)) value += 1;
  }
  if (EDUCATIONAL_PATTERNS.some((pattern) => pattern.test(video.title))) value += 3;
  if (profile.modulePosition <= 1 && INTRO_PATTERNS.some((pattern) => pattern.test(video.title))) value += 7;
  for (const pattern of profile.settings.boostPatterns) {
    if (pattern.test(combined)) value += 5;
  }
  for (const pattern of profile.settings.avoidPatterns) {
    if (pattern.test(combined)) value -= 10;
  }
  if (BROAD_PATTERNS.some((pattern) => pattern.test(video.title))) value -= 35;
  if (BROAD_PATTERNS.some((pattern) => pattern.test(video.description))) value -= 12;
  if (SHORT_PATTERNS.some((pattern) => pattern.test(video.title)) || SHORT_PATTERNS.some((pattern) => pattern.test(video.description))) value -= 40;
  if (duration > profile.settings.maxSeconds) value -= 35;
  if (duration > 3600) value -= 45;
  else if (duration > 2700) value -= 35;
  else if (duration > 1800) value -= 20;
  else if (duration > 0 && duration < MIN_VIDEO_SECONDS) value -= 50;
  return value;
}

function acceptable(video, profile) {
  const duration = video.duration_seconds || 0;
  const maxAllowedSeconds = profile.settings.allowLongVideos
    ? Math.max(MAX_VIDEO_SECONDS, profile.settings.maxSeconds)
    : profile.settings.maxSeconds;
  if (SHORT_PATTERNS.some((pattern) => pattern.test(video.title)) || SHORT_PATTERNS.some((pattern) => pattern.test(video.description))) return false;
  if (BROAD_PATTERNS.some((pattern) => pattern.test(video.title))) return false;
  if (duration > 0 && (duration < MIN_VIDEO_SECONDS || duration > maxAllowedSeconds)) return false;
  return true;
}

function buildQuery({ courseTitle, moduleTitle, modulePosition, keyConcepts, settings }) {
  const focusConcept = keyConcepts.find((concept) => cleanText(concept).toLowerCase() !== moduleTitle.toLowerCase()) || "";
  const generic = ["foundations", "core concepts", "worked examples", "practice", "review", "introduction", "overview", "basics"].includes(moduleTitle.toLowerCase());
  const focus = generic && focusConcept ? `${courseTitle} ${focusConcept}` : `${courseTitle} ${moduleTitle}`;
  const firstLessonIntent = modulePosition <= 1 || settings.level === "Beginner" ? "introduction basics" : "";
  return cleanText(`${focus} ${settings.videoIntent} ${firstLessonIntent}`);
}

function buildSearchProfiles(profile) {
  const primaryConcept = profile.keywords.find((keyword) => cleanText(keyword).toLowerCase() !== profile.moduleTitle.toLowerCase()) || "";
  const lessonTopic = cleanText(primaryConcept || profile.moduleTitle);
  const englishKeywords = unique(profile.keywords.flatMap((keyword) => tokens(keyword))).slice(0, 4).join(" ");
  const levelPrefix = profile.settings.level === "Intermediate" ? "" : profile.settings.level;
  const goalTerm = profile.settings.goal === "Exam Preparation"
    ? "exam questions"
    : profile.settings.goal === "Quick Revision"
      ? "quick revision summary"
      : "tutorial";
  const broadSettings = {
    ...profile.settings,
    videoIntent: "tutorial explained lesson",
    boostPatterns: [...profile.settings.boostPatterns, /\btutorial\b/i, /\bexplained\b/i],
    avoidPatterns: profile.settings.avoidPatterns,
    maxSeconds: Math.max(profile.settings.maxSeconds, 1800),
    allowLongVideos: true,
  };
  const suggestionSettings = {
    ...broadSettings,
    boostPatterns: broadSettings.boostPatterns,
    avoidPatterns: [],
  };

  return unique([
    profile.query,
    cleanText(`${levelPrefix} ${profile.moduleTitle} ${goalTerm}`),
    cleanText(`${profile.moduleTitle} tutorial`),
    cleanText(`${englishKeywords || lessonTopic} explained tutorial`),
    cleanText(`${profile.courseTitle} ${lessonTopic} explained`),
    cleanText(`${lessonTopic} summary`),
    cleanText(`${lessonTopic} ${profile.settings.goal === "Exam Preparation" ? "solved problems" : "educational lecture"}`),
  ]).map((query, index) => ({
    ...profile,
    query,
    settings: index === 0 ? profile.settings : index < 4 ? broadSettings : suggestionSettings,
  }));
}

function cleanVideoQuery(value = "") {
  return cleanText(value).replace(/\b(full|complete|crash)\s+course\b/gi, "").replace(/\b(shorts?|playlist|masterclass|bootcamp|all[- ]?in[- ]?one)\b/gi, "").replace(/\bcourse\b/gi, "").trim();
}

function normalizeSettings(course = {}) {
  const level = ["Beginner", "Intermediate", "Advanced"].includes(course.level) ? course.level : "Beginner";
  const duration = ["1 Week", "1 Month", "3 Months"].includes(course.duration) ? course.duration : "1 Month";
  const goal = ["Exam Preparation", "Full Course", "Quick Revision"].includes(course.goal) ? course.goal : "Full Course";
  const profiles = [SETTING_VIDEO_PROFILES[level], SETTING_VIDEO_PROFILES[duration], SETTING_VIDEO_PROFILES[goal]];
  const maxSeconds = Math.min(...profiles.map((profile) => profile.maxSeconds || MAX_VIDEO_SECONDS));

  return {
    level,
    duration,
    goal,
    videoIntent: profiles.map((profile) => profile.queryTerms).join(" "),
    boostPatterns: profiles.flatMap((profile) => profile.boost || []),
    avoidPatterns: profiles.flatMap((profile) => profile.avoid || []),
    maxSeconds,
    allowLongVideos: level === "Advanced" || duration === "3 Months",
  };
}

function cleanCourseTitle(value = "") {
  return cleanText(value).replace(/\b(full|complete|beginner|advanced|professional|course|tutorial|class|lesson|training|bootcamp|masterclass)\b/gi, "").trim();
}

function tokens(value = "") {
  return cleanText(value).toLowerCase().split(/\s+/).map((word) => word.replace(/[^a-z0-9+#.-]/g, "")).filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function array(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function unique(values) {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

function cleanText(value = "") {
  return String(value).replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function uniqueVideos(videos) {
  const seen = new Set();
  return videos.filter((video) => {
    if (!video.video_id || seen.has(video.video_id)) return false;
    seen.add(video.video_id);
    return true;
  });
}

function parseDuration(duration = "") {
  const match = duration.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const [, days = 0, hours = 0, minutes = 0, seconds = 0] = match;
  return Number(days) * 86400 + Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function decodeHtml(value = "") {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
