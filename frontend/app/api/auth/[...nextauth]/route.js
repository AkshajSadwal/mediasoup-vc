import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

const backendUrl = process.env.BACKEND_URL || "http://localhost:4000";

const authOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  jwt: { maxAge: 60 * 60 * 24 * 7 },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        })]
      : []),
    CredentialsProvider({
      name: "Username and Password",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        const response = await fetch(`${backendUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: credentials.username,
            password: credentials.password,
          }),
        });

        if (!response.ok) return null;
        const data = await response.json();
        return { ...data.user, authToken: data.authToken };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile, trigger }) {
      if (user?.authToken) {
        token.backendToken = user.authToken;
        token.userId = user.user?.id || user.id;
        token.username = user.user?.username || user.username;
        token.name = user.user?.name || user.name || token.username;
        token.displayName = user.user?.displayName || user.displayName || token.name;
        token.image = user.user?.image || user.image || null;
      }

      if (account?.provider === "google" && profile?.sub && !token.backendToken) {
        const response = await fetch(`${backendUrl}/api/auth/google`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-auth-bridge-secret": process.env.AUTH_BRIDGE_SECRET || "",
          },
          body: JSON.stringify({
            providerAccountId: profile.sub,
            email: profile.email,
            name: profile.name,
            image: profile.picture,
          }),
        });

        if (!response.ok) throw new Error("Could not create Google user.");
        const data = await response.json();
        token.backendToken = data.authToken;
        token.userId = data.user.id;
        token.username = data.user.username;
        token.name = data.user.name || data.user.username;
        token.displayName = data.user.displayName || token.name;
        token.image = data.user.image || null;
      }

      if (trigger === "update" && token.backendToken) {
        try {
          const response = await fetch(`${backendUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token.backendToken}` },
            cache: "no-store",
          });
          if (response.ok) {
            const { user: currentUser } = await response.json();
            token.displayName = currentUser.displayName || currentUser.name || token.username;
            token.image = currentUser.image || null;
            token.username = currentUser.username || token.username;
            token.name = currentUser.name || token.name;
          }
        } catch (error) {
          console.error("Could not refresh account profile:", error.message);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId;
        session.user.username = token.username;
        session.user.name = token.displayName || token.name || token.username;
        session.user.displayName = token.displayName || token.name || token.username;
        session.user.image = token.image || null;
      }
      session.backendToken = token.backendToken;
      return session;
    },
  },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
