export type FormStatus = "draft" | "submitted";
export type PipelineStage = "pending" | "case_sent" | "case_answered" | "committee_review" | "decision_sent";
export type DecisionStatus = "pending" | "shortlisted" | "discussion" | "rejected";
export type Gender = "Male" | "Female";
export type IdentityDocumentType = "Passport" | "ID";
export type EnglishExamType = "IELTS 6.0" | "TOEFL iBT 60-78";
export type CertificateType = "UNT" | "NIS 12 Grade Certificate";
export type ApplicationSection = "profile" | "identity" | "family" | "address" | "contacts" | "education" | "questionnaire" | "social_support" | "consents" | "case_response";
export type ApplicationFileCategory = "id_document" | "english_results" | "certificate" | "additional_document" | "social_status_document" | "father_income_document" | "mother_income_document" | "guardian_income_document";

export interface ApplicationsQuery {
  search?: string;
  formStatus?: FormStatus;
  pipelineStage?: PipelineStage;
  decisionStatus?: DecisionStatus;
  city?: string;
  gender?: Gender;
  limit?: number;
  offset?: number;
}

export interface ApplicationSummary {
  id: number;
  user_id: number;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  iin: string | null;
  mobile_phone: string | null;
  city: string | null;
  gender: Gender | null;
  form_status: FormStatus;
  pipeline_stage: PipelineStage;
  decision_status: DecisionStatus;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  drive_score?: number | null;
  drive_total_strong?: number | null;
}

export interface ApplicationListResponse {
  items: ApplicationSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApplicationFile {
  id: number;
  section: ApplicationSection;
  category: ApplicationFileCategory;
  object_key: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface ParentContact {
  last_name: string | null;
  first_name: string | null;
  patronymic: string | null;
  mobile_phone: string | null;
}

export interface ProfileSectionPayload {
  first_name: string;
  last_name: string;
  patronymic: string | null;
  date_of_birth: string;
  gender: Gender;
}

export interface IdentitySectionPayload {
  citizenship: string;
  iin: string;
  identity_document_type: IdentityDocumentType;
  document_no: string;
  authority: string;
  date_of_issue: string;
}

export interface FamilySectionPayload {
  father: ParentContact | null;
  mother: ParentContact | null;
  guardian: ParentContact | null;
}

export interface AddressSectionPayload {
  country: string;
  region: string;
  city: string;
  street: string;
  house: string;
  apartment?: string | null;
}

export interface ContactsSectionPayload {
  mobile_phone: string;
  instagram_handle: string | null;
  telegram_handle: string | null;
  whatsapp_number: string | null;
}

export interface EducationSectionPayload {
  presentation_link: string;
  english_exam_type: EnglishExamType;
  certificate_type: CertificateType;
}

export interface QuestionnaireSectionPayload {
  answers: Record<string, unknown>;
}

export interface SocialSupportSectionPayload {
  has_social_status_certificate: boolean;
  additional_information: string | null;
}

export interface ConsentsSectionPayload {
  privacy_policy_accepted: boolean;
  age_confirmation_accepted: boolean;
}

export interface ApplicationDetail {
  id: number;
  user_id: number;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  iin: string | null;
  mobile_phone: string | null;
  city: string | null;
  gender: Gender | null;
  form_status: FormStatus;
  pipeline_stage: PipelineStage;
  decision_status: DecisionStatus;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  current_section: ApplicationSection | null;
  profile_data: ProfileSectionPayload | null;
  identity_data: IdentitySectionPayload | null;
  family_data: FamilySectionPayload | null;
  address_data: AddressSectionPayload | null;
  contacts_data: ContactsSectionPayload | null;
  education_data: EducationSectionPayload | null;
  questionnaire_data: QuestionnaireSectionPayload | null;
  social_support_data: SocialSupportSectionPayload | null;
  consents_data: ConsentsSectionPayload | null;
  case_sent_at: string | null;
  case_answered_at: string | null;
  decision_sent_at: string | null;
  files: ApplicationFile[];
  drive_score?: number | null;
  drive_total_strong?: number | null;
}

export interface CaseQuestion {
  id: number;
  title: string;
  prompt: string;
  created_at: string;
  updated_at: string;
}

export interface CaseAnswer {
  id: number;
  case_question_id: number;
  application_id: number;
  answer_payload: Record<string, unknown> | null;
  started_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CandidateCaseState {
  case_question: CaseQuestion;
  answer: CaseAnswer | null;
  duration_minutes: number;
  expires_at: string | null;
}
