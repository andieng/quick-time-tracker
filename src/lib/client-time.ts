// Trusts a client-supplied timestamp (the moment the user actually clicked)
// instead of the server's own clock, so a slow request doesn't inflate the
// recorded duration by however long the round trip took. Clamped to a
// [min, serverNow + 5s] window to bound clock skew and reject abuse.
export function resolveClientTimestamp(clientNow: unknown, minMs: number): number {
  const serverNow = Date.now();
  const clientNowMs = typeof clientNow === "string" ? new Date(clientNow).getTime() : NaN;
  return Number.isFinite(clientNowMs) && clientNowMs >= minMs && clientNowMs <= serverNow + 5000
    ? clientNowMs
    : serverNow;
}
