"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  PackageX,
  ScanLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/compress-image";
import { QUOTE_STATUS_LABELS, isQuoteStatus } from "@/lib/quote-status";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Match {
  id: string;
  tradeInRef: string | null;
  status: string;
  customerName: string | null;
  customerEmail: string | null;
  device: string;
  grade: string | null;
  imei: string | null;
  trackingNumber: string | null;
  expectedByAt: string | null;
  matchedOn: string;
}

interface UnmatchedParcel {
  id: string;
  scanText: string | null;
  imei: string | null;
  note: string | null;
  hasPhoto: boolean;
  createdAt: string | null;
  createdBy: string | null;
}

const MATCH_LABELS: Record<string, string> = {
  tracking: "Tracking number",
  reference: "TI reference",
  imei: "IMEI",
  quoteId: "Quote ID",
  customer: "Customer",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReceiveParcelPage() {
  const scanRef = useRef<HTMLInputElement>(null);
  const imeiRef = useRef<HTMLInputElement>(null);

  // ---- search ------------------------------------------------------------
  const [scan, setScan] = useState("");
  const [searched, setSearched] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ---- receive -----------------------------------------------------------
  const [selected, setSelected] = useState<Match | null>(null);
  const [imei, setImei] = useState("");
  const [serial, setSerial] = useState("");
  const [receiving, setReceiving] = useState(false);

  // ---- unmatched ---------------------------------------------------------
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [umImei, setUmImei] = useState("");
  const [umNote, setUmNote] = useState("");
  const [umPhoto, setUmPhoto] = useState<File | null>(null);
  const [umSaving, setUmSaving] = useState(false);
  const [umKey, setUmKey] = useState(0);
  const [parcels, setParcels] = useState<UnmatchedParcel[]>([]);

  const loadParcels = useCallback(() => {
    fetch("/api/admin/trade-ins/unmatched")
      .then((res) => (res.ok ? res.json() : { parcels: [] }))
      .then((data) => setParcels(data.parcels ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadParcels();
    scanRef.current?.focus();
  }, [loadParcels]);

  const reset = () => {
    setScan("");
    setSearched(null);
    setMatches([]);
    setSelected(null);
    setImei("");
    setSerial("");
    setShowUnmatched(false);
    setError(null);
    scanRef.current?.focus();
  };

  const select = (match: Match) => {
    setSelected(match);
    setImei("");
    setSerial("");
    setError(null);
    setTimeout(() => imeiRef.current?.focus(), 0);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = scan.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    setSuccess(null);
    setSelected(null);
    setShowUnmatched(false);
    try {
      const res = await fetch(`/api/admin/trade-ins/lookup?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Search failed");
        return;
      }
      setSearched(q);
      setMatches(data.matches);
      if (data.matches.length === 1) select(data.matches[0]);
    } catch {
      setError("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setReceiving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/quotes/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "received",
          imei: imei || undefined,
          serialNumber: serial.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to receive parcel");
        return;
      }
      setSuccess(
        `Received ${selected.tradeInRef ?? selected.id.slice(0, 8)} (${selected.device}).`
      );
      reset();
    } catch {
      setError("Failed to receive parcel");
    } finally {
      setReceiving(false);
    }
  };

  const handleLogUnmatched = async (e: React.FormEvent) => {
    e.preventDefault();
    setUmSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("scanText", searched ?? scan);
      form.append("imei", umImei);
      form.append("note", umNote);
      if (umPhoto) form.append("photo", await compressImage(umPhoto));
      const res = await fetch("/api/admin/trade-ins/unmatched", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to log parcel");
        return;
      }
      setSuccess("Logged as an unmatched parcel.");
      setUmImei("");
      setUmNote("");
      setUmPhoto(null);
      setUmKey((k) => k + 1);
      loadParcels();
      reset();
    } catch {
      setError("Failed to log parcel");
    } finally {
      setUmSaving(false);
    }
  };

  const resolveParcel = async (id: string) => {
    const resolution = window.prompt("How was this parcel resolved? (e.g. matched to TI-1001, returned to sender)");
    if (!resolution?.trim()) return;
    const res = await fetch(`/api/admin/trade-ins/unmatched/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution }),
    });
    if (res.ok) loadParcels();
  };

  const imeiMismatch =
    !!selected?.imei && imei.length === 15 && imei !== selected.imei;
  const late =
    !!selected?.expectedByAt && new Date(selected.expectedByAt) < new Date();

  return (
    <div className="max-w-3xl">
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href="/admin/trade-ins">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Trade-in Ops
        </Link>
      </Button>

      <h1 className="text-3xl font-bold tracking-tight">Receive Parcel</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Scan the label barcode, or type a tracking number, TI- reference,
        IMEI, or customer name or email.
      </p>

      {success && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      )}

      <form onSubmit={handleSearch} className="mt-6 flex gap-2">
        <div className="relative flex-1">
          <ScanLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={scanRef}
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            placeholder="Scan or type…"
            className="pl-9 font-mono"
            autoComplete="off"
          />
        </div>
        <Button type="submit" disabled={searching || !scan.trim()}>
          {searching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Find
        </Button>
      </form>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {/* Matches */}
      {searched !== null && !selected && (
        <div className="mt-6 space-y-3">
          {matches.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-6 text-center">
              <PackageX className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                No accepted or shipped trade-in matches{" "}
                <span className="font-mono text-foreground">{searched}</span>.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowUnmatched(true)}
              >
                Log unmatched parcel
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {matches.length} match{matches.length === 1 ? "" : "es"}. Pick
                the parcel&apos;s trade-in.
              </p>
              {matches.map((m) => (
                <button
                  key={m.id}
                  onClick={() => select(m)}
                  className="w-full rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/50"
                >
                  <MatchSummary match={m} />
                </button>
              ))}
              <Button variant="link" className="px-0" onClick={() => setShowUnmatched(true)}>
                None of these — log unmatched parcel
              </Button>
            </>
          )}
        </div>
      )}

      {/* Receive form */}
      {selected && (
        <form
          onSubmit={handleReceive}
          className="mt-6 rounded-lg border border-border bg-card p-6"
        >
          <MatchSummary match={selected} />
          {late && (
            <p className="mt-3 flex items-center gap-2 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              Arrived after the expected date; it will be flagged as a late
              arrival. Check the first-scan date in AusPost tracking.
            </p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="rx-imei">IMEI</Label>
              <Input
                id="rx-imei"
                ref={imeiRef}
                value={imei}
                inputMode="numeric"
                maxLength={15}
                className="font-mono"
                onChange={(e) => setImei(e.target.value.replace(/\D/g, "").slice(0, 15))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rx-serial">Serial number (if no IMEI)</Label>
              <Input
                id="rx-serial"
                value={serial}
                className="font-mono"
                onChange={(e) => setSerial(e.target.value)}
              />
            </div>
          </div>
          {imeiMismatch && (
            <p className="mt-3 flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Doesn&apos;t match the IMEI on the quote ({selected.imei}). Check
              it&apos;s the right device before receiving.
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <Button
              type="submit"
              disabled={receiving || (imei.length !== 15 && !serial.trim())}
            >
              {receiving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Receive
            </Button>
            <Button type="button" variant="outline" onClick={() => setSelected(null)}>
              Back
            </Button>
          </div>
        </form>
      )}

      {/* Unmatched parcel form */}
      {showUnmatched && (
        <form
          key={umKey}
          onSubmit={handleLogUnmatched}
          className="mt-6 grid gap-3 rounded-lg border border-border bg-card p-6"
        >
          <h2 className="text-lg font-semibold">Log Unmatched Parcel</h2>
          <p className="text-sm text-muted-foreground">
            Scan: <span className="font-mono">{searched ?? scan}</span>
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="um-imei">IMEI (if readable)</Label>
            <Input
              id="um-imei"
              value={umImei}
              inputMode="numeric"
              className="font-mono"
              onChange={(e) => setUmImei(e.target.value.replace(/\D/g, "").slice(0, 15))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="um-photo">Photo</Label>
            <Input
              id="um-photo"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setUmPhoto(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="um-note">Note</Label>
            <Textarea
              id="um-note"
              value={umNote}
              onChange={(e) => setUmNote(e.target.value)}
              placeholder="Sender details, what's in the box, any note inside…"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={umSaving}>
              {umSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log Parcel
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowUnmatched(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Open unmatched parcels */}
      {parcels.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold">Open Unmatched Parcels</h2>
          <div className="mt-3 space-y-3">
            {parcels.map((p) => (
              <div
                key={p.id}
                className="flex gap-4 rounded-lg border border-border bg-card p-4 text-sm"
              >
                {p.hasPhoto && (
                  <a
                    href={`/api/admin/trade-ins/unmatched/${p.id}/photo`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/admin/trade-ins/unmatched/${p.id}/photo`}
                      alt="Parcel"
                      className="h-20 w-20 rounded-md object-cover"
                    />
                  </a>
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-muted-foreground">
                    {formatDate(p.createdAt)} · {p.createdBy}
                  </p>
                  {p.scanText && (
                    <p className="truncate font-mono text-xs">Scan: {p.scanText}</p>
                  )}
                  {p.imei && <p className="font-mono text-xs">IMEI: {p.imei}</p>}
                  {p.note && <p>{p.note}</p>}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 self-start"
                  onClick={() => resolveParcel(p.id)}
                >
                  Resolve
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MatchSummary({ match }: { match: Match }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono font-semibold">
          {match.tradeInRef ?? match.id.slice(0, 8)}
        </span>
        <Badge variant="outline">
          {isQuoteStatus(match.status) ? QUOTE_STATUS_LABELS[match.status] : match.status}
        </Badge>
        <span className={cn("text-xs text-muted-foreground")}>
          Matched on {MATCH_LABELS[match.matchedOn] ?? match.matchedOn}
        </span>
      </div>
      <p className="font-medium">
        {match.device}
        {match.grade && <span className="text-muted-foreground"> · Grade {match.grade}</span>}
      </p>
      <p className="text-muted-foreground">
        {match.customerName ?? "No name"}
        {match.customerEmail && ` · ${match.customerEmail}`}
      </p>
      <p className="font-mono text-xs text-muted-foreground">
        {match.trackingNumber && `Tracking ${match.trackingNumber}`}
        {match.imei && ` · Quoted IMEI ${match.imei}`}
      </p>
    </div>
  );
}
