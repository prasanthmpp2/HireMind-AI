import { useCallback } from "react";
import { callAiText } from "../lib/ai";
import {
  fallbackImportFromLinkedIn,
  fallbackTailorResume,
  fallbackTranslateResume
} from "../lib/offlineAi";
import { computeHeuristicScore } from "../lib/resume";
import { ResumeData } from "../types/resume";
import { useResumeStore } from "../store/resumeStore";

const listify = (text: string) =>
  text
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);

const normalizeSkillTokens = (text: string) =>
  text
    .split(/\n|,/g)
    .map((token) => token.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
    .map((token) => token.replace(/\.$/, ""))
    .filter(Boolean);

const extractScore = (text: string) => {
  const match = text.match(/(\d{1,3})/);
  if (!match) return null;
  const value = Number(match[1]);
  if (Number.isNaN(value)) return null;
  return Math.min(100, Math.max(0, value));
};

const extractJsonBlock = (text: string) => {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) return text.slice(first, last + 1);
  return "";
};

const normalizeResumeFromAi = (raw: unknown, base: ResumeData): ResumeData => {
  const candidate = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const source = (candidate.resume as Record<string, unknown>) || candidate;

  const asString = (value: unknown, fallback = "") => (typeof value === "string" ? value.trim() : fallback);
  const asStringArray = (value: unknown) =>
    Array.isArray(value) ? value.map((item) => asString(item)).filter(Boolean).slice(0, 30) : [];

  const normalizeList = (
    value: unknown,
    fallback: Array<Record<string, string>>,
    keys: string[]
  ) => {
    if (!Array.isArray(value) || !value.length) return fallback;
    return value
      .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : {}))
      .map((item) => {
        const mapped: Record<string, string> = {};
        keys.forEach((key) => {
          mapped[key] = asString(item[key]);
        });
        return mapped;
      });
  };

  const personalRaw = (source.personal as Record<string, unknown>) || {};
  return {
    personal: {
      name: asString(personalRaw.name, base.personal.name),
      email: asString(personalRaw.email, base.personal.email),
      phone: asString(personalRaw.phone, base.personal.phone),
      address: asString(personalRaw.address, base.personal.address),
      linkedin: asString(personalRaw.linkedin, base.personal.linkedin),
      github: asString(personalRaw.github, base.personal.github),
      photo: asString(personalRaw.photo, base.personal.photo),
      summary: asString(personalRaw.summary, base.personal.summary)
    },
    education: normalizeList(source.education, base.education, [
      "degree",
      "institution",
      "year",
      "score"
    ]) as ResumeData["education"],
    experience: normalizeList(source.experience, base.experience, [
      "company",
      "role",
      "duration",
      "description"
    ]) as ResumeData["experience"],
    projects: normalizeList(source.projects, base.projects, [
      "name",
      "link",
      "description",
      "tech"
    ]) as ResumeData["projects"],
    skills: asStringArray(source.skills),
    certifications: normalizeList(source.certifications, base.certifications, [
      "name",
      "issuer",
      "year"
    ]) as ResumeData["certifications"]
  };
};

export const useAiActions = () => {
  const { setAi, setAiLoading } = useResumeStore((state) => ({
    setAi: state.setAi,
    setAiLoading: state.setAiLoading
  }));

  const runAction = useCallback(
    async (action: string, prompt: string) => {
      setAiLoading(true, action);
      setAi({ error: undefined });
      try {
        const output = await callAiText(prompt);
        setAi({ lastOutput: output });
        return output;
      } catch (error) {
        const message = error instanceof Error ? error.message : "AI request failed.";
        setAi({ error: message });
        return null;
      } finally {
        setAiLoading(false);
      }
    },
    [setAi, setAiLoading]
  );

  const improveSummary = useCallback(
    async (summary: string) => {
      const prompt = `Improve this resume About section to be concise and impact-focused.
Return 3-4 sentences, max 120 words, no bullet points.\n${summary}`;
      return runAction("Improve About", prompt);
    },
    [runAction]
  );

  const rewriteExperience = useCallback(
    async (role: string, company: string, description: string) => {
      const prompt = `Rewrite this job description in a professional, achievement-oriented style.\nRole: ${role}\nCompany: ${company}\nDescription: ${description}`;
      return runAction("Rewrite Experience", prompt);
    },
    [runAction]
  );

  const generateBullets = useCallback(
    async (role: string, company: string) => {
      const prompt = `Generate 4 concise resume bullet points for this role with measurable impact.\nRole: ${role}\nCompany: ${company}`;
      return runAction("Generate Bullets", prompt);
    },
    [runAction]
  );

  const atsSuggestions = useCallback(
    async (resume: ResumeData) => {
      const prompt = `Provide ATS optimization suggestions as bullet points for this resume:\n${JSON.stringify(
        resume
      )}`;
      const output = await runAction("ATS Suggestions", prompt);
      return output ? listify(output) : null;
    },
    [runAction]
  );

  const grammarImprove = useCallback(
    async (content: string) => {
      const prompt = `Improve grammar and clarity without changing meaning:\n${content}`;
      return runAction("Grammar Improve", prompt);
    },
    [runAction]
  );

  const suggestSkills = useCallback(
    async (resume: ResumeData) => {
      const prompt = `Suggest 12 resume skills tailored to this candidate.
Return only skill names, one per line, no numbering.
Keep each item concise and ATS friendly.
Resume data:
${JSON.stringify(resume)}`;
      const output = await runAction("AI Skill Suggestions", prompt);
      if (!output) return null;

      const existing = new Set(resume.skills.map((skill) => skill.toLowerCase()));
      const unique: string[] = [];
      for (const token of normalizeSkillTokens(output)) {
        const normalized = token.toLowerCase();
        if (normalized.length > 40) continue;
        if (existing.has(normalized)) continue;
        if (unique.some((item) => item.toLowerCase() === normalized)) continue;
        unique.push(token);
      }
      return unique.slice(0, 12);
    },
    [runAction]
  );

  const analyzeStrength = useCallback(
    async (resume: ResumeData) => {
      const prompt = `Rate this resume from 0 to 100 for strength and ATS readiness. Reply with only a number.\n${JSON.stringify(
        resume
      )}`;
      const output = await runAction("Strength Score", prompt);
      const aiScore = output ? extractScore(output) : null;
      const heuristic = computeHeuristicScore(resume);
      if (aiScore !== null) {
        return { score: aiScore, source: "ai" as const };
      }
      return { score: heuristic, source: "heuristic" as const };
    },
    [runAction]
  );

  const tailorResume = useCallback(
    async (resume: ResumeData, role: "Software Engineer" | "Data Analyst") => {
      const prompt = `Rewrite this resume for the role "${role}" while keeping claims realistic.
Return valid JSON only with this shape:
{
  "personal": { "name":"","email":"","phone":"","address":"","linkedin":"","github":"","photo":"","summary":"" },
  "education":[{"degree":"","institution":"","year":"","score":""}],
  "experience":[{"company":"","role":"","duration":"","description":""}],
  "projects":[{"name":"","link":"","description":"","tech":""}],
  "skills":[""],
  "certifications":[{"name":"","issuer":"","year":""}]
}
Do not add extra keys.
Resume:
${JSON.stringify(resume)}`;

      const output = await runAction(`Tailor ${role}`, prompt);
      if (!output) {
        const fallback = fallbackTailorResume(resume, role);
        setAi({
          error: undefined,
          lastOutput:
            "Applied local role tailoring because AI request was unavailable (for example, unauthorized key)."
        });
        return fallback;
      }
      try {
        return normalizeResumeFromAi(JSON.parse(extractJsonBlock(output)), resume);
      } catch (_error) {
        const fallback = fallbackTailorResume(resume, role);
        setAi({
          error: undefined,
          lastOutput: "Applied local role tailoring because AI response format was invalid."
        });
        return fallback;
      }
    },
    [runAction, setAi]
  );

  const boostAchievements = useCallback(
    async (lines: string[]) => {
      if (!lines.length) return null;
      const prompt = `Rewrite each resume bullet to be stronger and metrics-focused.
For every line, include at least one measurable impact (%, $, time, users, volume) and keep it concise.
Return one bullet per line, no numbering.
Lines:
${lines.join("\n")}`;
      const output = await runAction("Achievement Booster", prompt);
      return output ? listify(output) : null;
    },
    [runAction]
  );

  const generateCoverLetter = useCallback(
    async (resume: ResumeData, jobDescription: string) => {
      const prompt = `Write a tailored cover letter from the resume and job description below.
Constraints:
- 220 to 320 words
- Professional and specific
- Mention 2 concrete achievements
- No placeholders
Resume:
${JSON.stringify(resume)}
Job Description:
${jobDescription}`;
      return runAction("Cover Letter", prompt);
    },
    [runAction]
  );

  const importFromLinkedIn = useCallback(
    async (resume: ResumeData, profileInput: string) => {
      const prompt = `Extract and map this LinkedIn profile URL/text into the resume JSON schema.
Return valid JSON only, same schema keys as below. Fill what you can and leave unknown fields as empty strings.
Schema:
{
  "personal": { "name":"","email":"","phone":"","address":"","linkedin":"","github":"","photo":"","summary":"" },
  "education":[{"degree":"","institution":"","year":"","score":""}],
  "experience":[{"company":"","role":"","duration":"","description":""}],
  "projects":[{"name":"","link":"","description":"","tech":""}],
  "skills":[""],
  "certifications":[{"name":"","issuer":"","year":""}]
}
Current resume to preserve context:
${JSON.stringify(resume)}
LinkedIn input:
${profileInput}`;
      const output = await runAction("LinkedIn Import", prompt);
      if (!output) {
        const fallback = fallbackImportFromLinkedIn(resume, profileInput);
        setAi({
          error: undefined,
          lastOutput:
            "Applied local LinkedIn import because AI request was unavailable (for example, unauthorized key)."
        });
        return fallback;
      }
      try {
        return normalizeResumeFromAi(JSON.parse(extractJsonBlock(output)), resume);
      } catch (_error) {
        const fallback = fallbackImportFromLinkedIn(resume, profileInput);
        setAi({
          error: undefined,
          lastOutput: "Applied local LinkedIn import because AI response format was invalid."
        });
        return fallback;
      }
    },
    [runAction, setAi]
  );

  const translateResume = useCallback(
    async (resume: ResumeData, language: string) => {
      const prompt = `Translate this resume into ${language}.
Return valid JSON only with the same keys and structure.
Keep links, dates, numbers, and proper nouns unchanged.
Resume:
${JSON.stringify(resume)}`;
      const output = await runAction(`Translate Resume (${language})`, prompt);
      if (!output) {
        const fallback = fallbackTranslateResume(resume, language);
        setAi({
          error: undefined,
          lastOutput:
            "Applied local translation fallback because AI request was unavailable (for example, unauthorized key)."
        });
        return fallback;
      }
      try {
        return normalizeResumeFromAi(JSON.parse(extractJsonBlock(output)), resume);
      } catch (_error) {
        const fallback = fallbackTranslateResume(resume, language);
        setAi({
          error: undefined,
          lastOutput: "Applied local translation fallback because AI response format was invalid."
        });
        return fallback;
      }
    },
    [runAction, setAi]
  );

  return {
    improveSummary,
    rewriteExperience,
    generateBullets,
    atsSuggestions,
    grammarImprove,
    suggestSkills,
    analyzeStrength,
    tailorResume,
    boostAchievements,
    generateCoverLetter,
    importFromLinkedIn,
    translateResume
  };
};
