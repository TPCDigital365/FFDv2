'use client'
import { signOut } from 'next-auth/react'

interface Props {
  user: { name?: string | null; email?: string | null; role?: string }
}

export function TopBar({ user }: Props) {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-800">{user.name}</p>
          <p className="text-xs text-gray-400">{user.email}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="btn-secondary text-xs"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
