import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const YeeflowPayloadSchema = z.object({
  event: z.enum(['contract.awarded', 'contract.updated', 'contract.cancelled']),
  contract_no: z.string(),
  quotation_no: z.string().optional(),
  customer_code: z.string(),
  type: z.enum(['IMPORT', 'EXPORT']),
  mode: z.enum(['SEA', 'AIR', 'LAND']),
  origin_port_code: z.string().optional(),
  dest_port_code: z.string().optional(),
  commodity: z.string().optional(),
  incoterms: z.string().optional(),
  freight_term: z.string().optional(),
  awarded_at: z.string().optional(),
})

export async function POST(req: NextRequest) {
  // Verify webhook secret
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.YEEFLOW_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Log webhook immediately (for replay capability)
  const log = await prisma.webhookLog.create({
    data: {
      source: 'YEEFLOW',
      eventType: (payload as any)?.event ?? 'unknown',
      payload: payload as any,
      status: 'RECEIVED',
    },
  })

  try {
    const data = YeeflowPayloadSchema.parse(payload)

    if (data.event === 'contract.awarded' || data.event === 'contract.updated') {
      // Find customer by code
      const customer = await prisma.customer.findFirst({
        where: { code: data.customer_code },
      })
      if (!customer) {
        throw new Error(`Customer with code '${data.customer_code}' not found in FFD. Please add master data first.`)
      }

      // Resolve ports
      const originPort = data.origin_port_code
        ? await prisma.port.findUnique({ where: { code: data.origin_port_code } })
        : null
      const destPort = data.dest_port_code
        ? await prisma.port.findUnique({ where: { code: data.dest_port_code } })
        : null

      await prisma.contract.upsert({
        where: { yeeflowContractNo: data.contract_no },
        update: {
          type: data.type,
          mode: data.mode,
          commodity: data.commodity,
          incoterms: data.incoterms,
          freightTerm: data.freight_term,
          originPortId: originPort?.id,
          destPortId: destPort?.id,
          status: 'ACTIVE',
        },
        create: {
          yeeflowContractNo: data.contract_no,
          yeeflowQuotationNo: data.quotation_no,
          customerId: customer.id,
          type: data.type,
          mode: data.mode,
          commodity: data.commodity,
          incoterms: data.incoterms,
          freightTerm: data.freight_term,
          originPortId: originPort?.id,
          destPortId: destPort?.id,
          status: 'ACTIVE',
          awardedAt: data.awarded_at ? new Date(data.awarded_at) : new Date(),
        },
      })
    }

    if (data.event === 'contract.cancelled') {
      await prisma.contract.updateMany({
        where: { yeeflowContractNo: data.contract_no },
        data: { status: 'CANCELLED' },
      })
    }

    await prisma.webhookLog.update({
      where: { id: log.id },
      data: { status: 'PROCESSED', processedAt: new Date() },
    })

    return NextResponse.json({ ok: true, contractNo: data.contract_no })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing error'
    await prisma.webhookLog.update({
      where: { id: log.id },
      data: { status: 'ERROR', errorMessage: message },
    })
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
