import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms & Conditions | Reflow Hub",
  description:
    "Terms and conditions governing the use of the Reflow Hub website and services.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4">
      <div className="flex items-center justify-between py-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo-rhex.svg" alt="rhex" width={28} height={28} className="h-7 w-7" />
          <span className="text-xl font-bold tracking-tight">rhex</span>
        </Link>
        <Link href="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
      <h1 className="text-3xl font-bold tracking-tight">
        Terms &amp; Conditions
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: 13 February 2025
      </p>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-foreground/90">
        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">1. About these terms</h2>
          <p className="mt-2">
            These terms and conditions (&quot;Terms&quot;) govern your access to
            and use of the website and services operated by Reflow Hub Pty Ltd
            (ABN 58 608 364 307) (&quot;Reflow Hub&quot;, &quot;we&quot;,
            &quot;us&quot;, &quot;our&quot;), including our online store,
            trade-in service, and partner programme.
          </p>
          <p className="mt-2">
            By using our website or services, you agree to be bound by these
            Terms. If you do not agree, please do not use our website or
            services.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">2. Eligibility</h2>
          <p className="mt-2">
            You must be at least 18 years of age and have the legal capacity to
            enter into a binding agreement to use our services. By placing an
            order or submitting a trade-in quote, you confirm that you meet
            these requirements.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">
            3. Products &amp; descriptions
          </h2>
          <p className="mt-2">
            We sell certified refurbished electronic devices including phones,
            tablets, and watches. All products are individually tested,
            inspected, and graded before listing. Product descriptions, images,
            and specifications are provided in good faith and are as accurate as
            reasonably possible.
          </p>
          <p className="mt-2">
            As our products are refurbished, they may show minor cosmetic signs
            of prior use consistent with the listed grade. Each listing includes
            actual photos of the specific unit you will receive.
          </p>
          <p className="mt-2">
            We reserve the right to correct any errors in pricing or product
            descriptions and to cancel orders affected by such errors.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">4. Pricing &amp; payment</h2>
          <p className="mt-2">
            All prices on our website are displayed in Australian Dollars (AUD)
            and include GST unless otherwise stated. We accept payment via
            credit card, debit card, and other methods available through our
            payment processor, Stripe.
          </p>
          <p className="mt-2">
            An order is not confirmed until we have received payment in full and
            sent you an order confirmation. We reserve the right to refuse or
            cancel any order at our discretion.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">5. Shipping &amp; delivery</h2>
          <p className="mt-2">
            We ship within Australia using tracked delivery services. Estimated
            delivery times are provided at checkout and are indicative only — we
            are not liable for delays caused by shipping carriers or
            circumstances beyond our control.
          </p>
          <p className="mt-2">
            Risk of loss passes to you upon delivery. If a parcel is lost or
            damaged in transit, please contact us within 7 days of the estimated
            delivery date so we can investigate and arrange a resolution.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">
            6. Warranty, returns &amp; refunds
          </h2>
          <p className="mt-2">
            Our warranty, returns, change-of-mind, and refund policies are set
            out in our{" "}
            <Link href="/warranty" className="underline hover:text-foreground">
              Warranty &amp; Returns Policy
            </Link>
            . By purchasing from us, you agree to those terms.
          </p>
          <p className="mt-2">
            Nothing in these Terms excludes, restricts, or modifies any consumer
            guarantee, right, or remedy under the{" "}
            <em>Australian Consumer Law</em> (Schedule 2 of the{" "}
            <em>Competition and Consumer Act 2010</em>) or any other applicable
            law that cannot be excluded, restricted, or modified by agreement.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">7. Trade-in service</h2>
          <p className="mt-2">By submitting a trade-in quote, you:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              confirm that you are the legal owner of the device or are
              authorised to sell it;
            </li>
            <li>
              confirm the device is not stolen, blacklisted, subject to a
              finance agreement, or otherwise encumbered;
            </li>
            <li>
              agree to remove all personal data, accounts (including iCloud /
              Google account locks), and passwords before shipping;
            </li>
            <li>
              acknowledge that the final payout may differ from the initial
              quote if the device&apos;s condition does not match what was
              described — in which case you may accept the revised offer or have
              the device returned to you at no cost.
            </li>
          </ul>
          <p className="mt-2">
            Trade-in quotes are valid for 14 days from the date of issue.
            Payouts are made via PayID or bank transfer within 3–5 business days
            of inspection.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">8. Intellectual property</h2>
          <p className="mt-2">
            All content on this website — including text, graphics, logos,
            images, and software — is the property of Reflow Hub Pty Ltd or its
            licensors and is protected by Australian and international
            intellectual property laws. You may not reproduce, distribute, or
            otherwise use any content without our prior written consent.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">9. User conduct</h2>
          <p className="mt-2">You agree not to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              use our website for any unlawful purpose or in violation of these
              Terms;
            </li>
            <li>
              submit false, misleading, or inaccurate information (including
              device condition for trade-ins);
            </li>
            <li>
              attempt to gain unauthorised access to our systems or data;
            </li>
            <li>
              interfere with the proper functioning of our website or services.
            </li>
          </ul>
          <p className="mt-2">
            We reserve the right to suspend or terminate your access if you
            breach these Terms.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">
            10. Limitation of liability
          </h2>
          <p className="mt-2">
            To the maximum extent permitted by law, Reflow Hub&apos;s total
            liability to you for any claim arising out of or in connection with
            these Terms or our services is limited to the amount you paid for
            the relevant product or service.
          </p>
          <p className="mt-2">
            We are not liable for any indirect, incidental, special, or
            consequential loss or damage, including loss of profit, data, or
            business opportunity, however caused.
          </p>
          <p className="mt-2">
            This clause does not apply to liability that cannot be excluded
            under the <em>Australian Consumer Law</em> or other mandatory
            legislation.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">11. Indemnification</h2>
          <p className="mt-2">
            You agree to indemnify and hold harmless Reflow Hub, its directors,
            employees, and agents from any claims, losses, liabilities, damages,
            costs, or expenses (including legal fees) arising from your breach
            of these Terms or your misuse of our services.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">12. Privacy</h2>
          <p className="mt-2">
            Your personal information is handled in accordance with our{" "}
            <Link href="/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </Link>
            . By using our services, you consent to the collection and use of
            your information as described in that policy.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">13. Governing law</h2>
          <p className="mt-2">
            These Terms are governed by the laws of New South Wales, Australia.
            You submit to the non-exclusive jurisdiction of the courts of New
            South Wales and any courts that may hear appeals from those courts.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">14. Severability</h2>
          <p className="mt-2">
            If any provision of these Terms is found to be invalid or
            unenforceable, the remaining provisions will continue in full force
            and effect.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">15. Changes to these terms</h2>
          <p className="mt-2">
            We may update these Terms from time to time. The updated version
            will be posted on this page with a revised &quot;last updated&quot;
            date. Continued use of our website or services after changes are
            posted constitutes acceptance of the revised Terms.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">16. Contact us</h2>
          <p className="mt-2">
            If you have any questions about these Terms, please contact us:
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
