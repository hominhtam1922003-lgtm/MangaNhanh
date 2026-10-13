import {
  BROKERS,
  RelayClient,
  buildRelayPayload,
  createRoom,
  makeCode,
  roomFromCode,
  roomFromQr,
  roomToQr,
} from "./relayProtocol.mjs";
import type { State } from "./localdb";
export type Room = {
  id: string;
  key: string;
  mode: string;
  code?: string | null;
  role?: string | null;
};
export type RelayStatus = {
  state: string;
  broker: string | null;
  partnerOnline: boolean;
  partnerName?: string | null;
};
export { BROKERS, createRoom, makeCode, roomFromCode, roomFromQr, roomToQr };
export function roomFromState(state: State): Room | null {
  const relay = (state as State & { relay?: Room | null }).relay;
  if (!relay?.id || !relay?.key) return null;
  return {
    id: relay.id,
    key: relay.key,
    mode: relay.mode ?? "qr",
    code: (relay as { code?: string | null }).code ?? null,
    role: (relay as { role?: string | null }).role ?? "host",
  };
}
export function relayPayloadFor(state: State, deviceId: string) {
  return buildRelayPayload(state, 60000, deviceId);
}
export function payloadKey(payload: unknown) {
  return JSON.stringify(payload);
}
export { RelayClient };
