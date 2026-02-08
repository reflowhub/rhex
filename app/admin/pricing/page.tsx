"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
  Trash2,
  Loader2,
  FileUp,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PriceList {
  id: string;
  name: string;
  effectiveDate: string | null;
  currency: string;
  deviceCount: number;
  createdAt: string | null;
}

interface PreviewRow {
  deviceId: string;
  make: string;
  model: string;
  storage: string;
  a: string;
  b: string;
  c: string;
  d: string;
  e: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PricingPage() {
  const router = useRouter();

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

  // ---- delete dialog state ------------------------------------------------
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingList, setDeletingList] = useState<PriceList | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ---- drag state ---------------------------------------------------------
  const [dragOver, setDragOver] = useState(false);

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

  // ---- CSV preview parsing ------------------------------------------------
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
    const aIdx = header.indexOf("a");
    const bIdx = header.indexOf("b");
    const cIdx = header.indexOf("c");
    const dIdx = header.indexOf("d");
    const eIdx = header.indexOf("e");

    const dataLines = lines.slice(1);
    setTotalRows(dataLines.length);

    const preview: PreviewRow[] = [];
    for (let i = 0; i < Math.min(5, dataLines.length); i++) {
      const fields = dataLines[i].split(",").map((f) => f.trim());
      preview.push({
        deviceId: diIdx !== -1 ? (fields[diIdx] ?? "") : "",
        make: mkIdx !== -1 ? (fields[mkIdx] ?? "") : "",
        model: mdIdx !== -1 ? (fields[mdIdx] ?? "") : "",
        storage: stIdx !== -1 ? (fields[stIdx] ?? "") : "",
        a: aIdx !== -1 ? (fields[aIdx] ?? "") : "",
        b: bIdx !== -1 ? (fields[bIdx] ?? "") : "",
        c: cIdx !== -1 ? (fields[cIdx] ?? "") : "",
        d: dIdx !== -1 ? (fields[dIdx] ?? "") : "",
        e: eIdx !== -1 ? (fields[eIdx] ?? "") : "",
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
        body: JSON.stringify({ name: uploadName.trim(), csv: csvText }),
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

  // ---- delete handler -----------------------------------------------------
  const openDeleteDialog = (priceList: PriceList, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingList(priceList);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingList) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/admin/pricing/${deletingList.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteOpen(false);
        setDeletingList(null);
        fetchPriceLists();
      }
    } finally {
      setDeleting(false);
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

  // ---- render -------------------------------------------------------------
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Price Lists</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage trade-in price lists and grade pricing.
          </p>
        </div>
        <Button onClick={openUploadDialog}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Price List
        </Button>
      </div>

      {/* Table */}
      <div className="mt-6 rounded-lg border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading price lists...
            </span>
          </div>
        ) : priceLists.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            No price lists found. Upload your first price list to get started.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="text-right">Devices</TableHead>
                <TableHead className="w-[80px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {priceLists.map((pl) => (
                <TableRow
                  key={pl.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/pricing/${pl.id}`)}
                >
                  <TableCell className="font-medium">{pl.name}</TableCell>
                  <TableCell>{formatDate(pl.effectiveDate)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{pl.currency}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{pl.deviceCount}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => openDeleteDialog(pl, e)}
                      title="Delete price list"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Upload Price List Dialog                                            */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Price List</DialogTitle>
            <DialogDescription>
              Upload a CSV file with device pricing. Expected columns:
              DeviceID, Make, Model, Storage, A, B, C, D, E.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name input */}
            <div className="grid gap-2">
              <Label htmlFor="price-list-name">Price List Name</Label>
              <Input
                id="price-list-name"
                placeholder="e.g. FP-2B January 2026"
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

            {/* Preview table */}
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
                        <TableHead className="text-right text-xs">A</TableHead>
                        <TableHead className="text-right text-xs">B</TableHead>
                        <TableHead className="text-right text-xs">C</TableHead>
                        <TableHead className="text-right text-xs">D</TableHead>
                        <TableHead className="text-right text-xs">E</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs">{row.deviceId}</TableCell>
                          <TableCell className="text-xs">{row.make}</TableCell>
                          <TableCell className="text-xs">{row.model}</TableCell>
                          <TableCell className="text-xs">{row.storage}</TableCell>
                          <TableCell className="text-right text-xs">
                            {row.a}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {row.b}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {row.c}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {row.d}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {row.e}
                          </TableCell>
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

      {/* ------------------------------------------------------------------ */}
      {/* Delete Confirmation Dialog                                          */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Price List</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">
                {deletingList?.name ?? "this price list"}
              </span>
              ? This will remove all associated pricing data. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
