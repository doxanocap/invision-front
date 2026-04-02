"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { admissionsApi } from "@/lib/api";
import type { ApplicationListResponse, ApplicationSummary, DecisionStatus, PipelineStage } from "@/types/api";

function groupCount(items: ApplicationSummary[], getKey: (a: ApplicationSummary) => string | null | undefined) {
  const map = new Map<string, number>();
  items.forEach((a) => {
    const k = getKey(a);
    if (!k) return;
    map.set(k, (map.get(k) ?? 0) + 1);
  });
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

function pct(n: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

export default function AnalyticsPage() {
  const [items, setItems] = useState<ApplicationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const first = await admissionsApi.getApplications({ limit: 200, offset: 0 });
      let acc: ApplicationSummary[] = first.items;
      const grandTotal = first.total ?? first.items.length;

      let offset = acc.length;
      while (offset < grandTotal) {
        const page: ApplicationListResponse = await admissionsApi.getApplications({ limit: 200, offset });
        acc = acc.concat(page.items);
        offset += page.items.length;
        if (page.items.length === 0) break;
        if (acc.length >= 3000) break; // UI safety cap
      }

      setItems(acc);
      setTotal(grandTotal);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const submitted = useMemo(() => items.filter((a) => a.form_status === "submitted"), [items]);
  const pipeline = useMemo(() => groupCount(items, (a) => a.pipeline_stage as PipelineStage), [items]);
  const decision = useMemo(() => groupCount(items, (a) => a.decision_status as DecisionStatus), [items]);
  const gender = useMemo(() => groupCount(items, (a) => a.gender ?? null), [items]);
  const topCities = useMemo(() => groupCount(items, (a) => a.city ?? null).slice(0, 10), [items]);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-4 lg:p-10 space-y-8 animate-pulse">
        <div className="h-8 w-56 bg-gray-200 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-72 bg-white rounded-2xl border border-gray-100" />
          <div className="h-72 bg-white rounded-2xl border border-gray-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-10 space-y-8">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase italic tracking-tight text-slate-900">
            Analytics
          </h1>
          <p className="text-sm font-semibold text-slate-500 mt-1">
            Loaded {items.length} items • Total: {total} • Submitted: {submitted.length}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadAll()}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
          >
            Refresh
          </button>
          <Link
            href="/review"
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-black transition-colors"
          >
            Anonymous Review
          </Link>
        </div>
      </header>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total Loaded</p>
          <p className="text-3xl font-black text-slate-900">{items.length}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">safety-capped if huge</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Submitted Rate</p>
          <p className="text-3xl font-black text-slate-900">{pct(submitted.length, items.length)}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">{submitted.length} of {items.length}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Top City</p>
          <p className="text-3xl font-black text-slate-900">{topCities[0]?.[0] ?? "—"}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">{topCities[0]?.[1] ?? 0} candidates</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-8 py-5 border-b border-gray-50 bg-slate-50/50">
            <h2 className="text-lg font-black uppercase italic tracking-tight">Pipeline</h2>
          </div>
          <div className="p-8 space-y-3">
            {pipeline.map(([k, n]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">{k.replace(/_/g, " ")}</span>
                <span className="text-sm font-black text-slate-900">{n}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-8 py-5 border-b border-gray-50 bg-slate-50/50">
            <h2 className="text-lg font-black uppercase italic tracking-tight">Decisions</h2>
          </div>
          <div className="p-8 space-y-3">
            {decision.map(([k, n]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">{k.replace(/_/g, " ")}</span>
                <span className="text-sm font-black text-slate-900">{n}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-8 py-5 border-b border-gray-50 bg-slate-50/50">
            <h2 className="text-lg font-black uppercase italic tracking-tight">Gender</h2>
          </div>
          <div className="p-8 space-y-3">
            {gender.map(([k, n]) => (
              <div key={String(k)} className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">{String(k)}</span>
                <span className="text-sm font-black text-slate-900">{n}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-8 py-5 border-b border-gray-50 bg-slate-50/50">
            <h2 className="text-lg font-black uppercase italic tracking-tight">Top Cities</h2>
          </div>
          <div className="p-8 space-y-3">
            {topCities.map(([k, n]) => (
              <div key={String(k)} className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">{String(k)}</span>
                <span className="text-sm font-black text-slate-900">{n}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
