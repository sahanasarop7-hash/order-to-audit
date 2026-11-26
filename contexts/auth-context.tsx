"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Profile =
  Database["public"]["Tables"]["profiles"]["Row"];

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let requestId = 0;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      const currentRequest = ++requestId;
      const currentUser = session?.user ?? null;

      setUser(currentUser);
      setProfile(null);
      setError(null);
      setLoading(Boolean(currentUser));

      if (!currentUser) return;

      // Fetch outside the authentication callback.
      setTimeout(async () => {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", currentUser.id)
            .single();

          if (!active || currentRequest !== requestId) return;

          if (error || !data || !data.is_active) {
            setError(
              "Your account is inactive or unavailable. Contact your administrator."
            );
            return;
          }

          setProfile(data);
        } catch {
          if (active && currentRequest === requestId) {
            setError("Unable to load your account. Please try again.");
          }
        } finally {
          if (active && currentRequest === requestId) {
            setLoading(false);
          }
        }
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, error, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}