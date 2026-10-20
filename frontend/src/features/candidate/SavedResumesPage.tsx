import { useState } from "react";
import { useCallback } from "react";
import { ArrowUpRight, FileText, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "../../app/ToastContext";
import { Badge, Card, ConfirmDialog, EmptyState, ErrorState, PageHeading, Skeleton } from "../../components/platform/Ui";
import { api } from "../../api/client";
import type { ResumeDraft } from "../../api/types";
import { useApiQuery } from "../../hooks/useApiQuery";
import { useResumeStore } from "../../store/resumeStore";
import { getSavedResumes, removeSavedResume, type SavedResume } from "./savedResumeStorage";
import { applyDraftToEditor, readCandidateOwner, setActiveDraftId } from "./resumeSync";
import { defaultSectionOrder } from "../../lib/resume";

export function SavedResumesPage() {
  const [resumes, setResumes] = useState(getSavedResumes);
  const [pendingDelete, setPendingDelete] = useState<SavedResume | null>(null);
  const [pendingCloudDelete, setPendingCloudDelete] = useState<ResumeDraft | null>(null);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [owner] = useState(readCandidateOwner);
  const loadCloud = useCallback(async (signal: AbortSignal) => owner ? (await api.resumeDrafts(owner, signal)).items : [], [owner]);
  const cloudResumes = useApiQuery(loadCloud);
  const loadResumeIntoBuilder = (record: SavedResume) => {
    try {
      localStorage.setItem("irb-resume-data-v2", JSON.stringify(record.resume));
      const store = useResumeStore.getState();
      store.setResume(record.resume);
      const design = record.design ?? { template: "classic" as const, font: "inter" as const, font_size: "default" as const, section_order: defaultSectionOrder };
      store.setTemplate(design.template);
      store.setFont(design.font);
      store.setFontSize(design.font_size);
      store.setSectionOrder(design.section_order?.length ? design.section_order : defaultSectionOrder);
      localStorage.setItem("irb-resume-design-v1", JSON.stringify(design));
      setActiveDraftId(null);
      navigate("/candidate/resume-builder");
      showToast(`${record.name} loaded into the resume builder.`);
    } catch {
      showToast("Could not load this local resume. Check browser storage settings.");
    }
  };
  const confirmDelete = () => {
    if (!pendingDelete) return;
    removeSavedResume(pendingDelete.id);
    setResumes(getSavedResumes());
    setPendingDelete(null);
    showToast("Saved resume removed from this browser.");
  };
  const loadCloudResume = (record: ResumeDraft) => {
    applyDraftToEditor(record, useResumeStore.getState());
    navigate("/candidate/resume-builder");
    showToast(`${record.name} loaded from your candidate account.`);
  };
  const confirmCloudDelete = async () => {
    if (!owner || !pendingCloudDelete) return;
    try {
      await api.deleteResumeDraft(owner, pendingCloudDelete.id);
      cloudResumes.refresh();
      setPendingCloudDelete(null);
      showToast("Candidate account resume deleted.");
    } catch (error) { showToast(error instanceof Error ? error.message : "Resume could not be deleted."); }
  };

  return <>
    <PageHeading eyebrow="Candidate portal" title="Saved resumes" description="Named versions are stored on this device only. Autosave separately maintains your current working draft." action={<Link className="button button-primary" to="/candidate/resume-builder"><FileText size={16} /> Build a resume</Link>} />
    {resumes.length ? <div className="saved-resume-grid">{resumes.map((record) => <Card key={record.id} className="saved-resume-card"><div className="saved-resume-top"><span className="empty-icon"><FileText size={20} /></span><Badge tone="neutral">Local copy</Badge></div><h2>{record.name}</h2><p>Last saved {new Date(record.updatedAt).toLocaleString()}</p><p className="saved-resume-summary">{record.resume.personal.summary || "No professional summary added."}</p><div className="saved-resume-actions"><button className="button button-secondary" onClick={() => loadResumeIntoBuilder(record)}><ArrowUpRight size={15} /> Use in builder</button><button className="icon-button danger-icon" aria-label={`Delete ${record.name}`} onClick={() => setPendingDelete(record)}><Trash2 size={16} /></button></div></Card>)}</div> : <Card><EmptyState title="No saved versions" description="Open the resume builder and choose â€œSave a copyâ€ to keep a named version in this browser." action={<Link to="/candidate/resume-builder" className="button button-primary">Open resume builder</Link>} /></Card>}
    <PageHeading eyebrow="Candidate account" title="Synced resumes" description="Structured editor data stored securely on your candidate account." />
    {cloudResumes.error && <ErrorState message={cloudResumes.error} retry={cloudResumes.refresh} />}
    {cloudResumes.loading ? <Card><Skeleton lines={3} /></Card> : cloudResumes.data?.length ? <div className="saved-resume-grid">{cloudResumes.data.map((record) => <Card key={record.id} className="saved-resume-card"><div className="saved-resume-top"><span className="empty-icon"><FileText size={20} /></span><Badge tone="success">Account copy · v{record.schema_version}</Badge></div><h2>{record.name}</h2><p>Updated {new Date(record.updated_at).toLocaleString()}</p><p className="saved-resume-summary">{record.resume.personal.summary || "No professional summary added."}</p><div className="saved-resume-actions"><button className="button button-secondary" onClick={() => loadCloudResume(record)}><ArrowUpRight size={15} /> Load in builder</button><button className="icon-button danger-icon" aria-label={`Delete account resume ${record.name}`} onClick={() => setPendingCloudDelete(record)}><Trash2 size={16} /></button></div></Card>)}</div> : <Card><EmptyState title="No account-synced resumes yet" description={owner ? "Save a structured resume from the builder to keep it on your candidate account." : "Create or sign in to a candidate account, then save from the builder to sync structured resume data."} action={<Link to="/candidate/resume-builder" className="button button-primary">Open resume builder</Link>} /></Card>}
    <ConfirmDialog open={Boolean(pendingDelete)} title="Delete saved resume?" description={`${pendingDelete?.name ?? "This resume"} will be removed from this browser.`} onCancel={() => setPendingDelete(null)} onConfirm={confirmDelete} />
    <ConfirmDialog open={Boolean(pendingCloudDelete)} title="Delete server resume?" description={`${pendingCloudDelete?.name ?? "This resume"} will be deleted from the candidate profile.`} onCancel={() => setPendingCloudDelete(null)} onConfirm={() => void confirmCloudDelete()} />
  </>;
}

