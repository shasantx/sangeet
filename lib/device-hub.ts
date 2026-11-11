// Real-time in-memory and cloud-backed device presence hub for Sangeet Connect
if (typeof window !== "undefined") {
  throw new Error("lib/device-hub is a server-only module.");
}

export type DeviceState = {
  deviceId: string;
  name: string;
  type: "phone" | "tablet" | "computer" | "browser";
  isPlaying: boolean;
  currentTime: number;
  volume?: number;
  track: {
    source: "youtube" | "audius";
    videoId?: string;
    trackId?: string;
    title: string;
    artist: string;
    album: string;
    artwork: string;
    duration: number;
  } | null;
  lastSeen: number; // Date.now()
};

export type DeviceCommand = {
  id: string;
  targetDeviceId: string;
  action: "play" | "pause" | "next" | "previous" | "seek" | "volume";
  track?: DeviceState["track"];
  currentTime?: number;
  volume?: number;
  sentAt: string;
};

type UserRoom = {
  devices: Map<string, DeviceState>;
  pendingCommands: Map<string, DeviceCommand>; // key: targetDeviceId
  updatedAt: number;
};

const MAX_ROOMS = 5_000;
const MAX_DEVICES_PER_ROOM = 25;
const DEVICE_TTL_MS = 60_000;

declare global {
  // eslint-disable-next-line no-var
  var __sangeet_device_hub__: Map<string, UserRoom> | undefined;
}

const rooms = globalThis.__sangeet_device_hub__ ?? new Map<string, UserRoom>();
if (process.env.NODE_ENV !== "production") {
  globalThis.__sangeet_device_hub__ = rooms;
}

function pruneRoomsIfNeeded(now: number): void {
  if (rooms.size < MAX_ROOMS) return;
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.updatedAt > DEVICE_TTL_MS || room.devices.size === 0) {
      rooms.delete(roomId);
    }
    if (rooms.size < MAX_ROOMS * 0.8) break;
  }
  if (rooms.size >= MAX_ROOMS) {
    const oldestKey = rooms.keys().next().value;
    if (oldestKey) rooms.delete(oldestKey);
  }
}

function getRoom(userId: string): UserRoom {
  const now = Date.now();
  let room = rooms.get(userId);
  if (!room) {
    pruneRoomsIfNeeded(now);
    room = { devices: new Map(), pendingCommands: new Map(), updatedAt: now };
    rooms.set(userId, room);
  } else {
    room.updatedAt = now;
  }
  return room;
}

/**
 * Update or register a device heartbeat in the active room
 */
export function registerDevice(userId: string, state: Omit<DeviceState, "lastSeen">): void {
  const room = getRoom(userId);
  const now = Date.now();

  // Prune dead devices (older than 60s)
  for (const [id, dev] of room.devices.entries()) {
    if (now - dev.lastSeen > DEVICE_TTL_MS) {
      room.devices.delete(id);
      room.pendingCommands.delete(id);
    }
  }

  // Enforce per-room device cap to prevent memory exhaustion
  if (!room.devices.has(state.deviceId) && room.devices.size >= MAX_DEVICES_PER_ROOM) {
    const oldestId = room.devices.keys().next().value;
    if (oldestId) {
      room.devices.delete(oldestId);
      room.pendingCommands.delete(oldestId);
    }
  }

  room.devices.set(state.deviceId, {
    ...state,
    lastSeen: now,
  });
}

/**
 * Get all active devices in a room (seen in last 45s)
 */
export function getActiveDevices(userId: string): DeviceState[] {
  const room = rooms.get(userId);
  if (!room) return [];
  const now = Date.now();
  const list: DeviceState[] = [];
  for (const dev of room.devices.values()) {
    if (now - dev.lastSeen <= 45_000) {
      list.push(dev);
    }
  }
  return list.sort((a, b) => b.lastSeen - a.lastSeen);
}

/**
 * Queue a remote command for a target device
 */
export function sendDeviceCommand(userId: string, cmd: DeviceCommand): boolean {
  const room = getRoom(userId);
  if (cmd.targetDeviceId === "all") {
    let deliveredAny = false;
    for (const devId of room.devices.keys()) {
      room.pendingCommands.set(devId, { ...cmd, targetDeviceId: devId, id: `${cmd.id}-${devId}` });
      deliveredAny = true;
    }
    return deliveredAny || true;
  }
  const target = room.devices.get(cmd.targetDeviceId);
  if (!target || Date.now() - target.lastSeen > 45_000) {
    return false;
  }
  room.pendingCommands.set(cmd.targetDeviceId, cmd);
  return true;
}

/**
 * Consume pending command for a device
 */
export function popDeviceCommand(userId: string, deviceId: string): DeviceCommand | null {
  const room = rooms.get(userId);
  if (!room) return null;
  const cmd = room.pendingCommands.get(deviceId);
  if (!cmd) return null;
  // If command is older than 60s, discard
  if (Date.now() - Date.parse(cmd.sentAt) > DEVICE_TTL_MS) {
    room.pendingCommands.delete(deviceId);
    return null;
  }
  return cmd;
}

/**
 * Acknowledge command executed
 */
export function ackDeviceCommand(userId: string, deviceId: string, commandId: string): void {
  const room = rooms.get(userId);
  if (!room) return;
  const cmd = room.pendingCommands.get(deviceId);
  if (cmd && cmd.id === commandId) {
    room.pendingCommands.delete(deviceId);
  }
}
