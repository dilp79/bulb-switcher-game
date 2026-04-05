# UX Refresh Phase 1: Foundation — Stars, XP, Ranks, Player State

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add star rating system, XP, ranks, and player state persistence — the data backbone that all engagement features build on.

**Architecture:** New `player.js` module owns XP/rank/star calculations and player state. `storage.js` gets a new key for player data. `logic.js` gains star calculation (it already has `findLevelSolution`). `app.js` integrates star display into victory and level cards. All new logic is pure functions testable without DOM.

**Tech Stack:** Vanilla JS (ES6 modules), localStorage, existing project patterns.

**Phases Overview:**
- **Phase 1 (this plan):** Stars, XP, ranks, player state
- **Phase 2:** Game juice — animations, particles, Web Audio synthesis
- **Phase 3:** Achievements, daily challenge, streaks, home screen redesign
- **Phase 4:** Cosmetics, customization screen, PWA, mobile UX

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `js/app/player.js` | Create | XP calculation, rank lookup, star calculation, player state management |
| `js/app/constants.js` | Modify | Add rank table, XP formulas, star thresholds |
| `js/app/logic.js` | Modify | Add `calculateStars()` function using existing `findLevelSolution()` |
| `js/app/storage.js` | Modify | Add player state load/save with new localStorage key |
| `js/app/app.js` | Modify | Integrate stars into victory flow, XP award on completion, rank display |
| `css/style.css` | Modify | Star display, XP bar, rank badge styles |
| `tests/player.test.js` | Create | Unit tests for player module |
| `tests/stars.test.js` | Create | Unit tests for star calculation |

---

### Task 1: Add Rank Table and XP Constants

**Files:**
- Modify: `js/app/constants.js`

- [ ] **Step 1: Add rank and XP constants to constants.js**

Open `js/app/constants.js` and add the following at the end of the file:

```javascript
export const RANKS = [
  { minLevel: 1,  maxLevel: 3,  title: 'Spark',           color: '#6f849e' },
  { minLevel: 4,  maxLevel: 6,  title: 'Filament',        color: '#42d6d2' },
  { minLevel: 7,  maxLevel: 9,  title: 'Circuit Breaker', color: '#7ef0ac' },
  { minLevel: 10, maxLevel: 13, title: 'Surge Master',    color: '#ffb300' },
  { minLevel: 14, maxLevel: 17, title: 'Arc Welder',      color: '#ffcc40' },
  { minLevel: 18, maxLevel: 21, title: 'Dynamo',          color: '#ff9800' },
  { minLevel: 22, maxLevel: 25, title: 'Tesla',           color: '#ff7e7e' },
  { minLevel: 26, maxLevel: 99, title: 'Luminary',        color: '#e040fb' },
];

export const XP_CONFIG = {
  baseCompletion: 100,
  starMultipliers: { 1: 1, 2: 1.5, 3: 2 },
  firstClearBonus: 0.5,
  dailyChallengeBase: 200,
};

export const STAR_CONFIG = {
  moveMultiplier2Star: 2.0,
  moveMultiplier3Star: 1.5,
  timePerMove: 5,
};

export const DEFAULT_PLAYER = {
  xp: 0,
  rank: 1,
  streak: {
    current: 0,
    lastPlayedDate: null,
    freezesAvailable: 0,
  },
  achievements: [],
  cosmetics: {
    activeBulbTheme: 'classic',
    activeBoardStyle: 'deep-space',
    activeButtonStyle: 'classic',
    unlocked: ['classic', 'deep-space'],
  },
  dailyChallenge: {
    lastCompletedDate: null,
    completedCount: 0,
    calendar: {},
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add js/app/constants.js
git commit -m "feat: add rank table, XP config, and star threshold constants"
```

---

### Task 2: Star Calculation in logic.js

**Files:**
- Create: `tests/stars.test.js`
- Modify: `js/app/logic.js`

- [ ] **Step 1: Create test file for star calculation**

Create `tests/stars.test.js`. Since this project has no test runner set up yet, we'll use a simple Node.js test approach. First check if a test runner exists:

```bash
ls package.json 2>/dev/null; ls node_modules/.bin/vitest 2>/dev/null; ls node_modules/.bin/jest 2>/dev/null
```

If no test runner exists, set one up:

```bash
npm init -y
npm install --save-dev vitest
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Create `vitest.config.js` at project root:

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 2: Write failing tests for calculateStars**

Create `tests/stars.test.js`:

```javascript
import { calculateStars } from '../js/app/logic.js';

describe('calculateStars', () => {
  test('returns 1 star when hint was used', () => {
    const result = calculateStars({
      optimalMoves: 3,
      actualMoves: 3,
      elapsedSeconds: 5,
      hintUsed: true,
    });
    expect(result).toBe(1);
  });

  test('returns 3 stars for optimal moves within time target', () => {
    const result = calculateStars({
      optimalMoves: 4,
      actualMoves: 5,   // 5 <= 4 * 1.5 = 6
      elapsedSeconds: 15, // 15 <= 4 * 5 = 20
      hintUsed: false,
    });
    expect(result).toBe(3);
  });

  test('returns 3 stars for exactly optimal moves', () => {
    const result = calculateStars({
      optimalMoves: 3,
      actualMoves: 3,
      elapsedSeconds: 10,
      hintUsed: false,
    });
    expect(result).toBe(3);
  });

  test('returns 2 stars when moves within 2x but over 1.5x', () => {
    const result = calculateStars({
      optimalMoves: 4,
      actualMoves: 7,   // 7 <= 4 * 2 = 8, but 7 > 4 * 1.5 = 6
      elapsedSeconds: 10,
      hintUsed: false,
    });
    expect(result).toBe(2);
  });

  test('returns 2 stars when time exceeds target but moves are good', () => {
    const result = calculateStars({
      optimalMoves: 4,
      actualMoves: 5,   // 5 <= 6 (good)
      elapsedSeconds: 25, // 25 > 20 (over time)
      hintUsed: false,
    });
    expect(result).toBe(2);
  });

  test('returns 1 star when moves exceed 2x optimal', () => {
    const result = calculateStars({
      optimalMoves: 3,
      actualMoves: 7,   // 7 > 3 * 2 = 6
      elapsedSeconds: 10,
      hintUsed: false,
    });
    expect(result).toBe(1);
  });

  test('handles edge case where optimalMoves is 1', () => {
    const result = calculateStars({
      optimalMoves: 1,
      actualMoves: 1,
      elapsedSeconds: 3,
      hintUsed: false,
    });
    expect(result).toBe(3);
  });

  test('returns 1 star for null optimalMoves (unsolvable level fallback)', () => {
    const result = calculateStars({
      optimalMoves: null,
      actualMoves: 5,
      elapsedSeconds: 10,
      hintUsed: false,
    });
    expect(result).toBe(1);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run tests/stars.test.js
```

Expected: FAIL — `calculateStars` is not exported from logic.js.

- [ ] **Step 4: Implement calculateStars in logic.js**

Add at the end of `js/app/logic.js`, before any closing brace or after the last export:

```javascript
export function calculateStars({ optimalMoves, actualMoves, elapsedSeconds, hintUsed }) {
  if (hintUsed || optimalMoves === null) {
    return 1;
  }

  const timeTarget = optimalMoves * 5;
  const movesFor3Star = optimalMoves * 1.5;
  const movesFor2Star = optimalMoves * 2;

  if (actualMoves <= movesFor3Star && elapsedSeconds <= timeTarget) {
    return 3;
  }
  if (actualMoves <= movesFor2Star) {
    return 2;
  }
  return 1;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/stars.test.js
```

Expected: All 8 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add js/app/logic.js tests/stars.test.js vitest.config.js package.json package-lock.json
git commit -m "feat: add calculateStars function with full test coverage"
```

---

### Task 3: Player Module — XP and Rank Calculations

**Files:**
- Create: `js/app/player.js`
- Create: `tests/player.test.js`

- [ ] **Step 1: Write failing tests for player module**

Create `tests/player.test.js`:

```javascript
import {
  calculateXpForLevel,
  getRankForXp,
  getXpThresholdForRank,
  getRankProgress,
} from '../js/app/player.js';

describe('getXpThresholdForRank', () => {
  test('rank 1 requires 0 cumulative XP', () => {
    expect(getXpThresholdForRank(1)).toBe(0);
  });

  test('rank 2 requires 500 XP', () => {
    expect(getXpThresholdForRank(2)).toBe(500);
  });

  test('rank 5 requires sum of ranks 1-4 XP', () => {
    // rank 1→2: 500*1*1=500, rank 2→3: 500*2*1=1000, rank 3→4: 500*3*1=1500, rank 4→5: 500*4*1=2000
    expect(getXpThresholdForRank(5)).toBe(5000);
  });

  test('rank 6 has higher scaling (crosses floor(5/5)=1 bracket)', () => {
    // rank 5→6: 500*5*(1+1*0.5) = 500*5*1.5 = 3750
    expect(getXpThresholdForRank(6)).toBe(5000 + 3750);
  });
});

describe('getRankForXp', () => {
  test('0 XP is rank 1', () => {
    expect(getRankForXp(0)).toBe(1);
  });

  test('499 XP is still rank 1', () => {
    expect(getRankForXp(499)).toBe(1);
  });

  test('500 XP is rank 2', () => {
    expect(getRankForXp(500)).toBe(2);
  });

  test('large XP gives high rank', () => {
    const rank = getRankForXp(100000);
    expect(rank).toBeGreaterThan(15);
  });
});

describe('getRankProgress', () => {
  test('returns 0 progress at rank threshold', () => {
    const progress = getRankProgress(500); // exactly rank 2
    expect(progress.rank).toBe(2);
    expect(progress.currentXpInRank).toBe(0);
    expect(progress.xpNeededForNext).toBe(1000); // 500*2*1 to go from rank 2→3
    expect(progress.fraction).toBe(0);
  });

  test('returns partial progress within rank', () => {
    const progress = getRankProgress(750); // rank 2, 250 into it
    expect(progress.rank).toBe(2);
    expect(progress.currentXpInRank).toBe(250);
    expect(progress.fraction).toBeCloseTo(0.25);
  });
});

describe('calculateXpForLevel', () => {
  test('base XP with 1 star, no bonuses', () => {
    const xp = calculateXpForLevel({
      stars: 1,
      complexity: 1.3,
      isFirstClear: false,
      streakDays: 0,
    });
    // 100 * 1 * 1.3 = 130
    expect(xp).toBe(130);
  });

  test('3 star multiplier applies', () => {
    const xp = calculateXpForLevel({
      stars: 3,
      complexity: 1.0,
      isFirstClear: false,
      streakDays: 0,
    });
    // 100 * 2 * 1.0 = 200
    expect(xp).toBe(200);
  });

  test('first clear bonus adds 50%', () => {
    const xp = calculateXpForLevel({
      stars: 1,
      complexity: 1.0,
      isFirstClear: true,
      streakDays: 0,
    });
    // 100 * 1 * 1.0 * 1.5 = 150
    expect(xp).toBe(150);
  });

  test('streak bonus adds 10% per day, capped at 50%', () => {
    const xp = calculateXpForLevel({
      stars: 1,
      complexity: 1.0,
      isFirstClear: false,
      streakDays: 7,
    });
    // 100 * 1 * 1.0 * 1.5 (capped) = 150
    expect(xp).toBe(150);
  });

  test('all bonuses stack multiplicatively', () => {
    const xp = calculateXpForLevel({
      stars: 3,
      complexity: 1.5,
      isFirstClear: true,
      streakDays: 3,
    });
    // base: 100 * 2 * 1.5 = 300
    // first clear: 300 * 1.5 = 450
    // streak (3 days = +30%): 450 * 1.3 = 585
    expect(xp).toBe(585);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/player.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement player.js**

Create `js/app/player.js`:

```javascript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/player.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add js/app/player.js tests/player.test.js
git commit -m "feat: add player module with XP calculation, rank lookup, and progress tracking"
```

---

### Task 4: Player State Persistence in Storage

**Files:**
- Modify: `js/app/storage.js`

- [ ] **Step 1: Read current storage.js**

Read `js/app/storage.js` to confirm the current API and patterns.

- [ ] **Step 2: Add player state methods to StorageService**

Add a new storage key constant and player methods. Add these to the `StorageService` class in `js/app/storage.js`:

At the top of the file, add the import:

```javascript
import { DEFAULT_PLAYER } from './constants.js';
```

Add the storage key (near the other key definitions — look for `'bulb-switcher.progress.v2'` pattern):

```javascript
const PLAYER_KEY = 'bulb-switcher.player.v1';
```

Add these methods to the `StorageService` class:

```javascript
  loadPlayer() {
    try {
      const raw = this.storage.getItem(PLAYER_KEY);
      if (!raw) return { ...DEFAULT_PLAYER };
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_PLAYER, ...parsed };
    } catch {
      return { ...DEFAULT_PLAYER };
    }
  }

  savePlayer(player) {
    try {
      this.storage.setItem(PLAYER_KEY, JSON.stringify(player));
    } catch {
      // Storage full or unavailable — silent fail
    }
  }

  addPlayerXp(amount) {
    const player = this.loadPlayer();
    player.xp += amount;
    this.savePlayer(player);
    return player;
  }
```

- [ ] **Step 3: Commit**

```bash
git add js/app/storage.js
git commit -m "feat: add player state persistence to StorageService"
```

---

### Task 5: Extend Level Results with Stars and XP

**Files:**
- Modify: `js/app/storage.js`

- [ ] **Step 1: Enhance recordLevelCompletion to include stars and XP**

Find the existing `recordLevelCompletion` method in `js/app/storage.js` (around line 95-108). Replace it with an enhanced version that also stores stars and XP:

```javascript
  recordLevelCompletion(levelRef, time, moves, stars, xpEarned, hintUsed) {
    const progress = this.loadProgress();
    const key = this.levelKey(levelRef);

    const prev = progress.results[key];
    const bestMoves = prev ? Math.min(prev.moves, moves) : moves;
    const bestTime = prev ? Math.min(prev.time, time) : time;
    const bestStars = prev ? Math.max(prev.stars || 0, stars) : stars;
    const newRecord = !prev || moves < prev.moves || time < prev.time;

    progress.results[key] = {
      moves: bestMoves,
      time: bestTime,
      stars: bestStars,
      xpEarned: (prev?.xpEarned || 0) + xpEarned,
      hintUsed: prev ? (prev.hintUsed && hintUsed) : hintUsed,
    };
    progress.completed[key] = true;
    this.saveProgress(progress);

    return { newRecord, bestStars };
  }
```

- [ ] **Step 2: Commit**

```bash
git add js/app/storage.js
git commit -m "feat: extend level results to track stars, XP, and hint usage"
```

---

### Task 6: Integrate Star Calculation into Victory Flow

**Files:**
- Modify: `js/app/app.js`
- Modify: `js/app/logic.js`

- [ ] **Step 1: Add solution length lookup to logic.js**

Add a helper function to `js/app/logic.js` that returns the optimal move count for a level:

```javascript
export function getOptimalMoveCount(level) {
  const solution = findLevelSolution(level);
  if (!solution) return null;
  return solution.reduce((sum, presses) => sum + presses, 0);
}
```

- [ ] **Step 2: Import new modules in app.js**

At the top of `js/app/app.js`, find the existing imports from `./logic.js` and add `calculateStars` and `getOptimalMoveCount`:

```javascript
import { applyButtonPress, isSolved, calculateStars, getOptimalMoveCount, /* ...existing imports */ } from './logic.js';
```

Add a new import for the player module:

```javascript
import { calculateXpForLevel, getRankProgress } from './player.js';
```

- [ ] **Step 3: Modify completeGame() to calculate stars and award XP**

Find the `completeGame()` method in `js/app/app.js` (around line 333-359). Modify it to calculate stars and XP. After the existing code that sets `session.victory`, add the star/XP logic:

Find the line that calls `this.storage.recordLevelCompletion(` and replace the surrounding block. The current call looks approximately like:

```javascript
const result = this.storage.recordLevelCompletion(session.levelRef, elapsed, session.moves);
```

Replace with:

```javascript
    const optimalMoves = getOptimalMoveCount(session.level);
    const stars = calculateStars({
      optimalMoves,
      actualMoves: session.moves,
      elapsedSeconds: elapsed,
      hintUsed: session.hintUsed,
    });

    const isFirstClear = !this.storage.isLevelCompleted(session.levelRef);
    const complexity = session.level.complexity || 1;
    const player = this.storage.loadPlayer();
    const xpEarned = calculateXpForLevel({
      stars,
      complexity,
      isFirstClear,
      streakDays: player.streak.current,
    });

    const result = this.storage.recordLevelCompletion(
      session.levelRef, elapsed, session.moves, stars, xpEarned, session.hintUsed
    );

    const updatedPlayer = this.storage.addPlayerXp(xpEarned);
    const rankProgress = getRankProgress(updatedPlayer.xp);
```

Then extend the `session.victory` object to include the new data:

```javascript
    session.victory = {
      time: elapsed,
      moves: session.moves,
      newRecord: result.newRecord,
      stars,
      xpEarned,
      rankProgress,
      previousRank: getRankProgress(updatedPlayer.xp - xpEarned).rank,
      nextLevelRef: this.levelRepository.getNextLevelRef(session.levelRef),
    };
```

- [ ] **Step 4: Commit**

```bash
git add js/app/app.js js/app/logic.js
git commit -m "feat: integrate star rating and XP into victory flow"
```

---

### Task 7: Victory Overlay — Star and XP Display

**Files:**
- Modify: `js/app/app.js` (render methods)
- Modify: `css/style.css`

- [ ] **Step 1: Find the current victory overlay template in app.js**

Search for the victory rendering in `renderGame()` method (around line 1034-1145 in app.js). Look for the section that renders when `session.victory` is truthy. It likely contains a victory overlay div.

- [ ] **Step 2: Replace victory overlay template**

Find the existing victory overlay HTML template in the `renderGame()` method. Replace it with a version that shows stars, XP earned, and rank progress. The exact location depends on the current template, but look for HTML containing victory-related content (confetti, completion message, etc).

Replace the victory overlay section with:

```javascript
    const victoryHtml = session.victory ? `
      <div class="victory-overlay">
        <div class="victory-card">
          <h2 class="victory-title">Уровень пройден!</h2>

          <div class="victory-stars">
            ${[1, 2, 3].map(i => `
              <span class="victory-star ${i <= session.victory.stars ? 'is-earned' : 'is-empty'}">★</span>
            `).join('')}
          </div>

          <div class="victory-stats">
            <div class="victory-stat">
              <span class="victory-stat-value">${session.victory.moves}</span>
              <span class="victory-stat-label">Ходов</span>
            </div>
            <div class="victory-stat">
              <span class="victory-stat-value">${this.formatTime(session.victory.time)}</span>
              <span class="victory-stat-label">Время</span>
            </div>
          </div>

          <div class="victory-xp">
            <span class="victory-xp-amount">+${session.victory.xpEarned} XP</span>
            ${session.victory.previousRank < session.victory.rankProgress.rank
              ? `<div class="victory-rankup">Новый ранг: ${session.victory.rankProgress.title}!</div>`
              : ''
            }
          </div>

          <div class="victory-rank-bar">
            <div class="victory-rank-label">
              <span>${session.victory.rankProgress.title}</span>
              <span>Ур. ${session.victory.rankProgress.rank}</span>
            </div>
            <div class="victory-rank-track">
              <div class="victory-rank-fill" style="width: ${Math.round(session.victory.rankProgress.fraction * 100)}%"></div>
            </div>
          </div>

          ${session.victory.newRecord ? '<div class="victory-record">Новый рекорд!</div>' : ''}

          <div class="victory-actions">
            ${session.victory.nextLevelRef
              ? '<button class="btn btn--primary" data-action="nextLevel">Следующий уровень</button>'
              : ''
            }
            <button class="btn btn--secondary" data-action="restartGame">Переиграть</button>
            <button class="btn btn--ghost" data-action="openLevelSelect">К уровням</button>
          </div>
        </div>
      </div>
    ` : '';
```

Insert this `victoryHtml` variable where the old victory overlay was in the template.

- [ ] **Step 3: Add CSS for victory stars, XP, and rank bar**

Add to the end of `css/style.css`:

```css
/* Victory overlay enhancements */
.victory-card {
  text-align: center;
  max-width: 380px;
  margin: 0 auto;
  padding: 36px 28px;
}

.victory-title {
  font-family: var(--font-display);
  font-size: 1.8rem;
  font-weight: 700;
  margin-bottom: 20px;
}

.victory-stars {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 24px;
}

.victory-star {
  font-size: 2.8rem;
  line-height: 1;
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.victory-star.is-earned {
  color: var(--primary);
  text-shadow: 0 0 20px rgba(255, 179, 0, 0.5);
}

.victory-star.is-empty {
  color: var(--text-dim);
  opacity: 0.3;
}

.victory-stats {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin-bottom: 20px;
}

.victory-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.victory-stat-value {
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text);
}

.victory-stat-label {
  font-size: 0.8rem;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.victory-xp {
  margin-bottom: 16px;
}

.victory-xp-amount {
  font-family: var(--font-display);
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--secondary);
}

.victory-rankup {
  margin-top: 8px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--primary);
  text-shadow: 0 0 12px rgba(255, 179, 0, 0.4);
}

.victory-rank-bar {
  margin-bottom: 20px;
}

.victory-rank-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-soft);
  margin-bottom: 6px;
}

.victory-rank-track {
  height: 8px;
  background: var(--bg-soft);
  border-radius: 4px;
  overflow: hidden;
}

.victory-rank-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--primary-strong));
  border-radius: 4px;
  transition: width 0.6s ease;
}

.victory-record {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--success);
  margin-bottom: 16px;
}

.victory-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}
```

- [ ] **Step 4: Commit**

```bash
git add js/app/app.js css/style.css
git commit -m "feat: add star rating, XP, and rank progress to victory overlay"
```

---

### Task 8: Star Display on Level Cards

**Files:**
- Modify: `js/app/app.js` (renderLevels method)
- Modify: `css/style.css`

- [ ] **Step 1: Find the level card template in app.js**

Look in the `renderLevels()` method (around line 940-989). Find where individual level cards are rendered — there should be a loop over levels that builds HTML for each card.

- [ ] **Step 2: Add stars to level cards**

In the level card template, find where completion status is shown. Add star display after the existing completion badge. The exact insertion point depends on the current template, but add this within each level card's HTML:

```javascript
const levelResult = this.storage.getLevelResult(levelRef);
const starsHtml = levelResult?.stars
  ? `<span class="level-card-stars">${'★'.repeat(levelResult.stars)}${'☆'.repeat(3 - levelResult.stars)}</span>`
  : '';
```

Insert `${starsHtml}` in the card template where the completion indicator currently appears.

- [ ] **Step 3: Add CSS for level card stars**

Add to `css/style.css`:

```css
.level-card-stars {
  font-size: 0.9rem;
  letter-spacing: 2px;
  color: var(--primary);
}

.level-card-stars:empty {
  display: none;
}
```

- [ ] **Step 4: Commit**

```bash
git add js/app/app.js css/style.css
git commit -m "feat: show star ratings on level selection cards"
```

---

### Task 9: Star Threshold Display During Gameplay

**Files:**
- Modify: `js/app/app.js` (renderGame method)
- Modify: `css/style.css`

- [ ] **Step 1: Add star thresholds to game state**

In the `startGame()` method of `js/app/app.js`, after the game state is created, compute and store the optimal moves:

```javascript
    const optimalMoves = getOptimalMoveCount(this.state.game.level);
    this.state.game.optimalMoves = optimalMoves;
```

- [ ] **Step 2: Add threshold display to game stats row**

In the `renderGame()` method, find the stats row that shows moves and time. Add a star threshold hint next to the move counter:

```javascript
const thresholdHtml = this.state.game.optimalMoves
  ? `<span class="game-threshold" title="Ходов для 3★ / 2★">★${Math.floor(this.state.game.optimalMoves * 1.5)} · ★★${Math.floor(this.state.game.optimalMoves * 2)}</span>`
  : '';
```

Insert `${thresholdHtml}` next to the moves display in the stats row.

- [ ] **Step 3: Add CSS for threshold display**

Add to `css/style.css`:

```css
.game-threshold {
  font-size: 0.7rem;
  color: var(--text-dim);
  opacity: 0.6;
  margin-left: 8px;
}
```

- [ ] **Step 4: Commit**

```bash
git add js/app/app.js css/style.css
git commit -m "feat: show star move thresholds during gameplay"
```

---

### Task 10: Next Level Auto-Advance Action

**Files:**
- Modify: `js/app/app.js`

- [ ] **Step 1: Add nextLevel action handler**

In the event handler section of `js/app/app.js` (around line 552-654, where `data-action` is dispatched), add a handler for the `nextLevel` action:

Find the switch/if-else chain that handles data-action values. Add:

```javascript
      case 'nextLevel': {
        const nextRef = this.state.game?.victory?.nextLevelRef;
        if (nextRef) {
          this.startGame(nextRef);
        }
        break;
      }
```

If the existing code uses if/else instead of switch, adapt to match:

```javascript
    } else if (action === 'nextLevel') {
      const nextRef = this.state.game?.victory?.nextLevelRef;
      if (nextRef) {
        this.startGame(nextRef);
      }
    }
```

- [ ] **Step 2: Commit**

```bash
git add js/app/app.js
git commit -m "feat: add next level auto-advance from victory screen"
```

---

### Task 11: Migrate Existing Progress Data

**Files:**
- Modify: `js/app/storage.js`

- [ ] **Step 1: Add migration for existing level results**

Existing saved results have `{moves, time}` but no `stars` field. Add a migration to `loadProgress()` in `storage.js` so old results gain default star values.

Find the `loadProgress()` method. After parsing, add:

```javascript
  loadProgress() {
    try {
      const raw = this.storage.getItem(PROGRESS_KEY);
      if (!raw) return { ...DEFAULT_PROGRESS };
      const parsed = JSON.parse(raw);
      const progress = { ...DEFAULT_PROGRESS, ...parsed };

      // Migrate old results that lack stars field
      if (progress.results) {
        for (const key of Object.keys(progress.results)) {
          const result = progress.results[key];
          if (result && typeof result.stars === 'undefined') {
            result.stars = 1; // Existing completions get 1 star by default
            result.xpEarned = 0;
            result.hintUsed = false;
          }
        }
      }

      return progress;
    } catch {
      return { ...DEFAULT_PROGRESS };
    }
  }
```

Adjust to match the exact existing pattern — this may mean wrapping the existing parse logic rather than replacing it.

- [ ] **Step 2: Commit**

```bash
git add js/app/storage.js
git commit -m "feat: migrate existing level results to include stars field"
```

---

### Task 12: Manual Smoke Test

**Files:** None (testing only)

- [ ] **Step 1: Start the game in a browser**

Open `index.html` in a browser. Verify:
1. Home screen loads without errors
2. Start a level — move counter and timer work
3. Star thresholds appear near the move counter
4. Complete a level — victory overlay shows stars, XP earned, and rank progress bar
5. Check that "Next Level" button works
6. Go to level select — completed level shows star rating
7. Open browser console — no errors

- [ ] **Step 2: Verify storage**

In browser console:

```javascript
JSON.parse(localStorage.getItem('bulb-switcher.player.v1'))
```

Verify it contains `xp`, `rank`, `streak`, etc.

```javascript
JSON.parse(localStorage.getItem('bulb-switcher.progress.v2'))
```

Verify completed levels have `stars` field.

- [ ] **Step 3: Run automated tests**

```bash
npx vitest run
```

Expected: All tests in `tests/stars.test.js` and `tests/player.test.js` pass.

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: smoke test fixes for phase 1 foundation"
```
