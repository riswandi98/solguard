import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// SolGuard AI explainer. Server-side only: the API key never reaches the
// browser. Provider: the user's free DeepSeek-compatible endpoint
// (100milionseek). Key from EXPLAIN_API_KEY env; during local dev it falls
// back to the key file the user keeps on this machine. Any failure returns
// the deterministic rule summary instead — the panel never breaks.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getKey(): Promise<string | null> {
  if (process.env.EXPLAIN_API_KEY) return process.env.EXPLAIN_API_KEY;
  try {
    const p = path.join(process.cwd(), "..", "100milionseek", "api-key.txt");
    const raw = await fs.readFile(p, "utf8");
    const key = raw.trim().split(/\s+/)[0];
    return key || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const { tx, risk, lang } = body || {};
  if (!tx || !risk) {
    return NextResponse.json({ error: "missing tx/risk" }, { status: 400 });
  }
  const fallback = lang === "en" ? risk.summaryEn : risk.summaryId;

  const key = await getKey();
  if (!key) {
    return NextResponse.json({ source: "rules", text: fallback });
  }

  const facts = {
    status: tx.failed ? `FAILED (${tx.error})` : "success",
    feePayer: tx.feePayer,
    solChanges: tx.solChanges,
    tokenChanges: tx.tokenChanges,
    programs: tx.programs,
    authorityEvents: tx.authorityEvents,
    riskScore: risk.score,
    riskVerdict: risk.verdict,
    riskReasons: (risk.reasons || []).map((r: any) => (lang === "en" ? r.en : r.id)),
  };

  const system =
    lang === "en"
      ? "You are SolGuard, a friendly security explainer. Explain a Solana transaction to a non-technical user in plain English, max 110 words. Say what actually happens, name the red flags if any, and end with one clear line: safe to sign, check first, or do not sign. Never invent facts that are not in the data."
      : "Kamu SolGuard, penjelas keamanan yang ramah. Jelaskan transaksi Solana ke pengguna awam dalam Bahasa Indonesia yang sederhana, maksimal 110 kata. Sampaikan apa yang sebenarnya terjadi, sebutkan tanda bahaya kalau ada, dan tutup dengan satu kalimat tegas: aman ditandatangani, periksa dulu, atau jangan ditandatangani. Jangan mengarang fakta di luar data.";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch("https://100milionseek.top/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4.1-flash-free",
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(facts) },
        ],
        max_tokens: 400,
        temperature: 0.3,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("empty LLM reply");
    return NextResponse.json({ source: "ai", text });
  } catch {
    clearTimeout(timer);
    return NextResponse.json({ source: "rules", text: fallback });
  }
}
