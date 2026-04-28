export { broadcastToChannel as broadcastEvent } from './supabase-broadcast';

// Compatibility shim — maps old getSocketServer() call sites to Supabase broadcast.
// API routes that previously called getSocketServer().to(room).emit(event, payload)
// should now call broadcastToChannel(room, event, payload) directly.
export function getSocketServer() {
  return null;
}
