-- AlterTable
ALTER TABLE "ReleaseRequest" ADD COLUMN     "deliveryNote" TEXT,
ADD COLUMN     "notifiedById" TEXT;

-- AddForeignKey
ALTER TABLE "ReleaseRequest" ADD CONSTRAINT "ReleaseRequest_notifiedById_fkey" FOREIGN KEY ("notifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
