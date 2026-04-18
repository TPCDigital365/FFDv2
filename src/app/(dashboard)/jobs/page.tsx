import { prisma } from '@/lib/prisma'
import { PageHeader, TypeBadge, ModeBadge, JobStatusBadge, EmptyState } from '@/components/ui'
import Link from 'next/link'
import { format } from 'date-fns'

interface Props {
  searchParams: { search?: string; status?: string; type?: string; page?: string }
}

export default async function JobsPage({ searchParams }: Props) {
  const page = parseInt(searchParams.page ?? '1')
  const pageSize = 25
  const search = searchParams.search
  const status = searchParams.status
  const type = searchParams.type

  const where: any = {}
  if (status) where.status = status
  if (type) where.type = type
  if (search) {
    where.OR = [
      { jobNo: { contains: search, mode: 'insensitive' } },
      { blNo: { contains: search, mode: 'insensitive' } },
      { hawbNo: { contains: search, mode: 'insensitive' } },
      { contract: { yeeflowContractNo: { contains: search, mode: 'insensitive' } } },
      { contract: { customer: { name: { contains: search, mode: 'insensitive' } } } },
    ]
  }

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      include: {
        contract: { include: { customer: { select: { name: true } } } },
        originPort: { select: { code: true } },
        destPort:   { select: { code: true } },
        _count: { select: { invoices: true, paymentRequests: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.job.count({ where }),
  ])

  return (
    <div>
      <PageHeader
        title="Job Management"
        subtitle={`${total} jobs total`}
        action={
          <Link href="/jobs/new" className="btn-primary">
            + New Job
          </Link>
        }
      />

      {/* Filters */}
      <form className="flex gap-2 mb-4 flex-wrap">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search job no, B/L, customer..."
          className="input w-64"
        />
        <select name="type" defaultValue={type ?? ''} className="input w-32">
          <option value="">All Types</option>
          <option value="IMPORT">Import</option>
          <option value="EXPORT">Export</option>
        </select>
        <select name="status" defaultValue={status ?? ''} className="input w-40">
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <button type="submit" className="btn-primary">Filter</button>
        {(search || status || type) && (
          <Link href="/jobs" className="btn-secondary">Clear</Link>
        )}
      </form>

      {/* Table */}
      <div className="card overflow-hidden">
        {jobs.length === 0 ? (
          <EmptyState message="No jobs found" />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Job No.</th>
                <th className="table-th">Contract</th>
                <th className="table-th">Customer</th>
                <th className="table-th">Type / Mode</th>
                <th className="table-th">Route</th>
                <th className="table-th">B/L / HAWB</th>
                <th className="table-th">ETD</th>
                <th className="table-th">ETA</th>
                <th className="table-th">Status</th>
                <th className="table-th">AR/AP</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id} className="table-tr">
                  <td className="table-td">
                    <Link href={`/jobs/${job.id}`} className="text-blue-600 hover:underline font-mono text-xs font-medium">
                      {job.jobNo}
                    </Link>
                  </td>
                  <td className="table-td font-mono text-xs text-gray-500">
                    {job.contract.yeeflowContractNo}
                  </td>
                  <td className="table-td text-gray-700">{job.contract.customer.name}</td>
                  <td className="table-td">
                    <div className="flex gap-1">
                      <TypeBadge type={job.type} />
                      <ModeBadge mode={job.mode} />
                    </div>
                  </td>
                  <td className="table-td text-xs text-gray-500">
                    {job.originPort?.code ?? '—'} → {job.destPort?.code ?? '—'}
                  </td>
                  <td className="table-td font-mono text-xs text-gray-500">
                    {job.blNo ?? job.hawbNo ?? '—'}
                  </td>
                  <td className="table-td text-xs">{job.etd ? format(job.etd, 'dd/MM/yy') : '—'}</td>
                  <td className="table-td text-xs">{job.eta ? format(job.eta, 'dd/MM/yy') : '—'}</td>
                  <td className="table-td">
                    <JobStatusBadge status={job.status} />
                  </td>
                  <td className="table-td text-xs text-gray-500">
                    {job._count.invoices}AR / {job._count.paymentRequests}AP
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={`/jobs?page=${page - 1}`} className="btn-secondary">← Prev</Link>}
            {page * pageSize < total && <Link href={`/jobs?page=${page + 1}`} className="btn-secondary">Next →</Link>}
          </div>
        </div>
      )}
    </div>
  )
}
