import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useAuth } from './use-auth';

interface Profile {
  id: string;
  user_id: string;
  gemini_api_key: string | null;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

interface ProfileContextType {
  profile: Profile | null;
  isLoading: boolean;
  geminiApiKey: string | null;
  hasApiKey: boolean;
  updateGeminiApiKey: (apiKey: string) => Promise<{ error: Error | null }>;
  clearGeminiApiKey: () => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

// Store the Gemini API key in localStorage keyed by user id
function getStorageKey(userId: string) {
  return `aicruit_gemini_key_${userId}`;
}

function makeProfile(userId: string, geminiApiKey: string | null): Profile {
  return {
    id: userId,
    user_id: userId,
    gemini_api_key: geminiApiKey,
    display_name: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const stored = localStorage.getItem(getStorageKey(user.id));
      setProfile(makeProfile(user.id, stored || null));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateGeminiApiKey = async (apiKey: string): Promise<{ error: Error | null }> => {
    if (!user) return { error: new Error('No user found') };
    try {
      const trimmed = apiKey.trim() || null;
      if (trimmed) {
        localStorage.setItem(getStorageKey(user.id), trimmed);
      } else {
        localStorage.removeItem(getStorageKey(user.id));
      }
      setProfile(makeProfile(user.id, trimmed));
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Failed to update API key') };
    }
  };

  const clearGeminiApiKey = async () => updateGeminiApiKey('');

  const refreshProfile = async () => fetchProfile();

  return (
    <ProfileContext.Provider
      value={{
        profile,
        isLoading,
        geminiApiKey: profile?.gemini_api_key || null,
        hasApiKey: Boolean(profile?.gemini_api_key),
        updateGeminiApiKey,
        clearGeminiApiKey,
        refreshProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};