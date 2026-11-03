"use server";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Globalne unieważnienie wszystkich sesji bieżącego użytkownika (Lab 09 - Rozszerzenie 3)
 * Usuwa wszystkie rekordy z tabeli `session` w PostgreSQL dla danego użytkownika,
 * powodując natychmiastowe unieważnienie dostępu na wszystkich urządzeniach i profilach.
 */
export async function revokeAllUserSessions() {
  const session = await getCurrentSession();

  if (!session?.user) {
    return { success: false, error: "Brak uwierzytelnionej sesji" };
  }

  const result = await prisma.session.deleteMany({
    where: { userId: session.user.id },
  });

  return { success: true, count: result.count };
}
