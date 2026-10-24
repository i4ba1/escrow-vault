import NextAuth from "next-auth";
import Auth0 from "next-auth/providers/auth0";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

// Runtime guard: the JWT re-enters from the (encrypted) cookie on every
// request, so its app fields are validated, not trusted, before use.
function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" &&
    (Object.values(Role) as string[]).includes(value)
  );
}

// The provider list is conditional: with a real Auth0 tenant configured the
// OIDC flow works; without one (local build, pre-tenant demo) no provider is
// registered, so Auth.js never validates placeholder endpoints and the only
// observable behavior is "no sign-in available" plus our 401s. This also keeps
// `next build` green with zero credentials.
const auth0Providers: ReturnType<typeof Auth0>[] = [];
if (env.AUTH_AUTH0_ID && env.AUTH_AUTH0_SECRET && env.AUTH_AUTH0_ISSUER) {
  auth0Providers.push(
    Auth0({
      clientId: env.AUTH_AUTH0_ID,
      clientSecret: env.AUTH_AUTH0_SECRET,
      issuer: env.AUTH_AUTH0_ISSUER,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Behind proxies/preview deployments the request host must be trusted for
  // callbacks to resolve; secrets and tokens still never leave the server.
  trustHost: true,
  session: { strategy: "jwt" },
  providers: auth0Providers,
  callbacks: {
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
