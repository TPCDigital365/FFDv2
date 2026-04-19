import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

// PATCH /api/admin/users/:id — update user (role, isActive, password)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { role, isActive, password } = body

  const data: Record<string, unknown> = {}
  if (role !== undefined) data.role = role
  if (isActive !== undefined) data.isActive = isActive
  if (password) data.passwordHash = await bcrypt.hash(password, 10)

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, email: true, name: true, role: true, isActive: true },
  })

  return NextResponse.json(user)
}

// DELETE /api/admin/users/:id — deactivate user
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // soft delete — set isActive = false
  await prisma.user.update({
    where: { id: params.id },
    data: { isActive: false },
  })

  return NextResponse.json({ success: true })
}
