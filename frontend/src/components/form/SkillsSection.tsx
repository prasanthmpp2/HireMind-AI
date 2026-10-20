import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import { ResumeData } from "../../types/resume";
import { SKILL_SUGGESTIONS } from "../../data/skills";
import { SectionCard } from "./SectionCard";

type SkillsSectionProps = {
  form: UseFormReturn<ResumeData>;
};

export const SkillsSection = ({ form }: SkillsSectionProps) => {
  const [input, setInput] = useState("");
  const skills = form.watch("skills");

  const suggestions = useMemo(() => {
    if (!input) return [];
    const query = input.toLowerCase();
    return SKILL_SUGGESTIONS.filter(
      (skill) =>
        skill.toLowerCase().includes(query) &&
        !skills.some((current) => current.toLowerCase() === skill.toLowerCase())
    ).slice(0, 6);
  }, [input, skills]);

  const addSkill = (value: string) => {
    const cleaned = value.trim().replace(/,+$/, "");
    if (!cleaned) return;
    if (skills.some((skill) => skill.toLowerCase() === cleaned.toLowerCase())) return;
    form.setValue("skills", [...skills, cleaned], { shouldDirty: true, shouldTouch: true });
    setInput("");
  };

  const removeSkill = (index: number) => {
    const next = skills.filter((_, idx) => idx !== index);
    form.setValue("skills", next, { shouldDirty: true, shouldTouch: true });
  };

  return (
    <SectionCard title="Skills" description="Add the tools and strengths most relevant to the role.">
      <div className="flex flex-wrap gap-2">
        {skills.length === 0 ? (
          <span className="text-xs text-slate-400">No skills added yet.</span>
        ) : null}
        {skills.map((skill, index) => (
          <span
            key={`${skill}-${index}`}
            className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-3 py-1 text-xs font-medium text-teal-700 dark:bg-teal-500/20 dark:text-teal-200"
          >
            {skill}
            <button type="button" onClick={() => removeSkill(index)}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addSkill(input);
            }
          }}
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900"
          placeholder="Type a skill and press Enter"
        />
        <button
          type="button"
          onClick={() => addSkill(input)}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-teal-500 px-4 py-2 text-sm text-teal-600 transition hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-500/10"
        >
          <Plus className="h-4 w-4" />
          Add Skill
        </button>
      </div>
      {suggestions.length ? (
        <div className="mt-3 rounded-2xl border border-slate-100 bg-white/70 p-3 text-xs text-slate-500 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Suggestions
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((skill) => (
              <button
                type="button"
                key={skill}
                onClick={() => addSkill(skill)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-teal-400 hover:text-teal-600 dark:border-slate-600 dark:text-slate-300"
              >
                {skill}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
};
