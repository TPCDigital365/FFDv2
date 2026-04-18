import type { DefaultSession } from 'next-auth'
import type { UserRole } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: UserRole
    } & DefaultSession['user']
  }
}

export type ApiResponse<T> = {
  data: T
  message?: string
} | {
  error: string
  details?: unknown
}

export type PaginatedResponse<T> = {
  data: T[]
  total: number
  page: number
  pageSize: number
}

export type JobWithRelations = Awaited<ReturnType<typeof import('../lib/prisma').prisma.job.findFirst>> & {
  contract: { customer: { name: string; code: string }; yeeflowContractNo: string }
  originPort: { code: string; name: string } | null
  destPort: { code: string; name: string } | null
  containers: Array<{ containerNo: string; containerType: string }>
  charges: Array<{ type: string; totalThb: number }>
  _count: { invoices: number; paymentRequests: number; cashAdvances: number }
}
