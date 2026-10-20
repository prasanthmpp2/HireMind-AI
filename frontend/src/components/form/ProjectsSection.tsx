import { Plus, Trash2 } from "lucide-react";
import { UseFormReturn, useFieldArray } from "react-hook-form";
import { ResumeData } from "../../types/resume";
import { Field } from "./Field";
import { SectionCard } from "./SectionCard";

type ProjectsSectionProps = {
  form: UseFormReturn<ResumeData>;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

export const ProjectsSection = ({ form, onAdd, onRemove }: ProjectsSectionProps) => {
  const { control, register } = form;
  const { fields } = useFieldArray({ control, name: "projects" });

  return (
    <SectionCard title="Projects" description="Showcase impactful projects and the tech stack.">
      <div className="space-y-4">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="rounded-2xl border border-slate-100 bg-white/70 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/50"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Project {index + 1}</p>
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
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <Field label="Project Name">
                <input
                  {...register(`projects.${index}.name`)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900"
                  placeholder="AI Resume Builder"
                />
              </Field>
              <Field label="Project Link">
                <input
                  {...register(`projects.${index}.link`)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900"
                  placeholder="https://github.com/..."
                />
              </Field>
              <Field label="Tech Stack">
                <input
                  {...register(`projects.${index}.tech`)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900"
                  placeholder="React, TypeScript, Tailwind"
                />
              </Field>
              <Field label="Description">
                <textarea
                  {...register(`projects.${index}.description`)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900"
                  placeholder="Describe outcomes, impact, or measurable results..."
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
          Add Project
        </button>
      </div>
    </SectionCard>
  );
};
