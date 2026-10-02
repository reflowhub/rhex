import type { Metadata } from "next";
import HelpPage from "@/components/admin/help-page";

export const metadata: Metadata = { title: "Admin Help | rhex" };

export default function AdminHelpHomePage() {
  return <HelpPage slug={[]} />;
}
