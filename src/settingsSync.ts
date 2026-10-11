import { useCallback, useEffect, useRef, useState } from "react";
import { newSyncCode, parseSyncCode, SyncClient, type PushResult } from "./sync";
import type { Theme } from "./storage";
import type { Unit } from "./weather";

export type SyncSettings = { favourites: string[]; unit: Unit; theme: Theme | null; updatedAt: number };
export type SyncStatus = "off" | "syncing" | "synced" | "offline" | "error";

/** The part of SyncClient that syncing needs, so tests can use a fake. */
export interface SyncTransport {
  pull<T>(): Promise<{ version: number; value: T } | null>;
  push(value: unknown, baseVersion: number): Promise<PushResult>;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Favourites are a union (case-insensitive), ordered by the newest device; unit and theme come from the newest device. */
export function mergeSettings(local: SyncSettings, remote: SyncSettings): SyncSettings {
  const [newer, older] = remote.updatedAt > local.updatedAt ? [remote, local] : [local, remote];
  const seen = new Set<string>();
  const favourites = [...newer.favourites, ...older.favourites].filter((c) => {
    const k = c.trim().toLowerCase();
    return !seen.has(k) && !!seen.add(k);
  });
  return { favourites, unit: newer.unit, theme: newer.theme, updatedAt: newer.updatedAt };
}

/** One sync round: pull, merge, push only when the merge adds something the server lacks. Retries on conflict. */
export async function syncOnce(
  client: SyncTransport,
  local: SyncSettings,
): Promise<{ merged: SyncSettings; changedLocal: boolean; pushed: boolean }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const remote = await client.pull<SyncSettings>();
    const merged = remote ? mergeSettings(local, remote.value) : local;
    const changedLocal = !same(merged, local);
    if (remote && same(merged, remote.value)) return { merged, changedLocal, pushed: false };
    const res = await client.push(merged, remote?.version ?? 0);
    if (res.ok) return { merged, changedLocal, pushed: true };
    if (!res.conflict) throw new Error(res.error);
    local = merged;
  }
  throw new Error("Sync kept conflicting");
}

/** Shared by every Sabin Labs web app on this origin: sign in once on the hub, synced everywhere. */
export const SHARED_CODE_KEY = "sabin-labs-sync-code";
const APP_ID = "weather-dashboard-web";

export function readCode(): string | null {
  try {
    const c = localStorage.getItem(SHARED_CODE_KEY);
    return c && parseSyncCode(c) ? c : null;
  } catch {
    return null;
  }
}

export function writeCode(code: string | null): void {
  try {
    if (code) localStorage.setItem(SHARED_CODE_KEY, code);
    else localStorage.removeItem(SHARED_CODE_KEY);
  } catch {
    // storage blocked: sync stays on for this session only
  }
}

/** Keeps favourites, unit and theme in sync across devices with an end-to-end encrypted sync code. */
export function useSettingsSync(settings: SyncSettings, apply: (s: SyncSettings) => void) {
  const [code, setCode] = useState<string | null>(readCode);
  const [status, setStatus] = useState<SyncStatus>(code ? "syncing" : "off");
  const latest = useRef(settings);
  latest.current = settings;
  const running = useRef(false);

  const run = useCallback(async () => {
    if (!code || running.current) return;
    running.current = true;
    setStatus("syncing");
    try {
      const { merged, changedLocal } = await syncOnce(new SyncClient(code, APP_ID), latest.current);
      if (changedLocal) apply(merged);
      setStatus("synced");
    } catch {
      setStatus(navigator.onLine === false ? "offline" : "error");
    } finally {
      running.current = false;
    }
  }, [code, apply]);

  useEffect(() => {
    if (!code) return;
    const t = setTimeout(run, 2000);
    return () => clearTimeout(t);
  }, [code, settings, run]);

  useEffect(() => {
    if (!code) return;
    const onVisible = () => document.visibilityState === "visible" && void run();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [code, run]);

  const connect = (c: string) => {
    writeCode(c);
    setCode(c);
  };
  const turnOn = () => connect(newSyncCode());
  /** Connects to the code from another device; returns false when the code is not valid. */
  const joinWithCode = (text: string): boolean => {
    const c = text.trim();
    if (!parseSyncCode(c)) return false;
    connect(c);
    return true;
  };
  const turnOff = () => {
    writeCode(null);
    setCode(null);
    setStatus("off");
  };

  return { code, status, turnOn, joinWithCode, turnOff };
}
