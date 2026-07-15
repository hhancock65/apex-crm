// Pure scoring helpers for AI-driven lead qualification
// (retell-function-handler's create_lead / qualify_lead). The thresholds
// here are the ones spelled out in the feature spec (>70 qualified, 40-70
// contacted, <40 new) — kept in one place so create_lead (which trusts a
// score the AI already computed itself) and qualify_lead (which derives one
// from structured answers below) always land on the same status for the
// same score.

export const LEAD_QUALIFIED_THRESHOLD = 70
export const LEAD_CONTACTED_THRESHOLD = 40

export type DerivedLeadStatus = "qualified" | "contacted" | "new"

export function deriveLeadStatus(score: number): DerivedLeadStatus {
  if (score > LEAD_QUALIFIED_THRESHOLD) return "qualified"
  if (score >= LEAD_CONTACTED_THRESHOLD) return "contacted"
  return "new"
}

export function clampScore(score: number): number {
  return Math.max(1, Math.min(100, Math.round(score)))
}

export interface QualificationAnswers {
  budget?: string
  timeline?: string
  urgency?: string
  decision_maker?: string
}

function matchesAny(value: string, keywords: string[]): boolean {
  const lower = value.toLowerCase()
  return keywords.some((keyword) => lower.includes(keyword))
}

/**
 * Deliberately simple, transparent point-scoring heuristic — not a model,
 * just four independently-scored signals summed to 100. Good enough to
 * triage a live call; a business that wants smarter scoring can replace
 * this function without touching anything that calls it.
 */
export function computeQualificationScore(answers: QualificationAnswers): number {
  let score = 0

  const decisionMaker = answers.decision_maker?.trim().toLowerCase()
  if (decisionMaker) {
    if (matchesAny(decisionMaker, ["yes", "true", "i am", "myself"])) score += 30
    else if (matchesAny(decisionMaker, ["no", "false"])) score += 0
    else score += 10
  } else {
    score += 10
  }

  const urgency = answers.urgency?.trim()
  if (urgency) {
    if (matchesAny(urgency, ["urgent", "asap", "immediately", "high", "today"])) score += 30
    else if (matchesAny(urgency, ["medium", "soon", "moderate"])) score += 18
    else if (matchesAny(urgency, ["low", "not urgent", "just looking", "just browsing"])) score += 5
    else score += 10
  } else {
    score += 10
  }

  const timeline = answers.timeline?.trim()
  if (timeline) {
    if (matchesAny(timeline, ["week", "asap", "immediately", "today", "this month"])) score += 25
    else if (matchesAny(timeline, ["month", "quarter"])) score += 15
    else if (matchesAny(timeline, ["no timeline", "just researching", "not sure"])) score += 5
    else score += 10
  } else {
    score += 10
  }

  const budget = answers.budget?.trim()
  if (budget) {
    if (matchesAny(budget, ["no budget", "none", "n/a", "not sure"])) score += 0
    else score += 15
  } else {
    score += 5
  }

  return clampScore(score)
}

export function recommendedActionForScore(score: number): string {
  if (score > 60) return "create_opportunity"
  if (score >= LEAD_CONTACTED_THRESHOLD) return "schedule_follow_up"
  return "nurture"
}
