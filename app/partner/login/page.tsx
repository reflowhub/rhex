"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function PartnerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // EOI form state
  const [eoiData, setEoiData] = useState({
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
    message: "",
  });
  const [eoiLoading, setEoiLoading] = useState(false);
  const [eoiStatus, setEoiStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const [eoiError, setEoiError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const idToken = await userCredential.user.getIdToken();

      const res = await fetch("/api/partner/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create session");
      }

      router.push("/partner/dashboard");
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string };
      if (
        firebaseErr.code === "auth/invalid-credential" ||
        firebaseErr.code === "auth/user-not-found" ||
        firebaseErr.code === "auth/wrong-password"
      ) {
        setError("Invalid email or password");
      } else if (firebaseErr.code === "auth/too-many-requests") {
        setError("Too many failed attempts. Please try again later.");
      } else {
        setError(firebaseErr.message || "An error occurred");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleEoiSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEoiError("");
    setEoiLoading(true);

    try {
      const res = await fetch("/api/partner/eoi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eoiData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit");
      }

      setEoiStatus("success");
      setEoiData({
        businessName: "",
        contactName: "",
        email: "",
        phone: "",
        message: "",
      });
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setEoiError(errorObj.message || "An error occurred");
      setEoiStatus("error");
    } finally {
      setEoiLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm space-y-10">
        {/* Login Form */}
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">
              Partner Portal
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to your partner account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="partner@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/partner/forgot-password"
                  className="text-sm text-muted-foreground hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </div>

        {/* Expression of Interest Accordion */}
        <details className="group rounded-md border border-border">
          <summary className="flex cursor-pointer items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
            Not a partner yet? Register your interest
            <svg
              className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
          </summary>

          <div className="space-y-4 px-4 pb-4 pt-2">
            {eoiStatus === "success" ? (
              <div className="rounded-md bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
                Thanks for your interest! We&apos;ll be in touch soon.
              </div>
            ) : (
              <form onSubmit={handleEoiSubmit} className="space-y-3">
                {eoiError && (
                  <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {eoiError}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="eoi-business">Business name</Label>
                  <Input
                    id="eoi-business"
                    placeholder="Acme Ltd"
                    value={eoiData.businessName}
                    onChange={(e) =>
                      setEoiData({ ...eoiData, businessName: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eoi-contact">Contact name</Label>
                  <Input
                    id="eoi-contact"
                    placeholder="Jane Smith"
                    value={eoiData.contactName}
                    onChange={(e) =>
                      setEoiData({ ...eoiData, contactName: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eoi-email">Email</Label>
                  <Input
                    id="eoi-email"
                    type="email"
                    placeholder="jane@acme.com"
                    value={eoiData.email}
                    onChange={(e) =>
                      setEoiData({ ...eoiData, email: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eoi-phone">Phone (optional)</Label>
                  <Input
                    id="eoi-phone"
                    type="tel"
                    placeholder="021 123 4567"
                    value={eoiData.phone}
                    onChange={(e) =>
                      setEoiData({ ...eoiData, phone: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eoi-message">
                    Tell us about your business (optional)
                  </Label>
                  <Textarea
                    id="eoi-message"
                    placeholder="What devices do you typically handle? How many per month?"
                    rows={3}
                    value={eoiData.message}
                    onChange={(e) =>
                      setEoiData({ ...eoiData, message: e.target.value })
                    }
                  />
                </div>

                <Button
                  type="submit"
                  variant="outline"
                  className="w-full"
                  disabled={eoiLoading}
                >
                  {eoiLoading ? "Submitting..." : "Register interest"}
                </Button>
              </form>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
