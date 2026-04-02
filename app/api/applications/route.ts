import { NextRequest, NextResponse } from "next/server";
import { admissionsApi } from "@/lib/api";

const ASCII_REGEX = /^[\x20-\x7E]*$/;

function getToken(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const extracted = authHeader || (request.cookies.get("access_token")?.value ? `Bearer ${request.cookies.get("access_token")?.value}` : undefined);
  if (!extracted) return undefined;
  
  const clean = extracted.replace(/[^\x20-\x7E]/g, '').trim();
  if (!ASCII_REGEX.test(clean)) return undefined;
  return clean;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token = getToken(request);

  try {
    const query = Object.fromEntries(searchParams.entries());
    // remove empty strings to be safe
    for (const key in query) {
      if (query[key] === "" || query[key] === "all" || query[key] === undefined) {
        delete query[key];
      }
    }
    const data = await admissionsApi.getApplications(query, token);
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Failed to proxy to /api/applications:", error);
    const status = (error as any).status || 500;
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
