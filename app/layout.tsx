import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SolGuard — Bacain Transaksi Solana Sebelum Kamu Sign",
  description:
    "Tempel signature transaksi Solana, SolGuard jelaskan dengan bahasa sederhana apa yang sebenarnya terjadi: token apa yang pindah, approval apa yang dikasih, dan pola bahayanya.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
