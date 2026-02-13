"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { useFX } from "@/lib/use-fx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Customer {
  id: string;
  type: "individual" | "business";
  name: string;
  email: string;
  phone: string | null;
  businessName: string | null;
  totalQuotes: number;
  totalValueNZD: number;
  totalOrders: number;
  totalOrderValueAUD: number;
  lastActivityAt: string | null;
  createdAt: string | null;
}

interface CustomerFormData {
  type: "individual" | "business";
  name: string;
  email: string;
  phone: string;
  businessName: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPES = ["all", "individual", "business"] as const;
type TypeFilter = (typeof TYPES)[number];

const PAGE_SIZE = 25;

const EMPTY_FORM: CustomerFormData = {
  type: "individual",
  name: "",
  email: "",
  phone: "",
  businessName: "",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CustomersPage() {
  const router = useRouter();

  // ---- data state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- filter / search
  const [activeType, setActiveType] = useState<TypeFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // ---- pagination
  const [currentPage, setCurrentPage] = useState(1);

  // ---- dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [formData, setFormData] = useState<CustomerFormData>(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ---- debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeType, debouncedSearch]);

  // ---- fetch customers
  const fetchCustomers = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeType !== "all") params.set("type", activeType);
    if (debouncedSearch) params.set("search", debouncedSearch);
    const url = `/api/admin/customers${params.toString() ? `?${params}` : ""}`;

    fetch(url)
      .then((res) => res.json())
      .then((data: Customer[]) => {
        if (Array.isArray(data)) setCustomers(data);
      })
      .finally(() => setLoading(false));
  }, [activeType, debouncedSearch]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // ---- pagination
  const totalPages = Math.max(1, Math.ceil(customers.length / PAGE_SIZE));
  const paginatedCustomers = customers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // ---- form helpers
  const handleFormChange = (field: keyof CustomerFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormError(null);
  };

  const isFormValid =
    formData.name.trim() !== "" &&
    formData.email.trim() !== "" &&
    (formData.type !== "business" || formData.businessName.trim() !== "");

  const handleAdd = async () => {
    if (!isFormValid) return;
    setFormLoading(true);
    setFormError(null);

    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formData.type,
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
          businessName: formData.businessName.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        if (res.status === 409 && err.existingId) {
          setFormError(
            `A customer with this email already exists. View them in the customer list.`
          );
        } else {
          setFormError(err.error || "Failed to create customer");
        }
        return;
      }

      setAddOpen(false);
      setFormData(EMPTY_FORM);
      fetchCustomers();
    } catch {
      setFormError("Failed to create customer");
    } finally {
      setFormLoading(false);
    }
  };

  // ---- helpers
  const formatDate = (iso: string | null) => {
    if (!iso) return "\u2014";
    return new Date(iso).toLocaleDateString("en-NZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const { formatPrice: fxFormatPrice } = useFX();
  const formatPrice = (amount: number | null | undefined) => {
    return fxFormatPrice(amount, "AUD");
  };

  // ---- render
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? "Loading customers..."
              : `${customers.length} customer${customers.length !== 1 ? "s" : ""} found`}
          </p>
        </div>
        <Button
          onClick={() => {
            setFormData(EMPTY_FORM);
            setFormError(null);
            setAddOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      {/* Type filter tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {TYPES.map((type) => {
          const isActive = activeType === type;
          return (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {type}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="mt-4 flex max-w-sm items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or business..."
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
              Loading customers...
            </span>
          </div>
        ) : customers.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            {activeType !== "all" || debouncedSearch
              ? "No customers match your filters."
              : "No customers found. Customers are created automatically when quotes are accepted or shop orders are placed."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quotes</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedCustomers.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/admin/customers/${customer.id}`)
                  }
                >
                  <TableCell className="font-medium">
                    {customer.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {customer.email}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        customer.type === "business" ? "secondary" : "default"
                      }
                    >
                      {customer.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {customer.totalQuotes}
                  </TableCell>
                  <TableCell className="text-right">
                    {customer.totalOrders}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPrice(
                      customer.totalValueNZD + customer.totalOrderValueAUD
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(customer.lastActivityAt)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(customer.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {!loading && customers.length > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}&ndash;
            {Math.min(currentPage * PAGE_SIZE, customers.length)} of{" "}
            {customers.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Add Customer Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {formError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {formError}
              </div>
            )}

            <div className="grid gap-2">
              <Label>Type</Label>
              <Select
                value={formData.type}
                onValueChange={(val) =>
                  handleFormChange("type", val as "individual" | "business")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cust-name">Name</Label>
              <Input
                id="cust-name"
                value={formData.name}
                onChange={(e) => handleFormChange("name", e.target.value)}
                placeholder="Full name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cust-email">Email</Label>
              <Input
                id="cust-email"
                type="email"
                value={formData.email}
                onChange={(e) => handleFormChange("email", e.target.value)}
                placeholder="customer@example.com"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cust-phone">
                Phone{" "}
                <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="cust-phone"
                value={formData.phone}
                onChange={(e) => handleFormChange("phone", e.target.value)}
                placeholder="04XX XXX XXX"
              />
            </div>

            {formData.type === "business" && (
              <div className="grid gap-2">
                <Label htmlFor="cust-biz">Business Name</Label>
                <Input
                  id="cust-biz"
                  value={formData.businessName}
                  onChange={(e) =>
                    handleFormChange("businessName", e.target.value)
                  }
                  placeholder="Company Pty Ltd"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={formLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!isFormValid || formLoading}>
              {formLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
