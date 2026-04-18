import { prisma } from './prisma'

export async function audit(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  oldValues?: unknown,
  newValues?: unknown
) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      oldValues: oldValues ? (oldValues as any) : undefined,
      newValues: newValues ? (newValues as any) : undefined,
    },
  })
}
