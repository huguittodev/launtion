# Empirical Adversarial Challenge Report: Camera 3D Physics & Focal Drift

**Verifier:** `m2_challenger_1` (Adversarial Verifier - Camera 3D Physics & Focal Drift)  
**Date:** 2026-10-31  
**Target Code:**
- `remotion/motion-kit/camera/CameraTransform.ts`
- `remotion/motion-kit/camera/FocalTracker.ts`
- `remotion/motion-kit/camera/CameraPath.ts`

---

## Challenge Summary

**Overall risk assessment**: **LOW** (Optical Center Camera Engine is Mathematically Robust; Minor Edge Case Findings in Non-Center Anchors and Legacy Percentage Normalization).

The core camera physics model $D = S \cdot R \cdot (C - P_f)$ with fixed optical center gimbal origin at $50\% \ 50\%$ was empirically proven to be **immune to focal drift** across 42,875 mandatory grid search cases and 10,000 stochastic Monte Carlo vectors. Analytical focal drift is strictly $0.0000\text{ px}$. Under real CSS transform string reconstruction with 4-decimal formatting truncation, maximum measured focal drift across the entire parameter space is $0.0918\text{ px}$, well within the quantitative threshold of $e \le 0.5\text{ px}$ (a 5.4x safety margin).

Two localized implementation limitations were discovered through adversarial exploration:
1. **Off-Center Anchor Drift:** `CameraTransformParams.anchorPoint` induces non-linear rotation/scale drift (up to $170\text{ px}$) when set to coordinates other than $(0.5, 0.5)$.
2. **Greedy Legacy Percentage Auto-Detection:** `FocalTracker.normalizeFocalPoint()` divides any value $> 1.0$ by 100, which warps normalized out-of-bounds coordinates (e.g. $1.05 \to 0.0105$) rather than clamping to $1.0$.

Neither finding compromises the primary Remotion advertising pipeline because `CameraRig.tsx` and all scene graphs exclusively use optical center centering (`anchorPoint = (0.5, 0.5)`).

---

## Challenges

### [Medium] Challenge 1: Off-Center Anchor Point Displacement Drift

- **Assumption Challenged:** The formulation in `CameraTransform.ts` assumes that substituting $T = \text{Anchor} - P_f$ into $D = S \cdot R \cdot T$ allows arbitrary off-center screen framing (e.g., placing the focal point at the top-left rule-of-thirds $(0.33, 0.33)$ instead of the viewport center $(0.5, 0.5)$).
- **Attack Scenario:** Setting `anchorPoint = { x: 0.2, y: 0.2 }` while zooming ($S = 2.5$) and rotating in 3D ($\theta_x = 20^\circ, \theta_y = -25^\circ, \theta_z = 10^\circ$).
- **Empirical Finding & Blast Radius:** Because the CSS transform origin is pinned to the optical center $C = (0.5, 0.5)$, the transformed focal point position satisfies:
  $$P'_{f,\text{rel}} = S \cdot R \cdot (P_f - C) + D = S \cdot R \cdot (P_f - C) + S \cdot R \cdot (\text{Anchor} - P_f) = S \cdot R \cdot (\text{Anchor} - C)$$
  When $\text{Anchor} \ne C$, the anchor offset is rotated by $R$ and scaled by $S$ around $C$, displacing the focal point by up to $170.65\text{ px}$ away from the requested anchor point in screen space.
- **Mitigation:** If off-center screen framing is required in future milestones (e.g. Phase 3 visual customization), the displacement formula must decouple the anchor offset:
  $$D = (\text{Anchor} - C) - S \cdot R \cdot (P_f - C)$$
  Under this corrected formula, $P'_{f,\text{rel}} = \text{Anchor} - C$ is independent of rotation $R$ and zoom $S$.

---

### [Low] Challenge 2: Greedy Legacy Percentage Normalization in FocalTracker

- **Assumption Challenged:** `normalizeFocalPoint()` assumes any coordinate scalar $> 1.0$ is an intentional legacy percentage in $[0, 100]$.
- **Attack Scenario:** An upstream interaction or motion detector emits a normalized coordinate with slight overshoot (e.g., $x = 1.05$ or $y = 1.80$).
- **Empirical Finding & Blast Radius:** In `remotion/motion-kit/camera/FocalTracker.ts`:
  ```ts
  const nx = point.x > 1.0 ? point.x / 100 : point.x;
  return { x: clamp01(nx), y: clamp01(ny) };
  ```
  Passing $y = 1.80$ produces $ny = 1.80 / 100 = 0.018$ instead of clamping to $1.0$. This causes a coordinate at the bottom border of the viewport to wrap around to the top border ($1.8\%$).
- **Mitigation:** Restrict legacy percentage conversion to numbers where `point.x > 1.5` or require an explicit `{ legacyPercentage?: boolean }` option; or check if `point.x > 1.0 && point.x <= 100.0`. If numbers are already assumed normalized $[0, 1]$, clamp directly using `clamp01(point.x)`.

---

### [Low] Challenge 3: CSS 2D `scale(S)` vs 3D `scale3d(S, S, S)` Z-Axis Singularity

- **Assumption Challenged:** In CSS transforms, `scale(zoom)` is a 2D scale function that does not scale $Z$ coordinates (`scale(S) = scale(S, S, 1)`). If a 2D surface is tilted in 3D and then zoomed, $Z$ translation $D_z$ was derived assuming $Z$ was scaled by $S$.
- **Attack Scenario:** Extreme tilt ($\theta_x = 45^\circ, \theta_y = 45^\circ$) combined with maximum zoom ($S = 5.0$) in $4\text{K}$ resolution.
- **Empirical Finding & Blast Radius:** Even though $Z$ displacement $D_z$ could theoretically shift the surface along the optical axis if $Z$ were unscaled, at the focal point $P_f$, the transformed transverse coordinates $X_{\text{screen}} - C_x = 0$ and $Y_{\text{screen}} - C_y = 0$. Under perspective projection:
  $$X_{\text{screen}} = C_x + \frac{0}{1 - Z / d} = C_x$$
  Because the numerator is identically zero, the focal point remains perfectly centered at the optical center regardless of perspective depth, provided $Z < d$. Across all 42,875 test cases, $Z$ at the focal point satisfied $|Z| \le 0.00005\text{ px}$, proving that $P_f$ is permanently anchored in the $Z=0$ projection plane.

---

## Stress Test Results

| Test ID | Scenario | Expected Behavior | Actual Empirical Result | Pass/Fail |
|---|---|---|---|---|
| **ST-01** | Mandatory Grid Search: 5 resolutions $\times$ 5 zooms $\times$ 7 $\theta_x \times$ 7 $\theta_y \times$ 7 $\theta_z \times$ 5 targets (42,875 cases) | Focal drift $\le 0.5\text{ px}$ | Max drift = $0.00007\text{ px}$ (analytical = $0.0000\text{ px}$) | **PASS** |
| **ST-02** | Resolution Diversity: 16:9 (1920x1080), 9:16 (1080x1920), 2K (2560x1440), 4K (3840x2160), 3:2 (1200x800) | Zero drift across all aspect ratios | Max drift = $0.00007\text{ px} \le 0.5\text{ px}$ | **PASS** |
| **ST-03** | Zoom Bounds: $S \in \{1.0, 1.5, 2.0, 3.0, 5.0\}$ | Monotonic zoom with stable center | Bounded within $0.00007\text{ px}$ | **PASS** |
| **ST-04** | 3D Rotations: $\theta_x, \theta_y, \theta_z \in [-45^\circ, 45^\circ]$ | No gimbal wobble or drift | Bounded within $0.00007\text{ px}$ | **PASS** |
| **ST-05** | Extreme Targets: $(0, 0), (1, 1), (0.5, 0.5), (0.8, 0.2), (0.1, 0.9)$ | Accurate corner framing | Max drift = $0.00007\text{ px}$ | **PASS** |
| **ST-06** | Continuous Monte Carlo: 10,000 pseudo-random continuous vectors | Bounded error $\le 0.5\text{ px}$ | Max error = $0.0918\text{ px} \le 0.5\text{ px}$ | **PASS** |
| **ST-07** | Extreme Viewports: 21:9 Ultrawide, 1:1 Square, 8K (7680x4320), QVGA (320x240) | Sub-pixel drift $\le 0.5\text{ px}$ | Max error = $0.00007\text{ px}$ | **PASS** |
| **ST-08** | Dynamic CameraPath Kinematics: 120-frame spring and cubic interpolation track | Continuity with zero jump | Max dynamic drift = $0.0369\text{ px} \le 0.5\text{ px}$ | **PASS** |
| **ST-09** | Independent CSS 4x4 Homogeneous Projection Oracle | Independent parser confirmation | 100% matched within $0.0918\text{ px}$ | **PASS** |
| **ST-10** | Zoom Clamping: `clampFocalToZoomBounds` at $S=1.0, 2.0, 5.0$ | No canvas boundary overshoot | Exact clamped boxes: $[0.25, 0.75]$ and $[0.1, 0.9]$ | **PASS** |
| **ST-11** | Full Automated Test Suite: `node --import jiti/register --test tests/*.test.ts` | 93/93 tests pass | 93/93 tests passed (0 failures, 320ms) | **PASS** |
| **ST-12** | Remotion Video Production: `npm run render` | Exit code 0, 480 frames rendered | Rendered `out/StudioShowcase.mp4` (2MB) in 9.5s | **PASS** |

---

## Unchallenged Areas

- **WebGL Custom Shaders:** Remotion DOM rendering utilizes CSS 3D matrix transforms (`preserve-3d`, `perspective`). Direct GPU fragment shader camera projection was not evaluated as it is outside the project's CSS/Remotion architecture.
- **Browser-Specific GPU Subpixel Antialiasing Quirk:** Different browser rasterizers (Blink vs WebKit) may round sub-pixel vertices to pixel grids during rasterization; this is physical display hardware behavior beyond mathematical camera transforms.
