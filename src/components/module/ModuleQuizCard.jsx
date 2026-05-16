import { CheckCircle2, Circle, ListChecks, RotateCcw, Trophy } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/classNames";
import { QuizQuestionCard } from "../quiz/QuizQuestionCard";
import { Button } from "../ui/Button";
import { SectionCard } from "../ui/SectionCard";

const letters = ["A", "B", "C", "D"];

export function ModuleQuizCard({ course, module, quiz, questions = [], latestAttempt, onSaveAttempt }) {
  const [mode, setMode] = useState(latestAttempt ? "result" : "preview");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [inlineAttempt, setInlineAttempt] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const attempt = inlineAttempt || latestAttempt;
  const practiceComplete = module?.progress >= 70 || Boolean(attempt);
  const answeredCount = Object.keys(answers).length;
  const topics = [...new Set(questions.map((question) => question.topic).filter(Boolean))].slice(0, 6);

  if (!quiz || !questions.length) {
    return (
      <SectionCard id="module-quiz">
        <h2 className="text-xl font-extrabold text-ink">Module Quiz</h2>
        <p className="mt-3 text-sm font-semibold text-muted">This module does not have quiz questions yet.</p>
      </SectionCard>
    );
  }

  async function handleSubmit() {
    if (answeredCount < questions.length || submitting) {
      setError("Answer every question before submitting.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const savedAttempt = await onSaveAttempt({ course, module, quiz, questions, answers });
      setInlineAttempt(savedAttempt);
      setMode("result");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleRetake() {
    setAnswers({});
    setQuestionIndex(0);
    setInlineAttempt(null);
    setError("");
    setMode("taking");
  }

  if (mode === "taking") {
    const currentQuestion = questions[questionIndex];

    return (
      <div id="module-quiz" className="space-y-4">
        <div className="rounded-[20px] bg-white px-4 py-3 text-sm font-bold text-muted shadow-card">
          {answeredCount} of {questions.length} answered
        </div>
        {error ? <p className="rounded-[20px] bg-[#fff0ea] px-4 py-3 text-sm font-bold text-[#d44724]">{error}</p> : null}
        <QuizQuestionCard
          question={currentQuestion}
          questionIndex={questionIndex}
          total={questions.length}
          selectedOption={answers[currentQuestion.id]}
          onSelect={(optionIndex) => setAnswers((value) => ({ ...value, [currentQuestion.id]: optionIndex }))}
          onPrevious={() => setQuestionIndex((value) => Math.max(0, value - 1))}
          onNext={() => setQuestionIndex((value) => Math.min(questions.length - 1, value + 1))}
          onSubmit={handleSubmit}
          canSubmit={answeredCount === questions.length && !submitting}
        />
      </div>
    );
  }

  if (mode === "result" && attempt) {
    return (
      <SectionCard id="module-quiz">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-ink">Module Quiz Result</h2>
            <p className="mt-2 text-sm font-semibold text-muted">{quiz.title}</p>
          </div>
          <span className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-lime text-navy">
            <Trophy size={24} />
          </span>
        </div>

        <div className="mt-6 rounded-[24px] bg-navy p-5 text-white">
          <p className="text-sm font-bold opacity-80">Your score</p>
          <p className="mt-2 text-5xl font-extrabold">{attempt.score}%</p>
          <p className="mt-2 text-sm font-bold opacity-80">
            {attempt.correct_count} of {attempt.total_questions} correct
          </p>
        </div>

        {attempt.weak_topics?.length ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {attempt.weak_topics.map((topic) => (
              <span key={topic} className="rounded-2xl bg-[#fff0ea] px-3 py-2 text-xs font-extrabold text-[#d44724]">
                Review: {topic}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {questions.map((question, index) => {
            const selected = attempt.answers?.[question.id];
            const correct = question.correct_option_index;
            const isCorrect = selected === correct;

            return (
              <div key={question.id} className="rounded-[20px] bg-gray-50 p-4">
                <p className="text-sm font-extrabold text-ink">
                  {index + 1}. {question.prompt}
                </p>
                <p className={cn("mt-2 flex items-center gap-2 text-sm font-bold", isCorrect ? "text-navy" : "text-[#d44724]")}>
                  {isCorrect ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                  Your answer: {selected === undefined ? "No answer" : `${letters[selected]} - ${question.options?.[selected]}`}
                </p>
                {!isCorrect ? (
                  <p className="mt-1 text-sm font-bold text-muted">
                    Correct: {letters[correct]} - {question.options?.[correct]}
                  </p>
                ) : null}
                <p className="mt-2 text-xs font-semibold leading-5 text-muted">{question.explanation}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setMode("preview")}>
            Review Module
          </Button>
          <Button variant="peach" onClick={handleRetake}>
            <RotateCcw size={17} />
            Retake Quiz
          </Button>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard id="module-quiz">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-ink">Module Quiz</h2>
          <p className="mt-2 text-sm font-semibold text-muted">{questions.length} questions on {module.title}</p>
        </div>
        <span className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-lavender text-navy">
          <ListChecks size={24} />
        </span>
      </div>

      {topics.length ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {topics.map((topic) => (
            <span key={topic} className="rounded-2xl bg-gray-100 px-3 py-2 text-xs font-extrabold text-muted">
              {topic}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-6 rounded-[20px] bg-gray-50 p-4 text-sm font-bold text-muted">
        {practiceComplete ? "Ready when you are. Your score will appear here after submission." : "Finish the practice task first, then take this quiz."}
      </div>

      <Button className="mt-5" onClick={() => setMode("taking")} disabled={!practiceComplete}>
        <ListChecks size={17} />
        Take Quiz
      </Button>
    </SectionCard>
  );
}
