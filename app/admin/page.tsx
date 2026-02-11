import Link from "next/link";
import { Smartphone, DollarSign, FileText, Settings } from "lucide-react";

const dashboardCards = [
  {
    title: "Device Library",
    description: "Manage the master database of supported devices, models, and storage variants.",
    href: "/admin/devices",
    icon: Smartphone,
  },
  {
    title: "Pricing",
    description: "Configure trade-in pricing rules, grade multipliers, and currency rates.",
    href: "/admin/pricing",
    icon: DollarSign,
  },
  {
    title: "Quotes",
    description: "Review and manage customer bid requests and batch quote history.",
    href: "/admin/quotes",
    icon: FileText,
  },
  {
    title: "Settings",
    description: "Configure global trade-in settings like business estimate discounts.",
    href: "/admin/settings",
    icon: Settings,
  },
];

export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Welcome to the MARCO admin panel. Manage devices, pricing, and quotes
        from here.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {dashboardCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/50 hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <card.icon className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-card-foreground group-hover:text-primary">
              {card.title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {card.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
