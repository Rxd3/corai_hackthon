export const courses = [
  {
    id: "computer-networks",
    number: "01",
    title: "Computer Networks",
    source: "Generated from syllabus",
    sourceFile: "syllabus.pdf",
    progress: 54,
    modules: 12,
    quizzes: 6,
    duration: "4 weeks",
    weakTopics: ["Subnetting", "Routing Tables", "IPv4 Classes"],
    cardColor: "lavender",
    lastStudied: "Today",
  },
  {
    id: "python-data-analysis",
    number: "02",
    title: "Python for Data Analysis",
    source: "Created from topic",
    progress: 83,
    modules: 17,
    quizzes: 8,
    duration: "5 weeks",
    weakTopics: ["Pandas GroupBy", "Data Cleaning"],
    cardColor: "peach",
    lastStudied: "Yesterday",
  },
  {
    id: "ai-fundamentals",
    number: "03",
    title: "AI Fundamentals",
    source: "Beginner path",
    progress: 21,
    modules: 13,
    quizzes: 5,
    duration: "6 weeks",
    weakTopics: ["Neural Networks", "Model Evaluation"],
    cardColor: "lime",
    lastStudied: "May 12",
  },
];

export const computerNetworkModules = [
  {
    id: "networking-basics",
    number: 1,
    title: "Networking Basics",
    status: "completed",
    quizScore: "90%",
    progress: 100,
    concepts: 4,
    questions: 5,
    time: "35 min",
  },
  {
    id: "ip-addressing",
    number: 2,
    title: "IP Addressing",
    status: "in progress",
    quizScore: "60%",
    progress: 60,
    concepts: 3,
    questions: 5,
    time: "45 min",
  },
  {
    id: "subnetting",
    number: 3,
    title: "Subnetting",
    status: "needs review",
    quizScore: "45%",
    progress: 38,
    concepts: 5,
    questions: 7,
    time: "55 min",
  },
  {
    id: "routing",
    number: 4,
    title: "Routing",
    status: "not started",
    quizScore: "-",
    progress: 0,
    concepts: 4,
    questions: 6,
    time: "50 min",
  },
  {
    id: "switching",
    number: 5,
    title: "Switching",
    status: "not started",
    quizScore: "-",
    progress: 0,
    concepts: 4,
    questions: 6,
    time: "45 min",
  },
  {
    id: "network-security",
    number: 6,
    title: "Network Security",
    status: "not started",
    quizScore: "-",
    progress: 0,
    concepts: 5,
    questions: 8,
    time: "60 min",
  },
];

export const recommendedTasks = [
  {
    type: "Take Quiz",
    title: "IP Addressing",
    course: "Computer Networks",
    date: "Today",
    color: "bg-lavender",
  },
  {
    type: "Watch Lesson",
    title: "Pandas Basics",
    course: "Python for Data Analysis",
    date: "Tomorrow",
    color: "bg-peach",
  },
  {
    type: "Review Weak Topic",
    title: "Subnetting",
    course: "Computer Networks",
    date: "Recommended",
    color: "bg-lime",
  },
];

export const studyWeek = [
  { day: "Monday", task: "Lesson 1: Networking Basics", meta: "35 min lesson" },
  { day: "Tuesday", task: "Quiz 1 + Review", meta: "Practice and feedback" },
  { day: "Wednesday", task: "Lesson 2: IP Addressing", meta: "Video lesson" },
  { day: "Thursday", task: "Practice Task", meta: "IP address exercises" },
  { day: "Friday", task: "Lesson 3: Subnetting", meta: "Needs focus" },
  { day: "Saturday", task: "Review Weak Topics", meta: "30 min review" },
  { day: "Sunday", task: "Rest / Catch up", meta: "Flexible session" },
];

export const activityBars = [
  { day: "Mon", hours: 1 },
  { day: "Tue", hours: 0 },
  { day: "Wed", hours: 2 },
  { day: "Thu", hours: 1.5 },
  { day: "Fri", hours: 0 },
  { day: "Sat", hours: 3 },
  { day: "Sun", hours: 1 },
];

export const navItems = [
  { id: "dashboard", label: "Dashboard" },
  { id: "create", label: "Create Course" },
  { id: "courses", label: "My Courses" },
  { id: "study-plan", label: "Study Plan" },
  { id: "quiz", label: "Quiz Center" },
  { id: "ask-ai", label: "Ask AI" },
  { id: "settings", label: "Settings" },
];

export const learningOutcomes = [
  "Explain basic network concepts.",
  "Understand IP addressing and subnetting.",
  "Compare routing and switching.",
  "Identify basic network security threats.",
];

export const quizQuestion = {
  title: "What is the purpose of an IP address?",
  options: [
    "To identify a device on a network",
    "To store files",
    "To increase screen brightness",
    "To install software",
  ],
};
