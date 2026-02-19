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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Trophy, Star } from "lucide-react";

interface RaffleEntry {
  id: string;
  quoteId: string;
  customerName: string;
  customerEmail: string;
  rating: number;
  comment: string | null;
  raffleWinner: boolean;
  createdAt: string | null;
}

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    options.push({ value, label });
  }
  return options;
}

export default function AdminRafflePage() {
  const monthOptions = getMonthOptions();
  const [month, setMonth] = useState(monthOptions[0].value);
  const [entries, setEntries] = useState<RaffleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [drawResult, setDrawResult] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/raffle?month=${month}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
      }
    } catch (err) {
      console.error("Failed to fetch raffle entries:", err);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const winner = entries.find((e) => e.raffleWinner);
  const avgRating =
    entries.length > 0
      ? entries.reduce((sum, e) => sum + e.rating, 0) / entries.length
      : 0;

  const handleDraw = async () => {
    if (!confirm("Draw a random winner for this month? This cannot be undone."))
      return;

    setDrawing(true);
    setDrawResult(null);
    try {
      const res = await fetch("/api/admin/raffle/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });
      const data = await res.json();
      if (res.ok) {
        setDrawResult(
          `Winner: ${data.winner.customerName} (${data.winner.customerEmail}) — notification email sent!`
        );
        fetchEntries();
      } else {
        setDrawResult(data.error || "Failed to draw winner.");
      }
    } catch {
      setDrawResult("Failed to draw winner.");
    } finally {
      setDrawing(false);
    }
  };

  const selectedLabel =
    monthOptions.find((o) => o.value === month)?.label ?? month;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Raffle</h1>
          <p className="text-sm text-muted-foreground">
            {entries.length} {entries.length === 1 ? "entry" : "entries"} for{" "}
            {selectedLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleDraw}
            disabled={drawing || entries.length === 0 || !!winner}
          >
            {drawing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Drawing...
              </>
            ) : (
              <>
                <Trophy className="mr-2 h-4 w-4" />
                Draw Winner
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Winner Banner */}
      {winner && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-center gap-3">
          <Trophy className="h-5 w-5 text-green-600" />
          <div>
            <p className="font-semibold text-green-800">
              Winner: {winner.customerName}
            </p>
            <p className="text-sm text-green-700">{winner.customerEmail}</p>
          </div>
        </div>
      )}

      {/* Draw Result */}
      {drawResult && !winner && (
        <div className="rounded-lg border p-4">
          <p className="text-sm">{drawResult}</p>
        </div>
      )}

      {/* Stats */}
      {entries.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Entries</p>
            <p className="text-2xl font-bold">{entries.length}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Avg Rating</p>
            <p className="text-2xl font-bold">{avgRating.toFixed(1)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Winner Drawn</p>
            <p className="text-2xl font-bold">{winner ? "Yes" : "No"}</p>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
        </div>
      ) : entries.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">
            No feedback entries for {selectedLabel}.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Quote</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead className="w-[80px]">Winner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-sm">
                    {entry.createdAt
                      ? new Date(entry.createdAt).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {entry.customerName}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {entry.customerEmail}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {entry.quoteId.slice(0, 8)}...
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-3.5 w-3.5 ${
                            s <= entry.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell
                    className="max-w-[200px] truncate text-sm text-muted-foreground"
                    title={entry.comment ?? undefined}
                  >
                    {entry.comment || "—"}
                  </TableCell>
                  <TableCell>
                    {entry.raffleWinner && (
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        Winner
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
