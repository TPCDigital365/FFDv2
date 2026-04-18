import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, BorderStyle } from 'docx'
import { prisma } from './prisma'

function cell(text: string, bold = false, width?: number) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold, size: 20 })],
      }),
    ],
  })
}

function headerRow(labels: string[]) {
  return new TableRow({
    children: labels.map(l => cell(l, true)),
    tableHeader: true,
  })
}

/**
 * Arrival Notice / Delivery Order
 */
export async function generateArrivalNotice(jobId: string): Promise<Buffer> {
  const job = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    include: {
      contract: { include: { customer: true } },
      originPort: true,
      destPort: true,
      containers: true,
    },
  })

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun({ text: 'ARRIVAL NOTICE', bold: true, size: 32 })] }),
        new Paragraph({ children: [new TextRun({ text: 'United Thai Logistics Company Limited', size: 22 })] }),
        new Paragraph({ text: '' }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            headerRow(['Field', 'Detail']),
            new TableRow({ children: [cell('Job No.', true), cell(job.jobNo)] }),
            new TableRow({ children: [cell('Consignee', true), cell(job.consignee ?? '-')] }),
            new TableRow({ children: [cell('Shipper', true), cell(job.shipper ?? '-')] }),
            new TableRow({ children: [cell('Vessel / Flight', true), cell(job.vesselName ?? job.flightNo ?? '-')] }),
            new TableRow({ children: [cell('B/L No. / HAWB', true), cell(job.blNo ?? job.hawbNo ?? '-')] }),
            new TableRow({ children: [cell('Origin Port', true), cell(job.originPort?.name ?? '-')] }),
            new TableRow({ children: [cell('Destination Port', true), cell(job.destPort?.name ?? '-')] }),
            new TableRow({ children: [cell('ETA', true), cell(job.eta?.toLocaleDateString('th-TH') ?? '-')] }),
            new TableRow({ children: [cell('Packages', true), cell(job.packages?.toString() ?? '-')] }),
            new TableRow({ children: [cell('Gross Weight (KG)', true), cell(job.grossWeightKg?.toString() ?? '-')] }),
            new TableRow({ children: [cell('CBM', true), cell(job.cbm?.toString() ?? '-')] }),
          ],
        }),
        ...(job.containers.length > 0 ? [
          new Paragraph({ text: '' }),
          new Paragraph({ children: [new TextRun({ text: 'Container Details', bold: true, size: 24 })] }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              headerRow(['Container No.', 'Type', 'Seal No.', 'CBM', 'Weight (KG)']),
              ...job.containers.map(c =>
                new TableRow({
                  children: [
                    cell(c.containerNo),
                    cell(c.containerType),
                    cell(c.sealNo ?? '-'),
                    cell(c.cbm?.toString() ?? '-'),
                    cell(c.weightKg?.toString() ?? '-'),
                  ],
                })
              ),
            ],
          }),
        ] : []),
        new Paragraph({ text: '' }),
        new Paragraph({ children: [new TextRun({ text: 'Please contact us for delivery arrangements.', size: 20 })] }),
      ],
    }],
  })

  return await Packer.toBuffer(doc)
}

/**
 * Packing List
 */
export async function generatePackingList(jobId: string): Promise<Buffer> {
  const job = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    include: {
      contract: { include: { customer: true } },
      containers: true,
    },
  })

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun({ text: 'PACKING LIST', bold: true, size: 32 })] }),
        new Paragraph({ children: [new TextRun({ text: `Job No: ${job.jobNo}`, size: 22 })] }),
        new Paragraph({ children: [new TextRun({ text: `Customer: ${job.contract.customer.name}`, size: 22 })] }),
        new Paragraph({ text: '' }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            headerRow(['No.', 'Description', 'Quantity', 'Unit', 'Gross Weight', 'CBM']),
            new TableRow({
              children: [
                cell('1'),
                cell(job.contract.commodity ?? 'General Cargo'),
                cell(job.packages?.toString() ?? '-'),
                cell('PKG'),
                cell(job.grossWeightKg?.toString() ?? '-'),
                cell(job.cbm?.toString() ?? '-'),
              ],
            }),
          ],
        }),
      ],
    }],
  })

  return await Packer.toBuffer(doc)
}

/**
 * Invoice PDF (using docx as base, can extend to PDF)
 */
export async function generateInvoiceDoc(invoiceId: string): Promise<Buffer> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: {
      customer: true,
      job: true,
      items: { include: { chargeCode: true } },
    },
  })

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun({ text: 'INVOICE', bold: true, size: 36 })] }),
        new Paragraph({ children: [new TextRun({ text: 'United Thai Logistics Company Limited', bold: true, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: 'Tax ID: 0105556123456', size: 20 })] }),
        new Paragraph({ text: '' }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [cell('Invoice No.', true), cell(invoice.invoiceNo), cell('Date', true), cell(invoice.invoiceDate.toLocaleDateString('th-TH'))] }),
            new TableRow({ children: [cell('Customer', true), cell(invoice.customer.name), cell('Due Date', true), cell(invoice.dueDate.toLocaleDateString('th-TH'))] }),
            new TableRow({ children: [cell('Job No.', true), cell(invoice.job.jobNo), cell('Currency', true), cell(invoice.currency)] }),
          ],
        }),
        new Paragraph({ text: '' }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            headerRow(['Description', 'Qty', 'Unit', 'Unit Price', 'VAT%', 'VAT Amt', 'Total (THB)']),
            ...invoice.items.map(item =>
              new TableRow({
                children: [
                  cell(item.description),
                  cell(Number(item.qty).toFixed(2)),
                  cell(item.unit),
                  cell(Number(item.unitPrice).toFixed(2)),
                  cell(`${Number(item.vatRate)}%`),
                  cell(Number(item.vatAmount).toFixed(2)),
                  cell(Number(item.totalThb).toFixed(2)),
                ],
              })
            ),
            new TableRow({
              children: [
                cell('', false), cell('', false), cell('', false), cell('', false), cell('', false),
                cell('Sub Total', true),
                cell((Number(invoice.totalAmount) - Number(invoice.vatAmount)).toFixed(2)),
              ],
            }),
            new TableRow({
              children: [
                cell('', false), cell('', false), cell('', false), cell('', false), cell('', false),
                cell('VAT', true),
                cell(Number(invoice.vatAmount).toFixed(2)),
              ],
            }),
            new TableRow({
              children: [
                cell('', false), cell('', false), cell('', false), cell('', false), cell('', false),
                cell('TOTAL', true),
                cell(Number(invoice.totalAmount).toFixed(2), true),
              ],
            }),
          ],
        }),
        new Paragraph({ text: '' }),
        new Paragraph({ children: [new TextRun({ text: 'Payment Terms: ' + (invoice.customer.paymentTerms ?? 'NET30'), size: 20 })] }),
      ],
    }],
  })

  return await Packer.toBuffer(doc)
}
