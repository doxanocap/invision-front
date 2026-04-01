import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/config";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  try {
    const url = new URL(`/api/applicants`, getApiBaseUrl());
    url.search = searchParams.toString();

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to proxy to /api/applicants:", error);
    return NextResponse.json(
      { error: "Internal Server Error during proxy" },
      { status: 500 }
    );
  }
}
