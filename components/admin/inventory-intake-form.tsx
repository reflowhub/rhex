"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { ArrowLeft, Loader2 } from "lucide-react";
import DeviceSearchSelect, {
  type SelectedDevice,
} from "@/components/admin/device-search-select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InventoryIntakeFormProps {
  sourceType: string;
  title: string;
  description: string;
  showSupplier?: boolean;
}

const GRADES = ["A", "B", "C", "D", "E"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InventoryIntakeForm({
  sourceType,
  title,
  description,
  showSupplier = false,
}: InventoryIntakeFormProps) {
  const router = useRouter();

  // Form state
  const [device, setDevice] = useState<SelectedDevice | null>(null);
  const [serial, setSerial] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [costAUD, setCostAUD] = useState("");
  const [cosmeticGrade, setCosmeticGrade] = useState("");
  const [sellPriceAUD, setSellPriceAUD] = useState("");
  const [batteryHealth, setBatteryHealth] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isValid =
    device &&
    serial.trim() !== "" &&
    costAUD !== "" &&
    cosmeticGrade !== "" &&
    sellPriceAUD !== "" &&
    (!showSupplier || supplierName.trim() !== "");

  const handleSubmit = async () => {
    if (!isValid || !device) return;

    setSubmitting(true);
    setFormError(null);

    const body: Record<string, unknown> = {
      deviceRef: device.id,
      serial,
      sourceType,
      cosmeticGrade,
      costAUD: parseFloat(costAUD),
      sellPriceAUD: parseFloat(sellPriceAUD),
    };

    if (supplierName.trim()) {
      body.sourceName = supplierName.trim();
    }
    if (batteryHealth) {
      body.batteryHealth = parseInt(batteryHealth, 10);
    }
    if (location.trim()) {
      body.location = location.trim();
    }
    if (notes.trim()) {
      body.notes = notes.trim();
    }

    try {
      const res = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/admin/inventory/${data.id}`);
      } else {
        const data = await res.json();
        setFormError(data.error || "Failed to create inventory item");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => router.push("/admin/inventory")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Inventory
      </Button>

      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>

      <div className="mt-8 rounded-lg border border-border bg-card p-6">
        {formError && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {formError}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Device search */}
          <div className="relative sm:col-span-2">
            <DeviceSearchSelect value={device} onChange={setDevice} />
          </div>

          {/* Serial / IMEI */}
          <div className="grid gap-2">
            <Label htmlFor="serial">Serial / IMEI *</Label>
            <Input
              id="serial"
              placeholder="Enter IMEI or serial number"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
            />
          </div>

          {/* Supplier Name (conditional) */}
          {showSupplier && (
            <div className="grid gap-2">
              <Label htmlFor="supplier">Supplier Name *</Label>
              <Input
                id="supplier"
                placeholder="e.g. Supplier Co, Auction House"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
              />
            </div>
          )}

          {/* Cost AUD */}
          <div className="grid gap-2">
            <Label htmlFor="cost">Cost (AUD) *</Label>
            <Input
              id="cost"
              type="number"
              min="0"
              step="0.01"
              placeholder="Enter cost price"
              value={costAUD}
              onChange={(e) => setCostAUD(e.target.value)}
            />
          </div>

          {/* Grade */}
          <div className="grid gap-2">
            <Label htmlFor="grade">Grade *</Label>
            <Select value={cosmeticGrade} onValueChange={setCosmeticGrade}>
              <SelectTrigger id="grade">
                <SelectValue placeholder="Select grade..." />
              </SelectTrigger>
              <SelectContent>
                {GRADES.map((g) => (
                  <SelectItem key={g} value={g}>
                    Grade {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sell Price AUD */}
          <div className="grid gap-2">
            <Label htmlFor="sell-price">Sell Price (AUD) *</Label>
            <Input
              id="sell-price"
              type="number"
              min="0"
              step="0.01"
              placeholder="Enter sell price"
              value={sellPriceAUD}
              onChange={(e) => setSellPriceAUD(e.target.value)}
            />
          </div>

          {/* Battery Health */}
          <div className="grid gap-2">
            <Label htmlFor="battery">Battery Health (%)</Label>
            <Input
              id="battery"
              type="number"
              min="0"
              max="100"
              placeholder="e.g. 87"
              value={batteryHealth}
              onChange={(e) => setBatteryHealth(e.target.value)}
            />
          </div>

          {/* Location */}
          <div className="grid gap-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="e.g. Shelf A3"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="mt-4 grid gap-2">
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="Any notes about the device condition..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Submit */}
        <div className="mt-6">
          <Button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="w-full sm:w-auto"
          >
            {submitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Add to Inventory
          </Button>
        </div>
      </div>
    </div>
  );
}
