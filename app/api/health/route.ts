import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/config";

export async function GET() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) {
        return NextResponse.json({ status: "offline", error: "Backend returned error" }, { status: 503 });
    }
    return NextResponse.json(await res.json());
  } catch (error) {
    // Network error connecting to backend
    return NextResponse.json({ status: "offline", error: String(error) }, { status: 503 });
  }
}
