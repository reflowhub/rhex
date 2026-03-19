"use client";

import React, { useState, useEffect } from "react";
import {
  reauthenticateWithCredential,
  updatePassword,
  EmailAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { usePartner } from "@/lib/partner-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Link2, Package } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PartnerSettings {
  id: string;
  name: string;
  code: string;
  contactEmail: string;
  modes: string[];
  commissionModel: string | null;
  commissionPercent: number | null;
  commissionFlat: number | null;
  commissionTiers: { minQty: number; rate: number }[] | null;
  payoutFrequency: string | null;
  partnerRateDiscount: number | null;
  currency: "AUD" | "NZD";
  paymentMethod: string | null;
  bankBSB: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PartnerSettingsPage() {
  const { partner, loading: partnerLoading } = usePartner();
  const [settings, setSettings] = useState<PartnerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable form fields
  const [bankBSB, setBankBSB] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/partner/settings")
      .then((res) => res.json())
      .then((data: PartnerSettings) => {
        setSettings(data);
        setBankBSB(data.bankBSB || "");
        setBankAccountNumber(data.bankAccountNumber || "");
        setBankAccountName(data.bankAccountName || "");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/partner/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: "bank_transfer",
          bankBSB,
          bankAccountNumber,
          bankAccountName,
        }),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const err = await res.json();
        setError(err.error || "Failed to save");
      }
    } catch {
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPwError(null);
    setPwSaved(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError("All password fields are required");
      return;
    }
    if (newPassword.length < 6) {
      setPwError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match");
      return;
    }

    setPwSaving(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        setPwError("Not authenticated. Please log in again.");
        return;
      }

      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      setPwSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPwSaved(false), 3000);
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string };
      if (
        firebaseErr.code === "auth/wrong-password" ||
        firebaseErr.code === "auth/invalid-credential"
      ) {
        setPwError("Current password is incorrect");
      } else if (firebaseErr.code === "auth/weak-password") {
        setPwError("Password must be at least 6 characters");
      } else if (firebaseErr.code === "auth/too-many-requests") {
        setPwError("Too many attempts. Please try again later.");
      } else {
        setPwError(firebaseErr.message || "Failed to update password");
      }
    } finally {
      setPwSaving(false);
    }
  };

  if (partnerLoading || !partner) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your contact and payment details
        </p>
      </div>

      <div className="mt-6 max-w-2xl space-y-6">
        {/* Contact Details (editable) */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Contact Details</h2>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={settings.name} disabled />
            </div>
            <div className="grid gap-2">
              <Label>Contact Email</Label>
              <Input value={settings.contactEmail} disabled />
            </div>
            <div className="grid gap-2">
              <Label>Partner Code</Label>
              <Input value={settings.code} disabled className="font-mono" />
              <p className="text-xs text-muted-foreground">
                Contact admin to change your partner code
              </p>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Change Password</h2>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button
              onClick={handlePasswordChange}
              disabled={pwSaving}
              variant="outline"
            >
              {pwSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : pwSaved ? (
                <Check className="mr-2 h-4 w-4" />
              ) : null}
              {pwSaved ? "Updated" : "Update Password"}
            </Button>
            {pwError && (
              <p className="text-sm text-destructive">{pwError}</p>
            )}
            {pwSaved && (
              <p className="text-sm text-green-600">Password updated successfully</p>
            )}
          </div>
        </div>

        {/* Payment Details (editable) */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Payment Details</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Bank transfer details for receiving payouts
          </p>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Currency</Label>
              <Input value={settings.currency} disabled className="font-mono" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bank-name">Account Name</Label>
              <Input
                id="bank-name"
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="bank-bsb">BSB</Label>
                <Input
                  id="bank-bsb"
                  value={bankBSB}
                  onChange={(e) => setBankBSB(e.target.value)}
                  placeholder="000-000"
                  className="font-mono"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bank-account">Account Number</Label>
                <Input
                  id="bank-account"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Commission / Rate Config (read-only) */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">
            Pricing Configuration
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            These settings are managed by Reflow Hub. Contact admin for changes.
          </p>

          <dl className="grid gap-3 text-sm">
            {settings.modes.includes("A") && (
              <>
                <div className="flex items-center gap-2 font-medium">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  Mode A — Referral Commission
                </div>
                <div className="flex justify-between pl-6">
                  <dt className="text-muted-foreground">Model</dt>
                  <dd className="font-medium capitalize">
                    {settings.commissionModel || "percentage"}
                  </dd>
                </div>
                {settings.commissionModel === "percentage" && (
                  <div className="flex justify-between pl-6">
                    <dt className="text-muted-foreground">Rate</dt>
                    <dd className="font-medium">
                      {settings.commissionPercent ?? 5}%
                    </dd>
                  </div>
                )}
                {settings.commissionModel === "flat" && (
                  <div className="flex justify-between pl-6">
                    <dt className="text-muted-foreground">Flat Fee</dt>
                    <dd className="font-medium">
                      ${settings.commissionFlat ?? 0} / device
                    </dd>
                  </div>
                )}
                {settings.commissionModel === "tiered" &&
                  settings.commissionTiers && (
                    <div className="pl-6">
                      <dt className="mb-1 text-muted-foreground">Tiers</dt>
                      <dd>
                        {settings.commissionTiers.map((tier, i) => (
                          <div
                            key={i}
                            className="flex justify-between text-xs"
                          >
                            <span>{tier.minQty}+ devices/month</span>
                            <span className="font-medium">{tier.rate}%</span>
                          </div>
                        ))}
                      </dd>
                    </div>
                  )}
                <div className="flex justify-between pl-6">
                  <dt className="text-muted-foreground">Payout Frequency</dt>
                  <dd className="font-medium capitalize">
                    {settings.payoutFrequency || "monthly"}
                  </dd>
                </div>
              </>
            )}

            {settings.modes.includes("A") &&
              settings.modes.includes("B") && (
                <div className="my-1 h-px bg-border" />
              )}

            {settings.modes.includes("B") && (
              <>
                <div className="flex items-center gap-2 font-medium">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Mode B — Partner Rate
                </div>
                <div className="flex justify-between pl-6">
                  <dt className="text-muted-foreground">Payout</dt>
                  <dd className="font-medium">Ad-hoc</dd>
                </div>
              </>
            )}

            <div className="my-1 h-px bg-border" />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Modes</dt>
              <dd className="flex gap-1">
                {settings.modes.map((m) => (
                  <Badge key={m} variant="outline" className="text-xs">
                    {m === "A" ? "Referral" : "Dealer"}
                  </Badge>
                ))}
              </dd>
            </div>
          </dl>
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="mr-2 h-4 w-4" />
            ) : null}
            {saved ? "Saved" : "Save Changes"}
          </Button>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
