import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { signIn as supabaseSignIn } from './supabase'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Binalyst',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        try {
          const { user, error } = await supabaseSignIn(credentials.email, credentials.password)
          if (error || !user) return null
          return {
            id:    user.id,
            email: user.email ?? '',
            name:  user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'User',
          }
        } catch {
          return null
        }
      },
    }),
  ],

  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },

  pages: {
    signIn:  '/login',
    signOut: '/login',
    error:   '/login',
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    async session({ session, token }) {
      if (session.user) (session.user as any).id = token.id
      return session
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
}
