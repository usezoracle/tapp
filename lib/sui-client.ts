"use client";

/**
 * Read-side Sui client for the wallet surface. Queries balances and
 * tx history straight from a fullnode — no Rails round-trip. We
 * stick to the user's own address; merchant flows still go through
 * the Rails API.
 *
 * Coin types are env-driven so we can switch networks without
 * recompiling:
 *
 *   NEXT_PUBLIC_SUI_NETWORK       = mainnet | testnet | devnet (default testnet)
 *   NEXT_PUBLIC_USDC_COIN_TYPE    = full type tag, e.g.
 *                                   "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC"
 *                                   (Wormhole USDC on mainnet)
 *   NEXT_PUBLIC_WALLET_MOCK       = "0" to disable the mock and hit Sui
 */

import {
  SuiJsonRpcClient as SuiClient,
  getJsonRpcFullnodeUrl as getFullnodeUrl,
} from "@mysten/sui/jsonRpc";

const NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK ?? "testnet") as
  | "testnet"
  | "mainnet"
  | "devnet";

export const SUI_COIN_TYPE  = "0x2::sui::SUI";
export const USDC_COIN_TYPE =
  process.env.NEXT_PUBLIC_USDC_COIN_TYPE ??
  // Default to Wormhole USDC on mainnet — overridable per-network.
  "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";

const SUI_DECIMALS  = 9;
const USDC_DECIMALS = 6;

let _client: SuiClient | null = null;
export function suiReadClient(): SuiClient {
  if (!_client) {
    _client = new SuiClient({ network: NETWORK, url: getFullnodeUrl(NETWORK) });
  }
  return _client;
}

/** USDC balance in 10⁶ subunits — matches our internal `usdc_subunit`. */
export async function fetchUsdcSubunit(address: string): Promise<number> {
  try {
    const b = await suiReadClient().getBalance({
      owner:    address,
      coinType: USDC_COIN_TYPE,
    });
    return Number(b.totalBalance);
  } catch {
    return 0;
  }
}

/** Native SUI balance in MIST (10⁹ subunits per 1 SUI). */
export async function fetchSuiMist(address: string): Promise<number> {
  try {
    const b = await suiReadClient().getBalance({
      owner:    address,
      coinType: SUI_COIN_TYPE,
    });
    return Number(b.totalBalance);
  } catch {
    return 0;
  }
}

export interface OnchainTx {
  digest:      string;
  timestampMs: number;
  /**
   * Signed amount in our internal "subunit" for the coin type we care
   * about (USDC subunits for USDC, MIST for SUI). Positive = inflow
   * to the queried address, negative = outflow.
   */
  amountUsdc:  number | null;
  amountSui:   number | null;
  /** First non-self counterparty address if we can identify one. */
  counterparty: string | null;
}

/**
 * Recent activity touching the address. We query both directions
 * (FromAddress + ToAddress), dedupe by digest, and project each tx
 * down to the user-facing fields we render.
 *
 * For now we only surface USDC and SUI movements — other coin types
 * are ignored (they show up as zero-amount entries client-side which
 * we filter out below).
 */
export async function fetchOnchainActivity(
  address: string,
  limit = 25,
): Promise<OnchainTx[]> {
  const client = suiReadClient();
  const opts = {
    showBalanceChanges: true,
    showInput:          true,
    showEffects:        false,
    showEvents:         false,
  } as const;

  const [outgoing, incoming] = await Promise.all([
    client
      .queryTransactionBlocks({
        filter: { FromAddress: address },
        options: opts,
        limit,
        order: "descending",
      })
      .catch(() => ({ data: [] as unknown[] })),
    client
      .queryTransactionBlocks({
        filter: { ToAddress: address },
        options: opts,
        limit,
        order: "descending",
      })
      .catch(() => ({ data: [] as unknown[] })),
  ]);

  type BalanceChange = {
    owner: { AddressOwner?: string } | string;
    coinType: string;
    amount: string;
  };
  type Block = {
    digest: string;
    timestampMs?: string | number | null;
    balanceChanges?: BalanceChange[];
  };

  const merged = [...(outgoing.data as Block[]), ...(incoming.data as Block[])];
  const seen = new Set<string>();
  const unique = merged.filter((tx) => {
    if (seen.has(tx.digest)) return false;
    seen.add(tx.digest);
    return true;
  });

  unique.sort(
    (a, b) =>
      Number(b.timestampMs ?? 0) - Number(a.timestampMs ?? 0),
  );

  const ownerOf = (o: BalanceChange["owner"]): string | null => {
    if (typeof o === "string") return o;
    return o?.AddressOwner ?? null;
  };

  return unique.slice(0, limit).map((tx) => {
    const changes = tx.balanceChanges ?? [];
    let amountUsdc: number | null = null;
    let amountSui: number | null = null;
    let counterparty: string | null = null;

    for (const c of changes) {
      const owner = ownerOf(c.owner);
      const amt = Number(c.amount);
      if (owner === address) {
        if (c.coinType === USDC_COIN_TYPE) amountUsdc = amt;
        else if (c.coinType === SUI_COIN_TYPE) amountSui = amt;
      } else if (!counterparty && owner) {
        counterparty = owner;
      }
    }

    return {
      digest:       tx.digest,
      timestampMs:  Number(tx.timestampMs ?? 0),
      amountUsdc,
      amountSui,
      counterparty,
    };
  });
}

/** Convert USDC subunit → display USDC float. */
export function usdcFromSubunit(subunit: number): number {
  return subunit / 10 ** USDC_DECIMALS;
}

/** Convert SUI MIST → display SUI float. */
export function suiFromMist(mist: number): number {
  return mist / 10 ** SUI_DECIMALS;
}
