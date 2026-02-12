"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UpsellProduct {
  id: string;
  name: string;
  description: string;
  priceAUD: number;
  image: string | null;
  compatibleCategories: string[];
  active: boolean;
}

interface CategoryData {
  grades: { key: string; label: string }[];
  activePriceList: string | null;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  priceAUD: "",
  image: "",
  compatibleCategories: [] as string[],
  active: true,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminUpsellsPage() {
  const [items, setItems] = useState<UpsellProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);

  // ---- dialog state -------------------------------------------------------
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ---- delete dialog state ------------------------------------------------
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UpsellProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ---- fetch data ---------------------------------------------------------
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/upsells");
      const data = await res.json();
      setItems(data);
    } catch {
      console.error("Failed to load upsell products");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/categories");
      const data = await res.json();
      if (data.categories) {
        setCategories(Object.keys(data.categories as Record<string, CategoryData>).sort());
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchItems();
    fetchCategories();
  }, [fetchItems, fetchCategories]);

  // ---- handlers -----------------------------------------------------------
  const openAdd = () => {
    setDialogMode("add");
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (item: UpsellProduct) => {
    setDialogMode("edit");
    setEditId(item.id);
    setForm({
      name: item.name,
      description: item.description,
      priceAUD: String(item.priceAUD),
      image: item.image ?? "",
      compatibleCategories: item.compatibleCategories,
      active: item.active,
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const price = parseFloat(form.priceAUD);
    if (!form.name.trim()) {
      setFormError("Name is required");
      return;
    }
    if (isNaN(price) || price <= 0) {
      setFormError("Price must be a positive number");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        priceAUD: price,
        image: form.image.trim() || null,
        compatibleCategories: form.compatibleCategories,
        active: form.active,
      };

      const url =
        dialogMode === "edit"
          ? `/api/admin/upsells/${editId}`
          : "/api/admin/upsells";
      const method = dialogMode === "edit" ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || "Failed to save");
        return;
      }

      setDialogOpen(false);
      fetchItems();
    } catch {
      setFormError("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/upsells/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setDeleteOpen(false);
      setDeleteTarget(null);
      fetchItems();
    } finally {
      setDeleting(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setForm((prev) => ({
      ...prev,
      compatibleCategories: prev.compatibleCategories.includes(cat)
        ? prev.compatibleCategories.filter((c) => c !== cat)
        : [...prev.compatibleCategories, cat],
    }));
  };

  // ---- render -------------------------------------------------------------
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Upsell Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage add-on products shown on product pages and in the cart.
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 text-center text-sm text-muted-foreground">
          No upsell products yet. Add one to get started.
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Categories</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{item.name}</span>
                      {item.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    ${item.priceAUD}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {item.compatibleCategories.map((cat) => (
                        <Badge key={cat} variant="secondary" className="text-xs">
                          {cat}
                        </Badge>
                      ))}
                      {item.compatibleCategories.length === 0 && (
                        <span className="text-xs text-muted-foreground">All</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={item.active ? "default" : "outline"}
                      className={
                        item.active
                          ? "border-transparent bg-emerald-600 text-white hover:bg-emerald-600/80"
                          : undefined
                      }
                    >
                      {item.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeleteTarget(item);
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "add" ? "Add Upsell Product" : "Edit Upsell Product"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Screen Protector"
              />
            </div>

            <div className="grid gap-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="e.g. Tempered glass screen protector"
              />
            </div>

            <div className="grid gap-2">
              <Label>Price (AUD) *</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.priceAUD}
                onChange={(e) => setForm({ ...form, priceAUD: e.target.value })}
                placeholder="15"
              />
            </div>

            <div className="grid gap-2">
              <Label>Image URL</Label>
              <Input
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value })}
                placeholder="https://..."
              />
            </div>

            <div className="grid gap-2">
              <Label>Compatible Categories</Label>
              <p className="text-xs text-muted-foreground">
                Select which categories this product applies to. Leave empty for
                all categories.
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      form.compatibleCategories.includes(cat)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.active}
                onCheckedChange={(checked) =>
                  setForm({ ...form, active: checked })
                }
              />
              <Label>Active</Label>
            </div>
          </div>

          {formError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialogMode === "add" ? "Add" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Upsell Product</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;?
            This cannot be undone.
          </p>
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
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
