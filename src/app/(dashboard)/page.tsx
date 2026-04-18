import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PageHeader, StatCard, thb } from '@/components/ui'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)!
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const [
    activeJobs,
    monthJobs,
    pendingAdvances,
    pendingPayments,
    draftInvoices,
    monthRevenue,
    recentJobs,
  ] = await Promise.all([
    prisma.job.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.job.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
    prisma.cashAdvance.count({ where: { status: 'PENDING_APPROVAL' } }),
    prisma.paymentRequest.count({ where: { status: 'PENDING_APPROVAL' } }),
    prisma.invoice.count({ where: { status: 'DRAFT' } }),
    prisma.invoice.aggregate({
      where: { status: { in: ['ISSUED', 'PAID'] }, createdAt: { gte: monthStart } },
      _sum: { totalAmount: true },
    }),
    prisma.job.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        contract: { include: { customer: { select: { name: true } } } },
        originPort: { select: { code: true } },
        destPort: { select: { code: true } },
      },
    }),
  ])

  const statusColor: Record<string, string> = {
    DRAFT: 'badge-gray', IN_PROGRESS: 'badge-blue',
    COMPLETED: 'badge-green', CANCELLED: 'badge-red',
  }

  return (
    <div>
      <PageHeader
        title={`สวัสดี, ${session?.user.name?.split(' ')[0]} 👋`}
        subtitle={`${format(now, 'EEEE, d MMMM yyyy')} — UTLC FFD`}
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Active Jobs" value={activeJobs} sub={`${monthJobs} this month`} color="blue" />
        <StatCard label="Pending Approvals (CA)" value={pendingAdvances} color="amber" />
        <StatCard label="Pending Payments (AP)" value={pendingPayments} color="amber" />
        <StatCard label="Draft Invoices (AR)" value={draftInvoices} color="red" />
        <StatCard
          label="Revenue (this month)"
          value={`฿${thb(monthRevenue._sum.totalAmount ?? 0)}`}
          color="green"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { href: '/jobs/new',     label: 'New Job',          icon: 'M12 4v16m8-8H4', color: 'bg-blue-600'   },
          { href: '/finance',      label: 'Cash Advance',     icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-amber-500' },
          { href: '/billing?tab=ar', label: 'Draft Invoice',  icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z', color: 'bg-emerald-600' },
          { href: '/oic',          label: 'Run OIC Batch',    icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12', color: 'bg-purple-600' },
        ].map(a => (
          <Link key={a.href} href={a.href}
            className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow group"
          >
            <div className={`${a.color} rounded-lg p-2 flex-shrink-0`}>
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={a.icon} />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Recent Jobs */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Recent Jobs</h2>
          <Link href="/jobs" className="text-xs text-blue-600 hover:underline">View all →</Link>
        </div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Job No.</th>
              <th className="table-th">Customer</th>
              <th className="table-th">Type</th>
              <th className="table-th">Route</th>
              <th className="table-th">Status</th>
              <th className="table-th">ETA</th>
            </tr>
          </thead>
          <tbody>
            {recentJobs.map(job => (
              <tr key={job.id} className="table-tr">
                <td className="table-td">
                  <Link href={`/jobs/${job.id}`} className="text-blue-600 hover:underline font-mono text-xs">
                    {job.jobNo}
                  </Link>
                </td>
                <td className="table-td text-gray-600">{job.contract.customer.name}</td>
                <td className="table-td">
                  <span className={job.type === 'IMPORT' ? 'badge-purple' : 'badge-blue'}>
                    {job.type === 'IMPORT' ? 'IMP' : 'EXP'}
                  </span>
                  {' '}
                  <span className="badge-gray">{job.mode}</span>
                </td>
                <td className="table-td text-gray-500 text-xs">
                  {job.originPort?.code ?? '—'} → {job.destPort?.code ?? '—'}
                </td>
                <td className="table-td">
                  <span className={statusColor[job.status]}>{job.status.replace('_', ' ')}</span>
                </td>
                <td className="table-td text-gray-500 text-xs">
                  {job.eta ? format(job.eta, 'dd/MM/yy') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
