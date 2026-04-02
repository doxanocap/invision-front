"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    authApi
      .me()
      .then((me) => {
        if (me.role === "admissions") router.replace("/applications");
        else if (me.role === "candidate") router.replace("/my-application");
        else router.replace("/login");
      })
      .catch(() => {
        clearTokens();
        router.replace("/login");
      });
  }, [router]);

  return null;
}
