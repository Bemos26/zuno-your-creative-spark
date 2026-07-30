import { Shield, ShieldCheck, ShieldPlus, CheckCircle2 } from "lucide-react";
import { Reveal } from "@/components/site/Reveal";

type Tier = {
  name: string;
  points: number;
  referrals: number;
  freeTransactions: number;
  icon: typeof Shield;
  blurb: string;
};

const TIERS: Tier[] = [
  {
    name: "Trusted",
    points: 500,
    referrals: 5,
    freeTransactions: 2,
    icon: Shield,
    blurb: "Your first milestone — a handful of friends who actually verify.",
  },
  {
    name: "Verified",
    points: 1500,
    referrals: 15,
    freeTransactions: 4,
    icon: ShieldCheck,
    blurb: "A real network vouching for ZUNO. Free fees stack up fast here.",
  },
  {
    name: "Guardian",
    points: 3500,
    referrals: 35,
    freeTransactions: 6,
    icon: ShieldPlus,
    blurb: "Top of the program — early access perks and the most free deals.",
  },
];

export function ReferralTiers() {
  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        <Reveal>
          <p className="eyebrow">Referral program</p>
          <h2 className="text-heading-lg mt-4 max-w-[22ch]">
            Bring people you trust. Earn free transactions.
          </h2>
          <p className="mt-5 max-w-2xl text-body-lg text-muted-foreground">
            Points are only awarded once a referred person joins the waitlist{" "}
            <span className="font-semibold text-foreground">and verifies</span> their email or
            phone — <span className="font-semibold text-foreground">100 points per verified
            referral</span>. Climb through three tiers as your network grows.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {TIERS.map((tier, i) => (
            <Reveal key={tier.name} delay={i * 80}>
              <div className="flex h-full flex-col rounded-[22px] border border-border gradient-card p-7 shadow-elevated">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-primary)_14%,transparent)]">
                    <tier.icon className="h-5 w-5 text-[color:var(--gold-text)]" />
                  </span>
                  <h3 className="text-xl font-semibold text-foreground">{tier.name}</h3>
                </div>

                <p className="mt-4 font-mono text-3xl font-semibold text-foreground">
                  {tier.points.toLocaleString("en-US")}
                  <span className="ml-2 text-sm font-sans font-normal text-muted-foreground">
                    points
                  </span>
                </p>

                <ul className="mt-5 space-y-2.5 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>
                      <span className="font-semibold text-foreground">{tier.referrals}</span>{" "}
                      verified referrals
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>
                      <span className="font-semibold text-foreground">
                        {tier.freeTransactions}
                      </span>{" "}
                      free transactions
                    </span>
                  </li>
                </ul>

                <p className="mt-5 border-t border-border/60 pt-4 text-xs text-muted-foreground">
                  {tier.blurb}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          Free transactions waive ZUNO's per-deal fee up to the standard fee minimum. Referral
          points and tier status are tracked automatically once your account is verified.
        </p>
      </div>
    </section>
  );
}
