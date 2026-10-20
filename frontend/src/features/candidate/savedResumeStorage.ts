import type { ResumeData } from "../../types/resume";
import type { ResumeDesign } from "../../api/types";

export type SavedResume = { id: string; name: string; updatedAt: string; resume: ResumeData; design?: ResumeDesign };
const SAVED_RESUMES_KEY = "hiremind-saved-resumes-v1";
export const PROFILE_KEY = "hiremind-profile-v1";

export function getSavedResumes(): SavedResume[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SAVED_RESUMES_KEY) || "[]");
    return Array.isArray(value) ? value as SavedResume[] : [];
  } catch {
    return [];
  }
}

export function saveResume(resume: ResumeData, design: ResumeDesign): SavedResume {
  const record = { id: crypto.randomUUID(), name: resume.personal.name.trim() || "Untitled resume", updatedAt: new Date().toISOString(), resume, design };
  const records = getSavedResumes();
  localStorage.setItem(SAVED_RESUMES_KEY, JSON.stringify([record, ...records]));
  return record;
}

export function removeSavedResume(id: string) {
  localStorage.setItem(SAVED_RESUMES_KEY, JSON.stringify(getSavedResumes().filter((item) => item.id !== id)));
}
