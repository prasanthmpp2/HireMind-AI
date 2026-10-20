import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Briefcase,
  Clock,
  Pencil,
  PlusCircle,
  RotateCw,
  Save,
  Scale,
  Trash2,
  X
} from "lucide-react";
import { api } from "../../api/client";
import type { Job } from "../../api/types";
import { useToast } from "../../app/ToastContext";
import { ConfirmDialog, ErrorState } from "../../components/platform/Ui";
import { useApiQuery } from "../../hooks/useApiQuery";

type JobForm = {
  title: string;
  department: string;
  experience_required: string;
  experience_years_min: string;
  required_skills: string;
  nice_to_have_skills: string;
  raw_description: string;
};

const emptyForm: JobForm = {
  title: "",
  department: "Engineering",
  experience_required: "2-4 years",
  experience_years_min: "2.0",
  required_skills: "",
  nice_to_have_skills: "",
  raw_description: ""
};

const SAMPLE_JDS = {
  python_ai: {
    title: "Senior Python & AI Engineer",
    department: "AI & Engineering",
    experience_required: "3-5 years",
    experience_years_min: "3.0",
    required_skills: "Python, Flask, LangChain, SQLAlchemy, REST APIs, Docker",
    nice_to_have_skills: "LangGraph, ChromaDB, Kubernetes, Groq API",
    raw_description: `We are looking for a Senior Python & AI Engineer to build intelligent workflow agents and scalable REST APIs.
Responsibilities:
- Design and implement stateful agentic workflows using LangGraph and LangChain.
- Integrate high-performance vector databases (ChromaDB) for dense semantic retrieval.
- Build reliable REST services using Python (Flask / FastAPI) and SQLAlchemy.
- Collaborate with product managers to deliver explainable AI features.

Requirements:
- 3+ years of professional backend software development in Python.
- Proven experience with LLM orchestration (LangChain, LangGraph, or LlamaIndex).
- Strong proficiency in relational databases (PostgreSQL/MySQL/SQLite) and ORMs.
- Hands-on experience with containerization (Docker) and CI/CD pipelines.`
  },
  fullstack: {
    title: "Full Stack Web Developer",
    department: "Product Engineering",
    experience_required: "2-4 years",
    experience_years_min: "2.0",
    required_skills: "JavaScript, React, Node.js, HTML, CSS, SQL",
    nice_to_have_skills: "TypeScript, Bootstrap, AWS, GraphQL",
    raw_description: `Seeking a talented Full Stack Developer to craft intuitive, responsive web interfaces and modern microservices.
Key Duties:
- Develop scalable front-end client dashboards using React, modern CSS, and JavaScript.
- Build and maintain server-side APIs in Node.js or Python.
- Optimize database queries and schema designs.
- Implement responsive UI components.

Requirements:
- 2+ years of full stack software engineering experience.
- Deep expertise with JavaScript, modern UI frameworks (React or Vue), and SQL databases.`
  },
  java_dev: {
    title: "Java Backend Developer",
    department: "Core Platform",
    experience_required: "3+ years",
    experience_years_min: "3.0",
    required_skills: "Java, Spring Boot, MySQL, JDBC, Microservices, Git",
    nice_to_have_skills: "Kafka, Redis, Docker, AWS",
    raw_description: `We are hiring a Java Backend Developer to build high-throughput transaction engines and distributed microservices.
Requirements:
- 3+ years hands-on experience in Java and Spring Boot framework.
- Strong knowledge of concurrency, collections, and JVM tuning.
- Solid experience with MySQL databases, indexing, and JDBC.
- Experience building RESTful web services and distributed systems.`
  }
};

const extractMinYears = (expRange: string, fallback: string): number => {
  const parsed = Number(fallback);
  if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  const match = expRange.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 2.0;
};

const toPayload = (form: JobForm) => ({
  title: form.title.trim(),
  department: form.department.trim() || "Engineering",
  experience_required: form.experience_required.trim(),
  experience_years_min: extractMinYears(form.experience_required, form.experience_years_min),
  required_skills: form.required_skills.split(",").map((value) => value.trim()).filter(Boolean),
  nice_to_have_skills: form.nice_to_have_skills.split(",").map((value) => value.trim()).filter(Boolean),
  responsibilities: [],
  raw_description: form.raw_description.trim()
});

export function JobsPage() {
  const load = useCallback((signal: AbortSignal) => api.jobs(signal).then((response) => response.items), []);
  const jobs = useApiQuery(load);
  const [form, setForm] = useState<JobForm>(emptyForm);
  const [editing, setEditing] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [deleting, setDeleting] = useState<Job | null>(null);
  const { showToast } = useToast();

  const update = (key: keyof JobForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const fillSample = (key: keyof typeof SAMPLE_JDS) => {
    const sample = SAMPLE_JDS[key];
    if (!sample) return;
    setForm({
      title: sample.title,
      department: sample.department,
      experience_required: sample.experience_required,
      experience_years_min: sample.experience_years_min,
      required_skills: sample.required_skills,
      nice_to_have_skills: sample.nice_to_have_skills,
      raw_description: sample.raw_description
    });
    setSubmitError("");
    showToast(`Loaded sample template: ${sample.title}`);
  };

  const startEdit = (job: Job) => {
    setEditing(job);
    setSubmitError("");
    setForm({
      title: job.title,
      department: job.department || "Engineering",
      experience_required: job.experience_required || "2-4 years",
      experience_years_min: String(job.experience_years_min ?? 2.0),
      required_skills: job.required_skills.join(", "),
      nice_to_have_skills: job.nice_to_have_skills.join(", "),
      raw_description: job.raw_description
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.getElementById("jobTitle")?.focus();
  };

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
    setSubmitError("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    try {
      const payload = toPayload(form);
      if (editing) {
        await api.updateJob(editing.id, payload);
        showToast("Job updated.");
      } else {
        await api.createJob(payload);
        showToast("Job created.");
      }
      resetForm();
      jobs.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Job could not be saved.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await api.deleteJob(deleting.id);
      showToast("Job deleted.");
      jobs.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Job could not be deleted.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="jobs-page-wrapper">
      {/* Page Header */}
      <div className="jobs-page-header">
        <h1 className="jobs-page-title">Job Descriptions &amp; Requirements</h1>
        <p className="jobs-page-subtitle">
          Define job roles, required skills, and vectorize descriptions into ChromaDB for semantic matching.
        </p>
      </div>

      {/* Quick Sample Template Fill Buttons */}
      <div className="sample-templates-row">
        <span className="sample-templates-label">
          <Pencil size={14} className="text-primary" />
          Load Sample Template:
        </span>
        <button
          type="button"
          onClick={() => fillSample("python_ai")}
          className="sample-template-btn"
        >
          <span className="template-icon" role="img" aria-label="python">🐍</span>
          Python AI Engineer
        </button>
        <button
          type="button"
          onClick={() => fillSample("fullstack")}
          className="sample-template-btn"
        >
          <span className="template-icon" role="img" aria-label="react">⚛️</span>
          Full Stack Developer
        </button>
        <button
          type="button"
          onClick={() => fillSample("java_dev")}
          className="sample-template-btn"
        >
          <span className="template-icon" role="img" aria-label="java">☕</span>
          Java Spring Boot Developer
        </button>
      </div>

      {/* Job Creation Form Card */}
      <div className="job-card-container">
        <div className="job-card-header">
          <div className="job-card-header-left">
            <PlusCircle size={18} className="text-primary-blue" />
            <span>{editing ? "Edit Job Description" : "Post New Job Description"}</span>
          </div>
          <span className="job-card-header-right">Auto-indexed in ChromaDB vector store</span>
        </div>

        <div className="job-card-body">
          {submitError && (
            <div className="feedback-card feedback-error" role="alert" style={{ marginBottom: "1rem" }}>
              {submitError}
            </div>
          )}

          <form id="createJobForm" onSubmit={(event) => void submit(event)}>
            {/* Row 1: Title, Department, Experience */}
            <div className="job-form-row-3">
              <div className="job-field">
                <label
                  htmlFor="jobTitle"
                  className="job-field-label"
                >
                  Job title <span className="required-star">*</span>
                </label>
                <input
                  id="jobTitle"
                  type="text"
                  className="job-field-input"
                  placeholder="e.g. Senior Python Developer"
                  required
                  maxLength={255}
                  value={form.title}
                  onChange={(event) => update("title", event.target.value)}
                />
              </div>

              <div className="job-field">
                <label htmlFor="jobDepartment" className="job-field-label">
                  Department
                </label>
                <input
                  id="jobDepartment"
                  type="text"
                  className="job-field-input"
                  placeholder="e.g. AI & Engineering"
                  maxLength={100}
                  value={form.department}
                  onChange={(event) => update("department", event.target.value)}
                />
              </div>

              <div className="job-field">
                <label htmlFor="jobExperience" className="job-field-label">
                  Experience Range
                </label>
                <input
                  id="jobExperience"
                  type="text"
                  className="job-field-input"
                  placeholder="e.g. 2-4 years"
                  value={form.experience_required}
                  onChange={(event) => update("experience_required", event.target.value)}
                />
              </div>
            </div>

            {/* Row 2: Required Skills, Nice to have skills */}
            <div className="job-form-row-2">
              <div className="job-field">
                <label htmlFor="jobSkills" className="job-field-label">
                  Required Skills (comma separated) <span className="required-star">*</span>
                </label>
                <input
                  id="jobSkills"
                  type="text"
                  className="job-field-input"
                  placeholder="e.g. Python, Flask, SQL, Docker, LangChain"
                  value={form.required_skills}
                  onChange={(event) => update("required_skills", event.target.value)}
                />
                <span className="job-field-help">Used for deterministic gap matching.</span>
              </div>

              <div className="job-field">
                <label htmlFor="jobNiceSkills" className="job-field-label">
                  Nice-to-Have Skills (comma separated)
                </label>
                <input
                  id="jobNiceSkills"
                  type="text"
                  className="job-field-input"
                  placeholder="e.g. ChromaDB, Kubernetes, Redis"
                  value={form.nice_to_have_skills}
                  onChange={(event) => update("nice_to_have_skills", event.target.value)}
                />
              </div>
            </div>

            {/* Row 3: Full Job Description */}
            <div className="job-form-row-1">
              <div className="job-field">
                <label
                  htmlFor="jobDescription"
                  className="job-field-label"
                >
                  Full Job Description Text <span className="required-star">*</span>
                </label>
                <textarea
                  id="jobDescription"
                  aria-label="Job description *"
                  className="job-field-textarea"
                  rows={6}
                  placeholder="Paste the complete job description, responsibilities, and qualifications..."
                  required
                  maxLength={50000}
                  value={form.raw_description}
                  onChange={(event) => update("raw_description", event.target.value)}
                />
                <span className="job-field-help">
                  Will be converted to high-dimensional embeddings in ChromaDB for semantic similarity search.
                </span>
              </div>
            </div>

            {/* Row 4: Actions */}
            <div className="job-form-actions">
              {editing && (
                <button
                  type="button"
                  className="btn-cancel-edit"
                  onClick={resetForm}
                >
                  <X size={15} /> Cancel edit
                </button>
              )}
              <button
                type="button"
                className="btn-reset"
                onClick={resetForm}
              >
                Reset
              </button>
              <button
                type="submit"
                className="btn-save-job"
                aria-label={editing ? "Save changes" : "Create job"}
                disabled={submitting}
              >
                <Save size={16} />
                <span>{submitting ? "Saving & Vectorizing…" : editing ? "Save changes" : "Save & Vectorize Job"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Active Jobs List Section */}
      <div className="existing-jobs-section">
        <div className="existing-jobs-header">
          <h2 className="existing-jobs-title">Existing Job Openings</h2>
          <button
            type="button"
            className="btn-refresh-jobs"
            onClick={() => jobs.refresh()}
          >
            <RotateCw size={14} className={jobs.loading ? "spinner" : ""} />
            Refresh
          </button>
        </div>

        {jobs.error && <ErrorState message={jobs.error} retry={jobs.refresh} />}

        {jobs.loading && !jobs.data && (
          <div className="job-loading-placeholder">
            <RotateCw size={20} className="spinner text-primary-blue" />
            <span>Loading jobs...</span>
          </div>
        )}

        {jobs.data && jobs.data.length === 0 && (
          <div className="job-empty-placeholder">
            <Briefcase size={40} className="text-muted" style={{ opacity: 0.5, marginBottom: "0.5rem" }} />
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#334155", margin: "0.25rem 0" }}>
              No Job Descriptions Posted Yet
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#64748b", margin: 0 }}>
              Create your first job opening above or load a sample template to get started.
            </p>
          </div>
        )}

        {jobs.data && jobs.data.length > 0 && (
          <div className="job-cards-list">
            {jobs.data.map((job) => (
              <div className="job-list-card" key={job.id}>
                <div className="job-list-top">
                  <div>
                    <div className="job-title-row">
                      <h3 className="job-title-heading">{job.title}</h3>
                      <span className="job-badge-dept">{job.department || "Engineering"}</span>
                      <span className="job-badge-exp">
                        <Clock size={12} />
                        {job.experience_required || `${job.experience_years_min ?? 0}+ years`}
                      </span>
                      <span className="job-badge-matches">
                        {job.match_count ?? 0} matches
                      </span>
                    </div>
                    <span className="job-posted-date">
                      Posted on {job.created_at ? new Date(job.created_at).toLocaleDateString() : "Recently"}
                    </span>
                  </div>

                  <div className="job-actions-row">
                    <Link
                      to={`/recruiter/matches?job_id=${job.id}`}
                      className="btn-match-candidates"
                    >
                      <Scale size={14} />
                      Match Candidates
                    </Link>
                    <button
                      type="button"
                      className="btn-job-action"
                      onClick={() => startEdit(job)}
                      aria-label={`Edit ${job.title}`}
                      title="Edit Job"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn-job-action danger"
                      onClick={() => setDeleting(job)}
                      aria-label={`Delete ${job.title}`}
                      title="Delete Job"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {job.required_skills && job.required_skills.length > 0 && (
                  <div className="job-skills-section">
                    <div className="job-skills-label">Required Skills:</div>
                    <div className="job-skills-list">
                      {job.required_skills.map((skill) => (
                        <span className="job-skill-pill" key={skill}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {job.raw_description && (
                  <p className="job-desc-preview">
                    {job.raw_description.slice(0, 260)}
                    {job.raw_description.length > 260 ? "..." : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this job?"
        description={`${deleting?.title ?? "The job"} and its related match and interview records may be removed by the backend.`}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
