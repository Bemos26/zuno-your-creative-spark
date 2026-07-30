import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Zuno — Your Workspace" },
      {
        name: "description",
        content: "Zuno is a clean, focused workspace built to grow one step at a time.",
      },
      { property: "og:title", content: "Zuno — Your Workspace" },
      {
        property: "og:description",
        content: "Zuno is a clean, focused workspace built to grow one step at a time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <AppShell>
      <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 p-12 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Zuno</h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          A clean starting layout. Tell me what to add next and this space fills in.
        </p>
      </div>
    </AppShell>
  );
}
