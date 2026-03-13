import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Smartphone,
  Tablet,
  Watch,
  ShieldCheck,
  Battery,
  Leaf,
  Repeat,
  BadgeDollarSign,
  Building2,
  Users,
  Mail,
  MapPin,
} from "lucide-react";

export const metadata: Metadata = {
  title: "About | rhex — Certified Refurbished Devices & Trade-In",
  description:
    "rhex by Reflow Hub is Australia's platform for buying certified refurbished phones, tablets, and watches, or trading in your used devices for cash. 12-month warranty, individually tested, and sustainably sourced.",
  openGraph: {
    title: "About rhex — Certified Refurbished Devices & Trade-In",
    description:
      "Buy certified refurbished phones, tablets, and watches or trade in your used devices for cash. 12-month warranty, individually tested, battery health verified.",
    url: "https://rhex.app/about",
    siteName: "rhex",
    type: "website",
    locale: "en_AU",
  },
  twitter: {
    card: "summary",
    title: "About rhex — Certified Refurbished Devices & Trade-In",
    description:
      "Buy certified refurbished phones, tablets, and watches or trade in your used devices for cash. 12-month warranty. Australia-wide.",
  },
  alternates: {
    canonical: "https://rhex.app/about",
  },
};

/* -------------------------------------------------------------------------- */
/*  Schema.org JSON-LD structured data                                        */
/* -------------------------------------------------------------------------- */

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://rhex.app/#organization",
  name: "Reflow Hub Pty Ltd",
  alternateName: "rhex",
  url: "https://rhex.app",
  logo: "https://rhex.app/logo-rhex.svg",
  description:
    "rhex by Reflow Hub is an Australian platform for buying certified refurbished phones, tablets, and smartwatches, and trading in used devices for cash. Every device is individually tested, graded, and comes with a 12-month warranty.",
  foundingDate: "2019",
  legalName: "Reflow Hub Pty Ltd",
  taxID: "58 608 364 307",
  areaServed: [
    { "@type": "Country", name: "Australia" },
    { "@type": "Country", name: "New Zealand" },
  ],
  address: {
    "@type": "PostalAddress",
    streetAddress: "119 Willoughby Road",
    addressLocality: "Crows Nest",
    addressRegion: "NSW",
    postalCode: "2065",
    addressCountry: "AU",
  },
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: "team@reflowhub.com",
      telephone: "+61-426-908-433",
      availableLanguage: ["English"],
    },
  ],
  sameAs: ["https://reflowhub.com"],
  knowsAbout: [
    "Refurbished smartphones",
    "Refurbished tablets",
    "Refurbished smartwatches",
    "Device trade-in",
    "E-waste reduction",
    "Circular economy for electronics",
    "iPhone refurbishment",
    "Samsung Galaxy refurbishment",
    "Apple Watch refurbishment",
    "Device diagnostics",
  ],
};

const webSiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://rhex.app/#website",
  name: "rhex",
  url: "https://rhex.app",
  publisher: { "@id": "https://rhex.app/#organization" },
  description:
    "Buy certified refurbished devices or trade in yours for cash.",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://rhex.app/buy?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

const aboutPageSchema = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "@id": "https://rhex.app/about/#webpage",
  url: "https://rhex.app/about",
  name: "About rhex — Certified Refurbished Devices & Trade-In",
  description:
    "Learn about rhex by Reflow Hub — Australia's platform for certified refurbished devices and device trade-in.",
  isPartOf: { "@id": "https://rhex.app/#website" },
  about: { "@id": "https://rhex.app/#organization" },
  inLanguage: "en-AU",
};

const offerCatalogSchema = {
  "@context": "https://schema.org",
  "@type": "OfferCatalog",
  "@id": "https://rhex.app/#catalog",
  name: "rhex Product & Service Catalog",
  description:
    "Certified refurbished devices and trade-in services offered by rhex.",
  provider: { "@id": "https://rhex.app/#organization" },
  itemListElement: [
    {
      "@type": "OfferCatalog",
      name: "Certified Refurbished Devices",
      description:
        "Individually tested and graded refurbished phones, tablets, and smartwatches with a 12-month warranty and battery health verification.",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Product",
            name: "Certified Refurbished Phones",
            category: "Smartphones",
            description:
              "Refurbished iPhones and Android phones, individually tested with verified battery health and 12-month warranty.",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Product",
            name: "Certified Refurbished Tablets",
            category: "Tablets",
            description:
              "Refurbished iPads and Android tablets, individually tested with verified battery health and 12-month warranty.",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Product",
            name: "Certified Refurbished Smartwatches",
            category: "Smartwatches",
            description:
              "Refurbished Apple Watches and smartwatches, individually tested and graded with 12-month warranty.",
          },
        },
      ],
    },
    {
      "@type": "Service",
      name: "Device Trade-In",
      description:
        "Instant trade-in quotes for used phones, tablets, and smartwatches. Get paid cash for your old device.",
      provider: { "@id": "https://rhex.app/#organization" },
      serviceType: "Trade-In",
      areaServed: { "@type": "Country", name: "Australia" },
      url: "https://rhex.app/sell",
    },
    {
      "@type": "Service",
      name: "Business Bulk Trade-In",
      description:
        "Bulk trade-in estimator for businesses. Upload a device manifest and get an instant valuation for fleet devices.",
      provider: { "@id": "https://rhex.app/#organization" },
      serviceType: "Bulk Trade-In",
      areaServed: { "@type": "Country", name: "Australia" },
      url: "https://rhex.app/sell/business",
    },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is rhex?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "rhex is a certified refurbished device marketplace operated by Reflow Hub Pty Ltd. We sell individually tested and graded refurbished phones, tablets, and smartwatches, and offer trade-in services for used devices. Every device comes with a 12-month warranty and verified battery health.",
      },
    },
    {
      "@type": "Question",
      name: "What warranty do rhex devices come with?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Every certified refurbished device purchased from rhex comes with a 12-month warranty covering manufacturing defects and hardware failures. We also offer a 30-day change-of-mind return policy.",
      },
    },
    {
      "@type": "Question",
      name: "How does the rhex trade-in service work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Visit rhex.app/sell to get an instant quote for your used device. Select your device model, storage, and condition to receive a competitive cash offer. For businesses with multiple devices, use the bulk trade-in estimator at rhex.app/sell/business.",
      },
    },
    {
      "@type": "Question",
      name: "What devices does rhex sell?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "rhex sells certified refurbished smartphones (iPhones, Samsung Galaxy, Google Pixel), tablets (iPads, Android tablets), and smartwatches (Apple Watch). All devices are individually tested, photographed, and graded for cosmetic condition and battery health.",
      },
    },
    {
      "@type": "Question",
      name: "Where is rhex located?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "rhex is operated by Reflow Hub Pty Ltd (ABN 58 608 364 307), located at 119 Willoughby Road, Crows Nest, NSW 2065, Australia. We ship certified refurbished devices Australia-wide and to New Zealand.",
      },
    },
    {
      "@type": "Question",
      name: "How much can I save buying refurbished from rhex?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Customers typically save 30–50% compared to buying new devices. Every rhex refurbished device is tested for full performance, so you get a like-new experience at a fraction of the cost while reducing e-waste.",
      },
    },
  ],
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://rhex.app",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "About",
      item: "https://rhex.app/about",
    },
  ],
};

/* -------------------------------------------------------------------------- */
/*  Page component                                                            */
/* -------------------------------------------------------------------------- */

export default function AboutPage() {
  return (
    <>
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webSiteSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(aboutPageSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(offerCatalogSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema),
        }}
      />

      <div className="mx-auto max-w-3xl px-4 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between py-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo-rhex.svg"
              alt="rhex"
              width={28}
              height={28}
              className="h-7 w-7"
            />
            <span className="text-xl font-bold tracking-tight">rhex</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold tracking-tight">About rhex</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Certified refurbished devices &amp; trade-in for cash
        </p>

        <div className="mt-10 space-y-12 text-sm leading-relaxed text-foreground/90">
          {/* -------------------------------------------------------------- */}
          {/* Introduction */}
          {/* -------------------------------------------------------------- */}
          <section>
            <h2 className="text-lg font-semibold">Who we are</h2>
            <p className="mt-3">
              <strong>rhex</strong> is the retail and business platform
              operated by{" "}
              <strong>Reflow Hub Pty Ltd</strong> (ABN&nbsp;58&nbsp;608&nbsp;364&nbsp;307),
              an Australian company headquartered in Crows Nest, Sydney. We
              make it easy to buy high-quality certified refurbished phones,
              tablets, and smartwatches&nbsp;&mdash; or trade in your used
              devices for cash.
            </p>
            <p className="mt-3">
              Every device listed on rhex is individually tested, graded for
              cosmetic condition, photographed, and verified for battery
              health before it reaches you. We back every purchase with a{" "}
              <strong>12&#8209;month warranty</strong> and a{" "}
              <strong>30&#8209;day change&#8209;of&#8209;mind return policy</strong>.
            </p>
          </section>

          {/* -------------------------------------------------------------- */}
          {/* What we offer */}
          {/* -------------------------------------------------------------- */}
          <section>
            <h2 className="text-lg font-semibold">What we offer</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {/* Buy */}
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 font-medium">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  Certified Refurbished Devices
                </div>
                <p className="mt-2 text-muted-foreground">
                  Browse our curated range of refurbished iPhones, Samsung
                  Galaxy phones, iPads, Android tablets, Apple Watches, and
                  more. Every device is individually tested and comes with
                  verified battery health.
                </p>
                <Link
                  href="/buy"
                  className="mt-3 inline-block text-sm font-medium underline underline-offset-4 hover:text-foreground"
                >
                  Shop devices &rarr;
                </Link>
              </div>

              {/* Sell */}
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 font-medium">
                  <Repeat className="h-4 w-4 text-muted-foreground" />
                  Device Trade-In
                </div>
                <p className="mt-2 text-muted-foreground">
                  Get an instant cash quote for your used phone, tablet, or
                  watch. Select your device, answer a few questions about its
                  condition, and receive a competitive offer.
                </p>
                <Link
                  href="/sell"
                  className="mt-3 inline-block text-sm font-medium underline underline-offset-4 hover:text-foreground"
                >
                  Get a trade-in quote &rarr;
                </Link>
              </div>

              {/* Business */}
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 font-medium">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Business Bulk Trade-In
                </div>
                <p className="mt-2 text-muted-foreground">
                  Managing a fleet of devices? Upload a manifest of your
                  company&apos;s devices and get a bulk trade-in estimate
                  instantly. Ideal for IT asset disposition.
                </p>
                <Link
                  href="/sell/business"
                  className="mt-3 inline-block text-sm font-medium underline underline-offset-4 hover:text-foreground"
                >
                  Bulk estimate &rarr;
                </Link>
              </div>

              {/* Partner */}
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 font-medium">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Partner Program
                </div>
                <p className="mt-2 text-muted-foreground">
                  Join our partner and affiliate network. Earn commissions on
                  referrals or access wholesale trade-in pricing for your
                  repair shop or reseller business.
                </p>
                <Link
                  href="/partner"
                  className="mt-3 inline-block text-sm font-medium underline underline-offset-4 hover:text-foreground"
                >
                  Partner dashboard &rarr;
                </Link>
              </div>
            </div>
          </section>

          {/* -------------------------------------------------------------- */}
          {/* Device categories */}
          {/* -------------------------------------------------------------- */}
          <section>
            <h2 className="text-lg font-semibold">Device categories</h2>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center rounded-xl border border-border bg-card p-5 text-center">
                <Smartphone className="h-6 w-6 text-muted-foreground" />
                <span className="mt-2 font-medium">Phones</span>
                <span className="mt-1 text-xs text-muted-foreground">
                  iPhone, Samsung, Google Pixel
                </span>
              </div>
              <div className="flex flex-col items-center rounded-xl border border-border bg-card p-5 text-center">
                <Tablet className="h-6 w-6 text-muted-foreground" />
                <span className="mt-2 font-medium">Tablets</span>
                <span className="mt-1 text-xs text-muted-foreground">
                  iPad, Android tablets
                </span>
              </div>
              <div className="flex flex-col items-center rounded-xl border border-border bg-card p-5 text-center">
                <Watch className="h-6 w-6 text-muted-foreground" />
                <span className="mt-2 font-medium">Watches</span>
                <span className="mt-1 text-xs text-muted-foreground">
                  Apple Watch, smartwatches
                </span>
              </div>
            </div>
          </section>

          {/* -------------------------------------------------------------- */}
          {/* Why buy refurbished */}
          {/* -------------------------------------------------------------- */}
          <section>
            <h2 className="text-lg font-semibold">
              Why buy refurbished from rhex?
            </h2>
            <div className="mt-4 space-y-4">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">Individually tested &amp; graded</p>
                  <p className="mt-1 text-muted-foreground">
                    Every device undergoes a comprehensive multi-point
                    inspection. We test all hardware functions, verify IMEI
                    status, and grade cosmetic condition so you know exactly
                    what you&apos;re getting.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Battery className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">Battery health verified</p>
                  <p className="mt-1 text-muted-foreground">
                    We report the actual battery health percentage for every
                    device, so you can make an informed decision before
                    purchasing.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <BadgeDollarSign className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">Save 30&ndash;50%</p>
                  <p className="mt-1 text-muted-foreground">
                    Get a fully functional, high-quality device at a fraction
                    of the retail price. Competitive pricing across all
                    categories in AUD and NZD.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Leaf className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">Reduce e-waste</p>
                  <p className="mt-1 text-muted-foreground">
                    Choosing refurbished keeps devices in circulation longer
                    and reduces the environmental impact of electronics
                    manufacturing. Every refurbished device is one less in
                    landfill.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* -------------------------------------------------------------- */}
          {/* FAQ */}
          {/* -------------------------------------------------------------- */}
          <section>
            <h2 className="text-lg font-semibold">
              Frequently asked questions
            </h2>
            <div className="mt-4 space-y-6">
              <div>
                <h3 className="font-medium">What is rhex?</h3>
                <p className="mt-1 text-muted-foreground">
                  rhex is a certified refurbished device marketplace operated
                  by Reflow Hub Pty Ltd. We sell individually tested and
                  graded refurbished phones, tablets, and smartwatches, and
                  offer trade-in services for used devices. Every device comes
                  with a 12-month warranty and verified battery health.
                </p>
              </div>
              <div>
                <h3 className="font-medium">
                  What warranty do rhex devices come with?
                </h3>
                <p className="mt-1 text-muted-foreground">
                  Every certified refurbished device purchased from rhex comes
                  with a 12-month warranty covering manufacturing defects and
                  hardware failures. We also offer a 30-day
                  change-of-mind return policy.
                </p>
              </div>
              <div>
                <h3 className="font-medium">
                  How does the trade-in service work?
                </h3>
                <p className="mt-1 text-muted-foreground">
                  Visit{" "}
                  <Link href="/sell" className="underline underline-offset-4">
                    rhex.app/sell
                  </Link>{" "}
                  to get an instant quote for your used device. Select your
                  device model, storage, and condition to receive a competitive
                  cash offer. For businesses with multiple devices, use the{" "}
                  <Link
                    href="/sell/business"
                    className="underline underline-offset-4"
                  >
                    bulk trade-in estimator
                  </Link>
                  .
                </p>
              </div>
              <div>
                <h3 className="font-medium">What devices does rhex sell?</h3>
                <p className="mt-1 text-muted-foreground">
                  We sell certified refurbished smartphones (iPhones, Samsung
                  Galaxy, Google Pixel), tablets (iPads, Android tablets), and
                  smartwatches (Apple Watch). All devices are individually
                  tested, photographed, and graded for cosmetic condition and
                  battery health.
                </p>
              </div>
              <div>
                <h3 className="font-medium">Where is rhex located?</h3>
                <p className="mt-1 text-muted-foreground">
                  rhex is operated by Reflow Hub Pty Ltd
                  (ABN&nbsp;58&nbsp;608&nbsp;364&nbsp;307), located at
                  119&nbsp;Willoughby Road, Crows Nest, NSW&nbsp;2065,
                  Australia. We ship certified refurbished devices
                  Australia-wide and to New Zealand.
                </p>
              </div>
              <div>
                <h3 className="font-medium">
                  How much can I save buying refurbished?
                </h3>
                <p className="mt-1 text-muted-foreground">
                  Customers typically save 30&ndash;50% compared to buying new
                  devices. Every rhex refurbished device is tested for full
                  performance, so you get a like-new experience at a fraction
                  of the cost while reducing e-waste.
                </p>
              </div>
            </div>
          </section>

          {/* -------------------------------------------------------------- */}
          {/* Contact & location */}
          {/* -------------------------------------------------------------- */}
          <section>
            <h2 className="text-lg font-semibold">Contact &amp; location</h2>
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p>Reflow Hub Pty Ltd (ABN 58 608 364 307)</p>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p>119 Willoughby Road, Crows Nest, NSW 2065, Australia</p>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <a
                  href="mailto:team@reflowhub.com"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  team@reflowhub.com
                </a>
              </div>
            </div>
          </section>

          {/* -------------------------------------------------------------- */}
          {/* Policies footer */}
          {/* -------------------------------------------------------------- */}
          <section className="border-t border-border pt-8">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <Link
                href="/terms"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Terms &amp; Conditions
              </Link>
              <Link
                href="/privacy"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Privacy Policy
              </Link>
              <Link
                href="/warranty"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Warranty &amp; Returns
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
