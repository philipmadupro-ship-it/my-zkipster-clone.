'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onIdTokenChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onIdTokenChanged (not onAuthStateChanged) so the app notices when an account
    // becomes verified: the login page refreshes the token after activation.
    const unsubscribe = onIdTokenChanged(auth, (firebaseUser) => {
      // The server and Firestore rules only trust verified emails, so an
      // email/password account that hasn't verified yet counts as signed out.
      setUser(firebaseUser?.emailVerified ? firebaseUser : null);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
