import * as SecureStore from "expo-secure-store";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { getCurrentUser, login, loginWithSocial, logout } from "./api";
import { clearIncompleteLoop } from "./incomplete-loop";
import { clearPracticeFeedbackState } from "./practice-feedback-state";
import { setActiveStorageOwnerScope } from "./storage-owner";
import type { AuthUser, LoginRequest, SocialProvider } from "./types";

type SessionContextValue = {
  currentUser: AuthUser | null | undefined;
  isHydrating: boolean;
  refreshSession: () => Promise<AuthUser | null>;
  setSessionUser: (user: AuthUser | null) => void;
  signIn: (request: LoginRequest) => Promise<AuthUser>;
  signInWithSocial: (provider: SocialProvider) => Promise<AuthUser | null>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);
const SESSION_USER_CACHE_KEY = "writeloop_session_user";

async function readCachedSessionUser(): Promise<AuthUser | null> {
  const rawValue = await SecureStore.getItemAsync(SESSION_USER_CACHE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as AuthUser;
  } catch {
    await SecureStore.deleteItemAsync(SESSION_USER_CACHE_KEY);
    return null;
  }
}

async function writeCachedSessionUser(user: AuthUser) {
  await SecureStore.setItemAsync(SESSION_USER_CACHE_KEY, JSON.stringify(user));
}

async function clearCachedSessionUser() {
  await SecureStore.deleteItemAsync(SESSION_USER_CACHE_KEY);
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null | undefined>(undefined);
  const [isHydrating, setIsHydrating] = useState(true);
  const currentUserRef = useRef<AuthUser | null | undefined>(undefined);
  const refreshRequestIdRef = useRef(0);

  const applySessionUser = useCallback((user: AuthUser | null) => {
    setActiveStorageOwnerScope(user?.id);
    currentUserRef.current = user;
    setCurrentUser(user);
    setIsHydrating(false);

    if (user) {
      void writeCachedSessionUser(user);
    } else {
      void clearCachedSessionUser();
    }
  }, []);

  const invalidateRefreshRequests = useCallback(() => {
    refreshRequestIdRef.current += 1;
  }, []);

  const refreshSession = useCallback(async () => {
    const requestId = refreshRequestIdRef.current + 1;
    refreshRequestIdRef.current = requestId;

    try {
      const user = await getCurrentUser();
      if (refreshRequestIdRef.current === requestId) {
        applySessionUser(user);
      }
      return user;
    } catch {
      const fallbackUser =
        currentUserRef.current !== undefined ? currentUserRef.current : await readCachedSessionUser();
      if (refreshRequestIdRef.current === requestId) {
        applySessionUser(fallbackUser ?? null);
      }
      return fallbackUser ?? null;
    }
  }, [applySessionUser]);

  const setSessionUser = useCallback(
    (user: AuthUser | null) => {
      invalidateRefreshRequests();
      applySessionUser(user);
    },
    [applySessionUser, invalidateRefreshRequests]
  );

  const signIn = useCallback(
    async (request: LoginRequest) => {
      const user = await login(request);
      invalidateRefreshRequests();
      applySessionUser(user);
      return user;
    },
    [applySessionUser, invalidateRefreshRequests]
  );

  const signInWithSocial = useCallback(
    async (provider: SocialProvider) => {
      const user = await loginWithSocial(provider);
      if (user) {
        invalidateRefreshRequests();
        applySessionUser(user);
      }
      return user;
    },
    [applySessionUser, invalidateRefreshRequests]
  );

  const signOut = useCallback(async () => {
    invalidateRefreshRequests();
    try {
      await logout();
    } finally {
      await clearIncompleteLoop();
      clearPracticeFeedbackState();
      applySessionUser(null);
    }
  }, [applySessionUser, invalidateRefreshRequests]);

  useEffect(() => {
    let cancelled = false;

    const hydrateSession = async () => {
      const cachedUser = await readCachedSessionUser();
      if (cancelled) {
        return;
      }

      if (cachedUser) {
        applySessionUser(cachedUser);
      }

      await refreshSession();
    };

    void hydrateSession();

    return () => {
      cancelled = true;
    };
  }, [applySessionUser, refreshSession]);

  const value = useMemo(
    () => ({
      currentUser,
      isHydrating,
      refreshSession,
      setSessionUser,
      signIn,
      signInWithSocial,
      signOut
    }),
    [currentUser, isHydrating, refreshSession, setSessionUser, signIn, signInWithSocial, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }

  return context;
}
