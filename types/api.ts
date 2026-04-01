export type ApplicationStatus = "new" | "in_review" | "shortlisted" | "rejected" | "accepted";
export type Gender = "Male" | "Female";
export type IdentityDocumentType = "Passport" | "ID";
export type EnglishExamType = "IELTS 6.0" | "TOEFL iBT 60-78";
export type CertificateType = "UNT" | "NIS 12 Grade Certificate";

export interface ApplicantDetail {
  id: number;
  first_name: string;
  last_name: string;
  patronymic: string | null;
  full_name: string;
  date_of_birth: string;
  gender: Gender;
  citizenship: string;
  iin: string;
  identity_document_type: IdentityDocumentType;
  document_no: string;
  authority: string;
  date_of_issue: string;
  id_document_file_url: string | null;
  address_country: string;
  address_region: string;
  address_city: string;
  address_street: string;
  address_house: string;
  address_apartment: string | null;
  mobile_phone: string;
  instagram_handle: string | null;
  telegram_handle: string | null;
  whatsapp_number: string | null;
  presentation_link: string;
  english_exam_type: EnglishExamType;
  english_results_file_url: string | null;
  certificate_type: CertificateType;
  certificate_file_url: string | null;
  parent_details: Record<string, unknown> | null;
  additional_documents_urls: string[] | null;
  personality_test_answers: Record<string, unknown>;
  application_status: ApplicationStatus;
  created_at: string;
  updated_at: string;
}

export interface ApplicantListResponse {
  items: ApplicantDetail[];
  total: number;
  limit: number;
  offset: number;
}
