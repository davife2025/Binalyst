import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'

export const authOptions: NextAuthOptions = {
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID ? [
      GoogleProvider({
        clientId:     process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      })
    ] : []),

    CredentialsProvider({
      name: 'Binalyst',
      credentials: {
        email:     { label: 'Email',     type: 'email'    },
        password:  { label: 'Password',  type: 'password' },
        anonymous: { label: 'Anonymous', type: 'text'     },
      },
      async authorize(credentials) {
        if (credentials?.anonymous === 'true') {
          const guestId = `guest_${Math.random().toString(36).slice(2, 10)}`
          return { id: guestId, email: `${guestId}@guest.binalyst.com`, name: 'Guest' }
        }

        if (!credentials?.email || !credentials?.password) return null

        if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
          try {
            const { signIn: sb } = await import('./supabase')
            const { user, error } = await sb(credentials.email, credentials.password)
            if (!error && user) return {
              id:    user.id,
              email: user.email ?? '',
              name:  user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'User',
            }
          } catch {}
        }

        const DEMO = [
          { id: '1', email: 'demo@binalyst.com',  password: 'demo1234',  name: 'Demo User'  },
          { id: '2', email: 'admin@binalyst.com', password: 'admin1234', name: 'Admin User' },
        ]
        return DEMO.find(u => u.email === credentials.email && u.password === credentials.password) ?? null
      },
    }),
  ],

  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/login', signOut: '/login', error: '/login' },

  callbacks: {
    async jwt({ token, user, account }) {
      if (user) { token.id = user.id; token.isGuest = String(user.id).startsWith('guest_') }
      if (account) token.provider = account.provider
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id       = token.id
        ;(session.user as any).isGuest  = token.isGuest
        ;(session.user as any).provider = token.provider
      }
      return session
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
}
