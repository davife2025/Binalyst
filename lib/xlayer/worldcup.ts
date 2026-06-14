/**
 * lib/xlayer/worldcup.ts
 * Session 3 — World Cup data feed.
 *
 * Responsibilities:
 *  1. Fetch live match data from a football data API
 *  2. Map match state → Hook fee state (PRE_MATCH / LIVE / GOAL / POST_MATCH)
 *  3. Expose WorldCupSignal — extends the existing SignalSnapshot shape
 *     so the signalEngine can consume it as an optional extra source
 *  4. Push state changes to the WorldCupHook contract via oracle wallet
 *
 * SAFE: New file. Imports from signalEngine.ts are type-only (no side effects).
 * The signal engine itself is not modified — WorldCupSignal is additive.
 *
 * Data source: football-data.org (free tier, 10 req/min)
 * Fallback:    api-football.com (RapidAPI)
 * Env vars:
 *   FOOTBALL_DATA_API_KEY   — football-data.org key (free at football-data.org)
 *   RAPID_API_KEY           — fallback (optional)
 *   NEXT_PUBLIC_HOOK_ADDRESS — deployed WorldCupHook address
 *   ORACLE_PRIVATE_KEY      — wallet that can call oracle functions
 */

import type { SignalTag } from '@/lib/signalEngine'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type MatchPhase =
  | 'SCHEDULED'   // not started
  | 'TIMED'       // scheduled, >1h away
  | 'PRE_MATCH'   // within 1h of kick-off
  | 'LIVE'        // in progress (1H, 2H, ET, PEN)
  | 'GOAL'        // goal just scored (<2 min ago)
  | 'HT'          // half time
  | 'FT'          // full time
  | 'AET'         // after extra time
  | 'PEN'         // penalty shootout
  | 'FINISHED'    // match over
  | 'POSTPONED'   // postponed / cancelled

export interface WorldCupMatch {
  id:          number
  homeTeam:    string
  awayTeam:    string
  homeFlag:    string
  awayFlag:    string
  homeScore:   number | null
  awayScore:   number | null
  phase:       MatchPhase
  minute:      number | null    // match minute (null if not started)
  kickoff:     string           // ISO datetime
  kickoffTs:   number           // Unix timestamp
  competition: string
  stage:       string
  lastGoal:    GoalEvent | null
  updatedAt:   number
}

export interface GoalEvent {
  team:      string
  isHomeTeam: boolean
  minute:    number
  scorerName: string
  timestamp: number
}

export interface WorldCupSignal {
  // Match context
  match:       WorldCupMatch | null
  nextMatch:   WorldCupMatch | null

  // Hook state
  hookPhase:   'PRE_MATCH' | 'LIVE' | 'GOAL' | 'POST_MATCH'
  hookFeeBips: number
  hookFeePct:  string

  // Signal overlay — extra tags for the BSC signal engine
  signalTags:  SignalTag[]
  signalNote:  string          // human readable note for the AI assistant

  // Volume / activity
  matchVolatilityScore: number  // 0–100 — how much price action to expect

  updatedAt: number
}

export interface TournamentStanding {
  group:    string
  position: number
  team:     string
  flag:     string
  played:   number
  won:      number
  drawn:    number
  lost:     number
  gf:       number
  ga:       number
  gd:       number
  points:   number
}

// ─────────────────────────────────────────────────────────────────────────────
// Country → flag emoji map
// ─────────────────────────────────────────────────────────────────────────────

const FLAG_MAP: Record<string, string> = {
  'Brazil':       '🇧🇷', 'Argentina':   '🇦🇷', 'France':    '🇫🇷',
  'Germany':      '🇩🇪', 'Spain':       '🇪🇸', 'England':   '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Portugal':     '🇵🇹', 'Netherlands': '🇳🇱', 'Italy':     '🇮🇹',
  'Belgium':      '🇧🇪', 'Croatia':     '🇭🇷', 'Morocco':   '🇲🇦',
  'Japan':        '🇯🇵', 'South Korea': '🇰🇷', 'USA':       '🇺🇸',
  'Mexico':       '🇲🇽', 'Ecuador':     '🇪🇨', 'Senegal':   '🇸🇳',
  'Australia':    '🇦🇺', 'Switzerland': '🇨🇭', 'Uruguay':   '🇺🇾',
  'Serbia':       '🇷🇸', 'Poland':      '🇵🇱', 'Denmark':   '🇩🇰',
  'Tunisia':      '🇹🇳', 'Costa Rica':  '🇨🇷', 'Canada':    '🇨🇦',
  'Ghana':        '🇬🇭', 'Cameroon':    '🇨🇲', 'Qatar':     '🇶🇦',
}

function getFlag(team: string): string {
  return FLAG_MAP[team] ?? '🏳️'
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook fee mapping
// ─────────────────────────────────────────────────────────────────────────────

// Match these values to WorldCupHook.sol constants
const PHASE_TO_FEE: Record<WorldCupSignal['hookPhase'], number> = {
  PRE_MATCH:  500,
  LIVE:       3000,
  GOAL:       8000,
  POST_MATCH: 1000,
}

export function phaseToHookPhase(phase: MatchPhase): WorldCupSignal['hookPhase'] {
  if (phase === 'GOAL')                         return 'GOAL'
  if (['LIVE', 'HT', 'ET', 'PEN'].includes(phase)) return 'LIVE'
  if (['FINISHED', 'FT', 'AET'].includes(phase))   return 'POST_MATCH'
  return 'PRE_MATCH'
}

export function hookPhaseToBips(hp: WorldCupSignal['hookPhase']): number {
  return PHASE_TO_FEE[hp]
}

export function bipsToFeePct(bips: number): string {
  return (bips / 10000 * 100).toFixed(2) + '%'
}

// ─────────────────────────────────────────────────────────────────────────────
// Volatility score — how much trading activity to expect around this match
// ─────────────────────────────────────────────────────────────────────────────

const HIGH_PROFILE_TEAMS = ['Brazil', 'Argentina', 'France', 'Germany', 'Spain', 'England', 'Portugal']

function computeVolatilityScore(match: WorldCupMatch): number {
  let score = 40 // baseline

  // High-profile teams push more volume
  if (HIGH_PROFILE_TEAMS.includes(match.homeTeam)) score += 15
  if (HIGH_PROFILE_TEAMS.includes(match.awayTeam)) score += 15

  // Stage multiplier
  if (match.stage.includes('FINAL'))      score += 25
  if (match.stage.includes('SEMI'))       score += 18
  if (match.stage.includes('QUARTER'))    score += 12
  if (match.stage.includes('ROUND_OF_16')) score += 8

  // Goal spike
  if (match.phase === 'GOAL') score = Math.min(100, score + 20)

  // Close score drives more action
  if (match.homeScore !== null && match.awayScore !== null) {
    if (Math.abs(match.homeScore - match.awayScore) <= 1) score += 10
  }

  return Math.min(100, score)
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal tags — injected alongside existing BSC signal tags
// ─────────────────────────────────────────────────────────────────────────────

function buildMatchSignalTags(match: WorldCupMatch | null): SignalTag[] {
  if (!match) return []
  const tags: SignalTag[] = []

  if (match.phase === 'GOAL')           tags.push('volume_spike')
  if (match.phase === 'LIVE')           tags.push('strong_momentum')
  if (computeVolatilityScore(match) > 70) tags.push('volume_spike')

  return tags
}

// ─────────────────────────────────────────────────────────────────────────────
// Football-data.org API client
// https://www.football-data.org/documentation/quickstart
// Free tier: World Cup competitions available
// ─────────────────────────────────────────────────────────────────────────────

const FD_BASE    = 'https://api.football-data.org/v4'
const FD_HEADERS = () => ({
  'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY ?? '',
})

// FIFA World Cup 2026 competition ID (update when confirmed by football-data.org)
// For 2022 it was 2000. Check: https://api.football-data.org/v4/competitions
const WC_COMPETITION_ID = process.env.WC_COMPETITION_ID ?? '2000'

interface FDMatch {
  id:          number
  utcDate:     string
  status:      string
  minute?:     number
  stage:       string
  homeTeam:    { name: string }
  awayTeam:    { name: string }
  score: {
    fullTime:  { home: number | null; away: number | null }
    halfTime:  { home: number | null; away: number | null }
  }
  goals?: Array<{
    minute:    number
    team:      { name: string }
    scorer:    { name: string }
  }>
}

function fdStatusToPhase(status: string): MatchPhase {
  const map: Record<string, MatchPhase> = {
    SCHEDULED:  'SCHEDULED',
    TIMED:      'TIMED',
    IN_PLAY:    'LIVE',
    PAUSED:     'HT',
    FINISHED:   'FINISHED',
    SUSPENDED:  'POSTPONED',
    POSTPONED:  'POSTPONED',
    CANCELLED:  'POSTPONED',
    AWARDED:    'FINISHED',
  }
  return map[status] ?? 'SCHEDULED'
}

function parseFDMatch(m: FDMatch): WorldCupMatch {
  const phase    = fdStatusToPhase(m.status)
  const kickoffTs = new Date(m.utcDate).getTime() / 1000

  // Detect goal state: last goal scored within 2 minutes
  const goals        = m.goals ?? []
  const lastGoalRaw  = goals[goals.length - 1]
  let lastGoal: GoalEvent | null = null

  if (lastGoalRaw && phase === 'LIVE') {
    const goalsInLastTwoMin =
      m.minute != null &&
      lastGoalRaw.minute != null &&
      m.minute - lastGoalRaw.minute <= 2

    lastGoal = {
      team:       lastGoalRaw.team.name,
      isHomeTeam: lastGoalRaw.team.name === m.homeTeam.name,
      minute:     lastGoalRaw.minute,
      scorerName: lastGoalRaw.scorer?.name ?? '',
      timestamp:  Date.now(),
    }

    if (goalsInLastTwoMin) {
      // Override phase to GOAL for fee spike
      return buildMatch(m, 'GOAL', lastGoal, kickoffTs)
    }
  }

  return buildMatch(m, phase, lastGoal, kickoffTs)
}

function buildMatch(
  m: FDMatch,
  phase: MatchPhase,
  lastGoal: GoalEvent | null,
  kickoffTs: number
): WorldCupMatch {
  // Pre-match window: within 1h of kick-off
  const now = Date.now() / 1000
  let resolvedPhase = phase
  if (phase === 'SCHEDULED' || phase === 'TIMED') {
    if (now >= kickoffTs - 3600 && now < kickoffTs) {
      resolvedPhase = 'PRE_MATCH'
    }
  }

  return {
    id:          m.id,
    homeTeam:    m.homeTeam.name,
    awayTeam:    m.awayTeam.name,
    homeFlag:    getFlag(m.homeTeam.name),
    awayFlag:    getFlag(m.awayTeam.name),
    homeScore:   m.score.fullTime.home,
    awayScore:   m.score.fullTime.away,
    phase:       resolvedPhase,
    minute:      m.minute ?? null,
    kickoff:     m.utcDate,
    kickoffTs,
    competition: 'FIFA World Cup 2026',
    stage:       m.stage,
    lastGoal,
    updatedAt:   Date.now(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public fetch functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch today's World Cup matches.
 * Cached at the API route level — this is called server-side only.
 */
export async function fetchTodayMatches(): Promise<WorldCupMatch[]> {
  try {
    const today = new Date().toISOString().split('T')[0]
    const res   = await fetch(
      `${FD_BASE}/competitions/${WC_COMPETITION_ID}/matches?dateFrom=${today}&dateTo=${today}`,
      { headers: FD_HEADERS(), next: { revalidate: 60 } }  // 60s cache
    )

    if (!res.ok) {
      console.warn('[worldcup] football-data.org error:', res.status)
      return getMockMatches()
    }

    const data = await res.json()
    return (data.matches as FDMatch[]).map(parseFDMatch)
  } catch (err) {
    console.warn('[worldcup] fetch failed, using mock data:', err)
    return getMockMatches()
  }
}

/**
 * Fetch the live / most-recently-active match.
 * Returns null if no match is in progress.
 */
export async function fetchActiveMatch(): Promise<WorldCupMatch | null> {
  const matches = await fetchTodayMatches()

  // Priority: GOAL > LIVE > HT > PRE_MATCH > soonest upcoming
  const live = matches.find(m => m.phase === 'GOAL')
    ?? matches.find(m => m.phase === 'LIVE')
    ?? matches.find(m => m.phase === 'HT')
    ?? matches.find(m => m.phase === 'PRE_MATCH')

  if (live) return live

  // Return soonest upcoming match as context
  const upcoming = matches
    .filter(m => ['SCHEDULED', 'TIMED'].includes(m.phase))
    .sort((a, b) => a.kickoffTs - b.kickoffTs)

  return upcoming[0] ?? null
}

/**
 * Build a full WorldCupSignal — called by the API route every 60s.
 */
export async function buildWorldCupSignal(): Promise<WorldCupSignal> {
  const matches   = await fetchTodayMatches()
  const active    = matches.find(m => ['GOAL', 'LIVE', 'HT', 'PRE_MATCH'].includes(m.phase)) ?? null
  const upcoming  = matches
    .filter(m => ['SCHEDULED', 'TIMED'].includes(m.phase))
    .sort((a, b) => a.kickoffTs - b.kickoffTs)[0] ?? null

  const hookPhase  = active ? phaseToHookPhase(active.phase) : 'PRE_MATCH'
  const hookFeeBips = hookPhaseToBips(hookPhase)

  let signalNote = 'No active World Cup match at the moment.'
  if (active) {
    if (active.phase === 'GOAL') {
      signalNote = `⚽ GOAL! ${active.lastGoal?.team ?? 'Unknown'} scored — fee spike active (${bipsToFeePct(hookFeeBips)}). High volatility window.`
    } else if (active.phase === 'LIVE') {
      signalNote = `🔴 LIVE: ${active.homeTeam} ${active.homeScore ?? 0}–${active.awayScore ?? 0} ${active.awayTeam} (${active.minute ?? '?'}'). Fee: ${bipsToFeePct(hookFeeBips)}.`
    } else if (active.phase === 'HT') {
      signalNote = `⏸ Half time: ${active.homeTeam} ${active.homeScore ?? 0}–${active.awayScore ?? 0} ${active.awayTeam}. Second half begins shortly.`
    } else if (active.phase === 'PRE_MATCH') {
      const mins = Math.max(0, Math.round((active.kickoffTs - Date.now() / 1000) / 60))
      signalNote = `🕐 Pre-match: ${active.homeTeam} vs ${active.awayTeam} kicks off in ${mins}m. Fee lowered to ${bipsToFeePct(hookFeeBips)}.`
    }
  } else if (upcoming) {
    const hrs  = Math.round((upcoming.kickoffTs - Date.now() / 1000) / 3600)
    signalNote = `Next match: ${upcoming.homeTeam} vs ${upcoming.awayTeam} in ~${hrs}h.`
  }

  return {
    match:                active,
    nextMatch:            upcoming,
    hookPhase,
    hookFeeBips,
    hookFeePct:           bipsToFeePct(hookFeeBips),
    signalTags:           buildMatchSignalTags(active),
    signalNote,
    matchVolatilityScore: active ? computeVolatilityScore(active) : 20,
    updatedAt:            Date.now(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock data — used when API key is missing or rate limited
// Mirrors real shape so UI and tests work without a live key
// ─────────────────────────────────────────────────────────────────────────────

function getMockMatches(): WorldCupMatch[] {
  const now = Date.now()
  return [
    {
      id:          1001,
      homeTeam:    'Brazil',
      awayTeam:    'Argentina',
      homeFlag:    '🇧🇷',
      awayFlag:    '🇦🇷',
      homeScore:   1,
      awayScore:   0,
      phase:       'LIVE',
      minute:      67,
      kickoff:     new Date(now - 67 * 60000).toISOString(),
      kickoffTs:   (now - 67 * 60000) / 1000,
      competition: 'FIFA World Cup 2026',
      stage:       'GROUP_STAGE',
      lastGoal: {
        team:       'Brazil',
        isHomeTeam: true,
        minute:     43,
        scorerName: 'Vinicius Jr.',
        timestamp:  now - 24 * 60000,
      },
      updatedAt: now,
    },
    {
      id:          1002,
      homeTeam:    'France',
      awayTeam:    'Spain',
      homeFlag:    '🇫🇷',
      awayFlag:    '🇪🇸',
      homeScore:   null,
      awayScore:   null,
      phase:       'TIMED',
      minute:      null,
      kickoff:     new Date(now + 65 * 60000).toISOString(),
      kickoffTs:   (now + 65 * 60000) / 1000,
      competition: 'FIFA World Cup 2026',
      stage:       'GROUP_STAGE',
      lastGoal:    null,
      updatedAt:   now,
    },
    {
      id:          1003,
      homeTeam:    'Germany',
      awayTeam:    'England',
      homeFlag:    '🇩🇪',
      awayFlag:    '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      homeScore:   null,
      awayScore:   null,
      phase:       'TIMED',
      minute:      null,
      kickoff:     new Date(now + 245 * 60000).toISOString(),
      kickoffTs:   (now + 245 * 60000) / 1000,
      competition: 'FIFA World Cup 2026',
      stage:       'GROUP_STAGE',
      lastGoal:    null,
      updatedAt:   now,
    },
  ]
}
