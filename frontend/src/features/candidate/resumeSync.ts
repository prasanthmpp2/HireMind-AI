import type { CandidateOwner, ResumeDraft } from "../../api/types";
import { defaultSectionOrder } from "../../lib/resume";
import type { ResumeData, ResumeFontId, ResumeFontSizeId, SectionKey, TemplateId } from "../../types/resume";

const OWNER_KEY = "hiremind-candidate-id-v1";
const LEGACY_OWNER_KEY = "hiremind-candidate-owner-v1";
const ACTIVE_DRAFT_KEY = "hiremind-active-resume-draft-v1";
const DESIGN_KEY = "irb-resume-design-v1";

export function readCandidateOwner(): CandidateOwner | null {
  try {
    // Drop the previous long-lived bearer capability; account sessions now live
    // only in an HttpOnly cookie. A numeric profile ID is not a credential.
    localStorage.removeItem(LEGACY_OWNER_KEY);
    const candidateId = Number(localStorage.getItem(OWNER_KEY));
    return Number.isInteger(candidateId) && candidateId > 0 ? { candidateId } : null;
  } catch { return null; }
}

export function saveCandidateOwner(owner: CandidateOwner): void {
  localStorage.setItem(OWNER_KEY, String(owner.candidateId));
}

export function activeDraftId(): number | null {
  const id = Number(localStorage.getItem(ACTIVE_DRAFT_KEY));
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function setActiveDraftId(id: number | null): void {
  if (id) localStorage.setItem(ACTIVE_DRAFT_KEY, String(id));
  else localStorage.removeItem(ACTIVE_DRAFT_KEY);
}

export function applyDraftToEditor(draft: ResumeDraft, set: {
  setResume: (resume: ResumeData) => void;
  setTemplate: (template: TemplateId) => void;
  setFont: (font: ResumeFontId) => void;
  setFontSize: (fontSize: ResumeFontSizeId) => void;
  setSectionOrder: (order: SectionKey[]) => void;
}): void {
  set.setResume(draft.resume);
  set.setTemplate(draft.design.template);
  set.setFont(draft.design.font);
  set.setFontSize(draft.design.font_size);
  set.setSectionOrder(draft.design.section_order?.length ? draft.design.section_order : defaultSectionOrder);
  localStorage.setItem("irb-resume-data-v2", JSON.stringify(draft.resume));
  localStorage.setItem(DESIGN_KEY, JSON.stringify(draft.design));
  setActiveDraftId(draft.id);
}
