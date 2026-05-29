// /api/mc-proxy.js — Maintenance Connection backend proxy
//
// What this does:
// Receives a POST from EXEC-OS containing { targetUrl, headerStyle }.
// Authenticates server-side with the MC keys stored as environment variables.
// Calls the target URL on MC's side (no CORS — server-to-server).
// Returns the raw response (status, headers, body) to EXEC-OS verbatim.
//
// Why this exists:
// MC servers reject browser calls via CORS. The browser literally cannot
// authenticate to MC directly. This function is the only path that works.
// It also keeps the corporate-issued keys out of the browser entirely —
// they live as Vercel environment variables, never in localStorage, never
// in any client-side JavaScript.
//
// Environment variables required (set in Vercel dashboard):
//   MC_CONNECTION_KEY — Antoine's CPM... connection key from Accruent
//   MC_API_KEY        — Antoine's e61... API key from Accruent
//
// Optional URL allowlist (defense-in-depth so this proxy can't be abused to
// hit arbitrary internet hosts):
//   MC_ALLOWED_HOSTS  — comma-separated list of hostnames the proxy may call
//                       (e.g. "maintenanceconnection.com,accruent.com")
//                       If unset, the function defaults to allowing only
//                       known Accruent/MC domains.

const DEFAULT_ALLOWED = [
  "maintenanceconnection.com",
  "accruent.com",
];

// Four common Accruent auth-header patterns. Tried in order on a "probe" call.
const HEADER_STYLES = {
  mc_pair: (conn, key) => ({ "MCConnectionKey": conn, "MCAPIKey": key }),
  bare_pair: (conn, key) => ({ "ConnectionKey": conn, "ApiKey": key }),
  x_prefixed: (conn, key) => ({ "X-MC-ConnectionKey": conn, "X-MC-APIKey": key }),
  bearer: (conn, key) => ({ "Authorization": "Bearer " + key, "X-Connection-Key": conn }),
};

function isHostAllowed(targetUrl) {
  let host;
  try { host = new URL(targetUrl).hostname.toLowerCase(); }
  catch (e) { return false; }
  const allowList = (process.env.MC_ALLOWED_HOSTS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  const allowed = allowList.length ? allowList : DEFAULT_ALLOWED;
  return allowed.some(domain => host === domain || host.endsWith("." + domain));
}

module.exports = async function handler(req, res) {
  // CORS for the browser side — only allow your own front-end
  res.setHeader("Access-Control-Allow-Origin", "*"); // tighten to keraos.cc once verified
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const connectionKey = process.env.MC_CONNECTION_KEY;
  const apiKey = process.env.MC_API_KEY;
  if (!connectionKey || !apiKey) {
    res.status(500).json({
      error: "Server not configured.",
      hint: "Set MC_CONNECTION_KEY and MC_API_KEY in Vercel project environment variables (Project → Settings → Environment Variables), then redeploy.",
    });
    return;
  }

  // Parse body — works whether Vercel auto-parses or not
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const { targetUrl, headerStyle } = body;
  if (!targetUrl) { res.status(400).json({ error: "Missing targetUrl in request body." }); return; }

  if (!isHostAllowed(targetUrl)) {
    res.status(403).json({ error: "Host not in allowlist.", host: (() => { try { return new URL(targetUrl).hostname; } catch (e) { return "(invalid url)"; } })() });
    return;
  }

  // "probe" mode: try every header style at once, return all results
  if (headerStyle === "probe") {
    const results = {};
    for (const [styleName, builder] of Object.entries(HEADER_STYLES)) {
      const headers = { ...builder(connectionKey, apiKey), "Accept": "application/json" };
      const started = Date.now();
      try {
        const response = await fetch(targetUrl, { method: "GET", headers });
        const text = await response.text();
        results[styleName] = {
          status: response.status,
          ms: Date.now() - started,
          body: text.slice(0, 2000),
          contentType: response.headers.get("content-type") || "",
        };
      } catch (e) {
        results[styleName] = { error: String(e.message || e), ms: Date.now() - started };
      }
    }
    res.status(200).json({ probe: true, targetUrl, results });
    return;
  }

  // Default mode: use the requested header style (or mc_pair by default)
  const style = HEADER_STYLES[headerStyle] || HEADER_STYLES.mc_pair;
  const headers = { ...style(connectionKey, apiKey), "Accept": "application/json" };
  const started = Date.now();
  try {
    const response = await fetch(targetUrl, { method: "GET", headers });
    const text = await response.text();
    const responseHeaders = {};
    response.headers.forEach((v, k) => { responseHeaders[k] = v; });
    res.status(200).json({
      status: response.status,
      ms: Date.now() - started,
      headers: responseHeaders,
      body: text.slice(0, 8000), // cap to keep response sane
      targetUrl,
      headerStyle: headerStyle || "mc_pair",
    });
  } catch (e) {
    res.status(200).json({
      status: 0,
      ms: Date.now() - started,
      error: String(e.message || e),
      targetUrl,
      headerStyle: headerStyle || "mc_pair",
    });
  }
};
