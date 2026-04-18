import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import Link from 'next/link'
import {
  PageHeader, TypeBadge, ModeBadge, JobStatusBadge,
  InvoiceStatusBadge, PrStatusBadge, CaStatusBadge, thb,
} from '@/components/ui'

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    include: {
      contract: { include: { customer: true } },
      originPort: true,
      destPort: true,
      createdBy: { select: { name: true } },
      containers: true,
      charges: { include: { chargeCode: true }, orderBy: { type: 'asc' } },
      cashAdvances: {
        include: { requestedBy: { select: { name: true } }, clearing: true },
        orderBy: { createdAt: 'desc' },
      },
      paymentRequests: {
        include: { vendor: { select: { name: true, code: true } } },
        orderBy: { createdAt: 'desc' },
      },
      invoices: {
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      },
      documents: { orderBy: { generatedAt: 'desc' } },
    },
  })
  if (!job) notFound()

  const revenue = job.charges.filter(c => c.type === 'REVENUE').reduce((s, c) => s + Number(c.totalThb), 0)
  const cost    = job.charges.filter(c => c.type === 'COST').reduce((s, c) => s + Number(c.totalThb), 0)
  const gp      = revenue - cost

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={job.jobNo}
        subtitle={`${job.contract.customer.name} · ${job.contract.yeeflowContractNo}`}
        action={
          <div className="flex gap-2">
            <TypeBadge type={job.type} />
            <ModeBadge mode={job.mode} />
            <JobStatusBadge status={job.status} />
          </div>
        }
      />

      {/* P&L Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="stat-card"><p className="text-xs text-gray-500">Revenue (THB)</p><p className="text-xl font-semibold text-emerald-600">฿{thb(revenue)}</p></div>
        <div className="stat-card"><p className="text-xs text-gray-500">Cost (THB)</p><p className="text-xl font-semibold text-red-500">฿{thb(cost)}</p></div>
        <div className="stat-card"><p className="text-xs text-gray-500">Gross Profit</p><p className={`text-xl font-semibold ${gp >= 0 ? 'text-blue-600' : 'text-red-600'}`}>฿{thb(gp)}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shipment Info */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Shipment Details</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {[
              ['Shipper', job.shipper],
              ['Consignee', job.consignee],
              ['Origin', job.originPort?.name],
              ['Destination', job.destPort?.name],
              ['Vessel / Flight', job.vesselName ?? job.flightNo],
              ['Voyage / HAWB', job.voyageNo ?? job.hawbNo],
              ['B/L No.', job.blNo],
              ['MBL No.', job.mblNo],
              ['ETD', job.etd ? format(job.etd, 'dd/MM/yyyy') : null],
              ['ETA', job.eta ? format(job.eta, 'dd/MM/yyyy') : null],
              ['Packages', job.packages],
              ['Weight (KG)', job.grossWeightKg?.toString()],
              ['CBM', job.cbm?.toString()],
              ['Created by', job.createdBy.name],
            ].map(([label, value]) => value ? (
              <div key={label as string} className="contents">
                <dt className="text-gray-500">{label}</dt>
                <dd className="text-gray-800 font-medium">{value}</dd>
              </div>
            ) : null)}
          </dl>
        </div>

        {/* Containers */}
        {job.containers.length > 0 && (
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Containers ({job.containers.length})</h3>
            <table className="w-full text-xs">
              <thead><tr>
                <th className="table-th">Container No.</th>
                <th className="table-th">Type</th>
                <th className="table-th">Seal</th>
                <th className="table-th">CBM</th>
                <th className="table-th">KG</th>
              </tr></thead>
              <tbody>
                {job.containers.map(c => (
                  <tr key={c.id} className="table-tr">
                    <td className="table-td font-mono">{c.containerNo}</td>
                    <td className="table-td">{c.containerType}</td>
                    <td className="table-td text-gray-400">{c.sealNo ?? '—'}</td>
                    <td className="table-td">{c.cbm?.toString() ?? '—'}</td>
                    <td className="table-td">{c.weightKg?.toString() ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Charges */}
        <div className="card p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Charges</h3>
          <table className="w-full text-xs">
            <thead><tr>
              <th className="table-th">Code</th>
              <th className="table-th">Description</th>
              <th className="table-th">Type</th>
              <th className="table-th text-right">Qty</th>
              <th className="table-th text-right">Unit Price</th>
              <th className="table-th">CCY</th>
              <th className="table-th text-right">Total THB</th>
            </tr></thead>
            <tbody>
              {job.charges.map(c => (
                <tr key={c.id} className="table-tr">
                  <td className="table-td font-mono">{c.chargeCode.code}</td>
                  <td className="table-td">{c.description}</td>
                  <td className="table-td">
                    <span className={c.type === 'REVENUE' ? 'badge-green' : 'badge-red'}>{c.type}</span>
                  </td>
                  <td className="table-td text-right">{Number(c.qty).toFixed(2)} {c.unit}</td>
                  <td className="table-td text-right">{thb(c.unitPrice)}</td>
                  <td className="table-td">{c.currency}</td>
                  <td className="table-td text-right font-medium">฿{thb(c.totalThb)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Cash Advances */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Cash Advances</h3>
            <Link href={`/finance?jobId=${job.id}`} className="text-xs text-blue-600 hover:underline">+ New</Link>
          </div>
          {job.cashAdvances.length === 0
            ? <p className="text-xs text-gray-400 py-2">No advances yet</p>
            : job.cashAdvances.map(ca => (
              <div key={ca.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-xs font-medium">฿{thb(ca.amount)}</p>
                  <p className="text-[11px] text-gray-400">{ca.purpose}</p>
                </div>
                <CaStatusBadge status={ca.status} />
              </div>
            ))
          }
        </div>

        {/* Invoices */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Invoices (AR)</h3>
            <Link href={`/billing?tab=ar&jobId=${job.id}`} className="text-xs text-blue-600 hover:underline">+ New</Link>
          </div>
          {job.invoices.length === 0
            ? <p className="text-xs text-gray-400 py-2">No invoices yet</p>
            : job.invoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <div>
                  <Link href={`/billing/invoices/${inv.id}`} className="text-xs font-medium text-blue-600 hover:underline font-mono">
                    {inv.invoiceNo}
                  </Link>
                  <p className="text-[11px] text-gray-400">฿{thb(inv.totalAmount)}</p>
                </div>
                <InvoiceStatusBadge status={inv.status} />
              </div>
            ))
          }
        </div>

        {/* Payment Requests */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Payment Requests (AP)</h3>
            <Link href={`/billing?tab=ap&jobId=${job.id}`} className="text-xs text-blue-600 hover:underline">+ New</Link>
          </div>
          {job.paymentRequests.length === 0
            ? <p className="text-xs text-gray-400 py-2">No payment requests yet</p>
            : job.paymentRequests.map(pr => (
              <div key={pr.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-xs font-medium font-mono">{pr.prNo}</p>
                  <p className="text-[11px] text-gray-400">{pr.vendor.name} · ฿{thb(pr.totalAmount)}</p>
                </div>
                <PrStatusBadge status={pr.status} />
              </div>
            ))
          }
        </div>

        {/* Documents */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Documents</h3>
          </div>
          {job.documents.length === 0
            ? <p className="text-xs text-gray-400 py-2">No documents yet</p>
            : job.documents.map(d => (
              <div key={d.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <p className="text-xs text-gray-600">{d.fileName}</p>
                <span className="badge-gray">{d.type}</span>
              </div>
            ))
          }
          <div className="mt-3 flex gap-2 flex-wrap">
            {(['ARRIVAL_NOTICE', 'PACKING_LIST'] as const).map(type => (
              <a
                key={type}
                href={`/api/documents`}
                data-job={job.id}
                data-type={type}
                className="btn-secondary text-xs"
                onClick={async (e) => {
                  e.preventDefault()
                  const res = await fetch('/api/documents', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jobId: job.id, type }),
                  })
                  if (res.ok) {
                    const blob = await res.blob()
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `${job.jobNo}_${type}.docx`
                    a.click()
                  }
                }}
              >
                {type === 'ARRIVAL_NOTICE' ? 'Arrival Notice' : 'Packing List'}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
