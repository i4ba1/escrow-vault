import { ApolloServer } from "@apollo/server";
import { typeDefs } from "@/graphql/typeDefs";
import { resolvers } from "@/graphql/resolvers";
import { createAppContext, type AppContext } from "@/graphql/context";
import { requireAppSession } from "@/lib/rbac";
import { toHttpError } from "@/lib/http-errors";
import { InputError } from "@/services/errors";

const server = new ApolloServer<AppContext>({ typeDefs, resolvers });
// Started once per server instance; awaited per request. Module evaluation
// itself never touches credentials or the network, so builds stay green.
const startPromise = server.start();

export async function POST(request: Request) {
  await startPromise;
  let session;
  try {
    session = await requireAppSession();
  } catch (error: unknown) {
    return toHttpError(error);
  }
  let body: {
    query?: string;
    variables?: Record<string, unknown>;
    operationName?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return toHttpError(new InputError("Malformed JSON body."));
  }
  if (!body.query || typeof body.query !== "string") {
    return toHttpError(new InputError("Missing GraphQL query."));
  }
  const result = await server.executeOperation(
    {
      query: body.query,
      variables: body.variables,
      operationName: body.operationName,
    },
    {
      contextValue: createAppContext({
        tenantId: session.user.tenantId,
        userId: session.user.appUserId,
        role: session.user.appRole,
      }),
    },
  );
  if (result.body.kind === "single") {
    return Response.json(result.body.singleResult);
  }
  return toHttpError(new InputError("Batching is not supported."));
}

// Operational hint, not a playground: introspection stays available in dev via POST.
export async function GET() {
  return Response.json({
    service: "escrow-vault-graphql",
    endpoint: "/api/graphql",
    methods: ["POST"],
  });
}
