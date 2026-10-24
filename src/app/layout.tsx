import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EscrowVault — Software Escrow Portal",
  description:
    "Deposits, verification, release claims, and resilience certificates for critical software.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Request-time subtrees (portal gate, personalized pages) stream
            from here; static pages still prerender. Without this boundary,
            session-gated routes fail the build's prerender check. */}
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center bg-stone-100">
              <p className="animate-pulse text-lg font-bold tracking-tight text-stone-400">
                Escrow<span className="text-emerald-600">Vault</span>
              </p>
            </div>
          }
        >
          {children}
        </Suspense>
      </body>
    </html>
  );
}
