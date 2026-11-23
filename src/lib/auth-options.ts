import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";

export function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
}

export function isMicrosoftConfigured(): boolean {
  return Boolean(
    process.env.MICROSOFT_CLIENT_ID?.trim() &&
      process.env.MICROSOFT_CLIENT_SECRET?.trim(),
  );
}

export function getAuthOptions(): NextAuthOptions {
  const providers = [];

  if (isGoogleConfigured()) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        allowDangerousEmailAccountLinking: false,
      }),
    );
  }

  if (isMicrosoftConfigured()) {
    providers.push(
      AzureADProvider({
        clientId: process.env.MICROSOFT_CLIENT_ID!,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
        tenantId: process.env.MICROSOFT_TENANT_ID?.trim() || "common",
      }),
    );
  }

  return {
    providers,
    secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
    session: { strategy: "jwt" },
    pages: {
      signIn: "/login",
      error: "/login",
    },
    callbacks: {
      async redirect({ url, baseUrl }) {
        if (url.startsWith("/")) return `${baseUrl}${url}`;
        if (new URL(url).origin === baseUrl) return url;
        return baseUrl;
      },
    },
  };
}
