"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePartner } from "@/lib/partner-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link2, Copy, Check, Loader2 } from "lucide-react";
import { useFX } from "@/lib/use-fx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReferralStats {
  totalReferrals: number;
  byStatus: Record<string, number>;
  commissionEarned: number;
  commissionPending: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PartnerReferralsPage() {
  const router = useRouter();
  const { partner, loading: partnerLoading } = usePartner();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Redirect if not Mode A
  useEffect(() => {
    if (!partnerLoading && partner && !partner.modes.includes("A")) {
      router.push("/partner/dashboard");
    }
  }, [partner, partnerLoading, router]);

  // Fetch referral stats
  useEffect(() => {
    fetch("/api/partner/referral/stats")
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(console.error)
      .finally(() => setStatsLoading(false));
  }, []);

  if (partnerLoading || !partner) return null;
  if (!partner.modes.includes("A")) return null;

  const referralUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}?ref=${partner.code}`
      : "";

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(referralUrl)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = referralUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const { formatPrice: fxFormatPrice } = useFX();
  const formatPrice = (price: number) => fxFormatPrice(price, partner?.currency ?? "AUD");

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Referral Link</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Share your referral link to earn commission on trade-ins
        </p>
      </div>

      {/* Referral Link Card */}
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Link2 className="h-4 w-4" />
          Your Referral URL
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 rounded-md border bg-background px-4 py-2.5 font-mono text-sm break-all">
            {referralUrl}
          </div>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="mr-1.5 h-4 w-4 text-emerald-500" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-1.5 h-4 w-4" />
                Copy
              </>
            )}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          When a customer visits this link, their trade-in will be attributed to
          you for 30 days.
        </p>
      </div>

      {/* QR Code + Stats */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* QR Code */}
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">QR Code</p>
          <div className="mt-4 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt="Referral QR code"
              width={200}
              height={200}
              className="rounded-lg border"
            />
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Scan to open your referral link
          </p>
        </div>

        {/* Stats */}
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">
            Attribution Stats
          </p>
          {statsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Total Referrals</span>
                <span className="text-lg font-bold">
                  {stats?.totalReferrals ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Commission Earned</span>
                <span className="text-lg font-bold text-emerald-600">
                  {formatPrice(stats?.commissionEarned ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Pending Commission</span>
                <span className="text-lg font-bold text-amber-600">
                  {formatPrice(stats?.commissionPending ?? 0)}
                </span>
              </div>

              {stats?.byStatus &&
                Object.keys(stats.byStatus).length > 0 && (
                  <div className="border-t pt-4">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      By Status
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(stats.byStatus).map(([status, count]) => (
                        <Badge
                          key={status}
                          variant="secondary"
                          className="text-xs"
                        >
                          {status}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
