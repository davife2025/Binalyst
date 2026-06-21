/**
 * lib/croo/capMetrics.ts
 * In-memory metrics for CAP calls. 
 * (Note: Resets on server cold start. Upgrade to Vercel KV/Redis for production).
 */

export const callCounts: Record<string, number> = {}
export const revenueUSDC: Record<string, number> = {}

export function incrementCallCount(serviceId: string, priceUSDC: number) {
  callCounts[serviceId] = (callCounts[serviceId] ?? 0) + 1
  revenueUSDC[serviceId] = (revenueUSDC[serviceId] ?? 0) + priceUSDC
}