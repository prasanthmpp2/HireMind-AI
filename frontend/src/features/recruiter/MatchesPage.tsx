import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  CheckCircle,
  Eye,
  FileQuestion,
  PieChart,
  Search,
  Sparkles,
  Star,
  X,
  Zap
} from "lucide-react";
import { api } from "../../api/client";
import type { MatchResult } from "../../api/types";
import { useToast } from "../../app/ToastContext";
import { ErrorState } from "../../components/platform/Ui";
import { useApiQuery } from "../../hooks/useApiQuery";

export function MatchesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialJobId = searchParams.get("job_id") || searchParams.get("job") || "";

  const loadJobs = useCallback((signal: AbortSignal) => api.jobs(signal).then((res) => res.items), []);
  const jobs = useApiQuery(loadJobs);

  const [selectedJobId, setSelectedJobId] = useState<string>(initialJobId);
  const [matches, setMatches] = useState<MatchResult[] | null>(null);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [runningMatch, setRunningMatch] = useState(false);
  const [matchError, setMatchError] = useState("");
  const [activeDeepDive, setActiveDeepDive] = useState<MatchResult | null>(null);

  const { showToast } = useToast();

  const fetchMatchesForJob = useCallback(async (jobId: string) => {
    if (!jobId) {
      setMatches(null);
      return;
    }
    setLoadingMatches(true);
    setMatchError("");
    try {
      const res = await api.jobMatches(Number(jobId));
      setMatches(res.items);
    } catch {
      // If fetching existing matches fails or endpoint empty, clear matches
      setMatches([]);
    } finally {
      setLoadingMatches(false);
    }
  }, []);

  useEffect(() => {
    if (initialJobId && jobs.data?.some((j) => String(j.id) === initialJobId)) {
      setSelectedJobId(initialJobId);
      void fetchMatchesForJob(initialJobId);
    }
  }, [initialJobId, jobs.data, fetchMatchesForJob]);

  const handleJobSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newJobId = e.target.value;
    setSelectedJobId(newJobId);
    setSearchParams(newJobId ? { job_id: newJobId } : {});
    if (newJobId) {
      void fetchMatchesForJob(newJobId);
    } else {
      setMatches(null);
    }
  };

  const handleRunMatching = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedJobId) {
      showToast("Please select a job opening first.");
      return;
    }

    setRunningMatch(true);
    setMatchError("");
    try {
      const response = await api.matchCandidates(Number(selectedJobId));
      setMatches(response.results);
      showToast(`Evaluation complete: ${response.results.length} candidate(s) ranked.`);
    } catch (err) {
      setMatchError(err instanceof Error ? err.message : "Candidate matching failed.");
    } finally {
      setRunningMatch(false);
    }
  };

  const getRankBadgeClass = (index: number) => {
    if (index === 0) return "rank-gold";
    if (index === 1) return "rank-silver";
    if (index === 2) return "rank-bronze";
    return "rank-default";
  };

  const getRecBadgeClass = (rec: string) => {
    if (rec === "Strongly Recommended") return "rec-strongly";
    if (rec === "Recommended") return "rec-recommended";
    if (rec === "Review") return "rec-review";
    return "rec-not-recommended";
  };

  const getProgressBarClass = (score: number) => {
    if (score >= 85) return "progress-high";
    if (score >= 70) return "progress-med";
    if (score >= 50) return "progress-low";
    return "progress-danger";
  };

  const currentJob = jobs.data?.find((j) => String(j.id) === selectedJobId);

  return (
    <div className="matches-page-wrapper">
      {/* Page Header */}
      <div className="jobs-page-header">
        <h1 className="jobs-page-title">Resume ↔ Job Description Matching &amp; Ranking</h1>
        <p className="jobs-page-subtitle">
          Semantic cosine similarity (ChromaDB) combined with structured skill gap analysis and explainable AI recommendations.
        </p>
      </div>

      {/* Job Selector & Trigger Bar */}
      <div className="job-card-container mb-4" style={{ padding: "1.25rem 1.5rem" }}>
        <div className="matching-controls-row">
          <div className="matching-select-group">
            <label htmlFor="matchingJobSelect" className="matching-select-label">
              Select Active Job Opening
            </label>
            <select
              id="matchingJobSelect"
              className="matching-job-dropdown"
              value={selectedJobId}
              onChange={handleJobSelectChange}
            >
              <option value="">
                {jobs.loading ? "Loading job openings…" : "Select a Job Opening..."}
              </option>
              {jobs.data?.map((job) => (
                <option value={job.id} key={job.id}>
                  {job.title} ({job.department || "Engineering"})
                </option>
              ))}
            </select>
          </div>

          <div className="matching-button-group">
            <button
              type="button"
              className="btn-run-matching"
              onClick={() => void handleRunMatching()}
              disabled={!selectedJobId || runningMatch}
            >
              <Zap size={15} className={runningMatch ? "spinner" : ""} />
              <span>{runningMatch ? "Running AI Evaluation…" : "Run AI Matching & Ranking"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Candidate Ranking Leaderboard */}
      <div className="leaderboard-section">
        <div className="existing-jobs-header">
          <div>
            <h2 className="existing-jobs-title">Candidate Leaderboard &amp; Evaluation Matrix</h2>
            {currentJob && (
              <span className="text-muted" style={{ fontSize: "0.825rem" }}>
                Target Role: <strong>{currentJob.title}</strong>
              </span>
            )}
          </div>
          <div className="leaderboard-legend">
            <span className="legend-badge badge-strongly">≥85% Strongly Recommended</span>
            <span className="legend-badge badge-recommended">70-84% Recommended</span>
            <span className="legend-badge badge-review">50-69% Review</span>
          </div>
        </div>

        {matchError && <ErrorState message={matchError} />}

        {/* State: No Job Selected */}
        {!selectedJobId && (
          <div className="matching-empty-state">
            <Search size={54} className="text-muted" style={{ opacity: 0.35, marginBottom: "0.75rem" }} />
            <h3 className="matching-empty-title">
              Select a Job Opening above to View or Run Candidate Matching
            </h3>
          </div>
        )}

        {/* State: Loading */}
        {(loadingMatches || runningMatch) && (
          <div className="job-loading-placeholder" style={{ minHeight: "260px" }}>
            <Zap size={24} className="spinner text-primary-blue" />
            <span style={{ fontWeight: 500, fontSize: "0.95rem" }}>
              {runningMatch
                ? "Running LangGraph Semantic Similarity, Skill Overlap & Explainable Ranking Engine…"
                : "Loading ranked candidates…"}
            </span>
          </div>
        )}

        {/* State: Job Selected but No Matches Yet */}
        {selectedJobId && !loadingMatches && !runningMatch && matches && matches.length === 0 && (
          <div className="job-empty-placeholder" style={{ padding: "3.5rem 2rem" }}>
            <Sparkles size={46} className="text-primary-blue" style={{ opacity: 0.6, marginBottom: "0.75rem" }} />
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#1e293b", margin: "0 0 0.35rem 0" }}>
              No Matches Computed for this Job Yet
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#64748b", margin: "0 0 1.25rem 0", maxWidth: "440px" }}>
              Click &quot;Run AI Matching &amp; Ranking&quot; to evaluate all screened candidates with LangGraph.
            </p>
            <button
              type="button"
              className="btn-save-job"
              onClick={() => void handleRunMatching()}
            >
              <Zap size={15} /> Run AI Matching
            </button>
          </div>
        )}

        {/* State: Matches Table */}
        {selectedJobId && !loadingMatches && !runningMatch && matches && matches.length > 0 && (
          <div className="leaderboard-table-card">
            <div className="table-responsive">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th style={{ width: "70px", paddingLeft: "1.5rem" }}>Rank</th>
                    <th>Candidate</th>
                    <th>Overall Fit</th>
                    <th>Skills Match</th>
                    <th>Experience</th>
                    <th>Recommendation</th>
                    <th style={{ textAlign: "right", paddingRight: "1.5rem" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m, index) => {
                    const rankClass = getRankBadgeClass(index);
                    const recClass = getRecBadgeClass(m.recommendation);
                    const barClass = getProgressBarClass(m.overall_score);

                    return (
                      <tr key={m.id || index}>
                        <td style={{ paddingLeft: "1.5rem" }}>
                          <span className={`rank-pill ${rankClass}`}>
                            #{index + 1}
                          </span>
                        </td>
                        <td>
                          <div className="leaderboard-cand-name">{m.candidate_name}</div>
                          <div className="leaderboard-cand-sub">
                            {m.candidate_email && <span>{m.candidate_email} • </span>}
                            <span>{m.candidate_experience ?? 0} yrs exp</span>
                          </div>
                        </td>
                        <td style={{ minWidth: "160px" }}>
                          <div className="score-header-row">
                            <span className="score-percentage-text">{m.overall_score.toFixed(1)}%</span>
                            {m.semantic_score != null && (
                              <span className="score-semantic-text">Semantic: {m.semantic_score.toFixed(0)}%</span>
                            )}
                          </div>
                          <div className="score-progress-track">
                            <div
                              className={`score-progress-fill ${barClass}`}
                              style={{ width: `${Math.max(0, Math.min(100, m.overall_score))}%` }}
                            />
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: "#0f172a" }}>
                            {m.skills_score != null ? `${m.skills_score.toFixed(0)}%` : "—"}
                          </div>
                          <div className="score-semantic-text">
                            {(m.matched_skills || []).length} matched
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: "#0f172a" }}>
                            {m.experience_score != null ? `${m.experience_score.toFixed(0)}%` : "—"}
                          </div>
                        </td>
                        <td>
                          <span className={`rec-badge ${recClass}`}>
                            {m.recommendation === "Strongly Recommended" && <Star size={11} />}
                            {m.recommendation === "Recommended" && <Check size={11} />}
                            {m.recommendation === "Review" && <Eye size={11} />}
                            {m.recommendation === "Not Recommended" && <X size={11} />}
                            {m.recommendation}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", paddingRight: "1.5rem" }}>
                          <div className="table-actions-cluster">
                            <button
                              type="button"
                              className="btn-deep-dive"
                              onClick={() => setActiveDeepDive(m)}
                              title="Explainable AI Deep Dive"
                            >
                              <PieChart size={13} />
                              Deep Dive
                            </button>
                            <Link
                              to={`/recruiter/interviews?job_id=${m.job_id}&candidate_id=${m.candidate_id}`}
                              className="btn-interview-kit-link"
                              title="Generate Interview Kit"
                            >
                              <FileQuestion size={13} />
                              Interview Kit
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Explainable AI Deep Dive Modal */}
      {activeDeepDive && (
        <div className="custom-modal-overlay" onClick={() => setActiveDeepDive(null)}>
          <div className="custom-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="custom-modal-header">
              <h3 className="custom-modal-title">
                Explainable AI Deep Dive — {activeDeepDive.candidate_name}
              </h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setActiveDeepDive(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="custom-modal-body">
              {/* Score Breakdown Cards */}
              <div className="deep-dive-grid-4">
                <div className="deep-dive-stat-card">
                  <span className="stat-card-label">Overall Match</span>
                  <span className="stat-card-value text-primary-blue">
                    {activeDeepDive.overall_score.toFixed(1)}%
                  </span>
                </div>
                <div className="deep-dive-stat-card">
                  <span className="stat-card-label">Semantic Cosine</span>
                  <span className="stat-card-value">
                    {activeDeepDive.semantic_score != null ? `${activeDeepDive.semantic_score.toFixed(1)}%` : "—"}
                  </span>
                </div>
                <div className="deep-dive-stat-card">
                  <span className="stat-card-label">Skills Overlap</span>
                  <span className="stat-card-value">
                    {activeDeepDive.skills_score != null ? `${activeDeepDive.skills_score.toFixed(1)}%` : "—"}
                  </span>
                </div>
                <div className="deep-dive-stat-card">
                  <span className="stat-card-label">Experience Fit</span>
                  <span className="stat-card-value">
                    {activeDeepDive.experience_score != null ? `${activeDeepDive.experience_score.toFixed(1)}%` : "—"}
                  </span>
                </div>
              </div>

              {/* Rationale Section */}
              {activeDeepDive.rationale && (
                <div className="modal-section">
                  <h5 className="modal-section-title">AI Matching Explanation &amp; Evidence</h5>
                  <p className="modal-text" style={{ whiteSpace: "pre-line" }}>
                    {activeDeepDive.rationale}
                  </p>
                </div>
              )}

              {/* Matched Skills */}
              {activeDeepDive.matched_skills && activeDeepDive.matched_skills.length > 0 && (
                <div className="modal-section">
                  <h5 className="modal-section-title" style={{ color: "#059669" }}>
                    <CheckCircle size={15} className="inline-icon" /> Matched Required Skills ({activeDeepDive.matched_skills.length})
                  </h5>
                  <div className="job-skills-list">
                    {activeDeepDive.matched_skills.map((s) => (
                      <span className="job-skill-pill skill-matched" key={s}>
                        <Check size={11} /> {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing Skills */}
              {activeDeepDive.missing_skills && activeDeepDive.missing_skills.length > 0 && (
                <div className="modal-section">
                  <h5 className="modal-section-title" style={{ color: "#dc2626" }}>
                    <AlertTriangle size={15} className="inline-icon" /> Skills to Probe / Missing Competencies ({activeDeepDive.missing_skills.length})
                  </h5>
                  <div className="job-skills-list">
                    {activeDeepDive.missing_skills.map((s) => (
                      <span className="job-skill-pill skill-missing" key={s}>
                        <X size={11} /> {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Strengths & Concerns */}
              {activeDeepDive.key_strengths && activeDeepDive.key_strengths.length > 0 && (
                <div className="modal-section">
                  <h5 className="modal-section-title">Key Strengths</h5>
                  <ul className="modal-bullet-list">
                    {activeDeepDive.key_strengths.map((st, i) => (
                      <li key={i} className="text-success"><Check size={13} /> {st}</li>
                    ))}
                  </ul>
                </div>
              )}

              {activeDeepDive.key_concerns && activeDeepDive.key_concerns.length > 0 && (
                <div className="modal-section">
                  <h5 className="modal-section-title">Areas of Concern to Probe</h5>
                  <ul className="modal-bullet-list">
                    {activeDeepDive.key_concerns.map((c, i) => (
                      <li key={i} className="text-danger"><AlertTriangle size={13} /> {c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="custom-modal-footer">
              <Link
                to={`/recruiter/interviews?job_id=${activeDeepDive.job_id}&candidate_id=${activeDeepDive.candidate_id}`}
                className="btn-save-job"
                style={{ padding: "0.5rem 1.15rem", fontSize: "0.85rem" }}
              >
                <FileQuestion size={14} /> Generate Tailored Interview Kit
              </Link>
              <button
                type="button"
                className="btn-reset"
                onClick={() => setActiveDeepDive(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
