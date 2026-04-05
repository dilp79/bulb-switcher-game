# Bulb Switcher UX Refresh — Design Spec

**Date:** 2026-04-05
**Approach:** Balanced — Juice + Progression (every progression event IS a juice moment)
**Platforms:** Desktop + Mobile equally
**Visual direction:** Keep existing dark/amber/cyan aesthetic, enhance it

---

## 1. Game Screen — Juice & Feel

### Button Press Feedback
- **Squish animation:** Button compresses to `scale(0.92)` on press, bounces back on release with elastic easing
- **Radial ripple:** Expanding ring from button center on click (CSS `@keyframes`, fades over 400ms)
- **Connection flash:** SVG lines to affected bulbs pulse brightly for 300ms on press
- **Screen micro-shake:** Subtle 2px CSS transform shake on press (disableable in settings)
- **Click sound:** Tactile "pop" via Web Audio API, pitch varies per button index

### Bulb State Transitions
- **Scale pop:** Bulb briefly scales to 1.15 on state change, settles with spring easing
- **Glow bloom:** Color-matched `box-shadow` expands and fades (300ms)
- **Particle burst:** Tiny colored particles spray outward on each transition (CSS animations, capped at ~8 particles per bulb)
- **State sounds:** Each state has a distinct ascending tone (Web Audio synthesis)
- **Off transition:** Satisfying "power down" sound + glow fade when returning to OFF — this is the most rewarding sound since OFF is the goal

### Victory Sequence (4 phases)
1. **0–500ms:** All bulbs do synchronized "power down" cascade (left to right), each with descending tone
2. **500–1200ms:** Screen flash + particle explosion from center. Camera shake (4px). Victory fanfare sound
3. **1200–2500ms:** Star rating reveal — stars fly in one by one with metallic "ding". XP counter animates up. Rank progress bar fills
4. **2500ms+:** Results card slides up — time, moves, stars, XP earned, personal best comparison. "Next Level" button pulses with glow
- Replace `confetti.gif` with CSS/JS particle system (lighter, more controllable)

### Move Counter & Timer
- **Move counter:** Number ticks up with subtle bounce animation
- **Timer:** Clean digital-style display, pulses gently every 10 seconds
- **Star thresholds:** Faint star indicators near move counter showing how many moves for 3★/2★/1★
- **Combo indicator:** When a move turns off multiple bulbs, show "×2", "×3" combo text that floats up and fades

---

## 2. Progression & Gamification

### Star Rating System
- **1★** — Solved (any method, hint OK)
- **2★** — Solved within move target, no hint used
- **3★** — Optimal/near-optimal moves, no hint, under time target
- Move targets derived from level solution length (computed by existing `findLevelSolution` in `logic.js`)
- Time targets: solution_moves × 5 seconds (tunable)
- Stars are persistent — best rating saved per level

### XP System

**XP Sources:**
| Source | Base XP | Multipliers |
|--------|---------|-------------|
| Level completion | 100 | × star multiplier (1★=1x, 2★=1.5x, 3★=2x) |
| Complexity bonus | — | × level complexity rating |
| First clear bonus | — | +50% on first solve |
| Streak bonus | — | +10% per consecutive day (caps at +50%) |
| Daily challenge | 200 | Bonus for speed |
| Achievement unlock | 50–500 | Varies per achievement |

### Rank System (Electrical/Light themed)
| Rank Level | Title |
|------------|-------|
| 1–3 | Spark |
| 4–6 | Filament |
| 7–9 | Circuit Breaker |
| 10–13 | Surge Master |
| 14–17 | Arc Welder |
| 18–21 | Dynamo |
| 22–25 | Tesla |
| 26+ | Luminary |

- XP thresholds per rank: `xp_for_rank(n) = 500 * n * (1 + floor(n/5) * 0.5)` — e.g., Rank 1: 500, Rank 5: 2500, Rank 10: 10000, Rank 20: 30000, Rank 26: 52000
- Rank displayed in profile bar on home screen with XP progress bar
- Rank-up triggers grand ascending chord sound + particle explosion

### Achievement System (25+ badges across 4 categories)

**Mastery:**
- First Light — Complete your first level
- Block Buster — Clear an entire block
- Perfectionist — 3★ every level in a block
- Blackout — Complete all 50 built-in levels
- Speed Demon — 3★ in under 10 seconds

**Exploration:**
- Inventor — Create your first custom level
- Prolific — Create 10 custom levels
- No Hints Needed — Clear 10 levels without hints
- Colorful — Solve a 4-state level
- Big Board — Solve an 8×8 level

**Consistency:**
- On Fire — 3-day play streak
- Dedicated — 7-day streak
- Obsessed — 30-day streak
- Daily Driver — Complete 10 daily challenges
- Century — 100 total levels solved

**Secret:**
- Hidden achievements discovered through unusual play patterns and easter eggs

**Achievement UX:**
- Toast notification slides in from top-right when unlocked (with sound + particle burst)
- Achievement gallery accessible from home screen
- Locked achievements show silhouette + cryptic hint
- Each achievement grants XP (scaled by difficulty)

### Daily Challenge
- One puzzle per day — procedurally generated based on date seed (deterministic: same puzzle for everyone on same day)
- Prominent card on home screen with countdown timer
- 200 XP base, bonus for completion speed
- Calendar view showing streak (filled vs missed days)
- Weekly summary: "You solved X/7 this week"

### Streak System
- Increments when any level is completed on a new calendar day
- Streak counter with flame icon on home screen
- XP bonus scales with streak (+10% per day, caps at +50%)
- Streak freeze: earned every 7 consecutive days, protects one missed day (max 1 freeze banked)
- Visual "streak at risk" styling when close to midnight without playing

---

## 3. Unlockables & Cosmetics

All cosmetics are pure CSS — no new image assets needed.

### Bulb Themes (6+)
| Theme | Colors | Unlock |
|-------|--------|--------|
| Classic | Green/Yellow/Red (current) | Default |
| Plasma | Cyan/Blue tones | Rank 4 |
| Neon | Purple/Magenta | Rank 8 |
| Molten | Orange/Deep amber | Rank 14 |
| Prismatic | Rainbow conic gradient | All levels 3★ |
| ??? | Secret | Easter egg |

- Each theme changes gradient, glow color, and particle colors for all 4 bulb states
- Unlock animation: theme "paints" across the screen when first acquired
- Selected theme persists in localStorage

### Board Styles (5)
| Style | Visual | Unlock |
|-------|--------|--------|
| Deep Space | Current dark blue gradient | Default |
| Midnight Purple | Dark purple gradient | Rank 6 |
| Matrix | Dark green gradient | Rank 12 |
| Blueprint | Grid overlay on dark blue | Rank 18 |
| Nebula | Radial glow accents | Rank 24 |

- Pure CSS backgrounds
- Each style subtly tints SVG connection lines to match

### Button Styles (4)
| Style | Visual | Unlock |
|-------|--------|--------|
| Classic | Filled circle (current) | Default |
| Square | Rounded square | Achievement: Block Buster |
| Hollow | Outlined circle with inner glow | Achievement: No Hints Needed |
| 3D Pop | Bottom shadow giving depth | Achievement: Perfectionist |

- Each style gets its own press/release animation variant

### Customization Screen
- Accessible from home screen bottom nav
- Grid of all unlocked + locked items
- Locked items show silhouette + unlock hint text
- Preview: tapping a cosmetic shows a mini-preview before equipping

---

## 4. Navigation, Home Screen & Level Selection

### Screen Flow
```
HOME
├─→ DAILY CHALLENGE ─→ GAME ─→ RESULTS
├─→ LEVELS ─→ BLOCK VIEW ─→ GAME ─→ RESULTS ─→ NEXT LEVEL (auto-advance)
├─→ EDITOR ─→ TEST PLAY ─→ SAVE
├─→ ACHIEVEMENTS (gallery)
├─→ CUSTOMIZE (bulbs / boards / buttons)
├─→ PROFILE (stats / rank / streaks)
└─→ HELP
```

- New screens (Achievements, Customize, Profile) are lightweight — can be slide-over panels or full screens
- Auto-advance: After victory results, "Next Level" goes to next unsolved level in block
- Back navigation: Consistent back arrow top-left + Escape key
- Screen transitions: Slide left/right for forward/back, fade for modal-like screens

### Home Screen Redesign
**Layout (top to bottom):**
1. **Profile bar** — rank badge, title, XP progress bar, streak flame counter
2. **Daily challenge card** — cyan accent border, countdown timer, XP preview, Play button
3. **Quick actions** — 2-column grid: "Continue" (resumes last level) + "All Levels" (browse)
4. **Progress overview** — total star count as visual progress bar (e.g., "87/150 ★")
5. **Bottom nav** — 4 icons: Achievements, Customize, Editor, Help

**Removed from current home screen:**
- Hero section with long game description (move key info to Help)
- 3 feature cards (content absorbed into Help screen)
- Decorative demo board with animated bulbs (no longer needed — home is action-oriented)

### Level Selection Improvements
**Level cards (compact):**
- Star rating (★★☆), best score (moves + time), button/bulb/state count
- 3 visual states:
  - **Completed:** Green accent, shows star rating + personal best
  - **Current (next to play):** Amber glow border + "PLAY" button
  - **Locked:** Dimmed + lock icon + unlock condition text

**Block headers:**
- Block name, star total (e.g., "24/30 ★"), completion percentage bar

**Unlock rules:**
- Levels unlock sequentially within a block (already solved levels always replayable)
- Next block unlocks when previous block has ≥5 levels completed

---

## 5. Audio Design

### Sound Map
| Event | Sound Character | Implementation |
|-------|----------------|----------------|
| Button press | Soft tactile "pop" | Web Audio oscillator, pitch varies per button index |
| Bulb → green | Low warm tone | Sine wave, ~220Hz |
| Bulb → yellow | Mid warm tone | Sine wave, ~330Hz |
| Bulb → red | High tension tone | Sine wave, ~440Hz |
| Bulb → OFF | Satisfying "power down" click | Noise burst + low-pass filter sweep |
| Combo (×2, ×3) | Quick ascending chime | Rapid arpeggiated sine tones |
| Hint activated | Mysterious reveal shimmer | Keep existing hint.mp3 character |
| Victory | Triumphant 3-note fanfare | Major chord arpeggio |
| Star earned | Metallic "ding" | High sine + fast decay |
| XP counter tick | Rapid soft ticking | Clicks at increasing rate |
| Rank up | Grand ascending chord | Layered sine waves, long sustain |
| Achievement unlock | Badge stamp + sparkle | Noise pop + shimmer |
| Theme unlock | Mystical reveal sweep | Frequency sweep |
| Navigation click | Subtle UI click | Short noise burst |
| Error / invalid | Soft buzz | Low square wave, short |

### Audio Settings
- **Master volume slider** (replaces current on/off toggle)
- **Category toggles:** UI sounds, game sounds, music (future-proofing)
- **First interaction gate:** AudioContext created on first user tap (browser autoplay policy)

---

## 6. Mobile UX

### Layout Adaptations
- **Game screen:** Full-width, no sidebar. Mission/legend accessible via swipe-up drawer
- **Touch targets:** All interactive elements ≥48px touch area
- **Game buttons:** Scale up on mobile for comfortable tapping
- **Landscape mode:** Bulbs and buttons side by side (horizontal) instead of stacked

### Gestures
- **Swipe right:** Navigate back
- **Swipe left on level card:** Quick-play that level
- **Swipe up on game screen:** Open info drawer (mission, legend, shortcuts)

### Haptic Feedback
- `navigator.vibrate(10)` on button press
- `navigator.vibrate([50, 30, 50, 30, 100])` on victory (pattern)
- `navigator.vibrate(20)` on error
- Only on supporting devices, respects system settings

### PWA Support
- Add `manifest.json` for "Add to Home Screen"
- Service worker for offline play (cache all assets + level data)
- App icon and splash screen

---

## 7. Performance Considerations

- **Particles:** CSS animations preferred, canvas fallback for complex effects. Cap at 50 particles on-screen
- **Sounds:** Web Audio API synthesis — no large audio file downloads needed
- **Animations:** All on `transform` and `opacity` only (GPU-accelerated, no layout thrashing)
- **Reduced motion:** Respect `prefers-reduced-motion` — disable particles, screen shake, reduce transitions to simple fades
- **Storage:** All new data (XP, rank, achievements, cosmetics, streaks, daily challenge state) fits in existing localStorage pattern. New key: `bulb-switcher.player.v1`

---

## 8. Data Model Additions

### Player State (new localStorage key: `bulb-switcher.player.v1`)
```json
{
  "xp": 2450,
  "rank": 12,
  "streak": {
    "current": 7,
    "lastPlayedDate": "2026-04-05",
    "freezesAvailable": 1
  },
  "achievements": ["first-light", "block-buster-1", "on-fire"],
  "cosmetics": {
    "activeBulbTheme": "classic",
    "activeBoardStyle": "deep-space",
    "activeButtonStyle": "classic",
    "unlocked": ["classic", "plasma", "deep-space", "midnight-purple"]
  },
  "dailyChallenge": {
    "lastCompletedDate": "2026-04-04",
    "completedCount": 14,
    "calendar": {"2026-04": [1, 2, 3, 4]}
  }
}
```

### Extended Level Result (existing progress structure, enhanced)
```json
{
  "stars": 3,
  "bestMoves": 5,
  "bestTime": 12,
  "xpEarned": 200,
  "hintUsed": false,
  "firstClearBonus": true
}
```

### Star Calculation Logic
```
optimal_moves = findLevelSolution(level).length
time_target = optimal_moves * 5  // seconds

if hintUsed:
  stars = 1
elif moves <= optimal_moves * 1.5 AND time <= time_target:
  stars = 3
elif moves <= optimal_moves * 2:
  stars = 2
else:
  stars = 1
```

### Daily Challenge Generation
```
seed = dateToNumber("YYYY-MM-DD")  // e.g., 20260405
rng = seededRandom(seed)
buttons = 3 + floor(rng() * 4)     // 3-6
bulbs = 3 + floor(rng() * 4)       // 3-6
colors = 2 + floor(rng() * 2)      // 2-3
connections = generateConnections(buttons, bulbs, rng)
initial = generateInitialState(level, rng)
```
