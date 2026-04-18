import { prisma } from '@/lib/prisma'
import { PageHeader, InvoiceStatusBadge, PrStatusBadge, EmptyState, thb } from '@/components/ui'
import { format } from 'date-fns'
import Link from 'next/link'

interface Props {
  searchParams: { tab?: string; status?: string }
}

export default async function BillingPage({ searchParams }: Props) {
  const tab = searchParams.tab === 'ap' ? 'ap' : 'ar'
  const status = searchParams.status ?? undefined

  const [invoices, paymentRequests, arSummary, apSummary] = await Promise.all([
    prisma.invoice.findMany({
      where: status ? { status: status as any } : {},
      include: {
        job: { select: { jobNo: true } },
        customer: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.paymentRequest.findMany({
      where: status ? { status: status as any } : {},
      include: {
        job: { select: { jobNo: true } },
        vendor: { select: { name: true, code: true } },
        approvedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.invoice.aggregate({ _sum: { totalAmount: true }, where: { status: 'ISSUED' } }),
    prisma.paymentRequest.aggregate({ _sum: { totalAmount: true }, where: { status: 'PENDING_APPROVAL' } }),
  ])

  return (
    <div>
      <PageHeader
        title="Billing"
        subtitle="AR Invoices & AP Payment Requests"
        action={
          <div className="flex gap-2">
            <Link href="/billing/invoices/new" className="btn-primary">+ Invoice (AR)</Link>
            <Link href="/billing/payment-requests/new" className="btn-secondary">+ Payment (AP)</Link>
          </div>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <p className="text-xs text-gray-500">AR Outstanding</p>
          <p className="text-xl font-semibold text-emerald-600">฿{thb(arSummary._sum.totalAmount ?? 0)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-500">AP Pending Approval</p>
          <p className="text-xl font-semibold text-amber-600">฿{thb(apSummary._sum.totalAmount ?? 0)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-0 border-b border-gray-200">
        {[['ar', 'Invoices (AR)'], ['ap', 'Payment Requests (AP)']].map(([t, label]) => (
          <Link
            key={t}
            href={`/billing?tab=${t}`}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* AR Table */}
      {tab === 'ar' && (
        <div className="card overflow-hidden rounded-tl-none">
          {invoices.length === 0 ? <EmptyState message="No invoices" /> : (
            <table className="w-full">
              <thead><tr>
                <th className="table-th">Invoice No.</th>
                <th className="table-th">Job</th>
                <th className="table-th">Customer</th>
                <th className="table-th">Date</th>
                <th className="table-th">Due</th>
                <th className="table-th text-right">Amount (THB)</th>
                <th className="table-th text-right">VAT</th>
                <th className="table-th">Status</th>
                <th className="table-th">Actions</th>
              </tr></thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className="table-tr">
                    <td className="table-td">
                      <Link href={`/billing/invoices/${inv.id}`} className="text-blue-600 hover:underline font-mono text-xs font-medium">
                        {inv.invoiceNo}
                      </Link>
                    </td>
                    <td className="table-td font-mono text-xs">{inv.job.jobNo}</td>
                    <td className="table-td">{inv.customer.name}</td>
                    <td className="table-td text-xs">{format(inv.invoiceDate, 'dd/MM/yy')}</td>
                    <td className="table-td text-xs">
                      <span className={new Date(inv.dueDate) < new Date() && inv.status === 'ISSUED' ? 'text-red-500 font-medium' : ''}>
                        {format(inv.dueDate, 'dd/MM/yy')}
                      </span>
                    </td>
                    <td className="table-td text-right font-medium">฿{thb(inv.totalAmount)}</td>
                    <td className="table-td text-right text-gray-400">฿{thb(inv.vatAmount)}</td>
                    <td className="table-td"><InvoiceStatusBadge status={inv.status} /></td>
                    <td className="table-td">
                      <div className="flex gap-1">
                        {inv.status === 'DRAFT' && (
                          <Link href={`/billing/invoices/${inv.id}`} className="btn-secondary text-xs py-1">Edit</Link>
                        )}
                        <a href={`/api/invoices/${inv.id}?download=docx`} className="btn-secondary text-xs py-1">DOCX</a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* AP Table */}
      {tab === 'ap' && (
        <div className="card overflow-hidden rounded-tl-none">
          {paymentRequests.length === 0 ? <EmptyState message="No payment requests" /> : (
            <table className="w-full">
              <thead><tr>
                <th className="table-th">PR No.</th>
                <th className="table-th">Job</th>
                <th className="table-th">Vendor</th>
                <th className="table-th">Vendor Inv. Ref</th>
                <th className="table-th">Due Date</th>
                <th className="table-th text-right">Amount (THB)</th>
                <th className="table-th">Status</th>
                <th className="table-th">Approved by</th>
                <th className="table-th">Actions</th>
              </tr></thead>
              <tbody>
                {paymentRequests.map(pr => (
                  <tr key={pr.id} className="table-tr">
                    <td className="table-td">
                      <Link href={`/billing/payment-requests/${pr.id}`} className="text-blue-600 hover:underline font-mono text-xs">
                        {pr.prNo}
                      </Link>
                    </td>
                    <td className="table-td font-mono text-xs">{pr.job.jobNo}</td>
                    <td className="table-td">{pr.vendor.name}</td>
                    <td className="table-td font-mono text-xs text-gray-400">{pr.vendorInvoiceRef ?? '—'}</td>
                    <td className="table-td text-xs">
                      {pr.dueDate ? format(pr.dueDate, 'dd/MM/yy') : '—'}
                    </td>
                    <td className="table-td text-right font-medium">฿{thb(pr.totalAmount)}</td>
                    <td className="table-td"><PrStatusBadge status={pr.status} /></td>
                    <td className="table-td text-gray-400 text-xs">{pr.approvedBy?.name ?? '—'}</td>
                    <td className="table-td">
                      <Link href={`/billing/payment-requests/${pr.id}`} className="btn-secondary text-xs py-1">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
