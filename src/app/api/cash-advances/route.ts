import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const CreateAdvanceSchema = z.object({
  jobId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().default('THB'),
  purpose: z.string().min(1),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('jobId') ?? undefined
  const status = searchParams.get('status') ?? undefined

  const advances = await prisma.cashAdvance.findMany({
    where: { ...(jobId && { jobId }), ...(status && { status: status as any }) },
    include: {
      job: { select: { jobNo: true } },
      requestedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      clearing: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ data: advances })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateAdvanceSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  const advance = await prisma.cashAdvance.create({
    data: {
      ...parsed.data,
      requestedById: session.user.id,
      status: 'PENDING_APPROVAL',
    },
  })

  await audit(session.user.id, 'CREATE', 'CashAdvance', advance.id, null, parsed.data)

  return NextResponse.json({ data: advance }, { status: 201 })
}
