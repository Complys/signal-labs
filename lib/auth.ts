// lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

type Role = "USER" | "ADMIN";

type AppUser = {
  id: string;
  email: string;
  role: Role;
  name?: string;
};

function normEmail(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function clean(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * Attach any guest orders (userId = null) to this user when they sign in,
 * by matching the email captured at Stripe checkout.
 */
async function attachGuestOrdersToUser(userId: string, emailRaw: string) {
  const email = normEmail(emailRaw);
  if (!userId || !email) return;

  await prisma.order.updateMany({
    where: { userId: null, email },
    data: { userId },
  });
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },

  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        const email = normEmail(credentials?.email);
        const password = clean(credentials?.password);

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            password: true,
            role: true,
            firstName: true,
            lastName: true,
          },
        });

        if (!user) return null;

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;

        const name =
          [user.firstName, user.lastName]
            .map((s) => clean(s))
            .filter(Boolean)
            .join(" ") || undefined;

        // Ensure role is one of the expected values
        const role: Role = user.role === "ADMIN" ? "ADMIN" : "USER";

        const out: AppUser = {
          id: user.id,
          email: user.email,
          role,
          name,
        };

        return out;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // On initial sign-in, `user` is defined (Credentials authorize return)
      if (user) {
        const u = user as AppUser;

        (token as any).id = u.id;
        (token as any).email = u.email;
        (token as any).role = u.role;

        // token.name is a standard NextAuth field
        token.name = u.name ?? token.name;

        // Link guest orders -> user on sign-in (best effort)
        if (u.id && u.email) {
          try {
            await attachGuestOrdersToUser(u.id, u.email);
          } catch (e) {
            console.error("attachGuestOrdersToUser failed:", e);
          }
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = (token as any).id;
        (session.user as any).role = (token as any).role;

        session.user.email = ((token as any).email as string | undefined) ?? session.user.email;
        session.user.name = (token.name as string | undefined) ?? session.user.name;
      }

      return session;
    },
  },
};