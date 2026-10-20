import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Award,
  Check,
  CheckCircle2,
  Code,
  Copy,
  FileCheck2,
  Flag,
  Info,
  Lightbulb,
  MessageSquare,
  Printer,
  ShieldAlert,
  Sparkles,
  Users,
  Wand2
} from "lucide-react";
import { api } from "../../api/client";
import type { InterviewKit } from "../../api/types";
import { useToast } from "../../app/ToastContext";
import { ErrorState } from "../../components/platform/Ui";
import { useApiQuery } from "../../hooks/useApiQuery";

type TabKey = "technical" | "resume" | "gaps" | "behavioral" | "rubrics";

export function InterviewStudioPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialJobId = searchParams.get("job_id") || searchParams.get("job") || "";
  const initialCandidateId = searchParams.get("candidate_id") || searchParams.get("candidate") || "";

  const loadJobs = useCallback((signal: AbortSignal) => api.jobs(signal).then((res) => res.items), []);
  const loadCandidates = useCallback((signal: AbortSignal) => api.candidates(signal).then((res) => res.items), []);
  const jobs = useApiQuery(loadJobs);
  const candidates = useApiQuery(loadCandidates);

  const [selectedJobId, setSelectedJobId] = useState<string>(initialJobId);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(initialCandidateId);
  const [kit, setKit] = useState<InterviewKit | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("technical");
  const [generating, setGenerating] = useState(false);
  const [kitError, setKitError] = useState("");

  const { showToast } = useToast();

  useEffect(() => {
    if (initialJobId && jobs.data?.some((j) => String(j.id) === initialJobId)) {
      setSelectedJobId(initialJobId);
    }
  }, [initialJobId, jobs.data]);

  useEffect(() => {
    if (initialCandidateId && candidates.data?.some((c) => String(c.id) === initialCandidateId)) {
      setSelectedCandidateId(initialCandidateId);
    }
  }, [initialCandidateId, candidates.data]);

  // If both are provided in query params on initial load, auto-generate or fetch
  useEffect(() => {
    if (initialJobId && initialCandidateId && !kit && !generating) {
      void runGenerate(initialJobId, initialCandidateId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialJobId, initialCandidateId]);

  const runGenerate = async (jobId: string, candidateId: string) => {
    if (!jobId || !candidateId) return;
    setGenerating(true);
    setKitError("");
    try {
      const response = await api.interviewKit(Number(candidateId), Number(jobId));
      setKit(response.item);
      showToast("Interview kit generated successfully!");
    } catch (err) {
      setKitError(err instanceof Error ? err.message : "Interview kit generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedJobId || !selectedCandidateId) {
      showToast("Please select both a Job Opening and a Candidate.");
      return;
    }
    setSearchParams({ job_id: selectedJobId, candidate_id: selectedCandidateId });
    await runGenerate(selectedJobId, selectedCandidateId);
  };

  const copyMarkdown = async () => {
    if (!kit) return;
    const lines: string[] = [
      `# ${kit.job_title} — Tailored Interview Kit`,
      `**Candidate:** ${kit.candidate_name}`,
      `**Generated:** ${new Date().toLocaleDateString()}`,
      "",
      "---",
      ""
    ];

    const addSection = (title: string, list: typeof kit.technical_questions) => {
      if (!list || !list.length) return;
      lines.push(`## ${title}`);
      list.forEach((q, idx) => {
        lines.push(`### ${idx + 1}. ${q.question}`);
        if (q.topic) lines.push(`*Topic: ${q.topic}*`);
        if (q.expected_answer) lines.push(`**Strong Answer Guidance:**\n${q.expected_answer}\n`);
        if (q.red_flags) lines.push(`**Red Flags:**\n${q.red_flags}\n`);
      });
      lines.push("");
    };

    addSection("Technical Questions", kit.technical_questions);
    addSection("Resume Claim Probes", kit.resume_questions);
    addSection("Skill Gap Questions", kit.gap_questions);
    addSection("Behavioral & STAR Questions", kit.behavioral_questions);

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      showToast("Interview kit copied as Markdown!");
    } catch {
      showToast("Could not access clipboard.");
    }
  };

  const techQuestions = kit?.technical_questions || [];
  const resumeQuestions = kit?.resume_questions || [];
  const gapQuestions = kit?.gap_questions || [];
  const behavioralQuestions = kit?.behavioral_questions || [];

  return (
    <div className="interview-studio-wrapper">
      {/* Page Header */}
      <div className="jobs-page-header">
        <h1 className="jobs-page-title">AI Interview Studio &amp; Question Generator</h1>
        <p className="jobs-page-subtitle">
          Synthesize deep, candidate-tailored technical questions, resume-claim probes, skill gap validations, and STAR behavioral questions with Groq &amp; LangGraph.
        </p>
      </div>

      {/* Selection & Trigger Panel */}
      <div className="job-card-container mb-4" style={{ padding: "1.25rem 1.5rem" }}>
        <form onSubmit={(e) => void handleGenerate(e)}>
          <div className="interview-selector-grid">
            <div className="interview-field-col">
              <label htmlFor="interviewJobSelect" className="matching-select-label">
                Select Job Opening
              </label>
              <select
                id="interviewJobSelect"
                className="matching-job-dropdown"
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
              >
                <option value="">
                  {jobs.loading ? "Loading jobs…" : "Select Job Opening..."}
                </option>
                {jobs.data?.map((job) => (
                  <option value={job.id} key={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="interview-field-col">
              <label htmlFor="interviewCandSelect" className="matching-select-label">
                Select Candidate
              </label>
              <select
                id="interviewCandSelect"
                className="matching-job-dropdown"
                value={selectedCandidateId}
                onChange={(e) => setSelectedCandidateId(e.target.value)}
              >
                <option value="">
                  {candidates.loading ? "Loading candidates…" : "Select Candidate..."}
                </option>
                {candidates.data?.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name} ({c.total_experience_years || 0} yrs exp)
                  </option>
                ))}
              </select>
            </div>

            <div className="interview-field-action">
              <button
                type="submit"
                className="btn-save-job"
                style={{ width: "100%", justifyContent: "center", minHeight: "38px" }}
                disabled={generating || !selectedJobId || !selectedCandidateId}
              >
                <Wand2 size={15} className={generating ? "spinner" : ""} />
                <span>{generating ? "Synthesizing Kit…" : "Generate"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {kitError && <ErrorState message={kitError} />}

      {/* Action Bar (Copy, Print) */}
      {kit && (
        <div className="kit-actions-bar">
          <div className="kit-tip-text">
            <Lightbulb size={15} className="text-warning-amber" />
            <span>Tip: Questions test both claimed strengths and unverified skill gaps.</span>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn-kit-action"
              onClick={() => void copyMarkdown()}
            >
              <Copy size={13} />
              Copy as Markdown
            </button>
            <button
              type="button"
              className="btn-kit-action"
              onClick={() => window.print()}
            >
              <Printer size={13} />
              Print / Save PDF
            </button>
          </div>
        </div>
      )}

      {/* Interview Kit Content View */}
      {!kit && !generating && (
        <div className="interview-empty-state">
          <MessageSquare size={54} className="text-muted" style={{ opacity: 0.35, marginBottom: "0.75rem" }} />
          <h3 className="matching-empty-title">
            Select a Job and Candidate above, then click Generate to create an Interview Kit
          </h3>
        </div>
      )}

      {generating && (
        <div className="job-loading-placeholder" style={{ minHeight: "260px" }}>
          <Sparkles size={26} className="spinner text-primary-blue" />
          <span style={{ fontWeight: 500, fontSize: "0.95rem" }}>
            Synthesizing Tailored Interview Questions with LangGraph &amp; Groq…
          </span>
        </div>
      )}

      {kit && !generating && (
        <div className="job-card-container mb-4" style={{ padding: "1.75rem" }}>
          {/* Kit Header */}
          <div className="kit-results-header">
            <div>
              <h2 className="kit-candidate-title">{kit.candidate_name}</h2>
              <span className="kit-role-subtitle">
                Target Role: <strong className="text-primary-blue">{kit.job_title}</strong>
              </span>
            </div>
            <span className="badge-kit-ready">
              <CheckCircle2 size={13} />
              AI Interview Kit Ready
            </span>
          </div>

          {/* Tabs Navigation */}
          <div className="kit-tabs-nav">
            <button
              type="button"
              className={`kit-tab-btn ${activeTab === "technical" ? "active" : ""}`}
              onClick={() => setActiveTab("technical")}
            >
              <Code size={14} />
              Technical ({techQuestions.length})
            </button>
            <button
              type="button"
              className={`kit-tab-btn ${activeTab === "resume" ? "active" : ""}`}
              onClick={() => setActiveTab("resume")}
            >
              <FileCheck2 size={14} />
              Resume Claims ({resumeQuestions.length})
            </button>
            <button
              type="button"
              className={`kit-tab-btn ${activeTab === "gaps" ? "active" : ""}`}
              onClick={() => setActiveTab("gaps")}
            >
              <ShieldAlert size={14} />
              Skill Gaps ({gapQuestions.length})
            </button>
            <button
              type="button"
              className={`kit-tab-btn ${activeTab === "behavioral" ? "active" : ""}`}
              onClick={() => setActiveTab("behavioral")}
            >
              <Users size={14} />
              Behavioral ({behavioralQuestions.length})
            </button>
            <button
              type="button"
              className={`kit-tab-btn ${activeTab === "rubrics" ? "active" : ""}`}
              onClick={() => setActiveTab("rubrics")}
            >
              <Award size={14} />
              Scoring Rubrics
            </button>
          </div>

          {/* Info Alert Box */}
          <div className="kit-info-alert">
            <Info size={15} className="flex-shrink-0" />
            <span>
              {activeTab === "technical" && "Evaluates candidate's conceptual and practical mastery of core JD technologies."}
              {activeTab === "resume" && "Specifically validates projects, contributions, and architectural claims made on the candidate's resume."}
              {activeTab === "gaps" && "Probes unverified or missing competencies identified during JD gap matching."}
              {activeTab === "behavioral" && "Assesses teamwork, leadership, conflict resolution, and ownership using the STAR method."}
              {activeTab === "rubrics" && "Standardized evaluation benchmarks to maintain objectivity and reduce interviewer bias."}
            </span>
          </div>

          {/* Question List Panes */}
          <div className="kit-questions-container">
            {activeTab === "technical" && techQuestions.map((q, idx) => (
              <div className="question-card-item" key={idx}>
                <div className="question-card-top">
                  <span className="question-topic-pill">{q.topic || "Technical"}</span>
                  <span className="question-q-num">Q{idx + 1}</span>
                </div>
                <h4 className="question-text-title">{idx + 1}. {q.question}</h4>
                <div className="question-guidance-box">
                  <div className="guidance-green">
                    <div className="guidance-header">
                      <Check size={13} />
                      <strong>What a Strong Answer Looks Like:</strong>
                    </div>
                    <p className="guidance-content">{q.expected_answer || "Mentions clear conceptual understanding and trade-offs."}</p>
                  </div>
                  {q.red_flags && (
                    <div className="guidance-red">
                      <div className="guidance-header">
                        <Flag size={13} />
                        <strong>Red Flags to Watch For:</strong>
                      </div>
                      <p className="guidance-content">{q.red_flags}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {activeTab === "resume" && resumeQuestions.map((q, idx) => (
              <div className="question-card-item" key={idx}>
                <div className="question-card-top">
                  <span className="question-topic-pill" style={{ background: "#e0f2fe", color: "#0369a1", borderColor: "#bae6fd" }}>
                    Claim: {q.topic || q.reference_claim || "Project Claim"}
                  </span>
                  <span className="question-q-num">Q{idx + 1}</span>
                </div>
                <h4 className="question-text-title">{idx + 1}. {q.question}</h4>
                <div className="question-guidance-box">
                  <div className="guidance-green">
                    <div className="guidance-header">
                      <Check size={13} />
                      <strong>Key Verification Points:</strong>
                    </div>
                    <p className="guidance-content">{q.expected_answer || "Validates personal contribution, architecture decisions, and measured outcomes."}</p>
                  </div>
                  {q.red_flags && (
                    <div className="guidance-red">
                      <div className="guidance-header">
                        <Flag size={13} />
                        <strong>Red Flags:</strong>
                      </div>
                      <p className="guidance-content">{q.red_flags}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {activeTab === "gaps" && gapQuestions.map((q, idx) => (
              <div className="question-card-item" key={idx}>
                <div className="question-card-top">
                  <span className="question-topic-pill" style={{ background: "#fef3c7", color: "#b45309", borderColor: "#fde68a" }}>
                    Gap: {q.topic || "Skill Competency"}
                  </span>
                  <span className="question-q-num">Q{idx + 1}</span>
                </div>
                <h4 className="question-text-title">{idx + 1}. {q.question}</h4>
                <div className="question-guidance-box">
                  <div className="guidance-green">
                    <div className="guidance-header">
                      <Check size={13} />
                      <strong>Expected Competence Signals:</strong>
                    </div>
                    <p className="guidance-content">{q.expected_answer || "Demonstrates grasp of foundational principles or ability to ramp quickly."}</p>
                  </div>
                  {q.red_flags && (
                    <div className="guidance-red">
                      <div className="guidance-header">
                        <Flag size={13} />
                        <strong>Warning Indicators:</strong>
                      </div>
                      <p className="guidance-content">{q.red_flags}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {activeTab === "behavioral" && behavioralQuestions.map((q, idx) => (
              <div className="question-card-item" key={idx}>
                <div className="question-card-top">
                  <span className="question-topic-pill" style={{ background: "#f3e8ff", color: "#7e22ce", borderColor: "#e9d5ff" }}>
                    STAR: {q.topic || "Behavioral"}
                  </span>
                  <span className="question-q-num">Q{idx + 1}</span>
                </div>
                <h4 className="question-text-title">{idx + 1}. {q.question}</h4>
                <div className="question-guidance-box">
                  <div className="guidance-green">
                    <div className="guidance-header">
                      <Check size={13} />
                      <strong>What a Strong STAR Response Includes:</strong>
                    </div>
                    <p className="guidance-content">{q.expected_answer || q.star_guidelines || "Clear Situation, specific Action taken personally, and measurable Result."}</p>
                  </div>
                  {q.red_flags && (
                    <div className="guidance-red">
                      <div className="guidance-header">
                        <Flag size={13} />
                        <strong>Red Flags:</strong>
                      </div>
                      <p className="guidance-content">{q.red_flags}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {activeTab === "rubrics" && (
              <div className="rubrics-grid">
                {[
                  {
                    title: "1. Technical Competency & Depth",
                    desc: "Mastery of required languages, frameworks, concurrency, algorithms, and core domain tools.",
                    benchmark: "Strong conceptual understanding, avoids anti-patterns, explains trade-offs with nuance."
                  },
                  {
                    title: "2. System Design & Architectural Vision",
                    desc: "Ability to structure maintainable, scalable, observable, and resilient software components.",
                    benchmark: "Considers fault tolerance, caching, data modeling, latency, and operational boundaries."
                  },
                  {
                    title: "3. Problem Solving & Critical Thinking",
                    desc: "Deconstructs ambiguous requirements into clear testable milestones and incremental solutions.",
                    benchmark: "Asks clarifying questions, iterates rationally, and systematically diagnoses edge cases."
                  },
                  {
                    title: "4. Communication & Cultural Contribution",
                    desc: "Articulates complex technical ideas with clarity, empathy, and active listening.",
                    benchmark: "Receptive to feedback, collaborative mindset, transparent about limitations."
                  }
                ].map((rubric, i) => (
                  <div className="rubric-card" key={i}>
                    <h4 className="rubric-card-title">{rubric.title}</h4>
                    <p className="rubric-card-desc">{rubric.desc}</p>
                    <div className="rubric-scale-row">
                      <span className="scale-item">1 - Unsatisfactory</span>
                      <span className="scale-item">2 - Needs Work</span>
                      <span className="scale-item">3 - Meets Role</span>
                      <span className="scale-item">4 - Exceeds</span>
                      <span className="scale-item">5 - Outstanding</span>
                    </div>
                    <div className="rubric-benchmark-box">
                      <strong>Target Benchmark:</strong> {rubric.benchmark}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
