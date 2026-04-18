import { prisma } from './prisma'
import { format } from 'date-fns'
import { InvoiceStatus, PaymentRequestStatus } from '@prisma/client'

/**
 * Generates AR batch from ISSUED invoices not yet batched.
 * Format: pipe-delimited text file expected by Oracle OIC interface.
 */
export async function generateArBatch(batchDate: Date): Promise<{
  batchId: string
  content: string
  recordCount: number
  totalAmount: number
}> {
  const dateStr = format(batchDate, 'yyyyMMdd')
  const period = format(batchDate, 'yyyy-MM')

  const invoices = await prisma.invoice.findMany({
    where: {
      status: InvoiceStatus.ISSUED,
      oicItems: { none: {} },
    },
    include: {
      customer: true,
      items: { include: { chargeCode: true } },
    },
  })

  const batch = await prisma.oicBatch.create({
    data: {
      batchDate,
      type: 'AR',
      status: 'PENDING',
      recordCount: invoices.length,
      totalAmount: invoices.reduce((s, i) => s + Number(i.totalAmount), 0),
    },
  })

  const lines: string[] = [
    `HEADER|AR_BATCH|${dateStr}|UTLC|${invoices.length}`,
  ]

  for (const inv of invoices) {
    const items: any[] = []

    for (const item of inv.items) {
      // AR: Debit Receivable, Credit Revenue
      const arLine = [
        'LINE',
        inv.invoiceNo,
        inv.customer.code,
        item.chargeCode.glAccount,
        format(inv.invoiceDate, 'yyyyMMdd'),
        item.totalThb.toString(),
        '0.00',
        inv.currency,
        period,
        `${item.description} | Job: ${inv.jobId}`,
      ].join('|')
      lines.push(arLine)

      await prisma.oicBatchItem.create({
        data: {
          batchId: batch.id,
          refType: 'INVOICE',
          invoiceId: inv.id,
          glAccount: item.chargeCode.glAccount,
          debitAmount: item.totalThb,
          creditAmount: 0,
          currency: inv.currency,
          accountingPeriod: period,
        },
      })
      items.push(item)
    }

    // VAT line
    if (Number(inv.vatAmount) > 0) {
      lines.push([
        'LINE',
        inv.invoiceNo,
        inv.customer.code,
        '21001',
        format(inv.invoiceDate, 'yyyyMMdd'),
        inv.vatAmount.toString(),
        '0.00',
        inv.currency,
        period,
        'Output VAT 7%',
      ].join('|'))
    }
  }

  lines.push(`FOOTER|${invoices.length}|${batch.totalAmount}`)
  const content = lines.join('\n')

  return { batchId: batch.id, content, recordCount: invoices.length, totalAmount: Number(batch.totalAmount) }
}

/**
 * Generates AP batch from APPROVED payment requests not yet batched.
 */
export async function generateApBatch(batchDate: Date): Promise<{
  batchId: string
  content: string
  recordCount: number
  totalAmount: number
}> {
  const dateStr = format(batchDate, 'yyyyMMdd')
  const period = format(batchDate, 'yyyy-MM')

  const payments = await prisma.paymentRequest.findMany({
    where: {
      status: PaymentRequestStatus.APPROVED,
      oicItems: { none: {} },
    },
    include: {
      vendor: true,
      items: { include: { chargeCode: true } },
    },
  })

  const batch = await prisma.oicBatch.create({
    data: {
      batchDate,
      type: 'AP',
      status: 'PENDING',
      recordCount: payments.length,
      totalAmount: payments.reduce((s, p) => s + Number(p.totalAmount), 0),
    },
  })

  const lines: string[] = [
    `HEADER|AP_BATCH|${dateStr}|UTLC|${payments.length}`,
  ]

  for (const pr of payments) {
    for (const item of pr.items) {
      lines.push([
        'LINE',
        pr.prNo,
        pr.vendor.code,
        item.chargeCode.glAccount,
        pr.invoiceDate ? format(pr.invoiceDate, 'yyyyMMdd') : dateStr,
        '0.00',
        item.totalAmount.toString(),
        pr.currency,
        period,
        `${item.description} | PR: ${pr.prNo}`,
      ].join('|'))

      await prisma.oicBatchItem.create({
        data: {
          batchId: batch.id,
          refType: 'PAYMENT',
          paymentRequestId: pr.id,
          glAccount: item.chargeCode.glAccount,
          debitAmount: 0,
          creditAmount: item.totalAmount,
          currency: pr.currency,
          accountingPeriod: period,
        },
      })
    }

    if (Number(pr.vatAmount) > 0) {
      lines.push([
        'LINE',
        pr.prNo,
        pr.vendor.code,
        '31001',
        pr.invoiceDate ? format(pr.invoiceDate, 'yyyyMMdd') : dateStr,
        '0.00',
        pr.vatAmount.toString(),
        pr.currency,
        period,
        'Input VAT 7%',
      ].join('|'))
    }
  }

  lines.push(`FOOTER|${payments.length}|${batch.totalAmount}`)
  const content = lines.join('\n')

  return { batchId: batch.id, content, recordCount: payments.length, totalAmount: Number(batch.totalAmount) }
}
