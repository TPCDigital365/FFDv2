import { NextAuthOptions } from 'next-auth'
import AzureADProvider from 'next-auth/providers/azure-ad'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import type { UserRole } from '@prisma/client'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // ─── Email / Password (ใช้สำหรับ test ก่อน Azure AD) ────────
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
    async signIn({ user, account }) {
      if (account?.provider === 'azure-ad' && user.email) {
        await prisma.user.upsert({
          where: { email: user.email },
          update: { name: user.name ?? 'Unknown' },
          create: {
            email: user.email,
            name: user.name ?? 'Unknown',
            azureOid: account.providerAccountId,
            role: 'CS',
          },
        })
      }
      return true
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
}
