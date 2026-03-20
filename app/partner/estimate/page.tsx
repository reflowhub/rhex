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
  X,
  Loader2,
  AlertCircle,
  ArrowRight,
  Download,
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

interface CategoryGrade {
  key: string;
  label: string;
}

interface CategoryInfo {
  name: string;
  grades: CategoryGrade[];
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
  const [lineCounter, setLineCounter] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Category state
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("Phone");

  // Config
  const [assumedGrade, setAssumedGrade] = useState("C");

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive grades from selected category
  const categoryGrades = useMemo(() => {
    const cat = categories.find((c) => c.name === selectedCategory);
    return cat?.grades ?? [
      { key: "A", label: "Excellent" },
      { key: "B", label: "Good" },
      { key: "C", label: "Fair" },
      { key: "D", label: "Screen Issues" },
      { key: "E", label: "No Power" },
    ];
  }, [categories, selectedCategory]);

  // Fetch categories
  useEffect(() => {
    fetch("/api/categories")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: CategoryInfo[]) => {
        setCategories(data);
        if (data.length > 0 && !data.find((c) => c.name === selectedCategory)) {
          setSelectedCategory(data[0].name);
        }
      })
      .catch(() => {});
  }, []);

  // Reset grade when category changes
  useEffect(() => {
    const midIndex = Math.floor(categoryGrades.length / 2);
    setAssumedGrade(categoryGrades[midIndex]?.key ?? "C");
    setDevices([]);
  }, [selectedCategory]);

  // Redirect if not Mode B
  useEffect(() => {
    if (!partnerLoading && partner && !partner.modes.includes("B")) {
      router.push("/partner/dashboard");
    }
  }, [partner, partnerLoading, router]);

  // Fetch devices for manual mode (filtered by category)
  useEffect(() => {
    if (inputMode === "manual" && devices.length === 0) {
      setDevicesLoading(true);
      fetch(`/api/devices?category=${encodeURIComponent(selectedCategory)}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setDevices(data))
        .catch(() => {})
        .finally(() => setDevicesLoading(false));
    }
  }, [inputMode, devices.length, selectedCategory]);

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
    setManualLines((prev) => [
      ...prev,
      { key: lineCounter, device, quantity: 1, grade: assumedGrade },
    ]);
    setLineCounter((c) => c + 1);
    setSearchQuery("");
    setSearchOpen(false);
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
    if (inputMode === "upload" && !csvContent) return;
    if (inputMode === "manual" && manualLines.length === 0) return;

    setSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = { assumedGrade, category: selectedCategory };

      if (inputMode === "manual") {
        payload.devices = manualLines.map((l) => ({
          deviceId: l.device.id,
          deviceName: `${l.device.make} ${l.device.model} ${l.device.storage}`,
          quantity: l.quantity,
          grade: l.grade,
        }));
      } else {
        payload.csv = csvContent;
      }

      const res = await fetch("/api/partner/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
        {/* Category tabs */}
        {categories.length > 1 && (
          <div className="flex rounded-lg border bg-background p-1">
            {categories.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  selectedCategory === cat.name
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Assumed grade */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">Assumed Grade</label>
          <Select value={assumedGrade} onValueChange={setAssumedGrade}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categoryGrades.map((g) => (
                <SelectItem key={g.key} value={g.key}>
                  {g.key} — {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            Used for indicative pricing. Actual prices determined after inspection.
          </span>
        </div>

        {/* Input mode tabs */}
        <div className="flex rounded-lg border bg-background p-1">
          <button
            onClick={() => setInputMode("upload")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              inputMode === "upload" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileUp className="h-4 w-4" />
            Upload File
          </button>
          <button
            onClick={() => setInputMode("manual")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              inputMode === "manual" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="h-4 w-4" />
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
                <a
                  href="/bulk-estimate-template.csv"
                  download
                  onClick={(e) => e.stopPropagation()}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download CSV template
                </a>
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
          <div className="space-y-4">
            {/* Search */}
            <div className="rounded-lg border bg-card p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                  onFocus={() => searchQuery.trim() && setSearchOpen(true)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={devicesLoading ? "Loading devices..." : "Search e.g. iPhone 15 128GB"}
                  disabled={devicesLoading}
                  className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  autoComplete="off"
                />
                {devicesLoading && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
                {searchOpen && searchQuery.trim() && !devicesLoading && (
                  <ul ref={listRef} className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
                    {filtered.length === 0 ? (
                      <li className="px-3 py-6 text-center text-sm text-muted-foreground">No devices found</li>
                    ) : (
                      filtered.map((d, i) => (
                        <li
                          key={d.id}
                          onMouseDown={(e) => { e.preventDefault(); addDevice(d); }}
                          onMouseEnter={() => setHighlightIndex(i)}
                          className={cn("flex cursor-pointer items-center justify-between rounded-sm px-3 py-2.5 text-sm", i === highlightIndex && "bg-accent text-accent-foreground")}
                        >
                          <span><span className="font-medium">{d.make}</span> {d.model}</span>
                          <span className="ml-2 shrink-0 text-xs text-muted-foreground">{d.storage}</span>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </div>

            {/* Device list */}
            {manualLines.length > 0 ? (
              <div className="rounded-lg border bg-card overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead className="w-28">Storage</TableHead>
                      <TableHead className="w-28">Grade</TableHead>
                      <TableHead className="w-24 text-center">Qty</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manualLines.map((line, i) => (
                      <TableRow key={line.key}>
                        <TableCell className="text-muted-foreground">
                          {i + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {line.device.make} {line.device.model}
                        </TableCell>
                        <TableCell>{line.device.storage}</TableCell>
                        <TableCell>
                          <Select value={line.grade} onValueChange={(v) => updateGrade(line.key, v)}>
                            <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {categoryGrades.map((g) => (
                                <SelectItem key={g.key} value={g.key}>{g.key}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={(e) => updateQuantity(line.key, e.target.value)}
                            className="h-8 w-20 text-center mx-auto"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => removeDevice(line.key)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="border-t px-4 py-2.5 text-sm text-muted-foreground">
                  {manualLines.length} line{manualLines.length !== 1 ? "s" : ""},{" "}
                  {totalManualDevices} device{totalManualDevices !== 1 ? "s" : ""} total
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center">
                <Search className="mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Search and add devices above to build your list
                </p>
              </div>
            )}
          </div>
        )}

        {/* Submit button */}
        {canSubmit && (
          <div className="flex justify-end">
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
                : `Generate Estimate (${deviceCount} device${deviceCount !== 1 ? "s" : ""})`}
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
