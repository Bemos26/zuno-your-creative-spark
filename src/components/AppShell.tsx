import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
              Z
            </span>
            <span className="text-base font-semibold tracking-tight">Zuno</span>
          </Link>
          <nav className="text-sm text-muted-foreground">Workspace</nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">{children}</main>

      <footer className="border-t border-border/60">
        <div className="mx-auto w-full max-w-5xl px-6 py-6 text-xs text-muted-foreground">
          Zuno
        </div>
      </footer>
    </div>
  );
}
