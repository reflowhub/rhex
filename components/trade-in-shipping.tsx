import { Check, Clock, Download, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCustomerDate } from "@/lib/label-deadlines";

// Packing guidance from the trade-in terms (§6 and §8)
const PACKING_STEPS = [
  "Use a rigid box with bubble wrap or similar padding so the device can't move around.",
  "Back up your data, then remove your SIM and any memory cards.",
  "Sign out of your accounts and turn off Find My / Activation Lock.",
  "Leave out cases, chargers and other accessories.",
];

/** Post-acceptance shipping card shown on the quote page and the embed. */
export function TradeInShippingInstructions({
  quoteId,
  tradeInRef,
  retailer = false,
}: {
  quoteId: string;
  tradeInRef?: string;
  /** Mode C: the label may come from RHEX or the retailer (OPPO.md, 2e) */
  retailer?: boolean;
}) {
  return (
    <>
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Shipping Instructions</h3>
        </div>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            {retailer
              ? "You'll receive your prepaid Australia Post label by email shortly."
              : "We'll email your prepaid Australia Post label shortly."}{" "}
            You supply the packaging.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {PACKING_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
          <p>
            Please include your {tradeInRef ? "trade-in" : "quote"} reference{" "}
            <span className="font-medium font-mono text-foreground">
              {tradeInRef ?? `${quoteId.slice(0, 8)}...`}
            </span>{" "}
            written on a piece of paper inside the package.
          </p>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {retailer ? "Once your label arrives" : "Once we send your label"},
            you&apos;ll have{" "}
            <span className="font-medium text-foreground">14 days</span> to
            post your device.
          </p>
        </div>
      </div>
    </>
  );
}

/** Shown once the label has been sent: download, post-by date, "I've posted it". */
export function TradeInLabelCard({
  quoteId,
  tradeInRef,
  trackingNumber,
  postByAt,
  labelFrom,
  shippedAt,
  posting,
  onMarkPosted,
}: {
  quoteId: string;
  tradeInRef?: string;
  trackingNumber?: string;
  postByAt?: string;
  /** The retailer that emailed the customer its own label: no download here */
  labelFrom?: string;
  /** Set once the customer (or RHEX) has marked the parcel as posted */
  shippedAt?: string;
  posting: boolean;
  onMarkPosted: () => void;
}) {
  const reference = tradeInRef ?? quoteId.slice(0, 8);

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Package className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Your Shipping Label</h3>
      </div>
      <div className="space-y-4 text-sm text-muted-foreground">
        {!shippedAt && postByAt && (
          <p className="rounded-lg bg-muted p-3 text-foreground">
            Post your device by{" "}
            <span className="font-semibold">{formatCustomerDate(postByAt)}</span>.
          </p>
        )}

        {!labelFrom && (
          <Button asChild className="w-full" variant={shippedAt ? "outline" : "default"}>
            <a href={`/api/quote/${quoteId}/label`}>
              <Download className="mr-2 h-4 w-4" />
              Download label (PDF)
            </a>
          </Button>
        )}

        <ol className="list-decimal space-y-1 pl-5">
          <li>
            {labelFrom
              ? `Print the prepaid label ${labelFrom} emailed you and attach it to your box.`
              : "Print the label and attach it to your box."}
          </li>
          <li>
            Put a note inside the box with your reference{" "}
            <span className="font-mono font-medium text-foreground">
              {reference}
            </span>
            .
          </li>
          <li>Drop it at any Australia Post outlet or street posting box.</li>
        </ol>

        <ul className="list-disc space-y-1 pl-5">
          {PACKING_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>

        {trackingNumber && (
          <p>
            Tracking number:{" "}
            <span className="font-mono text-foreground">{trackingNumber}</span>
          </p>
        )}

        {shippedAt ? (
          <p className="flex items-center gap-2 text-green-700">
            <Check className="h-4 w-4" />
            Marked as posted on {formatCustomerDate(shippedAt)}. We&apos;ll let
            you know when it arrives.
          </p>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={onMarkPosted}
            disabled={posting}
          >
            {posting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            I&apos;ve posted it
          </Button>
        )}
      </div>
    </div>
  );
}
