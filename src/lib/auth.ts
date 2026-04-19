import { NextAuthOptions } from 'next-auth'
import AzureADProvider from 'next-auth/providers/azure-ad'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // ─── Test login (ใช้เมื่อยังไม่มี Azure AD) ─────────────────
    CredentialsProvider({
      id: 'credentials',
      name: 'Test Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const testEmail = process.env.TEST_ADMIN_EMAIL
        const testPassword = process.env.TEST_ADMIN_PASSWORD
        if (!testEmail || !testPassword) return null
        if (
          credentials?.email !== testEmail ||
          credentials?.password !== testPassword
        ) return null

        const user = await prisma.user.upsert({
          where: { email: testEmail },
          update: {},
          create: {
            email: testEmail,
            name: 'Test Admin',
            azureOid: `credentials:${testEmail}`,
            role: 'ADMIN',
          },
        })
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
