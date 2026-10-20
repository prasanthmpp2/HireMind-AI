import { useEffect, useRef, useState } from "react";
import { defaultResume } from "../lib/resume";
import { parseSharedResumeFromUrl } from "../lib/resumeEnhancements";
import type { ResumeData } from "../types/resume";
import type { ResumeDesign } from "../api/types";
import { useIndexedDb } from "./useIndexedDb";

const STORAGE_KEY = "irb-resume-data-v2";
const DESIGN_KEY = "irb-resume-design-v1";
type PersistedEditor = { resume: ResumeData | null; design: ResumeDesign | null };

export const useResumePersistence = (
  resume: ResumeData,
  setResume: (data: ResumeData) => void,
  resetForm: (data: ResumeData) => void,
  design: ResumeDesign,
  applyDesign: (design: ResumeDesign) => void
) => {
  const { getItem, setItem } = useIndexedDb();
  const hydrationRef = useRef<Promise<PersistedEditor> | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const timerRef = useRef<number | null>(null);

  const normalize = (data: ResumeData): ResumeData => ({
    ...defaultResume,
    ...data,
    personal: { ...defaultResume.personal, ...(data.personal || {}) },
    education: data.education?.length ? data.education : defaultResume.education,
    experience: data.experience?.length ? data.experience : defaultResume.experience,
    projects: data.projects?.length ? data.projects : defaultResume.projects,
    skills: data.skills ?? defaultResume.skills,
    certifications: data.certifications?.length ? data.certifications : defaultResume.certifications
  });

  useEffect(() => {
    let active = true;
    if (!hydrationRef.current) {
      hydrationRef.current = (async () => {
        let savedResume: ResumeData | null = null;
        let savedDesign: ResumeDesign | null = null;
        const sharedResume = parseSharedResumeFromUrl();
        if (sharedResume) savedResume = normalize(sharedResume);
        try {
          const rawResume = localStorage.getItem(STORAGE_KEY);
          if (!savedResume && rawResume) savedResume = normalize(JSON.parse(rawResume) as ResumeData);
          const rawDesign = localStorage.getItem(DESIGN_KEY);
          if (rawDesign) savedDesign = JSON.parse(rawDesign) as ResumeDesign;
        } catch {
          // Ignore invalid or unavailable local storage and try IndexedDB.
        }
        if (!savedResume) {
          const indexedResume = await getItem<ResumeData>(STORAGE_KEY);
          if (indexedResume) savedResume = normalize(indexedResume);
        }
        if (!savedDesign) savedDesign = await getItem<ResumeDesign>(DESIGN_KEY);
        return { resume: savedResume, design: savedDesign };
      })();
    }
    void hydrationRef.current.then((saved) => {
      if (!active) return;
      if (saved.resume) {
        setResume(saved.resume);
        resetForm(saved.resume);
      }
      if (saved.design) applyDesign(saved.design);
      setHydrated(true);
    });
    return () => { active = false; };
  }, [applyDesign, getItem, resetForm, setResume]);

  useEffect(() => {
    if (!hydrated) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(resume));
      } catch {
        // IndexedDB remains available when local storage is full or disabled.
      }
      void setItem(STORAGE_KEY, resume);
      try { localStorage.setItem(DESIGN_KEY, JSON.stringify(design)); } catch { /* IndexedDB fallback below. */ }
      void setItem(DESIGN_KEY, design);
    }, 250);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [design, hydrated, resume, setItem]);

  return { hydrated };
};
