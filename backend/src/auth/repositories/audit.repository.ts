import { prisma } from '@/database';
import { AuditLog } from '@prisma/client';

export async function createAuditLog(data: {
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown> | null;
  tenantId?: string | null;
}): Promise<AuditLog> {
  return prisma.auditLog.create({ data: data as any });
}
