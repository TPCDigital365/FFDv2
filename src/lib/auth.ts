import { NextAuthOptions } from 'next-auth'
import AzureADProvider from 'next-auth/providers/azure-ad'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import bcrypt from 'bcryptjs'
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

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })
        if (!user || !user.passwordHash || !user.isActive) return null

        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) return null

        return { id: user.id, email: user.email, name: user.name }
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
        session.user.role = token.role as string
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
