import { CertificationItem, EducationItem, ExperienceItem, ProjectItem, ResumeData, SectionKey } from "../types/resume";

export const emptyEducation = (): EducationItem => ({
  degree: "",
  institution: "",
  year: "",
  score: ""
});

export const emptyExperience = (): ExperienceItem => ({
  company: "",
  role: "",
  duration: "",
  description: ""
});

export const emptyProject = (): ProjectItem => ({
  name: "",
  link: "",
  description: "",
  tech: ""
});

export const emptyCertification = (): CertificationItem => ({
  name: "",
  issuer: "",
  year: ""
});

export const defaultResume: ResumeData = {
  personal: {
    name: "",
    email: "",
    phone: "",
    address: "",
    linkedin: "",
    github: "",
    photo: "",
    summary: ""
  },
  education: [emptyEducation()],
  experience: [emptyExperience()],
  projects: [emptyProject()],
  skills: [],
  certifications: [emptyCertification()]
};

export const sectionLabels: Record<SectionKey, string> = {
  summary: "About",
  education: "Education",
  experience: "Experience",
  projects: "Projects",
  skills: "Skills",
  certifications: "Certifications"
};

export const defaultSectionOrder: SectionKey[] = [
  "summary",
  "education",
  "experience",
  "projects",
  "skills",
  "certifications"
];

export const computeCompletion = (resume: ResumeData) => {
  const checks = [
    resume.personal.name.trim(),
    resume.personal.email.trim(),
    resume.personal.phone.trim(),
    resume.personal.summary.trim(),
    resume.education.some((item) => item.degree.trim() || item.institution.trim()),
    resume.experience.some((item) => item.role.trim() || item.company.trim()),
    resume.projects.some((item) => item.name.trim()),
    resume.skills.length > 0,
    resume.certifications.some((item) => item.name.trim())
  ];

  const completed = checks.filter(Boolean).length;
  const total = checks.length;
  const percent = Math.round((completed / total) * 100);

  return { completed, total, percent };
};

export const computeHeuristicScore = (resume: ResumeData) => {
  let score = 35;
  if (resume.personal.summary.trim().length > 60) score += 10;
  if (resume.education.some((item) => item.degree.trim())) score += 10;
  if (resume.experience.some((item) => item.description.trim().length > 80)) score += 15;
  if (resume.projects.some((item) => item.description.trim().length > 40)) score += 10;
  if (resume.skills.length >= 6) score += 10;
  if (resume.certifications.some((item) => item.name.trim())) score += 10;
  return Math.min(100, score);
};

export const computeAtsSuggestions = (resume: ResumeData) => {
  const suggestions: string[] = [];
  if (!resume.personal.summary.trim()) {
    suggestions.push("Add a concise About section with key strengths and outcomes.");
  }
  if (!resume.education.some((item) => item.degree.trim() && item.institution.trim())) {
    suggestions.push("Include at least one education entry with degree and institution.");
  }
  if (!resume.experience.some((item) => item.description.trim().length > 60)) {
    suggestions.push("Expand experience descriptions with quantified impact and tools used.");
  }
  if (resume.skills.length < 6) {
    suggestions.push("Add more role-relevant skills (6-12 recommended).");
  }
  if (!resume.projects.some((item) => item.description.trim().length > 40)) {
    suggestions.push("Add at least one project with a short impact statement and tech stack.");
  }
  if (!resume.certifications.some((item) => item.name.trim())) {
    suggestions.push("Add certifications or relevant training to strengthen credibility.");
  }
  return suggestions.length ? suggestions : ["Your resume is strong. Consider tailoring keywords to each job description."];
};
