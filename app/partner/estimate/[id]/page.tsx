"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { usePartner } from "@/lib/partner-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Loader2, Check, Package } from "lucide-react";
import { useFX } from "@/lib/use-fx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeviceLine {
  id: string;
  rawInput: string;
  deviceId: string | null;
  deviceName: string | null;
  matchConfidence: string;
  quantity: number;
  assumedGrade: string;
  indicativePriceNZD: number;
  publicPriceNZD?: number;
}

interface EstimateDetail {
  id: string;
  type: string;
  assumedGrade: string;
  totalDevices: number;
  totalIndicativeNZD: number;
  totalPublicNZD: number | null;
  matchedCount: number;
  unmatchedCount: number;
  status: string;
  partnerMode: string;
  partnerRateDiscount: number;
  createdAt: string | null;
  acceptedAt: string | null;
  devices: DeviceLine[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PartnerEstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { partner } = usePartner();
  const [estimate, setEstimate] = useState<EstimateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/partner/estimate/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => setEstimate(data))
      .catch(() => setError("Estimate not found"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const res = await fetch(`/api/partner/estimate/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      if (res.ok) {
        setEstimate((prev) =>
          prev ? { ...prev, status: "accepted" } : prev
        );
      }
    } catch {
      setError("Failed to accept estimate");
    } finally {
      setAccepting(false);
    }
  };

  const { formatPrice: fxFormatPrice } = useFX();
  const formatPrice = (price: number | null | undefined) => {
    return fxFormatPrice(price, partner?.currency ?? "AUD");
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "\u2014";
    return new Date(iso).toLocaleDateString("en-NZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !estimate) {
    return (
      <div className="py-16 text-center">
        <p className="text-destructive">{error || "Estimate not found"}</p>
        <Button className="mt-4" onClick={() => router.push("/partner/estimate")}>
          Back to Estimates
        </Button>
      </div>
    );
  }

  const confidenceBadge = (conf: string) => {
    const colors: Record<string, string> = {
      high: "border-transparent bg-emerald-600 text-white",
      medium: "border-transparent bg-amber-500 text-white",
      low: "border-transparent bg-orange-500 text-white",
      manual: "border-transparent bg-red-500 text-white",
    };
    return (
      <Badge variant="default" className={`text-xs ${colors[conf] ?? ""}`}>
        {conf}
      </Badge>
    );
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/partner/quotes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bulk Estimate</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {estimate.totalDevices} devices \u2022 Created {formatDate(estimate.createdAt)}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Status</p>
          <Badge
            variant={estimate.status === "accepted" ? "default" : "secondary"}
            className={estimate.status === "accepted" ? "mt-1 border-transparent bg-emerald-600 text-white" : "mt-1"}
          >
            {estimate.status}
          </Badge>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Partner Rate Total</p>
          <p className="mt-1 text-xl font-bold">{formatPrice(estimate.totalIndicativeNZD)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Matched Devices</p>
          <p className="mt-1 text-xl font-bold">
            {estimate.matchedCount} / {estimate.matchedCount + estimate.unmatchedCount}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Default Grade</p>
          <p className="mt-1 text-xl font-bold">Grade {estimate.assumedGrade}</p>
        </div>
      </div>

      {/* Accept button */}
      {estimate.status === "estimated" && (
        <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
          <div>
            <p className="font-medium">Ready to proceed?</p>
            <p className="text-sm text-muted-foreground">
              Accept this estimate to begin the trade-in process
            </p>
          </div>
          <Button onClick={handleAccept} disabled={accepting}>
            {accepting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Accept Estimate
          </Button>
        </div>
      )}

      {/* Device lines */}
      <div className="mt-6 rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Device Lines</span>
          <Badge variant="secondary" className="text-xs">
            {estimate.devices.length} lines
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Input</TableHead>
                <TableHead>Matched Device</TableHead>
                <TableHead>Match</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead className="text-right">Partner Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estimate.devices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell className="text-sm max-w-[200px] truncate">
                    {device.rawInput}
                  </TableCell>
                  <TableCell className="text-sm">
                    {device.deviceName ?? (
                      <span className="text-muted-foreground">No match</span>
                    )}
                  </TableCell>
                  <TableCell>{confidenceBadge(device.matchConfidence)}</TableCell>
                  <TableCell className="text-right">{device.quantity}</TableCell>
                  <TableCell>Grade {device.assumedGrade}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatPrice(device.indicativePriceNZD)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
