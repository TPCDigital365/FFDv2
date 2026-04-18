import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateJobNo } from '@/lib/numbering'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const CreateJobSchema = z.object({
  contractId: z.string().uuid(),
  type: z.enum(['IMPORT', 'EXPORT']),
  mode: z.enum(['SEA', 'AIR', 'LAND']),
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
  originPortId: z.string().uuid().optional(),
  destPortId: z.string().uuid().optional(),
  packages: z.number().int().optional(),
  grossWeightKg: z.number().optional(),
  cbm: z.number().optional(),
  notes: z.string().optional(),
  containers: z.array(z.object({
    containerNo: z.string(),
    containerType: z.string(),
    sealNo: z.string().optional(),
    cbm: z.number().optional(),
    weightKg: z.number().optional(),
  })).optional(),
  charges: z.array(z.object({
    chargeCodeId: z.string().uuid(),
    description: z.string(),
    qty: z.number(),
    unit: z.string(),
    unitPrice: z.number(),
    currency: z.string().default('THB'),
    exchangeRate: z.number().default(1),
    type: z.enum(['REVENUE', 'COST']),
  })).optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = parseInt(searchParams.get('pageSize') ?? '20')
  const status = searchParams.get('status') ?? undefined
  const type = searchParams.get('type') ?? undefined
  const search = searchParams.get('search') ?? undefined

  const where: any = {}
  if (status) where.status = status
  if (type) where.type = type
  if (search) {
    where.OR = [
      { jobNo: { contains: search, mode: 'insensitive' } },
      { blNo: { contains: search, mode: 'insensitive' } },
      { hawbNo: { contains: search, mode: 'insensitive' } },
      { contract: { yeeflowContractNo: { contains: search, mode: 'insensitive' } } },
      { contract: { customer: { name: { contains: search, mode: 'insensitive' } } } },
    ]
  }

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      include: {
        contract: { include: { customer: { select: { name: true, code: true } } } },
        originPort: { select: { code: true, name: true } },
        destPort: { select: { code: true, name: true } },
        _count: { select: { invoices: true, paymentRequests: true, cashAdvances: true, containers: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.job.count({ where }),
  ])

  return NextResponse.json({ data: jobs, total, page, pageSize })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = CreateJobSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  const d = parsed.data

  const contract = await prisma.contract.findUnique({ where: { id: d.contractId } })
  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  if (contract.status === 'CANCELLED') return NextResponse.json({ error: 'Contract is cancelled' }, { status: 400 })

  const jobNo = await generateJobNo(d.type)

  const job = await prisma.job.create({
    data: {
      jobNo,
      contractId: d.contractId,
      type: d.type,
      mode: d.mode,
      status: 'IN_PROGRESS',
      etd: d.etd ? new Date(d.etd) : undefined,
      eta: d.eta ? new Date(d.eta) : undefined,
      vesselName: d.vesselName,
      voyageNo: d.voyageNo,
      flightNo: d.flightNo,
      blNo: d.blNo,
      hawbNo: d.hawbNo,
      mblNo: d.mblNo,
      shipper: d.shipper,
      consignee: d.consignee,
      originPortId: d.originPortId,
      destPortId: d.destPortId,
      packages: d.packages,
      grossWeightKg: d.grossWeightKg,
      cbm: d.cbm,
      notes: d.notes,
      createdById: session.user.id,
      containers: d.containers?.length
        ? { createMany: { data: d.containers } }
        : undefined,
      charges: d.charges?.length
        ? {
            createMany: {
              data: d.charges.map(c => ({
                ...c,
                totalThb: c.qty * c.unitPrice * c.exchangeRate,
              })),
            },
          }
        : undefined,
    },
    include: {
      contract: { include: { customer: true } },
      containers: true,
      charges: true,
    },
  })

  await audit(session.user.id, 'CREATE', 'Job', job.id, null, { jobNo, contractId: d.contractId })

  return NextResponse.json({ data: job }, { status: 201 })
}
