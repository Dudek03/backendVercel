"use client";

import { useSession, signIn, signOut } from "@/lib/auth-client";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthStatus() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [loading, setLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (isPending) {
    return <span className="text-sm text-gray-500">Sprawdzanie sesji...</span>;
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-3 ml-auto">
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
          disabled={loading}
          className="text-xs px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded transition"
        >
          {loading ? "Wylogowywanie..." : "Wyloguj"}
        </button>
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
        className="flex items-center gap-2 text-sm px-4 py-1.5 bg-gray-900 text-white hover:bg-black rounded shadow transition"
      >
        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
        {loading ? "Łączenie..." : "Zaloguj przez GitHub"}
      </button>
    </div>
  );
}
