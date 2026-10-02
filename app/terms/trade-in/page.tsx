import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { TRADEIN_TERMS_EFFECTIVE_DATE } from "@/lib/tradein-terms";

export const metadata: Metadata = {
  title: "Trade-In Terms & Conditions | RHEX",
  description:
    "Terms and conditions governing the RHEX trade-in service for electronic devices.",
};

export default function TradeInTermsPage() {
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
        RHEX Trade-In Terms &amp; Conditions
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Effective date: {TRADEIN_TERMS_EFFECTIVE_DATE}
      </p>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-foreground/90">
        {/* Introduction */}
        <section>
          <p className="mt-2">
            These Trade-In Terms &amp; Conditions apply when you submit a device for trade-in through RHEX.
          </p>
          <p className="mt-2">
            RHEX is operated by <strong>Reflow Hub Pty Ltd</strong> (ABN 58 608 364 307) (&quot;RHEX&quot;, &quot;we&quot;, &quot;us&quot; or &quot;our&quot;).
          </p>
          <p className="mt-2">
            By submitting a Trade-In Order or sending a Device to us, you agree to these Terms.
          </p>
          <p className="mt-2">
            These Terms should be read together with our{" "}
            <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>{" "}
            and any specific promotional terms that apply to your Trade-In.
          </p>
        </section>

        {/* 1. Definitions */}
        <section>
          <h2 className="text-lg font-semibold">1. Definitions</h2>
          <p className="mt-2">In these Terms:</p>
          <ul className="mt-2 space-y-2">
            <li>
              <strong>Device</strong> means the mobile phone, tablet, wearable or other electronic device submitted by you for trade-in.
            </li>
            <li>
              <strong>Indicative Quote</strong> means the estimated trade-in value shown to you before we physically inspect your Device.
            </li>
            <li>
              <strong>Final Offer</strong> means the amount we offer to purchase your Device after inspection, testing and verification.
            </li>
            <li>
              <strong>Trade-In Order</strong> means your request to sell a Device to RHEX through our website or another approved RHEX channel.
            </li>
          </ul>
        </section>

        {/* 2. Eligibility */}
        <section>
          <h2 className="text-lg font-semibold">2. Eligibility</h2>
          <p className="mt-2">To use RHEX Trade-In, you must:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>be at least 18 years old;</li>
            <li>have legal capacity to enter into a binding agreement;</li>
            <li>be the legal owner of the Device or be properly authorised by its owner to sell it; and</li>
            <li>provide accurate and complete information requested by RHEX.</li>
          </ul>
          <p className="mt-2">
            We may request identification, proof of purchase, proof of ownership or other information reasonably required to verify a Trade-In, prevent fraud or comply with applicable law.
          </p>
          <p className="mt-2">
            We may refuse or suspend a Trade-In if satisfactory information is not provided.
          </p>
        </section>

        {/* 3. Your ownership of the Device */}
        <section>
          <h2 className="text-lg font-semibold">3. Your ownership of the Device</h2>
          <p className="mt-2">By submitting a Device, you represent and warrant that:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>you own the Device or are authorised by its legal owner to sell it;</li>
            <li>the Device has not been stolen, unlawfully obtained or reported lost;</li>
            <li>the Device is not subject to any finance arrangement, security interest, lease, rental arrangement or other third-party claim;</li>
            <li>the Device&apos;s IMEI, serial number or other identifier has not been unlawfully altered or tampered with; and</li>
            <li>information you provide to us about the Device is accurate to the best of your knowledge.</li>
          </ul>
          <p className="mt-2">
            We may conduct checks concerning a Device&apos;s IMEI, serial number, ownership status, blacklist status or other relevant information.
          </p>
          <p className="mt-2">
            If we reasonably suspect that a Device is stolen, lost, fraudulent, counterfeit or otherwise unlawfully supplied, we may suspend the Trade-In and payment while we investigate and may provide information or the Device to law enforcement or another authority where required or permitted by law.
          </p>
          <p className="mt-2">
            If payment has already been made in circumstances involving fraud, misrepresentation or lack of legal title, we may seek recovery of that payment.
          </p>
        </section>

        {/* 4. Indicative Quotes */}
        <section>
          <h2 className="text-lg font-semibold">4. Indicative Quotes</h2>
          <p className="mt-2">
            Any quote provided before physical inspection of your Device is an <strong>Indicative Quote only</strong>.
          </p>
          <p className="mt-2">
            An Indicative Quote is based on information available to us at the time, which may include:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Device model;</li>
            <li>storage capacity;</li>
            <li>colour or variant;</li>
            <li>reported condition;</li>
            <li>functionality;</li>
            <li>age;</li>
            <li>market value; and</li>
            <li>any applicable promotion.</li>
          </ul>
          <p className="mt-2">
            An Indicative Quote does not constitute an unconditional offer to purchase your Device.
          </p>
          <p className="mt-2">
            All Trade-Ins are subject to inspection, diagnostics and verification.
          </p>
        </section>

        {/* 5. Quote validity */}
        <section>
          <h2 className="text-lg font-semibold">5. Quote validity</h2>
          <p className="mt-2">
            Unless otherwise stated, an Indicative Quote is valid for <strong>14 days from the date it is issued</strong>.
          </p>
          <p className="mt-2">
            Your Device must be received by RHEX within that 14-day period for the Indicative Quote to remain valid.
          </p>
          <p className="mt-2">
            If your Device arrives after the quote has expired, we may reassess its market value and provide a new Indicative Quote or Final Offer.
          </p>
          <p className="mt-2">
            You may reject any revised price and request return of the Device in accordance with these Terms.
          </p>
        </section>

        {/* 6. Shipping your Device */}
        <section>
          <h2 className="text-lg font-semibold">6. Shipping your Device</h2>
          <p className="mt-2">
            Where available, RHEX may provide you with a digital shipping label, QR code or shipping instructions to assist you in sending your Device to us.
          </p>
          <p className="mt-2">
            The provision of a shipping label, QR code or shipping instructions does <strong>not</strong> mean that RHEX assumes risk for your Device while it is in transit.
          </p>
          <p className="mt-2">You are responsible for:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>securely packaging the Device;</li>
            <li>choosing packaging reasonably suitable for protecting the Device in transit;</li>
            <li>ensuring that the Device cannot move excessively within the package;</li>
            <li>complying with the carrier&apos;s packaging and dangerous-goods requirements; and</li>
            <li>correctly lodging the parcel with the nominated carrier.</li>
          </ul>
          <p className="mt-2">
            We recommend using a suitable rigid box and adequate protective cushioning such as bubble wrap or an equivalent protective material.
          </p>
          <p className="mt-2">
            You should retain your lodgement receipt and tracking information.
          </p>
          <p className="mt-2">
            Where available, you may choose to purchase additional insurance, compensation cover or other transit protection directly from the carrier.
          </p>
        </section>

        {/* 7. Risk in transit */}
        <section>
          <h2 className="text-lg font-semibold">7. Risk in transit</h2>
          <p className="mt-2">
            You remain responsible for the Device until it is physically received by RHEX or our authorised processing facility.
          </p>
          <p className="mt-2">
            RHEX is not responsible for loss, theft or damage occurring before receipt of the Device by us, including where:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>we provided the shipping label or QR code;</li>
            <li>the carrier loses or damages the parcel; or</li>
            <li>the Device is inadequately packaged.</li>
          </ul>
          <p className="mt-2">
            We will assess the Device based on the condition in which it is received.
          </p>
          <p className="mt-2">
            Nothing in this clause excludes any right or remedy that cannot lawfully be excluded.
          </p>
        </section>

        {/* 8. What to remove before shipping */}
        <section>
          <h2 className="text-lg font-semibold">8. What to remove before shipping</h2>
          <p className="mt-2">Before sending your Device, you should:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>back up any information you wish to retain;</li>
            <li>remove SIM cards and removable memory cards;</li>
            <li>remove cases, chargers and other accessories unless specifically requested;</li>
            <li>sign out of personal accounts;</li>
            <li>disable Find My, Activation Lock and similar security features; and</li>
            <li>remove PINs, passwords or other access restrictions where reasonably possible.</li>
          </ul>
          <p className="mt-2">
            Unless otherwise agreed, accessories, SIM cards, memory cards, packaging and other items sent with a Device may not be returned and may be recycled, securely destroyed or otherwise disposed of.
          </p>
        </section>

        {/* 9. Personal data and data erasure */}
        <section>
          <h2 className="text-lg font-semibold">9. Personal data and data erasure</h2>
          <p className="mt-2">
            You are responsible for backing up any information you wish to retain before sending your Device.
          </p>
          <p className="mt-2">
            By submitting a Device to RHEX, you authorise us and our service providers to:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>access the Device to the extent reasonably necessary to assess it;</li>
            <li>perform diagnostic testing;</li>
            <li>factory-reset the Device;</li>
            <li>erase data;</li>
            <li>remove software configurations where appropriate; and</li>
            <li>otherwise process the Device for the purposes of completing the Trade-In.</li>
          </ul>
          <p className="mt-2">
            <strong>Data erasure may be irreversible.</strong>
          </p>
          <p className="mt-2">
            RHEX is not responsible for loss of personal data stored on a Device submitted for Trade-In, except to the extent that liability cannot lawfully be excluded.
          </p>
          <p className="mt-2">
            Where a Device cannot be securely erased, we may reject the Device or process it through an alternative secure workflow.
          </p>
        </section>

        {/* 10. Device locks and account restrictions */}
        <section>
          <h2 className="text-lg font-semibold">10. Device locks and account restrictions</h2>
          <p className="mt-2">
            Devices should be submitted without account or security restrictions including, where applicable:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Apple Activation Lock or Find My;</li>
            <li>Google Factory Reset Protection;</li>
            <li>Samsung or other manufacturer account locks;</li>
            <li>Mobile Device Management enrolment;</li>
            <li>enterprise enrolment restrictions; or</li>
            <li>PIN, password or screen-lock restrictions that prevent assessment.</li>
          </ul>
          <p className="mt-2">
            If a Device remains locked, we may contact you and give you an opportunity to remove the restriction remotely.
          </p>
          <p className="mt-2">
            While the restriction remains in place, we may suspend assessment and payment.
          </p>
          <p className="mt-2">
            If the restriction is not removed within the timeframe specified by us, we may reject the Trade-In.
          </p>
          <p className="mt-2">
            Any uncollected Device will be dealt with in accordance with applicable law.
          </p>
        </section>

        {/* 11. Inspection and diagnostics */}
        <section>
          <h2 className="text-lg font-semibold">11. Inspection and diagnostics</h2>
          <p className="mt-2">After receiving your Device, we may inspect and test it to verify:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>model and storage capacity;</li>
            <li>IMEI and serial number;</li>
            <li>cosmetic condition;</li>
            <li>display and touchscreen condition;</li>
            <li>battery condition;</li>
            <li>cameras;</li>
            <li>buttons;</li>
            <li>charging functionality;</li>
            <li>connectivity;</li>
            <li>biometric functions;</li>
            <li>audio;</li>
            <li>water or liquid damage;</li>
            <li>signs of repair or component replacement;</li>
            <li>software or security restrictions; and</li>
            <li>any other matter reasonably relevant to its condition or resale value.</li>
          </ul>
          <p className="mt-2">
            We may use third-party diagnostic or processing providers to perform some or all of these checks.
          </p>
        </section>

        {/* 12. Regrading and revised offers */}
        <section>
          <h2 className="text-lg font-semibold">12. Regrading and revised offers</h2>
          <p className="mt-2">
            Your Final Offer may differ from the Indicative Quote if our assessment identifies a difference in the Device&apos;s:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>model;</li>
            <li>storage capacity;</li>
            <li>specifications;</li>
            <li>reported condition;</li>
            <li>cosmetic condition;</li>
            <li>functionality;</li>
            <li>battery condition;</li>
            <li>repair history;</li>
            <li>parts or component authenticity;</li>
            <li>security or account status;</li>
            <li>IMEI or blacklist status; or</li>
            <li>other material attribute affecting value.</li>
          </ul>
          <p className="mt-2">
            We may also revise an Indicative Quote where it resulted from an obvious pricing, system, typographical, data-feed or technical error.
          </p>
          <p className="mt-2">
            Where the Final Offer is lower than the Indicative Quote, we will notify you of the revised amount.
          </p>
        </section>

        {/* 13. Accepting a Final Offer */}
        <section>
          <h2 className="text-lg font-semibold">13. Accepting a Final Offer</h2>
          <p className="mt-2">
            If our assessment confirms that your Device qualifies for the Indicative Quote, we may treat the confirmed amount as the Final Offer and proceed with the Trade-In without requiring additional approval.
          </p>
          <p className="mt-2">
            If we reduce the amount, you will be given the opportunity to:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>accept the revised Final Offer; or</li>
            <li>reject it and request return of your Device.</li>
          </ul>
          <p className="mt-2">
            A materially reduced Final Offer will not be treated as accepted merely because you do not respond.
          </p>
          <p className="mt-2">
            We may set a reasonable period for you to respond to a revised Final Offer and may send reminder notices.
          </p>
          <p className="mt-2">
            If you do not respond, we may continue to hold the Device while attempting to contact you. Any Device that remains unclaimed will be dealt with in accordance with applicable law.
          </p>
        </section>

        {/* 14. Right to reject a Device */}
        <section>
          <h2 className="text-lg font-semibold">14. Right to reject a Device</h2>
          <p className="mt-2">We may reject a Trade-In where the Device:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>differs materially from the Device submitted in the Trade-In Order;</li>
            <li>is counterfeit or not an authentic supported Device;</li>
            <li>is reported stolen, lost or blacklisted;</li>
            <li>has an altered or invalid IMEI or serial number;</li>
            <li>is subject to an unresolved finance or ownership issue;</li>
            <li>poses a health, safety or battery hazard;</li>
            <li>is excessively contaminated;</li>
            <li>cannot reasonably be assessed;</li>
            <li>cannot be securely processed because of security restrictions;</li>
            <li>falls outside our accepted Device categories; or</li>
            <li>appears to involve fraud or unlawful activity.</li>
          </ul>
          <p className="mt-2">
            Where reasonably practicable and lawful, we will notify you if a Device is rejected.
          </p>
        </section>

        {/* 15. Repairs and replacement parts */}
        <section>
          <h2 className="text-lg font-semibold">15. Repairs and replacement parts</h2>
          <p className="mt-2">Our assessment may take into account whether a Device:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>has previously been repaired;</li>
            <li>contains aftermarket or non-original parts;</li>
            <li>is missing components;</li>
            <li>has been modified;</li>
            <li>has been rooted, jailbroken or otherwise altered; or</li>
            <li>has repairs that materially affect its functionality, safety or resale value.</li>
          </ul>
          <p className="mt-2">
            The presence of repaired or replacement components does not necessarily mean the Device will be rejected, but it may affect the Final Offer.
          </p>
        </section>

        {/* 16. Return of a Device */}
        <section>
          <h2 className="text-lg font-semibold">16. Return of a Device</h2>
          <p className="mt-2">
            If you reject a revised Final Offer, we will ordinarily arrange one standard return shipment to an Australian address provided by you at no additional charge, unless otherwise stated before the Trade-In is submitted.
          </p>
          <p className="mt-2">
            You are responsible for providing an accurate and deliverable return address.
          </p>
          <p className="mt-2">If a returned Device:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>is refused;</li>
            <li>cannot be delivered because of incorrect address information;</li>
            <li>is not collected; or</li>
            <li>must be sent again at your request,</li>
          </ul>
          <p className="mt-2">
            we may require you to pay the reasonable cost of additional shipping.
          </p>
          <p className="mt-2">
            A Device may not be returned where doing so would be unlawful or where it has been provided to an authority in connection with a lawful investigation.
          </p>
        </section>

        {/* 17. Unidentified or unmatched Devices */}
        <section>
          <h2 className="text-lg font-semibold">17. Unidentified or unmatched Devices</h2>
          <p className="mt-2">
            If we receive a Device that cannot reasonably be matched to an existing Trade-In Order, we may hold it while attempting to identify its owner.
          </p>
          <p className="mt-2">
            Receipt of an unidentified Device does not, by itself, transfer ownership of that Device to RHEX.
          </p>
          <p className="mt-2">
            We may request information reasonably necessary to verify ownership before returning or processing the Device.
          </p>
          <p className="mt-2">
            Unclaimed Devices will be dealt with in accordance with applicable law.
          </p>
        </section>

        {/* 18. When the sale becomes binding */}
        <section>
          <h2 className="text-lg font-semibold">18. When the sale becomes binding</h2>
          <p className="mt-2">
            Where the Final Offer equals the accepted Indicative Quote, the sale becomes binding when RHEX completes its assessment and confirms that the Device qualifies for that amount.
          </p>
          <p className="mt-2">
            Where the Final Offer differs from the Indicative Quote, the sale becomes binding when you accept the revised Final Offer.
          </p>
          <p className="mt-2">
            At that point, ownership and title to the Device transfer to RHEX and RHEX may sell, transfer, repair, refurbish, recycle, dismantle or otherwise deal with the Device.
          </p>
          <p className="mt-2">
            You cannot cancel or reverse the Trade-In after title has transferred, except where required by law.
          </p>
        </section>

        {/* 19. Payment */}
        <section>
          <h2 className="text-lg font-semibold">19. Payment</h2>
          <p className="mt-2">
            We will ordinarily make payment within <strong>3–5 business days</strong> after:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>a binding sale has been formed under clause 18;</li>
            <li>any required identity or ownership verification has been completed; and</li>
            <li>you have provided valid payment information.</li>
          </ul>
          <p className="mt-2">
            Payment may be made by PayID, bank transfer or another payment method offered by RHEX.
          </p>
          <p className="mt-2">
            You are responsible for ensuring that payment details supplied to us are accurate.
          </p>
          <p className="mt-2">
            We are not responsible for delay or loss caused by incorrect payment details provided by you.
          </p>
          <p className="mt-2">
            If a payment fails, is rejected or is returned, we may contact you to obtain updated payment information.
          </p>
          <p className="mt-2">
            Any duplicate or erroneous payment remains recoverable by RHEX.
          </p>
        </section>

        {/* 20. Promotional Trade-In offers */}
        <section>
          <h2 className="text-lg font-semibold">20. Promotional Trade-In offers</h2>
          <p className="mt-2">
            From time to time, a Trade-In may qualify for a promotional bonus or additional value.
          </p>
          <p className="mt-2">
            Promotional amounts may be subject to separate eligibility criteria, promotional periods or partner terms.
          </p>
          <p className="mt-2">
            Unless otherwise stated, any promotional amount is separate from the underlying assessed value of the Device.
          </p>
          <p className="mt-2">
            A Device that is regraded may cease to qualify for all or part of a promotion where the applicable promotional conditions are no longer satisfied.
          </p>
        </section>

        {/* 21. Fraud and misuse */}
        <section>
          <h2 className="text-lg font-semibold">21. Fraud and misuse</h2>
          <p className="mt-2">You must not use RHEX Trade-In to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>submit Devices you do not own;</li>
            <li>knowingly provide false or misleading information;</li>
            <li>manipulate Device identifiers;</li>
            <li>abuse promotions;</li>
            <li>create fraudulent transactions; or</li>
            <li>engage in unlawful activity.</li>
          </ul>
          <p className="mt-2">
            We may cancel or suspend Trade-In Orders where we reasonably suspect fraud, misuse or unlawful conduct.
          </p>
        </section>

        {/* 22. Limitation of liability */}
        <section>
          <h2 className="text-lg font-semibold">22. Limitation of liability</h2>
          <p className="mt-2">To the maximum extent permitted by law, RHEX will not be liable for:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>data you fail to back up before submitting a Device;</li>
            <li>loss or damage occurring before the Device is received by us;</li>
            <li>loss arising from inaccurate information supplied by you;</li>
            <li>accessories or removable media sent contrary to our instructions; or</li>
            <li>indirect or consequential loss arising from a Trade-In.</li>
          </ul>
          <p className="mt-2">
            Nothing in these Terms excludes, restricts or modifies any consumer guarantee, statutory right or remedy that cannot lawfully be excluded, restricted or modified.
          </p>
        </section>

        {/* 23. Privacy */}
        <section>
          <h2 className="text-lg font-semibold">23. Privacy</h2>
          <p className="mt-2">
            We collect, use and disclose personal information in accordance with our{" "}
            <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
          </p>
          <p className="mt-2">
            Information collected in connection with a Trade-In may include:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>your name and contact details;</li>
            <li>payment information;</li>
            <li>Device model;</li>
            <li>IMEI and serial number;</li>
            <li>diagnostic and grading information;</li>
            <li>identity or ownership verification information; and</li>
            <li>transaction and shipping information.</li>
          </ul>
          <p className="mt-2">
            We may disclose relevant information to service providers, logistics providers, diagnostic providers, payment providers, law enforcement agencies and other parties where reasonably necessary to operate the Trade-In service or comply with applicable law.
          </p>
        </section>

        {/* 24. Changes to these Terms */}
        <section>
          <h2 className="text-lg font-semibold">24. Changes to these Terms</h2>
          <p className="mt-2">
            We may update these Terms from time to time.
          </p>
          <p className="mt-2">
            The Terms that apply to your Trade-In will ordinarily be those in effect when you submit your Trade-In Order, except where a change is required by law or agreed with you.
          </p>
        </section>

        {/* 25. Australian Consumer Law */}
        <section>
          <h2 className="text-lg font-semibold">25. Australian Consumer Law</h2>
          <p className="mt-2">
            Nothing in these Terms is intended to exclude or limit any rights you have under the{" "}
            <em>Competition and Consumer Act 2010 (Cth)</em>, including the Australian Consumer Law, or any other rights that cannot lawfully be excluded.
          </p>
        </section>

        {/* 26. Governing law */}
        <section>
          <h2 className="text-lg font-semibold">26. Governing law</h2>
          <p className="mt-2">
            These Terms are governed by the laws of New South Wales, Australia.
          </p>
          <p className="mt-2">
            You submit to the non-exclusive jurisdiction of the courts of New South Wales and any courts entitled to hear appeals from them.
          </p>
        </section>

        {/* 27. Contact */}
        <section>
          <h2 className="text-lg font-semibold">27. Contact</h2>
          <p className="mt-2">
            For questions about a Trade-In, please contact:
          </p>
          <ul className="mt-2 space-y-1">
            <li>
              <strong>Reflow Hub Pty Ltd</strong>
            </li>
            <li>
              Email:{" "}
              <a
                href="mailto:tradein@reflowhub.com"
                className="underline hover:text-foreground"
              >
                tradein@reflowhub.com
              </a>
            </li>
            <li>Address: 119 Willoughby Road, Crows Nest NSW Australia 2065</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
