"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Search,
  Plus,
  Pencil,
  Trash2,
  Upload,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Device {
  id: string;
  make: string;
  model: string;
  storage: string;
}

interface DeviceFormData {
  make: string;
  model: string;
  storage: string;
}

const EMPTY_FORM: DeviceFormData = { make: "", model: "", storage: "" };

const PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DeviceLibraryPage() {
  // ---- data state ---------------------------------------------------------
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- search state -------------------------------------------------------
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // ---- pagination state ---------------------------------------------------
  const [currentPage, setCurrentPage] = useState(1);

  // ---- dialog state -------------------------------------------------------
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<DeviceFormData>(EMPTY_FORM);
  const [activeDevice, setActiveDevice] = useState<Device | null>(null);

  // ---- debounced search ---------------------------------------------------
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ---- fetch devices ------------------------------------------------------
  const fetchDevices = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/devices?search=" + encodeURIComponent(searchTerm))
      .then((res) => res.json())
      .then((data: Device[]) => setDevices(data))
      .finally(() => setLoading(false));
  }, [searchTerm]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // ---- pagination helpers -------------------------------------------------
  const totalPages = Math.max(1, Math.ceil(devices.length / PAGE_SIZE));
  const paginatedDevices = devices.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // ---- form helpers -------------------------------------------------------
  const handleFormChange = (field: keyof DeviceFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isFormValid =
    formData.make.trim() !== "" &&
    formData.model.trim() !== "" &&
    formData.storage.trim() !== "";

  // ---- add device ---------------------------------------------------------
  const openAddDialog = () => {
    setFormData(EMPTY_FORM);
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!isFormValid) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setAddOpen(false);
        fetchDevices();
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ---- edit device --------------------------------------------------------
  const openEditDialog = (device: Device) => {
    setActiveDevice(device);
    setFormData({
      make: device.make,
      model: device.model,
      storage: device.storage,
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!isFormValid || !activeDevice) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/devices/${activeDevice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setEditOpen(false);
        setActiveDevice(null);
        fetchDevices();
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ---- delete device ------------------------------------------------------
  const openDeleteDialog = (device: Device) => {
    setActiveDevice(device);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!activeDevice) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/devices/${activeDevice.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteOpen(false);
        setActiveDevice(null);
        fetchDevices();
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ---- render -------------------------------------------------------------
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Device Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the master list of supported trade-in devices.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/devices/import">
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Link>
          </Button>
          <Button onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Device
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mt-6 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by make, model, or storage..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <div className="mt-6 rounded-lg border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading devices...
            </span>
          </div>
        ) : paginatedDevices.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            {searchTerm
              ? "No devices match your search."
              : "No devices found. Add your first device to get started."}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Device ID</TableHead>
                  <TableHead>Make</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead className="w-[120px] text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDevices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {device.id}
                    </TableCell>
                    <TableCell className="font-medium">{device.make}</TableCell>
                    <TableCell>{device.model}</TableCell>
                    <TableCell>{device.storage}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(device)}
                          title="Edit device"
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(device)}
                          title="Delete device"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Showing{" "}
                  <span className="font-medium">
                    {(currentPage - 1) * PAGE_SIZE + 1}
                  </span>
                  {" - "}
                  <span className="font-medium">
                    {Math.min(currentPage * PAGE_SIZE, devices.length)}
                  </span>{" "}
                  of <span className="font-medium">{devices.length}</span>{" "}
                  devices
                </p>
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
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                  >
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Add Device Dialog                                                   */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Device</DialogTitle>
            <DialogDescription>
              Add a new device to the trade-in library.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="add-make">Make</Label>
              <Input
                id="add-make"
                placeholder="e.g. Apple"
                value={formData.make}
                onChange={(e) => handleFormChange("make", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-model">Model</Label>
              <Input
                id="add-model"
                placeholder="e.g. iPhone 15 Pro"
                value={formData.model}
                onChange={(e) => handleFormChange("model", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-storage">Storage</Label>
              <Input
                id="add-storage"
                placeholder="e.g. 256GB"
                value={formData.storage}
                onChange={(e) => handleFormChange("storage", e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!isFormValid || submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Edit Device Dialog                                                  */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Device</DialogTitle>
            <DialogDescription>
              Update the details for this device.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-make">Make</Label>
              <Input
                id="edit-make"
                placeholder="e.g. Apple"
                value={formData.make}
                onChange={(e) => handleFormChange("make", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-model">Model</Label>
              <Input
                id="edit-model"
                placeholder="e.g. iPhone 15 Pro"
                value={formData.model}
                onChange={(e) => handleFormChange("model", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-storage">Storage</Label>
              <Input
                id="edit-storage"
                placeholder="e.g. 256GB"
                value={formData.storage}
                onChange={(e) => handleFormChange("storage", e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={!isFormValid || submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
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
            <DialogTitle>Delete Device</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">
                {activeDevice
                  ? `${activeDevice.make} ${activeDevice.model} (${activeDevice.storage})`
                  : "this device"}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
