"use client";

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

let client: ApolloClient | null = null;

// Browser-side GraphQL client for dashboard widgets with variable shapes.
// Same-origin HttpLink carries the Auth.js session cookie, so /api/graphql
// authorizes exactly like the server-rendered pages. Singleton: one cache per
// browser session keeps dashboard widgets consistent.
export function getApolloClient(): ApolloClient {
  client ??= new ApolloClient({
    link: new HttpLink({ uri: "/api/graphql" }),
    cache: new InMemoryCache(),
  });
  return client;
}
