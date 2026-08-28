import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/spotifyAuth";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearAuthCookies();
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function GET() {
  // Allow GET for convenience (redirect-friendly), but POST is canonical
  await clearAuthCookies();
  return NextResponse.json({ ok: true }, { status: 200 });
}
