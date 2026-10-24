import { Role } from "@prisma/client";
import { requireRole } from "@/lib/rbac";
import { toHttpError } from "@/lib/http-errors";
import { requestUploadUrl } from "@/services/uploads";

// Mints a 15-minute presigned PUT URL for a deposit asset. The browser uploads
// straight to storage with it; AWS keys never leave this handler.
export async function POST(request: Request) {
  try {
    const session = await requireRole(Role.DEPOSITOR);
    const body = (await request.json()) as {
      depositId?: unknown;
      filename?: unknown;
      assetType?: unknown;
      sizeBytes?: unknown;
      sha256?: unknown;
    };
    const signed = await requestUploadUrl({
      tenantId: session.user.tenantId,
      userId: session.user.appUserId,
      role: session.user.appRole,
      depositId: typeof body.depositId === "string" ? body.depositId : "",
      filename: typeof body.filename === "string" ? body.filename : "",
      assetType: typeof body.assetType === "string" ? body.assetType : "",
      sizeBytes: typeof body.sizeBytes === "number" ? body.sizeBytes : NaN,
      sha256: typeof body.sha256 === "string" ? body.sha256 : "",
    });
    return Response.json(signed);
  } catch (error: unknown) {
    return toHttpError(error);
  }
}
