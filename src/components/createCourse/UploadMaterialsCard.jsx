import { FileText, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "../ui/Button";
import { CourseOptions } from "./CourseOptions";

export function UploadMaterialsCard({ onGenerate, disabled = false }) {
  const [files, setFiles] = useState([]);
  const [options, setOptions] = useState({
    level: "Beginner",
    duration: "1 Month",
    goal: "Full Course",
  });
  const inputRef = useRef(null);

  function handleFileChange(event) {
    setFiles(Array.from(event.target.files || []));
  }

  return (
    <section className="soft-card p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lavender text-navy">
          <FileText size={21} />
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-ink">Upload Course Materials</h2>
          <p className="mt-1 text-sm font-semibold text-muted">PDF, DOCX, PPTX, TXT, slides, or notes</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.pptx,.txt,.md"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="focus-ring mt-6 flex min-h-[180px] w-full flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-divider bg-gray-50 p-6 text-center transition hover:border-navy hover:bg-white"
      >
        <UploadCloud size={32} className="text-navy" />
        <span className="mt-4 block text-base font-extrabold text-ink">Drag & drop your files here</span>
        <span className="mt-1 block text-sm font-bold text-muted">
          {files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "or Browse Files"}
        </span>
      </button>
      {files.length ? (
        <div className="mt-3 space-y-2">
          {files.map((file) => (
            <p key={`${file.name}-${file.size}`} className="rounded-2xl bg-gray-50 px-4 py-2 text-xs font-bold text-muted">
              {file.name}
            </p>
          ))}
        </div>
      ) : null}

      <div className="mt-6">
        <CourseOptions value={options} onChange={setOptions} />
      </div>

      <Button className="mt-7 w-full" onClick={() => onGenerate({ files, ...options })} disabled={disabled}>
        {disabled ? "Generating..." : "Generate Course"}
      </Button>
    </section>
  );
}
