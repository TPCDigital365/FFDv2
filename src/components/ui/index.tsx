import type { JobStatus, InvoiceStatus, PaymentRequestStatus, CashAdvanceStatus } from '@prisma/client'

// ─── Status badge helpers ──────────────────────────────────────────────────────

const JOB_STATUS: Record<JobStatus, { label: string; cls: string }> = {
  DRAFT:       { label: 'Draft',       cls: 'badge-gray'   },
  IN_PROGRESS: { label: 'In Progress', cls: 'badge-blue'   },
  COMPLETED:   { label: 'Completed',   cls: 'badge-green'  },
  CANCELLED:   { label: 'Cancelled',   cls: 'badge-red'    },
}

const INVOICE_STATUS: Record<InvoiceStatus, { label: string; cls: string }> = {
  DRAFT:          { label: 'Draft',          cls: 'badge-gray'   },
  ISSUED:         { label: 'Issued',         cls: 'badge-blue'   },
  PARTIALLY_PAID: { label: 'Partially Paid', cls: 'badge-amber'  },
  PAID:           { label: 'Paid',           cls: 'badge-green'  },
  CANCELLED:      { label: 'Cancelled',      cls: 'badge-red'    },
}

const PR_STATUS: Record<PaymentRequestStatus, { label: string; cls: string }> = {
  DRAFT:            { label: 'Draft',            cls: 'badge-gray'   },
  PENDING_APPROVAL: { label: 'Pending Approval', cls: 'badge-amber'  },
  APPROVED:         { label: 'Approved',         cls: 'badge-blue'   },
  PAID:             { label: 'Paid',             cls: 'badge-green'  },
  CANCELLED:        { label: 'Cancelled',        cls: 'badge-red'    },
}

const CA_STATUS: Record<CashAdvanceStatus, { label: string; cls: string }> = {
  PENDING_APPROVAL: { label: 'Pending',  cls: 'badge-amber'  },
  APPROVED:         { label: 'Approved', cls: 'badge-blue'   },
  CLEARED:          { label: 'Cleared',  cls: 'badge-green'  },
  CANCELLED:        { label: 'Cancelled',cls: 'badge-red'    },
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const s = JOB_STATUS[status]
  return <span className={s.cls}>{s.label}</span>
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const s = INVOICE_STATUS[status]
  return <span className={s.cls}>{s.label}</span>
}

export function PrStatusBadge({ status }: { status: PaymentRequestStatus }) {
  const s = PR_STATUS[status]
  return <span className={s.cls}>{s.label}</span>
}

export function CaStatusBadge({ status }: { status: CashAdvanceStatus }) {
  const s = CA_STATUS[status]
  return <span className={s.cls}>{s.label}</span>
}

export function TypeBadge({ type }: { type: 'IMPORT' | 'EXPORT' }) {
  return (
    <span className={type === 'IMPORT' ? 'badge-purple' : 'badge-blue'}>
      {type === 'IMPORT' ? 'IMP' : 'EXP'}
    </span>
  )
}

export function ModeBadge({ mode }: { mode: 'SEA' | 'AIR' | 'LAND' }) {
  const cls = mode === 'SEA' ? 'badge-blue' : mode === 'AIR' ? 'badge-gray' : 'badge-amber'
  return <span className={cls}>{mode}</span>
}

// ─── Page Header ──────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

export function EmptyState({ message = 'No data found' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <svg className="w-10 h-10 mb-3 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-sm">{message}</p>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  color?: 'blue' | 'green' | 'amber' | 'red'
}

export function StatCard({ label, value, sub, color = 'blue' }: StatCardProps) {
  const colors = {
    blue:  'text-blue-600',
    green: 'text-emerald-600',
    amber: 'text-amber-600',
    red:   'text-red-600',
  }
  return (
    <div className="stat-card">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-semibold ${colors[color]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
}

// ─── Currency formatter ───────────────────────────────────────────────────────

export function thb(amount: number | string | { toNumber(): number }) {
  return new Intl.NumberFormat('th-TH', { style: 'decimal', minimumFractionDigits: 2 }).format(Number(amount))
}
