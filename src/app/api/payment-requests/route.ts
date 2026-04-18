import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generatePrNo } from '@/lib/numbering'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const ItemSchema = z.object({
  chargeCodeId: z.string().uuid(),
  description: z.string(),
  qty: z.number().positive(),
  unitPrice: z.number().positive(),
  vatRate: z.number().min(0).max(100).default(7),
})

const CreatePRSchema = z.object({
  jobId: z.string().uuid(),
  vendorId: z.string().uuid(),
  vendorInvoiceRef: z.string().optional(),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  currency: z.string().default('THB'),
  notes: z.string().optional(),
  items: z.array(ItemSchema).min(1),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('jobId') ?? undefined
  const status = searchParams.get('status') ?? undefined

  const prs = await prisma.paymentRequest.findMany({
    where: { ...(jobId && { jobId }), ...(status && { status: status as any }) },
    include: {
      job: { select: { jobNo: true } },
      vendor: { select: { name: true, code: true } },
      items: { include: { chargeCode: { select: { code: true, name: true } } } },
      approvedBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ data: prs })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = CreatePRSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  const d = parsed.data
  const prNo = await generatePrNo()

  // Calculate totals
  const items = d.items.map(item => {
    const subTotal = item.qty * item.unitPrice
    const vatAmount = subTotal * (item.vatRate / 100)
    return { ...item, vatAmount, totalAmount: subTotal + vatAmount }
  })
  const totalAmount = items.reduce((s, i) => s + i.totalAmount, 0)
  const vatAmount = items.reduce((s, i) => s + i.vatAmount, 0)

  const pr = await prisma.paymentRequest.create({
    data: {
      prNo,
      jobId: d.jobId,
      vendorId: d.vendorId,
      vendorInvoiceRef: d.vendorInvoiceRef,
      invoiceDate: d.invoiceDate ? new Date(d.invoiceDate) : undefined,
      dueDate: d.dueDate ? new Date(d.dueDate) : undefined,
      totalAmount,
      vatAmount,
      currency: d.currency,
      notes: d.notes,
      status: 'DRAFT',
      items: {
        createMany: {
          data: items.map(({ chargeCodeId, description, qty, unitPrice, vatRate, vatAmount, totalAmount }) => ({
            chargeCodeId, description, qty, unitPrice, vatRate, vatAmount, totalAmount,
          })),
        },
      },
    },
    include: { items: true, vendor: true },
  })

  await audit(session.user.id, 'CREATE', 'PaymentRequest', pr.id, null, { prNo })

  return NextResponse.json({ data: pr }, { status: 201 })
}
