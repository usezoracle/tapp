/**
 * Typed Rails API client. Talks to usezoracle/rails-sui.
 *
 * Auth model:
 *   - Cardholder endpoints (`/v1/cards/...`) authenticate with the
 *     user's zkLogin-derived JWT, sent as `Authorization: Bearer`.
 *   - The public token redirect (`/c/:token`) is browser-native — we
 *     don't call it from JS; the URL just opens in the address bar.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly data?: unknown;

  constructor(status: number, message: string, code?: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

interface RailsEnvelope<T> {
  status: "success" | "error";
  message: string;
  data?: T;
}

interface RequestOptions {
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
}

async function request<T>(
  method: string,
  path: string,
  { body, token, signal }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  const json = (await res.json().catch(() => ({}))) as RailsEnvelope<T>;

  if (!res.ok || json.status === "error") {
    throw new ApiError(
      res.status,
      json.message ?? `Request failed (${res.status})`,
      typeof json.data === "object" && json.data !== null && "code" in (json.data as Record<string, unknown>)
        ? String((json.data as Record<string, unknown>).code)
        : undefined,
      json.data,
    );
  }

  return json.data as T;
}

// -----------------------------------------------------------------------------
// Cards (cardholder-scope)
// -----------------------------------------------------------------------------

export interface CardClaimResponse {
  card_id: string;
  status: "claimed" | "live";
}

export const cardsApi = {
  /**
   * Claim a freshly-issued card by its activation token. PoC scope:
   * the cardholder taps a fresh card, OS opens `/c/:token`, the
   * backend redirects to `/link?token=…`, this call flips the
   * card's status `issued → claimed` and binds it to the signed-in
   * user.
   */
  claim: (token: string, jwt: string) =>
    request<CardClaimResponse>("POST", "/v1/cards/link/claim", {
      body: { token },
      token: jwt,
    }),
};
