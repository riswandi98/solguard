// SolGuard — decode a Solana transaction into plain-language facts.
// Read-only: one getTransaction call (jsonParsed) to the RPC in
// NEXT_PUBLIC_SOLANA_RPC. No keys, no signing, nothing leaves the browser
// except the signature itself.

export interface SolChange {
  account: string;
  delta: number; // in SOL
  pre: number; // SOL before
  post: number; // SOL after
}

export interface TokenChange {
  mint: string;
  owner: string;
  delta: number; // in UI units
  decimals: number;
  pre: number; // UI amount before
  post: number; // UI amount after
}

export interface AuthorityEvent {
  kind: string; // e.g. "approve", "setAuthority", "initializeAccount"
  program: string;
  detail: string;
}

export interface DecodedTx {
  signature: string;
  slot: number;
  blockTime: number | null;
  failed: boolean;
  error: string | null;
  feePayer: string;
  feeSol: number;
  solChanges: SolChange[];
  tokenChanges: TokenChange[];
  programs: string[];
  authorityEvents: AuthorityEvent[];
}

const RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.mainnet-beta.solana.com";

const KNOWN_PROGRAMS: Record<string, string> = {
  "11111111111111111111111111111111": "System Program",
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: "SPL Token",
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: "SPL Token-2022",
  ATokenvbdvufh64LMZ7A72jSfFFwDkSGEKfKGLzpjFfB: "Associated Token Account",
  MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr: "Memo",
  ComputeBudget111111111111111111111111111111: "Compute Budget",
};

export function programName(id: string): string {
  return KNOWN_PROGRAMS[id] ? `${KNOWN_PROGRAMS[id]}` : id;
}

const AUTHORITY_TYPES = new Set([
  "approve",
  "approveChecked",
  "setAuthority",
  "revoke",
  "burnChecked",
  "mintTo",
  "mintToChecked",
  "closeAccount",
]);

async function rpcCall(method: string, params: unknown[]): Promise<any> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "RPC error");
  return json.result;
}

export async function decodeSignature(signature: string): Promise<DecodedTx> {
  const tx = await rpcCall("getTransaction", [
    signature.trim(),
    {
      encoding: "jsonParsed",
      commitment: "finalized",
      maxSupportedTransactionVersion: 0,
    },
  ]);
  if (!tx) throw new Error("not-found");

  const meta = tx.meta || {};
  const msg = tx.transaction?.message || {};
  const accountKeys: string[] = (msg.accountKeys || []).map((k: any) =>
    typeof k === "string" ? k : k.pubkey
  );

  // SOL balance changes
  const solChanges: SolChange[] = [];
  const pre: number[] = meta.preBalances || [];
  const post: number[] = meta.postBalances || [];
  for (let i = 0; i < Math.min(pre.length, post.length); i++) {
    const delta = (post[i] - pre[i]) / 1e9;
    if (delta !== 0 && accountKeys[i]) {
      solChanges.push({
        account: accountKeys[i],
        delta,
        pre: pre[i] / 1e9,
        post: post[i] / 1e9,
      });
    }
  }

  // Token balance changes, keyed by account index
  const byIndex = new Map<number, { pre: any; post: any }>();
  for (const b of meta.preTokenBalances || []) {
    byIndex.set(b.accountIndex, { pre: b, post: undefined });
  }
  for (const b of meta.postTokenBalances || []) {
    const cur = byIndex.get(b.accountIndex) || { pre: undefined, post: undefined };
    cur.post = b;
    byIndex.set(b.accountIndex, cur);
  }
  const tokenChanges: TokenChange[] = [];
  for (const { pre: p, post: q } of byIndex.values()) {
    const ref = q || p;
    const preAmt = p ? Number(p.uiTokenAmount?.uiAmount || 0) : 0;
    const postAmt = q ? Number(q.uiTokenAmount?.uiAmount || 0) : 0;
    const delta = postAmt - preAmt;
    if (delta !== 0 && ref) {
      tokenChanges.push({
        mint: ref.mint,
        owner: ref.owner || "",
        delta,
        decimals: ref.uiTokenAmount?.decimals ?? 0,
        pre: preAmt,
        post: postAmt,
      });
    }
  }

  // Programs called + authority-relevant instructions (incl. inner instructions)
  const programs = new Set<string>();
  const authorityEvents: AuthorityEvent[] = [];
  const scan = (ix: any) => {
    const pid = ix?.programId;
    if (pid) programs.add(pid);
    const parsed = ix?.parsed;
    if (parsed && typeof parsed === "object" && AUTHORITY_TYPES.has(parsed.type)) {
      const info = parsed.info || {};
      const bits: string[] = [];
      if (info.amount) bits.push(`amount: ${info.amount}`);
      if (info.delegate) bits.push(`delegate: ${info.delegate}`);
      if (info.newAuthority) bits.push(`newAuthority: ${info.newAuthority}`);
      if (info.authorityType) bits.push(`type: ${info.authorityType}`);
      authorityEvents.push({
        kind: parsed.type,
        program: programName(pid || ix?.program || ""),
        detail: bits.join(" · "),
      });
    }
  };
  for (const ix of msg.instructions || []) scan(ix);
  for (const inner of meta.innerInstructions || []) {
    for (const ix of inner.instructions || []) scan(ix);
  }

  return {
    signature: signature.trim(),
    slot: tx.slot,
    blockTime: tx.blockTime ?? null,
    failed: !!meta.err,
    error: meta.err ? JSON.stringify(meta.err) : null,
    feePayer: accountKeys[0] || "",
    feeSol: (meta.fee || 0) / 1e9,
    solChanges,
    tokenChanges,
    programs: Array.from(programs),
    authorityEvents,
  };
}
