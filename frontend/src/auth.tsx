import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { api, setToken, setUnauthorizedHandler, User } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { storage } from "@/src/utils/storage";

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = "session_token";
const AUTH_URL = "https://auth.emergentagent.com/?redirect=";

type AuthCtx = {
  user: User | null | undefined; // undefined = loading
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  busy: boolean;
  error: string | null;
};
const Ctx = createContext<AuthCtx>({ user: undefined, signIn: async () => {}, signOut: async () => {}, refresh: async () => {}, busy: false, error: null });

const extractSessionId = (url?: string | null) => {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
};

const redirectUrl = () => (Platform.OS === "web" ? `${window.location.origin}/` : Linking.createURL(""));

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sent = useRef(new Set<string>());

  const clear = useCallback(async () => {
    await storage.secureRemove(TOKEN_KEY);
    setToken(null);
    queryClient.clear();
    setUser(null);
  }, []);

  const exchange = useCallback(async (sid: string) => {
    if (sent.current.has(sid)) return false;
    sent.current.add(sid);
    setBusy(true);
    try {
      const r = await api.exchangeSession(sid);
      await storage.secureSet(TOKEN_KEY, r.session_token);
      setToken(r.session_token);
      setError(null);
      queryClient.clear();
      setUser(r.user);
      if (Platform.OS === "web") {
        const u = new URL(window.location.href);
        u.searchParams.delete("session_id");
        const hash = u.hash.replace(/^#/, "").split("&").filter((p) => !p.startsWith("session_id=")).join("&");
        u.hash = hash;
        window.history.replaceState(window.history.state, "", u.toString());
      }
      return true;
    } catch {
      setError("signin_failed");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { clear(); });
    (async () => {
      const initial = Platform.OS === "web" ? window.location.href : await Linking.getInitialURL();
      const sid = extractSessionId(initial);
      if (sid && (await exchange(sid))) return;
      const saved = await storage.secureGet(TOKEN_KEY, null);
      if (typeof saved === "string" && saved) {
        setToken(saved);
        try { setUser(await api.me()); return; } catch { await clear(); return; }
      }
      setUser(null);
    })();
    if (Platform.OS === "web") return;
    const sub = Linking.addEventListener("url", ({ url }) => {
      const sid = extractSessionId(url);
      if (sid) exchange(sid);
    });
    return () => sub.remove();
  }, [clear, exchange]);

  const signIn = useCallback(async () => {
    setError(null);
    const redirect = redirectUrl();
    const authUrl = AUTH_URL + encodeURIComponent(redirect);
    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }
    let captured: string | null = null;
    const sub = Linking.addEventListener("url", ({ url }) => { captured = url; });
    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirect);
      const url = (result.type === "success" ? result.url : null) || captured || (await Linking.getInitialURL());
      const sid = extractSessionId(url);
      if (sid) await exchange(sid);
    } catch {
      setError("signin_failed");
    } finally {
      sub.remove();
    }
  }, [exchange]);

  const signOut = useCallback(async () => {
    try { await api.logout(); } catch { /* local cleanup still happens */ }
    await clear();
  }, [clear]);

  const refresh = useCallback(async () => {
    try { setUser(await api.me()); queryClient.invalidateQueries(); } catch { /* 401 handled globally */ }
  }, []);

  return <Ctx.Provider value={{ user, signIn, signOut, refresh, busy, error }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
