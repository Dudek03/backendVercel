"use client";

import { useSession, signIn, signOut, revokeSessions } from "@/lib/auth-client";
import { revokeAllUserSessions } from "@/lib/auth-actions";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthStatus() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [loading, setLoading] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (isPending) {
    return <span className="text-sm text-gray-500">Sprawdzanie sesji...</span>;
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-3 ml-auto flex-wrap sm:flex-nowrap">
        {session.user.image && !imageError ? (
          <Image
            src={session.user.image}
            alt={session.user.name || "Awatar"}
            width={32}
            height={32}
            className="rounded-full border"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
            {session.user.name ? session.user.name[0].toUpperCase() : "U"}
          </div>
        )}
        <div className="text-sm">
          <span className="font-semibold">{session.user.name || session.user.email}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setLoading(true);
              await signOut({
                fetchOptions: {
                  onSuccess: () => {
                    router.push("/");
                    router.refresh();
                  },
                },
              });
              setLoading(false);
            }}
            disabled={loading || loadingAll}
            className="text-xs px-2.5 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded transition cursor-pointer disabled:opacity-50"
            title="Wyloguj tylko z tej przeglądarki"
          >
            {loading ? "..." : "Wyloguj"}
          </button>
          <button
            onClick={async () => {
              setLoadingAll(true);
              try {
                // 1. Unieważnienie wszystkich sesji użytkownika w bazie danych
                try {
                  await revokeSessions();
                } catch {
                  await revokeAllUserSessions();
                }
                // 2. Usunięcie ciasteczka lokalnego i przekierowanie
                await signOut({
                  fetchOptions: {
                    onSuccess: () => {
                      router.push("/");
                      router.refresh();
                    },
                  },
                });
              } catch (err) {
                console.error("Błąd podczas unieważniania wszystkich sesji:", err);
              } finally {
                setLoadingAll(false);
              }
            }}
            disabled={loading || loadingAll}
            className="text-xs px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 rounded transition cursor-pointer disabled:opacity-50"
            title="Unieważnij wszystkie sesje użytkownika na wszystkich urządzeniach (Lab 09 - Rozszerzenie 3)"
          >
            {loadingAll ? "..." : "Wyloguj ze wszystkich urządzeń"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ml-auto">
      <button
        onClick={async () => {
          setLoading(true);
          await signIn.social({
            provider: "github",
            callbackURL: "/basket",
          });
        }}
        disabled={loading}
        className="flex items-center gap-2 text-sm px-4 py-1.5 bg-gray-900 text-white hover:bg-black rounded shadow transition cursor-pointer"
      >
        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
        {loading ? "Łączenie..." : "Zaloguj przez GitHub"}
      </button>
    </div>
  );
}
