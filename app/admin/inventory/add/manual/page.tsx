import InventoryIntakeForm from "@/components/admin/inventory-intake-form";

export default function ManualEntryPage() {
  return (
    <InventoryIntakeForm
      sourceType="manual"
      title="Manual Entry"
      description="Manually add a device to inventory."
    />
  );
}
