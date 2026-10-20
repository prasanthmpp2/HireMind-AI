import { useCallback } from "react";
import { ArrowLeft, BriefcaseBusiness, Mail, MapPin, Phone } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { Badge, Card, EmptyState, ErrorState, LoadingState, PageHeading } from "../../components/platform/Ui";
import { useApiQuery } from "../../hooks/useApiQuery";

export function CandidateDetailPage() {
  const { candidateId = "" } = useParams();
  const id = Number(candidateId);
  const load = useCallback((signal: AbortSignal) => api.candidate(id, signal), [id]);
  const candidate = useApiQuery(load);
  if (candidate.loading) return <LoadingState label="Loading candidate" />;
  if (candidate.error) return <ErrorState message={candidate.error} retry={candidate.refresh} />;
  if (!candidate.data) return <EmptyState title="Candidate not found" description="The API returned no candidate record for this route." action={<Link className="text-link" to="/recruiter/matches"><ArrowLeft size={14} /> Back to matches</Link>} />;
  const record = candidate.data;
  const resume = record.resume;
  const editorResume = record.editor_resume?.resume;
  const skillGroups = resume?.skills && !Array.isArray(resume.skills) ? Object.entries(resume.skills) : [];

  return <>
    <PageHeading eyebrow="Recruiter workspace / Candidate detail" title={record.name} description={record.summary || "No candidate summary was parsed."} action={<Link className="button button-secondary" to="/recruiter/matches"><ArrowLeft size={15} /> Back to matches</Link>} />
    <div className="grid-two detail-layout">
      <Card><div className="card-heading"><div><h2>Contact & experience</h2><p>Details parsed from the stored resume.</p></div><span className="candidate-initial candidate-initial-large">{record.name.slice(0, 1).toUpperCase()}</span></div><div className="detail-list">
        <div><Mail size={15} /><span>{record.email || "No email parsed"}</span></div><div><Phone size={15} /><span>{record.phone || "No phone parsed"}</span></div><div><MapPin size={15} /><span>{record.location || "Location not specified"}</span></div><div><BriefcaseBusiness size={15} /><span>{record.total_experience_years == null ? "Experience not provided" : `${record.total_experience_years} years recorded experience`}</span></div>
      </div><div className="detail-actions"><Link className="button button-primary" to={`/recruiter/interviews?candidate=${record.id}`} state={{ candidateId: record.id }}>Prepare interview</Link><Badge>{resume ? `Resume: ${resume.file_type.toUpperCase()}` : "No resume"}</Badge></div></Card>
      <Card><div className="card-heading"><div><h2>Skills</h2><p>{editorResume ? "Skills saved directly from the resume editor." : "Parsed categories returned from the backend."}</p></div></div>{editorResume?.skills.length ? <div className="skill-pills">{editorResume.skills.map((skill) => <span className="skill-pill" key={skill}>{skill}</span>)}</div> : skillGroups.length ? <div className="skill-group-list">{skillGroups.map(([group, values]) => <div className="skill-group" key={group}><strong>{group}</strong><div className="skill-pills">{Array.isArray(values) ? values.map((value) => <span className="skill-pill" key={String(value)}>{String(value)}</span>) : <span>{String(values)}</span>}</div></div>)}</div> : <EmptyState title="No skills available" description="The resume parser did not return categorized skills." />}</Card>
      <Card className="detail-full"><div className="card-heading"><div><h2>Resume sections</h2><p>{record.editor_resume ? `Editor document: ${record.editor_resume.name} · schema v${record.editor_resume.schema_version}` : "Structured data stored for this candidate."}</p></div></div>{editorResume ? <div className="grid-two resume-sections"><section><h3>Experience</h3>{editorResume.experience.length ? editorResume.experience.map((item, index) => <pre className="structured-item" key={index}>{JSON.stringify(item, null, 2)}</pre>) : <p className="field-help">No experience details added.</p>}</section><section><h3>Education</h3>{editorResume.education.length ? editorResume.education.map((item, index) => <pre className="structured-item" key={index}>{JSON.stringify(item, null, 2)}</pre>) : <p className="field-help">No education details added.</p>}</section><section><h3>Projects</h3>{editorResume.projects.length ? editorResume.projects.map((item, index) => <pre className="structured-item" key={index}>{JSON.stringify(item, null, 2)}</pre>) : <p className="field-help">No projects added.</p>}</section><section><h3>Certifications</h3>{editorResume.certifications.length ? editorResume.certifications.map((item, index) => <pre className="structured-item" key={index}>{JSON.stringify(item, null, 2)}</pre>) : <p className="field-help">No certifications added.</p>}</section></div> : resume ? <div className="grid-two resume-sections"><section><h3>Experience (uploaded {resume.file_type.toUpperCase()})</h3>{resume.experience.length ? resume.experience.map((item, index) => <pre className="structured-item" key={index}>{JSON.stringify(item, null, 2)}</pre>) : <p className="field-help">No experience details parsed.</p>}</section><section><h3>Education</h3>{resume.education.length ? resume.education.map((item, index) => <pre className="structured-item" key={index}>{JSON.stringify(item, null, 2)}</pre>) : <p className="field-help">No education details parsed.</p>}</section></div> : <EmptyState title="No structured resume" description="This candidate record has no attached resume." />}</Card>
    </div>
  </>;
}
