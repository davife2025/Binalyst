/**
 * app/.well-known/cap-agent/route.ts
 * Standard CAP discovery endpoint — served at /.well-known/cap-agent
 * CROO Agent Store and other agents fetch this to discover Binalyst's services.
 */
export { GET, OPTIONS } from '@/app/api/cap/manifest/route'
