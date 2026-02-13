import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Business Trade-In | rhex",
  description:
    "Bulk trade-in estimator for businesses. Upload a manifest, get an instant estimate.",
};

export default function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
