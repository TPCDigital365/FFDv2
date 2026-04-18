import { prisma } from './prisma'
import { format } from 'date-fns'

/**
 * Generate Job No: IMP2504-001 / EXP2504-001
 * Format: {TYPE}{YYMM}-{SEQ 3 digits}
 */
export async function generateJobNo(type: 'IMPORT' | 'EXPORT'): Promise<string> {
  const prefix = type === 'IMPORT' ? 'IMP' : 'EXP'
  const yymm = format(new Date(), 'yyMM')
  const pattern = `${prefix}${yymm}-%`

  const last = await prisma.job.findFirst({
    where: { jobNo: { startsWith: `${prefix}${yymm}-` } },
    orderBy: { jobNo: 'desc' },
    select: { jobNo: true },
  })

  const seq = last
    ? parseInt(last.jobNo.split('-')[1]) + 1
    : 1

  return `${prefix}${yymm}-${String(seq).padStart(3, '0')}`
}

/**
 * Generate Invoice No: INV25040001
 * Format: INV{YYMM}{SEQ 4 digits}
 */
export async function generateInvoiceNo(): Promise<string> {
  const yymm = format(new Date(), 'yyMM')

  const last = await prisma.invoice.findFirst({
    where: { invoiceNo: { startsWith: `INV${yymm}` } },
    orderBy: { invoiceNo: 'desc' },
    select: { invoiceNo: true },
  })

  const seq = last
    ? parseInt(last.invoiceNo.slice(-4)) + 1
    : 1

  return `INV${yymm}${String(seq).padStart(4, '0')}`
}

/**
 * Generate Payment Request No: PR25040001
 */
export async function generatePrNo(): Promise<string> {
  const yymm = format(new Date(), 'yyMM')

  const last = await prisma.paymentRequest.findFirst({
    where: { prNo: { startsWith: `PR${yymm}` } },
    orderBy: { prNo: 'desc' },
    select: { prNo: true },
  })

  const seq = last
    ? parseInt(last.prNo.slice(-4)) + 1
    : 1

  return `PR${yymm}${String(seq).padStart(4, '0')}`
}
