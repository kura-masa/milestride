"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { getFirebase, googleProvider } from "./firebase";

type Ctx = {
  user: User | null;
  loading: boolean;
  signInGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { auth } = getFirebase();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  async function signInGoogle() {
    const { auth } = getFirebase();
    await signInWithPopup(auth, googleProvider);
  }

  async function signOutUser() {
    const { auth } = getFirebase();
    await signOut(auth);
  }

  return (
    <AuthCtx.Provider value={{ user, loading, signInGoogle, signOutUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
