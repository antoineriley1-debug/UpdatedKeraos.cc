// EXEC-OS EMAIL INGEST WEBHOOK — app/api/email/ingest/route.js
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,X-Ingest-Secret",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req) {
  try {
    const secret = req.headers.get("x-ingest-secret") || "";
    if (!process.env.INGEST_SECRET || secret !== process.env.INGEST_SECRET) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: CORS });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
    const WORKSPACE    = process.env.INGEST_WORKSPACE_KEY;
    if (!SUPABASE_URL || !SERVICE_KEY || !WORKSPACE) {
      return NextResponse.json({ error: "server misconfigured" }, { status: 500, headers: CORS });
    }

    const payload = await req.json();
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "bad payload" }, { status: 400, headers: CORS });
    }

    const fwd = detectForward(payload.text_body || "", payload.html_body || "", payload.subject || "");

    const emailRow = {
      workspace_key: WORKSPACE,
      message_id:    payload.message_id || null,
      from_addr:     payload.from_addr || null,
      from_name:     payload.from_name || null,
      to_addr:       payload.to_addr || null,
      cc_addr:       payload.cc_addr || null,
      subject:       payload.subject || "(no subject)",
      date_header:   payload.date_header || null,
      original_from: fwd.original_from,
      original_subject: fwd.original_subject,
      original_date:    fwd.original_date,
      text_body:     (payload.text_body || "").slice(0, 200000),
      html_body:     (payload.html_body || "").slice(0, 200000),
      raw_size_bytes: payload.raw_size_bytes || 0,
      status:        "received",
    };

    const insertedEmail = await sbInsert(SUPABASE_URL, SERVICE_KEY, "ingested_emails", emailRow, "representation");
    if (!insertedEmail || !insertedEmail[0]) {
      return NextResponse.json({ error: "insert failed" }, { status: 500, headers: CORS });
    }
    const emailId = insertedEmail[0].id;

    const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
    let attachInserted = 0;
    let attachSkipped = 0;
    for (const a of attachments) {
      if (a.skipped) { attachSkipped++; continue; }
      try {
        await sbInsert(SUPABASE_URL, SERVICE_KEY, "ingested_attachments", {
          email_id:      emailId,
          workspace_key: WORKSPACE,
          filename:      a.filename || "unnamed",
          mime_type:     a.mimeType || "application/octet-stream",
          size_bytes:    a.size || 0,
          content_b64:   a.content_b64 || "",
        });
        attachInserted++;
      } catch (e) {
        attachSkipped++;
      }
    }

    return NextResponse.json({
      ok: true,
      email_id: emailId,
      attachments_inserted: attachInserted,
      attachments_skipped: attachSkipped,
    }, { status: 200, headers: CORS });

  } catch (err) {
    return NextResponse.json({ error: err.message || "unknown" }, { status: 500, headers: CORS });
  }
}

async function sbInsert(url, key, table, row, prefer = null) {
  const headers = {
    "Content-Type": "application/json",
    "apikey": key,
    "Authorization": "Bearer " + key,
  };
  if (prefer === "representation") headers["Prefer"] = "return=representation";

  const res = await fetch(url + "/rest/v1/" + table, {
    method: "POST",
    headers,
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error("Supabase " + res.status + ": " + txt.slice(0, 300));
  }
  if (prefer === "representation") {
    return await res.json();
  }
  return null;
}

function detectForward(text, html, subject) {
  const out = { original_from: null, original_subject: null, original_date: null };
  if (!/^\s*(fwd?|fw):/i.test(subject || "") && !/-+\s*forwarded message\s*-+/i.test(text || "")) {
    return out;
  }
  const headerBlock = (text || "").slice(0, 2500);
  const fromMatch = headerBlock.match(/^\s*From:\s*(.+?)\s*$/mi);
  const subjMatch = headerBlock.match(/^\s*Subject:\s*(.+?)\s*$/mi);
  const dateMatch = headerBlock.match(/^\s*(?:Sent|Date):\s*(.+?)\s*$/mi);
  if (fromMatch)  out.original_from    = fromMatch[1].slice(0, 300);
  if (subjMatch)  out.original_subject = subjMatch[1].slice(0, 300);
  if (dateMatch) {
    const parsed = new Date(dateMatch[1]);
    if (!isNaN(parsed.getTime())) out.original_date = parsed.toISOString();
  }
  return out;
}
