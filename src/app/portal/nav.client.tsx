"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/portal", label: "Overview", exact: true },
  { href: "/portal/deposits", label: "Deposits", exact: false },
  { href: "/portal/verification", label: "Verification", exact: false },
  { href: "/portal/releases", label: "Releases", exact: false },
  { href: "/portal/audit", label: "Audit", exact: false },
];

function isActive(pathname: string, href: string, exact: boolean): boolean {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

// Sidebar (docs/design.md §5 Nav): h-9 rows, active = raise surface + 2px
// accent bar at the left edge — not a filled pill. One definition powers both
// the desktop sidebar and the mobile top bar so they can't drift.
export function PortalNav({ orientation }: { orientation: "sidebar" | "topbar" }) {
  const pathname = usePathname();
  if (orientation === "topbar") {
    return (
      <nav className="flex gap-1 overflow-x-auto">
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex h-8 items-center rounded-[6px] px-3 text-[13px] whitespace-nowrap transition-colors ${
              isActive(pathname, item.href, item.exact)
                ? "bg-raise text-tx-hi"
                : "text-tx-mid hover:text-tx-hi"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav className="mt-6 flex flex-col gap-0.5 px-3">
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex h-9 items-center rounded-[6px] px-3 text-[13px] transition-colors ${
              active
                ? "bg-raise text-tx-hi"
                : "text-tx-mid hover:bg-raise/60 hover:text-tx-hi"
            }`}
          >
            {active && (
              <span className="absolute -left-3 h-4 w-[2px] rounded-full bg-accent" />
            )}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
