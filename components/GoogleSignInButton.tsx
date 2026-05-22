"use client";

import { GoogleLogin } from "@react-oauth/google";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { IconGoogle } from "@/lib/icons";
import { signInWithGoogleCredential, type Session } from "@/lib/auth";

interface Props {
  onSuccess: (session: Session) => void;
  /**
   * Label for the visible button. The real Google button renders
   * underneath as a transparent overlay (Google's branding rules
   * require their own widget for the click); we just style the
   * surrounding shell to match the rest of the app.
   */
  label?: string;
}

/**
 * Google Sign-In CTA. Renders our brand pill on top + Google's own
 * widget invisibly below (Google requires their official widget for
 * the click; we can't ship a plain button per their terms).
 */
export function GoogleSignInButton({
  onSuccess,
  label = "Continue with Google",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="w-full space-y-3">
      <div className="relative w-full">
        <Button
          variant="secondary"
          loading={loading}
          leadingIcon={<Icon xml={IconGoogle} size={20} />}
          // The actual Google widget sits on top — this button is
          // visual-only and pointer-events:none. We keep it in the
          // tree so the layout matches the rest of the PIN-pad / CTA
          // surfaces in the app.
          className="pointer-events-none"
        >
          {label}
        </Button>
        <div className="absolute inset-0 opacity-0">
          <GoogleLogin
            useOneTap={false}
            onSuccess={async (cred) => {
              if (!cred.credential) {
                setError("Google didn't return a credential");
                return;
              }
              setError(null);
              setLoading(true);
              try {
                const session = await signInWithGoogleCredential(cred.credential);
                onSuccess(session);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Sign-in failed");
              } finally {
                setLoading(false);
              }
            }}
            onError={() => setError("Google sign-in was cancelled")}
            width="100%"
            theme="filled_black"
          />
        </div>
      </div>
      {error ? (
        <p className="text-sm text-danger text-center" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
