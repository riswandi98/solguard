# SolGuard

**AI yang bacain transaksi Solana sebelum kamu sign.**
**An AI that reads a Solana transaction before you sign it.**

## Masalah / Problem

ID — Kebanyakan korban drainer Solana sebenarnya "menyetujui" transaksinya
sendiri: mereka menekan approve tanpa bisa membaca apa yang sebenarnya akan
terjadi. Explorer menampilkan data mentah yang hanya dimengerti developer.

EN — Most Solana drainer victims actually approved the transaction
themselves: they tapped approve without being able to read what would really
happen. Explorers show raw data only developers understand.

## Cara kerja / How it works

ID — Tempel signature transaksi. SolGuard mengambil data transaksi dari RPC
Solana (`getTransaction`, jsonParsed), lalu menampilkannya dalam bahasa
sederhana: pergerakan SOL dan token, program yang dipanggil, dan — yang
paling penting — instruksi approval / perubahan otoritas (`approve`,
`setAuthority`) yang sering disembunyikan drainer. Read-only: SolGuard tidak
pernah meminta kunci, seed phrase, atau tanda tangan.

EN — Paste a transaction signature. SolGuard fetches the transaction from a
Solana RPC (`getTransaction`, jsonParsed) and shows it in plain language:
SOL and token movements, programs called, and — most importantly — approval /
authority-change instructions (`approve`, `setAuthority`) that drainers love
to hide. Read-only: SolGuard never asks for keys, seed phrases, or signatures.

Roadmap: panel penjelasan AI (ringkasan 3–5 kalimat + skor risiko
Aman / Hati-hati / Bahaya) dan contoh demo 1-klik (aman vs drainer).

## Tech stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Solana JSON-RPC (`getTransaction`, encoding `jsonParsed`) — no SDK, no keys
- LLM explainer via env-configured API key (server-side only)

## Jalankan lokal / Run locally

```bash
cp .env.example .env.local   # set NEXT_PUBLIC_SOLANA_RPC if you have one
npm install
npm run dev                  # http://localhost:3000
```

## Lisensi / License

MIT — built for the Dev3pack Global Hackathon 2026 (Solana × AI).

## Komponen on-chain (devnet) / On-chain component (devnet)

Program pencatat cek SolGuard di Solana **devnet** — setiap pemeriksaan bisa dicatat on-chain sebagai log permanen (level risiko + referensi tanda tangan yang dicek):

- **Program ID:** `BqWC2TQJ9NNBEF5ANqschYpnTJAcc3NwceatCPz6tugN`
- Explorer: https://explorer.solana.com/address/BqWC2TQJ9NNBEF5ANqschYpnTJAcc3NwceatCPz6tugN?cluster=devnet
- Source: `program/src/lib.rs` (native Rust, BPF upgradeable loader)
- Instruction data: byte 0 = level risiko (0 Aman, 1 Hati-hati, 2 Bahaya), bytes 1..33 = 32 byte pertama tanda tangan yang dicek. Akun pertama wajib menandatangani.
