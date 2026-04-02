import { API_BASE_URL, FRONTEND_URL } from './config'
import type {
  ApplicationDetail,
  ApplicationsQuery,
  CaseQuestion,
  CandidateCaseState,
  ApplicationFile,
  ApplicationListResponse,
  DecisionStatus
} from '@/types/api'

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// Base fetch wrapper
export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
  token?: string
): Promise<T> {
  const targetUrl = API_BASE_URL;

  const headers = new Headers(options?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    const cleanToken = token.replace(/[^\x20-\x7E]/g, '').trim();
    headers.set('Authorization', cleanToken.startsWith('Bearer') ? cleanToken : `Bearer ${cleanToken}`);
  }

  let res: Response;
  try {
    res = await fetch(`${targetUrl}${path}`, {
      ...options,
      headers,
    });
  } catch (error: any) {
    console.error(`Fetch failed for ${targetUrl}${path}:`, error);
    throw new ApiError(503, `backend_unreachable: ${error.message || 'Connection failed'}`);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text);
  }
  // handle 204 No Content
  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

// ── ADMISSIONS ──────────────────────────────────────────────

export const admissionsApi = {

  // GET /api/applications
  getApplications: (query: ApplicationsQuery = {}, token?: string) => {
    const params = new URLSearchParams()
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined) params.set(k, String(v))
    })
    const qs = params.toString()
    return apiFetch<ApplicationListResponse>(
      `/api/applications${qs ? `?${qs}` : ''}`,
      {},
      token
    )
  },

  // GET /api/applications/:id
  getApplication: (id: number, token?: string) =>
    apiFetch<ApplicationDetail>(`/api/applications/${id}`, {}, token),

  // POST /api/applications/:id/decision
  setDecision: (
    id: number,
    decision: DecisionStatus,
    token?: string
  ) =>
    apiFetch<ApplicationDetail>(`/api/applications/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision_status: decision }),
    }, token),

  // POST /api/applications/:id/send-decision
  sendDecision: (id: number, token?: string) =>
    apiFetch<ApplicationDetail>(
      `/api/applications/${id}/send-decision`,
      { method: 'POST' },
      token
    ),

  // GET /api/cases
  getCases: (token?: string) =>
    apiFetch<{ items: CaseQuestion[] }>('/api/cases', {}, token),

  // GET /api/cases/current
  getCurrentCase: (token?: string) =>
    apiFetch<CaseQuestion>('/api/cases/current', {}, token),

  // POST /api/cases
  createCase: (payload: { title: string; prompt: string }, token?: string) =>
    apiFetch<CaseQuestion>('/api/cases', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token),
}

// ── CANDIDATE ───────────────────────────────────────────────

export const candidateApi = {

  // GET /api/candidate/application
  getApplication: () =>
    apiFetch<ApplicationDetail>('/api/candidate/application'),

  // Section saves
  saveSection: <T>(
    section:
      | 'profile'
      | 'identity'
      | 'family'
      | 'address'
      | 'contacts'
      | 'education'
      | 'questionnaire'
      | 'social-support'
      | 'consents',
    payload: T
  ) =>
    apiFetch<ApplicationDetail>(
      `/api/candidate/application/sections/${section}`,
      { method: 'PUT', body: JSON.stringify(payload) }
    ),

  // POST /api/candidate/application/files
  submitFileMetadata: (payload: ApplicationFile) =>
    apiFetch<{ ok: boolean }>(
      '/api/candidate/application/files',
      { method: 'POST', body: JSON.stringify(payload) }
    ),

  // POST /api/candidate/application/submit
  submitApplication: () =>
    apiFetch<ApplicationDetail>(
      '/api/candidate/application/submit',
      { method: 'POST' }
    ),

  // GET /api/candidate/case
  getCase: () =>
    apiFetch<CandidateCaseState>('/api/candidate/case'),

  // POST /api/candidate/case/start
  startCase: () =>
    apiFetch<CandidateCaseState>(
      '/api/candidate/case/start',
      { method: 'POST' }
    ),

  // PUT /api/candidate/case/answer
  saveAnswer: (answer: Record<string, unknown>) =>
    apiFetch<CandidateCaseState>('/api/candidate/case/answer', {
      method: 'PUT',
      body: JSON.stringify({ answer }),
    }),

  // POST /api/candidate/case/submit
  submitAnswer: (answer: Record<string, unknown>) =>
    apiFetch<CandidateCaseState>('/api/candidate/case/submit', {
      method: 'POST',
      body: JSON.stringify({ answer }),
    }),
}
