import { create } from "zustand";
import { defaultResume, defaultSectionOrder } from "../lib/resume";
import {
  ResumeData,
  ResumeFontId,
  ResumeFontSizeId,
  SectionKey,
  TemplateId
} from "../types/resume";

type AiState = {
  loading: boolean;
  action?: string;
  error?: string;
  atsSuggestions: string[];
  strengthScore: number | null;
  scoreSource: "ai" | "heuristic" | null;
  lastOutput?: string;
};

type ResumeStore = {
  resume: ResumeData;
  template: TemplateId;
  font: ResumeFontId;
  fontSize: ResumeFontSizeId;
  sectionOrder: SectionKey[];
  ai: AiState;
  setResume: (resume: ResumeData) => void;
  setTemplate: (template: TemplateId) => void;
  setFont: (font: ResumeFontId) => void;
  setFontSize: (fontSize: ResumeFontSizeId) => void;
  setSectionOrder: (order: SectionKey[]) => void;
  setAi: (partial: Partial<AiState>) => void;
  setAiLoading: (loading: boolean, action?: string) => void;
};

export const useResumeStore = create<ResumeStore>((set) => ({
  resume: defaultResume,
  template: "classic",
  font: "inter",
  fontSize: "default",
  sectionOrder: defaultSectionOrder,
  ai: {
    loading: false,
    atsSuggestions: [],
    strengthScore: null,
    scoreSource: null
  },
  setResume: (resume) => set({ resume }),
  setTemplate: (template) => set({ template }),
  setFont: (font) => set({ font }),
  setFontSize: (fontSize) => set({ fontSize }),
  setSectionOrder: (sectionOrder) => set({ sectionOrder }),
  setAi: (partial) => set((state) => ({ ai: { ...state.ai, ...partial } })),
  setAiLoading: (loading, action) => set((state) => ({ ai: { ...state.ai, loading, action } }))
}));
