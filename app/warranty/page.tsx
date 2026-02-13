import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Warranty & Returns Policy | Reflow Hub",
  description:
    "Warranty coverage, returns, change-of-mind, and refund policy for Reflow Hub certified refurbished devices.",
};

export default function WarrantyReturnsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">
        Warranty &amp; Returns Policy
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: 13 February 2025
      </p>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-foreground/90">
        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">
            1. Australian Consumer Law guarantees
          </h2>
          <p className="mt-2">
            Our goods come with guarantees that cannot be excluded under the{" "}
            <em>Australian Consumer Law</em> (Schedule 2 of the{" "}
            <em>Competition and Consumer Act 2010</em>). You are entitled to a
            replacement or refund for a major failure and compensation for any
            other reasonably foreseeable loss or damage. You are also entitled to
            have the goods repaired or replaced if the goods fail to be of
            acceptable quality and the failure does not amount to a major
            failure.
          </p>
          <p className="mt-2">
            Nothing in this policy limits or overrides your statutory rights.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">
            2. Our 12-month warranty
          </h2>
          <p className="mt-2">
            Every certified refurbished device purchased from Reflow Hub comes
            with a <strong>12-month warranty</strong> from the date of delivery.
            This warranty covers defects in functionality that are not disclosed
            in the product listing or attributable to normal wear and tear.
          </p>

          <h3 className="mt-4 font-semibold">What is covered</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Hardware defects — e.g. screen, speaker, microphone, charging port, buttons, cameras, sensors.</li>
            <li>Battery — if battery health drops below 80% within the warranty period (where battery health was reported at time of sale).</li>
            <li>Software issues caused by hardware failure.</li>
          </ul>

          <h3 className="mt-4 font-semibold">What is not covered</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Cosmetic wear</strong> — scratches, dents, or marks
              consistent with the listed grade at the time of purchase.
            </li>
            <li>
              <strong>Accidental damage</strong> — drops, impacts, cracked
              screens, liquid/water damage, or exposure to extreme conditions.
            </li>
            <li>
              <strong>Water resistance</strong> — refurbished devices may not
              retain their original water-resistance rating. Water damage is not
              covered under warranty.
            </li>
            <li>
              <strong>Unauthorised modifications</strong> — repairs or
              modifications performed by anyone other than Reflow Hub or an
              authorised service provider.
            </li>
            <li>
              <strong>Software issues</strong> — problems caused by third-party
              software, jailbreaking, rooting, or user-installed updates.
            </li>
            <li>
              <strong>Misuse or neglect</strong> — failure to follow
              manufacturer care instructions.
            </li>
            <li>
              <strong>Accessories</strong> — cables, chargers, and other
              accessories included with the device (unless separately
              warranted).
            </li>
          </ul>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">
            3. Change-of-mind returns
          </h2>
          <p className="mt-2">
            We offer a <strong>30-day change-of-mind return</strong> policy. If
            you are not satisfied with your purchase for any reason, you may
            return the device within 30 days of delivery, subject to the
            following conditions:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              The device must be in the <strong>same condition</strong> as when
              it was received — no new damage, scratches, or marks.
            </li>
            <li>
              The device must be returned with all original packaging and
              accessories.
            </li>
            <li>
              All personal data, accounts (including iCloud, Google, Samsung
              accounts), and passwords must be removed. Factory reset must be
              completed before return.
            </li>
            <li>The device must not be reported lost, stolen, or blacklisted.</li>
          </ul>

          <h3 className="mt-4 font-semibold">Restocking fee</h3>
          <p className="mt-2">
            A <strong>$30 restocking fee</strong> will be deducted from
            change-of-mind refunds to cover inspection and repackaging costs.
            This fee is <strong>waived</strong> if you choose to receive{" "}
            <strong>store credit</strong> instead of a refund to your original
            payment method.
          </p>
          <p className="mt-2">
            If accessories are missing or damaged upon return, an additional
            deduction of up to $50 may apply.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">4. Faulty device returns</h2>
          <p className="mt-2">
            If your device develops a fault covered by our warranty or the
            Australian Consumer Law guarantees, you are entitled to a remedy at
            no cost to you.
          </p>

          <h3 className="mt-4 font-semibold">Major failure</h3>
          <p className="mt-2">
            If the fault constitutes a major failure (the device would not have
            been purchased by a reasonable consumer had they known about the
            issue, the device is substantially unfit for its normal purpose, or
            the device is unsafe), you may choose:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>a full refund, or</li>
            <li>a replacement device of the same or equivalent model.</li>
          </ul>

          <h3 className="mt-4 font-semibold">Minor failure</h3>
          <p className="mt-2">
            If the fault is minor and can be repaired within a reasonable time,
            we may choose to:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>repair the device,</li>
            <li>replace the device, or</li>
            <li>provide a refund.</li>
          </ul>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">5. How to make a claim</h2>
          <p className="mt-2">To initiate a return or warranty claim:</p>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            <li>
              <strong>Contact us</strong> — email{" "}
              <a
                href="mailto:team@reflowhub.com"
                className="underline hover:text-foreground"
              >
                team@reflowhub.com
              </a>{" "}
              or message us on{" "}
              <a
                href="https://wa.me/61426908433"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                WhatsApp
              </a>{" "}
              with your order number and a description of the issue.
            </li>
            <li>
              <strong>Provide evidence</strong> — for warranty claims, please
              include at least 4 clear photos showing the fault, plus a brief
              description of the problem. We may ask for additional information
              or video.
            </li>
            <li>
              <strong>Ship the device</strong> — once your return is authorised,
              we will provide a prepaid return shipping label (for warranty and
              faulty-device claims). For change-of-mind returns, return shipping
              is at the customer&apos;s expense.
            </li>
            <li>
              <strong>Inspection</strong> — upon receiving the device, we will
              inspect it within 3–5 business days and notify you of the outcome.
            </li>
          </ol>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">6. Refund process</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Refunds are processed to the <strong>original payment method</strong> used
              at checkout.
            </li>
            <li>
              Refunds typically appear on your statement within{" "}
              <strong>5–10 business days</strong> after approval, depending on
              your bank or card issuer.
            </li>
            <li>
              If you opted for <strong>store credit</strong> (change-of-mind
              returns), the credit will be issued within 2 business days of
              inspection and can be used on any future purchase.
            </li>
            <li>
              Original shipping costs are non-refundable for change-of-mind
              returns. Shipping costs will be refunded for warranty or faulty-device claims.
            </li>
          </ul>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">
            7. Devices not eligible for return
          </h2>
          <p className="mt-2">
            We cannot accept returns in the following circumstances:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              The device has been damaged after delivery (e.g. cracked screen,
              water damage) outside of a warranty claim.
            </li>
            <li>
              The device has been reported lost or stolen, or has been
              blacklisted.
            </li>
            <li>
              An iCloud Activation Lock, Google FRP lock, or Samsung account
              lock has not been removed.
            </li>
            <li>
              The device has been modified, repaired, or tampered with by an
              unauthorised party.
            </li>
            <li>
              The 30-day change-of-mind window has passed (unless the claim is
              under warranty or the Australian Consumer Law).
            </li>
          </ul>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">
            8. Invalid warranty claims
          </h2>
          <p className="mt-2">
            If we receive a device for a warranty claim and determine that the
            fault is not covered (e.g. accidental damage, water damage,
            unauthorised repair), we will notify you and offer to return the
            device. In this case, return shipping will be at your expense.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">9. Contact us</h2>
          <p className="mt-2">
            For warranty claims, returns, or any questions about this policy:
          </p>
          <ul className="mt-2 space-y-1">
            <li>
              <strong>Reflow Hub Pty Ltd</strong>
            </li>
            <li>ABN 58 608 364 307</li>
            <li>119 Willoughby Road, Crows Nest, NSW 2065, Australia</li>
            <li>
              Email:{" "}
              <a
                href="mailto:team@reflowhub.com"
                className="underline hover:text-foreground"
              >
                team@reflowhub.com
              </a>
            </li>
            <li>
              WhatsApp:{" "}
              <a
                href="https://wa.me/61426908433"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                +61 426 908 433
              </a>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
