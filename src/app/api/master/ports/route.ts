import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? undefined
  const search = searchParams.get('search') ?? undefined

  const ports = await prisma.port.findMany({
    where: {
      isActive: true,
      ...(type && { type: type as any }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      }),
    },
    orderBy: [{ country: 'asc' }, { code: 'asc' }],
  })

  return NextResponse.json({ data: ports })
}
