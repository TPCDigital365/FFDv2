import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateArBatch, generateApBatch } from '@/lib/oic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const batches = await prisma.oicBatch.findMany({
    orderBy: { createdAt: 'desc' },
    take: 60,
    include: { _count: { select: { items: true } } },
  })

  return NextResponse.json({ data: batches })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['FINANCE', 'ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Finance, Manager or Admin role required' }, { status: 403 })
  }

  const { type, batchDate, download } = await req.json() as {
    type: 'AR' | 'AP'
    batchDate?: string
    download?: boolean
  }

  if (!type || !['AR', 'AP'].includes(type)) {
    return NextResponse.json({ error: 'type must be AR or AP' }, { status: 400 })
  }

  const date = batchDate ? new Date(batchDate) : new Date()

  const result = type === 'AR'
    ? await generateArBatch(date)
    : await generateApBatch(date)

  if (result.recordCount === 0) {
    return NextResponse.json({ message: `No ${type} records to batch today`, recordCount: 0 })
  }

  // Update batch file path in db
  await prisma.oicBatch.update({
    where: { id: result.batchId },
    data: { filePath: `oic/${type}_${result.batchId}.txt`, status: 'SENT', sentAt: new Date() },
  })

  if (download) {
    return new NextResponse(result.content, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="UTLC_${type}_${date.toISOString().slice(0, 10)}.txt"`,
      },
    })
  }

  return NextResponse.json({
    batchId: result.batchId,
    type,
    recordCount: result.recordCount,
    totalAmount: result.totalAmount,
    message: `${type} batch generated successfully`,
  })
}
