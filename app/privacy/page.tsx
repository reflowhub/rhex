import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Reflow Hub",
  description:
    "How Reflow Hub Pty Ltd collects, uses, and protects your personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: 13 February 2025
      </p>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-foreground/90">
        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">1. About this policy</h2>
          <p className="mt-2">
            Reflow Hub Pty Ltd (ABN 58 608 364 307) (&quot;we&quot;,
            &quot;us&quot;, &quot;our&quot;) operates the Reflow Hub website and
            related services. We are committed to protecting the privacy of your
            personal information in accordance with the{" "}
            <em>Privacy Act 1988</em> (Cth) and the Australian Privacy
            Principles (APPs).
          </p>
          <p className="mt-2">
            This policy explains what personal information we collect, why we
            collect it, how we use and disclose it, and how you can access or
            correct it.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">
            2. Information we collect
          </h2>
          <p className="mt-2">
            We may collect the following types of personal information:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Identity &amp; contact information</strong> — name, email
              address, phone number, postal address.
            </li>
            <li>
              <strong>Payment information</strong> — credit/debit card details
              and billing address processed securely through Stripe. We do not
              store full card numbers on our servers.
            </li>
            <li>
              <strong>Device information</strong> — IMEI numbers, device make
              and model, condition details, and serial numbers submitted during
              trade-in or sale.
            </li>
            <li>
              <strong>Transaction information</strong> — order history,
              trade-in quotes, payout details (PayID or bank account BSB and
              account number).
            </li>
            <li>
              <strong>Technical information</strong> — IP address, browser type
              and version, operating system, referring URL, pages visited, and
              timestamps.
            </li>
            <li>
              <strong>Communications</strong> — records of correspondence with
              us, including WhatsApp messages and emails.
            </li>
          </ul>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">
            3. How we collect information
          </h2>
          <p className="mt-2">We collect personal information:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>directly from you when you use our website, place an order, submit a trade-in quote, create an account, or contact us;</li>
            <li>automatically through cookies, analytics tools, and similar technologies when you browse our website;</li>
            <li>from third-party services such as payment processors (Stripe), shipping carriers, and IMEI verification providers.</li>
          </ul>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">
            4. How we use your information
          </h2>
          <p className="mt-2">We use personal information to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>process and fulfil orders and trade-in transactions;</li>
            <li>verify device identity and check IMEI status;</li>
            <li>process payments and arrange refunds;</li>
            <li>communicate with you about your orders, quotes, and enquiries;</li>
            <li>provide customer support;</li>
            <li>improve our website, products, and services;</li>
            <li>comply with legal obligations, including Australian Consumer Law;</li>
            <li>detect and prevent fraud;</li>
            <li>send promotional communications where you have consented (you may opt out at any time).</li>
          </ul>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">
            5. Disclosure of your information
          </h2>
          <p className="mt-2">
            We may share your personal information with:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Payment processors</strong> — Stripe processes payments on
              our behalf and is subject to its own privacy policy.
            </li>
            <li>
              <strong>Shipping &amp; logistics providers</strong> — to deliver
              products and arrange trade-in shipping.
            </li>
            <li>
              <strong>Cloud &amp; hosting services</strong> — we use Firebase
              (Google Cloud) and Vercel for hosting and data storage.
            </li>
            <li>
              <strong>Analytics services</strong> — such as Google Analytics, to
              understand how our website is used.
            </li>
            <li>
              <strong>Professional advisors</strong> — accountants, lawyers, or
              auditors where reasonably necessary.
            </li>
            <li>
              <strong>Law enforcement or regulators</strong> — where required by
              law, court order, or to protect our rights.
            </li>
          </ul>
          <p className="mt-2">
            We do not sell your personal information to third parties.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">6. Cookies &amp; tracking</h2>
          <p className="mt-2">
            Our website uses cookies and similar technologies to improve your
            experience, remember preferences, and analyse site traffic. You can
            manage cookie preferences through your browser settings. Disabling
            cookies may affect the functionality of certain features.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">7. Data security</h2>
          <p className="mt-2">
            We take reasonable steps to protect your personal information from
            misuse, interference, loss, unauthorised access, modification, or
            disclosure. These measures include encrypted connections (HTTPS),
            secure cloud infrastructure, access controls, and regular security
            reviews.
          </p>
          <p className="mt-2">
            No method of electronic storage or transmission is 100% secure. If
            you become aware of any security issue, please contact us
            immediately.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">8. Data retention</h2>
          <p className="mt-2">
            We retain personal information for as long as necessary to fulfil
            the purposes for which it was collected, to comply with legal
            obligations (including tax and warranty records), and to resolve
            disputes. When personal information is no longer needed, we will
            take reasonable steps to destroy or de-identify it.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">
            9. Your rights
          </h2>
          <p className="mt-2">Under the Australian Privacy Principles, you have the right to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>request access to the personal information we hold about you;</li>
            <li>request correction of inaccurate or out-of-date information;</li>
            <li>opt out of receiving marketing communications;</li>
            <li>make a complaint about how we have handled your personal information.</li>
          </ul>
          <p className="mt-2">
            To exercise any of these rights, please contact us using the details
            below. We will respond to your request within a reasonable timeframe
            (generally within 30 days).
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">10. Complaints</h2>
          <p className="mt-2">
            If you believe we have breached the Australian Privacy Principles,
            please contact us first so we can attempt to resolve the issue. If
            you are not satisfied with our response, you may lodge a complaint
            with the{" "}
            <a
              href="https://www.oaic.gov.au/privacy/privacy-complaints"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Office of the Australian Information Commissioner (OAIC)
            </a>
            .
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">
            11. Changes to this policy
          </h2>
          <p className="mt-2">
            We may update this privacy policy from time to time to reflect
            changes in our practices or legal requirements. The updated version
            will be posted on this page with a revised &quot;last updated&quot;
            date. We encourage you to review this policy periodically.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold">12. Contact us</h2>
          <p className="mt-2">
            If you have any questions about this privacy policy or how we handle
            your personal information, please contact us:
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
