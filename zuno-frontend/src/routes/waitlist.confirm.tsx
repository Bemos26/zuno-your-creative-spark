import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Copy, Check, Shield, XCircle } from "lucide-react";
import { getReferralStats, referralUrl } from "@/lib/waitlist-api";

export const Route = createFileRoute("/waitlist/confirm")({
  head: () => ({
    meta: [
      { title: "You're on the list — ZUNO Escrow" },
      { name: "description", content: "Your ZUNO waitlist spot is confirmed." },
    ],
  }),
  component: ConfirmPage,
});

type LoadState =
  | { status: "loading" }
  | { status: "missing-params" }
  | { status: "not-verified" }
  | { status: "error"; message: string }
  | {
      status: "success";
      name: string;
      referralCode: string;
      points: number;
      totalReferrals: number;
    };

function ConfirmPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verified = params.get("verified");
    const code = params.get("code");
    const name = params.get("name");

    if (verified === null || !code) {
      setState({ status: "missing-params" });
      return;
    }

    if (verified !== "1") {
      setState({ status: "not-verified" });
      return;
    }

    getReferralStats(code).then((result) => {
      if (result.ok) {
        setState({
          status: "success",
          name: name ?? "there",
          referralCode: result.stats.referral_code,
          points: result.stats.points,
          totalReferrals: result.stats.total_referrals,
        });
      } else {
        setState({ status: "error", message: result.message });
      }
    });
  }, []);

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail silently on some mobile browsers — no-op.
    }
  }

  return (
    <section className="pt-32 pb-24 lg:pt-40">
      <div className="mx-auto max-w-[640px] px-6 text-center lg:px-8">
        <p className="eyebrow">Waitlist</p>

        {state.status === "loading" && (
          <>
            <h1 className="text-display-lg mt-4">Confirming your spot…</h1>
            <p className="mt-5 text-body-lg text-muted-foreground">One moment.</p>
          </>
        )}

        {state.status === "missing-params" && (
          <>
            <h1 className="text-display-lg mt-4">This link looks incomplete.</h1>
            <p className="mt-5 text-body-lg text-muted-foreground">
              Please use the confirmation link from the email we sent you.
            </p>
          </>
        )}

        {state.status === "not-verified" && (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <h1 className="text-display-lg mt-4">We couldn't verify that link.</h1>
            <p className="mt-5 text-body-lg text-muted-foreground">
              It may be expired or already used. Try joining the waitlist again to get a fresh link.
            </p>
          </>
        )}

        {state.status === "error" && (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <h1 className="text-display-lg mt-4">
              We couldn't load your referral stats.
            </h1>
            <p className="mt-5 text-body-lg text-muted-foreground">{state.message}</p>
          </>
        )}

        {state.status === "success" && (
          <>
            <h1 className="text-display-lg mt-4">
              You're <span className="text-primary">on the list.</span>
            </h1>
            <p className="mt-5 text-body-lg text-muted-foreground">
              Your spot is confirmed, {state.name.split(" ")[0]}. We'll email you the moment ZUNO opens up — no action
              needed until then.
            </p>

            <div className="mt-10 rounded-[22px] border border-border bg-surface p-7 text-left shadow-elevated">
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">First three transactions, free</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your welcome offer is already attached to your account — it activates as soon
                    as you make your first trade.
                  </p>
                </div>
              </div>
              <div className="my-5 border-t border-border/60" />
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">We'll notify you when access opens</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    No need to keep checking — you'll get an email the moment your account is
                    ready to use.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-[22px] border border-border bg-surface p-7 text-left shadow-elevated">
              <p className="font-semibold text-foreground">Your referral link</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Share it with people you trust. Once they join the waitlist and verify, you earn
                points toward free transactions.
              </p>

              <div className="mt-4 flex items-center gap-2 rounded-[12px] border border-border bg-background px-4 py-3">
                <span className="flex-1 truncate font-mono text-sm text-foreground">
                  {referralUrl(state.referralCode)}
                </span>
                <button
                  type="button"
                  onClick={() => copyLink(referralUrl(state.referralCode))}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] bg-primary px-3 text-xs font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </>
                  )}
                </button>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-[12px] bg-muted p-3">
                  <p className="text-xl font-semibold text-foreground">{state.totalReferrals}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Referrals</p>
                </div>
                <div className="rounded-[12px] bg-muted p-3">
                  <p className="text-xl font-semibold text-foreground">{state.points}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Points</p>
                </div>
              </div>
            </div>

            <p className="mt-8 text-sm text-muted-foreground">
              Every ZUNO deal ships <span className="font-semibold text-foreground">protected in escrow</span>{" "}
              — that same protection covers you from your very first transaction.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
