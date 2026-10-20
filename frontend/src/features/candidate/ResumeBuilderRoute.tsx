import { useState } from "react";
import { ArrowLeft, Cloud, Save } from "lucide-react";
import { Link } from "react-router-dom";
import App from "../../App";
import { useToast } from "../../app/ToastContext";
import { useResumeStore } from "../../store/resumeStore";
import { api, ApiError } from "../../api/client";
import { saveResume } from "./savedResumeStorage";
import { activeDraftId, readCandidateOwner, saveCandidateOwner, setActiveDraftId } from "./resumeSync";

export function ResumeBuilderRoute() {
  const resume = useResumeStore((state) => state.resume);
  const template = useResumeStore((state) => state.template);
  const font = useResumeStore((state) => state.font);
  const fontSize = useResumeStore((state) => state.fontSize);
  const sectionOrder = useResumeStore((state) => state.sectionOrder);
  const { showToast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const handleSave = () => {
    try {
      saveResume(resume, { template, font, font_size: fontSize, section_order: sectionOrder });
      showToast("Resume saved in this browser.");
    } catch {
      showToast("Could not save resume. Check this browser’s storage settings.");
    }
  };
  const syncResume = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      let owner = readCandidateOwner();
      if (!owner) {
        const user = await api.session();
        if (user.role !== "candidate" || !user.candidate_id) throw new Error("Sign in with a candidate account before saving resumes.");
        owner = { candidateId: user.candidate_id };
        saveCandidateOwner(owner);
      }
      const payload = {
        name: `${resume.personal.name.trim() || "Candidate"} resume`,
        resume,
        design: { template, font, font_size: fontSize, section_order: sectionOrder }
      };
      const draftId = activeDraftId();
      let saved;
      if (draftId) {
        try { saved = await api.updateResumeDraft(owner, draftId, payload); }
        catch (error) {
          if (!(error instanceof ApiError) || error.status !== 404) throw error;
          const existing = (await api.resumeDrafts(owner)).items.some((draft) => draft.id === draftId);
          if (existing) throw error;
          saved = await api.createResumeDraft(owner, payload);
        }
      } else saved = await api.createResumeDraft(owner, payload);
      setActiveDraftId(saved.id);
      showToast("Structured resume saved to your candidate account.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Resume could not be synced.");
    } finally { setSyncing(false); }
  };

  return <>
    <div className="builder-route-bar">
      <Link className="text-link" to="/candidate/resumes"><ArrowLeft size={16} /> Saved resumes</Link>
      <div className="table-actions"><button className="button button-secondary" onClick={handleSave}><Save size={16} /> Save a copy</button><button className="button button-primary" onClick={() => void syncResume()} disabled={syncing}><Cloud size={16} /> {syncing ? "Saving…" : activeDraftId() ? "Update account copy" : "Save to account"}</button></div>
    </div>
    <div className="local-data-note">Autosave and “Save a copy” stay in this browser. “Save to account” stores structured resume facts on your authenticated candidate account using a protected session cookie.</div>
    <App />
  </>;
}
