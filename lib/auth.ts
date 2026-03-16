import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Binalyst',
      credentials: {
        email:    { label: 'Email',    type: 'email',    placeholder: 'you@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        // Demo accounts — replace with real DB in production
        const DEMO_USERS = [
          { id: '1', email: 'demo@binalyst.com',  password: 'demo1234',  name: 'Demo User'  },
          { id: '2', email: 'admin@binalyst.com', password: 'admin1234', name: 'Admin User' },
        ]

        const user = DEMO_USERS.find(
          u => u.email === credentials.email && u.password === credentials.password
        )
        if (!user) return null
        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },

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