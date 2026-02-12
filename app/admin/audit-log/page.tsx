"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditEntry {
  id: string;
  timestamp: string | null;
  adminEmail: string;
  action: string;
  priceListId: string | null;
  category: string;
  summary: string;
  details: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  inline_edit: "Inline Edit",
  bulk_adjust: "Bulk Adjust",
  csv_upload: "CSV Upload",
  device_toggle: "Device Toggle",
  device_delete: "Device Delete",
};

const ACTION_COLORS: Record<string, string> = {
  inline_edit: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  bulk_adjust: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  csv_upload: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  device_toggle: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  device_delete: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<string[]>([]);

  // Load categories for filter dropdown
  useEffect(() => {
    fetch("/api/admin/categories")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCategories(data.map((c: { name: string }) => c.name));
        }
      })
      .catch(() => {});
  }, []);

  const fetchEntries = useCallback(
    async (cursor?: string | null) => {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(`/api/admin/audit-log?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    [actionFilter, categoryFilter]
  );

  // Initial load + reload on filter change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchEntries()
      .then((data) => {
        if (cancelled) return;
        setEntries(data.entries);
        setHasMore(data.hasMore);
        setNextCursor(data.nextCursor);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchEntries]);

  const loadMore = async () => {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchEntries(nextCursor);
      setEntries((prev) => [...prev, ...data.entries]);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  };

  const refresh = () => {
    setEntries([]);
    setNextCursor(null);
    setLoading(true);
    fetchEntries()
      .then((data) => {
        setEntries(data.entries);
        setHasMore(data.hasMore);
        setNextCursor(data.nextCursor);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const downloadSnapshot = async (snapshotId: string) => {
    const res = await fetch(
      `/api/admin/audit-log/snapshots/${snapshotId}?format=csv`
    );
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snapshot-${snapshotId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-NZ", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ---- render ---------------------------------------------------------------

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <div className="flex items-center gap-2">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="inline_edit">Inline Edit</SelectItem>
              <SelectItem value="bulk_adjust">Bulk Adjust</SelectItem>
              <SelectItem value="csv_upload">CSV Upload</SelectItem>
              <SelectItem value="device_toggle">Device Toggle</SelectItem>
              <SelectItem value="device_delete">Device Delete</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            Loading audit log...
          </span>
        </div>
      ) : entries.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted-foreground">
          No audit log entries found.
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-8 px-3 py-2" />
                  <th className="px-3 py-2 text-left font-medium">Time</th>
                  <th className="px-3 py-2 text-left font-medium">Admin</th>
                  <th className="px-3 py-2 text-left font-medium">Action</th>
                  <th className="px-3 py-2 text-left font-medium">Category</th>
                  <th className="px-3 py-2 text-left font-medium">Summary</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const isExpanded = expandedIds.has(entry.id);
                  const snapshotId = entry.details?.snapshotId as
                    | string
                    | null;
                  return (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      isExpanded={isExpanded}
                      onToggle={() => toggleExpand(entry.id)}
                      onDownloadSnapshot={
                        snapshotId
                          ? () => downloadSnapshot(snapshotId)
                          : undefined
                      }
                      formatTime={formatTime}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entry row — separate component for expand/collapse
// ---------------------------------------------------------------------------

function EntryRow({
  entry,
  isExpanded,
  onToggle,
  onDownloadSnapshot,
  formatTime,
}: {
  entry: AuditEntry;
  isExpanded: boolean;
  onToggle: () => void;
  onDownloadSnapshot?: () => void;
  formatTime: (iso: string | null) => string;
}) {
  const hasDetails =
    entry.action === "csv_upload" ||
    entry.action === "bulk_adjust" ||
    entry.action === "inline_edit";

  return (
    <>
      <tr
        className={cn(
          "border-b transition-colors hover:bg-muted/30",
          hasDetails && "cursor-pointer"
        )}
        onClick={hasDetails ? onToggle : undefined}
      >
        <td className="px-3 py-2 text-muted-foreground">
          {hasDetails &&
            (isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            ))}
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
          {formatTime(entry.timestamp)}
        </td>
        <td className="px-3 py-2 whitespace-nowrap">
          {entry.adminEmail.split("@")[0]}
        </td>
        <td className="px-3 py-2">
          <Badge
            variant="secondary"
            className={cn(
              "text-xs font-medium",
              ACTION_COLORS[entry.action] ?? ""
            )}
          >
            {ACTION_LABELS[entry.action] ?? entry.action}
          </Badge>
        </td>
        <td className="px-3 py-2 text-muted-foreground">{entry.category}</td>
        <td className="px-3 py-2">{entry.summary}</td>
      </tr>
      {isExpanded && hasDetails && (
        <tr className="border-b bg-muted/20">
          <td />
          <td colSpan={5} className="px-3 py-3">
            <DetailsPanel
              entry={entry}
              onDownloadSnapshot={onDownloadSnapshot}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Details panel — expanded view for each action type
// ---------------------------------------------------------------------------

function DetailsPanel({
  entry,
  onDownloadSnapshot,
}: {
  entry: AuditEntry;
  onDownloadSnapshot?: () => void;
}) {
  const d = entry.details;

  if (entry.action === "inline_edit") {
    const changes = (d.changes ?? []) as {
      grade: string;
      old: number;
      new: number;
    }[];
    return (
      <div className="space-y-1 text-sm">
        <p className="text-muted-foreground">
          Device: {(d.deviceName as string) ?? (d.deviceId as string)}
        </p>
        <div className="flex flex-wrap gap-2">
          {changes.map((c) => (
            <span key={c.grade} className="font-mono text-xs">
              {c.grade}: ${c.old} → ${c.new}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (entry.action === "bulk_adjust") {
    const deviceCount = (d.deviceCount as number) ?? 0;
    const operation = (d.operation as string) ?? "";
    const value = d.value as number | null;
    return (
      <div className="space-y-1 text-sm">
        <p className="text-muted-foreground">
          Operation: {operation}
          {value !== null && ` (${value})`} — {deviceCount} devices affected
        </p>
      </div>
    );
  }

  if (entry.action === "csv_upload") {
    const deviceCount = (d.deviceCount as number) ?? 0;
    const isOverwrite = d.isOverwrite as boolean;
    const snapshotId = d.snapshotId as string | null;
    return (
      <div className="space-y-2 text-sm">
        <p className="text-muted-foreground">
          {isOverwrite ? "Overwrote existing" : "Created new"} price list —{" "}
          {deviceCount} devices
        </p>
        {snapshotId && onDownloadSnapshot && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDownloadSnapshot();
            }}
          >
            <Download className="mr-2 h-3 w-3" />
            Download previous prices
          </Button>
        )}
      </div>
    );
  }

  return null;
}
