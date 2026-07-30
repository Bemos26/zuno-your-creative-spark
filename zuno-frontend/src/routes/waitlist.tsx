import { createFileRoute } from "@tanstack/react-router";
import { WaitlistForm } from "@/components/site/WaitlistForm";
import { ReferralTiers } from "@/components/site/ReferralTiers";

export const Route = createFileRoute("/waitlist")({
  head: () => ({
    meta: [
      { title: "Join the ZUNO waitlist" },
      {
        name: "description",
        content:
          "ZUNO opens in phases across regions. Join the waitlist to get access when we open in your area.",
      },
      { property: "og:title", content: "Join the ZUNO waitlist" },
      { property: "og:description", content: "Get access when ZUNO opens in your area." },
    ],
  }),
  component: WaitlistPage,
});

function WaitlistPage() {
  return (
    <>
      <section className="pt-32 pb-24 lg:pt-40">
        <div className="mx-auto grid max-w-[1100px] items-start gap-14 px-6 lg:grid-cols-[1.2fr_1fr] lg:gap-16 lg:px-8">
          <div>
            <p className="eyebrow">Waitlist</p>
            <h1 className="text-display-lg mt-4 max-w-[18ch]">
              Get access when ZUNO opens up in your area.
            </h1>
            <p className="mt-5 max-w-xl text-body-lg text-muted-foreground">
              ZUNO onboards in small batches so we can support every user personally. Drop your
              name and email and we'll be in touch when access opens.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
              <li>· One email when access opens. No newsletter loop.</li>
              <li>· First 500 waitlist members pay no ZUNO fee on their first three deals.</li>
              <li>· Feedback from waitlist users is read by the founder directly.</li>
            </ul>
          </div>
          <div className="rounded-[22px] border border-border bg-surface p-8 shadow-elevated">
            <WaitlistForm />
          </div>
        </div>
      </section>

      <ReferralTiers />
    </>
  );
}
