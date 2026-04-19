import { NextAuthOptions } from 'next-auth'
import AzureADProvider from 'next-auth/providers/azure-ad'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import type { UserRole } from '@prisma/client'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  // No PrismaAdapter — using JWT strategy, adapter not needed for credentials login
  providers: [
    // ─── Email / Password ────────────────────────────────────────
    CredentialsProvider({
      id: 'credentials',
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          })
          console.log('[auth] findUnique result:', user ? `found id=${user.id} active=${user.isActive} hasHash=${!!user.passwordHash}` : 'null')
          if (!user || !user.passwordHash || !user.isActive) return null

          const valid = await bcrypt.compare(credentials.password, user.passwordHash)
          console.log('[auth] bcrypt valid:', valid)
          if (!valid) return null

          return { id: user.id, email: user.email, name: user.name }
        } catch (err) {
          console.error('[auth] authorize error:', err)
          return null
        }
      },
    }),

    // ─── Azure AD (เปิดใช้เมื่อได้ credentials จาก IT) ───────────
    ...(process.env.AZURE_AD_CLIENT_ID
      ? [
          AzureADProvider({
            clientId: process.env.AZURE_AD_CLIENT_ID!,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
            tenantId: process.env.AZURE_AD_TENANT_ID!,
          }),
        ]
      : []),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email! },
            select: { id: true, role: true, name: true, isActive: true },
          })
          if (dbUser) {
            token.id = dbUser.id
            token.role = dbUser.role
            token.name = dbUser.name
            token.isActive = dbUser.isActive
          }
        } catch (err) {
          console.error('[auth] jwt callback error:', err)
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
        session.user.name = token.name as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
}
