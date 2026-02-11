"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Check, Plus, Pencil, Trash2, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CategoryGrade {
  key: string;
  label: string;
}

interface CategoryData {
  grades: CategoryGrade[];
  activePriceList: string | null;
}

interface PricingSettingsData {
  gradeRatios: Record<string, number>;
  rounding: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);

  // ---- categories state ---------------------------------------------------
  const [categories, setCategories] = useState<Record<string, CategoryData>>(
    {}
  );
  const [categorySaving, setCategorySaving] = useState(false);
  const [categorySaved, setCategorySaved] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // ---- add/edit category dialog -------------------------------------------
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [catDialogMode, setCatDialogMode] = useState<"add" | "edit">("add");
  const [catDialogOriginalName, setCatDialogOriginalName] = useState("");
  const [catName, setCatName] = useState("");
  const [catGrades, setCatGrades] = useState<CategoryGrade[]>([
    { key: "", label: "" },
  ]);

  // ---- pricing settings state ---------------------------------------------
  const [selectedCategory, setSelectedCategory] = useState("Phone");
  const [gradeRatios, setGradeRatios] = useState<Record<string, number>>({});
  const [rounding, setRounding] = useState<string>("5");
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingSaved, setPricingSaved] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);

  // ---- fetch data ---------------------------------------------------------
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, pricingRes] = await Promise.all([
        fetch("/api/admin/categories"),
        fetch(`/api/admin/settings/pricing?category=Phone`),
      ]);
      const catData = await catRes.json();
      const pricingData: PricingSettingsData = await pricingRes.json();

      if (catData.categories) {
        setCategories(catData.categories);
      }
      setGradeRatios(pricingData.gradeRatios ?? {});
      setRounding(String(pricingData.rounding ?? 5));
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ---- load pricing for selected category ---------------------------------
  const loadPricingForCategory = async (cat: string) => {
    try {
      const res = await fetch(
        `/api/admin/settings/pricing?category=${encodeURIComponent(cat)}`
      );
      const data: PricingSettingsData = await res.json();
      setGradeRatios(data.gradeRatios ?? {});
      setRounding(String(data.rounding ?? 5));
    } catch {
      setGradeRatios({});
      setRounding("5");
    }
  };

  const handleCategorySelect = (cat: string) => {
    setSelectedCategory(cat);
    setPricingSaved(false);
    setPricingError(null);
    loadPricingForCategory(cat);
  };

  // ---- save categories ----------------------------------------------------
  const handleSaveCategories = async (
    updatedCategories: Record<string, CategoryData>
  ) => {
    setCategorySaving(true);
    setCategoryError(null);
    setCategorySaved(false);

    try {
      const res = await fetch("/api/admin/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: updatedCategories }),
      });

      if (!res.ok) {
        const data = await res.json();
        setCategoryError(data.error || "Failed to save categories");
        return;
      }

      setCategories(updatedCategories);
      setCategorySaved(true);
      setTimeout(() => setCategorySaved(false), 3000);
    } catch {
      setCategoryError("Failed to save categories");
    } finally {
      setCategorySaving(false);
    }
  };

  // ---- add category dialog ------------------------------------------------
  const openAddCategoryDialog = () => {
    setCatDialogMode("add");
    setCatDialogOriginalName("");
    setCatName("");
    setCatGrades([{ key: "A", label: "Excellent" }, { key: "B", label: "Good" }]);
    setCatDialogOpen(true);
  };

  const openEditCategoryDialog = (name: string) => {
    const cat = categories[name];
    if (!cat) return;
    setCatDialogMode("edit");
    setCatDialogOriginalName(name);
    setCatName(name);
    setCatGrades([...cat.grades]);
    setCatDialogOpen(true);
  };

  const handleCatDialogSave = () => {
    const trimmedName = catName.trim();
    if (!trimmedName) return;

    const validGrades = catGrades.filter(
      (g) => g.key.trim() && g.label.trim()
    );
    if (validGrades.length === 0) return;

    const updated = { ...categories };

    // If editing and name changed, remove old key
    if (catDialogMode === "edit" && catDialogOriginalName !== trimmedName) {
      const oldData = updated[catDialogOriginalName];
      delete updated[catDialogOriginalName];
      updated[trimmedName] = {
        ...oldData,
        grades: validGrades.map((g) => ({
          key: g.key.trim(),
          label: g.label.trim(),
        })),
      };
    } else if (catDialogMode === "edit") {
      updated[trimmedName] = {
        ...updated[trimmedName],
        grades: validGrades.map((g) => ({
          key: g.key.trim(),
          label: g.label.trim(),
        })),
      };
    } else {
      // Add new
      updated[trimmedName] = {
        grades: validGrades.map((g) => ({
          key: g.key.trim(),
          label: g.label.trim(),
        })),
        activePriceList: null,
      };
    }

    handleSaveCategories(updated);
    setCatDialogOpen(false);
  };

  const handleDeleteCategory = (name: string) => {
    if (!confirm(`Delete category "${name}"? This cannot be undone.`)) return;
    const updated = { ...categories };
    delete updated[name];
    handleSaveCategories(updated);
  };

  // ---- grade editor helpers -----------------------------------------------
  const addGradeRow = () => {
    setCatGrades([...catGrades, { key: "", label: "" }]);
  };

  const removeGradeRow = (idx: number) => {
    setCatGrades(catGrades.filter((_, i) => i !== idx));
  };

  const updateGradeRow = (
    idx: number,
    field: "key" | "label",
    value: string
  ) => {
    const updated = [...catGrades];
    updated[idx] = { ...updated[idx], [field]: value };
    setCatGrades(updated);
  };

  // ---- save pricing settings ----------------------------------------------
  const handleSavePricing = async () => {
    setPricingSaving(true);
    setPricingError(null);
    setPricingSaved(false);

    try {
      const res = await fetch("/api/admin/settings/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selectedCategory,
          gradeRatios,
          rounding: parseInt(rounding, 10),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setPricingError(data.error || "Failed to save pricing settings");
        return;
      }

      setPricingSaved(true);
      setTimeout(() => setPricingSaved(false), 3000);
    } catch {
      setPricingError("Failed to save pricing settings");
    } finally {
      setPricingSaving(false);
    }
  };

  // ---- render: loading state ----------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading settings...
        </span>
      </div>
    );
  }

  const categoryNames = Object.keys(categories).sort();
  const selectedCatGrades = categories[selectedCategory]?.grades ?? [];
  // Grade ratios apply to all grades except the first (which is 100%)
  const ratioGrades = selectedCatGrades.slice(1);

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage product categories and pricing parameters.
        </p>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Section 1: Categories                                            */}
      {/* ---------------------------------------------------------------- */}
      <div className="mt-6 max-w-2xl rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Categories</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Define product categories and their grade structures.
            </p>
          </div>
          <Button size="sm" onClick={openAddCategoryDialog}>
            <Plus className="mr-1 h-4 w-4" />
            Add Category
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {categoryNames.map((name) => {
            const cat = categories[name];
            return (
              <div
                key={name}
                className="flex items-center justify-between rounded-md border border-border p-3"
              >
                <div>
                  <div className="font-medium">{name}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {cat.grades.map((g) => (
                      <Badge key={g.key} variant="secondary" className="text-xs">
                        {g.key}: {g.label}
                      </Badge>
                    ))}
                  </div>
                  {cat.activePriceList && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Active price list: {cat.activePriceList}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditCategoryDialog(name)}
                    title="Edit category"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteCategory(name)}
                    title="Delete category"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
          {categoryNames.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No categories defined. Add one to get started.
            </p>
          )}
        </div>

        {categoryError && (
          <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {categoryError}
          </div>
        )}

        {categorySaved && (
          <div className="mt-4 flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
            <Check className="h-4 w-4" />
            Categories saved
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Section 2: Pricing Settings (per category)                       */}
      {/* ---------------------------------------------------------------- */}
      <div className="mt-6 max-w-2xl rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Pricing Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure grade ratios and rounding per category. Applied when using
          &ldquo;Set grade ratios&rdquo; in bulk adjust.
        </p>

        {/* Category selector */}
        <div className="mt-4 flex gap-2">
          {categoryNames.map((name) => (
            <button
              key={name}
              onClick={() => handleCategorySelect(name)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedCategory === name
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Grade ratios — dynamic from category grades */}
        {ratioGrades.length > 0 && (
          <div className="mt-4">
            <Label className="text-sm font-medium">
              Grade Ratios (% of Grade {selectedCatGrades[0]?.key})
            </Label>
            <div className="mt-2 grid grid-cols-2 gap-4">
              {ratioGrades.map((g) => (
                <div key={g.key} className="grid gap-1">
                  <Label htmlFor={`ratio-${g.key}`} className="text-xs">
                    Grade {g.key} — {g.label} (%)
                  </Label>
                  <Input
                    id={`ratio-${g.key}`}
                    type="number"
                    min={0}
                    max={100}
                    value={gradeRatios[g.key] ?? 0}
                    onChange={(e) =>
                      setGradeRatios({
                        ...gradeRatios,
                        [g.key]: Number(e.target.value),
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {ratioGrades.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            This category has only one grade — no ratios needed.
          </p>
        )}

        {/* Rounding */}
        <div className="mt-6">
          <Label className="text-sm font-medium">Rounding</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            All computed prices are rounded to the nearest value.
          </p>
          <div className="mt-2 max-w-[200px]">
            <Select value={rounding} onValueChange={setRounding}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">$5</SelectItem>
                <SelectItem value="10">$10</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {pricingError && (
          <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {pricingError}
          </div>
        )}

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={handleSavePricing} disabled={pricingSaving}>
            {pricingSaving && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save Pricing Settings
          </Button>
          {pricingSaved && (
            <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <Check className="h-4 w-4" />
              Saved
            </span>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Add/Edit Category Dialog                                         */}
      {/* ---------------------------------------------------------------- */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {catDialogMode === "add" ? "Add Category" : "Edit Category"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Category Name</Label>
              <Input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="e.g. Console"
              />
            </div>

            <div className="grid gap-2">
              <Label>Grades</Label>
              <div className="space-y-2">
                {catGrades.map((g, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      className="w-20"
                      placeholder="Key"
                      value={g.key}
                      onChange={(e) =>
                        updateGradeRow(idx, "key", e.target.value)
                      }
                    />
                    <Input
                      placeholder="Label"
                      value={g.label}
                      onChange={(e) =>
                        updateGradeRow(idx, "label", e.target.value)
                      }
                    />
                    {catGrades.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeGradeRow(idx)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={addGradeRow}
                className="mt-1 w-fit"
              >
                <Plus className="mr-1 h-3 w-3" />
                Add Grade
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCatDialogOpen(false)}
              disabled={categorySaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCatDialogSave}
              disabled={
                categorySaving ||
                !catName.trim() ||
                catGrades.filter((g) => g.key.trim() && g.label.trim())
                  .length === 0
              }
            >
              {categorySaving && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {catDialogMode === "add" ? "Add" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
