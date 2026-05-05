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
          <p className="text-sm text-gray-500 mb-6">
            やりたいことをロードマップで<br />見える化して進めるアプリ
          </p>

          <div className="mb-8 rounded-2xl bg-white ring-1 ring-gray-200 shadow-sm px-5 py-5 text-left">
            <div className="text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-3 text-center">
              例: 影響力の武器
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-[200px] rounded-2xl ring-2 ring-emerald-400 bg-gradient-to-br from-emerald-50 to-emerald-100 px-3 py-2.5 shadow-sm">
                <div className="text-xs font-semibold text-gray-900">
                  <span className="text-emerald-500 mr-1">✓</span>
                  返報性の原理を読む
                </div>
                <div className="mt-1.5 h-1 w-full rounded-full bg-white/70 overflow-hidden">
                  <div className="h-full w-full bg-emerald-400" />
                </div>
              </div>
              <div className="h-5 w-px bg-gradient-to-b from-emerald-300 to-amber-300" />
              <div className="w-[200px] rounded-2xl ring-2 ring-amber-400 bg-gradient-to-br from-amber-50 to-orange-100 px-3 py-2.5 shadow-sm">
                <div className="text-xs font-semibold text-gray-900">
                  <span className="text-amber-500 mr-1">◐</span>
                  顧客提案で先に価値提供
                </div>
                <div className="mt-1.5 h-1 w-full rounded-full bg-white/70 overflow-hidden">
                  <div className="h-full w-1/2 bg-amber-400" />
                </div>
              </div>
            </div>
            <div className="mt-3 text-[10px] text-gray-400 text-center leading-snug">
              読んだ内容を実務で試す流れを<br />一つずつチェックして進めます
            </div>
          </div>

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
