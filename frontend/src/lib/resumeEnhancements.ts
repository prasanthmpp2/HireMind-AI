import { ResumeData } from "../types/resume";

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "your",
  "you",
  "are",
  "our",
  "will",
  "have",
  "has",
  "into",
  "using",
  "use",
  "across",
  "about",
  "job",
  "role",
  "team",
  "work",
  "years",
  "year",
  "experience",
  "ability",
  "skills",
  "skill",
  "responsible",
  "requirements"
]);

const encodeBase64Utf8 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const decodeBase64Utf8 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
};

const cleanToken = (token: string) => token.toLowerCase().replace(/[^a-z0-9+#./-]/g, "").trim();

const splitTokens = (text: string) =>
  text
    .split(/\s+/)
    .map(cleanToken)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));

const resumeCorpus = (resume: ResumeData) => {
  const experience = resume.experience.map((entry) => `${entry.role} ${entry.company} ${entry.description}`).join(" ");
  const projects = resume.projects.map((item) => `${item.name} ${item.description} ${item.tech}`).join(" ");
  const education = resume.education.map((item) => `${item.degree} ${item.institution}`).join(" ");
  return [
    resume.personal.summary,
    resume.skills.join(" "),
    experience,
    projects,
    education,
    resume.certifications.map((item) => `${item.name} ${item.issuer}`).join(" ")
  ].join(" ");
};

const topKeywords = (text: string, limit = 24) => {
  const counts = new Map<string, number>();
  for (const token of splitTokens(text)) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token]) => token);
};

export type JobMatchResult = {
  score: number;
  matchedKeywords: string[];
  missingSkills: string[];
  suggestedEdits: string[];
};

export const computeJobMatch = (resume: ResumeData, jobDescription: string): JobMatchResult => {
  const jdKeywords = topKeywords(jobDescription);
  if (!jdKeywords.length) {
    return {
      score: 0,
      matchedKeywords: [],
      missingSkills: [],
      suggestedEdits: ["Paste a fuller job description to generate a keyword match."]
    };
  }

  const resumeTokens = new Set(splitTokens(resumeCorpus(resume)));
  const matchedKeywords = jdKeywords.filter((keyword) => resumeTokens.has(keyword));
  const missingSkills = jdKeywords.filter((keyword) => !resumeTokens.has(keyword)).slice(0, 10);
  const score = Math.round((matchedKeywords.length / jdKeywords.length) * 100);

  const suggestedEdits = [
    missingSkills.length
      ? `Add missing keywords to skills/about: ${missingSkills.slice(0, 5).join(", ")}.`
      : "Keyword coverage looks strong; keep role phrasing consistent with the posting.",
    "Rewrite 2-3 experience bullets with measurable outcomes (%, $, time saved).",
    "Mirror the job title and top tools once in summary and once in recent experience."
  ];

  return { score, matchedKeywords, missingSkills, suggestedEdits };
};

export const buildShareResumeLink = (resume: ResumeData) => {
  if (typeof window === "undefined") return "";
  const payload = encodeBase64Utf8(JSON.stringify(resume));
  const url = new URL(window.location.href);
  url.searchParams.set("resume", payload);
  return url.toString();
};

export const parseSharedResumeFromUrl = () => {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const payload = url.searchParams.get("resume");
  if (!payload) return null;
  try {
    const decoded = decodeBase64Utf8(payload);
    return JSON.parse(decoded) as ResumeData;
  } catch (_error) {
    return null;
  }
};

export type ResumeVersion = {
  id: string;
  label: string;
  createdAt: string;
  resume: ResumeData;
};

export const buildVersionDiffSummary = (a: ResumeData, b: ResumeData) => {
  const changes: string[] = [];

  if (a.personal.summary !== b.personal.summary) changes.push("Summary changed");
  if (JSON.stringify(a.skills) !== JSON.stringify(b.skills)) changes.push("Skills updated");
  if (JSON.stringify(a.experience) !== JSON.stringify(b.experience)) changes.push("Experience updated");
  if (JSON.stringify(a.projects) !== JSON.stringify(b.projects)) changes.push("Projects updated");
  if (JSON.stringify(a.education) !== JSON.stringify(b.education)) changes.push("Education updated");
  if (JSON.stringify(a.certifications) !== JSON.stringify(b.certifications)) changes.push("Certifications updated");

  return changes.length ? changes : ["No major field changes detected"];
};
