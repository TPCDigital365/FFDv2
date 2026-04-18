import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PageHeader, EmptyState, thb } from '@/components/ui'
import { format } from 'date-fns'

export default async function OicPage() {
  const session = await getServerSession(authOptions)!

  const batches = await prisma.oicBatch.findMany({
    orderBy: { createdAt: 'desc' },
    take: 60,
    include: { _count: { select: { items: true } } },
  })

  const pendingAr = await prisma.invoice.count({ where: { status: 'ISSUED', oicItems: { none: {} } } })
  const pendingAp = await prisma.paymentRequest.count({ where: { status: 'APPROVED', oicItems: { none: {} } } })
  const canGenerate = ['FINANCE', 'ADMIN', 'MANAGER'].includes(session?.user.role ?? '')

  const statusColor: Record<string, string> = {
    PENDING: 'badge-amber', SENT: 'badge-blue', CONFIRMED: 'badge-green', ERROR: 'badge-red',
  }

  return (
    <div>
      <PageHeader title="OIC Interface" subtitle="Daily AR/AP batch for Oracle Fusion via OIC" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card border-l-4 border-emerald-400">
          <p className="text-xs text-gray-500">AR Ready to Batch</p>
          <p className="text-2xl font-semibold text-emerald-600">{pendingAr}</p>
          <p className="text-xs text-gray-400">ISSUED invoices</p>
        </div>
        <div className="stat-card border-l-4 border-amber-400">
          <p className="text-xs text-gray-500">AP Ready to Batch</p>
          <p className="text-2xl font-semibold text-amber-600">{pendingAp}</p>
          <p className="text-xs text-gray-400">APPROVED payments</p>
        </div>
      </div>

      {canGenerate && (
        <div className="card p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Generate Daily Batch</h3>
          <p className="text-xs text-gray-500 mb-4">
            ระบบจะรวบรวม invoices ที่ status = ISSUED (AR) และ payment requests ที่ status = APPROVED (AP)
            แล้วสร้างไฟล์ส่ง OIC เพื่อ process เข้า Oracle Fusion
          </p>
          <div className="flex gap-3">
            <a href={`/api/oic/batch?type=AR&download=true`}
              className={`btn-success gap-2 ${pendingAr === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
              Generate AR Batch
              {pendingAr > 0 && <span className="bg-white bg-opacity-30 px-1.5 py-0.5 rounded text-xs">{pendingAr}</span>}
            </a>
            <a href={`/api/oic/batch?type=AP&download=true`}
              className={`btn-primary gap-2 ${pendingAp === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
              Generate AP Batch
              {pendingAp > 0 && <span className="bg-white bg-opacity-30 px-1.5 py-0.5 rounded text-xs">{pendingAp}</span>}
            </a>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Batch History (last 60)</h3>
        </div>
        {batches.length === 0 ? <EmptyState message="No batches yet" /> : (
          <table className="w-full">
            <thead><tr>
              <th className="table-th">Batch Date</th>
              <th className="table-th">Type</th>
              <th className="table-th">Records</th>
              <th className="table-th text-right">Total Amount</th>
              <th className="table-th">Status</th>
              <th className="table-th">Sent At</th>
              <th className="table-th">Confirmed At</th>
              <th className="table-th">Error</th>
            </tr></thead>
            <tbody>
              {batches.map(b => (
                <tr key={b.id} className="table-tr">
                  <td className="table-td font-medium">{format(b.batchDate, 'dd/MM/yyyy')}</td>
                  <td className="table-td">
                    <span className={b.type === 'AR' ? 'badge-green' : 'badge-amber'}>{b.type}</span>
                  </td>
                  <td className="table-td text-center">{b.recordCount}</td>
                  <td className="table-td text-right font-medium">฿{thb(b.totalAmount)}</td>
                  <td className="table-td"><span className={statusColor[b.status]}>{b.status}</span></td>
                  <td className="table-td text-xs text-gray-400">
                    {b.sentAt ? format(b.sentAt, 'dd/MM HH:mm') : '—'}
                  </td>
                  <td className="table-td text-xs text-gray-400">
                    {b.confirmedAt ? format(b.confirmedAt, 'dd/MM HH:mm') : '—'}
                  </td>
                  <td className="table-td text-xs text-red-400 max-w-xs truncate">
                    {b.errorMessage ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
