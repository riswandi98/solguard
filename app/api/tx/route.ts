import { NextRequest, NextResponse } from "next/server";

// Server-side Solana RPC proxy: browsers get 403 from the public RPC,
// so the client calls this route and the server fetches the transaction.
const RPCS = [
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
  "https://api.mainnet-beta.solana.com",
];

export async function POST(req: NextRequest) {
  let signature = "";
  try {
    const body = await req.json();
    signature = String(body?.signature || "").trim();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,100}$/.test(signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }
  const payload = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "getTransaction",
    params: [signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
  });
  let lastStatus = 0;
  for (const rpc of [...new Set(RPCS)]) {
    try {
      const r = await fetch(rpc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
      });
      lastStatus = r.status;
      if (!r.ok) continue;
      const data = await r.json();
      return NextResponse.json(data);
    } catch {
      continue;
    }
  }
  return NextResponse.json(
    { error: `RPC unavailable (HTTP ${lastStatus || "network"})` },
    { status: 502 }
  );
}
