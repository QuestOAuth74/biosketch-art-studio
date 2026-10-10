import { createContext, useContext, ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string, country?: string, fieldOfStudy?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const noAuthError = { error: new Error('Auth disabled in desktop build') };

const stubValue: AuthContextType = {
  user: null,
  session: null,
  isAdmin: false,
  loading: false,
  signUp: async () => noAuthError,
  signIn: async () => noAuthError,
  signInWithGoogle: async () => noAuthError,
  signOut: async () => {},
};

const AuthContext = createContext<AuthContextType>(stubValue);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => (
  <AuthContext.Provider value={stubValue}>{children}</AuthContext.Provider>
);
