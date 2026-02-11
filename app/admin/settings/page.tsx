"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Check } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PricingSettingsData {
  gradeRatios: { B: number; C: number; D: number; E: number };
  rounding: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [ratioB, setRatioB] = useState(70);
  const [ratioC, setRatioC] = useState(40);
  const [ratioD, setRatioD] = useState(20);
  const [ratioE, setRatioE] = useState(10);
  const [rounding, setRounding] = useState<string>("5");

  useEffect(() => {
    fetch("/api/admin/settings/pricing")
      .then((res) => res.json())
      .then((data: PricingSettingsData) => {
        setRatioB(data.gradeRatios.B);
        setRatioC(data.gradeRatios.C);
        setRatioD(data.gradeRatios.D);
        setRatioE(data.gradeRatios.E);
        setRounding(String(data.rounding));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/admin/settings/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gradeRatios: {
            B: ratioB,
            C: ratioC,
            D: ratioD,
            E: ratioE,
          },
          rounding: parseInt(rounding, 10),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save settings");
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading settings...
        </span>
      </div>
    );
  }

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure default pricing parameters used by bulk adjust operations.
        </p>
      </div>

      <div className="mt-6 max-w-xl rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Default Grade Ratios</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Applied when using &ldquo;Set grade ratios from Grade A&rdquo; in bulk
          adjust. Each ratio is the percentage of the Grade A price.
        </p>

        <div className="mt-4 grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ratio-b">Grade B (%)</Label>
              <Input
                id="ratio-b"
                type="number"
                min={0}
                max={100}
                value={ratioB}
                onChange={(e) => setRatioB(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ratio-c">Grade C (%)</Label>
              <Input
                id="ratio-c"
                type="number"
                min={0}
                max={100}
                value={ratioC}
                onChange={(e) => setRatioC(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ratio-d">Grade D (%)</Label>
              <Input
                id="ratio-d"
                type="number"
                min={0}
                max={100}
                value={ratioD}
                onChange={(e) => setRatioD(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ratio-e">Grade E (%)</Label>
              <Input
                id="ratio-e"
                type="number"
                min={0}
                max={100}
                value={ratioE}
                onChange={(e) => setRatioE(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-lg font-semibold">Rounding</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            All computed prices are rounded to the nearest value.
          </p>
          <div className="mt-3 max-w-[200px]">
            <Label htmlFor="rounding">Round to nearest</Label>
            <Select value={rounding} onValueChange={setRounding}>
              <SelectTrigger id="rounding" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">$5</SelectItem>
                <SelectItem value="10">$10</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <Check className="h-4 w-4" />
              Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
