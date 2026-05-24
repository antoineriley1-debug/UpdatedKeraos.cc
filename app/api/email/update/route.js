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
  return new NextResponse(null, { status: 204, headers: CORS });
}

const ALLOWED_PATCH_KEYS = ["pinned", "archived", "verified_source", "in_review_queue", "user_tags", "user_notes", "status", "process_error"];
const ALLOWED_EXTRACTION_KEYS = ["topic", "urgency", "category", "sites", "vendors", "people", "equipment", "rooms", "projects", "systems", "action_items", "commitments", "dates_mentioned", "approvals_needed", "deadlines", "summary", "raw_extraction"];

export async function POST(req) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json({ error: "server misconfigured" }, { status: 500, headers: CORS });
    }
    const body = await req.json();
    const { workspace, email_id, patch, extraction } = body || {};
    if (!workspace || !email_id) {
      return NextResponse.json({ error: "workspace and email_id required" }, { status: 400, headers: CORS });
    }

    const headers = {
      "Content-Type": "application/json",
      "apikey": SERVICE_KEY,
      "Authorization": "Bearer " + SERVICE_KEY,
      "Prefer": "return=representation",
    };

    if (patch && typeof patch === "object") {
      const safePatch = {};
      for (const k of ALLOWED_PATCH_KEYS) if (k in patch) safePatch[k] = patch[k];
      if (Object.keys(safePatch).length === 0) {
        return NextResponse.json({ error: "no valid patch keys" }, { status: 400, headers: CORS });
      }
      const url = SUPABASE_URL + "/rest/v1/ingested_emails"
        + "?id=eq." + encodeURIComponent(email_id)
        + "&workspace_key=eq." + encodeURIComponent(workspace);
      const res = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(safePatch) });
      if (!res.ok) {
        const txt = await res.text();
        return NextResponse.json({ error: "patch failed " + res.status, detail: txt.slice(0, 300) }, { status: 500, headers: CORS });
      }
      const rows = await res.json();
      return NextResponse.json({ ok: true, updated: rows[0] || null }, { status: 200, headers: CORS });
    }

    if (extraction && typeof extraction === "object") {
      const safe = { email_id, workspace_key: workspace, generated_at: new Date().toISOString() };
      for (const k of ALLOWED_EXTRACTION_KEYS) if (k in extraction) safe[k] = extraction[k];
      const url = SUPABASE_URL + "/rest/v1/email_extractions?on_conflict=email_id";
      const res = await fetch(url, { method: "POST", headers: { ...headers, "Prefer": "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(safe) });
      if (!res.ok) {
        const txt = await res.text();
        return NextResponse.json({ error: "extraction save failed " + res.status, detail: txt.slice(0, 300) }, { status: 500, headers: CORS });
      }
      const rows = await res.json();
      return NextResponse.json({ ok: true, extraction: rows[0] || null }, { status: 200, headers: CORS });
    }

    return NextResponse.json({ error: "either patch or extraction required" }, { status: 400, headers: CORS });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: CORS });
  }
}
