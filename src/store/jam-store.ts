"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  JamSession,
  isJamConfigured,
  makeJamCode,
  normaliseJamCode,
  type JamMember,
  type JamRole,
  type JamStateMessage
} from "@/lib/jam-session";
import { useToastStore } from "@/store/toast-store";

export type JamStatus = "idle" | "connecting" | "live" | "ended" | "error";

interface JamState {
  status: JamStatus;
  role: JamRole | null;
  code: string | null;
  members: JamMember[];
  allowGuestControl: boolean;
  hostName: string | null;
  message: string | null;
  /** Name shown to other listeners (remembered on this device). */
  displayName: string;

  setDisplayName: (name: string) => void;
  startJam: () => Promise<void>;
  joinJam: (code: string) => Promise<void>;
  leaveJam: () => Promise<void>;
  setAllowGuestControl: (allow: boolean) => void;
  resync: () => void;
}

let session: JamSession | null = null;

function defaultName(): string {
  return `Listener ${Math.floor(100 + Math.random() * 900)}`;
}

export const useJamStore = create<JamState>()(
  persist(
    (set, get) => {
      const open = async (code: string, role: JamRole) => {
        if (!isJamConfigured()) {
          set({ status: "error", message: "Jam isn't set up on this server yet." });
          return;
        }
        await session?.leave();
        const name = get().displayName.trim() || defaultName();
        set({
          status: "connecting",
          role,
          code,
          members: [],
          message: null,
          hostName: role === "host" ? name : null,
          allowGuestControl: false
        });
        const s: JamSession = new JamSession(code, role, name, {
          onMembers: (members) => session === s && set({ members }),
          onHostState: (msg: JamStateMessage) =>
            session === s && set({ hostName: msg.hostName, allowGuestControl: msg.allowGuestControl }),
          onEnded: (reason) => {
            if (session !== s) return;
            session = null;
            set({ status: "ended", message: reason, members: [] });
            useToastStore.getState().showToast(reason);
          },
          onNotice: (text) => session === s && useToastStore.getState().showToast(text),
          onStatus: (status, error) => {
            if (session !== s) return;
            set({ status, message: error ?? null });
          }
        });
        session = s;
        await s.connect();
      };

      return {
        status: "idle",
        role: null,
        code: null,
        members: [],
        allowGuestControl: false,
        hostName: null,
        message: null,
        displayName: "",

        setDisplayName: (displayName) => set({ displayName: displayName.slice(0, 32) }),
        startJam: () => open(makeJamCode(), "host"),
        joinJam: async (raw) => {
          const code = normaliseJamCode(raw);
          if (code.length !== 6) {
            set({ status: "error", message: "Jam codes are 6 letters or numbers." });
            return;
          }
          await open(code, "guest");
        },
        leaveJam: async () => {
          const s = session;
          session = null;
          await s?.leave();
          set({ status: "idle", role: null, code: null, members: [], message: null, hostName: null });
        },
        setAllowGuestControl: (allow) => {
          session?.setAllowGuestControl(allow);
          set({ allowGuestControl: allow });
        },
        resync: () => session?.resync()
      };
    },
    {
      name: "sangeet-v2-jam",
      // Only the display name survives a reload; a live Jam never auto-reconnects.
      partialize: (s) => ({ displayName: s.displayName })
    }
  )
);
