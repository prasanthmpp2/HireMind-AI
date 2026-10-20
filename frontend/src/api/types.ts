export type Job = {
  id: number;
  title: string;
  department?: string | null;
  experience_required?: string | null;
  experience_years_min?: number | null;
  required_skills: string[];
  nice_to_have_skills: string[];
  responsibilities: string[];
  raw_description: string;
  created_at?: string | null;
  match_count?: number;
};

export type ResumeRecord = {
  id: number;
  candidate_id: number;
  filename: string;
  file_type: string;
  education: unknown[];
  skills: Record<string, unknown> | unknown[];
  experience: unknown[];
  projects: unknown[];
  certifications: unknown[];
  created_at?: string | null;
};

export type Candidate = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  linkedin?: string | null;
  github?: string | null;
  portfolio?: string | null;
  summary?: string | null;
  total_experience_years?: number;
  created_at?: string | null;
  resume?: ResumeRecord | null;
  editor_resume?: ResumeDraft | null;
};

export type MatchResult = {
  id: number;
  job_id: number;
  candidate_id: number;
  candidate_name: string;
  candidate_email: string;
  candidate_experience: number | null;
  job_title: string;
  overall_score: number;
  skills_score: number | null;
  experience_score: number | null;
  semantic_score: number | null;
  score_metadata: {
    ai_mode?: "provider" | "fallback" | "unknown";
    provider_status?: string;
    fallback_reason?: string | null;
    semantic_method?: string;
    embedding_status?: string;
    skills_assessed?: boolean;
    experience_assessed?: boolean;
    weights?: Record<string, number>;
    score_formula?: string;
    semantic_component_score?: number;
  };
  recommendation: string;
  matched_skills: string[];
  missing_skills: string[];
  key_strengths: string[];
  key_concerns: string[];
  rationale: string;
  created_at?: string | null;
};

export type Question = Record<string, string>;

export type InterviewKit = {
  id: number;
  job_id: number;
  candidate_id: number;
  candidate_name: string;
  job_title: string;
  technical_questions: Question[];
  resume_questions: Question[];
  gap_questions: Question[];
  behavioral_questions: Question[];
  rubrics: Record<string, unknown>;
  created_at?: string | null;
};

export type ScreeningResult = {
  status: "completed" | "completed_with_errors";
  processed: Array<{
    filename: string;
    status: "completed";
    candidate: Candidate;
    ai_mode: "provider" | "fallback";
    provider_status: string;
    fallback_reason?: string | null;
  }>;
  errors: Array<{ filename: string; status: "failed"; message: string }>;
  counts: { total: number; succeeded: number; failed: number };
  metadata?: { ai?: { modes: string[]; provider_statuses: string[]; fallback_reasons: string[] } };
};

export type AiMode = "provider" | "fallback" | "not_applicable";
import type { ResumeData, ResumeFontId, ResumeFontSizeId, SectionKey, TemplateId } from "../types/resume";


export type ResumeDesign = { template: TemplateId; font: ResumeFontId; font_size: ResumeFontSizeId; section_order: SectionKey[] };
export type ResumeDraft = {
  id: number;
  candidate_id: number;
  name: string;
  schema_version: 1;
  resume: ResumeData;
  design: ResumeDesign;
  created_at: string;
  updated_at: string;
};
export type CandidateOwner = { candidateId: number };
export type AuthUser = { id: number; email: string; role: "candidate" | "recruiter" | "admin"; candidate_id: number | null };
