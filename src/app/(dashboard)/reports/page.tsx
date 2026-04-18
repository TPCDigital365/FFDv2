import { prisma } from '@/lib/prisma'
import { PageHeader, thb } from '@/components/ui'
import { format, startOfMonth, subMonths } from 'date-fns'

export default async function ReportsPage() {
  const now = new Date()

  // Monthly revenue last 6 months
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i)
    return { label: format(d, 'MMM yy'), start: startOfMonth(d), end: startOfMonth(subMonths(d, -1)) }
  })

  const monthlyRevenue = await Promise.all(
    months.map(m =>
      prisma.invoice.aggregate({
        where: { status: { in: ['ISSUED', 'PAID'] }, createdAt: { gte: m.start, lt: m.end } },
        _sum: { totalAmount: true },
      }).then(r => ({ label: m.label, amount: Number(r._sum.totalAmount ?? 0) }))
    )
  )

  const monthlyCost = await Promise.all(
    months.map(m =>
      prisma.paymentRequest.aggregate({
        where: { status: 'PAID', createdAt: { gte: m.start, lt: m.end } },
        _sum: { totalAmount: true },
      }).then(r => ({ label: m.label, amount: Number(r._sum.totalAmount ?? 0) }))
    )
  )

  // Job summary by type
  const jobsByType = await prisma.job.groupBy({
    by: ['type', 'status'],
    _count: true,
  })

  // Top customers by revenue
  const topCustomers = await prisma.invoice.groupBy({
    by: ['customerId'],
    where: { status: { in: ['ISSUED', 'PAID'] } },
    _sum: { totalAmount: true },
    orderBy: { _sum: { totalAmount: 'desc' } },
    take: 5,
  })
  const customerIds = topCustomers.map(c => c.customerId)
  const customers = await prisma.customer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true, name: true, code: true },
  })
  const topCustomersWithNames = topCustomers.map(c => ({
    ...c,
    name: customers.find(cu => cu.id === c.customerId)?.name ?? c.customerId,
  }))

  // Overdue invoices
  const overdueInvoices = await prisma.invoice.findMany({
    where: { status: 'ISSUED', dueDate: { lt: now } },
    include: { customer: { select: { name: true } } },
    orderBy: { dueDate: 'asc' },
    take: 10,
  })

  // Total P&L
  const totalRevenue = monthlyRevenue.reduce((s, m) => s + m.amount, 0)
  const totalCost = monthlyCost.reduce((s, m) => s + m.amount, 0)

  return (
    <div>
      <PageHeader title="Reports" subtitle="Financial summary & operational metrics" />

      {/* P&L Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="stat-card">
          <p className="text-xs text-gray-500">Revenue (6 months)</p>
          <p className="text-2xl font-semibold text-emerald-600">฿{thb(totalRevenue)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-500">Cost (6 months)</p>
          <p className="text-2xl font-semibold text-red-500">฿{thb(totalCost)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-500">Gross Profit</p>
          <p className={`text-2xl font-semibold ${totalRevenue - totalCost >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            ฿{thb(totalRevenue - totalCost)}
          </p>
          <p className="text-xs text-gray-400">
            {totalRevenue > 0 ? `${((totalRevenue - totalCost) / totalRevenue * 100).toFixed(1)}% margin` : '—'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Monthly Revenue table */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Monthly Revenue vs Cost</h2>
          </div>
          <table className="w-full">
            <thead><tr>
              <th className="table-th">Month</th>
              <th className="table-th text-right">Revenue</th>
              <th className="table-th text-right">Cost</th>
              <th className="table-th text-right">GP</th>
            </tr></thead>
            <tbody>
              {monthlyRevenue.map((m, i) => {
                const cost = monthlyCost[i].amount
                const gp = m.amount - cost
                return (
                  <tr key={m.label} className="table-tr">
                    <td className="table-td font-medium">{m.label}</td>
                    <td className="table-td text-right text-emerald-600">฿{thb(m.amount)}</td>
                    <td className="table-td text-right text-red-500">฿{thb(cost)}</td>
                    <td className={`table-td text-right font-medium ${gp >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      ฿{thb(gp)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Top customers */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Top 5 Customers by Revenue</h2>
          </div>
          <table className="w-full">
            <thead><tr>
              <th className="table-th">Customer</th>
              <th className="table-th text-right">Revenue (THB)</th>
            </tr></thead>
            <tbody>
              {topCustomersWithNames.map((c, i) => (
                <tr key={c.customerId} className="table-tr">
                  <td className="table-td">
                    <span className="text-gray-400 mr-2">#{i + 1}</span>
                    {c.name}
                  </td>
                  <td className="table-td text-right font-medium text-emerald-600">
                    ฿{thb(c._sum.totalAmount ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Job count by type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Jobs by Type & Status</h2>
          <table className="w-full text-sm">
            <thead><tr>
              <th className="table-th">Type</th>
              <th className="table-th">Status</th>
              <th className="table-th text-right">Count</th>
            </tr></thead>
            <tbody>
              {jobsByType.map(j => (
                <tr key={`${j.type}-${j.status}`} className="table-tr">
                  <td className="table-td">
                    <span className={j.type === 'IMPORT' ? 'badge-purple' : 'badge-blue'}>{j.type}</span>
                  </td>
                  <td className="table-td text-gray-600">{j.status}</td>
                  <td className="table-td text-right font-medium">{j._count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Overdue invoices */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">
              Overdue Invoices
              {overdueInvoices.length > 0 && (
                <span className="ml-2 badge-red">{overdueInvoices.length}</span>
              )}
            </h2>
          </div>
          {overdueInvoices.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">No overdue invoices</div>
          ) : (
            <table className="w-full">
              <thead><tr>
                <th className="table-th">Invoice No.</th>
                <th className="table-th">Customer</th>
                <th className="table-th">Due Date</th>
                <th className="table-th text-right">Amount</th>
              </tr></thead>
              <tbody>
                {overdueInvoices.map(inv => (
                  <tr key={inv.id} className="table-tr">
                    <td className="table-td font-mono text-xs text-blue-600">{inv.invoiceNo}</td>
                    <td className="table-td">{inv.customer.name}</td>
                    <td className="table-td text-xs text-red-500 font-medium">
                      {format(inv.dueDate, 'dd/MM/yyyy')}
                    </td>
                    <td className="table-td text-right font-medium">฿{thb(inv.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
