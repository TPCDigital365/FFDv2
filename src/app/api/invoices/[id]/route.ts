import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/audit'
import { generateInvoiceDoc } from '@/lib/documents'
import { z } from 'zod'

const ActionSchema = z.object({
  action: z.enum(['issue', 'mark_paid', 'cancel']),
  paidAt: z.string().optional(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  if (searchParams.get('download') === 'docx') {
    const buf = await generateInvoiceDoc(params.id)
    const invoice = await prisma.invoice.findUnique({ where: { id: params.id }, select: { invoiceNo: true } })
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${invoice?.invoiceNo ?? 'invoice'}.docx"`,
      },
    })
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      job: { select: { jobNo: true, type: true, mode: true } },
      customer: true,
      createdBy: { select: { name: true } },
      items: { include: { chargeCode: true } },
    },
  })
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ data: invoice })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = ActionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error' }, { status: 422 })

  const invoice = await prisma.invoice.findUnique({ where: { id: params.id } })
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const transitions: Record<string, { from: string[]; to: string }> = {
    issue:     { from: ['DRAFT'],           to: 'ISSUED' },
    mark_paid: { from: ['ISSUED', 'PARTIALLY_PAID'], to: 'PAID' },
    cancel:    { from: ['DRAFT', 'ISSUED'], to: 'CANCELLED' },
  }

  const t = transitions[parsed.data.action]
  if (!t.from.includes(invoice.status)) {
    return NextResponse.json({ error: `Cannot ${parsed.data.action} from status ${invoice.status}` }, { status: 400 })
  }

  const updated = await prisma.invoice.update({
    where: { id: params.id },
    data: {
      status: t.to as any,
      ...(parsed.data.action === 'issue' && { issuedAt: new Date() }),
    },
  })

  await audit(session.user.id, parsed.data.action.toUpperCase(), 'Invoice', params.id, { status: invoice.status }, { status: t.to })

  return NextResponse.json({ data: updated })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const invoice = await prisma.invoice.findUnique({ where: { id: params.id } })
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (invoice.status !== 'DRAFT') return NextResponse.json({ error: 'Only DRAFT invoices can be edited' }, { status: 400 })

  const body = await req.json()
  const updated = await prisma.invoice.update({ where: { id: params.id }, data: body })
  await audit(session.user.id, 'UPDATE', 'Invoice', params.id, invoice, updated)

  return NextResponse.json({ data: updated })
}
