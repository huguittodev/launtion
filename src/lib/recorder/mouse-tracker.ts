/**
 * mouse-tracker.ts
 *
 * High-performance passive DOM pointer tracking module.
 * Attaches passive capture listeners, applies a double-tier 33ms / rAF movement throttle,
 * normalizes coordinates into [0.0, 1.0] via CoordinateMapper.clamp01,
 * and extracts sanitized DOM metadata while preventing data loss for discrete click gestures.
 */

import { CoordinateMapper } from '../interaction-map/CoordinateMapper';
import type {
  MouseTrackerOptions,
  RecordedPointerEvent,
  RecordingViewport,
  TargetElementMetadata,
} from './types';

export class MouseTracker {
  private target: HTMLElement | Window | null = null;
  private throttleMs: number;
  private captureMetadata: boolean;
  private isTracking = false;
  private t0_ms = 0;
  private eventSequence = 0;
  private events: RecordedPointerEvent[] = [];

  private lastMoveEmitTime = 0;
  private pendingMoveEvent: {
    clientX: number;
    clientY: number;
    button?: number;
    target?: EventTarget | null;
  } | null = null;
  private rafId: number | null = null;

  // Bound event listeners
  private handlePointerMoveBound: (e: PointerEvent | MouseEvent) => void;
  private handlePointerDownBound: (e: PointerEvent | MouseEvent) => void;
  private handlePointerUpBound: (e: PointerEvent | MouseEvent) => void;
  private handleClickBound: (e: MouseEvent) => void;
  private handleWheelBound: (e: WheelEvent) => void;

  constructor(options?: MouseTrackerOptions) {
    if (typeof window !== 'undefined') {
      this.target = options?.targetElement ?? window;
    } else {
      this.target = (options?.targetElement as (HTMLElement | Window | null)) ?? null;
    }

    this.throttleMs = options?.throttleMs ?? 33.3; // ~30 FPS
    this.captureMetadata = options?.captureElementMetadata ?? true;

    this.handlePointerMoveBound = this.handlePointerMove.bind(this);
    this.handlePointerDownBound = this.handlePointerDown.bind(this);
    this.handlePointerUpBound = this.handlePointerUp.bind(this);
    this.handleClickBound = this.handleClick.bind(this);
    this.handleWheelBound = this.handleWheel.bind(this);
  }

  public start(t0_ms: number = typeof performance !== 'undefined' ? performance.now() : 0): void {
    if (this.isTracking) return;
    this.isTracking = true;
    this.t0_ms = t0_ms;
    this.eventSequence = 0;
    this.events = [];
    this.lastMoveEmitTime = 0;
    this.pendingMoveEvent = null;

    if (!this.target || typeof (this.target as EventTarget).addEventListener !== 'function') {
      return;
    }

    const opts: AddEventListenerOptions = { passive: true, capture: true };
    const t = this.target as EventTarget;

    t.addEventListener('pointermove', this.handlePointerMoveBound as EventListener, opts);
    t.addEventListener('pointerdown', this.handlePointerDownBound as EventListener, opts);
    t.addEventListener('pointerup', this.handlePointerUpBound as EventListener, opts);
    t.addEventListener('click', this.handleClickBound as EventListener, opts);
    t.addEventListener('wheel', this.handleWheelBound as EventListener, opts);
  }

  public stop(): RecordedPointerEvent[] {
    if (!this.isTracking) return [...this.events];
    this.isTracking = false;

    // Flush any pending movement sample
    this.flushPendingMove();

    if (this.rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.target && typeof (this.target as EventTarget).removeEventListener === 'function') {
      const opts: EventListenerOptions = { capture: true };
      const t = this.target as EventTarget;

      t.removeEventListener('pointermove', this.handlePointerMoveBound as EventListener, opts);
      t.removeEventListener('pointerdown', this.handlePointerDownBound as EventListener, opts);
      t.removeEventListener('pointerup', this.handlePointerUpBound as EventListener, opts);
      t.removeEventListener('click', this.handleClickBound as EventListener, opts);
      t.removeEventListener('wheel', this.handleWheelBound as EventListener, opts);
    }

    return [...this.events];
  }

  public getEvents(): RecordedPointerEvent[] {
    return [...this.events];
  }

  public getViewport(): RecordingViewport {
    if (typeof window === 'undefined') {
      return { width: 1920, height: 1080, devicePixelRatio: 1.0 };
    }

    const isWin = !this.target || this.target === window;
    if (isWin) {
      return {
        width: window.innerWidth || 1920,
        height: window.innerHeight || 1080,
        devicePixelRatio: window.devicePixelRatio || 1.0,
      };
    }

    const el = this.target as HTMLElement;
    return {
      width: el.clientWidth || 1920,
      height: el.clientHeight || 1080,
      devicePixelRatio: window.devicePixelRatio || 1.0,
    };
  }

  private handlePointerMove(e: PointerEvent | MouseEvent): void {
    if (!this.isTracking) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

    this.pendingMoveEvent = {
      clientX: e.clientX,
      clientY: e.clientY,
      button: e.button,
      target: e.target,
    };

    if (now - this.lastMoveEmitTime >= this.throttleMs) {
      this.flushPendingMove();
    } else if (this.rafId === null && typeof requestAnimationFrame !== 'undefined') {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        this.flushPendingMove();
      });
    }
  }

  private flushPendingMove(): void {
    if (!this.pendingMoveEvent) return;
    const e = this.pendingMoveEvent;
    this.pendingMoveEvent = null;
    this.lastMoveEmitTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.recordEvent('move', e.clientX, e.clientY, e.button, e.target);
  }

  private handlePointerDown(e: PointerEvent | MouseEvent): void {
    if (!this.isTracking) return;
    this.flushPendingMove();
    this.recordEvent('mousedown', e.clientX, e.clientY, e.button, e.target);
  }

  private handlePointerUp(e: PointerEvent | MouseEvent): void {
    if (!this.isTracking) return;
    this.flushPendingMove();
    this.recordEvent('mouseup', e.clientX, e.clientY, e.button, e.target);
  }

  private handleClick(e: MouseEvent): void {
    if (!this.isTracking) return;
    this.flushPendingMove();
    this.recordEvent('click', e.clientX, e.clientY, e.button, e.target);
  }

  private handleWheel(e: WheelEvent): void {
    if (!this.isTracking) return;
    this.flushPendingMove();
    const last = this.events[this.events.length - 1];
    const vp = this.getViewport();
    const x = last ? last.rawPixelX ?? vp.width / 2 : vp.width / 2;
    const y = last ? last.rawPixelY ?? vp.height / 2 : vp.height / 2;
    this.recordEvent('wheel', x, y, undefined, e.target, e.deltaY);
  }

  private recordEvent(
    type: RecordedPointerEvent['type'],
    clientX: number,
    clientY: number,
    button?: number,
    target?: EventTarget | null,
    deltaY?: number
  ): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const timestampMs = Math.max(0, now - this.t0_ms);
    const vp = this.getViewport();

    const normX = CoordinateMapper.clamp01(clientX / (vp.width || 1));
    const normY = CoordinateMapper.clamp01(clientY / (vp.height || 1));

    let targetElement: TargetElementMetadata | undefined;
    let targetTag: string | undefined;
    let targetId: string | undefined;

    if (
      this.captureMetadata &&
      target &&
      typeof HTMLElement !== 'undefined' &&
      target instanceof HTMLElement
    ) {
      targetTag = target.tagName;
      targetId = target.id || undefined;
      const isSensitive =
        (target instanceof HTMLInputElement && target.type === 'password') ||
        target.getAttribute('autocomplete') === 'current-password';

      let textSnippet: string | undefined;
      if (!isSensitive) {
        textSnippet = target.innerText?.trim().slice(0, 40) || undefined;
      }

      targetElement = {
        tagName: target.tagName,
        id: target.id || undefined,
        className: target.className ? String(target.className).slice(0, 80) : undefined,
        textSnippet,
      };
    }

    const evt: RecordedPointerEvent = {
      id: `ptr-${++this.eventSequence}`,
      type,
      timestampMs,
      t_ms: timestampMs,
      timestamp: Date.now(),
      x: normX,
      y: normY,
      normalizedX: normX,
      normalizedY: normY,
      rawPixelX: clientX,
      rawPixelY: clientY,
      clientX,
      clientY,
      button: button ?? 0,
      targetTag,
      targetId,
      targetElement,
      deltaY,
    };

    this.events.push(evt);
  }
}
