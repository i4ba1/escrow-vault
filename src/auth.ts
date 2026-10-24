import NextAuth from "next-auth";
import Auth0 from "next-auth/providers/auth0";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env, requireAuth0 } from "@/lib/env";

// Runtime guard: the JWT re-enters from the (encrypted) cookie on every
// request, so its app fields are validated, not trusted, before use.
function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" &&
    (Object.values(Role) as string[]).includes(value)
  );
}

// NOTE: Next.js evaluates route modules at build time to collect segment
// config, so nothing here may throw at import time. The provider therefore
// falls back to inert placeholders when Auth0 isn't configured, and the
// signIn callback below raises the human-readable error on first use.
const AUTH0_UNCONFIGURED = "https://auth0.unconfigured.local";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Behind proxies/preview deployments the request host must be trusted for
  // callbacks to resolve; secrets and tokens still never leave the server.
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Auth0({
      clientId: env.AUTH_AUTH0_ID || AUTH0_UNCONFIGURED,
      clientSecret: env.AUTH_AUTH0_SECRET || "unconfigured",
      issuer: env.AUTH_AUTH0_ISSUER || AUTH0_UNCONFIGURED,
    }),
  ],
  callbacks: {
    // First request-time gate: fail with a clear message instead of a
    // confusing redirect to a placeholder issuer.
    async signIn() {
      requireAuth0();
      return true;
    },
    // Runs at sign-in (and token refresh): resolve the app identity from our
    // own DB by Auth0 `sub`. Our DB — not the ID token — is the source of
    // truth for role and tenant, so revoked/demoted users lose access.
    async jwt({ token, account }) {
      if (account?.providerAccountId) {
        const user = await prisma.user.findUnique({
          where: { auth0Sub: account.providerAccountId },
          select: {
            id: true,
            role: true,
            tenantId: true,
            tenant: { select: { slug: true } },
          },
        });
        if (user) {
          token.appUserId = user.id;
          token.appRole = user.role;
          token.tenantId = user.tenantId;
          token.tenantSlug = user.tenant.slug;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.appUserId =
        typeof token.appUserId === "string" ? token.appUserId : "";
      if (isRole(token.appRole)) {
        session.user.appRole = token.appRole;
      }
      session.user.tenantId =
        typeof token.tenantId === "string" ? token.tenantId : "";
      session.user.tenantSlug =
        typeof token.tenantSlug === "string" ? token.tenantSlug : "";
      return session;
    },
  },
});
