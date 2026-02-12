"use client";

import { useState, useEffect } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  Search,
  CheckCircle2,
} from "lucide-react";
import { useFX } from "@/lib/use-fx";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Order {
  id: string;
  orderNumber: number;
  customerName: string;
  customerEmail: string;
  itemCount: number;
  totalAUD: number;
  status: string;
  createdAt: string | null;
}

interface OrderDetail {
  id: string;
  orderNumber: number;
  customerName: string;
  items: {
    inventoryId: string;
    deviceRef: string;
    description: string;
    priceAUD: number;
  }[];
}

interface InventoryItem {
  id: string;
  inventoryId: number;
  status: string;
  cosmeticGrade: string;
  serial: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRADES = ["A", "B", "C", "D", "E"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProcessReturnPage() {
  const router = useRouter();
  const { formatPrice: fxFormatPrice } = useFX();

  // Step 1: Find order
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);

  // Step 2: Select item
  const [selectedItemIdx, setSelectedItemIdx] = useState<number | null>(null);
  const [inventoryItem, setInventoryItem] = useState<InventoryItem | null>(null);
  const [itemLoading, setItemLoading] = useState(false);

  // Step 3: Return details
  const [cosmeticGrade, setCosmeticGrade] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [batteryHealth, setBatteryHealth] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Search orders
  useEffect(() => {
    if (!debouncedSearch) {
      setOrders([]);
      return;
    }

    setSearchLoading(true);
    fetch(`/api/admin/orders?search=${encodeURIComponent(debouncedSearch)}`)
      .then((res) => res.json())
      .then((data: Order[]) => {
        if (Array.isArray(data)) {
          // Only show orders that have been paid/completed (could have sold items)
          setOrders(
            data.filter((o) =>
              ["paid", "processing", "shipped", "delivered"].includes(o.status)
            )
          );
        }
      })
      .finally(() => setSearchLoading(false));
  }, [debouncedSearch]);

  // Fetch order detail when selected
  const handleSelectOrder = (order: Order) => {
    setOrderLoading(true);
    setSelectedOrder(null);
    setSelectedItemIdx(null);
    setInventoryItem(null);
    resetForm();

    fetch(`/api/admin/orders/${order.id}`)
      .then((res) => res.json())
      .then((data) => {
        setSelectedOrder({
          id: data.id,
          orderNumber: data.orderNumber,
          customerName: data.customerName,
          items: data.items ?? [],
        });
      })
      .finally(() => setOrderLoading(false));
  };

  // Fetch inventory item when a line is selected
  const handleSelectItem = (idx: number) => {
    if (!selectedOrder) return;
    const item = selectedOrder.items[idx];
    setSelectedItemIdx(idx);
    setItemLoading(true);
    setInventoryItem(null);
    resetForm();

    fetch(`/api/admin/inventory/${item.inventoryId}`)
      .then((res) => res.json())
      .then((data: InventoryItem) => {
        setInventoryItem(data);
        setCosmeticGrade(data.cosmeticGrade ?? "");
      })
      .finally(() => setItemLoading(false));
  };

  const resetForm = () => {
    setCosmeticGrade("");
    setReturnReason("");
    setBatteryHealth("");
    setLocation("");
    setNotes("");
    setFormError(null);
  };

  const handleSubmit = async () => {
    if (!inventoryItem || !selectedOrder) return;

    setSubmitting(true);
    setFormError(null);

    const body: Record<string, unknown> = {
      inventoryId: inventoryItem.id,
      orderId: selectedOrder.id,
    };

    if (cosmeticGrade) body.cosmeticGrade = cosmeticGrade;
    if (returnReason.trim()) body.returnReason = returnReason.trim();
    if (batteryHealth) body.batteryHealth = parseInt(batteryHealth, 10);
    if (location.trim()) body.location = location.trim();
    if (notes.trim()) body.notes = notes.trim();

    try {
      const res = await fetch("/api/admin/inventory/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        router.push(`/admin/inventory/${inventoryItem.id}`);
      } else {
        const data = await res.json();
        setFormError(data.error || "Failed to process return");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (amount: number | null | undefined) => {
    return fxFormatPrice(amount, "AUD");
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "\u2014";
    return new Date(iso).toLocaleDateString("en-NZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const canSubmit =
    inventoryItem &&
    inventoryItem.status === "sold" &&
    cosmeticGrade !== "";

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => router.push("/admin/inventory")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Inventory
      </Button>

      <h1 className="text-3xl font-bold tracking-tight">Process Return</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Find a completed order and return a sold item back into inventory.
      </p>

      {/* ================================================================ */}
      {/* Step 1: Find Order                                                */}
      {/* ================================================================ */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">1. Find Order</h2>

        <div className="mt-4 flex max-w-md items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by order number or customer name..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {debouncedSearch && (
          <div className="mt-4 rounded-lg border border-border bg-card">
            {searchLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Searching...
                </span>
              </div>
            ) : orders.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No completed orders found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow
                      key={order.id}
                      className={cn(
                        "cursor-pointer",
                        selectedOrder?.id === order.id && "bg-primary/5"
                      )}
                      onClick={() => handleSelectOrder(order)}
                    >
                      <TableCell className="font-mono text-xs">
                        {order.orderNumber}
                      </TableCell>
                      <TableCell>{order.customerName || "\u2014"}</TableCell>
                      <TableCell className="text-right">
                        {order.itemCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPrice(order.totalAUD)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{order.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(order.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* Step 2: Select Item                                               */}
      {/* ================================================================ */}
      {orderLoading && (
        <div className="mt-8 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading order details...</span>
        </div>
      )}

      {selectedOrder && !orderLoading && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">
            2. Select Item to Return
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Order #{selectedOrder.orderNumber} &mdash;{" "}
            {selectedOrder.customerName}
          </p>

          <div className="mt-3 rounded-lg border border-border bg-card">
            {selectedOrder.items.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No items in this order.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedOrder.items.map((item, idx) => (
                    <TableRow
                      key={item.inventoryId}
                      className={cn(
                        selectedItemIdx === idx && "bg-primary/5"
                      )}
                    >
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">
                        {formatPrice(item.priceAUD)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant={
                            selectedItemIdx === idx ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => handleSelectItem(idx)}
                        >
                          {selectedItemIdx === idx ? "Selected" : "Select"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Step 3: Return Details                                            */}
      {/* ================================================================ */}
      {itemLoading && (
        <div className="mt-8 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading inventory item...</span>
        </div>
      )}

      {inventoryItem && !itemLoading && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">3. Return Details</h2>

          {inventoryItem.status !== "sold" ? (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              This item has status &ldquo;{inventoryItem.status}&rdquo; and
              cannot be returned. Only items with status &ldquo;sold&rdquo; can
              be processed as returns.
            </div>
          ) : (
            <>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>
                  Inventory #{inventoryItem.inventoryId} &mdash; Serial:{" "}
                  <span className="font-mono">{inventoryItem.serial}</span>
                </span>
              </div>

              <div className="mt-3 rounded-lg border border-border bg-card p-6">
                {formError && (
                  <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    {formError}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Grade */}
                  <div className="grid gap-2">
                    <Label htmlFor="grade">Grade *</Label>
                    <Select
                      value={cosmeticGrade}
                      onValueChange={setCosmeticGrade}
                    >
                      <SelectTrigger id="grade">
                        <SelectValue placeholder="Select grade..." />
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

                  {/* Return Reason */}
                  <div className="grid gap-2">
                    <Label htmlFor="reason">Return Reason</Label>
                    <Input
                      id="reason"
                      placeholder="e.g. Customer changed mind, Faulty device"
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                    />
                  </div>

                  {/* Battery Health */}
                  <div className="grid gap-2">
                    <Label htmlFor="battery">Battery Health (%)</Label>
                    <Input
                      id="battery"
                      type="number"
                      min="0"
                      max="100"
                      placeholder="e.g. 87"
                      value={batteryHealth}
                      onChange={(e) => setBatteryHealth(e.target.value)}
                    />
                  </div>

                  {/* Location */}
                  <div className="grid gap-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      placeholder="e.g. Shelf A3"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="mt-4 grid gap-2">
                  <Label htmlFor="notes">Notes</Label>
                  <textarea
                    id="notes"
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="Condition notes for the returned device..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                {/* Submit */}
                <div className="mt-6">
                  <Button
                    onClick={handleSubmit}
                    disabled={!canSubmit || submitting}
                    className="w-full sm:w-auto"
                  >
                    {submitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Process Return
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
