import { handlers } from "@/auth";

// Auth.js route handlers (sign-in, callback, sign-out, session).
// The handlers read cookies/headers per request, which opts this route out of
// static rendering automatically — nothing executes here at build time, and a
// missing Auth0 config only fails at first request.
export const { GET, POST } = handlers;
