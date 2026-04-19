import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const results: Record<string, unknown> = {}

  try {
    const count = await prisma.user.count()
    results.userCount = count
  } catch (e: unknown) {
    results.userCountError = String(e)
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: 'admin@utlc.co.th' },
      select: { id: true, email: true, isActive: true, passwordHash: true },
    })
    results.adminUser = user
      ? { id: user.id, email: user.email, isActive: user.isActive, hasHash: !!user.passwordHash }
      : null
  } catch (e: unknown) {
    results.adminUserError = String(e)
  }

  return NextResponse.json(results)
}
