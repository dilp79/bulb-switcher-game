import { XP_CONFIG, RANKS } from './constants.js';

/**
 * Calculate cumulative XP needed to reach a given rank.
 * Formula per rank n: 500 * n * (1 + floor(n/5) * 0.5)
 * Cumulative = sum of all ranks from 1 to (targetRank - 1)
 */
export function getXpThresholdForRank(targetRank) {
  let total = 0;
  for (let n = 1; n < targetRank; n++) {
    total += 500 * n * (1 + Math.floor(n / 5) * 0.5);
  }
  return total;
}

/**
 * Determine rank for a given total XP amount.
 */
export function getRankForXp(totalXp) {
  let rank = 1;
  while (getXpThresholdForRank(rank + 1) <= totalXp) {
    rank++;
  }
  return rank;
}

/**
 * Get detailed rank progress for display.
 */
export function getRankProgress(totalXp) {
  const rank = getRankForXp(totalXp);
  const currentThreshold = getXpThresholdForRank(rank);
  const nextThreshold = getXpThresholdForRank(rank + 1);
  const xpNeededForNext = nextThreshold - currentThreshold;
  const currentXpInRank = totalXp - currentThreshold;
  const fraction = xpNeededForNext > 0 ? currentXpInRank / xpNeededForNext : 0;

  return {
    rank,
    currentXpInRank,
    xpNeededForNext,
    fraction,
    title: getRankTitle(rank),
    color: getRankColor(rank),
  };
}

/**
 * Get rank title from RANKS table.
 */
export function getRankTitle(rank) {
  const entry = RANKS.find(r => rank >= r.minLevel && rank <= r.maxLevel);
  return entry ? entry.title : RANKS[RANKS.length - 1].title;
}

/**
 * Get rank color from RANKS table.
 */
export function getRankColor(rank) {
  const entry = RANKS.find(r => rank >= r.minLevel && rank <= r.maxLevel);
  return entry ? entry.color : RANKS[RANKS.length - 1].color;
}

/**
 * Calculate XP earned for completing a level.
 * Returns integer XP.
 */
export function calculateXpForLevel({ stars, complexity, isFirstClear, streakDays }) {
  const starMultiplier = XP_CONFIG.starMultipliers[stars] || 1;
  let xp = XP_CONFIG.baseCompletion * starMultiplier * complexity;

  if (isFirstClear) {
    xp *= (1 + XP_CONFIG.firstClearBonus);
  }

  if (streakDays > 0) {
    const streakBonus = Math.min(streakDays * 0.1, 0.5);
    xp *= (1 + streakBonus);
  }

  return Math.round(xp);
}
