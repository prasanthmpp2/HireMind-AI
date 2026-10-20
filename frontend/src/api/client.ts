import type { AiMode, AuthUser, Candidate, CandidateOwner, InterviewKit, Job, MatchResult, ResumeDraft, ResumeDesign, ScreeningResult } from "./types";
import type { ResumeData } from "../types/resume";

const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim() || "/api/v1";
export const API_BASE_URL = configuredBase.replace(/\/+$/, "");
let csrfToken = "";

export function setCsrfToken(value: string): void { csrfToken = value; }

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = "request_failed") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type Envelope<T> = { item: T };
type ListEnvelope<T> = { items: T[] };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (["POST", "PUT", "PATCH", "DELETE"].includes((init.method || "GET").toUpperCase()) && csrfToken) headers.set("X-CSRF-Token", csrfToken);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: "include" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("Cannot reach HireMind API. Check that the backend is running.", 0, "network_error");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || `Request failed (${response.status}).`;
    const code = payload?.error?.code || "request_failed";
    throw new ApiError(message, response.status, code);
  }
  return payload as T;
}

const json = (method: string, data?: unknown): RequestInit => ({
  method,
  body: data === undefined ? undefined : JSON.stringify(data)
});

export const api = {
  registerCandidate: async (email: string, password: string, personal: ResumeData["personal"]) => {
    const result = await request<{ user: AuthUser; csrf_token: string }>("/auth/register", json("POST", { email, password, personal }));
    setCsrfToken(result.csrf_token); return result.user;
  },
  login: async (email: string, password: string) => {
    const result = await request<{ user: AuthUser; csrf_token: string }>("/auth/login", json("POST", { email, password }));
    setCsrfToken(result.csrf_token); return result.user;
  },
  session: async (signal?: AbortSignal) => {
    const result = await request<{ user: AuthUser; csrf_token: string }>("/auth/session", { signal });
    setCsrfToken(result.csrf_token); return result.user;
  },
  logout: () => request<{ status: string }>("/auth/logout", json("POST")),
  deleteAccount: () => request<{ status: string }>("/auth/account", json("DELETE")),
  resumeDrafts: (owner: CandidateOwner, signal?: AbortSignal) =>
    request<{ items: ResumeDraft[] }>(`/candidate-profiles/${owner.candidateId}/resumes`, { signal }),
  createResumeDraft: async (owner: CandidateOwner, payload: { name: string; resume: ResumeData; design: ResumeDesign }) =>
    (await request<{ item: ResumeDraft }>(`/candidate-profiles/${owner.candidateId}/resumes`, json("POST", { schema_version: 1, ...payload }))).item,
  updateResumeDraft: async (owner: CandidateOwner, id: number, payload: { name: string; resume: ResumeData; design: ResumeDesign }) =>
    (await request<{ item: ResumeDraft }>(`/candidate-profiles/${owner.candidateId}/resumes/${id}`, json("PUT", { schema_version: 1, ...payload }))).item,
  resumeDraft: async (owner: CandidateOwner, id: number, signal?: AbortSignal) =>
    (await request<{ item: ResumeDraft }>(`/candidate-profiles/${owner.candidateId}/resumes/${id}`, { signal })).item,
  deleteResumeDraft: (owner: CandidateOwner, id: number) =>
    request<{ status: string; id: number }>(`/candidate-profiles/${owner.candidateId}/resumes/${id}`, json("DELETE")),
  generateText: (prompt: string, signal?: AbortSignal) =>
    request<{ text: string; ai_mode: AiMode; metadata: { provider_status: string; provider?: string | null; model?: string | null; fallback_reason?: string | null } }>("/ai/generate", {
      ...json("POST", { prompt }), signal
    }),
  health: (signal?: AbortSignal) => request<{ status: string }>("/health", { signal }),
  jobs: (signal?: AbortSignal) => request<ListEnvelope<Job>>("/jobs", { signal }),
  createJob: async (data: Omit<Job, "id" | "created_at" | "match_count">) =>
    (await request<Envelope<Job>>("/jobs", json("POST", data))).item,
  updateJob: async (id: number, data: Partial<Omit<Job, "id">>) =>
    (await request<Envelope<Job>>(`/jobs/${id}`, json("PATCH", data))).item,
  deleteJob: (id: number) => request<{ status: string; id: number }>(`/jobs/${id}`, json("DELETE")),
  candidates: (signal?: AbortSignal) => request<ListEnvelope<Candidate>>("/candidates", { signal }),
  candidate: async (id: number, signal?: AbortSignal) =>
    (await request<Envelope<Candidate>>(`/candidates/${id}`, { signal })).item,
  deleteCandidate: (id: number) => request<{ status: string; id: number }>(`/candidates/${id}`, json("DELETE")),
  uploadResumes: (files: File[], signal?: AbortSignal) => {
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    return request<ScreeningResult>("/resumes", { method: "POST", body: form, signal });
  },
  matchCandidates: (jobId: number, candidateIds?: number[], signal?: AbortSignal) =>
    request<{ status: string; ai_mode: AiMode; metadata: Record<string, unknown>; job: Job; results: MatchResult[] }>(
      "/matching-runs",
      { ...json("POST", { job_id: jobId, candidate_ids: candidateIds }), signal }
    ),
  jobMatches: (jobId: number, signal?: AbortSignal) =>
    request<ListEnvelope<MatchResult>>(`/jobs/${jobId}/matches`, { signal }),
  interviewKit: (candidateId: number, jobId: number, signal?: AbortSignal) =>
    request<{ status: string; ai_mode: AiMode; metadata: { provider_status: string; fallback_reason?: string | null }; item: InterviewKit }>(
      `/candidates/${candidateId}/interview-kits`,
      { ...json("POST", { job_id: jobId }), signal }
    )
};

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
