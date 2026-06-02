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
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json({ error: "server misconfigured" }, { status: 500, headers: CORS });
    }

    const u = new URL(req.url);
    const workspace = u.searchParams.get("workspace");
    if (!workspace) {
      return NextResponse.json({ error: "workspace required" }, { status: 400, headers: CORS });
    }
    
    const limit = Math.min(parseInt(u.searchParams.get("limit") || "50", 10) || 50, 200);

    // Query Supabase for emails in this workspace
    let q = SUPABASE_URL + "/rest/v1/ingested_emails"
      + "?workspace_key=eq." + encodeURIComponent(workspace)
      + "&order=received_at.desc"
      + "&limit=" + limit;

    const res = await fetch(q, {
      headers: {
        "apikey": SERVICE_KEY,
        "Authorization": "Bearer " + SERVICE_KEY,
      },
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: "Supabase " + res.status, detail: txt.slice(0, 300) }, { status: res.status, headers: CORS });
    }

    const emails = await res.json();
    return NextResponse.json({ 
      workspace, 
      emails, 
      count: emails.length,
      status: "success"
    }, { status: 200, headers: CORS });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: CORS });
  }
}
