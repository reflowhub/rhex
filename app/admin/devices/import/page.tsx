"use client";

import React, { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Upload,
  FileUp,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedRow {
  [key: string]: string;
}

interface ImportResult {
  importedCount: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// CSV parser (simple, handles quoted fields)
// ---------------------------------------------------------------------------

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
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

export default function ImportDevicesPage() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category") || "Phone";
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- file state ---------------------------------------------------------
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);

  // ---- import state -------------------------------------------------------
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  // ---- drag state ---------------------------------------------------------
  const [dragActive, setDragActive] = useState(false);

  // ---- file processing ----------------------------------------------------
  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      return;
    }

    setResult(null);
    setFileName(file.name);

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
  }, []);

  // ---- drag & drop handlers -----------------------------------------------
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

  // ---- reset --------------------------------------------------------------
  const resetFile = () => {
    setFileName(null);
    setCsvContent(null);
    setHeaders([]);
    setPreviewRows([]);
    setTotalRows(0);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ---- import -------------------------------------------------------------
  const handleImport = async () => {
    if (!csvContent) return;
    setImporting(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/devices/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvContent, category }),
      });
      const data: ImportResult = await res.json();
      setResult(data);
    } catch {
      setResult({ importedCount: 0, errors: ["An unexpected error occurred."] });
    } finally {
      setImporting(false);
    }
  };

  // ---- render -------------------------------------------------------------
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/devices">
            <ChevronLeft className="h-5 w-5" />
            <span className="sr-only">Back to Device Library</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import Devices</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a CSV file to bulk-import {category.toLowerCase()} devices into the library.
          </p>
        </div>
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
              Drag and drop your CSV file here
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              or click to browse files
            </p>
            <Badge variant="secondary" className="mt-4">
              .csv files only
            </Badge>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
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

      {/* Preview table */}
      {previewRows.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Preview</h2>
            <p className="text-sm text-muted-foreground">
              Showing first {previewRows.length} of {totalRows} rows
            </p>
          </div>
          <div className="mt-3 rounded-lg border border-border bg-card">
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

          {/* Import button */}
          {!result && (
            <div className="mt-6 flex justify-end">
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {importing ? "Importing..." : `Import ${totalRows} Devices`}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mt-6 space-y-4">
          {/* Success banner */}
          {result.importedCount > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  Import successful
                </p>
                <p className="mt-1 text-sm text-green-700">
                  {result.importedCount} device
                  {result.importedCount !== 1 ? "s" : ""} imported successfully.
                </p>
              </div>
            </div>
          )}

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">
                  {result.importedCount > 0
                    ? "Some rows had errors"
                    : "Import failed"}
                </p>
                <ul className="mt-2 space-y-1">
                  {result.errors.map((error, i) => (
                    <li key={i} className="text-sm text-destructive/80">
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Actions after import */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={resetFile}>
              Import Another File
            </Button>
            <Button asChild>
              <Link href="/admin/devices">View Device Library</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
