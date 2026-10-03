import { MAX_LABEL_BYTES } from "@/lib/shipping-labels";

/**
 * The label form admin posts (multipart): file (PDF), trackingNumber,
 * labelCostAUD (optional) and replaceLabelId (when replacing a label).
 * `withPdf` is false for a partner's inbound label, which has no file.
 */
export type LabelUpload =
  | {
      ok: true;
      pdf: Buffer | null;
      fileName: string | null;
      trackingNumber: string;
      labelCostAUD: number | null;
      replaceLabelId: string | null;
    }
  | { ok: false; error: string };

export async function readLabelUpload(
  form: FormData,
  opts: { withPdf: boolean }
): Promise<LabelUpload> {
  const file = form.get("file");
  const trackingNumber = String(form.get("trackingNumber") ?? "")
    .replace(/\s/g, "")
    .toUpperCase();
  const costInput = String(form.get("labelCostAUD") ?? "").trim();
  const replaceLabelId = String(form.get("replaceLabelId") ?? "") || null;

  if (opts.withPdf && !(file instanceof File)) {
    return { ok: false, error: "Attach the label PDF" };
  }
  if (!trackingNumber) {
    return { ok: false, error: "Tracking number is required" };
  }

  let pdf: Buffer | null = null;
  let fileName: string | null = null;
  if (opts.withPdf && file instanceof File) {
    if (file.size > MAX_LABEL_BYTES) {
      return { ok: false, error: "Label PDF must be under 900 KB" };
    }
    pdf = Buffer.from(await file.arrayBuffer());
    if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") {
      return { ok: false, error: "The label must be a PDF" };
    }
    fileName = file.name || "label.pdf";
  }

  let labelCostAUD: number | null = null;
  if (costInput) {
    labelCostAUD = Number(costInput);
    if (!Number.isFinite(labelCostAUD) || labelCostAUD < 0) {
      return { ok: false, error: "Label cost must be a positive number" };
    }
  }

  return { ok: true, pdf, fileName, trackingNumber, labelCostAUD, replaceLabelId };
}
