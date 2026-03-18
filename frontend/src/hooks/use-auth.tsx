import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiSignUp, apiSignIn, apiGetMe, setToken, clearToken } from '@/lib/api';

interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: check if we have a valid stored token
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          const me = await apiGetMe();
          if (me) {
            setUser(me);
          } else {
            clearToken();
          }
        }
      } finally {
        setIsLoading(false);
      }
    };
    initializeAuth();
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      const data = await apiSignUp(email, password);
      setToken(data.access_token);
      setUser(data.user);
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const data = await apiSignIn(email, password);
      setToken(data.access_token);
      setUser(data.user);
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
