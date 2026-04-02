"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ApplicationsTable } from "@/components/ApplicationsTable";
import { Pagination } from "@/components/Pagination";
import { clearTokens, getAccessToken } from "@/lib/auth";
import { admissionsApi } from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";
import type { ApplicationListResponse, ApplicationsQuery, DecisionStatus, FormStatus, PipelineStage } from "@/types/api";

const ITEMS_PER_PAGE = 10;

const FORM_OPTIONS = [
  { value: "all", label: "All Form Statuses" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
];

const PIPELINE_OPTIONS = [
  { value: "all", label: "All Pipeline Stages" },
  { value: "pending", label: "Pending" },
  { value: "case_sent", label: "Case Sent" },
  { value: "case_answered", label: "Case Answered" },
  { value: "committee_review", label: "Committee Review" },
  { value: "decision_sent", label: "Decision Sent" },
];

const DECISION_OPTIONS = [
  { value: "all", label: "All Decisions" },
  { value: "pending", label: "Pending" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "discussion", label: "Discussion" },
  { value: "rejected", label: "Rejected" },
];

export default function ApplicationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Read URL params
  const search = searchParams.get("search") || "";
  const formFilter = searchParams.get("formStatus") || "all";
  const pipelineFilter = searchParams.get("pipelineStage") || "all";
  const decisionFilter = searchParams.get("decisionStatus") || "all";
  const limit = parseInt(searchParams.get("limit") || String(ITEMS_PER_PAGE), 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  const [searchInput, setSearchInput] = useState(search);
  const [data, setData] = useState<ApplicationListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBackendOffline, setIsBackendOffline] = useState(false);

  useEffect(() => {
    // Health check on mount - hit backend directly
    fetch(`${API_BASE_URL}/health`, { cache: "no-store" })
      .then(res => {
        if (!res.ok) setIsBackendOffline(true);
      })
      .catch(() => setIsBackendOffline(true));
  }, []);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const loadData = useCallback(() => {
    setIsLoading(true);
    setError(null);

    const token = getAccessToken();
    if (!token) {
      setIsLoading(false);
      router.replace("/login");
      return;
    }

    const queryParams: ApplicationsQuery = {};
    if (search) queryParams.search = search;
    if (formFilter !== "all") queryParams.formStatus = formFilter as FormStatus;
    if (pipelineFilter !== "all") queryParams.pipelineStage = pipelineFilter as PipelineStage;
    if (decisionFilter !== "all") queryParams.decisionStatus = decisionFilter as DecisionStatus;
    queryParams.limit = limit;
    queryParams.offset = offset;

    admissionsApi.getApplications(queryParams)
      .then((res) => setData(res))
      .catch((err) => {
        if (err.status === 401) {
          clearTokens();
          setData(null);
          router.replace("/login");
        } else {
          setError(err.message);
        }
      })
      .finally(() => setIsLoading(false));
  }, [search, formFilter, pipelineFilter, decisionFilter, limit, offset, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateURL = (params: Record<string, string | null>) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === "all" || value === "") {
        current.delete(key);
      } else {
        current.set(key, value);
      }
    });
    // Reset to page 1 unless we are paginating
    if (!("offset" in params)) {
      current.set("offset", "0");
    }
    router.push(`${pathname}?${current.toString()}`);
  };

  const clearFilters = () => {
    setSearchInput("");
    router.push(pathname);
  };

  const handlePageChange = (p: number) => {
    updateURL({ offset: ((p - 1) * limit).toString() });
  };

  const applySearch = () => {
    updateURL({ search: searchInput });
  };

  const activeFilters =
    (formFilter !== "all" ? 1 : 0) +
    (pipelineFilter !== "all" ? 1 : 0) +
    (decisionFilter !== "all" ? 1 : 0) +
    (search ? 1 : 0);

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-screen">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Applications</h1>
          <p className="text-slate-500 font-medium mt-1">Review candidates and manage the admissions pipeline</p>
        </div>
        <button 
          onClick={loadData}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8 flex flex-col xl:flex-row gap-5 shadow-sm">
        {/* Search */}
        <div className="flex-1 min-w-[280px]">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Search:</label>
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-gray-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#A7E635]/50 focus:border-[#A7E635] transition-all"
              placeholder="Search by candidate name or handle"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
            />
          </div>
        </div>

        {/* Dropdowns */}
        <div className="flex-none min-w-[150px]">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Form:</label>
          <select
            className="w-full px-4 py-2.5 bg-slate-50 border border-gray-200 rounded-lg text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#A7E635]/50 cursor-pointer"
            value={formFilter}
            onChange={(e) => updateURL({ formStatus: e.target.value })}
          >
            {FORM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex-none min-w-[150px]">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pipeline:</label>
          <select
            className="w-full px-4 py-2.5 bg-slate-50 border border-gray-200 rounded-lg text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#A7E635]/50 cursor-pointer"
            value={pipelineFilter}
            onChange={(e) => updateURL({ pipelineStage: e.target.value })}
          >
            {PIPELINE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex-none min-w-[150px]">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Decision:</label>
          <select
            className="w-full px-4 py-2.5 bg-slate-50 border border-gray-200 rounded-lg text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#A7E635]/50 cursor-pointer"
            value={decisionFilter}
            onChange={(e) => updateURL({ decisionStatus: e.target.value })}
          >
            {DECISION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex-none min-w-[180px]">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Date Range:</label>
          <input
            type="date"
            className="w-full px-4 py-2bg-slate-50 border border-gray-200 rounded-lg text-sm text-slate-500 focus:outline-none cursor-pointer"
          />
        </div>


        {/* Clear Filters */}
        {activeFilters > 0 && (
          <div className="flex-none flex items-end">
             <button
              onClick={clearFilters}
              className="px-4 py-2.5 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-100"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Main Table */}
      {isBackendOffline ? (
        <div className="flex items-center justify-center py-24">
          <div className="mb-4 p-4 bg-red-100 text-red-800 border border-red-200 rounded-lg text-sm text-center">
            Backend offline. Please start the backend server.
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center p-20 text-slate-400">
          <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-[#A7E635]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
           <span className="font-medium text-lg">Loading applicants...</span>
        </div>
      ) : error ? (
        <div className="p-10 text-center bg-red-50 rounded-xl border border-red-100">
          <h3 className="text-red-800 font-bold text-lg mb-2">Error loading data</h3>
          <p className="text-red-600">{error}</p>
        </div>
      ) : data && data.items.length === 0 ? (
        <div className="p-20 text-center bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col items-center">
          <svg className="mb-4 text-slate-300" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <h3 className="text-slate-800 font-bold text-xl mb-1">No applicants found</h3>
          <p className="text-slate-500">Try adjusting your filters or search terms.</p>
        </div>
      ) : data ? (
        <div className="flex flex-col gap-6">
          <ApplicationsTable rows={data.items} />
          
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-2">
            <Pagination
              currentPage={Math.floor(offset / limit) + 1}
              totalPages={Math.ceil(data.total / limit)}
              totalItems={data.total}
              itemsPerPage={limit}
              onPageChange={handlePageChange}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
