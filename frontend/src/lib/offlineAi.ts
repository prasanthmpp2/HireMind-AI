import { ResumeData } from "../types/resume";

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const phonePattern = /\+?\d[\d\s().-]{8,}\d/;
const linkedinPattern = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s,;|)]+/i;

const clean = (value: string, max: number) => value.trim().slice(0, max);

const asUrl = (value: string) => {
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

const pickLikelyName = (input: string) => {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);

  for (const line of lines) {
    if (emailPattern.test(line) || linkedinPattern.test(line) || phonePattern.test(line)) continue;
    if (!/^[A-Za-z][A-Za-z'.\- ]{2,60}$/.test(line)) continue;
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 5) return clean(line, 80);
  }

  return "";
};

const mergeUniqueSkills = (existing: string[], additions: string[]) => {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const skill of [...existing, ...additions]) {
    const token = skill.trim();
    if (!token) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(clean(token, 40));
    if (next.length >= 30) break;
  }

  return next;
};

const roleFocusSkills: Record<"Software Engineer" | "Data Analyst", string[]> = {
  "Software Engineer": [
    "Algorithms",
    "Data Structures",
    "REST APIs",
    "System Design",
    "TypeScript",
    "Testing",
    "CI/CD",
    "Cloud"
  ],
  "Data Analyst": [
    "SQL",
    "Data Visualization",
    "Python",
    "Statistics",
    "Dashboarding",
    "Excel",
    "A/B Testing",
    "Business Intelligence"
  ]
};

const roleSummaryPrefix: Record<"Software Engineer" | "Data Analyst", string> = {
  "Software Engineer":
    "Software Engineer focused on building reliable, scalable products with clean code and measurable delivery outcomes.",
  "Data Analyst":
    "Data Analyst focused on turning raw data into actionable insights, clear dashboards, and measurable business decisions."
};

const replaceTerms = (text: string, dictionary: Record<string, string>) => {
  const normalized = text.split(/(\b)/);
  return normalized
    .map((part) => {
      const key = part.toLowerCase();
      return dictionary[key] ?? part;
    })
    .join("");
};

const dictionaries: Record<string, Record<string, string>> = {
  spanish: {
    and: "y",
    with: "con",
    developed: "desarrollado",
    built: "construido",
    improved: "mejorado",
    reduced: "reducido",
    increased: "aumentado",
    managed: "gestionado",
    project: "proyecto",
    projects: "proyectos",
    experience: "experiencia",
    skills: "habilidades",
    engineer: "ingeniero",
    analyst: "analista",
    data: "datos",
    software: "software"
  },
  french: {
    and: "et",
    with: "avec",
    developed: "developpe",
    built: "construit",
    improved: "ameliore",
    reduced: "reduit",
    increased: "augmente",
    managed: "gere",
    project: "projet",
    projects: "projets",
    experience: "experience",
    skills: "competences",
    engineer: "ingenieur",
    analyst: "analyste",
    data: "donnees",
    software: "logiciel"
  },
  german: {
    and: "und",
    with: "mit",
    developed: "entwickelt",
    built: "gebaut",
    improved: "verbessert",
    reduced: "reduziert",
    increased: "erhoeht",
    managed: "geleitet",
    project: "projekt",
    projects: "projekte",
    experience: "erfahrung",
    skills: "faehigkeiten",
    engineer: "ingenieur",
    analyst: "analyst",
    data: "daten",
    software: "software"
  }
};

export const fallbackTailorResume = (
  resume: ResumeData,
  role: "Software Engineer" | "Data Analyst"
): ResumeData => {
  const focus = roleFocusSkills[role];
  const skills = mergeUniqueSkills(resume.skills, focus);

  const summarySource = resume.personal.summary.trim();
  const summary = summarySource
    ? `${roleSummaryPrefix[role]} ${summarySource}`.slice(0, 500)
    : roleSummaryPrefix[role].slice(0, 500);

  const experience = resume.experience.map((item) => ({
    ...item,
    role: item.role || role
  }));

  return {
    ...resume,
    personal: {
      ...resume.personal,
      summary
    },
    skills,
    experience
  };
};

export const fallbackImportFromLinkedIn = (resume: ResumeData, input: string): ResumeData => {
  const text = input.trim();
  if (!text) return resume;

  const email = clean(text.match(emailPattern)?.[0] ?? "", 120);
  const phone = clean(text.match(phonePattern)?.[0] ?? "", 20);
  const linkedin = clean(asUrl(text.match(linkedinPattern)?.[0] ?? ""), 120);
  const name = pickLikelyName(text);

  const lines = text
    .split(/\r?\n|,|\|/)
    .map((line) => line.trim())
    .filter(Boolean);

  const skillCandidates = lines
    .filter((line) => /\b(sql|python|excel|tableau|power bi|react|node|aws|java|typescript|analytics|api)\b/i.test(line))
    .map((line) => line.replace(/^skills?\s*:?\s*/i, ""));

  const summaryMatch = text.match(/(?:about|summary)\s*[:\n]+([\s\S]{20,600})/i);
  const summary = clean(summaryMatch?.[1] ?? "", 500);

  return {
    ...resume,
    personal: {
      ...resume.personal,
      name: name || resume.personal.name,
      email: email || resume.personal.email,
      phone: phone || resume.personal.phone,
      linkedin: linkedin || resume.personal.linkedin,
      summary: summary || resume.personal.summary
    },
    skills: mergeUniqueSkills(resume.skills, skillCandidates)
  };
};

export const fallbackTranslateResume = (resume: ResumeData, language: string): ResumeData => {
  const dictionary = dictionaries[language.trim().toLowerCase()];
  if (!dictionary) {
    return {
      ...resume,
      personal: {
        ...resume.personal,
        summary: `[${language}] ${resume.personal.summary}`.slice(0, 500)
      }
    };
  }

  const translate = (value: string, max: number) => clean(replaceTerms(value, dictionary), max);

  return {
    ...resume,
    personal: {
      ...resume.personal,
      summary: translate(resume.personal.summary, 500)
    },
    experience: resume.experience.map((item) => ({
      ...item,
      role: translate(item.role, 120),
      description: translate(item.description, 1200)
    })),
    projects: resume.projects.map((item) => ({
      ...item,
      description: translate(item.description, 1200),
      tech: translate(item.tech, 120)
    })),
    skills: resume.skills.map((skill) => translate(skill, 40))
  };
};
