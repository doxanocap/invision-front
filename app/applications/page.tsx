"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ApplicationsTable } from "@/components/ApplicationsTable";
import { FilterDropdown } from "@/components/FilterDropdown";
import { Pagination } from "@/components/Pagination";
import type { ApplicantListResponse } from "@/types/api";
import { listApplicants } from "@/lib/api-client";

const ITEMS_PER_PAGE = 7;

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "in_review", label: "In Review" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
];

const GENDER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
];

export default function ApplicationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Read URL params
  const search = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "all";
  const cityFilter = searchParams.get("city") || "";
  const genderFilter = searchParams.get("gender") || "all";
  const limit = parseInt(searchParams.get("limit") || String(ITEMS_PER_PAGE), 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  // Local state to track the search input string before hitting "Apply" or Enter
  const [searchInput, setSearchInput] = useState(search);
  const [cityInput, setCityInput] = useState(cityFilter);

  const [data, setData] = useState<ApplicantListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync inputs if URL changes externally
  useEffect(() => {
    setSearchInput(search);
    setCityInput(cityFilter);
  }, [search, cityFilter]);

  // Fetch logic
  useEffect(() => {
    const fetchParams = new URLSearchParams();
    if (search) fetchParams.set("search", search);
    if (statusFilter !== "all") fetchParams.set("status", statusFilter);
    if (cityFilter) fetchParams.set("city", cityFilter);
    if (genderFilter !== "all") fetchParams.set("gender", genderFilter);
    fetchParams.set("limit", limit.toString());
    fetchParams.set("offset", offset.toString());

    setIsLoading(true);
    setError(null);
    listApplicants(fetchParams)
      .then((json) => setData(json))
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [search, statusFilter, cityFilter, genderFilter, limit, offset]);

  // Handle URL updates
  const setURLFilter = (key: string, value: string) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    if (value && value !== "all") {
      current.set(key, value);
    } else {
      current.delete(key);
    }
    current.set("offset", "0"); // Reset page on filter change
    current.set("limit", limit.toString());
    router.push(`${pathname}?${current.toString()}`);
  };

  const clearFilters = () => {
    const reset = new URLSearchParams();
    reset.set("limit", limit.toString());
    reset.set("offset", "0");
    setSearchInput("");
    setCityInput("");
    router.push(`${pathname}?${reset.toString()}`);
  };

  const handlePageChange = (p: number) => {
    const newOffset = (p - 1) * limit;
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    current.set("offset", newOffset.toString());
    router.push(`${pathname}?${current.toString()}`);
  };

  const applySearchAndCity = () => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    if (searchInput) current.set("search", searchInput);
    else current.delete("search");

    if (cityInput) current.set("city", cityInput);
    else current.delete("city");

    current.set("offset", "0");
    router.push(`${pathname}?${current.toString()}`);
  };

  const activeFilters =
    (statusFilter !== "all" ? 1 : 0) +
    (genderFilter !== "all" ? 1 : 0) +
    (cityFilter ? 1 : 0) +
    (search ? 1 : 0);

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1400 }}>
      {/* Page Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.03em",
              marginBottom: 4,
            }}
          >
            Applications
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            View and manage all submitted applications.
          </p>
        </div>
      </div>

      {/* Search + Filters */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 280 }}>
          <input
            type="text"
            placeholder="Search..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySearchAndCity()}
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text-primary)",
              fontSize: 13,
              outline: "none",
            }}
          />
        </div>

        {/* City Filter */}
        <div style={{ position: "relative", flex: "1 1 150px", maxWidth: 200 }}>
          <input
            type="text"
            placeholder="City..."
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySearchAndCity()}
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text-primary)",
              fontSize: 13,
              outline: "none",
            }}
          />
        </div>

        <button
          onClick={applySearchAndCity}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Apply
        </button>

        {/* Filter dropdowns */}
        <FilterDropdown
          label="Status"
          value={statusFilter}
          options={STATUS_OPTIONS}
          onChange={(v) => setURLFilter("status", v as string)}
        />
        <FilterDropdown
          label="Gender"
          value={genderFilter}
          options={GENDER_OPTIONS}
          onChange={(v) => setURLFilter("gender", v as string)}
        />

        {/* Active filter chip */}
        {activeFilters > 0 && (
          <button
            onClick={clearFilters}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "7px 12px",
              borderRadius: 8,
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "#EF4444",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}
          </button>
        )}
      </div>

      {/* Results summary & Main Table */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {isLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
            Loading applications...
          </div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: "center", color: "#EF4444" }}>
            {error}
          </div>
        ) : data && data.items.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
            No applicants found.
          </div>
        ) : data ? (
          <>
            <ApplicationsTable rows={data.items} />
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={data.total}
              itemsPerPage={limit}
              onPageChange={handlePageChange}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
