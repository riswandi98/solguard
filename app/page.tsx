"use client";

import { useState } from "react";
import { decodeSignature, programName, type DecodedTx } from "@/lib/decode";
import { assessRisk, type RiskReport } from "@/lib/risk";
import { useEffect, useMemo } from "react";

const DEMO_SAFE =
  "5qXjYdHKvG8QUudPqPeW2RP87Wxhz44MgjeEUQJWfDNN1o8eauNPUgohjb3zuXNRMk181XTuXuDkB4Gm9PnP7NPb";
const DEMO_RISKY =
  "teh4mGL3XFW9zuUdXRLA9fVdGM336sR8DuaNYyGqKpZM1YbeEi3iCDjSC9mnpKRXWnoiv6Cz3w8Pt6ycQt7cQkF";

type Lang = "id" | "en";

const T = {
  id: {
    tagline:
      "Tempel signature transaksi Solana — SolGuard bacain buat kamu: apa yang pindah, program apa yang dipanggil, dan adakah approval berbahaya. Sebelum kamu sign, bukan sesudahnya.",
    placeholder: "Tempel signature transaksi di sini…",
    check: "Periksa",
    checking: "Memeriksa…",
    notFound:
      "Transaksi tidak ditemukan. Cek lagi signature-nya — mungkin salah salin atau belum tercatat di mainnet.",
    genericError: "Gagal membaca transaksi. Coba lagi sebentar.",
    result: "Hasil bacaan",
    status: "Status",
    success: "Berhasil",
    failedTx: "Gagal di jaringan",
    slot: "Slot",
    time: "Waktu",
    feePayer: "Pembayar fee",
    fee: "Fee jaringan",
    solMoves: "Pergerakan SOL",
    tokenMoves: "Pergerakan token",
    noMoves: "Tidak ada perubahan saldo.",
    programs: "Program yang dipanggil",
    authority: "Approval & perubahan otoritas",
    authorityNone:
      "Tidak ada instruksi approve / setAuthority di transaksi ini.",
    authorityWarn:
      "Bagian ini yang paling sering dipakai drainer. Pastikan kamu kenal alamat delegate / otoritas barunya.",
    riskTitle: "Skor risiko",
    verdictAman: "AMAN",
    verdictHati: "HATI-HATI",
    verdictBahaya: "BAHAYA",
    aiTitle: "Penjelasan sederhana",
    aiLoading: "AI sedang membaca transaksi…",
    aiSource: "dijelaskan AI",
    rulesSource: "ringkasan aturan (AI tidak tersedia)",
    demoSafe: "▶ Contoh aman",
    demoRisky: "▶ Contoh berisiko (ada approve)",
    received: "menerima",
    sent: "mengirim",
    footer:
      "SolGuard hanya membaca data publik di blockchain — tidak pernah meminta kunci, seed, atau tanda tangan.",
  },
  en: {
    tagline:
      "Paste a Solana transaction signature — SolGuard reads it for you: what moved, which programs ran, and whether a dangerous approval hides inside. Before you sign, not after.",
    placeholder: "Paste a transaction signature here…",
    check: "Check",
    checking: "Checking…",
    notFound:
      "Transaction not found. Double-check the signature — it may be mistyped or not on mainnet yet.",
    genericError: "Could not read the transaction. Try again in a moment.",
    result: "Reading result",
    status: "Status",
    success: "Success",
    failedTx: "Failed on-chain",
    slot: "Slot",
    time: "Time",
    feePayer: "Fee payer",
    fee: "Network fee",
    solMoves: "SOL movements",
    tokenMoves: "Token movements",
    noMoves: "No balance changes.",
    programs: "Programs called",
    authority: "Approvals & authority changes",
    authorityNone: "No approve / setAuthority instructions in this transaction.",
    authorityWarn:
      "This is the part drainers abuse most. Make sure you recognise the delegate / new authority address.",
    riskTitle: "Risk score",
    verdictAman: "SAFE",
    verdictHati: "CAUTION",
    verdictBahaya: "DANGER",
    aiTitle: "Plain-language explanation",
    aiLoading: "AI is reading the transaction…",
    aiSource: "explained by AI",
    rulesSource: "rule summary (AI unavailable)",
    demoSafe: "▶ Safe example",
    demoRisky: "▶ Risky example (has an approval)",
    received: "received",
    sent: "sent",
    footer:
      "SolGuard only reads public blockchain data — it never asks for keys, seeds, or signatures.",
  },
} as const;

function short(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

function fmt(n: number, max = 6): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: max });
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("id");
  const [sig, setSig] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tx, setTx] = useState<DecodedTx | null>(null);
  const [ai, setAi] = useState<{ source: string; text: string } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const t = T[lang];
  const risk: RiskReport | null = useMemo(() => (tx ? assessRisk(tx) : null), [tx]);

  useEffect(() => {
    if (!tx || !risk) return;
    let alive = true;
    setAiBusy(true);
    setAi(null);
    fetch("/api/explain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tx, risk, lang }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (alive && j?.text) setAi({ source: j.source, text: j.text });
      })
      .catch(() => {})
      .finally(() => alive && setAiBusy(false));
    return () => {
      alive = false;
    };
  }, [tx, risk, lang]);

  async function runDemo(signature: string) {
    setSig(signature);
    setBusy(true);
    setError(null);
    setTx(null);
    try {
      setTx(await decodeSignature(signature));
    } catch (err: any) {
      setError(t.genericError);
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sig.trim()) return;
    setBusy(true);
    setError(null);
    setTx(null);
    try {
      setTx(await decodeSignature(sig));
    } catch (err: any) {
      setError(
        err?.message === "not-found" ? t.notFound : `${t.genericError} (${err?.message || "?"})`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap">
      <header>
        <h1>
          <span className="shield">🛡</span> SolGuard
        </h1>
        <div className="lang">
          <button className={lang === "id" ? "on" : ""} onClick={() => setLang("id")}>
            ID
          </button>{" "}
          <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>
            EN
          </button>
        </div>
      </header>
      <p className="tagline">{t.tagline}</p>

      <form onSubmit={onSubmit}>
        <input
          type="text"
          value={sig}
          onChange={(e) => setSig(e.target.value)}
          placeholder={t.placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        <button className="go" type="submit" disabled={busy}>
          {busy ? t.checking : t.check}
        </button>
      </form>

      <div className="demos">
        <button type="button" className="demo safe" onClick={() => runDemo(DEMO_SAFE)} disabled={busy}>
          {t.demoSafe}
        </button>
        <button type="button" className="demo risky" onClick={() => runDemo(DEMO_RISKY)} disabled={busy}>
          {t.demoRisky}
        </button>
      </div>

      {error && (
        <div className="card">
          <p className="err">{error}</p>
        </div>
      )}

      {tx && risk && (
        <>
          <div className={`card verdict ${risk.verdict}`}>
            <h2>
              {t.riskTitle}:{" "}
              {risk.verdict === "aman"
                ? t.verdictAman
                : risk.verdict === "bahaya"
                  ? t.verdictBahaya
                  : t.verdictHati}{" "}
              · {risk.score}/100
            </h2>
            <p>{lang === "en" ? risk.summaryEn : risk.summaryId}</p>
            {risk.reasons.map((r, i) => (
              <div className="row" key={i}>
                <span>{lang === "en" ? r.en : r.id}</span>
                <span className="pts">+{r.points}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <h2>{t.aiTitle}</h2>
            {aiBusy && <p className="mut">{t.aiLoading}</p>}
            {ai && (
              <>
                <p className="ai-text">{ai.text}</p>
                <p className="mut">
                  {ai.source === "ai" ? t.aiSource : t.rulesSource}
                </p>
              </>
            )}
          </div>

          <div className="card">
            <h2>{t.result}</h2>
            <div className="row">
              <span>{t.status}</span>
              <span className={tx.failed ? "err" : "plus"}>
                {tx.failed ? `${t.failedTx} (${tx.error})` : t.success}
              </span>
            </div>
            <div className="row">
              <span>{t.slot}</span>
              <span>{tx.slot.toLocaleString("en-US")}</span>
            </div>
            {tx.blockTime && (
              <div className="row">
                <span>{t.time}</span>
                <span>{new Date(tx.blockTime * 1000).toLocaleString()}</span>
              </div>
            )}
            <div className="row">
              <span>{t.feePayer}</span>
              <span className="addr">{tx.feePayer}</span>
            </div>
            <div className="row">
              <span>{t.fee}</span>
              <span>{fmt(tx.feeSol, 9)} SOL</span>
            </div>
          </div>

          <div className="card">
            <h2>{t.solMoves}</h2>
            {tx.solChanges.length === 0 && <p className="mut">{t.noMoves}</p>}
            {tx.solChanges.map((c, i) => (
              <div className="row" key={i}>
                <span className="addr">{short(c.account)}</span>
                <span className={c.delta > 0 ? "plus" : "minus"}>
                  {c.delta > 0 ? `${t.received} +` : `${t.sent} `}
                  {fmt(Math.abs(c.delta), 9)} SOL
                </span>
              </div>
            ))}
          </div>

          <div className="card">
            <h2>{t.tokenMoves}</h2>
            {tx.tokenChanges.length === 0 && <p className="mut">{t.noMoves}</p>}
            {tx.tokenChanges.map((c, i) => (
              <div className="row" key={i}>
                <span>
                  <span className="addr">{short(c.mint)}</span>
                  <br />
                  <span className="mut">owner {short(c.owner)}</span>
                </span>
                <span className={c.delta > 0 ? "plus" : "minus"}>
                  {c.delta > 0 ? "+" : "−"}
                  {fmt(Math.abs(c.delta))}
                </span>
              </div>
            ))}
          </div>

          <div className="card">
            <h2>{t.authority}</h2>
            {tx.authorityEvents.length === 0 && (
              <p className="mut">{t.authorityNone}</p>
            )}
            {tx.authorityEvents.map((a, i) => (
              <div className="row" key={i}>
                <span>
                  <strong>{a.kind}</strong> <span className="mut">({a.program})</span>
                </span>
                <span className="addr">{a.detail}</span>
              </div>
            ))}
            {tx.authorityEvents.length > 0 && (
              <div className="flag">⚠ {t.authorityWarn}</div>
            )}
          </div>

          <div className="card">
            <h2>{t.programs}</h2>
            {tx.programs.map((p) => (
              <div className="row" key={p}>
                <span>{programName(p)}</span>
                <span className="addr">{p !== programName(p) ? short(p) : ""}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <footer>{t.footer}</footer>
    </main>
  );
}
