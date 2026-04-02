"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { admissionsApi } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import type { ApplicationDetail, DecisionStatus, PipelineStage } from "@/types/api";

interface PageProps {
  params: Promise<{ id: string }>;
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return "—";
  }
};

const getPipelineBadge = (stage: PipelineStage) => {
  const map: Record<PipelineStage, { label: string; color: string }> = {
    pending: { label: "Pending", color: "bg-gray-100 text-gray-700" },
    case_sent: { label: "Case Sent", color: "bg-blue-100 text-blue-700" },
    case_answered: { label: "Case Answered", color: "bg-blue-100 text-blue-700" },
    committee_review: { label: "Under Review", color: "bg-yellow-100 text-yellow-700" },
    decision_sent: { label: "Decision Sent", color: "bg-green-100 text-green-700" },
  };
  const config = map[stage] || map.pending;
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold ${config.color}`}>
      {config.label}
    </span>
  );
};

const getDecisionBadge = (status: DecisionStatus) => {
  if (status === "pending") return null;
  const map: Record<DecisionStatus, { label: string; color: string }> = {
    shortlisted: { label: "Shortlisted", color: "bg-green-100 text-green-700" },
    discussion: { label: "Discussion", color: "bg-yellow-100 text-yellow-700" },
    rejected: { label: "Rejected", color: "bg-red-100 text-red-700" },
    pending: { label: "Pending", color: "bg-gray-100 text-gray-700" }
  };
  const config = map[status];
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold ${config.color}`}>
      {config.label}
    </span>
  );
};

const formatSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export default function CandidateDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [is404, setIs404] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchApp = async () => {
    setIsLoading(true);
    setError(null);
    setIs404(false);

    const token = getAccessToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const data = await admissionsApi.getApplication(Number(id), token);
      setApp(data);
    } catch (err: any) {
      if (err.status === 404) {
        setIs404(true);
      } else {
        setError(err.message || "Failed to load application");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApp();
  }, [id]);

  const handleDecision = async (status: DecisionStatus) => {
    if (!app) return;
    setIsActionLoading(true);
    setError(null);
    try {
      await admissionsApi.setDecision(app.id, status, getAccessToken() || undefined);
      await fetchApp();
    } catch (err: any) {
      setError(err.message || "Failed to update decision");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSendDecision = async () => {
    if (!app) return;
    setIsActionLoading(true);
    setError(null);
    try {
      await admissionsApi.sendDecision(app.id, getAccessToken() || undefined);
      await fetchApp();
    } catch (err: any) {
      setError(err.message || "Failed to send decision");
    } finally {
      setIsActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-4 lg:p-8 animate-pulse">
        <div className="h-4 w-32 bg-gray-200 rounded mb-8" />
        <div className="flex gap-8 items-start">
          <div className="flex-1 space-y-8">
            <div className="bg-white p-8 rounded-2xl border border-gray-100 flex gap-6">
              <div className="w-20 h-20 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-3">
                <div className="h-8 w-64 bg-gray-200 rounded" />
                <div className="h-4 w-32 bg-gray-100 rounded" />
              </div>
            </div>
            <div className="bg-white p-8 rounded-2xl border border-gray-100 h-64" />
            <div className="bg-white p-8 rounded-2xl border border-gray-100 h-64" />
          </div>
          <div className="w-80 bg-white p-6 rounded-2xl border border-gray-100 h-64" />
        </div>
      </div>
    );
  }

  if (is404) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Application not found</h1>
          <p className="text-gray-500 mb-6 text-sm">ID: {id}</p>
          <Link href="/applications" className="text-[#84CC16] font-bold hover:underline">
            ← Back to list
          </Link>
        </div>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500 font-bold mb-4">Error: {error}</p>
          <button onClick={fetchApp} className="bg-[#84CC16] text-white px-6 py-2 rounded-lg font-bold mb-4 block w-full">
            Try again
          </button>
          <Link href="/applications" className="text-gray-500 text-sm hover:underline">
            ← Back to list
          </Link>
        </div>
      </div>
    );
  }

  const initials = app.full_name?.split(" ").map(n => n[0]).join("").substring(0, 2) || "??";
  const docCategories: Record<string, string> = {
    id_document: "Identity Document",
    english_results: "English Exam Results",
    certificate: "Academic Certificate",
    additional_document: "Additional Document",
    social_status_document: "Social Status Certificate",
    father_income_document: "Father Income Document",
    mother_income_document: "Mother Income Document",
    guardian_income_document: "Guardian Income Document",
  };

  const requiredCategories = ["id_document", "english_results", "certificate"];
  const missingCategories = requiredCategories.filter(cat => !app.files.some(f => f.category === cat));

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 bg-gray-50 min-h-screen font-sans text-slate-900">
      <Link href="/applications" className="inline-flex items-center text-slate-500 text-sm font-bold mb-10 hover:text-slate-800 transition-colors">
        <svg className="mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        Back to Applications
      </Link>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Main Content */}
        <div className="flex-1 w-full space-y-8">
          
          {/* SECTION 1: HEADER */}
          <header className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-[#84CC16] text-white rounded-full flex items-center justify-center text-2xl font-black uppercase shadow-lg shadow-[#84CC16]/20">
                {initials}
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900 leading-tight mb-2 uppercase italic tracking-tight">{app.full_name}</h1>
                <div className="flex flex-col gap-1 text-sm font-semibold text-slate-500">
                  <p>Submitted: {app.submitted_at ? formatDate(app.submitted_at) : "—"}</p>
                  <p className="text-slate-400">ID: INV-{app.id}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {getPipelineBadge(app.pipeline_stage)}
              {getDecisionBadge(app.decision_status)}
            </div>
          </header>

          {/* SECTION 2: INFO ROW */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Application status", value: `${app.form_status === 'submitted' ? 'Submitted' : 'Draft'} and ${app.pipeline_stage === 'committee_review' ? 'awaiting committee review' : app.pipeline_stage.replace(/_/g, ' ')}` },
              { label: "City", value: app.city || "—" },
              { label: "Primary contact", value: app.contacts_data?.mobile_phone || app.mobile_phone || "—" },
              { label: "Gender", value: app.gender || "—" }
            ].map((item, idx) => (
              <div key={idx} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{item.label}</p>
                <p className="text-sm font-bold text-slate-800 leading-tight">{item.value}</p>
              </div>
            ))}
          </div>

          {/* SECTION 3: PERSONAL INFORMATION */}
          {app.profile_data && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-8 py-5 border-b border-gray-50 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-lg font-black uppercase italic tracking-tight">Personal Information</h2>
              </div>
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Profile Data */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b border-gray-100 pb-2">Basic Info</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Last Name" value={app.profile_data.last_name} />
                      <Field label="First Name" value={app.profile_data.first_name} />
                      <Field label="Patronymic" value={app.profile_data.patronymic} />
                      <Field label="Date of Birth" value={formatDate(app.profile_data.date_of_birth)} />
                      <Field label="Gender" value={app.profile_data.gender} />
                    </div>
                  </div>

                  {/* Identity Data */}
                  {app.identity_data && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b border-gray-100 pb-2">Identity</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="IIN" value={app.identity_data.iin} />
                        <Field label="Type of Document" value={app.identity_data.identity_document_type} />
                        <Field label="Document Number" value={app.identity_data.document_no} />
                        <Field label="Citizenship" value={app.identity_data.citizenship} />
                        <Field label="Authority" value={app.identity_data.authority} />
                        <Field label="Date of Issue" value={formatDate(app.identity_data.date_of_issue)} />
                      </div>
                    </div>
                  )}

                  {/* Contacts Data */}
                  {app.contacts_data && (
                    <div className="space-y-4 md:col-span-2">
                       <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b border-gray-100 pb-2">Contacts</h3>
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Field label="Phone" value={app.contacts_data.mobile_phone} />
                        <Field label="Telegram" value={app.contacts_data.telegram_handle} />
                        <Field label="Instagram" value={app.contacts_data.instagram_handle} />
                        <Field label="WhatsApp" value={app.contacts_data.whatsapp_number} />
                       </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* SECTION 4: EDUCATION */}
          {app.education_data && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
               <div className="px-8 py-5 border-b border-gray-50 bg-slate-50/50">
                 <h2 className="text-lg font-black uppercase italic tracking-tight">Education</h2>
               </div>
               <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                 <Field label="English Exam" value={app.education_data.english_exam_type} />
                 <Field label="Certificate" value={app.education_data.certificate_type} />
                 <div>
                   <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5">Presentation</p>
                   <a 
                    href={app.education_data.presentation_link} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center text-sm font-bold text-[#84CC16] hover:underline"
                   >
                     View Presentation →
                   </a>
                 </div>
               </div>
            </section>
          )}

          {/* SECTION 5: DOCUMENTS */}
          {app.files.length > 0 && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-8 py-5 border-b border-gray-50 bg-slate-50/50">
                <h2 className="text-lg font-black uppercase italic tracking-tight">Documents</h2>
              </div>
              <div className="p-8 space-y-6">
                {/* Status Summary */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                  {missingCategories.length === 0 ? (
                    <div className="flex items-center gap-2 text-[#84CC16] font-bold text-sm">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      All required documents received
                    </div>
                  ) : (
                    missingCategories.map(cat => (
                      <div key={cat} className="flex items-center gap-2 text-amber-600 font-bold text-sm">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        Missing: {docCategories[cat]}
                      </div>
                    ))
                  )}
                </div>

                <div className="divide-y divide-gray-100">
                  {app.files.map(file => (
                    <div key={file.id} className="py-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-slate-100 rounded-lg text-slate-500">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{file.original_name}</p>
                          <p className="text-[10px] font-black uppercase text-slate-400 mt-0.5">
                            {docCategories[file.category] || file.category.replace(/_/g, ' ')} • {formatSize(file.size_bytes)}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-slate-400">{formatDate(file.created_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* SECTION 6: FAMILY */}
          {app.family_data && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
               <div className="px-8 py-5 border-b border-gray-50 bg-slate-50/50">
                 <h2 className="text-lg font-black uppercase italic tracking-tight">Family</h2>
               </div>
               <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                 {app.family_data.father && (
                   <div className="space-y-3">
                     <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Father</p>
                     <p className="text-sm font-bold text-slate-900">{`${app.family_data.father.last_name || ''} ${app.family_data.father.first_name || ''} ${app.family_data.father.patronymic || ''}`.trim() || '—'}</p>
                     <p className="text-xs text-[#84CC16] font-bold">{app.family_data.father.mobile_phone || "—"}</p>
                   </div>
                 )}
                 {app.family_data.mother && (
                   <div className="space-y-3">
                     <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Mother</p>
                     <p className="text-sm font-bold text-slate-900">{`${app.family_data.mother.last_name || ''} ${app.family_data.mother.first_name || ''} ${app.family_data.mother.patronymic || ''}`.trim() || '—'}</p>
                     <p className="text-xs text-[#84CC16] font-bold">{app.family_data.mother.mobile_phone || "—"}</p>
                   </div>
                 )}
                 {app.family_data.guardian && (
                   <div className="space-y-3">
                     <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Guardian</p>
                     <p className="text-sm font-bold text-slate-900">{`${app.family_data.guardian.last_name || ''} ${app.family_data.guardian.first_name || ''} ${app.family_data.guardian.patronymic || ''}`.trim() || '—'}</p>
                     <p className="text-xs text-[#84CC16] font-bold">{app.family_data.guardian.mobile_phone || "—"}</p>
                   </div>
                 )}
               </div>
            </section>
          )}

          {/* SECTION 7: ADDRESS */}
          {app.address_data && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
               <div className="px-8 py-5 border-b border-gray-50 bg-slate-50/50">
                 <h2 className="text-lg font-black uppercase italic tracking-tight">Address</h2>
               </div>
               <div className="p-8">
                 <p className="text-sm font-bold text-slate-800">
                   {[app.address_data.country, app.address_data.region, app.address_data.city, `${app.address_data.street} ${app.address_data.house}`, app.address_data.apartment ? `apt ${app.address_data.apartment}` : null].filter(Boolean).join(", ")}
                 </p>
               </div>
            </section>
          )}

        </div>

        {/* SIDEBAR: ACTION PANEL */}
        <aside className="w-full lg:w-80 lg:sticky lg:top-8 flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden">
             <div className="px-6 py-4 border-b border-gray-50 bg-slate-900">
               <h2 className="text-sm font-black uppercase text-white italic tracking-widest">Committee Decision</h2>
             </div>
             <div className="p-6 space-y-6">
                {(app.pipeline_stage === "committee_review" || app.pipeline_stage === "case_answered") ? (
                  <div className="space-y-3">
                    <button 
                      disabled={isActionLoading}
                      onClick={() => handleDecision("shortlisted")}
                      className={`w-full flex items-center justify-center p-3 rounded-xl border-2 font-black uppercase text-xs tracking-widest transition-all ${app.decision_status === 'shortlisted' ? 'border-[#84CC16] bg-[#84CC16] text-white shadow-lg shadow-[#84CC16]/30' : 'border-[#84CC16] text-[#84CC16] hover:bg-[#84CC16] hover:text-white'}`}
                    >
                      ⭐ Shortlist
                    </button>
                    <button 
                      disabled={isActionLoading}
                      onClick={() => handleDecision("discussion")}
                      className={`w-full flex items-center justify-center p-3 rounded-xl border-2 font-black uppercase text-xs tracking-widest transition-all ${app.decision_status === 'discussion' ? 'border-amber-500 bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-white'}`}
                    >
                      💬 Discussion
                    </button>
                    <button 
                      disabled={isActionLoading}
                      onClick={() => handleDecision("rejected")}
                      className={`w-full flex items-center justify-center p-3 rounded-xl border-2 font-black uppercase text-xs tracking-widest transition-all ${app.decision_status === 'rejected' ? 'border-red-500 bg-red-500 text-white shadow-lg shadow-red-500/30' : 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white'}`}
                    >
                      ✕ Reject
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Decision status locked</p>
                  </div>
                )}

                {app.decision_status !== "pending" && (
                   <button 
                    disabled={isActionLoading || app.pipeline_stage === "decision_sent"}
                    onClick={handleSendDecision}
                    className="w-full bg-slate-900 hover:bg-black disabled:bg-slate-200 text-white p-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all"
                   >
                     {app.pipeline_stage === "decision_sent" ? "✓ Decision Sent" : "Send Decision"}
                   </button>
                )}

                {error && <p className="text-red-500 text-[10px] font-bold text-center italic">{error}</p>}

                <button 
                  onClick={() => router.push(`/candidates/${app.id + 1}`)}
                  className="w-full p-3 rounded-xl font-black uppercase text-xs tracking-widest text-slate-400 hover:text-slate-900 transition-colors mt-4 border-t border-gray-100"
                >
                  Next Candidate →
                </button>
             </div>
          </div>
          
          <div className="bg-[#84CC16]/5 p-6 rounded-2xl border border-[#84CC16]/20">
            <h3 className="text-xs font-black uppercase text-[#84CC16] tracking-widest mb-2 italic underline underline-offset-4">Assisted Review</h3>
            <p className="text-xs font-bold text-slate-600 leading-relaxed italic">
              AI analysis results will be available after the technical committee concludes initial evaluation.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{label}</p>
      <p className="text-sm font-bold text-slate-800 leading-tight">{value || "—"}</p>
    </div>
  );
}
