"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
  ArrowLeft,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import { useFX } from "@/lib/use-fx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CustomerNote {
  id: string;
  text: string;
  createdBy: string;
  createdAt: string;
}

interface QuoteSummary {
  id: string;
  deviceMake: string;
  deviceModel: string;
  deviceStorage: string;
  grade: string;
  quotePriceNZD: number;
  status: string;
  createdAt: string | null;
}

interface BulkQuoteSummary {
  id: string;
  businessName: string;
  totalDevices: number;
  totalIndicativeNZD: number;
  status: string;
  createdAt: string | null;
}

interface OrderSummary {
  id: string;
  orderNumber: number;
  itemCount: number;
  totalAUD: number;
  status: string;
  createdAt: string | null;
}

interface Customer {
  id: string;
  type: "individual" | "business";
  name: string;
  email: string;
  phone: string | null;
  businessName: string | null;
  shippingAddress: string | null;
  paymentMethod: string | null;
  payIdPhone: string | null;
  bankBSB: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  totalQuotes: number;
  totalValueNZD: number;
  totalOrders: number;
  totalOrderValueAUD: number;
  lastActivityAt: string | null;
  notes: CustomerNote[];
  quotes: QuoteSummary[];
  bulkQuotes: BulkQuoteSummary[];
  orders: OrderSummary[];
  createdAt: string | null;
  updatedAt: string | null;
}

// ---------------------------------------------------------------------------
// Status badge styling (reused from quotes page)
// ---------------------------------------------------------------------------

function statusBadgeProps(status: string): {
  variant: "default" | "secondary" | "outline" | "destructive";
  className?: string;
} {
  switch (status) {
    case "quoted":
      return { variant: "default" };
    case "accepted":
      return { variant: "secondary" };
    case "estimated":
      return { variant: "default" };
    case "shipped":
      return { variant: "outline" };
    case "received":
      return { variant: "secondary" };
    case "inspected":
      return { variant: "default" };
    case "paid":
      return {
        variant: "default",
        className:
          "border-transparent bg-green-600 text-white hover:bg-green-600/80",
      };
    case "cancelled":
      return { variant: "destructive" };
    case "processing":
      return { variant: "secondary" };
    case "delivered":
      return {
        variant: "default",
        className:
          "border-transparent bg-green-600 text-white hover:bg-green-600/80",
      };
    default:
      return { variant: "outline" };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [editLoading, setEditLoading] = useState(false);

  // ---- notes
  const [noteText, setNoteText] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);

  // ---- quote history tab
  const [quoteTab, setQuoteTab] = useState<"individual" | "bulk" | "orders">("individual");

  // ---- fetch
  const fetchCustomer = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/customers/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Customer not found");
        return res.json();
      })
      .then((data: Customer) => {
        setCustomer(data);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  // ---- helpers
  const formatDate = (iso: string | null) => {
    if (!iso) return "\u2014";
    return new Date(iso).toLocaleDateString("en-NZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return "\u2014";
    return new Date(iso).toLocaleDateString("en-NZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const { formatPrice: fxFormatPrice } = useFX();
  const formatPrice = (amount: number | null | undefined) => {
    return fxFormatPrice(amount, "AUD");
  };

  // ---- edit handlers
  const openEditDialog = () => {
    if (!customer) return;
    setEditData({
      name: customer.name || "",
      email: customer.email || "",
      phone: customer.phone || "",
      businessName: customer.businessName || "",
      shippingAddress: customer.shippingAddress || "",
    });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    setEditLoading(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to update");
        return;
      }
      setEditOpen(false);
      fetchCustomer();
    } catch {
      alert("Failed to update customer");
    } finally {
      setEditLoading(false);
    }
  };

  // ---- note handlers
  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setNoteLoading(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: noteText }),
      });
      if (res.ok) {
        setNoteText("");
        fetchCustomer();
      }
    } catch {
      // ignore
    } finally {
      setNoteLoading(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const res = await fetch(`/api/admin/customers/${id}/notes`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId }),
      });
      if (res.ok) fetchCustomer();
    } catch {
      // ignore
    }
  };

  // ---- loading / error states
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        {error || "Customer not found"}
      </div>
    );
  }

  // ---- render
  return (
    <div>
      {/* Back button + header */}
      <button
        onClick={() => router.push("/admin/customers")}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Customers
      </button>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            {customer.name}
          </h1>
          <Badge
            variant={customer.type === "business" ? "secondary" : "default"}
          >
            {customer.type}
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={openEditDialog}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </div>

      {/* Info cards */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Contact Information */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Contact Information</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{customer.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd>
                <a
                  href={`mailto:${customer.email}`}
                  className="text-primary hover:underline"
                >
                  {customer.email}
                </a>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{customer.phone || "\u2014"}</dd>
            </div>
            {customer.type === "business" && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Business Name</dt>
                <dd className="font-medium">
                  {customer.businessName || "\u2014"}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipping Address</dt>
              <dd className="max-w-[60%] text-right">
                {customer.shippingAddress || "\u2014"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Payment Details */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Payment Details</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Payment Method</dt>
              <dd className="font-medium capitalize">
                {customer.paymentMethod?.replace("_", " ") || "\u2014"}
              </dd>
            </div>
            {customer.paymentMethod === "payid" && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">PayID Phone</dt>
                <dd>{customer.payIdPhone || "\u2014"}</dd>
              </div>
            )}
            {customer.paymentMethod === "bank_transfer" && (
              <>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">BSB</dt>
                  <dd>{customer.bankBSB || "\u2014"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Account Number</dt>
                  <dd>{customer.bankAccountNumber || "\u2014"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Account Name</dt>
                  <dd>{customer.bankAccountName || "\u2014"}</dd>
                </div>
              </>
            )}
            <div className="border-t border-border pt-3" />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Total Quotes</dt>
              <dd className="font-medium">{customer.totalQuotes}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Quote Value</dt>
              <dd className="font-medium">
                {formatPrice(customer.totalValueNZD)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Total Orders</dt>
              <dd className="font-medium">{customer.totalOrders}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Order Value</dt>
              <dd className="font-medium">
                {formatPrice(customer.totalOrderValueAUD)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Customer Since</dt>
              <dd>{formatDate(customer.createdAt)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Quote History */}
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">History</h2>

        {/* Tab toggle */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setQuoteTab("individual")}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              quoteTab === "individual"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            Individual Quotes ({customer.quotes.length})
          </button>
          <button
            onClick={() => setQuoteTab("bulk")}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              quoteTab === "bulk"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            Bulk Quotes ({customer.bulkQuotes.length})
          </button>
          <button
            onClick={() => setQuoteTab("orders")}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              quoteTab === "orders"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            Orders ({customer.orders.length})
          </button>
        </div>

        {/* Individual quotes table */}
        {quoteTab === "individual" && (
          <div className="mt-4">
            {customer.quotes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No individual quotes linked to this customer.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote ID</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.quotes.map((q) => {
                    const bp = statusBadgeProps(q.status);
                    return (
                      <TableRow
                        key={q.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/admin/quotes/${q.id}`)}
                      >
                        <TableCell className="font-mono text-xs uppercase">
                          {q.id.substring(0, 8)}
                        </TableCell>
                        <TableCell>
                          {[q.deviceMake, q.deviceModel, q.deviceStorage]
                            .filter(Boolean)
                            .join(" ") || "\u2014"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{q.grade}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPrice(q.quotePriceNZD)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={bp.variant}
                            className={bp.className}
                          >
                            {q.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(q.createdAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        )}

        {/* Bulk quotes table */}
        {quoteTab === "bulk" && (
          <div className="mt-4">
            {customer.bulkQuotes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No bulk quotes linked to this customer.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote ID</TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead className="text-right">Devices</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.bulkQuotes.map((bq) => {
                    const bp = statusBadgeProps(bq.status);
                    return (
                      <TableRow
                        key={bq.id}
                        className="cursor-pointer"
                        onClick={() =>
                          router.push(`/admin/bulk-quotes/${bq.id}`)
                        }
                      >
                        <TableCell className="font-mono text-xs uppercase">
                          {bq.id.substring(0, 8)}
                        </TableCell>
                        <TableCell>{bq.businessName || "\u2014"}</TableCell>
                        <TableCell className="text-right">
                          {bq.totalDevices}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPrice(bq.totalIndicativeNZD)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={bp.variant}
                            className={bp.className}
                          >
                            {bq.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(bq.createdAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        )}

        {/* Orders table */}
        {quoteTab === "orders" && (
          <div className="mt-4">
            {customer.orders.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No orders linked to this customer.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.orders.map((o) => {
                    const bp = statusBadgeProps(o.status);
                    return (
                      <TableRow
                        key={o.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/admin/orders/${o.id}`)}
                      >
                        <TableCell className="font-mono font-medium">
                          #{o.orderNumber}
                        </TableCell>
                        <TableCell className="text-right">
                          {o.itemCount}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPrice(o.totalAUD)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={bp.variant}
                            className={bp.className}
                          >
                            {o.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(o.createdAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Notes</h2>

        {/* Existing notes */}
        {customer.notes.length > 0 && (
          <div className="mt-4 space-y-3">
            {customer.notes.map((note) => (
              <div
                key={note.id}
                className="flex items-start justify-between rounded-md border border-border bg-muted/50 p-3"
              >
                <div className="flex-1">
                  <p className="text-sm whitespace-pre-wrap">{note.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    by {note.createdBy} &middot; {formatDateTime(note.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="ml-2 shrink-0 text-muted-foreground hover:text-destructive"
                  title="Delete note"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add note form */}
        <div className="mt-4 flex gap-2">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note..."
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            rows={2}
          />
          <Button
            size="sm"
            onClick={handleAddNote}
            disabled={!noteText.trim() || noteLoading}
            className="self-end"
          >
            {noteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Note
          </Button>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editData.name ?? ""}
                onChange={(e) =>
                  setEditData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editData.email ?? ""}
                onChange={(e) =>
                  setEditData((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={editData.phone ?? ""}
                onChange={(e) =>
                  setEditData((prev) => ({ ...prev, phone: e.target.value }))
                }
              />
            </div>
            {customer.type === "business" && (
              <div className="grid gap-2">
                <Label htmlFor="edit-biz">Business Name</Label>
                <Input
                  id="edit-biz"
                  value={editData.businessName ?? ""}
                  onChange={(e) =>
                    setEditData((prev) => ({
                      ...prev,
                      businessName: e.target.value,
                    }))
                  }
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="edit-address">Shipping Address</Label>
              <Input
                id="edit-address"
                value={editData.shippingAddress ?? ""}
                onChange={(e) =>
                  setEditData((prev) => ({
                    ...prev,
                    shippingAddress: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={editLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={editLoading}>
              {editLoading && (
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
