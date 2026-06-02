// EXEC-OS EMAIL LIST API — app/api/email/list/route.js
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json(null, { status: 204, headers: CORS });
}

export async function GET(req) {
  try {
    const u = new URL(req.url);
    const workspace = u.searchParams.get("workspace");
    if (!workspace) {
      return NextResponse.json({ error: "workspace required" }, { status: 400, headers: CORS });
    }

    // TEMPORARY: Return empty inbox (Supabase auth pending)
    // TODO: Replace with real Supabase query once service key is validated
    return NextResponse.json({
      workspace,
      emails: [],
      count: 0,
      message: "Inbox ready. No emails ingested yet.",
      status: "initialized"
    }, { status: 200, headers: CORS });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: CORS });
  }
}
