"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { candidateApi, downloadFile } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { StatusBadge } from "@/components/StatusBadge";
import type {
  ApplicationDetail,
  Gender,
  EnglishExamType,
  CertificateType,
  IdentityDocumentType,
  ApplicationFileCategory,
  ParentContact,
} from "@/types/api";

export default function MyApplicationPage() {
  const router = useRouter();
  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [sectionMessage, setSectionMessage] = useState<{ section: string; type: "success" | "error"; text: string } | null>(null);

  // Form states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [patronymic, setPatronymic] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<Gender>("Male");

  const [englishExam, setEnglishExam] = useState<EnglishExamType>("IELTS 6.0");
  const [certificate, setCertificate] = useState<CertificateType>("UNT");

  // Identity
  const [citizenship, setCitizenship] = useState("");
  const [iin, setIin] = useState("");
  const [identityDocumentType, setIdentityDocumentType] = useState<IdentityDocumentType>("Passport");
  const [documentNo, setDocumentNo] = useState("");
  const [authority, setAuthority] = useState("");
  const [dateOfIssue, setDateOfIssue] = useState("");

  // Contacts
  const [contactPhone, setContactPhone] = useState("");
  const [telegram, setTelegram] = useState("");
  const [instagram, setInstagram] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  // Address
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [house, setHouse] = useState("");
  const [apartment, setApartment] = useState("");

  // Family (optional fields, but section must be saved for submit)
  const [fatherLast, setFatherLast] = useState("");
  const [fatherFirst, setFatherFirst] = useState("");
  const [fatherPatronymic, setFatherPatronymic] = useState("");
  const [fatherPhone, setFatherPhone] = useState("");

  const [motherLast, setMotherLast] = useState("");
  const [motherFirst, setMotherFirst] = useState("");
  const [motherPatronymic, setMotherPatronymic] = useState("");
  const [motherPhone, setMotherPhone] = useState("");

  const [guardianLast, setGuardianLast] = useState("");
  const [guardianFirst, setGuardianFirst] = useState("");
  const [guardianPatronymic, setGuardianPatronymic] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");

  // Questionnaire
  const [questionnaireMain, setQuestionnaireMain] = useState("");

  // Consents
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [ageAccepted, setAgeAccepted] = useState(false);
  const [isSavingConsents, setIsSavingConsents] = useState(false);

  // Files (multipart upload)
  const [uploadingCategory, setUploadingCategory] = useState<ApplicationFileCategory | null>(null);

  // Auto-save logic
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Required documents list
  const requiredFiles: ApplicationFileCategory[] = ["id_document", "english_results", "certificate", "presentation_video"];

  const isSubmitted = app?.form_status === "submitted";
  const hasRequiredFiles = app ? requiredFiles.every((cat) => app.files.some((f) => f.category === cat)) : false;
  const canSubmit =
    !isSubmitted &&
    app?.profile_data !== null &&
    app?.identity_data !== null &&
    app?.family_data !== null &&
    app?.address_data !== null &&
    app?.contacts_data !== null &&
    app?.education_data !== null &&
    app?.questionnaire_data !== null &&
    (app?.consents_data !== null || (privacyAccepted && ageAccepted)) &&
    hasRequiredFiles;


  const fetchApplication = useCallback(async () => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    try {
      const data = await candidateApi.getApplication();
      setApp(data);

      // Seed form states if data exists
      if (data.profile_data) {
        setFirstName(data.profile_data.first_name || "");
        setLastName(data.profile_data.last_name || "");
        setPatronymic(data.profile_data.patronymic || "");
        setDateOfBirth(data.profile_data.date_of_birth || "");
        setGender(data.profile_data.gender || "Male");
      } else {
        // Fallback to top-level fields if profile_data is null but fields are available
        setFirstName(data.first_name || "");
        setLastName(data.last_name || "");
      }

      if (data.education_data) {
        setEnglishExam(data.education_data.english_exam_type || "IELTS 6.0");
        setCertificate(data.education_data.certificate_type || "UNT");
      }

      if (data.identity_data) {
        setCitizenship(data.identity_data.citizenship || "");
        setIin(data.identity_data.iin || "");
        setIdentityDocumentType(data.identity_data.identity_document_type || "Passport");
        setDocumentNo(data.identity_data.document_no || "");
        setAuthority(data.identity_data.authority || "");
        setDateOfIssue(data.identity_data.date_of_issue || "");
      }

      if (data.contacts_data) {
        setContactPhone(data.contacts_data.mobile_phone || "");
        setTelegram(data.contacts_data.telegram_handle || "");
        setInstagram(data.contacts_data.instagram_handle || "");
        setWhatsapp(data.contacts_data.whatsapp_number || "");
      } else if (data.mobile_phone) {
        setContactPhone(data.mobile_phone || "");
      }

      if (data.address_data) {
        setCountry(data.address_data.country || "");
        setRegion(data.address_data.region || "");
        setCity(data.address_data.city || "");
        setStreet(data.address_data.street || "");
        setHouse(data.address_data.house || "");
        setApartment(data.address_data.apartment || "");
      } else if (data.city) {
        setCity(data.city || "");
      }

      if (data.family_data) {
        const f = data.family_data.father;
        const m = data.family_data.mother;
        const g = data.family_data.guardian;

        setFatherLast(f?.last_name || "");
        setFatherFirst(f?.first_name || "");
        setFatherPatronymic(f?.patronymic || "");
        setFatherPhone(f?.mobile_phone || "");

        setMotherLast(m?.last_name || "");
        setMotherFirst(m?.first_name || "");
        setMotherPatronymic(m?.patronymic || "");
        setMotherPhone(m?.mobile_phone || "");

        setGuardianLast(g?.last_name || "");
        setGuardianFirst(g?.first_name || "");
        setGuardianPatronymic(g?.patronymic || "");
        setGuardianPhone(g?.mobile_phone || "");
      }

      const qMain = data.questionnaire_data?.answers?.main;
      if (typeof qMain === "string") setQuestionnaireMain(qMain);

      if (data.consents_data) {
        setPrivacyAccepted(Boolean(data.consents_data.privacy_policy_accepted));
        setAgeAccepted(Boolean(data.consents_data.age_confirmation_accepted));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load application";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchApplication();
  }, [fetchApplication]);

  const toParentOrNull = (fields: { last: string; first: string; pat: string; phone: string }): ParentContact | null => {
    const anyFilled = Boolean(fields.last || fields.first || fields.pat || fields.phone);
    if (!anyFilled) return null;
    return {
      last_name: fields.last || null,
      first_name: fields.first || null,
      patronymic: fields.pat || null,
      mobile_phone: fields.phone || null,
    };
  };

  const handleSaveProfile = async () => {
    if (!firstName || !lastName || !dateOfBirth || !gender) {
      setSectionMessage({ section: "profile", type: "error", text: "Please fill all required profile fields" });
      return;
    }
    setIsSaving(true);
    setSectionMessage(null);
    try {
      const updated = await candidateApi.saveProfile({
        first_name: firstName,
        last_name: lastName,
        patronymic: patronymic || null,
        date_of_birth: dateOfBirth,
        gender,
      });
      setApp(updated);
      setSectionMessage({ section: "profile", type: "success", text: "Saved ✓" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save profile";
      setSectionMessage({ section: "profile", type: "error", text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEducation = async () => {
    if (!englishExam || !certificate) {
      setSectionMessage({ section: "education", type: "error", text: "Please fill all required education fields" });
      return;
    }
    setIsSaving(true);
    setSectionMessage(null);
    try {
      const updated = await candidateApi.saveEducation({
        english_exam_type: englishExam,
        certificate_type: certificate,
      });
      setApp(updated);
      setSectionMessage({ section: "education", type: "success", text: "Saved ✓" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save education";
      setSectionMessage({ section: "education", type: "error", text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveIdentity = async () => {
    if (!citizenship || !iin || !identityDocumentType || !documentNo || !authority || !dateOfIssue) {
      setSectionMessage({ section: "identity", type: "error", text: "Please fill all required identity fields" });
      return;
    }
    setIsSaving(true);
    setSectionMessage(null);
    try {
      const updated = await candidateApi.saveIdentity({
        citizenship,
        iin,
        identity_document_type: identityDocumentType,
        document_no: documentNo,
        authority,
        date_of_issue: dateOfIssue,
      });
      setApp(updated);
      setSectionMessage({ section: "identity", type: "success", text: "Saved ✓" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save identity";
      setSectionMessage({ section: "identity", type: "error", text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveContacts = async () => {
    if (!contactPhone) {
      setSectionMessage({ section: "contacts", type: "error", text: "Mobile phone is required" });
      return;
    }
    setIsSaving(true);
    setSectionMessage(null);
    try {
      const updated = await candidateApi.saveContacts({
        mobile_phone: contactPhone,
        telegram_handle: telegram || null,
        instagram_handle: instagram || null,
        whatsapp_number: whatsapp || null,
      });
      setApp(updated);
      setSectionMessage({ section: "contacts", type: "success", text: "Saved ✓" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save contacts";
      setSectionMessage({ section: "contacts", type: "error", text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAddress = async () => {
    if (!country || !region || !city || !street || !house) {
      setSectionMessage({ section: "address", type: "error", text: "Please fill all required address fields" });
      return;
    }
    setIsSaving(true);
    setSectionMessage(null);
    try {
      const updated = await candidateApi.saveAddress({
        country,
        region,
        city,
        street,
        house,
        apartment: apartment || null,
      });
      setApp(updated);
      setSectionMessage({ section: "address", type: "success", text: "Saved ✓" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save address";
      setSectionMessage({ section: "address", type: "error", text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveFamily = async () => {
    setIsSaving(true);
    setSectionMessage(null);
    try {
      const updated = await candidateApi.saveFamily({
        father: toParentOrNull({ last: fatherLast, first: fatherFirst, pat: fatherPatronymic, phone: fatherPhone }),
        mother: toParentOrNull({ last: motherLast, first: motherFirst, pat: motherPatronymic, phone: motherPhone }),
        guardian: toParentOrNull({ last: guardianLast, first: guardianFirst, pat: guardianPatronymic, phone: guardianPhone }),
      });
      setApp(updated);
      setSectionMessage({ section: "family", type: "success", text: "Saved ✓" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save family";
      setSectionMessage({ section: "family", type: "error", text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveQuestionnaire = async () => {
    // Temporarily using a stub as requested (50+ chars of Lorem Ipsum)
    const stub = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.";
    setIsSaving(true);
    setSectionMessage(null);
    try {
      const updated = await candidateApi.saveQuestionnaire({
        answers: { main: stub },
      });
      setApp(updated);
      setSectionMessage({ section: "questionnaire", type: "success", text: "Saved ✓" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save questionnaire";
      setSectionMessage({ section: "questionnaire", type: "error", text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveConsents = async (nextPrivacy: boolean, nextAge: boolean) => {
    setIsSavingConsents(true);
    setSectionMessage(null);
    try {
      const updated = await candidateApi.saveConsents({
        privacy_policy_accepted: nextPrivacy,
        age_confirmation_accepted: nextAge,
      });
      setApp(updated);
      setSectionMessage({ section: "consents", type: "success", text: "Saved ✓" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save consents";
      setSectionMessage({ section: "consents", type: "error", text: msg });
    } finally {
      setIsSavingConsents(false);
    }
  };

  const handleSaveAll = useCallback(async () => {
    setIsSaving(true);
    setIsAutoSaving(true);
    try {
      // Run all section saves. Using individual handlers to maintain their validation logic.
      // We skip consents here as they have their own checkbox-triggered save, but we could include it.
      await Promise.all([
        handleSaveProfile(),
        handleSaveEducation(),
        handleSaveIdentity(),
        handleSaveContacts(),
        handleSaveAddress(),
        handleSaveFamily(),
        handleSaveQuestionnaire()
      ]);
      setLastSaved(new Date());
    } catch (err) {
      console.error("Safe all failed:", err);
    } finally {
      setIsSaving(false);
      setIsAutoSaving(false);
    }
  }, [
    handleSaveProfile, handleSaveEducation, handleSaveIdentity,
    handleSaveContacts, handleSaveAddress, handleSaveFamily,
    handleSaveQuestionnaire
  ]);

  // Auto-save disabled: it was too noisy (multiple API calls + UI reflows).

  const handlePickFile = async (category: ApplicationFileCategory, file: File) => {
    setUploadingCategory(category);
    try {
      await candidateApi.uploadFile(category, file);
      await fetchApplication();
      setSubmitMessage({ type: "success", text: "File uploaded successfully" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to upload file";
      setSubmitMessage({ type: "error", text: `${msg} (name: ${file.name}, type: ${file.type || "unknown"})` });
    } finally {
      setUploadingCategory(null);
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      await candidateApi.deleteFile(fileId);
      await fetchApplication();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete file";
      alert(msg);
    }
  };

  const handleSubmitApplication = async () => {
    setIsSaving(true);
    setSubmitMessage(null);
    try {
      // Ensure consents are persisted before submit (submit is blocked server-side without them)
      if (!app?.consents_data && privacyAccepted && ageAccepted) {
        const updatedConsents = await candidateApi.saveConsents({
          privacy_policy_accepted: privacyAccepted,
          age_confirmation_accepted: ageAccepted,
        });
        setApp(updatedConsents);
      }

      const updated = await candidateApi.submitApplication();
      setApp(updated);
      setSubmitMessage({ type: 'success', text: "Application submitted. You will receive your case question by email." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit application";
      setSubmitMessage({ type: 'error', text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#A7E635]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 max-w-md mx-auto">
          {error}
        </div>
      </div>
    );
  }

  const getPipelineMessage = () => {
    if (!isSubmitted) return null;
    switch (app?.pipeline_stage) {
      case "case_sent": return "Your case question has been sent. Check your email.";
      case "case_answered": return "Your case answer has been received.";
      case "committee_review": return "Your application is under review.";
      case "decision_sent":
        const d = app?.decision_status;
        if (d === "shortlisted") return "Congratulations! You have been shortlisted.";
        if (d === "rejected") return "Thank you for applying. Unfortunately, we cannot proceed with your application at this time.";
        if (d === "discussion") return "Your application is being discussed.";
        return null;
      default: return "Your application has been submitted.";
    }
  };

  return (
    <div className="p-8 max-w-[1000px] mx-auto min-h-screen space-y-8 pb-20">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">My Application</h1>
          <div className="flex items-center gap-4 mt-3">
            <StatusBadge pipeline_stage={app?.pipeline_stage} decision_status={app?.decision_status} form_status={app?.form_status} />
            {isAutoSaving ? (
              <span className="text-[10px] font-bold text-[#A7E635] uppercase tracking-widest animate-pulse">Saving...</span>
            ) : lastSaved ? (
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last saved {lastSaved.toLocaleTimeString()}</span>
            ) : null}
          </div>
        </div>
        {!isSubmitted && (
          <div className="flex gap-3">
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="px-6 py-3 bg-white border border-gray-200 text-slate-900 font-bold rounded-xl shadow-sm hover:bg-gray-50 transition-all disabled:opacity-50"
            >
              {isAutoSaving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={handleSubmitApplication}
              disabled={!canSubmit || isSaving}
              className="px-6 py-3 bg-[#A7E635] text-slate-900 font-bold rounded-xl shadow-lg hover:brightness-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving && !isAutoSaving ? "Processing..." : "Submit Application"}
            </button>
          </div>
        )}
      </div>

      {submitMessage && (
        <div className={`p-4 rounded-xl mb-6 flex items-center gap-3 ${submitMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'
          }`}>
          {submitMessage.type === 'success' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          )}
          <span className="font-semibold text-sm">{submitMessage.text}</span>
        </div>
      )}

      {getPipelineMessage() && (
        <div className="p-5 bg-[#A7E635]/10 border border-[#A7E635]/20 rounded-xl flex items-center gap-4">
          <div className="w-10 h-10 bg-[#A7E635] rounded-full flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="slate-900" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          </div>
          <span className="font-bold text-slate-900">{getPipelineMessage()}</span>
        </div>
      )}

      {!isSubmitted && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Submit checklist</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div className={`flex items-center gap-2 ${app?.profile_data ? "text-emerald-700" : "text-slate-500"}`}>
              <span>{app?.profile_data ? "✓" : "✗"}</span> Profile
            </div>
            <div className={`flex items-center gap-2 ${app?.identity_data ? "text-emerald-700" : "text-slate-500"}`}>
              <span>{app?.identity_data ? "✓" : "✗"}</span> Identity
            </div>
            <div className={`flex items-center gap-2 ${app?.family_data ? "text-emerald-700" : "text-slate-500"}`}>
              <span>{app?.family_data ? "✓" : "✗"}</span> Family
            </div>
            <div className={`flex items-center gap-2 ${app?.address_data ? "text-emerald-700" : "text-slate-500"}`}>
              <span>{app?.address_data ? "✓" : "✗"}</span> Address
            </div>
            <div className={`flex items-center gap-2 ${app?.contacts_data ? "text-emerald-700" : "text-slate-500"}`}>
              <span>{app?.contacts_data ? "✓" : "✗"}</span> Contacts
            </div>
            <div className={`flex items-center gap-2 ${app?.education_data ? "text-emerald-700" : "text-slate-500"}`}>
              <span>{app?.education_data ? "✓" : "✗"}</span> Education
            </div>
            {/* Temporarily hidden */}
            {/* <div className={`flex items-center gap-2 ${app?.questionnaire_data ? "text-emerald-700" : "text-slate-500"}`}>
              <span>{app?.questionnaire_data ? "✓" : "✗"}</span> Questionnaire
            </div> */}
            <div className={`flex items-center gap-2 ${app?.consents_data ? "text-emerald-700" : "text-slate-500"}`}>
              <span>{app?.consents_data ? "✓" : "✗"}</span> Consents
            </div>
            <div className={`flex items-center gap-2 ${hasRequiredFiles ? "text-emerald-700" : "text-slate-500"}`}>
              <span>{hasRequiredFiles ? "✓" : "✗"}</span> Required documents
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* SECTION A: PROFILE */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-bold text-slate-900">Personal Information</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">First Name</label>
                {isSubmitted ? <p className="font-semibold text-slate-800">{firstName}</p> : (
                  <input value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#A7E635] transition-colors" />
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Last Name</label>
                {isSubmitted ? <p className="font-semibold text-slate-800">{lastName}</p> : (
                  <input value={lastName} onChange={e => setLastName(e.target.value)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#A7E635] transition-colors" />
                )}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Patronymic (Optional)</label>
              {isSubmitted ? <p className="font-semibold text-slate-800">{patronymic || "—"}</p> : (
                <input value={patronymic} onChange={e => setPatronymic(e.target.value)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#A7E635] transition-colors" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date of Birth</label>
                {isSubmitted ? <p className="font-semibold text-slate-800">{dateOfBirth}</p> : (
                  <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#A7E635] transition-colors" />
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Gender</label>
                {isSubmitted ? <p className="font-semibold text-slate-800">{gender}</p> : (
                  <select value={gender} onChange={e => setGender(e.target.value as Gender)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#A7E635] transition-colors bg-white">
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                )}
              </div>
            </div>
          </div>
          {sectionMessage?.section === "profile" && (
            <div className={`px-6 pb-5 text-sm font-semibold ${sectionMessage.type === "success" ? "text-emerald-700" : "text-red-600"}`}>
              {sectionMessage.text}
            </div>
          )}
        </div>

        {/* SECTION B: EDUCATION */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-bold text-slate-900">Education</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">English Exam Type</label>
              {isSubmitted ? <p className="font-semibold text-slate-800">{englishExam}</p> : (
                <select value={englishExam} onChange={e => setEnglishExam(e.target.value as EnglishExamType)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#A7E635] transition-colors bg-white">
                  <option value="IELTS 6.0">IELTS 6.0</option>
                  <option value="TOEFL iBT 60-78">TOEFL iBT 60-78</option>
                </select>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Final Certificate Type</label>
              {isSubmitted ? <p className="font-semibold text-slate-800">{certificate}</p> : (
                <select value={certificate} onChange={e => setCertificate(e.target.value as CertificateType)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#A7E635] transition-colors bg-white">
                  <option value="UNT">UNT</option>
                  <option value="NIS 12 Grade Certificate">NIS 12 Grade Certificate</option>
                </select>
              )}
            </div>
          </div>
          {sectionMessage?.section === "education" && (
            <div className={`px-6 pb-5 text-sm font-semibold ${sectionMessage.type === "success" ? "text-emerald-700" : "text-red-600"}`}>
              {sectionMessage.text}
            </div>
          )}
        </div>

        {/* SECTION C: IDENTITY */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-bold text-slate-900">Identity</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Citizenship</label>
              {isSubmitted ? (
                <p className="font-semibold text-slate-800">{citizenship}</p>
              ) : (
                <input value={citizenship} onChange={(e) => setCitizenship(e.target.value)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#A7E635] transition-colors" />
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">IIN</label>
              {isSubmitted ? (
                <p className="font-semibold text-slate-800">{iin}</p>
              ) : (
                <input value={iin} onChange={(e) => setIin(e.target.value)} maxLength={20} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#A7E635] transition-colors" />
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Document Type</label>
              {isSubmitted ? (
                <p className="font-semibold text-slate-800">{identityDocumentType}</p>
              ) : (
                <select value={identityDocumentType} onChange={(e) => setIdentityDocumentType(e.target.value as IdentityDocumentType)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#A7E635] transition-colors bg-white">
                  <option value="Passport">Passport</option>
                  <option value="ID">ID</option>
                </select>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Document Number</label>
              {isSubmitted ? (
                <p className="font-semibold text-slate-800">{documentNo}</p>
              ) : (
                <input value={documentNo} onChange={(e) => setDocumentNo(e.target.value)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#A7E635] transition-colors" />
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Authority</label>
              {isSubmitted ? (
                <p className="font-semibold text-slate-800">{authority}</p>
              ) : (
                <input value={authority} onChange={(e) => setAuthority(e.target.value)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#A7E635] transition-colors" />
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date of Issue</label>
              {isSubmitted ? (
                <p className="font-semibold text-slate-800">{dateOfIssue}</p>
              ) : (
                <input type="date" value={dateOfIssue} onChange={(e) => setDateOfIssue(e.target.value)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#A7E635] transition-colors" />
              )}
            </div>
          </div>
          {sectionMessage?.section === "identity" && (
            <div className={`px-6 pb-5 text-sm font-semibold ${sectionMessage.type === "success" ? "text-emerald-700" : "text-red-600"}`}>
              {sectionMessage.text}
            </div>
          )}
        </div>

        {/* SECTION D: CONTACTS */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-bold text-slate-900">Contacts</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mobile Phone</label>
              {isSubmitted ? (
                <p className="font-semibold text-slate-800">{contactPhone}</p>
              ) : (
                <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#84CC16] transition-colors" />
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Telegram (optional)</label>
              {isSubmitted ? (
                <p className="font-semibold text-slate-800">{telegram || "—"}</p>
              ) : (
                <input value={telegram} onChange={(e) => setTelegram(e.target.value)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#84CC16] transition-colors" />
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Instagram (optional)</label>
              {isSubmitted ? (
                <p className="font-semibold text-slate-800">{instagram || "—"}</p>
              ) : (
                <input value={instagram} onChange={(e) => setInstagram(e.target.value)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#84CC16] transition-colors" />
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">WhatsApp (optional)</label>
              {isSubmitted ? (
                <p className="font-semibold text-slate-800">{whatsapp || "—"}</p>
              ) : (
                <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#84CC16] transition-colors" />
              )}
            </div>
          </div>
          {sectionMessage?.section === "contacts" && (
            <div className={`px-6 pb-5 text-sm font-semibold ${sectionMessage.type === "success" ? "text-emerald-700" : "text-red-600"}`}>
              {sectionMessage.text}
            </div>
          )}
        </div>

        {/* SECTION E: ADDRESS */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-bold text-slate-900">Address</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Country</label>
              {isSubmitted ? <p className="font-semibold text-slate-800">{country}</p> : (
                <input value={country} onChange={(e) => setCountry(e.target.value)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#84CC16] transition-colors" />
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Region</label>
              {isSubmitted ? <p className="font-semibold text-slate-800">{region}</p> : (
                <input value={region} onChange={(e) => setRegion(e.target.value)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#84CC16] transition-colors" />
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">City</label>
              {isSubmitted ? <p className="font-semibold text-slate-800">{city}</p> : (
                <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#84CC16] transition-colors" />
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Street</label>
              {isSubmitted ? <p className="font-semibold text-slate-800">{street}</p> : (
                <input value={street} onChange={(e) => setStreet(e.target.value)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#84CC16] transition-colors" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">House</label>
                {isSubmitted ? <p className="font-semibold text-slate-800">{house}</p> : (
                  <input value={house} onChange={(e) => setHouse(e.target.value)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#84CC16] transition-colors" />
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Apartment (optional)</label>
                {isSubmitted ? <p className="font-semibold text-slate-800">{apartment || "—"}</p> : (
                  <input value={apartment} onChange={(e) => setApartment(e.target.value)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#84CC16] transition-colors" />
                )}
              </div>
            </div>
          </div>
          {sectionMessage?.section === "address" && (
            <div className={`px-6 pb-5 text-sm font-semibold ${sectionMessage.type === "success" ? "text-emerald-700" : "text-red-600"}`}>
              {sectionMessage.text}
            </div>
          )}
        </div>

        {/* SECTION F: FAMILY */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-bold text-slate-900">Family</h2>
          </div>
          <div className="p-6 space-y-6">
            {([
              { label: "Father", last: fatherLast, setLast: setFatherLast, first: fatherFirst, setFirst: setFatherFirst, pat: fatherPatronymic, setPat: setFatherPatronymic, phone: fatherPhone, setPhone: setFatherPhone },
              { label: "Mother", last: motherLast, setLast: setMotherLast, first: motherFirst, setFirst: setMotherFirst, pat: motherPatronymic, setPat: setMotherPatronymic, phone: motherPhone, setPhone: setMotherPhone },
              { label: "Guardian", last: guardianLast, setLast: setGuardianLast, first: guardianFirst, setFirst: setGuardianFirst, pat: guardianPatronymic, setPat: setGuardianPatronymic, phone: guardianPhone, setPhone: setGuardianPhone },
            ] as const).map((p) => (
              <div key={p.label} className="space-y-3">
                <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">{p.label}</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">First Name</label>
                    {isSubmitted ? <p className="font-semibold text-slate-800">{p.first || "—"}</p> : (
                      <input value={p.first} onChange={(e) => p.setFirst(e.target.value)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#84CC16] transition-colors" />
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Last Name</label>
                    {isSubmitted ? <p className="font-semibold text-slate-800">{p.last || "—"}</p> : (
                      <input value={p.last} onChange={(e) => p.setLast(e.target.value)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#84CC16] transition-colors" />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Patronymic (optional)</label>
                    {isSubmitted ? <p className="font-semibold text-slate-800">{p.pat || "—"}</p> : (
                      <input value={p.pat} onChange={(e) => p.setPat(e.target.value)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#84CC16] transition-colors" />
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mobile Phone (optional)</label>
                    {isSubmitted ? <p className="font-semibold text-slate-800">{p.phone || "—"}</p> : (
                      <input value={p.phone} onChange={(e) => p.setPhone(e.target.value)} className="w-full text-sm font-medium border-b border-gray-200 py-1 focus:border-[#84CC16] transition-colors" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {sectionMessage?.section === "family" && (
            <div className={`px-6 pb-5 text-sm font-semibold ${sectionMessage.type === "success" ? "text-emerald-700" : "text-red-600"}`}>
              {sectionMessage.text}
            </div>
          )}
        </div>

        {/* SECTION G: QUESTIONNAIRE (Temporarily Hidden) */}
        {/* <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-bold text-slate-900">Questionnaire</h2>
          </div>
          <div className="p-6 space-y-3">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tell us about yourself and your goals</label>
            {isSubmitted ? (
              <p className="font-semibold text-slate-800 whitespace-pre-wrap">{questionnaireMain || "—"}</p>
            ) : (
              <textarea
                value={questionnaireMain}
                onChange={(e) => setQuestionnaireMain(e.target.value)}
                rows={6}
                className="w-full text-sm font-medium border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#84CC16]/30 focus:border-[#84CC16] transition-all"
              />
            )}
          </div>
          {sectionMessage?.section === "questionnaire" && (
            <div className={`px-6 pb-5 text-sm font-semibold ${sectionMessage.type === "success" ? "text-emerald-700" : "text-red-600"}`}>
              {sectionMessage.text}
            </div>
          )}
        </div> */}

        {/* SECTION H: CONSENTS */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-bold text-slate-900">Consents</h2>
            {!isSubmitted && null}
          </div>
          <div className="p-6 space-y-4">
	            <label className="flex items-start gap-3 text-sm font-semibold text-slate-800">
	              <input
	                type="checkbox"
	                checked={privacyAccepted}
	                disabled={isSubmitted || isSavingConsents}
	                onChange={(e) => {
	                  const next = e.target.checked;
	                  setPrivacyAccepted(next);
	                  void handleSaveConsents(next, ageAccepted);
	                }}
	                className="mt-1"
	              />
	              I agree to the Privacy Policy
	            </label>
	            <label className="flex items-start gap-3 text-sm font-semibold text-slate-800">
	              <input
	                type="checkbox"
	                checked={ageAccepted}
	                disabled={isSubmitted || isSavingConsents}
	                onChange={(e) => {
	                  const next = e.target.checked;
	                  setAgeAccepted(next);
	                  void handleSaveConsents(privacyAccepted, next);
	                }}
	                className="mt-1"
	              />
	              I confirm I meet the age requirements
	            </label>
          </div>
          {sectionMessage?.section === "consents" && (
            <div className={`px-6 pb-5 text-sm font-semibold ${sectionMessage.type === "success" ? "text-emerald-700" : "text-red-600"}`}>
              {sectionMessage.text}
            </div>
          )}
        </div>

        {/* SECTION I: DOCUMENTS (metadata records) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden md:col-span-2">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-bold text-slate-900">Documents</h2>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Required: {requiredFiles.length}
            </div>
          </div>
          <div className="p-6 space-y-4">
            {requiredFiles.map((cat) => {
              const existing = app?.files.find((f) => f.category === cat);
              const label =
                cat === "id_document" ? "Identity Document (PDF)" :
                  cat === "english_results" ? "English Exam Results (PDF)" :
                    cat === "certificate" ? "Academic Certificate (PDF)" :
                      "Video Presentation (MP4/MOV)";
              const accept =
                cat === "id_document" ? ".pdf" :
                  cat === "english_results" ? ".pdf" :
                    cat === "certificate" ? ".pdf" :
                      cat === "presentation_video" ? ".mp4,.mov" :
                        undefined;
              return (
                <div key={cat} className="flex items-center justify-between gap-4 p-4 border border-gray-200 rounded-xl group transition-all hover:border-[#A7E635]/30">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className={`p-2 rounded-lg ${existing ? 'bg-[#A7E635]/10 text-[#A7E635]' : 'bg-slate-50 text-slate-400'}`}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-slate-900">{label}</div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-slate-500 font-semibold truncate mr-2">
                          {existing ? existing.original_name : "Not uploaded"}
                        </div>
                        {existing && (
                          <button
                            type="button"
                            onClick={() => downloadFile(existing.id, existing.original_name, "candidate")}
                            className="p-1.5 text-[#A7E635] hover:bg-[#A7E635] hover:text-white rounded-md transition-all sm:opacity-0 group-hover:opacity-100"
                            title="Download"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {!isSubmitted && (
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        className="hidden"
                        id={`file-${cat}`}
                        accept={accept}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          void handlePickFile(cat, f);
                          e.currentTarget.value = "";
                        }}
                      />
                      <label
                        htmlFor={`file-${cat}`}
                        className={`px-4 py-2 rounded-lg text-sm font-bold cursor-pointer border transition-colors whitespace-nowrap ${uploadingCategory === cat
                          ? "bg-slate-100 text-slate-400 border-slate-200 cursor-wait"
                          : existing
                            ? "bg-white text-slate-700 border-gray-200 hover:bg-slate-50"
                            : "bg-[#A7E635] text-white border-[#A7E635] hover:bg-[#95d02f]"
                          }`}
                      >
                        {uploadingCategory === cat ? "Saving..." : existing ? "Replace" : "Upload"}
                      </label>
                    </div>
                  )}
                </div>

              );
            })}
          </div>
          {sectionMessage?.section === "files" && (
            <div className={`px-6 pb-5 text-sm font-semibold ${sectionMessage.type === "success" ? "text-emerald-700" : "text-red-600"}`}>
              {sectionMessage.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
