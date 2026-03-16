import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'

export const authOptions: NextAuthOptions = {
  providers: [
    // ── Google OAuth (one click login) ──────────────────────────
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // ── Email + password fallback ────────────────────────────────
    CredentialsProvider({
      name: 'Binalyst',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        // Try Supabase first if configured
        if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
          try {
            const { signIn: supabaseSignIn } = await import('./supabase')
            const { user, error } = await supabaseSignIn(credentials.email, credentials.password)
            if (!error && user) {
              return {
                id:    user.id,
                email: user.email ?? '',
                name:  user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'User',
              }
            }
          } catch {}
        }

        // Demo accounts fallback
        const DEMO = [
          { id: '1', email: 'demo@binalyst.com',  password: 'demo1234',  name: 'Demo User'  },
          { id: '2', email: 'admin@binalyst.com', password: 'admin1234', name: 'Admin User' },
        ]
        const user = DEMO.find(
          u => u.email === credentials.email && u.password === credentials.password
        )
        return user ?? null
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
    async jwt({ token, user, account }) {
      if (user)    token.id       = user.id
      if (account) token.provider = account.provider
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id       = token.id
        ;(session.user as any).provider = token.provider
      }
      return session
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
}