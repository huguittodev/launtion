# Milestone 2: Audio & SFX Engine Explorer Handoff Report

**Agent:** `m2_explorer_audio` (Audio Engine Explorer)  
**Parent:** `e050f1ce-2de9-448e-9c52-f601bd890052`  
**Working Directory:** `/home/huguittodev/launtion/.agents/teamwork/m2_explorer_audio/`  
**Handoff Type:** Hard (Read-Only Exploration Complete)  
**Deliverable Document:** `audio_report.md`  

---

## 1. Observation

1. **Current AudioEngine Implementation (`remotion/motion-kit/AudioEngine.tsx`)**:
   - Lines 40–49:
     ```tsx
     const targetVolume = music?.volume ?? 0.35;
     const fadeIn = music?.fadeInFrames ?? 15;
     const fadeOut = music?.fadeOutFrames ?? 30;

     const musicVolume = interpolate(
       frame,
       [0, fadeIn, durationInFrames - fadeOut, durationInFrames],
       [0, targetVolume, targetVolume, 0],
       { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
     );
     ```
   - Lines 69–79:
     ```tsx
     <Sequence
       key={`${cue.frame}-${cue.sound}-${index}`}
       from={cue.frame}
       durationInFrames={45}
     >
       <Audio
         src={staticFile(soundPath)}
         volume={cue.volume ?? 0.8}
       />
     </Sequence>
     ```
2. **Audio Asset Clearances (`public/sfx/SFX_LICENSES.md`)**:
   - Lines 20–28: All 6 assets (`ambient-beat.wav`, `camera-whoosh.wav`, `chime.wav`, `keyboard-tap.wav`, `mouse-click.wav`, `soft-pop.wav`) are 44.1 kHz 16-bit mono WAVs licensed under CC0 1.0 Universal, cleared for commercial video export without royalties.
   - Section 4: Recommends background track staging at $0.32 \pm 0.03$, transient staging at $0.45 - 0.95$, dynamic ducking of 2–3 dB during transients, and soft-knee limiting to preserve headroom ($\max(|S(t)|) \le 0.98$).
3. **SceneGraph Audio Contract (`src/lib/scene-graph/schema.ts` and `types.ts`)**:
   - `AudioCue`:
     ```ts
     export interface AudioCue {
       id: string;
       frame: number;
       asset: 'mouse-click' | 'camera-whoosh' | 'keyboard-tap' | 'chime' | 'soft-pop' | 'ambient-beat';
       volume?: number;
       fadeInFrames?: number;
       fadeOutFrames?: number;
     }
     ```
   - `SceneGraph.audioTrack: AudioCue[]` is the single source of truth produced by `interactionToSceneGraphAdapter`.
4. **Remotion Rendering Engine (`node_modules/remotion/`)**:
   - `<Audio />` (and `Html5Audio`) accepts `volume?: number | ((frame: number) => number)`.
   - Remotion renders audio deterministically per frame.
   - Test execution of `npm run render` succeeded with exit code 0 (`out/StudioShowcase.mp4` 2 MB generated in 12s, downloading all 6 WAV files via `staticFile()`).
5. **Runtime Environment**:
   - Node.js version: `v24.16.0`.
   - `npm run typecheck`: completed with 0 errors (`tsc --noEmit`).

---

## 2. Logic Chain

1. **Fade Monotonicity Failure & Fix**:
   - *From Observation 1*: `AudioEngine.tsx` constructs an inputRange `[0, fadeIn, durationInFrames - fadeOut, durationInFrames]`.
   - *Inference*: If `fadeIn + fadeOut > durationInFrames` (e.g. $D = 30, F_{in} = 15, F_{out} = 20$), `durationInFrames - fadeOut = 10 < 15`, producing `[0, 15, 10, 30]`. In Remotion, `interpolate()` throws an unhandled error when keys are non-ascending.
   - *Deduction*: A pure clamping function (`clampFadeDurations`) scaling durations proportionally ($\text{scale} = D / (F_{in} + F_{out})$) guarantees $F'_{in} + F'_{out} \le D$ with zero overlap. Furthermore, a pure piecewise evaluation function (`calculateFadeGain`) calculates volume directly in $O(1)$ without creating Remotion keyframe arrays.
   - *Fade Curves*: Linear ($p$), Smoothstep ($3p^2 - 2p^3$, zero boundary derivatives $C'(0) = C'(1) = 0$), and Exponential ($\frac{e^{\beta p} - 1}{e^\beta - 1}$, logarithmic decibel emulation) provide acoustic smoothness without transient click/pop artifacts.

2. **Polyphonic Headroom Staging & Limiting**:
   - *From Observations 1 & 2*: Individual SFX cues have volumes up to 0.85–0.95. When overlaid on background music (0.32–0.35) and transitional whooshes (0.60–0.70), the raw linear sum exceeds 1.70.
   - *Inference*: Digital audio encoders (AAC in MP4) clip at linear amplitude 1.0 (0 dBFS).
   - *Deduction*: `AudioMixer` must implement two stages:
     - Sidechain Ducking: During whooshes and chimes, background music attenuates by $D_{\text{floor}} \approx 0.55$ (-5.2 dB), creating spectral space for the transient.
     - Soft-Knee Limiter: For total gain $S(t) > T_{\text{knee}} = 0.75$, $L(S) = T_{\text{knee}} + (H_{\text{ceiling}} - T_{\text{knee}}) \tanh(\frac{S - T}{H - T})$. This function has $C^1$ continuity at $S = T_{\text{knee}}$ and an asymptotic upper bound $L(S) < H_{\text{ceiling}} = 0.95 < 1.0$, mathematically eliminating digital clipping regardless of simultaneous polyphony.

3. **Pure Scheduler & Orchestration**:
   - *From Observation 3*: `SceneGraph` exposes a unified `audioTrack: AudioCue[]` containing both ambient bed and transient SFX.
   - *Inference*: `AudioEngine` must not hardcode sound logic; it should delegate scheduling to a pure `AudioTimeline` module.
   - *Deduction*: `AudioTimeline.ts` indexes each cue, resolves its intrinsic acoustic duration from `SFX_CATALOG`, and classifies tracks into music and SFX. `AudioEngine.tsx` orchestrates Remotion's `<Audio />` and `<Sequence />` components, supporting both `audioTrack` (SceneGraph standard) and legacy `soundCues`/`music` props for 100% backward compatibility.

---

## 3. Caveats

1. **Remotion Volume Callback Resolution**: In Remotion, `<Audio volume={(f) => number} />` passes `f` relative to the sequence start. Global timeline calculations must account for `cue.startFrame + f` when querying global ducking and limiting state.
2. **Audio Codec Peak Transients**: While linear amplitude is bounded to $0.95$, inter-sample peaks (ISPs) in lossy AAC encoders can occasionally add $+0.2$ to $+0.4$ dB of reconstruction overshoot. Setting $H_{\text{ceiling}} = 0.95$ (-0.45 dBFS) provides an adequate safety buffer.
3. **No External Dependencies**: Implementation must use pure Node.js/TypeScript math and Remotion core components (`remotion`), requiring zero external audio processing packages.

---

## 4. Conclusion

The architectural investigation and mathematical blueprints for the Milestone 2 Audio & SFX Engine are complete. All specifications, algorithms, interfaces, and test scenarios are fully documented in `audio_report.md`.

The system is ready for atomic implementation across four files:
1. `remotion/motion-kit/audio/FadeController.ts`
2. `remotion/motion-kit/audio/AudioMixer.ts`
3. `remotion/motion-kit/audio/AudioTimeline.ts`
4. `remotion/motion-kit/AudioEngine.tsx` (Refactor)

---

## 5. Verification Method

To independently verify the findings and blueprints:
1. **Inspect Blueprint Deliverable**:
   - View `/home/huguittodev/launtion/.agents/teamwork/m2_explorer_audio/audio_report.md` for complete formulas, TypeScript interfaces, and component architectures.
2. **Verify Typecheck**:
   - Run `npm run typecheck` to confirm baseline repository integrity (0 errors).
3. **Verify Remotion Render**:
   - Run `npm run render` to confirm that Remotion successfully builds and renders compositions with audio assets from `public/sfx/`.
4. **Invalidation Conditions**:
   - If Remotion requires audio volume to be an absolute constant rather than dynamic `VolumeProp`, or if `clampFadeDurations` produces $F'_{in} + F'_{out} > D$, this blueprint would require revision. Both were verified against Remotion's type definitions (`VolumeProp = number | ((frame: number) => number)`) and algebraic proof.
