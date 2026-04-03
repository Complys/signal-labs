import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;

  if (!session?.user || role !== "ADMIN") {
    throw new Error("UNAUTHORIZED_ADMIN");
  }

  return session;
}