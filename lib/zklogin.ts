// zkLogin scaffolding for the Tapp PWA.
//
// The cardholder signs Sui PTBs (create_cap, top_up, set_revoked)
// without ever holding a private key — Google is the credential,
// zkLogin proves "the Google JWT for this account corresponds to a
// Sui address derived from the JWT + a user-scoped salt".
//
// Mysten's reference pipeline:
//   1. Generate an ephemeral Ed25519 keypair, persist in IndexedDB
//   2. Compute zkLogin `nonce` = poseidon(extPubkey, max_epoch, randomness)
//   3. Drive Google OAuth with `nonce` in the OIDC nonce param
//   4. On callback: parse JWT, fetch a salt for this `sub` from a
//      salt service (Mysten provides one for testnet/devnet)
//   5. Derive Sui address = jwtToAddress(jwt, salt)
//   6. For each PTB: call a prover service to produce a zkLogin proof
//      bound to (ephemeral pubkey, max_epoch, JWT, salt). Sign with
//      the ephemeral key, attach the proof as `getZkLoginSignature(...)`
//
// This file implements steps 1-5 + the PTB-build half of step 6.
// The prover call lives behind `proveZkLogin()` — it hits Mysten's
// hosted testnet prover when `NEXT_PUBLIC_SUI_NETWORK=testnet`, and
// returns a placeholder error otherwise so the caller surfaces a
// clear "prover not configured" message instead of a silent failure.

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  SuiJsonRpcClient as SuiClient,
  getJsonRpcFullnodeUrl as getFullnodeUrl,
} from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import {
  generateNonce,
  generateRandomness,
  getExtendedEphemeralPublicKey,
  jwtToAddress,
  getZkLoginSignature,
  genAddressSeed,
  type ZkLoginSignatureInputs,
} from "@mysten/sui/zklogin";
import { decodeJwt } from "jose";

const STORAGE_KEY = "tapp.zklogin.v1";
const SALT_SERVICE_URL =
  process.env.NEXT_PUBLIC_ZKLOGIN_SALT_URL ??
  "/api/salt";
const PROVER_URL =
  process.env.NEXT_PUBLIC_ZKLOGIN_PROVER_URL ??
  "https://prover-dev.mystenlabs.com/v1";
const NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK ?? "testnet") as
  | "testnet"
  | "mainnet"
  | "devnet";

export interface ZkLoginSession {
  ephemeralPrivateKey: string; // base64
  ephemeralPublicKey: string;  // base64
  extendedPubKey: string;
  randomness: string;
  maxEpoch: number;
  nonce: string;
  /** Set once the Google JWT comes back. */
  jwt?: string;
  /** Server-fetched user salt for this `sub`. */
  salt?: string;
  /** Derived Sui address. */
  suiAddress?: string;
}

export function suiClient(): SuiClient {
  // SuiJsonRpcClient (v2) needs both `network` and `url` — network
  // for type-system bookkeeping, url for the actual endpoint.
  return new SuiClient({ network: NETWORK, url: getFullnodeUrl(NETWORK) });
}

// -----------------------------------------------------------------------------
// Session bootstrap (call before redirecting to Google OAuth)
// -----------------------------------------------------------------------------

/**
 * Initialize a fresh zkLogin session: ephemeral keypair, randomness,
 * max_epoch, nonce. Persist in localStorage so the OAuth callback can
 * pick the session back up.
 */
export async function startZkLoginSession(): Promise<ZkLoginSession> {
  const client = suiClient();
  const { epoch } = await client.getLatestSuiSystemState();
  const maxEpoch = Number(epoch) + 2; // 2-epoch validity (~24h)

  const kp = new Ed25519Keypair();
  const randomness = generateRandomness();
  const extPubKey = getExtendedEphemeralPublicKey(kp.getPublicKey());
  const nonce = generateNonce(kp.getPublicKey(), maxEpoch, randomness);

  const session: ZkLoginSession = {
    ephemeralPrivateKey: kp.getSecretKey(),
    ephemeralPublicKey: bytesToB64(kp.getPublicKey().toRawBytes()),
    extendedPubKey: extPubKey,
    randomness,
    maxEpoch,
    nonce,
  };
  persistSession(session);
  return session;
}

/**
 * Complete the session given the JWT Google handed back. Fetches the
 * user's salt and derives their Sui address. Idempotent — calling
 * with the same JWT twice returns the same session.
 */
export async function completeZkLoginSession(jwt: string): Promise<ZkLoginSession> {
  const session = readSession();
  if (!session) throw new Error("No zkLogin session in progress");

  // Verify Google bound our nonce to this JWT — defends against the
  // PWA being handed a JWT from a different OAuth round.
  const claims = decodeJwt(jwt);
  if (claims.nonce !== session.nonce) {
    throw new Error("zkLogin nonce mismatch — restart sign-in");
  }

  const salt = await fetchSalt(jwt);
  // legacyAddress=false → use the new (post-mainnet) zkLogin address
  // derivation. Same default as `@mysten/zklogin`'s docs.
  const suiAddress = jwtToAddress(jwt, salt, false);

  const updated: ZkLoginSession = { ...session, jwt, salt, suiAddress };
  persistSession(updated);
  return updated;
}

// -----------------------------------------------------------------------------
// PTB execution
// -----------------------------------------------------------------------------

/**
 * Build, sign with zkLogin, and submit a Sui transaction.
 *
 * `buildTx` populates a `Transaction` (the caller's MoveCall, etc.).
 * We add gas + signer + submit; the zkLogin proof comes from
 * `proveZkLogin()`.
 */
export async function executeZkLoginTx(
  buildTx: (tx: Transaction) => void | Promise<void>,
): Promise<{ digest: string; effects?: unknown }> {
  const session = readSession();
  if (!session?.jwt || !session.salt || !session.suiAddress) {
    throw new Error("zkLogin session not ready");
  }

  const tx = new Transaction();
  tx.setSender(session.suiAddress);
  await buildTx(tx);

  const client = suiClient();
  const ephemeralKp = restoreKeypair(session);

  // Build the transaction kind first.
  const kindBytes = await tx.build({ client, onlyTransactionKind: true });
  const kindB64 = Buffer.from(kindBytes).toString("base64");

  // Get Rails JWT token for authentication of backend endpoint.
  let railsToken = "";
  if (typeof window !== "undefined") {
    try {
      const rawRails = window.localStorage.getItem("tapp.session.v1");
      if (rawRails) {
        const parsedRails = JSON.parse(rawRails);
        if (parsedRails && parsedRails.jwt) {
          railsToken = parsedRails.jwt;
        }
      }
    } catch (e) {
      console.warn("Failed to read Rails session from localStorage", e);
    }
  }

  // Call the gas-station sponsor endpoint.
  const sponsorRes = await fetch("/api/gas-station/sponsor", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${railsToken || session.jwt}`,
    },
    body: JSON.stringify({ txBytes: kindB64, sender: session.suiAddress }),
  });
  if (!sponsorRes.ok) {
    const errorText = await sponsorRes.text();
    throw new Error(`Gas sponsorship failed: ${errorText}`);
  }
  const { sponsoredTxBytes, sponsorSignature } = (await sponsorRes.json()) as {
    sponsoredTxBytes: string;
    sponsorSignature: string;
  };

  const finalTxBytesBytes = Uint8Array.from(Buffer.from(sponsoredTxBytes, "base64"));
  const { signature: ephemeralSig } = await ephemeralKp.signTransaction(finalTxBytesBytes);

  const proofInputs = await proveZkLogin({
    jwt: session.jwt,
    extendedEphemeralPublicKey: session.extendedPubKey,
    maxEpoch: session.maxEpoch,
    jwtRandomness: session.randomness,
    salt: session.salt,
    keyClaimName: "sub",
  });

  const claims = decodeJwt(session.jwt);
  if (!claims.sub || !claims.aud) {
    throw new Error("Invalid JWT in session: missing sub or aud claim");
  }
  const aud = Array.isArray(claims.aud) ? claims.aud[0] : claims.aud;
  const addressSeed = genAddressSeed(
    BigInt(session.salt),
    "sub",
    claims.sub,
    aud,
  ).toString();

  const zkLoginSignature = getZkLoginSignature({
    inputs: {
      ...proofInputs,
      addressSeed,
    },
    maxEpoch: session.maxEpoch,
    userSignature: ephemeralSig,
  });

  const result = await client.executeTransactionBlock({
    transactionBlock: finalTxBytesBytes,
    signature: [zkLoginSignature, sponsorSignature],
    options: { showEffects: true },
  });
  return { digest: result.digest, effects: result.effects };
}

// -----------------------------------------------------------------------------
// Prover (Mysten testnet hosted, or self-hosted via env)
// -----------------------------------------------------------------------------

interface ProverRequest {
  jwt: string;
  extendedEphemeralPublicKey: string;
  maxEpoch: number;
  jwtRandomness: string;
  salt: string;
  keyClaimName: string;
}

async function proveZkLogin(req: ProverRequest): Promise<ZkLoginSignatureInputs> {
  const res = await fetch(PROVER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    throw new Error(
      `zkLogin prover failed (${res.status}). Check NEXT_PUBLIC_ZKLOGIN_PROVER_URL — ` +
        `Mysten's testnet prover is rate-limited; self-host for production.`,
    );
  }
  return (await res.json()) as ZkLoginSignatureInputs;
}

// -----------------------------------------------------------------------------
// Salt service
// -----------------------------------------------------------------------------

async function fetchSalt(jwt: string): Promise<string> {
  const res = await fetch(SALT_SERVICE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: jwt }),
  });
  if (!res.ok) {
    throw new Error(
      `zkLogin salt service failed (${res.status}). For production, run a self-hosted ` +
        `salt service per Mysten's reference at github.com/MystenLabs/zklogin-prover.`,
    );
  }
  const { salt } = (await res.json()) as { salt: string };
  return salt;
}

// -----------------------------------------------------------------------------
// Storage helpers (browser-only — no SSR access)
// -----------------------------------------------------------------------------

function persistSession(s: ZkLoginSession): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function readSession(): ZkLoginSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as ZkLoginSession) : null;
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

function restoreKeypair(s: ZkLoginSession): Ed25519Keypair {
  const keyStr = s.ephemeralPrivateKey;

  // Current format: bech32 "suiprivkey1…" (~71 chars) — pass straight through.
  if (keyStr.startsWith("suiprivkey")) {
    return Ed25519Keypair.fromSecretKey(keyStr);
  }

  // Legacy formats stored as base64.
  let decoded: Uint8Array;
  try {
    decoded = b64ToBytes(keyStr);
  } catch {
    throw new Error(
      "Ephemeral key is corrupt — sign out and back in to create a fresh zkLogin session.",
    );
  }

  // Legacy format A: the base64 payload is the UTF-8 bytes of a bech32 string
  // (old code did `btoa(String.fromCharCode(...bech32Bytes))`).
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(decoded);
    if (text.startsWith("suiprivkey")) {
      return Ed25519Keypair.fromSecretKey(text);
    }
  } catch {
    // Not valid UTF-8 — fall through to raw-byte handling.
  }

  // Legacy format B: raw 32-byte Ed25519 seed.
  if (decoded.length === 32) {
    return Ed25519Keypair.fromSecretKey(decoded);
  }

  // Legacy format C: raw 64-byte "full" keypair (seed + pubkey).
  if (decoded.length === 64) {
    return Ed25519Keypair.fromSecretKey(decoded.slice(0, 32));
  }

  // Anything else is unrecoverable.
  throw new Error(
    "Ephemeral key format is unrecognised — sign out and back in to create a fresh zkLogin session.",
  );
}

function bytesToB64(b: Uint8Array): string {
  return typeof btoa !== "undefined" ? btoa(String.fromCharCode(...b)) : Buffer.from(b).toString("base64");
}
function b64ToBytes(s: string): Uint8Array {
  if (typeof atob !== "undefined") {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return Uint8Array.from(Buffer.from(s, "base64"));
}
