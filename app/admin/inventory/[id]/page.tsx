"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Loader2,
  Smartphone,
  DollarSign,
  Package,
  MapPin,
  Pencil,
  ImageIcon,
  Upload,
  Video,
  Trash2,
  X,
} from "lucide-react";
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

interface InventoryItem {
  id: string;
  inventoryId: number;
  deviceRef: string;
  device: { id: string; make: string; model: string; storage: string } | null;
  category: string;
  serial: string;
  sourceType: string;
  sourceQuoteId: string | null;
  sourceQuote: {
    id: string;
    customerName: string | null;
    status: string;
    grade: string | null;
    quotePriceNZD: number | null;
  } | null;
  acquiredAt: string | null;
  costNZD: number | null;
  costAUD: number | null;
  sourceName: string | null;
  cosmeticGrade: string;
  batteryHealth: number | null;
  notes: string;
  sellPriceAUD: number;
  sellPriceNZD: number | null;
  status: string;
  listed: boolean;
  images: string[];
  spinVideo: string | null;
  location: string | null;
  returnReason: string | null;
  returnedFromOrderId: string | null;
  returnedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INVENTORY_STATUSES = [
  "received",
  "inspecting",
  "refurbishing",
  "listed",
  "reserved",
  "sold",
  "parts_only",
];

const GRADES = ["A", "B", "C", "D", "E"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadgeProps(status: string): {
  variant: "default" | "secondary" | "outline" | "destructive";
  className?: string;
} {
  switch (status) {
    case "received":
      return { variant: "secondary" };
    case "inspecting":
      return { variant: "outline" };
    case "refurbishing":
      return {
        variant: "outline",
        className: "bg-amber-100 text-amber-800 border-amber-200",
      };
    case "listed":
      return {
        variant: "default",
        className:
          "border-transparent bg-blue-600 text-white hover:bg-blue-600/80",
      };
    case "reserved":
      return {
        variant: "default",
        className:
          "border-transparent bg-purple-600 text-white hover:bg-purple-600/80",
      };
    case "sold":
      return {
        variant: "default",
        className:
          "border-transparent bg-emerald-600 text-white hover:bg-emerald-600/80",
      };
    case "parts_only":
      return { variant: "destructive" };
    default:
      return { variant: "outline" };
  }
}

function formatDate(iso: string | undefined | null): string {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleDateString("en-NZ", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

// ---------------------------------------------------------------------------
// Firebase auth helper — waits for auth state to restore after page refresh
// ---------------------------------------------------------------------------

function waitForAuth(): Promise<import("firebase/auth").User> {
  return new Promise((resolve, reject) => {
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (user) resolve(user);
      else reject(new Error("Not authenticated with Firebase"));
    });
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InventoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // ---- data state ---------------------------------------------------------
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- edit dialog state --------------------------------------------------
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState({
    status: "",
    cosmeticGrade: "",
    costAUD: "",
    sellPriceAUD: "",
    batteryHealth: "",
    location: "",
    listed: false,
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ---- image upload state -------------------------------------------------
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ---- spin video upload state --------------------------------------------
  const [spinUploading, setSpinUploading] = useState(false);
  const [spinProgress, setSpinProgress] = useState(0);
  const [spinError, setSpinError] = useState<string | null>(null);

  // ---- fetch item ---------------------------------------------------------
  const fetchItem = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/inventory/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Inventory item not found");
        return res.json();
      })
      .then((data: InventoryItem) => setItem(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  // ---- open edit dialog ---------------------------------------------------
  const openEdit = () => {
    if (!item) return;
    setEditData({
      status: item.status,
      cosmeticGrade: item.cosmeticGrade,
      costAUD: item.costAUD != null ? String(item.costAUD) : "",
      sellPriceAUD: String(item.sellPriceAUD),
      batteryHealth:
        item.batteryHealth != null ? String(item.batteryHealth) : "",
      location: item.location ?? "",
      listed: item.listed,
      notes: item.notes,
    });
    setFormError(null);
    setEditOpen(true);
  };

  // ---- submit edit --------------------------------------------------------
  const handleSave = async () => {
    if (!item) return;
    setSubmitting(true);
    setFormError(null);

    const body: Record<string, unknown> = {
      status: editData.status,
      cosmeticGrade: editData.cosmeticGrade,
      sellPriceAUD: parseFloat(editData.sellPriceAUD),
      listed: editData.listed,
      notes: editData.notes,
    };

    if (editData.costAUD) {
      body.costAUD = parseFloat(editData.costAUD);
    }
    if (editData.batteryHealth) {
      body.batteryHealth = parseInt(editData.batteryHealth, 10);
    }
    if (editData.location) {
      body.location = editData.location;
    }

    try {
      const res = await fetch(`/api/admin/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setEditOpen(false);
        fetchItem();
      } else {
        const data = await res.json();
        setFormError(data.error || "Failed to update");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ---- helpers ------------------------------------------------------------
  const formatPrice = (amount: number | null | undefined) => {
    if (amount == null) return "\u2014";
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(amount);
  };

  // ---- upload images ------------------------------------------------------
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!item || !e.target.files?.length) return;

    const files = Array.from(e.target.files);

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const invalidFiles = files.filter((f) => !allowedTypes.includes(f.type));
    if (invalidFiles.length > 0) {
      setUploadError("Only JPEG, PNG, and WebP images are allowed.");
      return;
    }

    const oversizedFiles = files.filter((f) => f.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setUploadError("Each image must be under 10 MB.");
      return;
    }

    setUploadError(null);
    setUploading(true);
    setUploadProgress({});

    try {
      await waitForAuth();
      const newUrls: string[] = [];

      for (const file of files) {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `inventory/${item.id}/images/${timestamp}_${safeName}`;
        const storageRef = ref(storage, storagePath);

        const url = await new Promise<string>((resolve, reject) => {
          const task = uploadBytesResumable(storageRef, file);
          task.on(
            "state_changed",
            (snap) => {
              setUploadProgress((prev) => ({
                ...prev,
                [file.name]: Math.round(
                  (snap.bytesTransferred / snap.totalBytes) * 100
                ),
              }));
            },
            reject,
            async () => {
              resolve(await getDownloadURL(task.snapshot.ref));
            }
          );
        });
        newUrls.push(url);
      }

      const updatedImages = [...item.images, ...newUrls];
      const res = await fetch(`/api/admin/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: updatedImages }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save images");
      }
      fetchItem();
    } catch (err) {
      console.error("Image upload failed:", err);
      setUploadError(
        err instanceof Error ? err.message : "Upload failed. Please try again."
      );
    } finally {
      setUploading(false);
      setUploadProgress({});
      e.target.value = "";
    }
  };

  // ---- delete image -------------------------------------------------------
  const handleImageDelete = async (imageUrl: string, index: number) => {
    if (!item) return;
    if (!confirm("Delete this image?")) return;

    try {
      try {
        await waitForAuth();
        await deleteObject(ref(storage, imageUrl));
      } catch {
        // Storage object may already be deleted — still remove from Firestore
      }

      const updatedImages = item.images.filter((_, i) => i !== index);
      const res = await fetch(`/api/admin/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: updatedImages }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove image");
      }
      fetchItem();
    } catch (err) {
      console.error("Image delete failed:", err);
      setUploadError(
        err instanceof Error ? err.message : "Failed to delete image."
      );
    }
  };

  // ---- upload spin video --------------------------------------------------
  const handleSpinUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!item || !e.target.files?.length) return;
    const file = e.target.files[0];

    if (!file.type.startsWith("video/")) {
      setSpinError("Please select a video file.");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setSpinError("Video must be under 100 MB.");
      return;
    }

    setSpinError(null);
    setSpinUploading(true);
    setSpinProgress(0);

    try {
      await waitForAuth();
      const storagePath = `inventory/${item.id}/spin.mp4`;
      const storageRef = ref(storage, storagePath);

      const url = await new Promise<string>((resolve, reject) => {
        const task = uploadBytesResumable(storageRef, file);
        task.on(
          "state_changed",
          (snap) => {
            setSpinProgress(
              Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
            );
          },
          reject,
          async () => {
            resolve(await getDownloadURL(task.snapshot.ref));
          }
        );
      });

      const res = await fetch(`/api/admin/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spinVideo: url }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save video");
      }
      fetchItem();
    } catch (err) {
      console.error("Spin video upload failed:", err);
      setSpinError(
        err instanceof Error ? err.message : "Upload failed. Please try again."
      );
    } finally {
      setSpinUploading(false);
      setSpinProgress(0);
      e.target.value = "";
    }
  };

  // ---- delete spin video --------------------------------------------------
  const handleSpinDelete = async () => {
    if (!item?.spinVideo) return;
    if (!confirm("Delete the spin video?")) return;

    try {
      try {
        await waitForAuth();
        await deleteObject(ref(storage, item.spinVideo));
      } catch {
        // Storage object may already be deleted
      }

      const res = await fetch(`/api/admin/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spinVideo: null }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove video");
      }
      fetchItem();
    } catch (err) {
      console.error("Spin video delete failed:", err);
      setSpinError(
        err instanceof Error ? err.message : "Failed to delete video."
      );
    }
  };

  // ---- render: loading ----------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading inventory item...
        </span>
      </div>
    );
  }

  // ---- render: error / not found ------------------------------------------
  if (error || !item) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground">
          {error ?? "Inventory item not found."}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/admin/inventory")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Inventory
        </Button>
      </div>
    );
  }

  const badgeProps = statusBadgeProps(item.status);
  const cost = item.costAUD ?? item.costNZD ?? 0;
  const costLabel = "Cost (AUD, ex. GST)";
  const margin = item.sellPriceAUD - cost;
  const marginPercent =
    cost > 0 ? ((margin / cost) * 100).toFixed(0) : "\u2014";

  const sourceTypeLabel: Record<string, string> = {
    "trade-in": "Trade-in",
    bulk: "Bulk Quote",
    "direct-purchase": "Direct Purchase",
    manual: "Manual Entry",
    return: "Customer Return",
  };

  // ---- render: main -------------------------------------------------------
  return (
    <div>
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => router.push("/admin/inventory")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Inventory
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            Inventory #{item.inventoryId}
          </h1>
          <Badge variant={badgeProps.variant} className={badgeProps.className}>
            {formatStatus(item.status)}
          </Badge>
        </div>
        <Button variant="outline" onClick={openEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </div>

      {/* Two-column grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Device Information card */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Device Information</h2>
          </div>

          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Device</dt>
              <dd className="font-medium text-right">
                {item.device
                  ? `${item.device.make} ${item.device.model}`
                  : "\u2014"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Storage</dt>
              <dd className="font-medium">
                {item.device?.storage ?? "\u2014"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Category</dt>
              <dd className="font-medium">{item.category}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Serial / IMEI</dt>
              <dd className="font-mono text-xs">{item.serial}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Grade</dt>
              <dd>
                <Badge variant="outline">{item.cosmeticGrade}</Badge>
              </dd>
            </div>
          </dl>
        </div>

        {/* Financial card */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Financial</h2>
          </div>

          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{costLabel}</dt>
              <dd className="font-medium">{formatPrice(cost)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Sell Price (AUD, inc. GST)</dt>
              <dd className="font-medium">{formatPrice(item.sellPriceAUD)}</dd>
            </div>
            <div className="my-1 h-px bg-border" />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Margin</dt>
              <dd
                className={cn(
                  "font-medium",
                  margin > 0
                    ? "text-emerald-600"
                    : margin < 0
                    ? "text-destructive"
                    : ""
                )}
              >
                {formatPrice(margin)} ({marginPercent}%)
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Source card */}
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Package className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Source</h2>
        </div>

        <dl className="grid gap-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Source Type</dt>
            <dd>
              <Badge variant="secondary">
                {sourceTypeLabel[item.sourceType] ?? item.sourceType}
              </Badge>
            </dd>
          </div>
          {item.sourceName && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Supplier</dt>
              <dd className="font-medium">{item.sourceName}</dd>
            </div>
          )}
          {item.sourceQuoteId && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Source Quote</dt>
              <dd>
                <button
                  onClick={() => {
                    const path =
                      item.sourceType === "bulk"
                        ? `/admin/bulk-quotes/${item.sourceQuoteId}`
                        : `/admin/quotes/${item.sourceQuoteId}`;
                    router.push(path);
                  }}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {item.sourceQuoteId.substring(0, 8)}...
                </button>
                {item.sourceQuote?.customerName && (
                  <span className="ml-2 text-muted-foreground">
                    ({item.sourceQuote.customerName})
                  </span>
                )}
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Acquired</dt>
            <dd>{formatDate(item.acquiredAt)}</dd>
          </div>
          {item.returnedAt && (
            <>
              <div className="my-1 h-px bg-border" />
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Returned</dt>
                <dd>{formatDate(item.returnedAt)}</dd>
              </div>
              {item.returnReason && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Return Reason</dt>
                  <dd className="font-medium">{item.returnReason}</dd>
                </div>
              )}
              {item.returnedFromOrderId && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">From Order</dt>
                  <dd>
                    <button
                      onClick={() =>
                        router.push(
                          `/admin/orders/${item.returnedFromOrderId}`
                        )
                      }
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {item.returnedFromOrderId.substring(0, 8)}...
                    </button>
                  </dd>
                </div>
              )}
            </>
          )}
        </dl>
      </div>

      {/* Condition & Location card */}
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Condition & Location</h2>
        </div>

        <dl className="grid gap-3 text-sm">
          {item.batteryHealth != null && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Battery Health</dt>
              <dd className="font-medium">{item.batteryHealth}%</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Location</dt>
            <dd className="font-medium">{item.location || "\u2014"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Listed</dt>
            <dd>
              <Badge variant={item.listed ? "default" : "secondary"}>
                {item.listed ? "Yes" : "No"}
              </Badge>
            </dd>
          </div>
          {item.notes && (
            <>
              <div className="my-1 h-px bg-border" />
              <div>
                <dt className="text-muted-foreground mb-1">Notes</dt>
                <dd className="whitespace-pre-wrap text-sm">{item.notes}</dd>
              </div>
            </>
          )}
        </dl>
      </div>

      {/* Images card */}
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Images</h2>
            {item.images.length > 0 && (
              <span className="text-sm text-muted-foreground">
                ({item.images.length})
              </span>
            )}
          </div>
          <label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleImageUpload}
              disabled={uploading}
            />
            <Button variant="outline" size="sm" disabled={uploading} asChild>
              <span>
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? "Uploading\u2026" : "Upload Images"}
              </span>
            </Button>
          </label>
        </div>

        {uploadError && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {uploadError}
          </div>
        )}

        {uploading && Object.keys(uploadProgress).length > 0 && (
          <div className="mb-4 space-y-2">
            {Object.entries(uploadProgress).map(([fileName, progress]) => (
              <div key={fileName} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="max-w-[200px] truncate">{fileName}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {item.images.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {item.images.map((imageUrl, index) => (
              <div
                key={index}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-background"
              >
                <img
                  src={imageUrl}
                  alt={`Image ${index + 1}`}
                  className="h-full w-full object-contain"
                />
                <button
                  onClick={() => handleImageDelete(imageUrl, index)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
                  title="Delete image"
                >
                  <X className="h-4 w-4" />
                </button>
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                  {index + 1}
                </span>
              </div>
            ))}
          </div>
        ) : (
          !uploading && (
            <p className="text-sm text-muted-foreground">
              No images uploaded yet. Click &ldquo;Upload Images&rdquo; to add
              photos.
            </p>
          )
        )}
      </div>

      {/* Spin Video card */}
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">360° Spin Video</h2>
          </div>
          {!item.spinVideo && (
            <label>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleSpinUpload}
                disabled={spinUploading}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={spinUploading}
                asChild
              >
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  {spinUploading ? "Uploading\u2026" : "Upload Video"}
                </span>
              </Button>
            </label>
          )}
        </div>

        {spinError && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {spinError}
          </div>
        )}

        {spinUploading && (
          <div className="mb-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Uploading video\u2026</span>
              <span>{spinProgress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${spinProgress}%` }}
              />
            </div>
          </div>
        )}

        {item.spinVideo ? (
          <div className="space-y-3">
            <div className="aspect-video w-full max-w-md overflow-hidden rounded-lg border border-border bg-background">
              <video
                src={item.spinVideo}
                controls
                muted
                loop
                playsInline
                className="h-full w-full object-contain"
              />
            </div>
            <div className="flex gap-2">
              <label>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleSpinUpload}
                  disabled={spinUploading}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={spinUploading}
                  asChild
                >
                  <span>Replace</span>
                </Button>
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSpinDelete}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        ) : (
          !spinUploading && (
            <p className="text-sm text-muted-foreground">
              No spin video uploaded. Upload a 360° video for the product page.
            </p>
          )
        )}
      </div>

      {/* Timestamps */}
      <div className="mt-6 flex gap-6 text-xs text-muted-foreground">
        <span>Created: {formatDate(item.createdAt)}</span>
        <span>Updated: {formatDate(item.updatedAt)}</span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Edit Dialog                                                         */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Inventory Item</DialogTitle>
            <DialogDescription>
              Update details for Inventory #{item.inventoryId}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {formError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {formError}
              </div>
            )}

            {/* Status */}
            <div className="grid gap-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={editData.status}
                onValueChange={(val) =>
                  setEditData((prev) => ({ ...prev, status: val }))
                }
              >
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVENTORY_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {formatStatus(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Grade */}
            <div className="grid gap-2">
              <Label htmlFor="edit-grade">Grade</Label>
              <Select
                value={editData.cosmeticGrade}
                onValueChange={(val) =>
                  setEditData((prev) => ({ ...prev, cosmeticGrade: val }))
                }
              >
                <SelectTrigger id="edit-grade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={g}>
                      Grade {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cost AUD */}
            <div className="grid gap-2">
              <Label htmlFor="edit-cost-aud">Cost (AUD, ex. GST)</Label>
              <Input
                id="edit-cost-aud"
                type="number"
                min="0"
                step="0.01"
                value={editData.costAUD}
                onChange={(e) =>
                  setEditData((prev) => ({
                    ...prev,
                    costAUD: e.target.value,
                  }))
                }
              />
            </div>

            {/* Sell Price AUD */}
            <div className="grid gap-2">
              <Label htmlFor="edit-sell-price-aud">Sell Price (AUD, inc. GST)</Label>
              <Input
                id="edit-sell-price-aud"
                type="number"
                min="0"
                step="0.01"
                value={editData.sellPriceAUD}
                onChange={(e) =>
                  setEditData((prev) => ({
                    ...prev,
                    sellPriceAUD: e.target.value,
                  }))
                }
              />
            </div>

            {/* Battery Health */}
            <div className="grid gap-2">
              <Label htmlFor="edit-battery">Battery Health (%)</Label>
              <Input
                id="edit-battery"
                type="number"
                min="0"
                max="100"
                value={editData.batteryHealth}
                onChange={(e) =>
                  setEditData((prev) => ({
                    ...prev,
                    batteryHealth: e.target.value,
                  }))
                }
              />
            </div>

            {/* Location */}
            <div className="grid gap-2">
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                placeholder="e.g. Shelf A3"
                value={editData.location}
                onChange={(e) =>
                  setEditData((prev) => ({
                    ...prev,
                    location: e.target.value,
                  }))
                }
              />
            </div>

            {/* Listed toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-listed">Listed on storefront</Label>
              <Switch
                id="edit-listed"
                checked={editData.listed}
                onCheckedChange={(checked) =>
                  setEditData((prev) => ({ ...prev, listed: checked }))
                }
              />
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <textarea
                id="edit-notes"
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={editData.notes}
                onChange={(e) =>
                  setEditData((prev) => ({ ...prev, notes: e.target.value }))
                }
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
              onClick={handleSave}
              disabled={submitting || !editData.sellPriceAUD}
            >
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
