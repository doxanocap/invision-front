import { NextRequest, NextResponse } from "next/server";
import { admissionsApi } from "@/lib/api";
import { DecisionStatus } from "@/types/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function getToken(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader) return authHeader;
  const cookie = request.cookies.get("access_token");
  if (cookie?.value) return `Bearer ${cookie.value}`;
  return undefined;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const token = getToken(request);
  try {
    const body: { decision_status: DecisionStatus } = await request.json();
    const data = await admissionsApi.setDecision(Number(id), body.decision_status, token);
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error(`Failed to proxy decision ${id}:`, error);
    const status = (error as any).status || 500;
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
