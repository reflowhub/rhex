import InventoryIntakeForm from "@/components/admin/inventory-intake-form";

export default function DirectPurchasePage() {
  return (
    <InventoryIntakeForm
      sourceType="direct-purchase"
      title="Direct Purchase"
      description="Add a device purchased directly from a supplier or external source."
      showSupplier
    />
  );
}
