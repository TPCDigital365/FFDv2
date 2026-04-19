'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

type User = {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  createdAt: string
}

const ROLES = ['ADMIN', 'MANAGER', 'FINANCE', 'CS']

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', name: '', role: 'CS', password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Guard: ADMIN only
  useEffect(() => {
    if (status === 'authenticated' && session.user.role !== 'ADMIN') {
      router.replace('/')
    }
  }, [status, session, router])

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    setLoading(true)
    const res = await fetch('/api/admin/users')
    if (res.ok) setUsers(await res.json())
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setShowForm(false)
      setForm({ email: '', name: '', role: 'CS', password: '' })
      fetchUsers()
    } else {
      const d = await res.json()
      setError(d.error || 'Error')
    }
    setSaving(false)
  }

  async function toggleActive(user: User) {
    await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !user.isActive }),
    })
    fetchUsers()
  }

  async function changeRole(user: User, role: string) {
    await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    fetchUsers()
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-sm text-gray-500">Loading...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">จัดการ Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} users ทั้งหมด</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary"
        >
          + เพิ่ม User
        </button>
      </div>

      {/* Add User Form */}
      {showForm && (
        <div className="card p-5">
          <h2 className="text-sm font-medium text-gray-700 mb-4">เพิ่ม User ใหม่</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                className="input w-full"
                placeholder="ชื่อ-นามสกุล"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                className="input w-full"
                placeholder="email@company.com"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Role</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="input w-full"
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                minLength={6}
                className="input w-full"
                placeholder="อย่างน้อย 6 ตัวอักษร"
              />
            </div>
            {error && (
              <div className="sm:col-span-2 text-xs text-red-500">{error}</div>
            )}
            <div className="sm:col-span-2 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setShowForm(false); setError('') }}
                className="btn-secondary"
              >
                ยกเลิก
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : 'บันทึก'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                <td className="px-4 py-3 text-gray-500">{user.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={user.role}
                    onChange={e => changeRole(user, e.target.value)}
                    disabled={user.id === session?.user.id}
                    className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${user.isActive ? 'badge-green' : 'badge-gray'}`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {user.id !== session?.user.id && (
                    <button
                      onClick={() => toggleActive(user)}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      {user.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="text-center py-12 text-sm text-gray-400">ยังไม่มี users</div>
        )}
      </div>
    </div>
  )
}
