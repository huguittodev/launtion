/**
 * editor-state.ts
 *
 * Pure reducer and state manager for Phase 3 Interactive Studio Editor.
 * Enforces deterministic Zod validation via SceneGraphSchema on all mutations.
 * Provides pre-clamping of numerical inputs, safe fallbacks for boundary conditions,
 * and linear undo/redo history stacks.
 */

import { clamp, clamp01 } from '../interaction-map/CoordinateMapper';
import demoInteractionMapRaw from '../interaction-map/demoInteractionMap.json';
import type { InteractionMap } from '../interaction-map/types';
import { interactionToSceneGraphAdapter } from '../scene-graph/adapter';
import { HexColorRegex, SceneGraphSchema } from '../scene-graph/schema';
import type {
  BackdropVariant,
  CameraKeyframe,
  SceneGraph,
  SceneNode,
  SurfaceTheme,
} from '../scene-graph/types';
import { defaultSceneGraph } from '../../../remotion/compositions/InteractiveSurfaceDemo';

export interface EditorHistory {
  past: SceneGraph[];
  future: SceneGraph[];
}

export interface EditorState {
  sceneGraph: SceneGraph;
  history: EditorHistory;
  activeKeyframeIndex: number;
  selectedSceneId: string | null;
  currentFrame: number;
  isPlaying: boolean;
  validationNotice: string | null;
  isDirty: boolean;
}

export type EditorAction =
  | {
      type: 'UPDATE_TEXT';
      payload: {
        sceneId?: string;
        field:
          | 'textToType'
          | 'buttonText'
          | 'title'
          | 'files'
          | 'productName'
          | 'tagline'
          | 'headline'
          | 'words'
          | 'windowTitle'
          | 'sourceText'
          | 'targetText'
          | string;
        value: string | string[];
      };
    }
  | {
      type: 'UPDATE_ART_DIRECTION';
      payload: {
        backdropVariant?: BackdropVariant;
        surfaceTheme?: SurfaceTheme;
        primaryAccent?: string;
      };
    }
  | {
      type: 'UPDATE_CAMERA_FOCAL';
      payload: {
        keyframeIndex?: number;
        frame?: number;
        x?: number;
        y?: number;
        zoom?: number;
        rotateX?: number;
        rotateY?: number;
        rotateZ?: number;
        easing?: 'linear' | 'ease-in-out' | 'spring';
      };
    }
  | {
      type: 'SET_ACTIVE_KEYFRAME';
      payload: {
        index: number;
      };
    }
  | {
      type: 'SET_CURRENT_FRAME';
      payload: {
        frame: number;
      };
    }
  | {
      type: 'SET_PLAYING';
      payload: {
        isPlaying: boolean;
      };
    }
  | {
      type: 'SELECT_SCENE';
      payload: {
        sceneId: string | null;
      };
    }
  | {
      type: 'RESET_SCENE_GRAPH';
      payload?: {
        preset?: 'default' | 'multi-scene';
      };
    }
  | {
      type: 'LOAD_SCENE_GRAPH';
      payload: {
        sceneGraph: SceneGraph;
        description?: string;
      };
    }
  | {
      type: 'UNDO';
    }
  | {
      type: 'REDO';
    };

/**
 * Creates a clean deep copy of a SceneGraph.
 */
export function cloneSceneGraph(graph: SceneGraph): SceneGraph {
  return structuredClone(graph);
}

/**
 * Creates an initial EditorState instance.
 */
export function createInitialEditorState(preset: 'default' | 'multi-scene' = 'default'): EditorState {
  const baseGraph: SceneGraph =
    preset === 'multi-scene'
      ? interactionToSceneGraphAdapter(demoInteractionMapRaw as unknown as InteractionMap, {
          generateMultiSceneSequence: true,
        })
      : cloneSceneGraph(defaultSceneGraph);

  return {
    sceneGraph: baseGraph,
    history: {
      past: [],
      future: [],
    },
    activeKeyframeIndex: 0,
    selectedSceneId: baseGraph.scenes[0]?.id ?? null,
    currentFrame: 0,
    isPlaying: false,
    validationNotice: null,
    isDirty: false,
  };
}

export const initialEditorState: EditorState = createInitialEditorState();

/**
 * Maximum character bounds according to SceneGraphSchema.
 */
const TEXT_BOUNDS: Record<string, number> = {
  windowTitle: 80,
  textToType: 200,
  promptText: 200,
  buttonText: 30,
  title: 50,
  productName: 50,
  tagline: 100,
  headline: 60,
  sourceText: 30,
  targetText: 30,
};

/**
 * Clamps and sanitizes text strings to satisfy Zod schema constraints.
 * If empty, provides a 1-character fallback to satisfy z.string().min(1).
 */
function sanitizeText(field: string, value: string): string {
  const max = TEXT_BOUNDS[field] ?? 100;
  const trimmed = value.slice(0, max);
  // Ensure non-empty for min(1) constraints
  return trimmed.length === 0 ? ' ' : trimmed;
}

/**
 * Pure reducer function for EditorState.
 */
export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'UPDATE_TEXT': {
      const { sceneId, field, value } = action.payload;
      const candidate: SceneGraph = cloneSceneGraph(state.sceneGraph);

      let targetSceneIndex = -1;
      if (sceneId) {
        targetSceneIndex = candidate.scenes.findIndex((s) => s.id === sceneId);
      }

      // If no sceneId specified or not found, search for scene containing the field
      if (targetSceneIndex === -1) {
        targetSceneIndex = candidate.scenes.findIndex((s) => {
          if (!s.payload || typeof s.payload !== 'object') return false;
          return field in s.payload;
        });
      }

      // If still not found, fallback to first scene or scene-product-3d
      if (targetSceneIndex === -1 && candidate.scenes.length > 0) {
        targetSceneIndex = 0;
      }

      if (targetSceneIndex >= 0 && candidate.scenes[targetSceneIndex]) {
        const scene = candidate.scenes[targetSceneIndex];
        const payload = { ...(scene.payload as Record<string, unknown>) };

        if (Array.isArray(value)) {
          // Array field (e.g. files, words)
          const sanitizedArray = value
            .map((item) => (typeof item === 'string' ? item.trim() : String(item)))
            .filter((item) => item.length > 0);
          payload[field] = sanitizedArray.length > 0 ? sanitizedArray : ['Item 1'];
        } else {
          // Single string field
          payload[field] = sanitizeText(field, String(value));
        }

        candidate.scenes[targetSceneIndex] = {
          ...scene,
          payload,
        } as SceneNode;
      }

      // Pre-commit validation against SceneGraphSchema
      const validation = SceneGraphSchema.safeParse(candidate);
      if (validation.success) {
        return {
          ...state,
          sceneGraph: validation.data,
          history: {
            past: [state.sceneGraph, ...state.history.past.slice(0, 49)],
            future: [],
          },
          isDirty: true,
          validationNotice: null,
        };
      } else {
        return {
          ...state,
          validationNotice: validation.error.issues[0]?.message ?? 'Invalid SceneGraph text update',
        };
      }
    }

    case 'UPDATE_ART_DIRECTION': {
      const candidate: SceneGraph = cloneSceneGraph(state.sceneGraph);
      const { backdropVariant, surfaceTheme, primaryAccent } = action.payload;

      let validAccent = candidate.artDirection.primaryAccent;
      let notice: string | null = null;

      if (primaryAccent !== undefined) {
        if (HexColorRegex.test(primaryAccent)) {
          validAccent = primaryAccent;
        } else {
          notice = `Color '${primaryAccent}' must be a valid hex code (#RGB or #RRGGBB)`;
        }
      }

      candidate.artDirection = {
        backdropVariant: backdropVariant ?? candidate.artDirection.backdropVariant,
        surfaceTheme: surfaceTheme ?? candidate.artDirection.surfaceTheme,
        primaryAccent: validAccent,
      };

      const validation = SceneGraphSchema.safeParse(candidate);
      if (validation.success) {
        return {
          ...state,
          sceneGraph: validation.data,
          history: {
            past: [state.sceneGraph, ...state.history.past.slice(0, 49)],
            future: [],
          },
          isDirty: true,
          validationNotice: notice,
        };
      } else {
        return {
          ...state,
          validationNotice: validation.error.issues[0]?.message ?? 'Invalid Art Direction update',
        };
      }
    }

    case 'UPDATE_CAMERA_FOCAL': {
      const candidate: SceneGraph = cloneSceneGraph(state.sceneGraph);
      const track = [...candidate.cameraTrack];
      if (track.length === 0) return state;

      let kfIndex = state.activeKeyframeIndex;
      if (action.payload.keyframeIndex !== undefined) {
        kfIndex = Math.max(0, Math.min(track.length - 1, action.payload.keyframeIndex));
      } else if (action.payload.frame !== undefined) {
        const found = track.findIndex((kf) => kf.frame === action.payload.frame);
        if (found !== -1) {
          kfIndex = found;
        }
      }

      const currentKf = track[kfIndex] ?? track[0];

      // Pre-clamping inputs
      const rawX = action.payload.x !== undefined ? action.payload.x : currentKf.x;
      const rawY = action.payload.y !== undefined ? action.payload.y : currentKf.y;
      const rawZoom = action.payload.zoom !== undefined ? action.payload.zoom : currentKf.zoom;

      const safeX = clamp01(Number.isFinite(rawX) ? rawX : 0.5);
      const safeY = clamp01(Number.isFinite(rawY) ? rawY : 0.5);
      const safeZoom = clamp(Number.isFinite(rawZoom) ? rawZoom : 1.0, 0.8, 3.5);

      const updatedKf: CameraKeyframe = {
        ...currentKf,
        x: Number(safeX.toFixed(4)),
        y: Number(safeY.toFixed(4)),
        zoom: Number(safeZoom.toFixed(2)),
      };

      if (action.payload.rotateX !== undefined) {
        const rx = Number.isFinite(action.payload.rotateX) ? action.payload.rotateX : 0;
        updatedKf.rotateX = clamp(rx, -90, 90);
      }
      if (action.payload.rotateY !== undefined) {
        const ry = Number.isFinite(action.payload.rotateY) ? action.payload.rotateY : 0;
        updatedKf.rotateY = clamp(ry, -90, 90);
      }
      if (action.payload.rotateZ !== undefined) {
        const rz = Number.isFinite(action.payload.rotateZ) ? action.payload.rotateZ : 0;
        updatedKf.rotateZ = clamp(rz, -180, 180);
      }
      if (action.payload.easing !== undefined) {
        updatedKf.easing = action.payload.easing;
      }

      track[kfIndex] = updatedKf;
      candidate.cameraTrack = track;

      const validation = SceneGraphSchema.safeParse(candidate);
      if (validation.success) {
        return {
          ...state,
          sceneGraph: validation.data,
          activeKeyframeIndex: kfIndex,
          history: {
            past: [state.sceneGraph, ...state.history.past.slice(0, 49)],
            future: [],
          },
          isDirty: true,
          validationNotice: null,
        };
      } else {
        return {
          ...state,
          validationNotice: validation.error.issues[0]?.message ?? 'Invalid Camera Keyframe update',
        };
      }
    }

    case 'SET_ACTIVE_KEYFRAME': {
      const maxIdx = Math.max(0, state.sceneGraph.cameraTrack.length - 1);
      const rawIdx = Number.isFinite(action.payload.index)
        ? action.payload.index
        : action.payload.index > 0
          ? maxIdx
          : 0;
      const safeIdx = Math.max(0, Math.min(maxIdx, Math.round(rawIdx)));
      return {
        ...state,
        activeKeyframeIndex: safeIdx,
      };
    }

    case 'SET_CURRENT_FRAME': {
      const maxF = Math.max(0, state.sceneGraph.canvas.durationInFrames - 1);
      const rawFrame = Number.isFinite(action.payload.frame)
        ? action.payload.frame
        : action.payload.frame > 0
          ? maxF
          : 0;
      const safeFrame = Math.max(0, Math.min(maxF, Math.round(rawFrame)));
      return {
        ...state,
        currentFrame: safeFrame,
      };
    }

    case 'SET_PLAYING': {
      return {
        ...state,
        isPlaying: action.payload.isPlaying,
      };
    }

    case 'SELECT_SCENE': {
      return {
        ...state,
        selectedSceneId: action.payload.sceneId,
      };
    }

    case 'RESET_SCENE_GRAPH': {
      const freshGraph: SceneGraph =
        action.payload?.preset === 'multi-scene'
          ? interactionToSceneGraphAdapter(demoInteractionMapRaw as unknown as InteractionMap, {
              generateMultiSceneSequence: true,
            })
          : cloneSceneGraph(defaultSceneGraph);

      return {
        ...state,
        sceneGraph: freshGraph,
        activeKeyframeIndex: 0,
        selectedSceneId: freshGraph.scenes[0]?.id ?? null,
        validationNotice: null,
        isDirty: false,
        history: {
          past: [state.sceneGraph, ...state.history.past.slice(0, 49)],
          future: [],
        },
      };
    }

    case 'LOAD_SCENE_GRAPH': {
      const candidate = action.payload.sceneGraph;
      const validation = SceneGraphSchema.safeParse(candidate);

      if (validation.success) {
        return {
          ...state,
          sceneGraph: validation.data,
          activeKeyframeIndex: 0,
          selectedSceneId: validation.data.scenes[0]?.id ?? null,
          currentFrame: 0,
          validationNotice: null,
          isDirty: true,
          history: {
            past: [state.sceneGraph, ...state.history.past.slice(0, 49)],
            future: [],
          },
        };
      } else {
        return {
          ...state,
          validationNotice:
            validation.error.issues[0]?.message ?? 'SceneGraph generado inválido',
        };
      }
    }

    case 'UNDO': {
      if (state.history.past.length === 0) return state;
      const previous = state.history.past[0];
      const newPast = state.history.past.slice(1);
      const newFuture = [state.sceneGraph, ...state.history.future];

      return {
        ...state,
        sceneGraph: previous,
        validationNotice: null,
        isDirty: true,
        history: {
          past: newPast,
          future: newFuture,
        },
      };
    }

    case 'REDO': {
      if (state.history.future.length === 0) return state;
      const next = state.history.future[0];
      const newFuture = state.history.future.slice(1);
      const newPast = [state.sceneGraph, ...state.history.past];

      return {
        ...state,
        sceneGraph: next,
        validationNotice: null,
        isDirty: true,
        history: {
          past: newPast,
          future: newFuture,
        },
      };
    }

    default:
      return state;
  }
}

// Action Creators for clean type-safe dispatching
export const editorActions = {
  updateText: (field: string, value: string | string[], sceneId?: string): EditorAction => ({
    type: 'UPDATE_TEXT',
    payload: { field, value, sceneId },
  }),
  updateArtDirection: (payload: {
    backdropVariant?: BackdropVariant;
    surfaceTheme?: SurfaceTheme;
    primaryAccent?: string;
  }): EditorAction => ({
    type: 'UPDATE_ART_DIRECTION',
    payload,
  }),
  updateCameraFocal: (payload: {
    keyframeIndex?: number;
    frame?: number;
    x?: number;
    y?: number;
    zoom?: number;
    rotateX?: number;
    rotateY?: number;
    rotateZ?: number;
    easing?: 'linear' | 'ease-in-out' | 'spring';
  }): EditorAction => ({
    type: 'UPDATE_CAMERA_FOCAL',
    payload,
  }),
  setActiveKeyframe: (index: number): EditorAction => ({
    type: 'SET_ACTIVE_KEYFRAME',
    payload: { index },
  }),
  setCurrentFrame: (frame: number): EditorAction => ({
    type: 'SET_CURRENT_FRAME',
    payload: { frame },
  }),
  setPlaying: (isPlaying: boolean): EditorAction => ({
    type: 'SET_PLAYING',
    payload: { isPlaying },
  }),
  selectScene: (sceneId: string | null): EditorAction => ({
    type: 'SELECT_SCENE',
    payload: { sceneId },
  }),
  resetSceneGraph: (preset?: 'default' | 'multi-scene'): EditorAction => ({
    type: 'RESET_SCENE_GRAPH',
    payload: { preset },
  }),
  loadSceneGraph: (sceneGraph: SceneGraph, description?: string): EditorAction => ({
    type: 'LOAD_SCENE_GRAPH',
    payload: { sceneGraph, description },
  }),
  undo: (): EditorAction => ({
    type: 'UNDO',
  }),
  redo: (): EditorAction => ({
    type: 'REDO',
  }),
};
