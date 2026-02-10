"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { usePartner } from "@/lib/partner-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
import {
  FileUp,
  Upload,
  X,
  Loader2,
  AlertCircle,
  Plus,
  Search,
  List,
  Trash2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedRow {
  [key: string]: string;
}

interface Device {
  id: string;
  make: string;
  model: string;
  storage: string;
}

interface ManualLine {
  key: number;
  device: Device;
  quantity: number;
  grade: string;
}

// ---------------------------------------------------------------------------
// CSV parser
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

export default function PartnerEstimatePage() {
  const router = useRouter();
  const { partner, loading: partnerLoading } = usePartner();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Input mode
  const [inputMode, setInputMode] = useState<"upload" | "manual">("upload");

  // File state
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  // Manual list state
  const [devices, setDevices] = useState<Device[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [manualLines, setManualLines] = useState<ManualLine[]>([]);
  const [addQuantity, setAddQuantity] = useState("1");
  const [lineCounter, setLineCounter] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Config
  const [assumedGrade, setAssumedGrade] = useState("C");

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not Mode B
  useEffect(() => {
    if (!partnerLoading && partner && !partner.modes.includes("B")) {
      router.push("/partner/dashboard");
    }
  }, [partner, partnerLoading, router]);

  // Fetch devices for manual mode
  useEffect(() => {
    if (inputMode === "manual" && devices.length === 0) {
      setDevicesLoading(true);
      fetch("/api/devices")
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setDevices(data))
        .catch(() => {})
        .finally(() => setDevicesLoading(false));
    }
  }, [inputMode, devices.length]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const words = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    return devices
      .filter((d) => {
        const haystack = `${d.make} ${d.model} ${d.storage}`.toLowerCase();
        return words.every((w) => haystack.includes(w));
      })
      .slice(0, 8);
  }, [devices, searchQuery]);

  useEffect(() => setHighlightIndex(0), [filtered]);
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[highlightIndex] as HTMLElement;
    item?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  const addDevice = (device: Device) => {
    const qty = Math.max(1, parseInt(addQuantity) || 1);
    setManualLines((prev) => [
      ...prev,
      { key: lineCounter, device, quantity: qty, grade: assumedGrade },
    ]);
    setLineCounter((c) => c + 1);
    setSearchQuery("");
    setSearchOpen(false);
    setAddQuantity("1");
    searchInputRef.current?.focus();
  };

  const removeDevice = (key: number) => {
    setManualLines((prev) => prev.filter((l) => l.key !== key));
  };

  const updateQuantity = (key: number, qty: string) => {
    const parsed = parseInt(qty);
    if (isNaN(parsed) || parsed < 1) return;
    setManualLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, quantity: parsed } : l))
    );
  };

  const updateGrade = (key: number, grade: string) => {
    setManualLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, grade } : l))
    );
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!searchOpen || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      addDevice(filtered[highlightIndex]);
    } else if (e.key === "Escape") {
      setSearchOpen(false);
    }
  };

  const buildManualCSV = (): string => {
    const lines = ["Device,Quantity,Grade"];
    for (const line of manualLines) {
      const name = `${line.device.make} ${line.device.model} ${line.device.storage}`;
      lines.push(`"${name}",${line.quantity},${line.grade}`);
    }
    return lines.join("\n");
  };

  const totalManualDevices = manualLines.reduce((sum, l) => sum + l.quantity, 0);

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

  const handleDragOver = useCallback(
    (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (!dragActive) setDragActive(true); },
    [dragActive]
  );
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }, []);
  const handleDrop = useCallback(
    (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); const file = e.dataTransfer.files?.[0]; if (file) processFile(file); },
    [processFile]
  );
  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) processFile(file); },
    [processFile]
  );

  const resetFile = () => {
    setFileName(null); setCsvContent(null); setHeaders([]); setPreviewRows([]); setTotalRows(0); setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    const csv = inputMode === "upload" ? csvContent : buildManualCSV();
    if (!csv) return;
    if (inputMode === "manual" && manualLines.length === 0) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/partner/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, assumedGrade }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create estimate");
        return;
      }

      const data = await res.json();
      router.push(`/partner/estimate/${data.id}`);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    inputMode === "upload"
      ? !!csvContent && previewRows.length > 0
      : manualLines.length > 0;

  const deviceCount = inputMode === "upload" ? totalRows : totalManualDevices;

  if (partnerLoading || !partner) return null;
  if (!partner.modes.includes("B")) return null;

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bulk Estimate</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a manifest or build a list to get partner rates on multiple devices
        </p>
      </div>

      <div className="mx-auto mt-6 max-w-3xl space-y-6">
        {/* Input mode tabs */}
        <div className="flex rounded-lg border bg-background p-1">
          <button
            onClick={() => setInputMode("upload")}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              inputMode === "upload" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Upload className="mr-1.5 inline-block h-3.5 w-3.5" />
            Upload CSV/XLSX
          </button>
          <button
            onClick={() => setInputMode("manual")}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              inputMode === "manual" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="mr-1.5 inline-block h-3.5 w-3.5" />
            Build List
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Upload mode */}
        {inputMode === "upload" && (
          <>
            {!csvContent ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors",
                  dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                )}
              >
                <FileUp className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium">Drop your file here or</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => fileInputRef.current?.click()}>
                  Browse files
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">CSV or XLSX with a device/model column</p>
                <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileInput} />
              </div>
            ) : (
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{fileName}</span>
                    <Badge variant="secondary" className="text-xs">{totalRows} rows</Badge>
                  </div>
                  <Button variant="ghost" size="icon" onClick={resetFile}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {headers.length > 0 && previewRows.length > 0 && (
                  <div className="mt-3 overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {headers.map((h) => (
                            <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewRows.slice(0, 5).map((row, i) => (
                          <TableRow key={i}>
                            {headers.map((h) => (
                              <TableCell key={h} className="text-xs whitespace-nowrap">{row[h]}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {totalRows > 5 && (
                      <p className="px-3 py-2 text-xs text-muted-foreground">
                        Showing 5 of {totalRows} rows
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Manual mode */}
        {inputMode === "manual" && (
          <div className="rounded-lg border bg-card p-4 space-y-4">
            {/* Search + add */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                  onFocus={() => searchQuery.trim() && setSearchOpen(true)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={devicesLoading ? "Loading..." : "Search device..."}
                  disabled={devicesLoading}
                  className="flex h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  autoComplete="off"
                />
                {searchOpen && searchQuery.trim() && (
                  <ul ref={listRef} className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
                    {filtered.length === 0 ? (
                      <li className="px-3 py-4 text-center text-xs text-muted-foreground">No devices found</li>
                    ) : (
                      filtered.map((d, i) => (
                        <li
                          key={d.id}
                          onMouseDown={(e) => { e.preventDefault(); addDevice(d); }}
                          onMouseEnter={() => setHighlightIndex(i)}
                          className={cn("flex cursor-pointer items-center justify-between rounded-sm px-3 py-2 text-sm", i === highlightIndex && "bg-accent")}
                        >
                          <span><span className="font-medium">{d.make}</span> {d.model}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{d.storage}</span>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
              <Input
                type="number"
                min="1"
                value={addQuantity}
                onChange={(e) => setAddQuantity(e.target.value)}
                className="w-20"
                placeholder="Qty"
              />
            </div>

            {/* Manual list table */}
            {manualLines.length > 0 && (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead className="w-20">Qty</TableHead>
                      <TableHead className="w-24">Grade</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manualLines.map((line) => (
                      <TableRow key={line.key}>
                        <TableCell className="text-sm">
                          {line.device.make} {line.device.model}{" "}
                          <span className="text-muted-foreground">{line.device.storage}</span>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(e) => updateQuantity(line.key, e.target.value)}
                            className="h-8 w-16 text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <Select value={line.grade} onValueChange={(v) => updateGrade(line.key, v)}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {["A", "B", "C", "D", "E"].map((g) => (
                                <SelectItem key={g} value={g}>Grade {g}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeDevice(line.key)}>
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                  {manualLines.length} line{manualLines.length !== 1 ? "s" : ""}, {totalManualDevices} device{totalManualDevices !== 1 ? "s" : ""}
                </div>
              </div>
            )}

            {manualLines.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Search for a device above to add it to your list
              </p>
            )}
          </div>
        )}

        {/* Grade + Submit */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Default Grade:</span>
            <Select value={assumedGrade} onValueChange={setAssumedGrade}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["A", "B", "C", "D", "E"].map((g) => (
                  <SelectItem key={g} value={g}>Grade {g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1" />
          {deviceCount > 0 && (
            <Badge variant="secondary">{deviceCount} device{deviceCount !== 1 ? "s" : ""}</Badge>
          )}
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
            ) : (
              <><Plus className="mr-2 h-4 w-4" />Get Estimate</>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Prices shown will be at your partner rate ({100 - (partner.partnerRateDiscount ?? 5)}% of public consumer payout).
        </p>
      </div>
    </div>
  );
}
