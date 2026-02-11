"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Partner {
  id: string;
  name: string;
  code: string;
  contactEmail: string;
  modes: string[];
  status: string;
  commissionModel: string | null;
  commissionPercent: number | null;
  commissionFlat: number | null;
  commissionTiers: { minQty: number; rate: number }[] | null;
  payoutFrequency: string | null;
  partnerRateDiscount: number | null;
  createdAt: string | null;
}

interface PartnerFormData {
  name: string;
  code: string;
  contactEmail: string;
  password: string;
  currency: "AUD" | "NZD";
  modeA: boolean;
  modeB: boolean;
  status: string;
  commissionModel: string;
  commissionPercent: number;
  commissionFlat: number;
  partnerRateDiscount: number;
  payoutFrequency: string;
  contactPerson: string;
  contactPhone: string;
  address: string;
  companyName: string;
  companyRegistrationNumber: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PARTNER_STATUSES = ["all", "active", "inactive"] as const;
type StatusFilter = (typeof PARTNER_STATUSES)[number];

const PAGE_SIZE = 25;

const EMPTY_FORM: PartnerFormData = {
  name: "",
  code: "",
  contactEmail: "",
  password: "",
  currency: "AUD",
  modeA: true,
  modeB: false,
  status: "active",
  commissionModel: "percentage",
  commissionPercent: 5,
  commissionFlat: 5,
  partnerRateDiscount: 5,
  payoutFrequency: "monthly",
  contactPerson: "",
  contactPhone: "",
  address: "",
  companyName: "",
  companyRegistrationNumber: "",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PartnersPage() {
  const router = useRouter();

  // ---- data state
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- filter / search
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // ---- pagination
  const [currentPage, setCurrentPage] = useState(1);

  // ---- dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [formData, setFormData] = useState<PartnerFormData>(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ---- debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeStatus, debouncedSearch]);

  // ---- fetch partners
  const fetchPartners = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeStatus !== "all") params.set("status", activeStatus);
    if (debouncedSearch) params.set("search", debouncedSearch);
    const url = `/api/admin/partners${params.toString() ? `?${params}` : ""}`;

    fetch(url)
      .then((res) => res.json())
      .then((data: Partner[]) => {
        if (Array.isArray(data)) setPartners(data);
      })
      .finally(() => setLoading(false));
  }, [activeStatus, debouncedSearch]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  // ---- pagination
  const totalPages = Math.max(1, Math.ceil(partners.length / PAGE_SIZE));
  const paginatedPartners = partners.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // ---- form helpers
  const handleFormChange = (field: keyof PartnerFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormError(null);
  };

  const isFormValid =
    formData.name.trim() !== "" &&
    formData.code.trim().length >= 3 &&
    formData.contactEmail.trim() !== "" &&
    formData.password.length >= 6 &&
    (formData.modeA || formData.modeB);

  const handleAdd = async () => {
    if (!isFormValid) return;
    setFormLoading(true);
    setFormError(null);

    const modes: string[] = [];
    if (formData.modeA) modes.push("A");
    if (formData.modeB) modes.push("B");

    try {
      const res = await fetch("/api/admin/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          code: formData.code.trim(),
          contactEmail: formData.contactEmail.trim(),
          password: formData.password,
          currency: formData.currency,
          modes,
          status: formData.status,
          commissionModel: formData.commissionModel,
          commissionPercent: formData.commissionPercent,
          commissionFlat: formData.commissionFlat,
          partnerRateDiscount: formData.partnerRateDiscount,
          payoutFrequency: formData.payoutFrequency,
          contactPerson: formData.contactPerson.trim() || null,
          contactPhone: formData.contactPhone.trim() || null,
          address: formData.address.trim() || null,
          companyName: formData.companyName.trim() || null,
          companyRegistrationNumber: formData.companyRegistrationNumber.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setFormError(err.error || "Failed to create partner");
        return;
      }

      setAddOpen(false);
      setFormData(EMPTY_FORM);
      fetchPartners();
    } catch {
      setFormError("Failed to create partner");
    } finally {
      setFormLoading(false);
    }
  };

  // ---- helpers
  const formatDate = (iso: string | null) => {
    if (!iso) return "\u2014";
    return new Date(iso).toLocaleDateString("en-NZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // ---- render
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Partners</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? "Loading partners..."
              : `${partners.length} partner${partners.length !== 1 ? "s" : ""} found`}
          </p>
        </div>
        <Button
          onClick={() => {
            setFormData(EMPTY_FORM);
            setFormError(null);
            setAddOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Partner
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {PARTNER_STATUSES.map((status) => {
          const isActive = activeStatus === status;
          return (
            <button
              key={status}
              onClick={() => setActiveStatus(status)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {status}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="mt-4 flex max-w-sm items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, code, or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 rounded-lg border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading partners...
            </span>
          </div>
        ) : partners.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            {activeStatus !== "all" || debouncedSearch
              ? "No partners match your filters."
              : "No partners found. Create your first partner to get started."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Mode(s)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPartners.map((partner) => (
                <TableRow
                  key={partner.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/partners/${partner.id}`)}
                >
                  <TableCell className="font-medium">{partner.name}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {partner.code}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {partner.modes.map((mode) => (
                        <Badge key={mode} variant="outline" className="text-xs">
                          {mode === "A" ? "Referral" : "Hands-On"}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        partner.status === "active" ? "default" : "secondary"
                      }
                      className={
                        partner.status === "active"
                          ? "border-transparent bg-emerald-600 text-white hover:bg-emerald-600/80"
                          : ""
                      }
                    >
                      {partner.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {partner.contactEmail}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(partner.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {!loading && partners.length > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}&ndash;
            {Math.min(currentPage * PAGE_SIZE, partners.length)} of{" "}
            {partners.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Add Partner Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Partner</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {formError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {formError}
              </div>
            )}

            {/* Basic fields */}
            <div className="grid gap-2">
              <Label htmlFor="name">Partner Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleFormChange("name", e.target.value)}
                placeholder="e.g. Fix It Fast Repairs"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="code">
                Partner Code{" "}
                <span className="text-xs text-muted-foreground">
                  (unique, 3+ chars)
                </span>
              </Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  handleFormChange(
                    "code",
                    e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                  )
                }
                placeholder="e.g. FIXITFAST"
                className="font-mono"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Contact Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.contactEmail}
                onChange={(e) =>
                  handleFormChange("contactEmail", e.target.value)
                }
                placeholder="partner@example.com"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">
                Login Password{" "}
                <span className="text-xs text-muted-foreground">
                  (min 6 characters)
                </span>
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleFormChange("password", e.target.value)}
                placeholder="Temporary password for partner login"
              />
            </div>

            {/* Currency */}
            <div className="grid gap-2">
              <Label>Display Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(val) => handleFormChange("currency", val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUD">AUD (Australian Dollar)</SelectItem>
                  <SelectItem value="NZD">NZD (New Zealand Dollar)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mode selection */}
            <div className="grid gap-2">
              <Label>Mode(s)</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.modeA}
                    onChange={(e) =>
                      handleFormChange("modeA", e.target.checked)
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  <span>
                    Mode A{" "}
                    <span className="text-muted-foreground">(Referral)</span>
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.modeB}
                    onChange={(e) =>
                      handleFormChange("modeB", e.target.checked)
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  <span>
                    Mode B{" "}
                    <span className="text-muted-foreground">(Hands-On)</span>
                  </span>
                </label>
              </div>
              {!formData.modeA && !formData.modeB && (
                <p className="text-xs text-destructive">
                  At least one mode is required
                </p>
              )}
            </div>

            {/* Status */}
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(val) => handleFormChange("status", val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mode A config */}
            {formData.modeA && (
              <div className="rounded-md border border-border p-4 space-y-3">
                <p className="text-sm font-medium">
                  Mode A — Commission Settings
                </p>
                <div className="grid gap-2">
                  <Label>Commission Model</Label>
                  <Select
                    value={formData.commissionModel}
                    onValueChange={(val) =>
                      handleFormChange("commissionModel", val)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="flat">Flat Fee</SelectItem>
                      <SelectItem value="tiered">Tiered Volume</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.commissionModel === "percentage" && (
                  <div className="grid gap-2">
                    <Label>Commission Rate (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={formData.commissionPercent}
                      onChange={(e) =>
                        handleFormChange(
                          "commissionPercent",
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                )}
                {formData.commissionModel === "flat" && (
                  <div className="grid gap-2">
                    <Label>Flat Fee ($ per device)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.commissionFlat}
                      onChange={(e) =>
                        handleFormChange(
                          "commissionFlat",
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                )}
                {formData.commissionModel === "tiered" && (
                  <p className="text-xs text-muted-foreground">
                    Tiered volume configuration will be available on the partner
                    detail page after creation.
                  </p>
                )}
                <div className="grid gap-2">
                  <Label>Payout Frequency</Label>
                  <Select
                    value={formData.payoutFrequency}
                    onValueChange={(val) =>
                      handleFormChange("payoutFrequency", val)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="fortnightly">Fortnightly</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Mode B config */}
            {formData.modeB && (
              <div className="rounded-md border border-border p-4 space-y-3">
                <p className="text-sm font-medium">
                  Mode B — Partner Rate Settings
                </p>
                <div className="grid gap-2">
                  <Label>Rate Discount (% below public consumer payout)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={formData.partnerRateDiscount}
                    onChange={(e) =>
                      handleFormChange(
                        "partnerRateDiscount",
                        parseFloat(e.target.value) || 0
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Partner receives {100 - formData.partnerRateDiscount}% of
                    the public consumer payout. They set their own price with
                    their customer.
                  </p>
                </div>
              </div>
            )}

            {/* Contact Details */}
            <div className="rounded-md border border-border p-4 space-y-3">
              <p className="text-sm font-medium">Contact Details (optional)</p>
              <div className="grid gap-2">
                <Label>Company Name</Label>
                <Input
                  value={formData.companyName}
                  onChange={(e) => handleFormChange("companyName", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Company Registration Number</Label>
                <Input
                  value={formData.companyRegistrationNumber}
                  onChange={(e) => handleFormChange("companyRegistrationNumber", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Contact Person</Label>
                <Input
                  value={formData.contactPerson}
                  onChange={(e) => handleFormChange("contactPerson", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Contact Phone</Label>
                <Input
                  value={formData.contactPhone}
                  onChange={(e) => handleFormChange("contactPhone", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Address</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => handleFormChange("address", e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={formLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!isFormValid || formLoading}
            >
              {formLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Partner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
