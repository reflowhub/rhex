"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ImagePlus,
  X,
} from "lucide-react";
import { escapeCsvField, downloadCsv } from "@/lib/csv-export";
import { auth, storage } from "@/lib/firebase";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Device {
  id: string;
  deviceId?: number | string;
  make: string;
  model: string;
  storage: string;
  active?: boolean;
  category?: string;
  heroImage?: string | null;
}

interface DeviceFormData {
  make: string;
  model: string;
  storage: string;
}

interface CategoryInfo {
  name: string;
  grades: { key: string; label: string }[];
  activePriceList: string | null;
}

const EMPTY_FORM: DeviceFormData = { make: "", model: "", storage: "" };

const PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function waitForAuth(): Promise<import("firebase/auth").User> {
  return new Promise((resolve, reject) => {
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error("Firebase auth timed out"));
    }, 10_000);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      clearTimeout(timeout);
      unsubscribe();
      if (user) resolve(user);
      else reject(new Error("Not authenticated with Firebase"));
    });
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DeviceLibraryPage() {
  // ---- category state -----------------------------------------------------
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("Phone");

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
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState<DeviceFormData>(EMPTY_FORM);
  const [activeDevice, setActiveDevice] = useState<Device | null>(null);

  // ---- hero image state ---------------------------------------------------
  const [uploadingHeroId, setUploadingHeroId] = useState<string | null>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);
  const heroTargetDeviceRef = useRef<Device | null>(null);

  // ---- fetch categories on mount ------------------------------------------
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
        // Fallback — at least show Phone tab
        setCategories([
          { name: "Phone", grades: [], activePriceList: null },
        ]);
      });
  }, []);

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
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    params.set("category", selectedCategory);
    fetch(`/api/admin/devices?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setDevices(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [searchTerm, selectedCategory]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // ---- category tab change ------------------------------------------------
  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setSearchInput("");
    setSearchTerm("");
    setCurrentPage(1);
  };

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
    setFormError(null);
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!isFormValid) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, category: selectedCategory }),
      });
      if (res.ok) {
        setAddOpen(false);
        fetchDevices();
      } else {
        const data = await res.json();
        setFormError(data.error || "Failed to create device");
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
    setFormError(null);
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!isFormValid || !activeDevice) return;
    setSubmitting(true);
    setFormError(null);
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
      } else {
        const data = await res.json();
        setFormError(data.error || "Failed to update device");
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

  // ---- toggle active ------------------------------------------------------
  const handleToggleActive = async (device: Device) => {
    const newActive = device.active === false;
    // Optimistic update
    setDevices((prev) =>
      prev.map((d) => (d.id === device.id ? { ...d, active: newActive } : d))
    );
    try {
      const res = await fetch(`/api/admin/devices/${device.id}/toggle`, {
        method: "PATCH",
      });
      if (!res.ok) {
        // Rollback on failure
        setDevices((prev) =>
          prev.map((d) =>
            d.id === device.id ? { ...d, active: device.active } : d
          )
        );
      }
    } catch {
      // Rollback on failure
      setDevices((prev) =>
        prev.map((d) =>
          d.id === device.id ? { ...d, active: device.active } : d
        )
      );
    }
  };

  // ---- hero image upload --------------------------------------------------
  const triggerHeroUpload = (device: Device) => {
    heroTargetDeviceRef.current = device;
    heroInputRef.current?.click();
  };

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const device = heroTargetDeviceRef.current;
    if (!device || !e.target.files?.length) return;
    const file = e.target.files[0];

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      alert("Only JPEG, PNG, and WebP images are allowed.");
      e.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("Image must be under 10 MB.");
      e.target.value = "";
      return;
    }

    setUploadingHeroId(device.id);

    try {
      await waitForAuth();

      // Delete old hero image from storage if it exists
      if (device.heroImage) {
        try {
          await deleteObject(ref(storage, device.heroImage));
        } catch {
          // Old file may already be deleted
        }
      }

      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `devices/${device.id}/hero_${timestamp}_${safeName}`;
      const storageRef = ref(storage, storagePath);

      const url = await new Promise<string>((resolve, reject) => {
        const task = uploadBytesResumable(storageRef, file);
        task.on("state_changed", null, reject, async () => {
          try {
            resolve(await getDownloadURL(task.snapshot.ref));
          } catch (err) {
            reject(err);
          }
        });
      });

      const res = await fetch(`/api/admin/devices/${device.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroImage: url }),
      });

      if (res.ok) {
        setDevices((prev) =>
          prev.map((d) => (d.id === device.id ? { ...d, heroImage: url } : d))
        );
      }
    } catch (err) {
      console.error("Hero image upload failed:", err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploadingHeroId(null);
      e.target.value = "";
    }
  };

  const handleHeroDelete = async (device: Device) => {
    if (!device.heroImage) return;
    if (!confirm("Remove hero image?")) return;

    try {
      try {
        await waitForAuth();
        await deleteObject(ref(storage, device.heroImage));
      } catch {
        // Storage object may already be deleted
      }

      const res = await fetch(`/api/admin/devices/${device.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroImage: null }),
      });

      if (res.ok) {
        setDevices((prev) =>
          prev.map((d) =>
            d.id === device.id ? { ...d, heroImage: null } : d
          )
        );
      }
    } catch (err) {
      console.error("Hero image delete failed:", err);
    }
  };

  // ---- export CSV ---------------------------------------------------------
  const handleExport = () => {
    const header = "DeviceID,Make,Model,Storage,Active";
    const rows = devices.map(
      (d) =>
        `${d.id},${escapeCsvField(d.make)},${escapeCsvField(d.model)},${escapeCsvField(d.storage)},${d.active !== false}`
    );
    const csv = [header, ...rows].join("\n");
    downloadCsv(csv, `devices-${selectedCategory.toLowerCase()}.csv`);
  };

  // ---- render -------------------------------------------------------------
  return (
    <div>
      {/* Hidden file input for hero image uploads */}
      <input
        ref={heroInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleHeroUpload}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Device Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the master list of supported trade-in devices.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} disabled={devices.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/admin/devices/import?category=${encodeURIComponent(selectedCategory)}`}>
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

      {/* Category Tabs */}
      {categories.length > 1 && (
        <div className="mt-6 flex gap-1 border-b border-border">
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => handleCategoryChange(cat.name)}
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
              : `No ${selectedCategory.toLowerCase()} devices found. Add your first device to get started.`}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Image</TableHead>
                  <TableHead className="w-[140px]">Device ID</TableHead>
                  <TableHead>Make</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead className="w-[80px] text-center">Active</TableHead>
                  <TableHead className="w-[120px] text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDevices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell>
                      <div className="relative h-8 w-8">
                        {uploadingHeroId === device.id ? (
                          <div className="flex h-8 w-8 items-center justify-center rounded border border-border bg-muted">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : device.heroImage ? (
                          <div className="group relative">
                            <img
                              src={device.heroImage}
                              alt=""
                              className="h-8 w-8 cursor-pointer rounded border border-border object-contain"
                              onClick={() => triggerHeroUpload(device)}
                              title="Click to replace"
                            />
                            <button
                              onClick={() => handleHeroDelete(device)}
                              className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover:flex"
                              title="Remove image"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => triggerHeroUpload(device)}
                            className="flex h-8 w-8 items-center justify-center rounded border border-dashed border-border text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
                            title="Upload hero image"
                          >
                            <ImagePlus className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {device.deviceId ?? device.id}
                    </TableCell>
                    <TableCell className="font-medium">{device.make}</TableCell>
                    <TableCell>{device.model}</TableCell>
                    <TableCell>{device.storage}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={device.active !== false}
                        onCheckedChange={() => handleToggleActive(device)}
                      />
                    </TableCell>
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
            <DialogTitle>Add {selectedCategory} Device</DialogTitle>
            <DialogDescription>
              Add a new {selectedCategory.toLowerCase()} device to the trade-in library.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {formError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {formError}
              </div>
            )}
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
            {formError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {formError}
              </div>
            )}
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
