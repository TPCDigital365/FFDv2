import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const CustomerSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  taxId: z.string().optional(),
  address: z.string().optional(),
  contactName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  paymentTerms: z.string().default('NET30'),
  currency: z.string().default('THB'),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? undefined
  const active = searchParams.get('active')

  const customers = await prisma.customer.findMany({
    where: {
      isActive: active === 'false' ? false : true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ],
      }),
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ data: customers })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Admin or Manager role required' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = CustomerSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  const existing = await prisma.customer.findUnique({ where: { code: parsed.data.code } })
  if (existing) return NextResponse.json({ error: `Customer code '${parsed.data.code}' already exists` }, { status: 409 })

  const customer = await prisma.customer.create({ data: parsed.data })
  return NextResponse.json({ data: customer }, { status: 201 })
}
