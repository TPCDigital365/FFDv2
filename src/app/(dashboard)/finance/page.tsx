import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PageHeader, CaStatusBadge, EmptyState, thb } from '@/components/ui'
import { format } from 'date-fns'
import Link from 'next/link'

export default async function FinancePage() {
  const session = await getServerSession(authOptions)!

  const [advances, summary] = await Promise.all([
    prisma.cashAdvance.findMany({
      include: {
        job: { select: { jobNo: true, contract: { select: { customer: { select: { name: true } } } } } },
        requestedBy: { select: { name: true } },
        approvedBy:  { select: { name: true } },
        clearing: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.cashAdvance.groupBy({
      by: ['status'],
      _sum: { amount: true },
      _count: true,
    }),
  ])

  const pending = summary.find(s => s.status === 'PENDING_APPROVAL')
  const approved = summary.find(s => s.status === 'APPROVED')

  return (
    <div>
      <PageHeader
        title="Cash Advance"
        subtitle="ขอและอนุมัติ Cash Advance per Job"
        action={
          <Link href="/finance/new" className="btn-primary">+ New Advance</Link>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <p className="text-xs text-gray-500">Pending Approval</p>
          <p className="text-2xl font-semibold text-amber-600">{pending?._count ?? 0}</p>
          <p className="text-xs text-gray-400">฿{thb(pending?._sum.amount ?? 0)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-500">Approved (not cleared)</p>
          <p className="text-2xl font-semibold text-blue-600">{approved?._count ?? 0}</p>
          <p className="text-xs text-gray-400">฿{thb(approved?._sum.amount ?? 0)}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        {advances.length === 0 ? <EmptyState /> : (
          <table className="w-full">
            <thead><tr>
              <th className="table-th">Job No.</th>
              <th className="table-th">Customer</th>
              <th className="table-th">Purpose</th>
              <th className="table-th text-right">Amount</th>
              <th className="table-th">Requested by</th>
              <th className="table-th">Status</th>
              <th className="table-th">Clearing</th>
              <th className="table-th">Date</th>
              <th className="table-th">Actions</th>
            </tr></thead>
            <tbody>
              {advances.map(ca => (
                <tr key={ca.id} className="table-tr">
                  <td className="table-td">
                    <Link href={`/jobs/${ca.jobId}`} className="text-blue-600 hover:underline font-mono text-xs">
                      {ca.job.jobNo}
                    </Link>
                  </td>
                  <td className="table-td text-gray-600">{ca.job.contract.customer.name}</td>
                  <td className="table-td text-gray-700 max-w-[160px] truncate">{ca.purpose}</td>
                  <td className="table-td text-right font-medium">฿{thb(ca.amount)}</td>
                  <td className="table-td text-gray-500">{ca.requestedBy.name}</td>
                  <td className="table-td"><CaStatusBadge status={ca.status} /></td>
                  <td className="table-td text-xs text-gray-400">
                    {ca.clearing
                      ? `Used ฿${thb(ca.clearing.amountUsed)} · Ret ฿${thb(ca.clearing.amountReturned)}`
                      : '—'
                    }
                  </td>
                  <td className="table-td text-xs text-gray-400">
                    {format(ca.createdAt, 'dd/MM/yy')}
                  </td>
                  <td className="table-td">
                    <AdvanceActions
                      id={ca.id}
                      status={ca.status}
                      userRole={session?.user.role ?? 'CS'}
                    />
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

function AdvanceActions({ id, status, userRole }: { id: string; status: string; userRole: string }) {
  const canApprove = ['MANAGER', 'ADMIN'].includes(userRole) && status === 'PENDING_APPROVAL'
  const canClear = status === 'APPROVED'

  if (!canApprove && !canClear) return <span className="text-xs text-gray-300">—</span>

  return (
    <div className="flex gap-1">
      {canApprove && (
        <form action={`/api/cash-advances/${id}`} method="post">
          <input type="hidden" name="action" value="approve" />
          <button type="submit" className="btn-success text-xs py-1">Approve</button>
        </form>
      )}
      {canClear && (
        <Link href={`/finance/${id}/clear`} className="btn-secondary text-xs py-1">Clear</Link>
      )}
    </div>
  )
}
