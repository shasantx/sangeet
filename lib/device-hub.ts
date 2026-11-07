// Real-time in-memory and cloud-backed device presence hub for Sangeet Connect
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
};

declare global {
  // eslint-disable-next-line no-var
  var __sangeet_device_hub__: Map<string, UserRoom> | undefined;
}

const rooms = globalThis.__sangeet_device_hub__ ?? new Map<string, UserRoom>();
if (process.env.NODE_ENV !== "production") {
  globalThis.__sangeet_device_hub__ = rooms;
}

function getRoom(userId: string): UserRoom {
  let room = rooms.get(userId);
  if (!room) {
    room = { devices: new Map(), pendingCommands: new Map() };
    rooms.set(userId, room);
  }
  return room;
}

/**
 * Update or register a device heartbeat in the active room
 */
export function registerDevice(userId: string, state: Omit<DeviceState, "lastSeen">): void {
  const room = getRoom(userId);
  const now = Date.now();
  room.devices.set(state.deviceId, {
    ...state,
    lastSeen: now,
  });

  // Prune dead devices (older than 60s)
  for (const [id, dev] of room.devices.entries()) {
    if (now - dev.lastSeen > 60_000) {
      room.devices.delete(id);
      room.pendingCommands.delete(id);
    }
  }
}

/**
 * Get all active devices in a room (seen in last 45s)
 */
export function getActiveDevices(userId: string): DeviceState[] {
  const room = getRoom(userId);
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
  const room = getRoom(userId);
  const cmd = room.pendingCommands.get(deviceId);
  if (!cmd) return null;
  // If command is older than 60s, discard
  if (Date.now() - Date.parse(cmd.sentAt) > 60_000) {
    room.pendingCommands.delete(deviceId);
    return null;
  }
  return cmd;
}

/**
 * Acknowledge command executed
 */
export function ackDeviceCommand(userId: string, deviceId: string, commandId: string): void {
  const room = getRoom(userId);
  const cmd = room.pendingCommands.get(deviceId);
  if (cmd && cmd.id === commandId) {
    room.pendingCommands.delete(deviceId);
  }
}
