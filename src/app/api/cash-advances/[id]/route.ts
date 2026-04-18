import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const ActionSchema = z.object({
  action: z.enum(['approve', 'clear', 'cancel']),
  amountUsed: z.number().optional(),
  amountReturned: z.number().optional(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const advance = await prisma.cashAdvance.findUnique({
    where: { id: params.id },
    include: {
      job: { select: { jobNo: true, contract: { select: { customer: { select: { name: true } } } } } },
      requestedBy: { select: { name: true, email: true } },
      approvedBy: { select: { name: true } },
      clearing: true,
    },
  })
  if (!advance) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ data: advance })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = ActionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error' }, { status: 422 })

  const advance = await prisma.cashAdvance.findUnique({ where: { id: params.id } })
  if (!advance) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { action } = parsed.data

  if (action === 'approve') {
    if (!['MANAGER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Only Manager or Admin can approve' }, { status: 403 })
    }
    if (advance.status !== 'PENDING_APPROVAL') {
      return NextResponse.json({ error: 'Advance is not pending approval' }, { status: 400 })
    }
    const updated = await prisma.cashAdvance.update({
      where: { id: params.id },
      data: { status: 'APPROVED', approvedById: session.user.id, approvedAt: new Date() },
    })
    await audit(session.user.id, 'APPROVE', 'CashAdvance', params.id, advance, updated)
    return NextResponse.json({ data: updated })
  }

  if (action === 'clear') {
    if (advance.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Advance must be approved before clearing' }, { status: 400 })
    }
    const amountUsed = parsed.data.amountUsed ?? Number(advance.amount)
    const amountReturned = parsed.data.amountReturned ?? (Number(advance.amount) - amountUsed)

    const [clearing] = await prisma.$transaction([
      prisma.cashClearing.create({
        data: {
          cashAdvanceId: params.id,
          clearedById: session.user.id,
          amountUsed,
          amountReturned,
          notes: parsed.data.notes,
          clearedAt: new Date(),
        },
      }),
      prisma.cashAdvance.update({
        where: { id: params.id },
        data: { status: 'CLEARED' },
      }),
    ])

    await audit(session.user.id, 'CLEAR', 'CashAdvance', params.id, { amountUsed, amountReturned }, null)
    return NextResponse.json({ data: clearing })
  }

  if (action === 'cancel') {
    if (['CLEARED'].includes(advance.status)) {
      return NextResponse.json({ error: 'Cannot cancel a cleared advance' }, { status: 400 })
    }
    const updated = await prisma.cashAdvance.update({
      where: { id: params.id },
      data: { status: 'CANCELLED' },
    })
    await audit(session.user.id, 'CANCEL', 'CashAdvance', params.id, advance, updated)
    return NextResponse.json({ data: updated })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
