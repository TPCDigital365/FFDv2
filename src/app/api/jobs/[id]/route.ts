import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const UpdateJobSchema = z.object({
  status: z.enum(['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  etd: z.string().optional(),
  eta: z.string().optional(),
  vesselName: z.string().optional(),
  voyageNo: z.string().optional(),
  flightNo: z.string().optional(),
  blNo: z.string().optional(),
  hawbNo: z.string().optional(),
  mblNo: z.string().optional(),
  shipper: z.string().optional(),
  consignee: z.string().optional(),
  originPortId: z.string().uuid().optional().nullable(),
  destPortId: z.string().uuid().optional().nullable(),
  packages: z.number().int().optional(),
  grossWeightKg: z.number().optional(),
  cbm: z.number().optional(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const job = await prisma.job.findUnique({
    where: { id: params.id },
    include: {
      contract: { include: { customer: true } },
      originPort: true,
      destPort: true,
      createdBy: { select: { name: true, email: true } },
      containers: true,
      charges: { include: { chargeCode: true } },
      cashAdvances: {
        include: { requestedBy: { select: { name: true } }, clearing: true },
        orderBy: { createdAt: 'desc' },
      },
      paymentRequests: {
        include: { vendor: true, items: { include: { chargeCode: true } } },
        orderBy: { createdAt: 'desc' },
      },
      invoices: {
        include: { items: { include: { chargeCode: true } } },
        orderBy: { createdAt: 'desc' },
      },
      documents: { orderBy: { generatedAt: 'desc' } },
    },
  })

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  // Compute P&L summary
  const revenue = job.charges
    .filter(c => c.type === 'REVENUE')
    .reduce((s, c) => s + Number(c.totalThb), 0)
  const cost = job.charges
    .filter(c => c.type === 'COST')
    .reduce((s, c) => s + Number(c.totalThb), 0)

  return NextResponse.json({ data: job, summary: { revenue, cost, grossProfit: revenue - cost } })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const job = await prisma.job.findUnique({ where: { id: params.id } })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = UpdateJobSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  const updated = await prisma.job.update({
    where: { id: params.id },
    data: {
      ...parsed.data,
      etd: parsed.data.etd ? new Date(parsed.data.etd) : undefined,
      eta: parsed.data.eta ? new Date(parsed.data.eta) : undefined,
    },
  })

  await audit(session.user.id, 'UPDATE', 'Job', params.id, job, updated)

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const job = await prisma.job.findUnique({ where: { id: params.id } })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const hasFinancials = await prisma.invoice.count({ where: { jobId: params.id } })
  if (hasFinancials > 0) {
    return NextResponse.json({ error: 'Cannot delete job with invoices' }, { status: 400 })
  }

  await prisma.job.update({ where: { id: params.id }, data: { status: 'CANCELLED' } })
  await audit(session.user.id, 'CANCEL', 'Job', params.id, job, null)

  return NextResponse.json({ message: 'Job cancelled' })
}
