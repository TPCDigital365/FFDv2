import { prisma } from '@/lib/prisma'
import { PageHeader, EmptyState } from '@/components/ui'
import Link from 'next/link'

interface Props {
  searchParams: { tab?: string }
}

export default async function MasterPage({ searchParams }: Props) {
  const tab = searchParams.tab ?? 'customers'

  const [customers, vendors, ports, chargeCodes] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: 'asc' } }),
    prisma.vendor.findMany({ orderBy: { name: 'asc' } }),
    prisma.port.findMany({ orderBy: [{ country: 'asc' }, { code: 'asc' }] }),
    prisma.chargeCode.findMany({ orderBy: [{ type: 'asc' }, { code: 'asc' }] }),
  ])

  const tabs = [
    { key: 'customers',    label: `Customers (${customers.length})` },
    { key: 'vendors',      label: `Vendors (${vendors.length})` },
    { key: 'ports',        label: `Ports (${ports.length})` },
    { key: 'chargecodes',  label: `Charge Codes (${chargeCodes.length})` },
  ]

  return (
    <div>
      <PageHeader title="Master Data" subtitle="ข้อมูลหลัก — Customer, Vendor, Port, Charge Code" />

      <div className="flex gap-0 mb-0 border-b border-gray-200 mb-4">
        {tabs.map(t => (
          <Link
            key={t.key}
            href={`/master?tab=${t.key}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === 'customers' && (
        <div className="card overflow-hidden">
          {customers.length === 0 ? <EmptyState /> : (
            <table className="w-full">
              <thead><tr>
                <th className="table-th">Code</th>
                <th className="table-th">Name</th>
                <th className="table-th">Tax ID</th>
                <th className="table-th">Payment Terms</th>
                <th className="table-th">Currency</th>
                <th className="table-th">Email</th>
                <th className="table-th">Active</th>
              </tr></thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id} className="table-tr">
                    <td className="table-td font-mono text-xs font-medium">{c.code}</td>
                    <td className="table-td font-medium">{c.name}</td>
                    <td className="table-td text-gray-500 font-mono text-xs">{c.taxId ?? '—'}</td>
                    <td className="table-td text-gray-500">{c.paymentTerms}</td>
                    <td className="table-td"><span className="badge-gray">{c.currency}</span></td>
                    <td className="table-td text-gray-400 text-xs">{c.email ?? '—'}</td>
                    <td className="table-td">
                      <span className={c.isActive ? 'badge-green' : 'badge-red'}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'vendors' && (
        <div className="card overflow-hidden">
          {vendors.length === 0 ? <EmptyState /> : (
            <table className="w-full">
              <thead><tr>
                <th className="table-th">Code</th>
                <th className="table-th">Name</th>
                <th className="table-th">Tax ID</th>
                <th className="table-th">Payment Terms</th>
                <th className="table-th">Currency</th>
                <th className="table-th">Active</th>
              </tr></thead>
              <tbody>
                {vendors.map(v => (
                  <tr key={v.id} className="table-tr">
                    <td className="table-td font-mono text-xs font-medium">{v.code}</td>
                    <td className="table-td font-medium">{v.name}</td>
                    <td className="table-td text-gray-500 font-mono text-xs">{v.taxId ?? '—'}</td>
                    <td className="table-td text-gray-500">{v.paymentTerms}</td>
                    <td className="table-td"><span className="badge-gray">{v.currency}</span></td>
                    <td className="table-td">
                      <span className={v.isActive ? 'badge-green' : 'badge-red'}>
                        {v.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'ports' && (
        <div className="card overflow-hidden">
          {ports.length === 0 ? <EmptyState /> : (
            <table className="w-full">
              <thead><tr>
                <th className="table-th">Code</th>
                <th className="table-th">Name</th>
                <th className="table-th">Country</th>
                <th className="table-th">Type</th>
                <th className="table-th">Active</th>
              </tr></thead>
              <tbody>
                {ports.map(p => (
                  <tr key={p.id} className="table-tr">
                    <td className="table-td font-mono text-xs font-medium">{p.code}</td>
                    <td className="table-td">{p.name}</td>
                    <td className="table-td"><span className="badge-gray">{p.country}</span></td>
                    <td className="table-td">
                      <span className={
                        p.type === 'SEA' ? 'badge-blue' :
                        p.type === 'AIR' ? 'badge-gray' : 'badge-amber'
                      }>{p.type}</span>
                    </td>
                    <td className="table-td">
                      <span className={p.isActive ? 'badge-green' : 'badge-red'}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'chargecodes' && (
        <div className="card overflow-hidden">
          {chargeCodes.length === 0 ? <EmptyState /> : (
            <table className="w-full">
              <thead><tr>
                <th className="table-th">Code</th>
                <th className="table-th">Name</th>
                <th className="table-th">Type</th>
                <th className="table-th">GL Account</th>
                <th className="table-th">VAT Type</th>
                <th className="table-th">Active</th>
              </tr></thead>
              <tbody>
                {chargeCodes.map(c => (
                  <tr key={c.id} className="table-tr">
                    <td className="table-td font-mono text-xs font-medium">{c.code}</td>
                    <td className="table-td">{c.name}</td>
                    <td className="table-td">
                      <span className={c.type === 'REVENUE' ? 'badge-green' : 'badge-red'}>{c.type}</span>
                    </td>
                    <td className="table-td font-mono text-xs text-gray-500">{c.glAccount}</td>
                    <td className="table-td">
                      <span className={
                        c.vatType === 'SEVEN' ? 'badge-amber' :
                        c.vatType === 'ZERO' ? 'badge-blue' : 'badge-gray'
                      }>{c.vatType}</span>
                    </td>
                    <td className="table-td">
                      <span className={c.isActive ? 'badge-green' : 'badge-red'}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </span>
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
