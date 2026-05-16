import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import { cn } from "../../lib/classNames";
import { Button } from "../ui/Button";
import { SectionCard } from "../ui/SectionCard";

const letters = ["A", "B", "C", "D"];

export function QuizQuestionCard({
  question,
  questionIndex,
  total,
  selectedOption,
  onSelect,
  onSubmit,
  onPrevious,
  onNext,
  canSubmit,
}) {
  const isLastQuestion = questionIndex === total - 1;

  return (
    <SectionCard>
      <p className="text-sm font-extrabold text-muted">Question {questionIndex + 1} of {total}</p>
      <h2 className="mt-3 text-2xl font-extrabold leading-tight text-ink">{question.prompt}</h2>

      <div className="mt-6 space-y-3">
        {(question.options || []).map((option, index) => {
          const selected = selectedOption === index;
          return (
            <button
              key={`${option}-${index}`}
              type="button"
              onClick={() => onSelect(index)}
              className={cn(
                "focus-ring flex w-full items-center gap-4 rounded-[20px] border p-4 text-left transition",
                selected ? "border-navy bg-navy text-white" : "border-divider bg-gray-50 text-ink hover:bg-white",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold",
                  selected ? "bg-white text-navy" : "bg-white text-muted",
                )}
              >
                {letters[index]}
              </span>
              <span className="text-sm font-bold">{option}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-7 flex flex-wrap justify-between gap-3">
        <Button variant="outline" onClick={onPrevious} disabled={questionIndex === 0}>
          <ArrowLeft size={17} />
          Previous
        </Button>
        <div className="flex flex-wrap gap-3">
          {!isLastQuestion ? (
            <Button variant="outline" onClick={onNext}>
              Next
              <ArrowRight size={17} />
            </Button>
          ) : null}
          {isLastQuestion ? (
            <Button onClick={onSubmit} disabled={!canSubmit}>
              <Send size={17} />
              Submit Quiz
            </Button>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}
