-- CreateEnum
CREATE TYPE "AccessProvider" AS ENUM ('DISCORD', 'GITHUB', 'GOOGLE_DRIVE', 'WHATSAPP', 'FIGMA', 'CODA', 'FREEDCAMP', 'EMAIL');

-- CreateEnum
CREATE TYPE "LifecycleKind" AS ENUM ('ONBOARD', 'OFFBOARD', 'CHANGE_ACCESS', 'ALUMNI_TRANSITION');

-- CreateEnum
CREATE TYPE "LifecycleStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccessAction" AS ENUM ('GRANT', 'REVOKE', 'VERIFY');

-- CreateEnum
CREATE TYPE "AccessOperationStatus" AS ENUM ('PENDING', 'RUNNING', 'AWAITING_ACCOUNT', 'AWAITING_MANUAL', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SystemPermission" ADD VALUE 'ACCESS_READ';
ALTER TYPE "SystemPermission" ADD VALUE 'ACCESS_CREATE';
ALTER TYPE "SystemPermission" ADD VALUE 'ACCESS_APPROVE';
ALTER TYPE "SystemPermission" ADD VALUE 'ACCESS_EXECUTE';
ALTER TYPE "SystemPermission" ADD VALUE 'ACCESS_MANAGE';
ALTER TYPE "SystemPermission" ADD VALUE 'ACCESS_ALL_DEPARTMENTS';

-- CreateTable
CREATE TABLE "AccessResource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" "AccessProvider" NOT NULL,
    "remoteId" TEXT NOT NULL,
    "containerId" TEXT,
    "resourceType" TEXT NOT NULL,
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "departmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "instructions" TEXT NOT NULL DEFAULT '',
    "adminUrl" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessPolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "positions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resourceIds" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifecycleProcess" (
    "id" TEXT NOT NULL,
    "kind" "LifecycleKind" NOT NULL,
    "status" "LifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "targetName" TEXT NOT NULL,
    "targetEmail" TEXT NOT NULL,
    "targetDepartmentIds" TEXT[],
    "targetPositions" TEXT[],
    "source" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "policySnapshot" JSONB NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LifecycleProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessOperation" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "action" "AccessAction" NOT NULL,
    "provider" "AccessProvider" NOT NULL,
    "resourceSnapshot" JSONB NOT NULL,
    "providerUserId" TEXT,
    "accountEmail" TEXT,
    "verificationNote" TEXT,
    "exceptionReason" TEXT,
    "status" "AccessOperationStatus" NOT NULL DEFAULT 'PENDING',
    "automatic" BOOLEAN NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "result" JSONB,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessApproval" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "decidedById" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL,
    "note" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationEvidence" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LifecycleProcess_status_createdAt_idx" ON "LifecycleProcess"("status", "createdAt");

-- CreateIndex
CREATE INDEX "LifecycleProcess_targetEmail_idx" ON "LifecycleProcess"("targetEmail");

-- CreateIndex
CREATE INDEX "LifecycleProcess_targetDepartmentIds_idx" ON "LifecycleProcess" USING GIN ("targetDepartmentIds");

-- CreateIndex
CREATE UNIQUE INDEX "AccessOperation_idempotencyKey_key" ON "AccessOperation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AccessOperation_status_nextAttemptAt_idx" ON "AccessOperation"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "AccessOperation_processId_idx" ON "AccessOperation"("processId");

-- CreateIndex
CREATE INDEX "AccessOperation_provider_providerUserId_idx" ON "AccessOperation"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessApproval_processId_key" ON "ProcessApproval"("processId");

-- AddForeignKey
ALTER TABLE "LifecycleProcess" ADD CONSTRAINT "LifecycleProcess_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessOperation" ADD CONSTRAINT "AccessOperation_processId_fkey" FOREIGN KEY ("processId") REFERENCES "LifecycleProcess"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessApproval" ADD CONSTRAINT "ProcessApproval_processId_fkey" FOREIGN KEY ("processId") REFERENCES "LifecycleProcess"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessApproval" ADD CONSTRAINT "ProcessApproval_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationEvidence" ADD CONSTRAINT "OperationEvidence_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "AccessOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationEvidence" ADD CONSTRAINT "OperationEvidence_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

