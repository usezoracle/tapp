import { decodeJwt } from "jose";
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = body.token;
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const saltServiceUrl =
      process.env.ZKLOGIN_SALT_URL ?? "https://salt.api.mystenlabs.com/get_salt";

    try {
      const response = await fetch(saltServiceUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }

      console.warn(
        `Upstream salt service returned status ${response.status}. Falling back to local deterministic devSalt derivation.`,
      );
    } catch (fetchErr) {
      console.warn(
        "Upstream salt service connection failed. Falling back to local deterministic devSalt derivation.",
        fetchErr,
      );
    }

    // Fallback: Generate a deterministic 128-bit salt matching devSalt(sub) in lib/auth.tsx.
    // This ensures the derived zkLogin address is identical to the user's legacy address,
    // preserving their existing balance and transaction history.
    const claims = decodeJwt(token);
    const sub = claims.sub;
    if (!sub) {
      return NextResponse.json(
        {
          error:
            "Token does not contain a 'sub' claim required for salt derivation",
        },
        { status: 400 },
      );
    }

    // Implement exactly: sha256("tapp.dev.salt.v1:" + sub) and shift first 16 bytes into BigInt
    const hash = crypto
      .createHash("sha256")
      .update("tapp.dev.salt.v1:" + sub)
      .digest();

    let n = BigInt(0);
    for (let i = 0; i < 16; i++) {
      n = (n << BigInt(8)) | BigInt(hash[i]);
    }
    const saltDecimal = n.toString();

    return NextResponse.json({ salt: saltDecimal });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
