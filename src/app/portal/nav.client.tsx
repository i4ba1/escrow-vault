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

// Sidebar (desktop) + top nav (mobile) share one definition so the two never
// drift apart. Client-side only for the active-state highlight.
export function PortalNav({ orientation }: { orientation: "sidebar" | "topbar" }) {
  const pathname = usePathname();
  if (orientation === "topbar") {
    return (
      <nav className="flex gap-1 overflow-x-auto">
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
              isActive(pathname, item.href, item.exact)
                ? "bg-stone-900 text-white"
                : "text-stone-600 hover:bg-stone-200"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav className="mt-6 flex flex-col gap-1 px-3">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            isActive(pathname, item.href, item.exact)
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-300 hover:bg-white/10 hover:text-white"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
