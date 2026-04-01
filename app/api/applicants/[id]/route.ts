import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/config";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const baseUrl = getApiBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/api/applicants/${id}`, {
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
    console.error(`Failed to proxy to /api/applicants/${id}:`, error);
    return NextResponse.json(
      { error: "Internal Server Error during proxy" },
      { status: 500 }
    );
  }
}
