import { useEffect, useState } from "react";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { joinWaitlist } from "@/lib/waitlist-api";

export function WaitlistForm({ compact = false }: { compact?: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [referredBy, setReferredBy] = useState<string | null>(null);

  // Pick up ?ref=CODE from the URL if someone arrived via a referral link.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) setReferredBy(ref);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Enter your full name.");
      return;
    }
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!validEmail) {
      setError("Enter a valid email address.");
      return;
    }

    setState("submitting");
    const result = await joinWaitlist({ name: name.trim(), email, referredBy });

    if (result.ok) {
      setState("done");
    } else {
      setState("error");
      setError(result.message);
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-[18px] border border-success/40 bg-[color-mix(in_oklab,var(--color-success)_10%,transparent)] p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
          <div>
            <p className="font-semibold text-foreground">Check your email, {name.trim().split(" ")[0]}.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We've sent a confirmation link to <span className="font-mono">{email}</span>. Confirm your
              email to secure your spot on the waitlist.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className={compact ? "space-y-2.5" : "space-y-3"}>
      <div className="space-y-2.5">
        <div className="flex-1">
          <label htmlFor="wl-name" className="sr-only">Full name</label>
          <input
            id="wl-name"
            type="text"
            required
            autoComplete="name"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!error}
            className="h-12 w-full rounded-[12px] border border-border bg-surface px-4 text-[15px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="wl-email" className="sr-only">Email address</label>
          <input
            id="wl-email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? "wl-email-err" : undefined}
            className="h-12 w-full rounded-[12px] border border-border bg-surface px-4 text-[15px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={state === "submitting"}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-[12px] bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-gold transition-transform hover:opacity-95 active:scale-[0.98] disabled:opacity-70"
        >
          {state === "submitting" ? "Joining…" : "Join the waitlist"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {referredBy && (
        <p className="text-xs text-muted-foreground">
          Referred by a friend — they'll get credit once you confirm your email.
        </p>
      )}

      {error && (
        <p id="wl-email-err" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        No spam. One email when ZUNO opens up. Unsubscribe anytime.
      </p>
    </form>
  );
}
