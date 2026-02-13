"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
import { ThemeToggle } from "@/components/theme-toggle";
import { useCurrency } from "@/lib/currency-context";
import { cn } from "@/lib/utils";
import { getReferralCode } from "@/lib/referral";
import {
  FileUp,
  Upload,
  X,
  Loader2,
  ArrowLeft,
  ArrowRight,
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

  // Input mode: "upload" or "manual"
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

  // Category state
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("Phone");

  // Config state
  const [assumedGrade, setAssumedGrade] = useState("C");

  // Submission state
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

  // Reset grade when category changes (pick middle grade)
  useEffect(() => {
    const midIndex = Math.floor(categoryGrades.length / 2);
    setAssumedGrade(categoryGrades[midIndex]?.key ?? "C");
    // Reset devices when category changes
    setDevices([]);
  }, [selectedCategory]);

  // Fetch device library for manual mode (filtered by category)
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

  // Filter devices for search
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

  useEffect(() => {
    setHighlightIndex(0);
  }, [filtered]);

  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[highlightIndex] as HTMLElement;
    item?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  // Add device to manual list
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

  // Build CSV from manual list
  const buildManualCSV = (): string => {
    const lines = ["Device,Quantity,Grade"];
    for (const line of manualLines) {
      const name = `${line.device.make} ${line.device.model} ${line.device.storage}`;
      lines.push(`"${name}",${line.quantity},${line.grade}`);
    }
    return lines.join("\n");
  };

  const totalManualDevices = manualLines.reduce(
    (sum, l) => sum + l.quantity,
    0
  );

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

  // Submit
  const handleSubmit = async () => {
    const csv = inputMode === "upload" ? csvContent : buildManualCSV();
    if (!csv) return;
    if (inputMode === "manual" && manualLines.length === 0) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/business/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csv,
          assumedGrade,
          category: selectedCategory,
          referralCode: getReferralCode(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create estimate");
        return;
      }

      const data = await res.json();
      router.push(`/sell/business/estimate/${data.id}`);
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

  const deviceCount =
    inputMode === "upload" ? totalRows : totalManualDevices;

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Link href="/sell" className="flex items-center gap-2.5">
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
            </Link>
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
            <Link href="/sell/business">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Get an Estimate
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload a manifest file or build your device list to get an instant
              estimate.
            </p>
          </div>
        </div>

        {/* Category tabs */}
        {categories.length > 1 && (
          <div className="mt-6 flex rounded-lg border bg-background p-1">
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

        {/* Grade selector */}
        <div className="mt-6 flex items-center gap-4">
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
            Used for indicative pricing. Actual prices determined after
            inspection.
          </span>
        </div>

        {/* Input mode tabs */}
        <div className="mt-8 flex rounded-lg border bg-background p-1">
          <button
            onClick={() => setInputMode("upload")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              inputMode === "upload"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileUp className="h-4 w-4" />
            Upload File
          </button>
          <button
            onClick={() => setInputMode("manual")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              inputMode === "manual"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="h-4 w-4" />
            Build List
          </button>
        </div>

        {/* Upload mode */}
        {inputMode === "upload" && (
          <div className="mt-6">
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
              </div>
            )}
          </div>
        )}

        {/* Manual build mode */}
        {inputMode === "manual" && (
          <div className="mt-6 space-y-4">
            {/* Add device row */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-end gap-3">
                {/* Device search */}
                <div className="relative flex-1">
                  <label className="mb-1.5 block text-sm font-medium">
                    Device
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSearchOpen(true);
                      }}
                      onFocus={() => searchQuery.trim() && setSearchOpen(true)}
                      onKeyDown={handleSearchKeyDown}
                      placeholder={
                        devicesLoading
                          ? "Loading devices..."
                          : "Search e.g. iPhone 15 128GB"
                      }
                      disabled={devicesLoading}
                      className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      autoComplete="off"
                    />
                    {devicesLoading && (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {/* Search dropdown */}
                  {searchOpen && searchQuery.trim() && !devicesLoading && (
                    <ul
                      ref={listRef}
                      className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
                    >
                      {filtered.length === 0 ? (
                        <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                          No devices found
                        </li>
                      ) : (
                        filtered.map((device, i) => (
                          <li
                            key={device.id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              addDevice(device);
                            }}
                            onMouseEnter={() => setHighlightIndex(i)}
                            className={cn(
                              "flex cursor-pointer items-center justify-between rounded-sm px-3 py-2.5 text-sm",
                              i === highlightIndex &&
                                "bg-accent text-accent-foreground"
                            )}
                          >
                            <span>
                              <span className="font-medium">
                                {device.make}
                              </span>{" "}
                              {device.model}
                            </span>
                            <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                              {device.storage}
                            </span>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>

                {/* Quantity */}
                <div className="w-24">
                  <label className="mb-1.5 block text-sm font-medium">
                    Qty
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={addQuantity}
                    onChange={(e) => setAddQuantity(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && filtered.length > 0) {
                        e.preventDefault();
                        addDevice(filtered[highlightIndex]);
                      }
                    }}
                    className="h-10"
                  />
                </div>
              </div>
            </div>

            {/* Device list */}
            {manualLines.length > 0 ? (
              <div className="rounded-lg border border-border bg-card overflow-x-auto">
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
                          <Select
                            value={line.grade}
                            onValueChange={(v) => updateGrade(line.key, v)}
                          >
                            <SelectTrigger className="h-8 w-24 text-xs">
                              <SelectValue />
                            </SelectTrigger>
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
                            onChange={(e) =>
                              updateQuantity(line.key, e.target.value)
                            }
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
                <Plus className="mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Search and add devices above to build your list
                </p>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Submit button */}
        {canSubmit && (
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
                : `Generate Estimate (${deviceCount} device${deviceCount !== 1 ? "s" : ""})`}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
