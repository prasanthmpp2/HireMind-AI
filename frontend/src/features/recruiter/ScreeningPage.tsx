import { useCallback, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Briefcase,
  Eye,
  FileText,
  Github,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  RotateCw,
  Scale,
  Settings,
  Trash2,
  UploadCloud,
  X
} from "lucide-react";
import { api } from "../../api/client";
import type { Candidate, ScreeningResult } from "../../api/types";
import { useToast } from "../../app/ToastContext";
import { ConfirmDialog, ErrorState } from "../../components/platform/Ui";
import { useApiQuery } from "../../hooks/useApiQuery";

export function ScreeningPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewingCandidate, setViewingCandidate] = useState<Candidate | null>(null);
  const [deletingCandidate, setDeletingCandidate] = useState<Candidate | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const loadCandidates = useCallback((signal: AbortSignal) => api.candidates(signal).then((res) => res.items), []);
  const candidates = useApiQuery(loadCandidates);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles: File[]) => {
    const validExtensions = [".pdf", ".docx", ".txt"];
    const validFiles = newFiles.filter((file) =>
      validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
    );
    if (validFiles.length < newFiles.length) {
      showToast("Some files were skipped. Only PDF, DOCX, and TXT are supported.");
    }
    setFiles((prev) => [...prev, ...validFiles]);
    setUploadError("");
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUploadAndScreen = async (e: FormEvent) => {
    e.preventDefault();
    if (!files.length) {
      setUploadError("Please select at least one resume file.");
      return;
    }

    setUploading(true);
    setUploadError("");
    setResult(null);

    try {
      const response = await api.uploadResumes(files);
      setResult(response);
      showToast(`Processed ${response.counts.succeeded} of ${response.counts.total} resumes.`);
      clearFiles();
      candidates.refresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Resume screening failed.");
    } finally {
      setUploading(false);
    }
  };

  const confirmDeleteCandidate = async () => {
    if (!deletingCandidate) return;
    try {
      await api.deleteCandidate(deletingCandidate.id);
      showToast("Candidate removed.");
      candidates.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to remove candidate.");
    } finally {
      setDeletingCandidate(null);
    }
  };

  const extractSkills = (candidate: Candidate): string[] => {
    const resume = candidate.resume;
    if (!resume || !resume.skills) return [];
    const skills = resume.skills;
    if (Array.isArray(skills)) {
      return skills.map((s) => String(s));
    }
    if (typeof skills === "object") {
      const result: string[] = [];
      Object.values(skills).forEach((val) => {
        if (Array.isArray(val)) {
          result.push(...val.map((item) => String(item)));
        }
      });
      return result;
    }
    return [];
  };

  return (
    <div className="screening-page-wrapper">
      {/* Page Header */}
      <div className="jobs-page-header">
        <h1 className="jobs-page-title">AI Resume Screening &amp; Ingestion</h1>
        <p className="jobs-page-subtitle">
          Upload single or batch PDF / DOCX candidate resumes to parse structured profiles via LangGraph and Groq.
        </p>
      </div>

      {/* Upload Drag & Drop Card */}
      <div className="job-card-container mb-4">
        <div className="job-card-header">
          <div className="job-card-header-left">
            <UploadCloud size={18} className="text-primary-blue" />
            <span>Batch Resume Ingestion</span>
          </div>
          <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1">
            PDF &amp; DOCX Supported
          </span>
        </div>

        <div className="job-card-body">
          {uploadError && (
            <div className="feedback-card feedback-error" role="alert" style={{ marginBottom: "1rem" }}>
              {uploadError}
            </div>
          )}

          {result && (
            <div
              className={`feedback-card ${result.status === "completed" ? "feedback-success" : "feedback-error"}`}
              style={{ marginBottom: "1rem" }}
            >
              <div>
                <strong>Batch Run Result:</strong> {result.counts.succeeded} of {result.counts.total} resumes processed successfully.
                {result.counts.failed > 0 && <span> ({result.counts.failed} errors)</span>}
              </div>
            </div>
          )}

          <form onSubmit={(e) => void handleUploadAndScreen(e)}>
            <div
              className={`dropzone-container ${isDragOver ? "dragover" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                style={{ display: "none" }}
                onChange={handleFileInputChange}
              />
              <div className="dropzone-icon-circle">
                <UploadCloud size={28} className="dropzone-cloud-icon" />
              </div>
              <h2 className="dropzone-title">Drag &amp; Drop Resumes Here</h2>
              <p className="dropzone-subtitle">or click anywhere in this box to browse files from your computer</p>
              <span className="dropzone-badge">Supports multiple files simultaneously</span>
            </div>

            {/* Queued Files List */}
            {files.length > 0 && (
              <div className="queued-files-panel">
                <div className="queued-files-header">
                  <span className="fw-semibold text-dark">{files.length} file(s) queued for AI Screening:</span>
                  <button
                    type="button"
                    onClick={clearFiles}
                    className="btn-text-danger"
                  >
                    Clear all
                  </button>
                </div>
                <ul className="queued-files-list">
                  {files.map((file, idx) => (
                    <li className="queued-file-item" key={`${file.name}-${idx}`}>
                      <div className="queued-file-info">
                        <FileText
                          size={16}
                          className={file.name.endsWith(".pdf") ? "text-danger" : "text-primary-blue"}
                        />
                        <span className="queued-file-name">{file.name}</span>
                        <span className="queued-file-size">({(file.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="btn-remove-file"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="upload-action-row">
              <button
                type="submit"
                className="btn-save-job"
                disabled={uploading || files.length === 0}
              >
                <Settings size={16} className={uploading ? "spinner" : ""} />
                <span>{uploading ? "Running LangGraph Pipeline…" : "Run LangGraph Screening Pipeline"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Screened Candidates List */}
      <div className="existing-jobs-section">
        <div className="existing-jobs-header">
          <h2 className="existing-jobs-title">Screened Candidates Database</h2>
          <div className="d-flex align-items-center gap-2">
            <Link to="/recruiter/matches" className="btn-proceed-matching">
              <Scale size={14} />
              Proceed to JD Matching
            </Link>
            <button
              type="button"
              className="btn-refresh-jobs"
              onClick={() => candidates.refresh()}
            >
              <RotateCw size={14} className={candidates.loading ? "spinner" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {candidates.error && <ErrorState message={candidates.error} retry={candidates.refresh} />}

        {candidates.loading && !candidates.data && (
          <div className="job-loading-placeholder">
            <RotateCw size={20} className="spinner text-primary-blue" />
            <span>Loading candidates...</span>
          </div>
        )}

        {candidates.data && candidates.data.length === 0 && (
          <div className="job-empty-placeholder">
            <Briefcase size={40} className="text-muted" style={{ opacity: 0.5, marginBottom: "0.5rem" }} />
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#334155", margin: "0.25rem 0" }}>
              No Candidates Screened Yet
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#64748b", margin: 0 }}>
              Upload candidate resumes in PDF or DOCX format above to begin screening.
            </p>
          </div>
        )}

        {candidates.data && candidates.data.length > 0 && (
          <div className="job-cards-list">
            {candidates.data.map((c) => {
              const skills = extractSkills(c);
              return (
                <div className="job-list-card" key={c.id}>
                  <div className="job-list-top">
                    <div>
                      <div className="job-title-row">
                        <h3 className="job-title-heading">{c.name}</h3>
                        <span className="job-badge-exp">
                          <Briefcase size={12} />
                          {c.total_experience_years || 0} yrs exp
                        </span>
                        {c.location && (
                          <span className="job-badge-dept">
                            <MapPin size={12} className="inline-icon" />
                            {c.location}
                          </span>
                        )}
                      </div>
                      <div className="candidate-contact-row">
                        {c.email && (
                          <span className="contact-item">
                            <Mail size={12} />
                            {c.email}
                          </span>
                        )}
                        {c.phone && (
                          <span className="contact-item">
                            <Phone size={12} />
                            {c.phone}
                          </span>
                        )}
                        {c.github && (
                          <a
                            href={c.github.startsWith("http") ? c.github : `https://${c.github}`}
                            target="_blank"
                            rel="noreferrer"
                            className="contact-link"
                          >
                            <Github size={12} />
                            GitHub
                          </a>
                        )}
                        {c.linkedin && (
                          <a
                            href={c.linkedin.startsWith("http") ? c.linkedin : `https://${c.linkedin}`}
                            target="_blank"
                            rel="noreferrer"
                            className="contact-link"
                          >
                            <Linkedin size={12} />
                            LinkedIn
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="job-actions-row">
                      <button
                        type="button"
                        className="btn-view-profile"
                        onClick={() => setViewingCandidate(c)}
                      >
                        <Eye size={14} />
                        View Profile
                      </button>
                      <button
                        type="button"
                        className="btn-job-action danger"
                        onClick={() => setDeletingCandidate(c)}
                        aria-label={`Delete ${c.name}`}
                        title="Delete Candidate"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {c.summary && (
                    <div className="candidate-ai-summary">
                      <strong>AI Summary:</strong> {c.summary}
                    </div>
                  )}

                  {skills.length > 0 && (
                    <div className="job-skills-section">
                      <div className="job-skills-label">Extracted Core Skills:</div>
                      <div className="job-skills-list">
                        {skills.slice(0, 10).map((skill) => (
                          <span className="job-skill-pill" key={skill}>
                            {skill}
                          </span>
                        ))}
                        {skills.length > 10 && (
                          <span className="job-badge-dept" style={{ alignSelf: "center" }}>
                            +{skills.length - 10} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Candidate Profile Deep Dive Modal */}
      {viewingCandidate && (
        <div className="custom-modal-overlay" onClick={() => setViewingCandidate(null)}>
          <div className="custom-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="custom-modal-header">
              <h3 className="custom-modal-title">Candidate Profile — {viewingCandidate.name}</h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setViewingCandidate(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="custom-modal-body">
              <div className="modal-profile-header">
                <div>
                  <h4 style={{ margin: "0 0 4px 0", fontSize: "1.25rem", color: "#0f172a" }}>
                    {viewingCandidate.name}
                  </h4>
                  <div className="candidate-contact-row" style={{ marginTop: "4px" }}>
                    {viewingCandidate.email && <span><Mail size={13} /> {viewingCandidate.email}</span>}
                    {viewingCandidate.phone && <span><Phone size={13} /> {viewingCandidate.phone}</span>}
                    {viewingCandidate.location && <span><MapPin size={13} /> {viewingCandidate.location}</span>}
                  </div>
                </div>
                <span className="job-badge-exp" style={{ fontSize: "0.85rem", padding: "4px 12px" }}>
                  <Briefcase size={14} /> {viewingCandidate.total_experience_years || 0} years experience
                </span>
              </div>

              {viewingCandidate.summary && (
                <div className="modal-section">
                  <h5 className="modal-section-title">Executive Summary</h5>
                  <p className="modal-text">{viewingCandidate.summary}</p>
                </div>
              )}

              {extractSkills(viewingCandidate).length > 0 && (
                <div className="modal-section">
                  <h5 className="modal-section-title">Extracted Skills</h5>
                  <div className="job-skills-list">
                    {extractSkills(viewingCandidate).map((s) => (
                      <span className="job-skill-pill" key={s}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(viewingCandidate.resume?.experience) && viewingCandidate.resume.experience.length > 0 && (
                <div className="modal-section">
                  <h5 className="modal-section-title">Professional Experience</h5>
                  <div className="modal-timeline">
                    {(viewingCandidate.resume.experience as Array<{ company?: string; role?: string; duration?: string; description?: string }>).map((exp, i) => (
                      <div className="timeline-item" key={i}>
                        <div className="timeline-role">
                          <strong>{exp.role || "Software Engineer"}</strong> — <span>{exp.company || "Company"}</span>
                        </div>
                        {exp.duration && <div className="timeline-duration">{exp.duration}</div>}
                        {exp.description && <p className="timeline-desc">{exp.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(viewingCandidate.resume?.education) && viewingCandidate.resume.education.length > 0 && (
                <div className="modal-section">
                  <h5 className="modal-section-title">Education</h5>
                  {(viewingCandidate.resume.education as Array<{ degree?: string; institution?: string; year?: string }>).map((edu, i) => (
                    <div className="timeline-item" key={i}>
                      <div className="timeline-role">
                        <strong>{edu.degree || "Degree"}</strong> — <span>{edu.institution || "University"}</span>
                      </div>
                      {edu.year && <div className="timeline-duration">{edu.year}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="custom-modal-footer">
              <Link
                to={`/recruiter/matches`}
                className="btn-match-candidates"
                style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
              >
                <Scale size={14} /> Match in JD Leaderboard
              </Link>
              <button
                type="button"
                className="btn-reset"
                onClick={() => setViewingCandidate(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Candidate Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deletingCandidate)}
        title="Remove Screened Candidate?"
        description={`Are you sure you want to delete ${deletingCandidate?.name ?? "this candidate"}? Their parsed profile and match records will be removed.`}
        onCancel={() => setDeletingCandidate(null)}
        onConfirm={() => void confirmDeleteCandidate()}
      />
    </div>
  );
}
