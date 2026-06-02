// EXEC-OS EMAIL UPDATE / EXTRACTION API — app/api/email/update/route.js
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 15;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json(null, { status: 204, headers: CORS });
}

export async function POST(req) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json({ error: "server misconfigured" }, { status: 500, headers: CORS });
    }

    const body = await req.json();
    const { workspace, email_id, extraction } = body || {};
    
    if (!workspace || !email_id) {
      return NextResponse.json({ error: "workspace and email_id required" }, { status: 400, headers: CORS });
    }

    if (!extraction || typeof extraction !== "object") {
      return NextResponse.json({ error: "extraction object required" }, { status: 400, headers: CORS });
    }

    // Save extraction to Supabase
    const headers = {
      "Content-Type": "application/json",
      "apikey": SERVICE_KEY,
      "Authorization": "Bearer " + SERVICE_KEY,
      "Prefer": "return=representation",
    };

    const safeExtraction = {
      email_id,
      workspace_key: workspace,
      extracted_data: extraction,
      extracted_at: new Date().toISOString(),
    };

    const url = SUPABASE_URL + "/rest/v1/email_extractions";
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(safeExtraction),
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: "Save failed " + res.status, detail: txt.slice(0, 300) }, { status: res.status, headers: CORS });
    }

    const rows = await res.json();
    return NextResponse.json({
      ok: true,
      extraction: rows[0] || safeExtraction,
      message: "Investigation saved successfully"
    }, { status: 200, headers: CORS });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: CORS });
  }
}
