-- Create IncidentPriority enum
CREATE TYPE "IncidentPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- Create IncidentStatus enum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'ANALYZING', 'RESOLVING', 'RESOLVED', 'CLOSED');

-- Alter SystemPermission enum
ALTER TYPE "SystemPermission" ADD VALUE 'INCIDENTS_VIEW';
ALTER TYPE "SystemPermission" ADD VALUE 'INCIDENTS_CREATE';
ALTER TYPE "SystemPermission" ADD VALUE 'INCIDENTS_READ';
ALTER TYPE "SystemPermission" ADD VALUE 'INCIDENTS_UPDATE';
ALTER TYPE "SystemPermission" ADD VALUE 'INCIDENTS_DELETE';

-- CreateTable Incident
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "departmentId" TEXT,
    "priority" "IncidentPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "fileKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable IncidentComment
CREATE TABLE "IncidentComment" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Incident_departmentId_idx" ON "Incident"("departmentId");
CREATE INDEX "Incident_createdById_idx" ON "Incident"("createdById");
CREATE INDEX "IncidentComment_incidentId_idx" ON "IncidentComment"("incidentId");
CREATE INDEX "IncidentComment_createdById_idx" ON "IncidentComment"("createdById");

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IncidentComment" ADD CONSTRAINT "IncidentComment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentComment" ADD CONSTRAINT "IncidentComment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
