import { ChangeEvent } from "react";
import { Upload } from "lucide-react";
import { SectionCard } from "./SectionCard";

type ImportSectionProps = {
  loading: boolean;
  statusMessage: string;
  errorMessage: string;
  onFileSelect: (file: File) => void;
};

export const ImportSection = ({
  loading,
  statusMessage,
  errorMessage,
  onFileSelect
}: ImportSectionProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    onFileSelect(file);
  };

  return (
    <SectionCard
      title="Import from PDF, DOCX, TXT, PPT, or Image"
      description="Upload a resume file and auto-fill the sections."
      defaultOpen
    >
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <Upload className="h-4 w-4" />
          <span>Choose Resume File</span>
        </div>
        <input
          type="file"
          accept=".pdf,.docx,.txt,.ppt,.pptx,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/jpeg,image/png"
          onChange={handleChange}
          disabled={loading}
          className="mt-3 block w-full text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-300 dark:file:bg-white dark:file:text-slate-900 dark:hover:file:bg-slate-200"
        />
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Supported: PDF, DOCX, TXT, PPTX, JPG, PNG. Older PPT files should be converted to PPTX first.
        </p>
        {loading ? <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">Importing...</p> : null}
        {statusMessage ? (
          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">{statusMessage}</p>
        ) : null}
        {errorMessage ? (
          <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{errorMessage}</p>
        ) : null}
      </div>
    </SectionCard>
  );
};
