import { ArrowRight, FilePlus2, FileText, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, EmptyState, PageHeading } from "../../components/platform/Ui";
import { getSavedResumes } from "./savedResumeStorage";

export function CandidateDashboardPage() {
  const resumes = getSavedResumes();
  return <>
    <PageHeading eyebrow="Candidate portal" title="Your career workspace" description="Build a polished resume, keep local versions, and prepare for your next opportunity." action={<Link to="/candidate/resume-builder" className="button button-primary"><FilePlus2 size={16} /> Open resume builder</Link>} />
    <div className="development-notice dashboard-local-notice"><ShieldCheck size={15} /> Your working draft autosaves in this browser. Save a copy to your candidate account to keep a resume synced with HireMind AI.</div>
    <div className="grid-two candidate-dashboard-grid">
      <Card>
        <div className="card-heading"><div><h2>Saved resumes</h2><p>Local versions saved on this device.</p></div><FileText size={18} color="#087e79" /></div>
        {resumes.length ? <div className="saved-preview-list">{resumes.slice(0, 3).map((record) => <div className="saved-preview-row" key={record.id}><span className="candidate-initial">{record.name.slice(0, 1).toUpperCase()}</span><span><strong>{record.name}</strong><small>Saved {new Date(record.updatedAt).toLocaleDateString()}</small></span></div>)}<Link className="text-link" to="/candidate/resumes">Manage saved resumes <ArrowRight size={14} /></Link></div> : <EmptyState title="No saved copies yet" description="Your editor autosaves the current draft locally. Save a copy when you want to keep a named version." action={<Link to="/candidate/resume-builder" className="button button-secondary">Start a resume</Link>} />}
      </Card>
      <Card>
        <div className="card-heading"><div><h2>Pick up where you left off</h2><p>Continue editing your current draft at any time.</p></div><span className="badge badge-success">Autosave on</span></div>
        <div className="candidate-action-card"><div className="empty-icon"><FilePlus2 size={22} /></div><div><strong>Resume builder</strong><p>Templates, import, photo crop, live preview, local autosave and PDF export.</p><Link className="text-link" to="/candidate/resume-builder">Continue editing <ArrowRight size={14} /></Link></div></div>
        <div className="small-divider" />
        <p className="field-help">AI writing features require the backend AI service. Provider keys are never entered or stored in this browser.</p>
      </Card>
    </div>
  </>;
}
