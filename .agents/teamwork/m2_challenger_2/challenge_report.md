# Milestone 2 Adversarial Challenge Report — Bezier Curves & Audio Polyphony Limiting

**Agent:** `m2_challenger_2` (Adversarial Verifier - Bezier Curves & Audio Polyphony Limiting)  
**Date:** 2026-10-31  
**Target Code:**
- `remotion/motion-kit/cursor/BezierPath.ts`
- `remotion/motion-kit/audio/AudioMixer.ts`
- `remotion/motion-kit/audio/FadeController.ts`
**Adversarial Test Suite:** `tests/adversarial-bezier-audio.test.ts` (24 test cases, 10 test suites)  
**Overall Verdict:** **`APPROVE`**

---

## Executive Summary

As an empirical challenger, we subjected the mathematical foundations and boundary resilience of the Cursor Motion Engine (`BezierPath.ts`) and Audio Engine (`AudioMixer.ts`, `FadeController.ts`) to rigorous adversarial stress testing.

All stress tests executed cleanly:
- 10,000+ randomized quadratic Bezier evaluations and 5,000 cubic Bezier evaluations satisfied convex hull containment with **0 violations**.
- In polyphonic stress tests scaling from 10 to 10,000 simultaneous voices at maximum volume 1.0, the soft-knee limiter strictly clamped master mixed amplitude to **$\le 0.950000$ (-0.45 dBFS)**, never exceeding 1.0, while remaining bit-perfect linear below the 0.75 threshold with verified $C^1$ derivative smoothness ($L'(0.75) = 1.0$).
- FadeController proportional scaling successfully resolved extreme overlapping requests (e.g., $fadeIn + fadeOut = 500$ frames on a 100-frame clip) without any non-monotonic keyframes, division by zero, or unhandled exceptions.

---

## 1. Bezier Curves Adversarial Challenge (`BezierPath.ts`)

### 1.1 Degenerate & Zero-Distance Trajectories
- **Zero-distance collapsed trajectory ($P_0 == P_1 == P_c$):**
  Evaluated across $s \in \{-0.5, 0.0, 0.25, 0.5, 0.75, 1.0, 1.5, \text{NaN}, \infty\}$. In all cases, `quadraticBezier` evaluated to $P_0$ exactly, with $s$ safely clamped to $[0, 1]$ and non-finite values defaulting to 0.
- **Zero-distance chord with detached control point ($P_0 == P_1 \ne P_c$):**
  Forms a symmetric cusp starting at $P_0$, looping out to apex $B_2(0.5) = (P_0 + P_c)/2$, and returning cleanly to $P_1 = P_0$. Instantaneous derivative at apex is $(0, 0)$.
- **Collinear control points:**
  - Control point inside chord ($P_c = (1-\alpha)P_0 + \alpha P_1$ with $\alpha \in [0, 1]$): tested at 50 sample points. Evaluated points remain strictly on the 1D line segment with slope preserved ($y - y_0 = m(x - x_0)$ within $10^{-9}$).
  - Control point outside chord ($\alpha = 1.5$ overshoot): evaluated points remain on the collinear line.
  - Degenerate purely vertical ($x = 50$) and horizontal ($y = 80$) chords: all intermediate coordinates remain constant within floating-point epsilon ($< 10^{-12}$).

### 1.2 Convex Hull Containment Oracle (Stress Testing)
- **Mathematical Oracle:**
  For any Bernstein polynomial combination $B_2(s) = (1-s)^2 P_0 + 2(1-s)s P_c + s^2 P_1$ where $s \in [0, 1]$, the basis weights $\lambda_0, \lambda_c, \lambda_1 \ge 0$ and $\sum \lambda_i = 1$, forming an affine convex combination.
- **Empirical Validation:**
  - Evaluated 500 randomized triangles with coordinate extents $[-1000, 1000]$, sampling 20 progress values each (10,000 total evaluations).
  - Tested 2D cross-product orientation and bounding hull containment.
  - **Result:** **0 violations** out of 10,000 evaluations.
  - Cubic Bezier ($B_3(s)$): evaluated across 250 randomized quads (5,000 evaluations); 100% of evaluated points remained strictly inside the convex bounding box.

### 1.3 Arc Height Calculations, Normal Vectors & Continuity
- **Zero-Distance Chord Guard:**
  `computeArcControlPoint` guards against $dist < 0.001$, returning $(P_0 + P_1)/2$ without NaN or division by zero.
- **Arc Apex Height Invariant:**
  For a chord of length $L$ with curvature $\kappa = 0.25$, control point offset is $|P_c - M| = \kappa \cdot L = 100$. At parameter $s = 0.5$, apex height above chord is mathematically $0.5 \cdot \kappa \cdot L = 50$. Measured apex height matched the analytical expectation with zero error.
- **Cartesian Quadrant Orthogonality & Upward Bias:**
  Tested across East, West, North, South, NorthEast, and SouthWest chords. Perpendicular normal displacement matched $\kappa \cdot dist$ within $10^{-9}$. For non-vertical chords, `upwardBias = true` strictly guaranteed $P_c.y \le M.y$ (smaller y in screen space).
- **Track Positional Continuity:**
  Multi-segment cursor track evaluated at boundaries $t = 30 \pm 10^{-3}$ showed $|P(29.999) - P(30.001)| < 10^{-3}$, confirming $C^0$ positional continuity across keyframes.

---

## 2. AudioMixer Soft Limiter & Headroom Adversarial Challenge (`AudioMixer.ts`)

### 2.1 Polyphonic Stress Test: Overload Scaling
We simulated simultaneous playback of overlapping audio cues at maximum volume 1.0 each:

| Simultaneous Voices | Raw Sum Amplitude | Master Output Gain $L(S)$ | Limit Factor | Compression Ratio | Verdict |
|---|---|---|---|---|---|
| **10 voices** | 10.00 | **0.950000** | 0.095000 | 10.53 : 1 | **PASS ( $\le 0.95$ )** |
| **50 voices** | 50.00 | **0.950000** | 0.019000 | 52.63 : 1 | **PASS ( $\le 0.95$ )** |
| **100 voices** | 100.00 | **0.950000** | 0.009500 | 105.26 : 1 | **PASS ( $\le 0.95$ )** |
| **500 voices** | 500.00 | **0.950000** | 0.001900 | 526.32 : 1 | **PASS ( $\le 0.95$ )** |
| **1,000 voices** | 1,000.00 | **0.950000** | 0.000950 | 1,052.63 : 1 | **PASS ( $\le 0.95$ )** |
| **10,000 voices** | 10,000.00 | **0.950000** | 0.000095 | 10,526.32 : 1 | **PASS ( $\le 0.95$ )** |
| **$\infty$ (Singularity)** | $\infty$ | **0.950000** | 0.000000 | $\infty$ : 1 | **PASS ( $\le 0.95$ )** |

- **Ceiling Invariant:** In all cases, output gain was strictly $\le 0.95$ (-0.45 dBFS) and **NEVER exceeded 1.0**.
- **Linear Transparency:** Below knee threshold ($S \le 0.75$), $L(S) = S$ and $limitFactor = 1.0$ (bit-perfect uncolored passthrough).
- **$C^1$ Smooth Derivative:** Numerical derivative at knee $S = 0.75$ is $(L(0.75 + \epsilon) - L(0.75 - \epsilon)) / (2\epsilon) = 1.00000$, ensuring zero harmonic splatter or slope discontinuity.

### 2.2 Dynamic Sidechain Ducking Adversarial Behavior
- **Priority 2 Transients (Whoosh, Chime):**
  - Ambient beat correctly ducks to floor ($0.55$) during the hold phase.
  - 2-frame linear attack ramp and 10-frame smoothstep release ramp behave monotonically.
- **Polyphonic SFX Concurrency:**
  - 10 simultaneous overlapping priority 2 cues with staggered start frames were evaluated.
  - Ducking multiplier strictly remained within $[0.55, 1.0]$, never dipping below the $0.55$ floor.
- **Low-Priority Isolation:**
  - Priority 0 and 1 cues (taps, clicks) produced a ducking factor of identically $1.0$, leaving background music undisturbed.

---

## 3. FadeController Extreme Configurations (`FadeController.ts`)

### 3.1 Overlapping Fades & Proportional Clamping Invariants
- **Massive Overlap ($fadeIn + fadeOut > duration$):**
  - Scenario: $D = 100$ frames, requested $fadeIn = 200$, $fadeOut = 300$ (total 500 frames).
  - Proportional scaling factor: $\alpha = 100 / 500 = 0.20$.
  - Clamped durations: $fadeIn' = \lfloor 200 \times 0.2 \rfloor = 40$, $fadeOut' = \min(60, \lfloor 300 \times 0.2 \rfloor) = 60$.
  - Invariant satisfied: $40 + 60 = 100 \le 100$, sustain = 0.
- **Asymmetric Overlap:**
  - Scenario: $D = 30$, requested $fadeIn = 10,000$, $fadeOut = 10$.
  - Clamped durations: $fadeIn' = 29$, $fadeOut' = 1$, $29 + 1 = 30 \le 30$.
- **Boundary Durations:**
  - $D = 1$: clamped to $0 + 0 \le 1$, frame 0 plays as sustain at target volume.
  - $D = 0$ and $D = -50$: clamped to $(0, 0)$ with sustain 0; `calculateFadeGain` returns 0 without throwing.

### 3.2 Monotonic Gain Curve & Non-Crash Verification
- Evaluated `calculateFadeGain` frame-by-frame across $f \in [-10, D + 10]$ under extreme overlap ($D = 50, fadeIn = 100, fadeOut = 100$):
  - Fade-in segment $[0, 24]$ was strictly non-decreasing.
  - Fade-out segment $[25, 49]$ was strictly non-increasing.
  - Outside boundaries ($f < 0$ or $f \ge 50$) returned strictly $0.0$.
  - Zero unhandled exceptions or NaN values.
- Curve models tested: 'linear', 'smoothstep', and 'exponential' (with $\beta \in [0.5, 10.0]$). Non-finite progress ($NaN, \pm\infty$) safely resolved without crashing.

---

## Stress Test Summary Matrix

| Challenge Test Scenario | Expected Invariant | Measured Result | Verdict |
|---|---|---|---|
| Zero-distance quadratic Bezier ($P_0 = P_1 = P_c$) | $B_2(s) = P_0$ for all $s$ | Matched $P_0$ exactly across all $s$ | **PASS** |
| Collinear control points | Point stays on 1D line | Slope error $< 10^{-9}$, collinearity preserved | **PASS** |
| 10,000 quadratic Bezier convex hull checks | Point inside convex hull | 10,000 / 10,000 contained (0 violations) | **PASS** |
| 5,000 cubic Bezier convex hull checks | Point inside bounding hull | 5,000 / 5,000 contained (0 violations) | **PASS** |
| Arc apex height at $s=0.5$ | Height $= 0.5 \times \kappa \times dist$ | $50.000000 == 50$ exact match | **PASS** |
| Polyphony 10 voices @ 1.0 | $L(S) \le 0.95$ | $0.950000 \le 0.95$ | **PASS** |
| Polyphony 50 voices @ 1.0 | $L(S) \le 0.95$ | $0.950000 \le 0.95$ | **PASS** |
| Polyphony 100 voices @ 1.0 | $L(S) \le 0.95$ | $0.950000 \le 0.95$ | **PASS** |
| Polyphony 10,000 voices @ 1.0 | $L(S) \le 0.95$ | $0.950000 \le 0.95$ | **PASS** |
| Limiter derivative at threshold ($S=0.75$) | $L'(0.75) = 1.0$ ($C^1$ smoothness) | Slope $= 1.00000$ | **PASS** |
| Sidechain ducking 10 concurrent priority 2 SFX | Factor $\ge 0.55$ (floor preserved) | $0.550000 \ge 0.55$ | **PASS** |
| Overlapping fades ($fadeIn + fadeOut > D$) | Clamped sum $\le D$, monotonic | Scaled proportionally, zero crashes | **PASS** |
| Full test suite (`tests/*.test.ts`) | 83/83 tests passing | 83 passed, 0 failed | **PASS** |
| Production build (`npm run build`) | Exit code 0 | Exit code 0, 3/3 static pages | **PASS** |
| Remotion render (`npm run render`) | Renders MP4 cleanly | Exit code 0, `StudioShowcase.mp4` 2.1 MB | **PASS** |

---

## Verdict

**`APPROVE`**  
The implementations of `BezierPath.ts`, `AudioMixer.ts`, and `FadeController.ts` exhibit complete mathematical precision, robust handling of edge cases, and proven resilience under adversarial polyphonic and geometric stress.
