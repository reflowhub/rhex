"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Upload,
  Loader2,
  FileUp,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CategoryInfo {
  name: string;
  grades: { key: string; label: string }[];
  activePriceList: string | null;
}

interface PriceList {
  id: string;
  name: string;
  effectiveDate: string | null;
  currency: string;
  deviceCount: number;
  category: string;
  createdAt: string | null;
}

interface PreviewRow {
  deviceId: string;
  make: string;
  model: string;
  storage: string;
  grades: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PricingPage() {
  const router = useRouter();

  // ---- category state -----------------------------------------------------
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("Phone");

  // ---- data state ---------------------------------------------------------
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- upload dialog state ------------------------------------------------
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- drag state ---------------------------------------------------------
  const [dragOver, setDragOver] = useState(false);

  // ---- derived state ------------------------------------------------------
  const currentCategory = categories.find((c) => c.name === selectedCategory);
  const gradeKeys = currentCategory?.grades.map((g) => g.key) ?? ["A", "B", "C", "D", "E"];
  const activePriceListId = currentCategory?.activePriceList ?? null;

  // ---- fetch categories ---------------------------------------------------
  useEffect(() => {
    fetch("/api/admin/categories")
      .then((res) => res.json())
      .then((data) => {
        if (data.categories) {
          const cats: CategoryInfo[] = Object.entries(data.categories).map(
            ([name, value]) => {
              const cat = value as Record<string, unknown>;
              return {
                name,
                grades: (cat.grades as CategoryInfo["grades"]) ?? [],
                activePriceList: (cat.activePriceList as string) ?? null,
              };
            }
          );
          cats.sort((a, b) => a.name.localeCompare(b.name));
          setCategories(cats);
        }
      })
      .catch(() => {
        setCategories([{ name: "Phone", grades: [], activePriceList: null }]);
      });
  }, []);

  // ---- fetch price lists --------------------------------------------------
  const fetchPriceLists = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/pricing")
      .then((res) => res.json())
      .then((data: PriceList[]) => {
        if (Array.isArray(data)) {
          setPriceLists(data);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchPriceLists();
  }, [fetchPriceLists]);

  // ---- CSV preview parsing (dynamic grades) -------------------------------
  const parsePreview = (text: string) => {
    const lines = text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      setPreviewRows([]);
      setTotalRows(0);
      return;
    }

    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const diIdx = header.indexOf("deviceid");
    const mkIdx = header.indexOf("make");
    const mdIdx = header.indexOf("model");
    const stIdx = header.indexOf("storage");

    // Find grade column indices dynamically
    const gradeIdxMap: { key: string; idx: number }[] = [];
    for (const gk of gradeKeys) {
      const idx = header.indexOf(gk.toLowerCase());
      if (idx !== -1) {
        gradeIdxMap.push({ key: gk, idx });
      }
    }

    const dataLines = lines.slice(1);
    setTotalRows(dataLines.length);

    const preview: PreviewRow[] = [];
    for (let i = 0; i < Math.min(5, dataLines.length); i++) {
      const fields = dataLines[i].split(",").map((f) => f.trim());
      const grades: Record<string, string> = {};
      for (const { key, idx } of gradeIdxMap) {
        grades[key] = fields[idx] ?? "";
      }
      preview.push({
        deviceId: diIdx !== -1 ? (fields[diIdx] ?? "") : "",
        make: mkIdx !== -1 ? (fields[mkIdx] ?? "") : "",
        model: mdIdx !== -1 ? (fields[mdIdx] ?? "") : "",
        storage: stIdx !== -1 ? (fields[stIdx] ?? "") : "",
        grades,
      });
    }
    setPreviewRows(preview);
  };

  // ---- file reading -------------------------------------------------------
  const readFile = (file: File) => {
    setFileName(file.name);
    setUploadErrors([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
      parsePreview(text);
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) {
      readFile(file);
    }
  };

  // ---- upload handler -----------------------------------------------------
  const handleUpload = async () => {
    if (!uploadName.trim() || !csvText) return;
    setUploading(true);
    setUploadErrors([]);

    try {
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: uploadName.trim(),
          csv: csvText,
          category: selectedCategory,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setUploadErrors(
          data.errors ?? [data.error ?? "Upload failed"]
        );
        return;
      }

      if (data.errors && data.errors.length > 0) {
        setUploadErrors(data.errors);
      }

      // Success — close dialog and refresh
      setUploadOpen(false);
      resetUploadForm();
      fetchPriceLists();
      // Refresh categories (activePriceList may have changed)
      fetch("/api/admin/categories")
        .then((res) => res.json())
        .then((catData) => {
          if (catData.categories) {
            const cats: CategoryInfo[] = Object.entries(catData.categories).map(
              ([name, value]) => {
                const cat = value as Record<string, unknown>;
                return {
                  name,
                  grades: (cat.grades as CategoryInfo["grades"]) ?? [],
                  activePriceList: (cat.activePriceList as string) ?? null,
                };
              }
            );
            cats.sort((a, b) => a.name.localeCompare(b.name));
            setCategories(cats);
          }
        });
    } catch {
      setUploadErrors(["Network error. Please try again."]);
    } finally {
      setUploading(false);
    }
  };

  const resetUploadForm = () => {
    setUploadName("");
    setCsvText("");
    setFileName("");
    setPreviewRows([]);
    setTotalRows(0);
    setUploadErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openUploadDialog = () => {
    resetUploadForm();
    setUploadOpen(true);
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

  // Get the active price list object for the selected category
  const activePriceList = activePriceListId
    ? priceLists.find((pl) => pl.id === activePriceListId)
    : null;

  // ---- render -------------------------------------------------------------
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pricing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage trade-in price lists by category.
          </p>
        </div>
        <Button onClick={openUploadDialog}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Price List
        </Button>
      </div>

      {/* Category Tabs */}
      {categories.length > 1 && (
        <div className="mt-6 flex gap-1 border-b border-border">
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                selectedCategory === cat.name
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Category content */}
      <div className="mt-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading...
            </span>
          </div>
        ) : activePriceList ? (
          <div
            className="cursor-pointer rounded-lg border border-border bg-card p-6 transition-colors hover:bg-muted/50"
            onClick={() =>
              router.push(`/admin/pricing/${activePriceList.id}`)
            }
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">{activePriceList.name}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>
                    Effective: {formatDate(activePriceList.effectiveDate)}
                  </span>
                  <Badge variant="secondary">{activePriceList.currency}</Badge>
                  <span>{activePriceList.deviceCount} devices</span>
                  <Badge variant="outline">
                    {gradeKeys.length} grade{gradeKeys.length !== 1 ? "s" : ""} ({gradeKeys.join(", ")})
                  </Badge>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/admin/pricing/${activePriceList.id}`);
                }}
              >
                View Prices
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No price list for {selectedCategory} yet.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={openUploadDialog}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload CSV to create price list
            </Button>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Upload Price List Dialog                                            */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Price List — {selectedCategory}</DialogTitle>
            <DialogDescription>
              Upload a CSV file with device pricing. Expected columns:
              DeviceID, Make, Model, Storage, {gradeKeys.join(", ")}.
              {activePriceListId && (
                <span className="mt-1 block text-yellow-700 dark:text-yellow-400">
                  This will overwrite the existing {selectedCategory} price list.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name input */}
            <div className="grid gap-2">
              <Label htmlFor="price-list-name">Price List Name</Label>
              <Input
                id="price-list-name"
                placeholder={`e.g. ${selectedCategory} Prices January 2026`}
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
              />
            </div>

            {/* File drop zone */}
            <div className="grid gap-2">
              <Label>CSV File</Label>
              <div
                className={`relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {fileName ? (
                  <div className="flex items-center gap-2 text-sm">
                    <FileUp className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{fileName}</span>
                    <button
                      type="button"
                      className="ml-1 rounded p-0.5 hover:bg-muted"
                      onClick={(e) => {
                        e.stopPropagation();
                        resetUploadForm();
                      }}
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Drag and drop a CSV file, or click to browse
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            {/* Preview table with dynamic grade columns */}
            {previewRows.length > 0 && (
              <div className="grid gap-2">
                <Label>
                  Preview ({Math.min(5, totalRows)} of {totalRows} rows)
                </Label>
                <div className="overflow-x-auto rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">DeviceID</TableHead>
                        <TableHead className="text-xs">Make</TableHead>
                        <TableHead className="text-xs">Model</TableHead>
                        <TableHead className="text-xs">Storage</TableHead>
                        {gradeKeys.map((g) => (
                          <TableHead key={g} className="text-right text-xs">
                            {g}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs">{row.deviceId}</TableCell>
                          <TableCell className="text-xs">{row.make}</TableCell>
                          <TableCell className="text-xs">{row.model}</TableCell>
                          <TableCell className="text-xs">{row.storage}</TableCell>
                          {gradeKeys.map((g) => (
                            <TableCell key={g} className="text-right text-xs">
                              {row.grades[g] ?? ""}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {totalRows > 5 && (
                  <p className="text-xs text-muted-foreground">
                    ...and {totalRows - 5} more rows
                  </p>
                )}
              </div>
            )}

            {/* Errors */}
            {uploadErrors.length > 0 && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <p className="mb-1 text-sm font-medium text-destructive">
                  Errors
                </p>
                <ul className="list-inside list-disc space-y-0.5 text-xs text-destructive">
                  {uploadErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadOpen(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={
                uploading || !uploadName.trim() || !csvText
              }
            >
              {uploading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
