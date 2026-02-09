"use client";

import React, { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ThemeToggle } from "@/components/theme-toggle";
import { useCurrency } from "@/lib/currency-context";
import { cn } from "@/lib/utils";
import {
  FileUp,
  Upload,
  X,
  Loader2,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedRow {
  [key: string]: string;
}

// ---------------------------------------------------------------------------
// CSV parser (same as device import)
// ---------------------------------------------------------------------------

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ",") {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.every((v) => !v.trim())) continue;
    const row: ParsedRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    rows.push(row);
  }

  return { headers, rows };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EstimatePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currency, setCurrency } = useCurrency();

  // File state
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  // Config state
  const [assumedGrade, setAssumedGrade] = useState("C");

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Process uploaded file (CSV or XLSX)
  const processFile = useCallback(async (file: File) => {
    setError(null);

    const isCSV = file.name.toLowerCase().endsWith(".csv");
    const isXLSX =
      file.name.toLowerCase().endsWith(".xlsx") ||
      file.name.toLowerCase().endsWith(".xls");

    if (!isCSV && !isXLSX) {
      setError("Please upload a .csv or .xlsx file");
      return;
    }

    setFileName(file.name);

    if (isCSV) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setCsvContent(text);
        const { headers: h, rows } = parseCSV(text);
        setHeaders(h);
        setTotalRows(rows.length);
        setPreviewRows(rows.slice(0, 10));
      };
      reader.readAsText(file);
    } else {
      // XLSX — dynamically import SheetJS
      try {
        const XLSX = await import("xlsx");
        const reader = new FileReader();
        reader.onload = (e) => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const csvText = XLSX.utils.sheet_to_csv(firstSheet);
          setCsvContent(csvText);
          const { headers: h, rows } = parseCSV(csvText);
          setHeaders(h);
          setTotalRows(rows.length);
          setPreviewRows(rows.slice(0, 10));
        };
        reader.readAsArrayBuffer(file);
      } catch {
        setError("Failed to parse XLSX file");
      }
    }
  }, []);

  // Drag & drop handlers
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!dragActive) setDragActive(true);
    },
    [dragActive]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const resetFile = () => {
    setFileName(null);
    setCsvContent(null);
    setHeaders([]);
    setPreviewRows([]);
    setTotalRows(0);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Submit manifest
  const handleSubmit = async () => {
    if (!csvContent) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/business/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csv: csvContent,
          assumedGrade,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create estimate");
        return;
      }

      const data = await res.json();
      router.push(`/business/estimate/${data.id}`);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo-rhex.svg"
              alt="rhex"
              width={28}
              height={28}
              className="h-7 w-7"
            />
            <span className="text-xl font-bold tracking-tight">
              Trade-In
            </span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Business
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex items-center rounded-lg border bg-background p-0.5 text-xs font-medium">
              <button
                onClick={() => setCurrency("AUD")}
                className={cn(
                  "rounded-md px-2 py-1 transition-colors",
                  currency === "AUD"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                AUD
              </button>
              <button
                onClick={() => setCurrency("NZD")}
                className={cn(
                  "rounded-md px-2 py-1 transition-colors",
                  currency === "NZD"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                NZD
              </button>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Back + Title */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/business">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Upload Manifest
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload a CSV or XLSX file with your device list to get an instant
              estimate.
            </p>
          </div>
        </div>

        {/* Grade selector */}
        <div className="mt-6 flex items-center gap-4">
          <label className="text-sm font-medium">Assumed Grade</label>
          <Select value={assumedGrade} onValueChange={setAssumedGrade}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A">A — Excellent</SelectItem>
              <SelectItem value="B">B — Good</SelectItem>
              <SelectItem value="C">C — Fair</SelectItem>
              <SelectItem value="D">D — Screen Issues</SelectItem>
              <SelectItem value="E">E — No Power</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            Used for indicative pricing. Actual prices determined after
            inspection.
          </span>
        </div>

        {/* Upload area */}
        <div className="mt-8">
          {!fileName ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-16 transition-colors",
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <FileUp className="h-7 w-7 text-primary" />
              </div>
              <p className="text-sm font-medium">
                Drag and drop your manifest file here
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                or click to browse files
              </p>
              <div className="mt-4 flex gap-2">
                <Badge variant="secondary">.csv</Badge>
                <Badge variant="secondary">.xlsx</Badge>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Upload className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {totalRows} row{totalRows !== 1 ? "s" : ""} detected
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={resetFile}
                  title="Remove file"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Remove file</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Preview table */}
        {previewRows.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Preview</h2>
              <p className="text-sm text-muted-foreground">
                Showing first {previewRows.length} of {totalRows} rows
              </p>
            </div>
            <div className="mt-3 rounded-lg border border-border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {headers.map((header) => (
                      <TableHead key={header}>{header}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, i) => (
                    <TableRow key={i}>
                      {headers.map((header) => (
                        <TableCell key={header}>{row[header]}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Submit button */}
            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                size="lg"
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                {submitting
                  ? "Generating estimate..."
                  : `Generate Estimate (${totalRows} devices)`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
