import { Plus, Trash2 } from "lucide-react";
import { UseFormReturn, useFieldArray } from "react-hook-form";
import { ResumeData } from "../../types/resume";
import { Field } from "./Field";
import { SectionCard } from "./SectionCard";

type CertificationsSectionProps = {
  form: UseFormReturn<ResumeData>;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

export const CertificationsSection = ({ form, onAdd, onRemove }: CertificationsSectionProps) => {
  const { control, register } = form;
  const { fields } = useFieldArray({ control, name: "certifications" });

  return (
    <SectionCard title="Certifications" description="List certificates or training that supports your profile.">
      <div className="space-y-4">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="rounded-2xl border border-slate-100 bg-white/70 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/50"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Certification {index + 1}</p>
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
              <Field label="Certification Name">
                <input
                  {...register(`certifications.${index}.name`)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900"
                  placeholder="AWS Certified Cloud Practitioner"
                />
              </Field>
              <Field label="Issuer">
                <input
                  {...register(`certifications.${index}.issuer`)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900"
                  placeholder="Amazon Web Services"
                />
              </Field>
              <Field label="Year">
                <input
                  {...register(`certifications.${index}.year`)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900"
                  placeholder="2024"
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
          Add Certification
        </button>
      </div>
    </SectionCard>
  );
};
