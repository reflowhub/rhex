import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trade In | rhex",
  description: "Trade in your phone for cash",
};

export default function SellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
