import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateInvoiceNo } from '@/lib/numbering'
import { audit } from '@/lib/audit'
import { z } from 'zod'
import { addDays } from 'date-fns'

const ItemSchema = z.object({
  chargeCodeId: z.string().uuid(),
  description: z.string(),
  qty: z.number().positive(),
  unit: z.string(),
  unitPrice: z.number().positive(),
  currency: z.string().default('THB'),
  exchangeRate: z.number().default(1),
  vatRate: z.number().min(0).max(100).default(7),
})

const CreateInvoiceSchema = z.object({
  jobId: z.string().uuid(),
  customerId: z.string().uuid(),
  invoiceDate: z.string().optional(),
  paymentTermDays: z.number().int().default(30),
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
  const customerId = searchParams.get('customerId') ?? undefined

  const invoices = await prisma.invoice.findMany({
    where: {
      ...(jobId && { jobId }),
      ...(status && { status: status as any }),
      ...(customerId && { customerId }),
    },
    include: {
      job: { select: { jobNo: true } },
      customer: { select: { name: true, code: true } },
      createdBy: { select: { name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ data: invoices })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateInvoiceSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  const d = parsed.data
  const invoiceNo = await generateInvoiceNo()
  const invoiceDate = d.invoiceDate ? new Date(d.invoiceDate) : new Date()
  const dueDate = addDays(invoiceDate, d.paymentTermDays)

  const items = d.items.map(item => {
    const subTotal = item.qty * item.unitPrice * item.exchangeRate
    const vatAmount = subTotal * (item.vatRate / 100)
    const totalThb = subTotal + vatAmount
    return { ...item, vatAmount, totalThb }
  })
  const totalAmount = items.reduce((s, i) => s + i.totalThb, 0)
  const vatAmount = items.reduce((s, i) => s + i.vatAmount, 0)

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNo,
      jobId: d.jobId,
      customerId: d.customerId,
      invoiceDate,
      dueDate,
      totalAmount,
      vatAmount,
      currency: d.currency,
      notes: d.notes,
      status: 'DRAFT',
      createdById: session.user.id,
      items: {
        createMany: {
          data: items.map(({ chargeCodeId, description, qty, unit, unitPrice, currency, exchangeRate, vatRate, vatAmount, totalThb }) => ({
            chargeCodeId, description, qty, unit, unitPrice, currency, exchangeRate, vatRate, vatAmount, totalThb,
          })),
        },
      },
    },
    include: { items: true, customer: true },
  })

  await audit(session.user.id, 'CREATE', 'Invoice', invoice.id, null, { invoiceNo })

  return NextResponse.json({ data: invoice }, { status: 201 })
}
