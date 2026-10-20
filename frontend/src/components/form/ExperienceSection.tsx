import { FileText, Sparkles, Trash2, Wand2, Plus } from "lucide-react";
import { UseFormReturn, useFieldArray } from "react-hook-form";
import { ResumeData } from "../../types/resume";
import { Field } from "./Field";
import { SectionCard } from "./SectionCard";

type ExperienceSectionProps = {
  form: UseFormReturn<ResumeData>;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onRewrite: (index: number) => void;
  onBullets: (index: number) => void;
  onGrammar: (index: number) => void;
  loading: boolean;
};

export const ExperienceSection = ({
  form,
  onAdd,
  onRemove,
  onRewrite,
  onBullets,
  onGrammar,
  loading
}: ExperienceSectionProps) => {
  const { control, register } = form;
  const { fields } = useFieldArray({ control, name: "experience" });

  return (
    <SectionCard title="Work Experience" description="Highlight roles, achievements, and impact.">
      <div className="space-y-4">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="rounded-2xl border border-slate-100 bg-white/70 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/50"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Experience {index + 1}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onRewrite(index)}
                  disabled={loading}
                  className="inline-flex items-center gap-1 rounded-full border border-teal-500 px-3 py-1 text-xs text-teal-600 transition hover:bg-teal-50 disabled:opacity-60 dark:text-teal-300 dark:hover:bg-teal-500/10"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Rewrite
                </button>
                <button
                  type="button"
                  onClick={() => onBullets(index)}
                  disabled={loading}
                  className="inline-flex items-center gap-1 rounded-full border border-indigo-400 px-3 py-1 text-xs text-indigo-500 transition hover:bg-indigo-50 disabled:opacity-60 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Bullets
                </button>
                <button
                  type="button"
                  onClick={() => onGrammar(index)}
                  disabled={loading}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-400 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-500/10"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Grammar
                </button>
                {fields.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="inline-flex items-center gap-1 text-xs text-rose-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <Field label="Company">
                <input
                  {...register(`experience.${index}.company`)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900"
                  placeholder="Company name"
                />
              </Field>
              <Field label="Role">
                <input
                  {...register(`experience.${index}.role`)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900"
                  placeholder="Senior Frontend Engineer"
                />
              </Field>
              <Field label="Duration">
                <input
                  {...register(`experience.${index}.duration`)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900"
                  placeholder="Jan 2022 - Present"
                />
              </Field>
              <Field label="Description">
                <textarea
                  {...register(`experience.${index}.description`)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900"
                  placeholder="Describe responsibilities, impact, and tools..."
                />
              </Field>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-full border border-dashed border-teal-500 px-4 py-2 text-sm text-teal-600 transition hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-500/10"
        >
          <Plus className="h-4 w-4" />
          Add Experience
        </button>
      </div>
    </SectionCard>
  );
};
