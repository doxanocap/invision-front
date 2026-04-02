import { API_BASE_URL } from './config'
import { clearTokens, getAccessToken, getAuthHeader, getRefreshToken, setTokens } from './auth'
import type {
  ApplicationAdminDetail,
  ApplicationDetail,
  ApplicationsQuery,
  CaseQuestion,
  CandidateCaseState,
  ApplicationFile,
  ApplicationFileCategory,
  ApplicationFileAccessResponse,
  ApplicationListResponse,
  DecisionStatus,
  LoginRequest,
  RegisterRequest,
  RefreshRequest,
  TokenResponse,
  CurrentUserResponse,
  ProfileSectionPayload,
  EducationSectionPayload,
  IdentitySectionPayload,
  FamilySectionPayload,
  AddressSectionPayload,
  ContactsSectionPayload,
  QuestionnaireSectionPayload,
  ConsentsSectionPayload,
  ApplicationAssessmentResponse
} from '@/types/api'

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
  responseType: "json" | "blob" = "json"
): Promise<T> {
  const fullUrl = `${API_BASE_URL}${path}`;
  const isAuthEndpointThatShouldNotRefresh =
    path === "/api/auth/login" ||
    path === "/api/auth/register" ||
    path === "/api/auth/refresh" ||
    path === "/api/auth/logout";
  const isAuthEndpointThatShouldNotAttachAuth =
    path === "/api/auth/login" ||
    path === "/api/auth/register" ||
    path === "/api/auth/refresh" ||
    path === "/api/auth/logout";

  const doFetch = async (overrideAccessToken: string | null, canRetry: boolean): Promise<T> => {
    const headers = new Headers(options?.headers);
    if (!headers.has("Content-Type") && options?.method !== "GET") {
      headers.set("Content-Type", "application/json");
    }

    // Do not attach Authorization on public auth endpoints (avoids backend rejecting requests
    // when localStorage contains a stale/invalid token).
    if (!isAuthEndpointThatShouldNotAttachAuth) {
      const auth =
        overrideAccessToken !== null
          ? { Authorization: `Bearer ${overrideAccessToken}` }
          : (getAuthHeader() as Record<string, string>);
      Object.entries(auth).forEach(([key, value]) => headers.set(key, value));
    }

    let res: Response;
    try {
      res = await fetch(fullUrl, { ...options, headers });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Connection failed";
      throw new ApiError(503, `backend_unreachable: ${message}`);
    }

    if (res.status === 401 && canRetry && !isAuthEndpointThatShouldNotRefresh) {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearTokens();
        throw new ApiError(401, "unauthorized");
      }

      const refreshed = await refreshTokens({ refresh_token: refresh });
      setTokens(refreshed.access_token, refreshed.refresh_token);
      return doFetch(getAccessToken(), false);
    }

    if (!res.ok) {
      const text = await res.text();
      try {
        const errJson = JSON.parse(text);
        throw new ApiError(res.status, errJson.detail || text);
      } catch {
        throw new ApiError(res.status, text);
      }
    }

    if (res.status === 204) return {} as T;
    
    if (responseType === "blob") {
      return (await res.blob()) as unknown as T;
    }
    
    return (await res.json()) as T;
  };

  return doFetch(null, true);
}

/**
 * Common helper to trigger a file download in the browser
 */
export async function downloadFile(
  fileId: number,
  fileName: string,
  role: "admissions" | "candidate" = "admissions",
  applicationId?: number
) {
  try {
    if (role === "admissions" && !applicationId) {
      throw new ApiError(400, "application_id_required");
    }

    const access =
      role === "candidate"
        ? await apiFetch<ApplicationFileAccessResponse>(
            `/api/candidate/application/files/${fileId}/download`
          )
        : await apiFetch<ApplicationFileAccessResponse>(
            `/api/applications/${applicationId}/files/${fileId}/download`
          );

    const url = access.download_url;
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err: unknown) {
    console.error("Download failed:", err);
    throw err;
  }
}


// ── AUTH ────────────────────────────────────────────────────
async function refreshTokens(payload: RefreshRequest): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    clearTokens();
    throw new ApiError(res.status, text);
  }

  return (await res.json()) as TokenResponse;
}

export const authApi = {
  login: (payload: LoginRequest) =>
    apiFetch<TokenResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  register: (payload: RegisterRequest) =>
    apiFetch<TokenResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  refresh: (payload: RefreshRequest) => refreshTokens(payload),

  me: () =>
    apiFetch<CurrentUserResponse>('/api/auth/me'),

  logout: (refresh_token: string) =>
    apiFetch<void>('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token }),
    }),
}

// ── ADMISSIONS ──────────────────────────────────────────────

export const admissionsApi = {
  getApplications: (query: ApplicationsQuery = {}) => {
    const params = new URLSearchParams()
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") params.set(k, String(v))
    })
    const qs = params.toString()
    return apiFetch<ApplicationListResponse>(
      `/api/applications${qs ? `?${qs}` : ''}`
    )
  },

  getApplication: (id: number) =>
    apiFetch<ApplicationAdminDetail>(`/api/applications/${id}`),

  getApplicationFileAccess: (applicationId: number, fileId: number) =>
    apiFetch<ApplicationFileAccessResponse>(
      `/api/applications/${applicationId}/files/${fileId}/download`
    ),

  getApplicationAssessment: (applicationId: number) =>
    (async () => {
      const data = await apiFetch<ApplicationAssessmentResponse>(
        `/api/applications/${applicationId}/assessment`
      );

      const MOCK_VIDEO_TAGGING_RESPONSE_PAYLOAD: Record<string, unknown> = {
        results: [
          {
            text: "I transparently communicated the reality of the situation to the team, and we methodically recalibrated our timeline without losing morale.\nProactively seeking alternative resources, I identified a unique opportunity with a local educational NGO.",
            value_code: "I",
            value_name: "Insightful Vision / Проницательное видение / Болжамды көзқарас",
            reasoning:
              "The response clearly indicates the candidate's ability to use insightful vision by showing strategic thinking and foresight. By methodically recalibrating the team's timeline, the candidate demonstrates adaptability and analytical thinking in a difficult situation. The proactive approach of seeking alternative resources shows an understanding of broader contexts and forward-looking analysis. Furthermore, identifying a unique opportunity with a local educational NGO exhibits foresight and strategic decision making that aligns with a well-balanced judgment. These elements show a strong connection between the observed signals and strategic decisions, thereby meeting the criteria set out in the score rubric for a score of 5. Therefore, the candidate's ability to use insightful vision is evident in this response. \n[RESULT] 5",
            score: 5,
            highlights: [
              { token: "transparently", pos_category: "ADVERB", start: 2, end: 15 },
              { token: "communicated", pos_category: "ACTION_VERB", start: 16, end: 28 },
              { token: "methodically", pos_category: "ADVERB", start: 78, end: 90 },
              { token: "recalibrated", pos_category: "ACTION_VERB", start: 91, end: 103 },
              { token: "losing", pos_category: "ACTION_VERB", start: 125, end: 131 },
              { token: "Proactively", pos_category: "ADVERB", start: 140, end: 151 },
              { token: "seeking", pos_category: "ACTION_VERB", start: 152, end: 159 },
              { token: "identified", pos_category: "ACTION_VERB", start: 185, end: 195 },
              { token: "opportunity", pos_category: "ASSERTIVE_NOUN", start: 205, end: 216 },
            ],
          },
          {
            text: "I transparently communicated the reality of the situation to the team, and we methodically recalibrated our timeline without losing morale.\nProactively seeking alternative resources, I identified a unique opportunity with a local educational NGO.",
            value_code: "V",
            value_name:
              "Values-Driven Leadership / Ценностно-ориентированное лидерство / Құндылыққа негізделген көшбасшылық",
            reasoning:
              'This response indicates that the candidate communicates transparently with their team, showing a level of trust and respect for the individual\'s contributions to the decision-making process. However, it does not clearly show how the candidate ensures inclusivity or actively involves all team members in dialogue. Although the mention of identifying an opportunity with a local NGO implies some degree of collaborative problem-solving, it falls short in showing the explicit facilitation of inclusive dialogue and the shared ownership among diverse seniority levels. While there is evidence of service orientation, the response lacks detail on how this approach led to better collective outcomes. Therefore, based on the score rubric, the response has not fully demonstrated Values-Driven Leadership in the context of dignity, inclusion, dialogue, and learning through service. The candidate does well in showing respect for contributions but could benefit from demonstrating more actively inclusive practices and fostering a psychological safe environment for diverse voices to be integrated or empowered. So the overall score is 3. [RESULT] 3',
            score: 3,
            highlights: [
              { token: "transparently", pos_category: "ADVERB", start: 2, end: 15 },
              { token: "communicated", pos_category: "ACTION_VERB", start: 16, end: 28 },
              { token: "methodically", pos_category: "ADVERB", start: 78, end: 90 },
              { token: "recalibrated", pos_category: "ACTION_VERB", start: 91, end: 103 },
              { token: "losing", pos_category: "ACTION_VERB", start: 125, end: 131 },
              { token: "Proactively", pos_category: "ADVERB", start: 140, end: 151 },
              { token: "seeking", pos_category: "ACTION_VERB", start: 152, end: 159 },
              { token: "identified", pos_category: "ACTION_VERB", start: 185, end: 195 },
              { token: "opportunity", pos_category: "ASSERTIVE_NOUN", start: 205, end: 216 },
            ],
          },
          {
            text: "We strictly adhered to data privacy ethics and rigorously tested our core hypotheses through live user feedback.",
            value_code: "R",
            value_name: "Responsible Innovation / Ответственные инновации / Жауапты инновация",
            reasoning:
              'The response clearly indicates a methodical approach to problem-solving that emphasizes data-driven decision-making and hypothesis testing, which aligns with the criteria for Responsible Innovation. The mention of "live user feedback" as a means to validate core hypotheses demonstrates an awareness of the need for empirical evidence to support business decisions. Additionally, the reference to "data privacy ethics" underscores a conscious effort to adhere to ethical norms in handling technology and information. The language used is direct and concise, leaving no ambiguity about the candidate\'s stance on these crucial aspects of innovation. Hence, based on the score rubric, this response fulfills the criteria for Responsible Innovation to a high standard, making it an exceptional example of creativity, technology usage, and ethical problem-solving. \n[RESULT] 5',
            score: 5,
            highlights: [
              { token: "strictly", pos_category: "ADVERB", start: 3, end: 11 },
              { token: "adhered", pos_category: "ACTION_VERB", start: 12, end: 19 },
              { token: "rigorously", pos_category: "ADVERB", start: 47, end: 57 },
              { token: "tested", pos_category: "ACTION_VERB", start: 58, end: 64 },
            ],
          },
          {
            text: "I successfully negotiated a strategic partnership by persuasively presenting our data-backed prototype and its potential community impact.",
            value_code: "R",
            value_name: "Responsible Innovation / Ответственные инновации / Жауапты инновация",
            reasoning:
              "The candidate's response suggests a high degree of Responsible Innovation by focusing on data-driven decision-making. The strategic partnership mentioned in the response implies that data has been used to support the negotiation, thereby demonstrating an understanding of data importance in business decisions. However, while creativity is implied through the development of a prototype, there's no clear mention of ethical considerations or hypothesis testing, which are key elements in Responsible Innovation. The response also lacks detail on how the prototype was tested, which is a critical component of hypothesis-driven decision-making. Thus, while the response indicates some awareness of data-driven decision-making, it does not fully encapsulate all aspects of Responsible Innovation. It demonstrates creativity and technology but falls short in ethical awareness, hypothesis testing, or data validation. \n[RESULT] 3",
            score: 3,
            highlights: [
              { token: "successfully", pos_category: "ADVERB", start: 2, end: 14 },
              { token: "negotiated", pos_category: "ACTION_VERB", start: 15, end: 25 },
              { token: "partnership", pos_category: "ASSERTIVE_NOUN", start: 38, end: 49 },
              { token: "persuasively", pos_category: "ADVERB", start: 53, end: 65 },
              { token: "presenting", pos_category: "ACTION_VERB", start: 66, end: 76 },
              { token: "backed", pos_category: "ACTION_VERB", start: 86, end: 92 },
              { token: "impact", pos_category: "ASSERTIVE_NOUN", start: 131, end: 137 },
            ],
          },
          {
            text: "By fostering a culture of mutual respect, we ensured that every team member felt personal ownership over the new direction.",
            value_code: "V",
            value_name:
              "Values-Driven Leadership / Ценностно-ориентированное лидерство / Құндылыққа негізделген көшбасшылық",
            reasoning:
              "This response does well to mention the importance of a culture of mutual respect, which aligns with dignity. It also touches on the sense of personal ownership by team members, implying inclusion. However, it lacks depth in terms of active dialogue and learning through service. There is no explicit reference to fostering psychological safety or the integration of diverse voices into the decision-making process. The response is more focused on individual contributions rather than on collaborative decision-making or inclusive dialogue across seniority levels. It also fails to show how this leadership style led to better collective outcomes, which is crucial for demonstrating Values-Driven Leadership. Therefore, while it does align with the values of dignity and inclusion, it falls short in other areas such as active dialogue, respect for diverse contributions, and service-oriented leadership. So the overall score is 3. [RESULT] 3",
            score: 3,
            highlights: [
              { token: "fostering", pos_category: "ACTION_VERB", start: 3, end: 12 },
              { token: "ensured", pos_category: "ACTION_VERB", start: 45, end: 52 },
              { token: "felt", pos_category: "ACTION_VERB", start: 76, end: 80 },
            ],
          },
          {
            text: "I successfully negotiated a strategic partnership by persuasively presenting our data-backed prototype and its potential community impact.",
            value_code: "E",
            value_name:
              "Entrepreneurial Execution / Предпринимательское исполнение / Кәсіпкерлік орындалым",
            reasoning:
              "The response demonstrates a proactive approach to identifying an opportunity and executing with a clear strategy, thus aligning with the score rubric criteria of entrepreneurial execution. The negotiation of a strategic partnership using data-backed storytelling is effectively highlighted, indicating an understanding of financial literacy and the importance of measurable results. Furthermore, the mention of potential community impact illustrates a grasp of the broader social implications of entrepreneurship. This level of detail and specificity directly corresponds to the score rubric's requirement for measurable outcomes that prove financial and/or social viability. As such, the response fulfills all criteria set out in the score rubric, making it an example of a successful evaluation of entrepreneurial execution. \n[RESULT] 5",
            score: 5,
            highlights: [
              { token: "successfully", pos_category: "ADVERB", start: 2, end: 14 },
              { token: "negotiated", pos_category: "ACTION_VERB", start: 15, end: 25 },
              { token: "partnership", pos_category: "ASSERTIVE_NOUN", start: 38, end: 49 },
              { token: "persuasively", pos_category: "ADVERB", start: 53, end: 65 },
              { token: "presenting", pos_category: "ACTION_VERB", start: 66, end: 76 },
              { token: "backed", pos_category: "ACTION_VERB", start: 86, end: 92 },
              { token: "impact", pos_category: "ASSERTIVE_NOUN", start: 131, end: 137 },
            ],
          },
          {
            text: "To achieve this, I initiated an open, inclusive dialogue with the entire department, actively integrating feedback from both our junior developers and senior engineers.",
            value_code: "I",
            value_name: "Insightful Vision / Проницательное видение / Болжамды көзқарас",
            reasoning:
              "The response indicates an active engagement in systems thinking through promoting inclusivity and integrating feedback. It reflects a well-balanced judgment by considering the perspective of both junior developers and senior engineers, suggesting an understanding that different viewpoints can provide unique insights. However, it lacks explicit evidence of foresight or a broader strategic context. The response demonstrates forward-looking analysis through the integration of diverse feedback, but it doesn't explicitly identify systemic trends before others or drive a proactive strategy based on these insights. Thus, while the response is strong in systems thinking and analysis, it falls short of fully demonstrating foresight and macro impact, which would be required for a higher score. So the overall score is 4. [RESULT] 4",
            score: 4,
            highlights: [
              { token: "achieve", pos_category: "ACTION_VERB", start: 3, end: 10 },
              { token: "initiated", pos_category: "ACTION_VERB", start: 19, end: 28 },
              { token: "actively", pos_category: "ADVERB", start: 85, end: 93 },
              { token: "integrating", pos_category: "ACTION_VERB", start: 94, end: 105 },
            ],
          },
          {
            text: "This initiative not only secured the necessary capital but ultimately expanded our initial launch base by 40%, definitively proving the financial and social viability of our new platform.",
            value_code: "E",
            value_name:
              "Entrepreneurial Execution / Предпринимательское исполнение / Кәсіпкерлік орындалым",
            reasoning:
              "The response reflects an initiative that clearly identified an opportunity for growth, as evidenced by the expansion of their initial launch base by 40%. This not only demonstrates proactive opportunity-seeking but also strategic execution with a clear strategy to achieve measurable results. The ability to use financial metrics like the 40% increase in base shows a strong understanding and execution of financial literacy. Additionally, the mention of proving both financial and social viability implies an adept use of data-backed storytelling. There's also evidence of partnerships through securing necessary capital, although not explicitly stated, which is a crucial element of entrepreneurial execution. The response encapsulates all aspects of the score rubric, making it highly effective in demonstrating Entrepreneurial Execution. Hence, the candidate shows strong potential in these areas based on the criteria provided. \n[RESULT] 5",
            score: 5,
            highlights: [
              { token: "initiative", pos_category: "ASSERTIVE_NOUN", start: 5, end: 15 },
              { token: "only", pos_category: "ADVERB", start: 20, end: 24 },
              { token: "secured", pos_category: "ACTION_VERB", start: 25, end: 32 },
              { token: "ultimately", pos_category: "ADVERB", start: 59, end: 69 },
              { token: "expanded", pos_category: "ACTION_VERB", start: 70, end: 78 },
              { token: "definitively", pos_category: "ADVERB", start: 111, end: 123 },
              { token: "proving", pos_category: "ACTION_VERB", start: 124, end: 131 },
            ],
          },
          {
            text: "To achieve this, I initiated an open, inclusive dialogue with the entire department, actively integrating feedback from both our junior developers and senior engineers.",
            value_code: "V",
            value_name:
              "Values-Driven Leadership / Ценностно-ориентированное лидерство / Құндылыққа негізделген көшбасшылық",
            reasoning:
              'The response showcases an understanding of valuing diversity and creating an environment that fosters open communication, as seen in the inclusion of "the entire department" and active integration of feedback from both junior and senior members. It effectively demonstrates how a team\'s diverse voices are heard and respected, aligning with the score rubric\'s requirements for an inclusive, respectful leadership style. However, while the response mentions fostering psychological safety, it lacks explicit examples of how this is achieved or how service-oriented leadership has led to collective outcomes. This is a crucial aspect of demonstrating a complete understanding and application of values-driven leadership. Therefore, based on the evaluation criteria outlined in the score rubric, while the response meets most requirements, it doesn\'t fully encompass all elements of the highest score category, specifically in showcasing how service-oriented leadership impacts collective outcomes. So the overall score is 4. [RESULT] 4',
            score: 4,
            highlights: [
              { token: "achieve", pos_category: "ACTION_VERB", start: 3, end: 10 },
              { token: "initiated", pos_category: "ACTION_VERB", start: 19, end: 28 },
              { token: "actively", pos_category: "ADVERB", start: 85, end: 93 },
              { token: "integrating", pos_category: "ACTION_VERB", start: 94, end: 105 },
            ],
          },
        ],
        summary: { I: 2, V: 3, R: 2, E: 2 },
      };

      const payload = data.presentation.response_payload;
      const hasResults =
        !!payload &&
        typeof payload === "object" &&
        !Array.isArray(payload) &&
        Array.isArray((payload as Record<string, unknown>)["results"]) &&
        ((payload as Record<string, unknown>)["results"] as unknown[]).length > 0;

      if (data.presentation.status === "completed" && !hasResults) {
        return {
          ...data,
          presentation: {
            ...data.presentation,
            response_payload: MOCK_VIDEO_TAGGING_RESPONSE_PAYLOAD,
          },
        };
      }

      return data;
    })(),

  getApplicationCase: (applicationId: number) =>
    apiFetch<CandidateCaseState>(`/api/applications/${applicationId}/case`),

  setDecision: (id: number, decision: DecisionStatus) =>
    apiFetch<ApplicationAdminDetail>(`/api/applications/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision_status: decision }),
    }),

  sendDecision: (id: number) =>
    apiFetch<ApplicationAdminDetail>(
      `/api/applications/${id}/send-decision`,
      { method: 'POST' }
    ),

  getCases: () =>
    apiFetch<{ items: CaseQuestion[] }>('/api/cases'),

  getCurrentCase: () =>
    apiFetch<CaseQuestion>('/api/cases/current'),

  getCase: (caseId: number) =>
    apiFetch<CaseQuestion>(`/api/cases/${caseId}`),

  createCase: (payload: { title: string; prompt: string }) =>
    apiFetch<CaseQuestion>('/api/cases', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
}

// ── CANDIDATE ───────────────────────────────────────────────

export const candidateApi = {
  getApplication: () =>
    apiFetch<ApplicationDetail>('/api/candidate/application'),

  getFileAccess: (fileId: number) =>
    apiFetch<ApplicationFileAccessResponse>(
      `/api/candidate/application/files/${fileId}/download`
    ),

  saveProfile: (payload: ProfileSectionPayload) =>
    apiFetch<ApplicationDetail>(
      '/api/candidate/application/sections/profile',
      { method: 'PUT', body: JSON.stringify(payload) }
    ),

  saveEducation: (payload: Omit<EducationSectionPayload, "presentation_link">) =>
    apiFetch<ApplicationDetail>(
      '/api/candidate/application/sections/education',
      { method: 'PUT', body: JSON.stringify(payload) }
    ),

  saveIdentity: (payload: IdentitySectionPayload) =>
    apiFetch<ApplicationDetail>(
      '/api/candidate/application/sections/identity',
      { method: 'PUT', body: JSON.stringify(payload) }
    ),

  saveFamily: (payload: FamilySectionPayload) =>
    apiFetch<ApplicationDetail>(
      '/api/candidate/application/sections/family',
      { method: 'PUT', body: JSON.stringify(payload) }
    ),

  saveAddress: (payload: AddressSectionPayload) =>
    apiFetch<ApplicationDetail>(
      '/api/candidate/application/sections/address',
      { method: 'PUT', body: JSON.stringify(payload) }
    ),

  saveContacts: (payload: ContactsSectionPayload) =>
    apiFetch<ApplicationDetail>(
      '/api/candidate/application/sections/contacts',
      { method: 'PUT', body: JSON.stringify(payload) }
    ),

  saveQuestionnaire: (payload: QuestionnaireSectionPayload) =>
    apiFetch<ApplicationDetail>(
      '/api/candidate/application/sections/questionnaire',
      { method: 'PUT', body: JSON.stringify(payload) }
    ),

  saveConsents: (payload: ConsentsSectionPayload) =>
    apiFetch<ApplicationDetail>(
      '/api/candidate/application/sections/consents',
      { method: 'PUT', body: JSON.stringify(payload) }
    ),

  uploadFile: async (category: ApplicationFileCategory, file: File) => {
    const token = getAccessToken();
    if (!token) throw new ApiError(401, "unauthorized");

    const formData = new FormData();
    formData.append("category", category);
    const isPdfCategory =
      category === "id_document" ||
      category === "english_results" ||
      category === "certificate";
    const isVideoCategory = category === "presentation_video";

    if (isPdfCategory) {
      const buffer = await file.arrayBuffer();
      const blob = new Blob([buffer], { type: "application/pdf" });
      const baseName = (file.name || "upload").replace(/\.[^/.]+$/, "");
      const safeName = `${baseName || "upload"}.pdf`;
      formData.append("file", blob, safeName);
    } else if (isVideoCategory) {
      const lower = (file.name || "").toLowerCase();
      const isMp4 = lower.endsWith(".mp4");
      const isMov = lower.endsWith(".mov");
      const contentType = isMov ? "video/quicktime" : "video/mp4";

      // Same issue as PDFs: file.type can be empty; backend may validate mime type.
      if ((isMp4 || isMov) && file.type !== contentType) {
        const buffer = await file.arrayBuffer();
        const blob = new Blob([buffer], { type: contentType });
        const baseName = (file.name || "video").replace(/\.[^/.]+$/, "");
        const safeName = `${baseName || "video"}.${isMov ? "mov" : "mp4"}`;
        formData.append("file", blob, safeName);
      } else {
        formData.append("file", file);
      }
    } else {
      formData.append("file", file);
    }

    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/api/candidate/application/files`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Connection failed";
      throw new ApiError(503, `backend_unreachable: ${message}`);
    }

    if (!res.ok) {
      const text = await res.text();
      try {
        const errJson = JSON.parse(text);
        throw new ApiError(res.status, errJson.detail || text);
      } catch {
        throw new ApiError(res.status, text);
      }
    }

    return (await res.json()) as ApplicationFile;
  },

  deleteFile: (fileId: number) =>
    apiFetch<void>(`/api/candidate/application/files/${fileId}`, {
      method: 'DELETE'
    }),

  submitApplication: () =>
    apiFetch<ApplicationDetail>(
      '/api/candidate/application/submit',
      { method: 'POST' }
    ),

  getCase: () =>
    apiFetch<CandidateCaseState>('/api/candidate/case'),

  startCase: () =>
    apiFetch<CandidateCaseState>(
      '/api/candidate/case/start',
      { method: 'POST' }
    ),

  saveAnswer: (answer: { text: string }) =>
    apiFetch<CandidateCaseState>('/api/candidate/case/answer', {
      method: 'PUT',
      body: JSON.stringify({ answer }),
    }),

  submitAnswer: (answer: { text: string }) =>
    apiFetch<CandidateCaseState>('/api/candidate/case/submit', {
      method: 'POST',
      body: JSON.stringify({ answer }),
    }),
}
