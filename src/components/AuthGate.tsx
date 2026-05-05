"use client";
import { useAuth } from "@/lib/auth";
import { ReactNode } from "react";

export default function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, signInGoogle } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex-1 flex items-center justify-center bg-gradient-to-b from-slate-50 to-white">
        <div className="text-sm text-gray-400">読み込み中…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex-1 flex items-center justify-center bg-gradient-to-b from-slate-50 via-sky-50 to-white px-6">
        <div className="max-w-sm w-full text-center">
          <div className="text-3xl font-bold tracking-tight text-gray-900 mb-2">Milestride</div>
          <p className="text-sm text-gray-500 mb-8">
            読書 → 応用設計 → 実戦 のループを<br />ロードマップで見える化
          </p>
          <button
            onClick={() => signInGoogle().catch(console.error)}
            className="w-full py-3 px-5 rounded-2xl bg-white border border-gray-200 shadow-sm font-medium text-gray-800 active:scale-[0.98] transition flex items-center justify-center gap-2.5"
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.61z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC04" d="M3.97 10.71A5.42 5.42 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
            </svg>
            Googleでサインイン
          </button>
          <p className="mt-6 text-[10px] text-gray-400">
            あなた専用のロードマップが端末をまたいで同期されます
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
