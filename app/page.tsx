import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Image
        src="/logo-rhex.svg"
        alt="rhex"
        width={48}
        height={48}
        className="mb-8 h-12 w-12"
      />

      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        What would you like to do?
      </h1>
      <p className="mt-3 text-muted-foreground">
        Buy a certified refurbished device, or sell yours for cash.
      </p>

      <div className="mt-10 grid w-full max-w-lg gap-4 sm:grid-cols-2">
        <Link
          href="/buy"
          className="group flex flex-col items-center rounded-xl border border-border bg-card p-8 text-center transition-colors hover:border-foreground/20"
        >
          <span className="text-lg font-medium">Buy a Device</span>
          <span className="mt-1 text-sm text-muted-foreground">
            Browse certified refurbished devices
          </span>
          <ArrowRight className="mt-4 h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </Link>

        <Link
          href="/sell"
          className="group flex flex-col items-center rounded-xl border border-border bg-card p-8 text-center transition-colors hover:border-foreground/20"
        >
          <span className="text-lg font-medium">Sell Your Device</span>
          <span className="mt-1 text-sm text-muted-foreground">
            Get an instant quote for your device
          </span>
          <ArrowRight className="mt-4 h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </main>
  );
}
