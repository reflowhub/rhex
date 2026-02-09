"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Search,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Alias {
  id: string;
  alias: string;
  deviceId: string;
  deviceName: string | null;
  createdBy: string;
  createdAt: string | null;
}

interface Device {
  id: string;
  make: string;
  model: string;
  storage: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AliasesPage() {
  // Data state
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<Device[]>([]);

  // Search state
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [aliasInput, setAliasInput] = useState("");
  const [deviceQuery, setDeviceQuery] = useState("");
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteAlias, setDeleteAlias] = useState<Alias | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  // Fetch aliases
  const fetchAliases = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);

    const url = `/api/admin/aliases${params.toString() ? `?${params.toString()}` : ""}`;

    fetch(url)
      .then((res) => res.json())
      .then((data: Alias[]) => {
        if (Array.isArray(data)) setAliases(data);
      })
      .finally(() => setLoading(false));
  }, [debouncedSearch]);

  useEffect(() => {
    fetchAliases();
  }, [fetchAliases]);

  // Fetch devices for add dialog
  useEffect(() => {
    async function fetchDevices() {
      try {
        const res = await fetch("/api/devices");
        if (res.ok) setDevices(await res.json());
      } catch {
        /* ignore */
      }
    }
    fetchDevices();
  }, []);

  // Filtered devices for add dialog
  const filteredDevices = useMemo(() => {
    if (!deviceQuery.trim()) return [];
    const words = deviceQuery.toLowerCase().split(/\s+/).filter(Boolean);
    return devices
      .filter((d) => {
        const hay = `${d.make} ${d.model} ${d.storage}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .slice(0, 8);
  }, [devices, deviceQuery]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(aliases.length / PAGE_SIZE));
  const paginatedAliases = aliases.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const formatDate = (iso: string | null) => {
    if (!iso) return "\u2014";
    return new Date(iso).toLocaleDateString("en-NZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Add alias
  const handleAdd = async () => {
    if (!aliasInput.trim() || !selectedDevice) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alias: aliasInput.trim(),
          deviceId: selectedDevice.id,
        }),
      });
      if (res.ok) {
        setAddOpen(false);
        setAliasInput("");
        setDeviceQuery("");
        setSelectedDevice(null);
        fetchAliases();
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Delete alias
  const handleDelete = async () => {
    if (!deleteAlias) return;
    setDeleteLoading(true);
    try {
      // Use a direct Firestore delete via a simple endpoint
      // For now we use the aliases endpoint pattern
      const res = await fetch(`/api/admin/aliases?deleteId=${deleteAlias.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteOpen(false);
        setDeleteAlias(null);
        fetchAliases();
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Device Aliases</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? "Loading aliases..."
              : `${aliases.length} alias${aliases.length !== 1 ? "es" : ""} found`}
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Alias
        </Button>
      </div>

      {/* Search */}
      <div className="mt-6 flex max-w-sm items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search aliases or devices..."
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
              Loading aliases...
            </span>
          </div>
        ) : aliases.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            {debouncedSearch
              ? "No aliases match your search."
              : "No aliases yet. They get created when you resolve unmatched devices."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alias</TableHead>
                <TableHead>Matched Device</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedAliases.map((alias) => (
                <TableRow key={alias.id}>
                  <TableCell className="font-mono text-sm">
                    {alias.alias}
                  </TableCell>
                  <TableCell>
                    {alias.deviceName || (
                      <span className="text-muted-foreground italic">
                        Unknown
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{alias.createdBy}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(alias.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setDeleteAlias(alias);
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {!loading && aliases.length > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}&ndash;
            {Math.min(currentPage * PAGE_SIZE, aliases.length)} of{" "}
            {aliases.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Previous page</span>
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage >= totalPages}
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
            >
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Next page</span>
            </Button>
          </div>
        </div>
      )}

      {/* Add Alias Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Device Alias</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Alias Text</Label>
              <Input
                placeholder='e.g. "IPH1164G" or "iPhone 11 64"'
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The raw text that should map to the device below
              </p>
            </div>

            <div className="grid gap-2">
              <Label>Target Device</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search devices..."
                  value={deviceQuery}
                  onChange={(e) => {
                    setDeviceQuery(e.target.value);
                    setSelectedDevice(null);
                  }}
                  className="pl-9"
                />
              </div>

              {selectedDevice && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                  <span className="text-sm font-medium">
                    {selectedDevice.make} {selectedDevice.model}
                  </span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {selectedDevice.storage}
                  </Badge>
                </div>
              )}

              {!selectedDevice && filteredDevices.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-md border">
                  {filteredDevices.map((device) => (
                    <button
                      key={device.id}
                      onClick={() => {
                        setSelectedDevice(device);
                        setDeviceQuery(
                          `${device.make} ${device.model} ${device.storage}`
                        );
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <span>
                        <span className="font-medium">{device.make}</span>{" "}
                        {device.model}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {device.storage}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddOpen(false);
                setAliasInput("");
                setDeviceQuery("");
                setSelectedDevice(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!aliasInput.trim() || !selectedDevice || submitting}
            >
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add Alias
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Alias</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete the alias{" "}
            <span className="font-mono font-semibold">
              {deleteAlias?.alias}
            </span>
            ? Future imports will no longer auto-match this text.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading && (
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
