import { NextAuthOptions } from 'next-auth'
import AzureADProvider from 'next-auth/providers/azure-ad'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
    }),
  ],
  session: { strategy: 'database' },
  callbacks: {
    async session({ session, user }) {
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email! },
        select: { id: true, role: true, name: true, isActive: true },
      })
      if (dbUser) {
        session.user.id = dbUser.id
        session.user.role = dbUser.role
        session.user.name = dbUser.name
        if (!dbUser.isActive) return { ...session, error: 'AccountDisabled' }
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
