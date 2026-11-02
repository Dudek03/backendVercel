import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { prisma } from "./db";
import { headers } from "next/headers";

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error("Brak zmiennej środowiskowej BETTER_AUTH_SECRET");
}

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      scope: ["user:email"],
    },
  },
  session: {
    cookieCache: {
      enabled: false,
    },
  },
});

export async function getCurrentSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}
