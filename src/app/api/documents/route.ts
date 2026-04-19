import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateArrivalNotice, generatePackingList } from '@/lib/documents'
import { z } from 'zod'

const GenerateSchema = z.object({
  jobId: z.string().uuid(),
  type: z.enum(['BL', 'HAWB', 'DELIVERY_ORDER', 'INVOICE', 'PACKING_LIST', 'ARRIVAL_NOTICE', 'OTHER']),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('jobId') ?? undefined

  const docs = await prisma.document.findMany({
    where: { ...(jobId && { jobId }) },
    include: { createdBy: { select: { name: true } } },
    orderBy: { generatedAt: 'desc' },
  })

  return NextResponse.json({ data: docs })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = GenerateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  const { jobId, type } = parsed.data

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { jobNo: true } })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  let buffer: Buffer
  let fileName: string

  switch (type) {
    case 'ARRIVAL_NOTICE':
    case 'DELIVERY_ORDER':
      buffer = await generateArrivalNotice(jobId)
      fileName = `${job.jobNo}_ArrivalNotice.docx`
      break
    case 'PACKING_LIST':
      buffer = await generatePackingList(jobId)
      fileName = `${job.jobNo}_PackingList.docx`
      break
    default:
      return NextResponse.json({ error: `Document type ${type} generation not yet implemented` }, { status: 400 })
  }

  // Record document in DB
  const doc = await prisma.document.create({
    data: {
      jobId,
      type,
      fileName,
      blobUrl: null,
      fileSizeKb: Math.round(buffer.length / 1024),
      createdById: session.user.id,
    },
  })

  return new NextResponse(new Uint8Array(buffer), {
    status: 201,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'X-Document-Id': doc.id,
    },
  })
}
