-- Add FILES_VIEW and FILES_DELETE to SystemPermission enum
ALTER TYPE "SystemPermission" ADD VALUE 'FILES_VIEW';
ALTER TYPE "SystemPermission" ADD VALUE 'FILES_DELETE';
