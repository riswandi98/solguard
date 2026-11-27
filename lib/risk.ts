// SolGuard — deterministic risk scoring over a decoded transaction.
// Pure rules, no network. Every point comes with a plain-language reason
// (Indonesian + English) so the verdict can always be explained without AI.

import type { DecodedTx } from "./decode";
import { programName } from "./decode";

export type Verdict = "aman" | "hati-hati" | "bahaya";

export interface RiskReason {
  points: number;
  id: string;
  en: string;
}

export interface RiskReport {
  score: number; // 0..100
  verdict: Verdict;
  reasons: RiskReason[];
  summaryId: string;
  summaryEn: string;
}

function short(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

export function assessRisk(tx: DecodedTx): RiskReport {
  const reasons: RiskReason[] = [];
  let score = 0;
  const add = (points: number, id: string, en: string) => {
    score += points;
    reasons.push({ points, id, en });
  };

  // --- authority events: the drainer classics ---
  for (const ev of tx.authorityEvents) {
    if (ev.kind === "setAuthority") {
      add(
        70,
        `Otoritas akun dipindahkan (${ev.detail || "ke alamat lain"}). Ini pola khas drainer: setelah ini, pemilik asli tidak lagi mengendalikan akun/token-nya.`,
        `Account authority is transferred (${ev.detail || "to another address"}). This is the classic drainer pattern: after this, the original owner no longer controls the account/tokens.`
      );
    } else if (ev.kind === "approve" || ev.kind === "approveChecked") {
      add(
        45,
        `Izin belanja (approve) diberikan ke delegate (${ev.detail}). Delegate bisa menarik token sampai batas izin tanpa tanda tangan baru.`,
        `A spending approval (approve) is given to a delegate (${ev.detail}). The delegate can pull tokens up to the approved amount without any new signature.`
      );
    } else if (ev.kind === "closeAccount") {
      add(
        25,
        "Sebuah akun token ditutup di transaksi ini. Wajar saat membersihkan akun kosong, tapi juga langkah akhir pengurasan.",
        "A token account is closed in this transaction. Normal when cleaning up empty accounts, but also a final step in draining."
      );
    } else if (ev.kind === "mintTo" || ev.kind === "mintToChecked") {
      add(
        5,
        "Token baru dicetak (mint) di transaksi ini.",
        "New tokens are minted in this transaction."
      );
    }
  }

  // --- token balances drained to zero (fee payer's own tokens) ---
  for (const c of tx.tokenChanges) {
    if (c.owner === tx.feePayer && c.pre > 0 && c.post === 0) {
      add(
        30,
        `Saldo token ${short(c.mint)} milik penanda tangan habis total (turun ke nol).`,
        `The signer's ${short(c.mint)} token balance is fully drained (down to zero).`
      );
    }
  }

  // --- large SOL outflow from the signer ---
  const payerSol = tx.solChanges.find((c) => c.account === tx.feePayer);
  if (payerSol && payerSol.delta < 0) {
    const out = Math.abs(payerSol.delta) - tx.feeSol;
    if (out >= 5) {
      add(
        20,
        `SOL keluar dari dompet penanda tangan cukup besar: ${out.toFixed(3)} SOL (di luar fee).`,
        `A sizable SOL outflow from the signer's wallet: ${out.toFixed(3)} SOL (excluding the fee).`
      );
    } else if (out >= 1) {
      add(
        10,
        `SOL keluar dari dompet penanda tangan: ${out.toFixed(3)} SOL (di luar fee).`,
        `SOL leaves the signer's wallet: ${out.toFixed(3)} SOL (excluding the fee).`
      );
    }
    if (payerSol.pre > 0 && payerSol.post / payerSol.pre < 0.05 && out >= 0.5) {
      add(
        25,
        "Saldo SOL penanda tangan terkuras hampir habis (tersisa kurang dari 5%).",
        "The signer's SOL balance is almost fully drained (less than 5% left)."
      );
    }
  }

  // --- unknown programs ---
  const unknown = tx.programs.filter((p) => programName(p) === p);
  if (unknown.length >= 2) {
    add(
      10,
      `${unknown.length} program tidak dikenal dipanggil sekaligus — makin banyak program asing, makin sulit menebak isi transaksi.`,
      `${unknown.length} unknown programs are called at once — the more unfamiliar programs, the harder the transaction is to reason about.`
    );
  }

  if (tx.failed) {
    add(
      0,
      "Transaksi ini GAGAL di jaringan, jadi tidak ada dampak saldo yang bertahan — tapi kegagalan juga bisa berarti isinya tidak berjalan seperti yang dijanjikan situs.",
      "This transaction FAILED on-chain, so no balance impact persists — but a failure can also mean it did not do what the site promised."
    );
  }

  score = Math.max(0, Math.min(100, score));
  const verdict: Verdict = score >= 70 ? "bahaya" : score >= 30 ? "hati-hati" : "aman";

  const summaryId =
    verdict === "bahaya"
      ? "JANGAN tanda tangani transaksi seperti ini sebelum yakin betul siapa penerima otoritas/delegate-nya. Pola di dalamnya cocok dengan cara drainer menguras dompet."
      : verdict === "hati-hati"
        ? "Ada bagian yang perlu dicek manual — terutama izin belanja dan aliran keluar di bawah. Kenali alamat tujuannya sebelum lanjut."
        : reasons.length === 0
          ? "Tidak ditemukan pola berbahaya: tidak ada approve, tidak ada pemindahan otoritas, dan aliran saldo terlihat wajar."
          : "Pola berbahayanya ringan. Tetap baca aliran saldo di bawah supaya yakin isinya sesuai yang kamu harapkan.";
  const summaryEn =
    verdict === "bahaya"
      ? "Do NOT sign a transaction like this until you are sure who receives the authority/delegate rights. Its pattern matches how drainers empty wallets."
      : verdict === "hati-hati"
        ? "Some parts need a manual look — especially spending approvals and outflows below. Recognise the destination addresses before proceeding."
        : reasons.length === 0
          ? "No dangerous pattern found: no approvals, no authority transfers, and balance flows look ordinary."
          : "Only mild risk patterns. Still read the balance flows below to confirm the contents match your expectation.";

  reasons.sort((a, b) => b.points - a.points);
  return { score, verdict, reasons, summaryId, summaryEn };
}
