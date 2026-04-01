import { getApiBaseUrl } from "./config";
import type { ApplicantListResponse, ApplicantDetail } from "@/types/api";

export async function listApplicants(params: URLSearchParams): Promise<ApplicantListResponse> {
  const res = await fetch(`/api/applicants?${params.toString()}`);
  if (!res.ok) {
    throw new Error("Failed to fetch applications");
  }
  return res.json();
}

/**
 * Server-only function to fetch an applicant by ID from the backend.
 */
export async function getApplicant(id: string): Promise<ApplicantDetail> {
  const res = await fetch(`${getApiBaseUrl()}/api/applicants/${id}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (res.status === 404) {
    throw new Error("NOT_FOUND");
  } else if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText);
  }

  return res.json();
}
