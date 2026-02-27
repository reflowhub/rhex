"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  AlertTriangle,
} from "lucide-react";
import { escapeCsvField, downloadCsv } from "@/lib/csv-export";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PriceListMeta {
  id: string;
  name: string;
  effectiveDate: string | null;
  currency: string;
  deviceCount: number;
  category: string;
  createdAt: string | null;
}

interface PriceEntry {
  deviceId: string;
  numericId: number | null;
  make: string;
  model: string;
  storage: string;
  grades: Record<string, number>;
}

interface CategoryGradeInfo {
  key: string;
  label: string;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 0] as const; // 0 = All

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PriceListDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  // ---- data state ---------------------------------------------------------
  const [priceList, setPriceList] = useState<PriceListMeta | null>(null);
  const [prices, setPrices] = useState<PriceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- category grade keys (dynamic) -------------------------------------
  const [gradeKeys, setGradeKeys] = useState<string[]>(["A", "B", "C", "D", "E"]);

  // ---- search state -------------------------------------------------------
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // ---- pagination state ---------------------------------------------------
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // ---- inline editing state -----------------------------------------------
  const [changes, setChanges] = useState<Map<string, Record<string, number>>>(
    new Map()
  );
  const [editingCell, setEditingCell] = useState<{
    deviceId: string;
    grade: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  // ---- row selection state -------------------------------------------------
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(
    new Set()
  );

  // ---- bulk adjust dialog state -------------------------------------------
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkOperation, setBulkOperation] = useState<
    "adjust_percent" | "adjust_dollar" | "set_ratios"
  >("adjust_percent");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  // ---- add device dialog state --------------------------------------------
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addMake, setAddMake] = useState("");
  const [addModel, setAddModel] = useState("");
  const [addStorage, setAddStorage] = useState("");
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // ---- debounced search ---------------------------------------------------
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ---- fetch data ---------------------------------------------------------
  const fetchData = useCallback(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/admin/pricing/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => {
        setPriceList(data.priceList);
        setPrices(data.prices ?? []);

        // Load grade keys from category
        const category = data.priceList?.category ?? "Phone";
        fetch("/api/admin/categories")
          .then((r) => r.json())
          .then((catData) => {
            if (catData.categories && catData.categories[category]) {
              const grades = catData.categories[category].grades as CategoryGradeInfo[];
              if (grades && grades.length > 0) {
                setGradeKeys(grades.map((g) => g.key));
              }
            }
          })
          .catch(() => {
            // Keep default grade keys
          });
      })
      .catch(() => {
        setPriceList(null);
        setPrices([]);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- focus edit input when cell opens -----------------------------------
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // ---- filtered, sorted + paginated data ----------------------------------
  const filteredPrices = useMemo(() => {
    let result = prices;
    if (searchTerm) {
      const words = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
      result = result.filter((p) => {
        const numId = p.numericId != null ? String(p.numericId) : "";
        const combined =
          `${numId} ${p.make} ${p.model} ${p.storage}`.toLowerCase();
        return words.every((word) => combined.includes(word));
      });
    }
    // Sort by make → model → storage for model family grouping
    const storageToGB = (s: string): number => {
      const match = s.match(/^(\d+)\s*(TB|GB|MB)/i);
      if (!match) return 0;
      const num = parseInt(match[1], 10);
      const unit = match[2].toUpperCase();
      if (unit === "TB") return num * 1024;
      if (unit === "MB") return num / 1024;
      return num;
    };
    return [...result].sort((a, b) => {
      const cmp1 = a.make.localeCompare(b.make);
      if (cmp1 !== 0) return cmp1;
      const cmp2 = a.model.localeCompare(b.model);
      if (cmp2 !== 0) return cmp2;
      return storageToGB(a.storage) - storageToGB(b.storage);
    });
  }, [prices, searchTerm]);

  const effectivePageSize = pageSize === 0 ? filteredPrices.length : pageSize;
  const totalPages = Math.max(1, Math.ceil(filteredPrices.length / (effectivePageSize || 1)));
  const paginatedPrices = pageSize === 0
    ? filteredPrices
    : filteredPrices.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
      );

  // ---- change tracking helpers --------------------------------------------
  const totalChanges = useMemo(() => {
    let count = 0;
    changes.forEach((gradeChanges) => {
      count += Object.keys(gradeChanges).length;
    });
    return count;
  }, [changes]);

  const getDisplayValue = (deviceId: string, grade: string, original: number) => {
    return changes.get(deviceId)?.[grade] ?? original;
  };

  const isChanged = (deviceId: string, grade: string) => {
    return changes.get(deviceId)?.[grade] !== undefined;
  };

  const hasGradeInversion = (deviceId: string, grade: string) => {
    const entry = prices.find((p) => p.deviceId === deviceId);
    if (!entry) return false;

    const gradeIdx = gradeKeys.indexOf(grade);
    if (gradeIdx <= 0) return false;

    const currentValue = getDisplayValue(deviceId, grade, entry.grades[grade] ?? 0);
    const higherGrade = gradeKeys[gradeIdx - 1];
    const higherValue = getDisplayValue(deviceId, higherGrade, entry.grades[higherGrade] ?? 0);

    return currentValue > higherValue;
  };

  // ---- inline editing handlers --------------------------------------------
  const startEdit = (deviceId: string, grade: string, currentValue: number) => {
    setEditingCell({ deviceId, grade });
    setEditValue(String(currentValue));
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const { deviceId, grade } = editingCell;
    const numValue = Number(editValue);

    if (!isNaN(numValue) && numValue >= 0) {
      const entry = prices.find((p) => p.deviceId === deviceId);
      const originalValue = entry?.grades[grade] ?? 0;

      if (numValue !== originalValue) {
        setChanges((prev) => {
          const next = new Map(prev);
          const existing = next.get(deviceId) ?? {};
          next.set(deviceId, { ...existing, [grade]: numValue });
          return next;
        });
      } else {
        // If value is same as original, remove the change
        setChanges((prev) => {
          const next = new Map(prev);
          const existing = next.get(deviceId);
          if (existing) {
            const { [grade]: _, ...rest } = existing;
            if (Object.keys(rest).length === 0) {
              next.delete(deviceId);
            } else {
              next.set(deviceId, rest);
            }
          }
          return next;
        });
      }
    }
    setEditingCell(null);
  };

  const cancelEdit = () => {
    setEditingCell(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  // ---- save all changes ---------------------------------------------------
  const saveAllChanges = async () => {
    if (totalChanges === 0) return;
    setSaving(true);

    try {
      const entries = Array.from(changes.entries());
      for (const [deviceId, gradeChanges] of entries) {
        const res = await fetch(
          `/api/admin/pricing/${id}/prices/${deviceId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ grades: gradeChanges }),
          }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to save ${deviceId}`);
        }
      }

      setChanges(new Map());
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  // ---- discard all changes ------------------------------------------------
  const discardAllChanges = () => {
    setChanges(new Map());
    setEditingCell(null);
  };

  // ---- add device handler -------------------------------------------------
  const handleAddDevice = async () => {
    if (!addMake.trim() || !addModel.trim() || !addStorage.trim()) {
      setAddError("All fields are required");
      return;
    }

    setAddSaving(true);
    setAddError("");

    try {
      // Create device with the price list's category
      const deviceRes = await fetch("/api/admin/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          make: addMake.trim(),
          model: addModel.trim(),
          storage: addStorage.trim(),
          category: priceList?.category ?? "Phone",
        }),
      });

      if (!deviceRes.ok) {
        const data = await deviceRes.json().catch(() => ({}));
        setAddError(data.error || "Failed to create device");
        return;
      }

      const device = await deviceRes.json();

      // Create price entry with $0 grades for all grade keys
      const zeroGrades: Record<string, number> = {};
      gradeKeys.forEach((g) => (zeroGrades[g] = 0));

      await fetch(`/api/admin/pricing/${id}/prices/${device.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grades: zeroGrades }),
      });

      setAddDialogOpen(false);
      setAddMake("");
      setAddModel("");
      setAddStorage("");
      fetchData();
    } catch {
      setAddError("Failed to create device");
    } finally {
      setAddSaving(false);
    }
  };

  // ---- export CSV ---------------------------------------------------------
  const handleExportCsv = () => {
    const header = ["DeviceID", "Numeric ID", "Make", "Model", "Storage", ...gradeKeys.map((g) => `Grade ${g}`)];
    const rows = filteredPrices.map((p) => [
      p.deviceId,
      p.numericId != null ? String(p.numericId) : "",
      escapeCsvField(p.make),
      escapeCsvField(p.model),
      escapeCsvField(p.storage),
      ...gradeKeys.map((g) => String(p.grades[g] ?? 0)),
    ]);
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const name = priceList?.name ?? "prices";
    downloadCsv(csv, `${name.replace(/\s+/g, "-").toLowerCase()}-export.csv`);
  };

  // ---- row selection handlers ----------------------------------------------
  const allFilteredSelected =
    filteredPrices.length > 0 &&
    filteredPrices.every((p) => selectedDevices.has(p.deviceId));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedDevices(new Set());
    } else {
      setSelectedDevices(new Set(filteredPrices.map((p) => p.deviceId)));
    }
  };

  const toggleSelectDevice = (deviceId: string) => {
    setSelectedDevices((prev) => {
      const next = new Set(prev);
      if (next.has(deviceId)) {
        next.delete(deviceId);
      } else {
        next.add(deviceId);
      }
      return next;
    });
  };

  // ---- bulk adjust handler ------------------------------------------------
  const handleBulkAdjust = async () => {
    if (selectedDevices.size === 0) return;

    if (
      (bulkOperation === "adjust_percent" || bulkOperation === "adjust_dollar") &&
      (bulkValue === "" || isNaN(Number(bulkValue)))
    ) {
      return;
    }

    setBulkSaving(true);
    try {
      const res = await fetch(`/api/admin/pricing/${id}/bulk-adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: bulkOperation,
          value: bulkOperation !== "set_ratios" ? Number(bulkValue) : undefined,
          deviceIds: Array.from(selectedDevices),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Bulk adjust failed");
      }

      setBulkDialogOpen(false);
      setSelectedDevices(new Set());
      setBulkValue("");
      setChanges(new Map());
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Bulk adjust failed");
    } finally {
      setBulkSaving(false);
    }
  };

  // ---- helpers ------------------------------------------------------------
  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-NZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString("en-NZ")}`;
  };

  // Compute the label for the first grade (used in "set ratios" description)
  const firstGradeLabel = gradeKeys[0] ?? "A";
  const otherGradeLabels = gradeKeys.slice(1).join("/");

  // ---- render: loading ----------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading price list...
        </span>
      </div>
    );
  }

  // ---- render: not found --------------------------------------------------
  if (!priceList) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground">Price list not found.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/admin/pricing")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Pricing
        </Button>
      </div>
    );
  }

  // ---- render: main -------------------------------------------------------
  return (
    <div>
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => router.push("/admin/pricing")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Pricing
      </Button>

      {/* Header with metadata */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {priceList.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>Effective: {formatDate(priceList.effectiveDate)}</span>
            <Badge variant="secondary">{priceList.currency}</Badge>
            <span>{priceList.deviceCount} devices</span>
            <Badge variant="outline">{priceList.category}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedDevices.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBulkDialogOpen(true);
                setBulkOperation("adjust_percent");
                setBulkValue("");
              }}
            >
              Bulk Adjust ({selectedDevices.size})
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={filteredPrices.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setAddDialogOpen(true);
              setAddError("");
              setAddMake("");
              setAddModel("");
              setAddStorage("");
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Device
          </Button>
        </div>
      </div>

      {/* Unsaved changes banner */}
      {totalChanges > 0 && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 dark:border-yellow-700 dark:bg-yellow-900/20">
          <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            {totalChanges} unsaved price{totalChanges !== 1 ? "s" : ""} changed
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={discardAllChanges}
              disabled={saving}
            >
              Discard All
            </Button>
            <Button size="sm" onClick={saveAllChanges} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save All"
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="relative mt-6 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by device ID, make, model, or storage..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Prices table */}
      <div className="mt-6 rounded-lg border border-border bg-card">
        {paginatedPrices.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            {searchTerm
              ? "No devices match your search."
              : "No pricing data found."}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </TableHead>
                  <TableHead className="w-[120px]">Device ID</TableHead>
                  <TableHead>Make</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Storage</TableHead>
                  {gradeKeys.map((g) => (
                    <TableHead key={g} className="text-right">
                      Grade {g}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPrices.map((price) => (
                  <TableRow key={price.deviceId}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedDevices.has(price.deviceId)}
                        onChange={() => toggleSelectDevice(price.deviceId)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {price.numericId ?? price.deviceId}
                    </TableCell>
                    <TableCell className="font-medium">{price.make}</TableCell>
                    <TableCell>{price.model}</TableCell>
                    <TableCell>{price.storage}</TableCell>
                    {gradeKeys.map((g) => {
                      const originalValue = price.grades[g] ?? 0;
                      const displayValue = getDisplayValue(
                        price.deviceId,
                        g,
                        originalValue
                      );
                      const changed = isChanged(price.deviceId, g);
                      const inverted = hasGradeInversion(price.deviceId, g);
                      const isEditing =
                        editingCell?.deviceId === price.deviceId &&
                        editingCell?.grade === g;

                      return (
                        <TableCell
                          key={g}
                          className={`text-right ${
                            inverted
                              ? "bg-orange-100 dark:bg-orange-900/30"
                              : changed
                              ? "bg-yellow-100 dark:bg-yellow-900/30"
                              : ""
                          }`}
                          title={
                            inverted
                              ? `Warning: Grade ${g} ($${displayValue}) is higher than the grade above`
                              : changed
                              ? `$${originalValue} → $${displayValue}`
                              : undefined
                          }
                        >
                          {isEditing ? (
                            <Input
                              ref={editInputRef}
                              type="number"
                              min="0"
                              step="1"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={handleEditKeyDown}
                              className="h-7 w-20 text-right ml-auto"
                            />
                          ) : (
                            <button
                              type="button"
                              className="inline-flex w-full items-center justify-end rounded px-1 py-0.5 hover:bg-muted/50 transition-colors cursor-pointer"
                              onClick={() =>
                                startEdit(price.deviceId, g, displayValue)
                              }
                            >
                              {inverted && (
                                <AlertTriangle className="mr-1 h-3 w-3 text-orange-600 dark:text-orange-400" />
                              )}
                              {formatCurrency(displayValue)}
                            </button>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <div className="flex items-center gap-4">
                <p className="text-sm text-muted-foreground">
                  Showing{" "}
                  <span className="font-medium">
                    {pageSize === 0 ? 1 : (currentPage - 1) * pageSize + 1}
                  </span>
                  {" - "}
                  <span className="font-medium">
                    {pageSize === 0
                      ? filteredPrices.length
                      : Math.min(
                          currentPage * pageSize,
                          filteredPrices.length
                        )}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium">
                    {filteredPrices.length}
                  </span>{" "}
                  devices
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-muted-foreground">Show</span>
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    {PAGE_SIZE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt === 0 ? "All" : opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() =>
                      setCurrentPage((prev) =>
                        Math.min(totalPages, prev + 1)
                      )
                    }
                  >
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Bulk Adjust Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Bulk Adjust Prices ({selectedDevices.size} device
              {selectedDevices.size !== 1 ? "s" : ""})
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Operation</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={bulkOperation}
                onChange={(e) =>
                  setBulkOperation(
                    e.target.value as "adjust_percent" | "adjust_dollar" | "set_ratios"
                  )
                }
              >
                <option value="adjust_percent">Adjust by percentage</option>
                <option value="adjust_dollar">Adjust by dollar amount</option>
                <option value="set_ratios">Set grade ratios from Grade {firstGradeLabel}</option>
              </select>
            </div>
            {bulkOperation !== "set_ratios" && (
              <div className="grid gap-2">
                <Label>
                  {bulkOperation === "adjust_percent"
                    ? "Percentage (e.g. 10 for +10%, -5 for -5%)"
                    : "Dollar amount (e.g. 20 for +$20, -10 for -$10)"}
                </Label>
                <Input
                  type="number"
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  placeholder={
                    bulkOperation === "adjust_percent" ? "e.g. 10" : "e.g. 20"
                  }
                />
              </div>
            )}
            {bulkOperation === "set_ratios" && (
              <p className="text-sm text-muted-foreground">
                This will keep Grade {firstGradeLabel} unchanged and set {otherGradeLabels} based on the
                grade ratios configured in Settings. Each grade price is
                calculated as a percentage of Grade {firstGradeLabel}.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDialogOpen(false)}
              disabled={bulkSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkAdjust}
              disabled={
                bulkSaving ||
                (bulkOperation !== "set_ratios" &&
                  (bulkValue === "" || isNaN(Number(bulkValue))))
              }
            >
              {bulkSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                "Apply"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Device Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Device to Price List</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {addError && (
              <p className="text-sm text-destructive">{addError}</p>
            )}
            <div className="grid gap-2">
              <Label htmlFor="add-make">Make</Label>
              <Input
                id="add-make"
                value={addMake}
                onChange={(e) => setAddMake(e.target.value)}
                placeholder="e.g. Apple"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-model">Model</Label>
              <Input
                id="add-model"
                value={addModel}
                onChange={(e) => setAddModel(e.target.value)}
                placeholder="e.g. iPhone 15 Pro"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-storage">Storage</Label>
              <Input
                id="add-storage"
                value={addStorage}
                onChange={(e) => setAddStorage(e.target.value)}
                placeholder="e.g. 256GB"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              disabled={addSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleAddDevice} disabled={addSaving}>
              {addSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
