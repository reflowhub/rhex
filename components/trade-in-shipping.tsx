import { Clock, Package } from "lucide-react";

// Packing guidance from the trade-in terms (§6 and §8)
const PACKING_STEPS = [
  "Use a rigid box with bubble wrap or similar padding so the device can't move around.",
  "Back up your data, then remove your SIM and any memory cards.",
  "Sign out of your accounts and turn off Find My / Activation Lock.",
  "Leave out cases, chargers and other accessories.",
];

/** Post-acceptance shipping card shown on the quote page and the embed. */
export function TradeInShippingInstructions({ quoteId }: { quoteId: string }) {
  return (
    <>
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Shipping Instructions</h3>
        </div>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            We&apos;ll email your prepaid Australia Post label shortly. You
            supply the packaging.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {PACKING_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
          <p>
            Please include your quote reference number{" "}
            <span className="font-medium font-mono text-foreground">
              {quoteId.slice(0, 8)}...
            </span>{" "}
            written on a piece of paper inside the package.
          </p>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Once we send your label, you&apos;ll have{" "}
            <span className="font-medium text-foreground">14 days</span> to
            post your device.
          </p>
        </div>
      </div>
    </>
  );
}
