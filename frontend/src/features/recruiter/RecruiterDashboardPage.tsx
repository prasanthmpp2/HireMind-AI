import { useCallback } from "react";
import { ArrowRight, BriefcaseBusiness, Check, ClipboardList, FileSearch, Scale, Sparkles, UploadCloud, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useApiQuery } from "../../hooks/useApiQuery";
import { Badge, Card, EmptyState, ErrorState, PageHeading, Skeleton } from "../../components/platform/Ui";

export function RecruiterDashboardPage() {
  const loadJobs = useCallback((signal: AbortSignal) => api.jobs(signal).then((response) => response.items), []);
  const loadCandidates = useCallback((signal: AbortSignal) => api.candidates(signal).then((response) => response.items), []);
  const loadHealth = useCallback((signal: AbortSignal) => api.health(signal), []);
  const jobs = useApiQuery(loadJobs);
  const candidates = useApiQuery(loadCandidates);
  const health = useApiQuery(loadHealth);
  const loading = jobs.loading || candidates.loading;
  const error = jobs.error || candidates.error;
  const matchCount = jobs.data?.reduce((total, job) => total + (job.match_count ?? 0), 0) ?? 0;

  return <>
    <PageHeading eyebrow="Recruiter workspace" title="Recruiter dashboard" description="Overview of candidate screenings, job matches, and interview workflows." action={<div className="dashboard-actions"><Link className="button button-secondary" to="/recruiter/jobs"><BriefcaseBusiness size={16} /> New job opening</Link><Link className="button button-primary" to="/recruiter/screening"><UploadCloud size={16} /> Upload resumes</Link></div>} />
    {error ? <ErrorState message={error} retry={() => { jobs.refresh(); candidates.refresh(); health.refresh(); }} /> : loading ? <Skeleton lines={7} /> : <>
      <div className="dashboard-stats">
        <Link className="dashboard-stat" to="/recruiter/jobs"><span className="dashboard-stat-icon icon-purple"><BriefcaseBusiness size={21} /></span><span><strong>{jobs.data?.length ?? 0}</strong><small>Active job openings</small></span><ArrowRight className="dashboard-stat-arrow" size={16} /></Link>
        <Link className="dashboard-stat" to="/recruiter/screening"><span className="dashboard-stat-icon icon-green"><UsersRound size={22} /></span><span><strong>{candidates.data?.length ?? 0}</strong><small>Screened candidates</small></span><ArrowRight className="dashboard-stat-arrow" size={16} /></Link>
        <Link className="dashboard-stat" to="/recruiter/matches"><span className="dashboard-stat-icon icon-amber"><Scale size={22} /></span><span><strong>{matchCount}</strong><small>Candidate evaluations</small></span><ArrowRight className="dashboard-stat-arrow" size={16} /></Link>
        <Link className="dashboard-stat" to="/recruiter/interviews"><span className="dashboard-stat-icon icon-blue"><ClipboardList size={21} /></span><span><strong>{health.data?.status === "ok" ? "Ready" : "—"}</strong><small>Interview studio</small></span><ArrowRight className="dashboard-stat-arrow" size={16} /></Link>
      </div>

      <Card className="dashboard-hero">
        <div className="dashboard-hero-copy"><Badge tone="success"><Sparkles size={13} /> Connected recruitment workflows</Badge><h2>Intelligent, reviewable recruitment</h2><p>Screen resumes, compare job related evidence, and prepare structured interviews. Scores support recruiter review; hiring decisions stay with your team.</p>
          <div className="dashboard-hero-actions"><Link className="button button-primary" to="/recruiter/screening"><FileSearch size={15} /> Start resume screening</Link><Link className="button button-secondary" to="/recruiter/matches"><Scale size={15} /> View match leaderboard</Link></div>
        </div>
        <div className="workflow-panel"><h3><Sparkles size={15} /> Recruitment workflows</h3><p><Check size={15} /> Resume screening and parsing</p><p><Check size={15} /> Job matching and score details</p><p><Check size={15} /> Interview kit generation</p><div className="api-status-line"><span className={`status-dot ${health.data?.status === "ok" ? "status-online" : ""}`} /> API {health.loading ? "checking" : health.data?.status === "ok" ? "connected" : "unavailable"}</div></div>
      </Card>

      <div className="dashboard-panels">
        <Card className="dashboard-panel"><div className="dashboard-panel-heading"><div><h2><UsersRound size={17} /> Recently screened candidates</h2><p>Candidate profiles currently stored in the backend.</p></div><Link className="text-link" to="/recruiter/screening">Screen resumes <ArrowRight size={14} /></Link></div>
          {candidates.data?.length ? <div className="dashboard-candidate-list">{candidates.data.slice(0, 5).map((candidate) => <div className="dashboard-candidate-row" key={candidate.id}><Link className="candidate-name-cell" to={`/recruiter/candidates/${candidate.id}`}><span className="candidate-initial">{candidate.name.slice(0, 1).toUpperCase()}</span><span><strong>{candidate.name}</strong><small>{candidate.email || "No email on file"}</small></span></Link><Link className="button button-small button-secondary" to={`/recruiter/interviews?candidate=${candidate.id}`}>Interview <ArrowRight size={13} /></Link></div>)}</div> : <EmptyState title="No candidates yet" description="Upload resumes to create candidate profiles and start matching." action={<Link className="button button-secondary" to="/recruiter/screening">Upload resumes</Link>} />}
        </Card>
        <Card className="dashboard-panel"><div className="dashboard-panel-heading"><div><h2><BriefcaseBusiness size={17} /> Active job openings</h2><p>Open a job or continue to its match results.</p></div><Link className="text-link" to="/recruiter/jobs">Manage <ArrowRight size={14} /></Link></div>
          {jobs.data?.length ? <div className="dashboard-job-list">{jobs.data.slice(0, 5).map((job) => <div className="dashboard-job-row" key={job.id}><div className="dashboard-job-copy"><strong>{job.title}</strong><small>{job.department || "Department not set"} · {job.required_skills.length} required skills</small><div className="skill-pills">{job.required_skills.slice(0, 3).map((skill) => <span className="skill-pill" key={skill}>{skill}</span>)}{job.required_skills.length > 3 && <span className="job-more-skills">+{job.required_skills.length - 3}</span>}</div></div><Link className="button button-small button-secondary" to={`/recruiter/matches?job=${job.id}`}>Match <ArrowRight size={13} /></Link></div>)}</div> : <EmptyState title="No job openings" description="Create a job description before screening candidates against a role." action={<Link className="button button-secondary" to="/recruiter/jobs">Create a job</Link>} />}
        </Card>
      </div>
    </>}
  </>;
}
