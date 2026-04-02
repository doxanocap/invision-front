"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { clearTokens, getAccessToken, getRefreshToken } from "@/lib/auth";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const admissionsItems: NavItem[] = [
  {
    href: "/applications",
    label: "Applications",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 3 3 5-6" />
      </svg>
    ),
  },
  {
    href: "/review",
    label: "Review (Anon)",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M9 13h6" />
        <path d="M9 17h6" />
        <path d="M9 9h1" />
      </svg>
    ),
  },
];

const candidateItems: NavItem[] = [
  {
    href: "/my-application",
    label: "My Application",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    href: "/my-case",
    label: "Case Question",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
        <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    if (pathname === "/login" || pathname === "/register") return;

    const token = getAccessToken();
    if (!token) {
      // Defer state updates to avoid sync setState in effect body (eslint react-hooks/set-state-in-effect)
      setTimeout(() => {
        setRole(null);
        setUserEmail(null);
      }, 0);
      return;
    }

    let cancelled = false;
    authApi
      .me()
      .then((me) => {
        if (cancelled) return;
        setRole(me.role);
        setUserEmail(me.email);
      })
      .catch(() => {
        if (cancelled) return;
        clearTokens();
        if (pathname !== "/login") router.replace("/login");
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  const handleLogout = async () => {
    const refresh_token = getRefreshToken();
    if (refresh_token) {
      try {
        await authApi.logout(refresh_token);
      } catch (err) {
        console.error("Logout API call failed", err);
      }
    }
    clearTokens();
    router.replace("/login");
  };

  if (pathname === "/login" || pathname === "/register") return null;

  const items = role === "admissions" ? admissionsItems : candidateItems;

  return (
    <aside className="w-[260px] h-screen bg-white border-r border-gray-200 flex flex-col sticky top-0 shrink-0 overflow-hidden">
      <div className="px-6 py-8 border-b border-gray-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#A7E635] flex items-center justify-center shrink-0 shadow-lg shadow-lime-100">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" />
            <path d="M8 2v16" />
            <path d="M16 6v16" />
          </svg>
        </div>
        <div>
          <div className="font-extrabold text-xl text-slate-900 tracking-tight leading-none uppercase">
            inVision U
          </div>
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
            {role === "admissions" ? "Admissions Hub" : "Candidate Portal"}
          </div>
        </div>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto px-4 py-8 space-y-2">
        {items.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                isActive
                  ? "bg-[#EEF8D4] text-slate-900 border border-slate-200"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span className={isActive ? "text-slate-900" : "text-slate-400"}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 p-4 border-t border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-xs font-bold text-slate-900 shrink-0 border border-gray-200">
            {userEmail?.substring(0, 2).toUpperCase() || "??"}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900 truncate">
              {userEmail}
            </div>
            <div className="text-[10px] text-slate-400 font-bold uppercase truncate">
              {role || "Guest"}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </div>
    </aside>
  );
}
