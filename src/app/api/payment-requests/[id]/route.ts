import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const ActionSchema = z.object({
  action: z.enum(['submit', 'approve', 'mark_paid', 'cancel']),
  paidAt: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pr = await prisma.paymentRequest.findUnique({
    where: { id: params.id },
    include: {
      job: { select: { jobNo: true } },
      vendor: true,
      approvedBy: { select: { name: true } },
      items: { include: { chargeCode: true } },
    },
  })
  if (!pr) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ data: pr })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = ActionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error' }, { status: 422 })

  const pr = await prisma.paymentRequest.findUnique({ where: { id: params.id } })
  if (!pr) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { action } = parsed.data
  const transitions: Record<string, { from: string[]; to: string; requiresRole?: string[] }> = {
    submit:    { from: ['DRAFT'],             to: 'PENDING_APPROVAL' },
    approve:   { from: ['PENDING_APPROVAL'],  to: 'APPROVED',  requiresRole: ['MANAGER', 'ADMIN'] },
    mark_paid: { from: ['APPROVED'],          to: 'PAID' },
    cancel:    { from: ['DRAFT', 'PENDING_APPROVAL'], to: 'CANCELLED' },
  }

  const t = transitions[action]
  if (!t.from.includes(pr.status)) {
    return NextResponse.json({ error: `Cannot ${action} from status ${pr.status}` }, { status: 400 })
  }
  if (t.requiresRole && !t.requiresRole.includes(session.user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const updated = await prisma.paymentRequest.update({
    where: { id: params.id },
    data: {
      status: t.to as any,
      ...(action === 'approve' && { approvedById: session.user.id }),
      ...(action === 'mark_paid' && { paidAt: parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date() }),
    },
  })

  await audit(session.user.id, action.toUpperCase(), 'PaymentRequest', params.id, { status: pr.status }, { status: t.to })

  return NextResponse.json({ data: updated })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pr = await prisma.paymentRequest.findUnique({ where: { id: params.id } })
  if (!pr) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (pr.status !== 'DRAFT') return NextResponse.json({ error: 'Can only edit DRAFT payment requests' }, { status: 400 })

  const body = await req.json()
  const updated = await prisma.paymentRequest.update({ where: { id: params.id }, data: body })
  await audit(session.user.id, 'UPDATE', 'PaymentRequest', params.id, pr, updated)

  return NextResponse.json({ data: updated })
}
