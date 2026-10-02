import type { Metadata } from "next";
import HelpPage from "@/components/admin/help-page";
import { listHelpSlugs, readHelpPage } from "@/lib/admin-help";

// Pages are built from docs/admin-guide at build time; anything else is a 404
export const dynamicParams = false;

export function generateStaticParams() {
  return listHelpSlugs()
    .filter((slug) => slug.length > 0)
    .map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = readHelpPage(slug);
  return { title: `${page?.title ?? "Help"} | Admin Help | rhex` };
}

export default async function AdminHelpPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  return <HelpPage slug={slug} />;
}
