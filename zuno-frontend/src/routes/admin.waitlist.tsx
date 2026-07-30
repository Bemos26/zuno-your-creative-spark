import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Users,
  UserCheck,
  Trophy,
  Gift,
  Search,
  Download,
  ShieldAlert,
  Pencil,
  Lock,
  Eye,
  History,
  BadgeCheck,
  ArrowRight,
} from "lucide-react";
import {
  adminLogin,
  adminLogout,
  getAdminWaitlist,
  setAdminPoints,
  setAdminVerified,
  setAdminFlagged,
  type AdminWaitlistEntry,
} from "@/lib/waitlist-api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/waitlist")({
  head: () => ({
    meta: [
      { title: "Waitlist Admin — ZUNO" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminWaitlistPage,
});

// ---------------------------------------------------------------------------
// DATA MODEL
//
// WaitlistEntry below is this page's internal shape (camelCase, UI-friendly).
// The backend returns AdminWaitlistEntry (snake_case — see waitlist-api.ts).
// toEntry() maps one to the other so the rest of this file — table columns,
// tier logic, dialogs — doesn't need to know about the wire format.
// ---------------------------------------------------------------------------

type Tier = "None" | "Trusted" | "Verified" | "Guardian";

type WaitlistEntry = {
  id: string;
  name: string;
  email: string;
  verified: boolean;
  referralCode: string;
  referredBy: string | null;
  referralCount: number;
  points: number;
  joinedAt: string;
  flagged: boolean;
};

function toEntry(a: AdminWaitlistEntry): WaitlistEntry {
  return {
    id: a.id,
    name: a.full_name,
    email: a.email,
    verified: a.is_verified,
    referralCode: a.referral_code,
    referredBy: a.referred_by_code,
    referralCount: a.referral_count,
    points: a.points,
    joinedAt: a.created_at.slice(0, 10),
    flagged: a.flagged,
  };
}

type AuditEntry = {
  id: string;
  entryId: string;
  entryName: string;
  action: string;
  detail: string;
  actor: string;
  at: string;
};

const TIER_RULES: { tier: Tier; points: number; freeTransactions: number }[] = [
  { tier: "Guardian", points: 3500, freeTransactions: 6 },
  { tier: "Verified", points: 1500, freeTransactions: 4 },
  { tier: "Trusted", points: 500, freeTransactions: 2 },
];

function tierFor(points: number): Tier {
  for (const rule of TIER_RULES) {
    if (points >= rule.points) return rule.tier;
  }
  return "None";
}

function tierBadgeVariant(tier: Tier): "default" | "secondary" | "outline" {
  if (tier === "Guardian") return "default";
  if (tier === "Verified") return "secondary";
  return "outline";
}

// Real entries now come from GET /api/v1/admin/waitlist — see loadEntries()
// in AdminDashboard below.
//
// Auth: this form posts to /api/admin/login (src/routes/api.admin.login.ts),
// a server route that checks ADMIN_DASHBOARD_PASSWORD (a server-only env
// var) and, on success, sets an HttpOnly session cookie. From then on every
// admin data call (see waitlist-api.ts) rides that cookie — the real
// backend admin key never reaches this page or the browser. If a session
// expires, AdminDashboard below drops back to this screen on a 401.

function AdminWaitlistPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!unlocked) {
    return (
      <section className="flex min-h-[70vh] items-center justify-center px-6 py-24">
        <Card className="w-full max-w-sm p-8 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-primary)_14%,transparent)]">
            <Lock className="h-5 w-5 text-[color:var(--gold-text)]" />
          </div>
          <h1 className="mt-4 text-lg font-semibold">Admin access</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Internal tool. Not linked from the site.
          </p>
          <form
            className="mt-6 space-y-3 text-left"
            onSubmit={async (e) => {
              e.preventDefault();
              setSubmitting(true);
              setError(null);
              const result = await adminLogin(password);
              setSubmitting(false);
              if (result.ok) {
                setUnlocked(true);
                setPassword("");
              } else {
                setError(result.message);
              }
            }}
          >
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Checking…" : "Unlock"}
            </Button>
          </form>
        </Card>
      </section>
    );
  }

  return <AdminDashboard onSessionExpired={() => setUnlocked(false)} />;
}

function AdminDashboard({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<Tier | "All">("All");
  const [editing, setEditing] = useState<WaitlistEntry | null>(null);
  const [pointsDraft, setPointsDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [viewing, setViewing] = useState<WaitlistEntry | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Placeholder actor — once real admin auth exists, replace with the logged-in
  // admin's name/email instead of a static string.
  const ACTOR = "You (admin)";

  async function loadEntries() {
    setLoading(true);
    setLoadError(null);
    const result = await getAdminWaitlist();
    if (result.ok) {
      setEntries(result.data.map(toEntry));
    } else if (result.unauthorized) {
      onSessionExpired();
      return;
    } else {
      setLoadError(result.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadEntries();
  }, []);

  async function handleSignOut() {
    await adminLogout();
    onSessionExpired();
  }

  function logAction(entryId: string, entryName: string, action: string, detail: string) {
    setAudit((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        entryId,
        entryName,
        action,
        detail,
        actor: ACTOR,
        at: new Date().toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      },
      ...prev,
    ]);
  }

  const rows = useMemo(() => {
    return entries
      .map((e) => ({ ...e, tier: tierFor(e.points) }))
      .filter((e) => {
        const q = search.trim().toLowerCase();
        const matchesSearch =
          !q ||
          e.name.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          e.referralCode.toLowerCase().includes(q);
        const matchesTier = tierFilter === "All" || e.tier === tierFilter;
        return matchesSearch && matchesTier;
      })
      .sort((a, b) => b.points - a.points);
  }, [entries, search, tierFilter]);

  const stats = useMemo(() => {
    const total = entries.length;
    const verified = entries.filter((e) => e.verified).length;
    const flagged = entries.filter((e) => e.flagged).length;
    const totalFreeTxns = entries.reduce((sum, e) => {
      const t = tierFor(e.points);
      const rule = TIER_RULES.find((r) => r.tier === t);
      return sum + (rule?.freeTransactions ?? 0);
    }, 0);
    return { total, verified, flagged, totalFreeTxns };
  }, [entries]);

  const leaderboard = useMemo(
    () => [...entries].sort((a, b) => b.referralCount - a.referralCount).slice(0, 5),
    [entries],
  );

  // People who used this entry's referral code — the drill-down list.
  function referralsOf(entry: WaitlistEntry) {
    return entries.filter((e) => e.referredBy === entry.referralCode);
  }

  function openEdit(entry: WaitlistEntry) {
    setEditing(entry);
    setPointsDraft(String(entry.points));
  }

  async function saveEdit() {
    if (!editing) return;
    const next = Number(pointsDraft);
    if (Number.isNaN(next) || next < 0) return;
    const prevPoints = editing.points;
    setSavingEdit(true);
    setActionError(null);
    const result = await setAdminPoints(editing.id, next);
    setSavingEdit(false);
    if (!result.ok) {
      if (result.unauthorized) return onSessionExpired();
      setActionError(result.message);
      return;
    }
    setEntries((prev) =>
      prev.map((e) => (e.id === editing.id ? { ...e, points: result.data.points } : e)),
    );
    logAction(
      editing.id,
      editing.name,
      "Points adjusted",
      `${prevPoints.toLocaleString("en-US")} → ${result.data.points.toLocaleString("en-US")}`,
    );
    setEditing(null);
  }

  async function toggleFlag(entry: WaitlistEntry) {
    setPendingId(entry.id);
    setActionError(null);
    const result = await setAdminFlagged(entry.id, !entry.flagged);
    setPendingId(null);
    if (!result.ok) {
      if (result.unauthorized) return onSessionExpired();
      setActionError(result.message);
      return;
    }
    setEntries((prev) =>
      prev.map((e) => (e.id === entry.id ? { ...e, flagged: result.data.flagged } : e)),
    );
    logAction(entry.id, entry.name, result.data.flagged ? "Flagged" : "Unflagged", "");
  }

  async function toggleVerified(entry: WaitlistEntry) {
    setPendingId(entry.id);
    setActionError(null);
    const result = await setAdminVerified(entry.id, !entry.verified);
    setPendingId(null);
    if (!result.ok) {
      if (result.unauthorized) return onSessionExpired();
      setActionError(result.message);
      return;
    }
    setEntries((prev) =>
      prev.map((e) => (e.id === entry.id ? { ...e, verified: result.data.is_verified } : e)),
    );
    logAction(
      entry.id,
      entry.name,
      result.data.is_verified ? "Manually verified" : "Verification revoked",
      "",
    );
    // Keep the drill-down panel in sync with the change.
    setViewing((v) => (v && v.id === entry.id ? { ...v, verified: result.data.is_verified } : v));
  }

  function exportCsv() {
    const header = "Name,Email,Verified,Referral Code,Referred By,Referral Count,Points,Tier,Joined,Flagged\n";
    const body = entries
      .map((e) => {
        const tier = tierFor(e.points);
        return [
          e.name,
          e.email,
          e.verified,
          e.referralCode,
          e.referredBy ?? "",
          e.referralCount,
          e.points,
          tier,
          e.joinedAt,
          e.flagged,
        ].join(",");
      })
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "zuno-waitlist-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="px-6 py-24 lg:px-8">
      <div className="mx-auto max-w-[1300px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Admin</p>
            <h1 className="text-heading-lg mt-2">Waitlist &amp; referrals</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Live data from the waitlist API.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv} className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="ghost" onClick={handleSignOut} className="gap-2">
              <Lock className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>

        {actionError && (
          <p className="mt-4 rounded-[8px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {actionError}
          </p>
        )}

        {loading && (
          <p className="mt-8 text-sm text-muted-foreground">Loading waitlist…</p>
        )}

        {loadError && !loading && (
          <Card className="mt-8 p-6 text-center">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={loadEntries}>
              Try again
            </Button>
          </Card>
        )}

        {!loading && !loadError && (
        <>
        {/* Stats */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Users} label="Total signups" value={stats.total} />
          <StatCard icon={UserCheck} label="Verified" value={stats.verified} />
          <StatCard icon={Gift} label="Free transactions owed" value={stats.totalFreeTxns} />
          <StatCard
            icon={ShieldAlert}
            label="Flagged accounts"
            value={stats.flagged}
            tone={stats.flagged > 0 ? "warn" : "default"}
          />
        </div>

        {/* Leaderboard */}
        <div className="mt-10">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Trophy className="h-4 w-4 text-[color:var(--gold-text)]" />
            Top referrers
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-5">
            {leaderboard.map((e, i) => (
              <Card key={e.id} className="p-4">
                <p className="text-xs text-muted-foreground">#{i + 1}</p>
                <p className="mt-1 truncate text-sm font-semibold">{e.name}</p>
                <p className="mt-1 text-lg font-semibold">
                  {e.referralCount}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    referrals
                  </span>
                </p>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent activity / audit log */}
        <div className="mt-10">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4 text-muted-foreground" />
            Recent activity
          </h2>
          <Card className="mt-3 max-h-56 overflow-y-auto p-0">
            {audit.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No manual actions yet. Point adjustments, verifications, and flags will show up
                here.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {audit.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                    <div>
                      <span className="font-medium">{a.entryName}</span>
                      <span className="text-muted-foreground"> — {a.action}</span>
                      {a.detail && (
                        <span className="text-muted-foreground"> ({a.detail})</span>
                      )}
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground">
                      {a.actor} · {a.at}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <p className="mt-2 text-xs text-muted-foreground">
            This log lives only in this browser session. The backend doesn't persist an
            audit trail yet — add a logging endpoint before relying on this for real review.
          </p>
        </div>

        {/* Filters */}
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, email, or code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={tierFilter} onValueChange={(v) => setTierFilter(v as Tier | "All")}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All tiers</SelectItem>
              <SelectItem value="None">None</SelectItem>
              <SelectItem value="Trusted">Trusted</SelectItem>
              <SelectItem value="Verified">Verified</SelectItem>
              <SelectItem value="Guardian">Guardian</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">{rows.length} results</p>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-hidden rounded-[16px] border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead>Referrals</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id} className={e.flagged ? "bg-destructive/5" : undefined}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {e.name}
                      {e.flagged && (
                        <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.email}</TableCell>
                  <TableCell>
                    {e.verified ? (
                      <Badge variant="secondary">Verified</Badge>
                    ) : (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell>{e.referralCount}</TableCell>
                  <TableCell className="font-mono">{e.points.toLocaleString("en-US")}</TableCell>
                  <TableCell>
                    <Badge variant={tierBadgeVariant(e.tier)}>{e.tier}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.joinedAt}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setViewing(e)} disabled={pendingId === e.id}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(e)} disabled={pendingId === e.id}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleFlag(e)}
                        disabled={pendingId === e.id}
                        className={e.flagged ? "text-destructive" : undefined}
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    No matching signups.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        </>
        )}
      </div>

      {/* Edit points dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust points — {editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Saved directly to the backend and logged to Recent activity below.
            </p>
            <Input
              type="number"
              min={0}
              value={pointsDraft}
              onChange={(e) => setPointsDraft(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={savingEdit}>
              {savingEdit ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Referral drill-down */}
      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-lg">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>{viewing.name}</DialogTitle>
                <DialogDescription>{viewing.email}</DialogDescription>
              </DialogHeader>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={viewing.verified ? "secondary" : "outline"}>
                  {viewing.verified ? "Verified" : "Pending verification"}
                </Badge>
                <Badge variant={tierBadgeVariant(tierFor(viewing.points))}>
                  {tierFor(viewing.points)}
                </Badge>
                {viewing.flagged && <Badge variant="destructive">Flagged</Badge>}
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto gap-1.5"
                  onClick={() => toggleVerified(viewing)}
                  disabled={pendingId === viewing.id}
                >
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {viewing.verified ? "Revoke verification" : "Mark verified"}
                </Button>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-3 rounded-[12px] border border-border p-3 text-center">
                <div>
                  <p className="text-lg font-semibold">{viewing.points.toLocaleString("en-US")}</p>
                  <p className="text-xs text-muted-foreground">points</p>
                </div>
                <div>
                  <p className="text-lg font-semibold">{viewing.referralCount}</p>
                  <p className="text-xs text-muted-foreground">referrals</p>
                </div>
                <div>
                  <p className="text-lg font-semibold">{viewing.referralCode}</p>
                  <p className="text-xs text-muted-foreground">their code</p>
                </div>
              </div>

              {viewing.referredBy && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ArrowRight className="h-3 w-3" />
                  Referred by code {viewing.referredBy}
                </p>
              )}

              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  People they referred
                </p>
                {referralsOf(viewing).length === 0 ? (
                  <p className="mt-1.5 text-sm text-muted-foreground">None yet.</p>
                ) : (
                  <ul className="mt-1.5 max-h-40 space-y-1.5 overflow-y-auto">
                    {referralsOf(viewing).map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between rounded-[8px] border border-border px-3 py-1.5 text-sm"
                      >
                        <span>{r.name}</span>
                        <Badge variant={r.verified ? "secondary" : "outline"}>
                          {r.verified ? "Verified" : "Pending"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setViewing(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Users;
  label: string;
  value: number;
  tone?: "default" | "warn";
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={`h-4 w-4 ${tone === "warn" ? "text-destructive" : ""}`} />
        <p className="text-xs">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value.toLocaleString("en-US")}</p>
    </Card>
  );
}
