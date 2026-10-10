import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import * as fabric from "fabric";
import {
  type AnimationProject,
  type AnimationTrack,
  type TrackGroup,
  type Keyframe,
  type AnimatableProps,
  type EasingType,
  type PlaybackMode,
  type KeyframeSelection,
  type ClipboardEntry,
  getInterpolatedValues,
  NUMERIC_PROPS,
  isHelperObject,
  captureObjectProps,
  createTrackFromObject,
  createAnimationProject,
  upsertKeyframe,
  deleteKeyframe as engineDeleteKeyframe,
  updateKeyframeEasing,
  formatFrameTime,
} from "@/lib/animationEngine";
import {
  saveAnimation as persistSaveAnimation,
  loadAnimation as persistLoadAnimation,
  loadAnimationById as persistLoadAnimationById,
} from "@/lib/animationPersistence";
import {
  reconstructCanvasReferences,
  postProcessLoadedCanvas,
} from "@/lib/canvasDataLoader";
import { supabase } from "@/integrations/supabase/client";
import { getPresetById, generateStaggeredKeyframes } from "@/lib/animationPresets";
import { decodeAudioFile } from "@/lib/audioUtils";
import { MOTION_GRAPHICS, buildKeyframes } from "@/lib/motionGraphicsLibrary";
import {
  type RigData,
  type AnchorPoint,
  generateAnchorId,
  generateRigId,
  solveFK,
  applyFKToObjects,
  autoGenerateAnchors,
} from "@/lib/skeletalAnimation";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimelineMarker {
  frame: number;
  label: string;
  color?: string;
}

export interface CanvasProject {
  id: string;
  name: string;
  canvas_data: any;
  canvas_width: number;
  canvas_height: number;
}

interface AnimationContextValue {
  // Source project
  sourceProject: CanvasProject | null;
  loading: boolean;
  error: string | null;

  // Fabric canvas refs
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  fabricCanvasRef: React.MutableRefObject<fabric.Canvas | null>;
  objectMapRef: React.MutableRefObject<Map<string, fabric.FabricObject>>;

  // Animation project
  animProject: AnimationProject | null;
  setAnimProject: React.Dispatch<React.SetStateAction<AnimationProject | null>>;

  // Playback
  currentFrame: number;
  setCurrentFrame: React.Dispatch<React.SetStateAction<number>>;
  playing: boolean;
  frameRef: React.MutableRefObject<number>;
  togglePlayback: () => void;
  stopPlayback: () => void;
  goToFrame: (frame: number) => void;
  stepFrame: (delta: number) => void;

  // Playback mode & speed
  playbackMode: PlaybackMode;
  setPlaybackMode: (mode: PlaybackMode) => void;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;

  // Selection (single — backward compat)
  selectedTrackId: string | null;
  setSelectedTrackId: (id: string | null) => void;
  selectedKeyframeIndex: number | null;
  setSelectedKeyframeIndex: (index: number | null) => void;
  selectedTrack: AnimationTrack | null;
  selectedKeyframe: Keyframe | null;

  // Multi-keyframe selection
  selectedKeyframes: KeyframeSelection[];
  isKeyframeSelected: (trackId: string, frame: number) => boolean;
  toggleKeyframeSelection: (trackId: string, frame: number, mode: "replace" | "toggle" | "range") => void;
  deleteSelectedKeyframes: () => void;
  moveSelectedKeyframes: (frameDelta: number) => void;
  selectKeyframesAtFrame: (frame: number) => void;

  // Copy / paste
  clipboard: ClipboardEntry[];
  copySelectedKeyframes: () => void;
  pasteKeyframes: () => void;
  pasteKeyframesToTrack: (targetTrackId?: string) => void;

  // Undo / redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  pushUndoState: () => void;

  // Onion skinning
  onionSkinning: boolean;
  setOnionSkinning: (v: boolean) => void;
  onionFrameCount: number;
  setOnionFrameCount: (n: number) => void;

  // Project settings
  updateFps: (fps: number) => void;
  updateDuration: (duration: number) => void;

  // Snapping
  snapping: boolean;
  setSnapping: (v: boolean) => void;
  snapFrame: (frame: number) => number;

  // Path preview
  pathPreview: boolean;
  setPathPreview: (v: boolean) => void;

  // Auto-key
  autoKey: boolean;
  setAutoKey: (v: boolean) => void;

  // Playback range (in/out points)
  inPoint: number;
  outPoint: number;
  setInPoint: (frame: number) => void;
  setOutPoint: (frame: number) => void;
  clearPlaybackRange: () => void;
  hasPlaybackRange: boolean;

  // Timeline markers
  markers: TimelineMarker[];
  addMarker: (frame: number, label?: string) => void;
  removeMarker: (frame: number) => void;
  renameMarker: (frame: number, label: string) => void;
  updateMarkerColor: (frame: number, color: string) => void;

  // Duplicate keyframes
  duplicateSelectedKeyframes: (offsetFrames?: number) => void;

  // Shortcuts help
  shortcutsVisible: boolean;
  setShortcutsVisible: (v: boolean) => void;

  // Auto-save
  lastSavedAt: string | null;

  // Canvas resize
  resizeCanvas: (newWidth: number, newHeight: number) => void;

  // Canvas background color
  canvasBgColor: string;
  setCanvasBgColor: (color: string) => void;

  // Update object property from properties panel
  updateObjectProperty: (property: keyof AnimatableProps, value: number | string) => void;

  // Per-property easing
  handlePropertyEasingChange: (trackId: string, keyframeIndex: number, property: keyof AnimatableProps, easing: EasingType) => void;

  // Custom bezier
  updateKeyframeCustomBezier: (trackId: string, keyframeIndex: number, bezier: [number, number, number, number]) => void;

  // Presets
  applyPreset: (presetId: string) => void;
  applyStaggeredPreset: (presetId: string, trackIds: string[], staggerDelay: number, order?: 'normal' | 'reverse' | 'center') => void;

  // Camera animation
  applyCameraMove: (type: "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "pan-up" | "pan-down", durationFrames?: number) => void;

  // Persistence
  hasUnsavedChanges: boolean;
  saveAnimation: () => Promise<void>;

  // Operations
  addKeyframeAtCurrentFrame: () => void;
  handleDeleteKeyframe: (trackId: string, keyframeIndex: number) => void;
  handleEasingChange: (trackId: string, keyframeIndex: number, easing: EasingType) => void;
  toggleTrackVisibility: (trackId: string) => void;
  toggleTrackLock: (trackId: string) => void;

  // Object management
  removeObject: (trackId: string) => void;
  reorderObject: (trackId: string, direction: "up" | "down") => void;
  reorderTracksByIds: (fromId: string, toId: string) => void;
  addObjectToCanvas: (svgData: string, iconName?: string) => Promise<void>;
  addFabricObject: (obj: fabric.FabricObject, name?: string) => void;
  registerExistingObject: (obj: fabric.FabricObject, name?: string) => void;
  applyKeyframesToTrack: (trackId: string, keyframes: import("./animationEngine").Keyframe[]) => void;

  // Track groups
  createTrackGroup: (name: string, trackIds: string[]) => void;
  removeTrackGroup: (groupId: string) => void;
  renameTrackGroup: (groupId: string, name: string) => void;
  addTracksToGroup: (groupId: string, trackIds: string[]) => void;
  removeTrackFromGroup: (trackId: string) => void;
  toggleGroupCollapsed: (groupId: string) => void;
  applyKeyframesToGroup: (groupId: string, keyframes: import("@/lib/animationEngine").Keyframe[], staggerFrames?: number) => void;

  // Motion graphics
  insertMotionGraphic: (defId: string, position?: { x: number; y: number }) => void;

  // Annotation sequencing
  staggerEntranceForGroup: (trackIds: string[], staggerFrames: number, startFrame?: number) => void;

  // Keyframe dragging
  moveKeyframe: (trackId: string, keyframeIndex: number, newFrame: number) => void;

  // Scale all keyframes on a track proportionally
  scaleTrackKeyframes: (trackId: string, scaleFactor: number) => void;

  // Timeline zoom
  timelineZoom: number;
  setTimelineZoom: (zoom: number) => void;
  timelineScrollLeft: number;
  setTimelineScrollLeft: (left: number) => void;

  // Time display
  currentTimeStr: string;
  totalTimeStr: string;

  // Audio
  audioBuffer: AudioBuffer | null;
  audioMuted: boolean;
  setAudioMuted: (v: boolean) => void;
  audioVolume: number;
  setAudioVolume: (v: number) => void;
  importAudio: (file: File) => Promise<void>;
  removeAudio: () => void;

  // Path-follow
  applyPathFollow: (targetTrackId: string, pathTrackId: string, durationFrames?: number) => void;
  getPathTrackIds: () => { id: string; name: string }[];

  // Workspace theme
  workspaceTheme: "dark" | "light";
  setWorkspaceTheme: (theme: "dark" | "light") => void;

  // Skeletal rig
  rigs: RigData[];
  rigMode: boolean;
  setRigMode: (v: boolean) => void;
  decomposeSVGForRig: (objectId: string) => void;
  addAnchorToRig: (rigId: string, x: number, y: number, name?: string) => void;
  removeAnchorFromRig: (rigId: string, anchorId: string) => void;
  setAnchorParent: (rigId: string, anchorId: string, parentId: string | null) => void;
  renameAnchor: (rigId: string, anchorId: string, name: string) => void;
  removeRig: (rigId: string) => void;
}

const AnimationContext = createContext<AnimationContextValue | null>(null);

export function useAnimation() {
  const ctx = useContext(AnimationContext);
  if (!ctx) throw new Error("useAnimation must be used within AnimationProvider");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface AnimationProviderProps {
  projectId: string;
  userId: string;
  children: ReactNode;
  /** When provided, load this specific animation instead of searching by sourceProjectId */
  animationId?: string;
}

const MAX_UNDO = 50;

export function AnimationProvider({
  projectId,
  userId,
  children,
  animationId,
}: AnimationProviderProps) {
  // Source project
  const [sourceProject, setSourceProject] = useState<CanvasProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fabric canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const objectMapRef = useRef<Map<string, fabric.FabricObject>>(new Map());
  const animProjectRef = useRef<AnimationProject | null>(null);

  // Animation state
  const [animProject, setAnimProject] = useState<AnimationProject | null>(null);
  // Keep ref in sync for stable callbacks
  animProjectRef.current = animProject;
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [timelineScrollLeft, setTimelineScrollLeft] = useState(0);
  const playingRef = useRef(false);
  const frameRef = useRef(0);
  const animationFrameId = useRef<number | null>(null);

  // Selection
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [_selectedKeyframeIndex, _setSelectedKeyframeIndex] = useState<number | null>(null);
  const [selectedKeyframes, setSelectedKeyframes] = useState<KeyframeSelection[]>([]);

  // Playback mode & speed
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("loop");
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playbackSpeedRef = useRef(1);
  const playbackModeRef = useRef<PlaybackMode>("loop");

  // Copy/paste
  const [clipboard, setClipboard] = useState<ClipboardEntry[]>([]);

  // Undo/redo
  const undoStackRef = useRef<AnimationProject[]>([]);
  const redoStackRef = useRef<AnimationProject[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Onion skinning
  const [onionSkinning, setOnionSkinning] = useState(false);
  const [onionFrameCount, setOnionFrameCount] = useState(3);

  // Snapping, path preview, auto-key
  const [snapping, setSnapping] = useState(true);
  const [pathPreview, setPathPreview] = useState(false);
  const [workspaceTheme, setWorkspaceThemeState] = useState<"dark" | "light">(() => {
    try {
      return (localStorage.getItem("aw-theme") as "dark" | "light") || "dark";
    } catch { return "dark"; }
  });
  const setWorkspaceTheme = useCallback((theme: "dark" | "light") => {
    setWorkspaceThemeState(theme);
    try { localStorage.setItem("aw-theme", theme); } catch {}
  }, []);
  const [rigs, setRigs] = useState<RigData[]>([]);
  const rigsRef = useRef<RigData[]>([]);
  const [rigMode, setRigMode] = useState(false);
  const [autoKey, setAutoKey] = useState(true);
  const autoKeyRef = useRef(true);

  // Playback range (in/out points)
  const [inPoint, setInPoint] = useState(0);
  const [outPoint, setOutPoint] = useState(-1); // -1 means "end of timeline"
  const inPointRef = useRef(0);
  const outPointRef = useRef(-1);

  // Audio
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [audioMuted, setAudioMuted] = useState(false);
  const [audioVolume, setAudioVolume] = useState(1);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioGainRef = useRef<GainNode | null>(null);

  // Timeline markers
  const [markers, setMarkers] = useState<TimelineMarker[]>([]);

  // Shortcuts help
  const [shortcutsVisible, setShortcutsVisible] = useState(false);

  // Auto-save
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Keep refs in sync
  useEffect(() => { playbackSpeedRef.current = playbackSpeed; }, [playbackSpeed]);
  useEffect(() => { playbackModeRef.current = playbackMode; }, [playbackMode]);
  useEffect(() => { autoKeyRef.current = autoKey; }, [autoKey]);
  useEffect(() => { inPointRef.current = inPoint; }, [inPoint]);
  useEffect(() => { outPointRef.current = outPoint; }, [outPoint]);

  // ─── Undo/redo helpers ───────────────────────────────────────────────────

  const pushUndoState = useCallback(() => {
    setAnimProject((prev) => {
      if (prev) {
        undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), prev];
        redoStackRef.current = [];
      }
      return prev;
    });
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const commitAnimProject = useCallback(
    (updater: (prev: AnimationProject) => AnimationProject) => {
      setAnimProject((prev) => {
        if (!prev) return prev;
        undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), prev];
        redoStackRef.current = [];
        return updater(prev);
      });
      setCanUndo(true);
      setCanRedo(false);
      setHasUnsavedChanges(true);
    },
    []
  );

  const undo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;

    setAnimProject((prev) => {
      if (prev) {
        redoStackRef.current = [...redoStackRef.current, prev];
      }
      const restored = stack[stack.length - 1];
      undoStackRef.current = stack.slice(0, -1);
      setCanUndo(undoStackRef.current.length > 0);
      setCanRedo(true);
      return restored;
    });
    setHasUnsavedChanges(true);
  }, []);

  const redo = useCallback(() => {
    const stack = redoStackRef.current;
    if (stack.length === 0) return;

    setAnimProject((prev) => {
      if (prev) {
        undoStackRef.current = [...undoStackRef.current, prev];
      }
      const restored = stack[stack.length - 1];
      redoStackRef.current = stack.slice(0, -1);
      setCanRedo(redoStackRef.current.length > 0);
      setCanUndo(true);
      return restored;
    });
    setHasUnsavedChanges(true);
  }, []);

  // ─── Project settings ─────────────────────────────────────────────────

  const updateFps = useCallback(
    (fps: number) => {
      const clamped = Math.max(1, Math.min(120, Math.round(fps)));
      commitAnimProject((prev) => ({
        ...prev,
        fps: clamped,
        totalFrames: clamped * prev.duration,
        updatedAt: new Date().toISOString(),
      }));
    },
    [commitAnimProject]
  );

  const updateDuration = useCallback(
    (duration: number) => {
      const clamped = Math.max(0.5, Math.min(300, duration));
      commitAnimProject((prev) => ({
        ...prev,
        duration: clamped,
        totalFrames: Math.round(prev.fps * clamped),
        updatedAt: new Date().toISOString(),
      }));
    },
    [commitAnimProject]
  );

  // ─── Snapping ────────────────────────────────────────────────────────────

  const snapFrame = useCallback(
    (frame: number): number => {
      if (!snapping || !animProject) return frame;

      const fps = animProject.fps;
      const snapTargets: number[] = [];

      // Snap to second boundaries
      for (let s = 0; s <= animProject.duration; s++) {
        snapTargets.push(s * fps);
      }

      // Snap to half-second boundaries
      for (let s = 0; s <= animProject.duration * 2; s++) {
        snapTargets.push(Math.round((s * fps) / 2));
      }

      // Snap to other keyframes on all tracks
      animProject.tracks.forEach((track) => {
        track.keyframes.forEach((kf) => snapTargets.push(kf.frame));
      });

      // Find nearest snap target within threshold
      const threshold = 3;
      let nearest = frame;
      let minDist = threshold + 1;
      for (const target of snapTargets) {
        const dist = Math.abs(frame - target);
        if (dist <= threshold && dist < minDist) {
          nearest = target;
          minDist = dist;
        }
      }

      return nearest;
    },
    [snapping, animProject]
  );

  // ─── Per-property easing ─────────────────────────────────────────────────

  const handlePropertyEasingChange = useCallback(
    (trackId: string, keyframeIndex: number, property: keyof AnimatableProps, easing: EasingType) => {
      commitAnimProject((prev) => {
        const tracks = prev.tracks.map((track) => {
          if (track.objectId !== trackId) return track;
          const newKeyframes = [...track.keyframes];
          const kf = newKeyframes[keyframeIndex];
          if (!kf) return track;
          const propertyEasings = { ...(kf.propertyEasings ?? {}), [property]: easing };
          // If the property easing matches the main easing, remove the override
          if (easing === kf.easing) {
            delete propertyEasings[property];
          }
          newKeyframes[keyframeIndex] = { ...kf, propertyEasings: Object.keys(propertyEasings).length > 0 ? propertyEasings : undefined };
          return { ...track, keyframes: newKeyframes };
        });
        return { ...prev, tracks };
      });
    },
    [commitAnimProject]
  );

  // ─── Multi-keyframe selection ────────────────────────────────────────────

  const setSelectedKeyframeIndex = useCallback(
    (index: number | null) => {
      _setSelectedKeyframeIndex(index);
      if (index !== null && selectedTrackId && animProject) {
        const track = animProject.tracks.find((t) => t.objectId === selectedTrackId);
        if (track && track.keyframes[index]) {
          setSelectedKeyframes([{ trackId: selectedTrackId, frame: track.keyframes[index].frame }]);
        }
      } else if (index === null) {
        setSelectedKeyframes([]);
      }
    },
    [selectedTrackId, animProject]
  );

  const isKeyframeSelected = useCallback(
    (trackId: string, frame: number) =>
      selectedKeyframes.some((s) => s.trackId === trackId && s.frame === frame),
    [selectedKeyframes]
  );

  const toggleKeyframeSelection = useCallback(
    (trackId: string, frame: number, mode: "replace" | "toggle" | "range") => {
      if (mode === "replace") {
        setSelectedKeyframes([{ trackId, frame }]);
        setSelectedTrackId(trackId);
        // Compute the index for backward compat
        if (animProject) {
          const track = animProject.tracks.find((t) => t.objectId === trackId);
          if (track) {
            const idx = track.keyframes.findIndex((kf) => kf.frame === frame);
            _setSelectedKeyframeIndex(idx >= 0 ? idx : null);
          }
        }
      } else if (mode === "toggle") {
        setSelectedKeyframes((prev) => {
          const exists = prev.some((s) => s.trackId === trackId && s.frame === frame);
          if (exists) {
            return prev.filter((s) => !(s.trackId === trackId && s.frame === frame));
          }
          return [...prev, { trackId, frame }];
        });
        setSelectedTrackId(trackId);
      } else if (mode === "range") {
        if (selectedKeyframes.length === 0 || !animProject) {
          setSelectedKeyframes([{ trackId, frame }]);
        } else {
          const lastSel = selectedKeyframes[selectedKeyframes.length - 1];
          if (lastSel.trackId === trackId) {
            const track = animProject.tracks.find((t) => t.objectId === trackId);
            if (track) {
              const lastIdx = track.keyframes.findIndex((kf) => kf.frame === lastSel.frame);
              const curIdx = track.keyframes.findIndex((kf) => kf.frame === frame);
              if (lastIdx >= 0 && curIdx >= 0) {
                const min = Math.min(lastIdx, curIdx);
                const max = Math.max(lastIdx, curIdx);
                const range: KeyframeSelection[] = [];
                for (let i = min; i <= max; i++) {
                  range.push({ trackId, frame: track.keyframes[i].frame });
                }
                setSelectedKeyframes(range);
              }
            }
          } else {
            setSelectedKeyframes((prev) => [...prev, { trackId, frame }]);
          }
        }
        setSelectedTrackId(trackId);
      }
    },
    [selectedKeyframes, animProject]
  );

  const deleteSelectedKeyframes = useCallback(() => {
    if (selectedKeyframes.length === 0 || !animProject) return;

    commitAnimProject((prev) => {
      const tracks = prev.tracks.map((track) => {
        const framesToDelete = new Set(
          selectedKeyframes.filter((s) => s.trackId === track.objectId).map((s) => s.frame)
        );
        if (framesToDelete.size === 0) return track;

        const remaining = track.keyframes.filter((kf) => !framesToDelete.has(kf.frame));
        if (remaining.length === 0) return track; // keep at least one
        return { ...track, keyframes: remaining };
      });
      return { ...prev, tracks };
    });

    setSelectedKeyframes([]);
    _setSelectedKeyframeIndex(null);
  }, [selectedKeyframes, animProject, commitAnimProject]);

  const moveSelectedKeyframes = useCallback(
    (frameDelta: number) => {
      if (selectedKeyframes.length === 0) return;

      commitAnimProject((prev) => {
        const tracks = prev.tracks.map((track) => {
          const selectedFrames = new Set(
            selectedKeyframes.filter((s) => s.trackId === track.objectId).map((s) => s.frame)
          );
          if (selectedFrames.size === 0) return track;

          const newKeyframes = track.keyframes.map((kf) => {
            if (!selectedFrames.has(kf.frame)) return kf;
            const newFrame = Math.max(0, Math.min(prev.totalFrames - 1, kf.frame + frameDelta));
            return { ...kf, frame: newFrame };
          });
          newKeyframes.sort((a, b) => a.frame - b.frame);
          return { ...track, keyframes: newKeyframes };
        });
        return { ...prev, tracks };
      });

      // Update selection frames
      setSelectedKeyframes((prev) =>
        prev.map((s) => ({
          ...s,
          frame: Math.max(0, Math.min((animProject?.totalFrames ?? 1) - 1, s.frame + frameDelta)),
        }))
      );
    },
    [selectedKeyframes, animProject, commitAnimProject]
  );

  // ─── Select keyframes at frame ───────────────────────────────────────────

  const selectKeyframesAtFrame = useCallback((frame: number) => {
    if (!animProject) return;
    const selections: KeyframeSelection[] = [];
    for (const track of animProject.tracks) {
      if (track.keyframes.some(kf => kf.frame === frame)) {
        selections.push({ trackId: track.objectId, frame });
      }
    }
    setSelectedKeyframes(selections);
  }, [animProject]);

  // ─── Copy / paste ────────────────────────────────────────────────────────

  const copySelectedKeyframes = useCallback(() => {
    if (!animProject || selectedKeyframes.length === 0) return;

    let minFrame = Infinity;
    const entries: ClipboardEntry[] = [];

    for (const sel of selectedKeyframes) {
      const track = animProject.tracks.find((t) => t.objectId === sel.trackId);
      if (!track) continue;
      const kf = track.keyframes.find((k) => k.frame === sel.frame);
      if (!kf) continue;
      if (kf.frame < minFrame) minFrame = kf.frame;
    }

    for (const sel of selectedKeyframes) {
      const track = animProject.tracks.find((t) => t.objectId === sel.trackId);
      if (!track) continue;
      const kf = track.keyframes.find((k) => k.frame === sel.frame);
      if (!kf) continue;
      entries.push({
        trackId: sel.trackId,
        relativeFrame: kf.frame - minFrame,
        properties: { ...kf.properties },
        easing: kf.easing,
      });
    }

    setClipboard(entries);
    toast.success(`Copied ${entries.length} keyframe(s)`);
  }, [animProject, selectedKeyframes]);

  const pasteKeyframes = useCallback(() => {
    if (!animProject || clipboard.length === 0) return;

    commitAnimProject((prev) => {
      const tracks = [...prev.tracks];
      for (const entry of clipboard) {
        const trackIndex = tracks.findIndex((t) => t.objectId === entry.trackId);
        if (trackIndex === -1) continue;
        const targetFrame = Math.min(currentFrame + entry.relativeFrame, prev.totalFrames - 1);
        const newKf: Keyframe = {
          frame: targetFrame,
          properties: { ...entry.properties },
          easing: entry.easing,
        };
        tracks[trackIndex] = upsertKeyframe(tracks[trackIndex], newKf);
      }
      return { ...prev, tracks };
    });

    toast.success(`Pasted ${clipboard.length} keyframe(s)`);
  }, [animProject, clipboard, currentFrame, commitAnimProject]);

  const pasteKeyframesToTrack = useCallback((targetTrackId?: string) => {
    const trackId = targetTrackId ?? selectedTrackId;
    if (!animProject || clipboard.length === 0 || !trackId) return;

    const trackIndex = animProject.tracks.findIndex((t) => t.objectId === trackId);
    if (trackIndex === -1) return;

    commitAnimProject((prev) => {
      const tracks = [...prev.tracks];
      for (const entry of clipboard) {
        const targetFrame = Math.min(currentFrame + entry.relativeFrame, prev.totalFrames - 1);
        const newKf: Keyframe = {
          frame: targetFrame,
          properties: { ...entry.properties },
          easing: entry.easing,
        };
        tracks[trackIndex] = upsertKeyframe(tracks[trackIndex], newKf);
      }
      return { ...prev, tracks };
    });

    toast.success(`Pasted ${clipboard.length} keyframe(s) to selected track`);
  }, [animProject, clipboard, currentFrame, selectedTrackId, commitAnimProject]);

  // ─── Load source project ──────────────────────────────────────────────────

  useEffect(() => {
    if (!projectId || !userId) return;

    const load = async () => {
      setLoading(true);
      try {
        const { data, error: fetchError } = await supabase
          .from("canvas_projects")
          .select("id, name, canvas_data, canvas_width, canvas_height")
          .eq("id", projectId)
          .single();

        if (fetchError) throw fetchError;
        if (!data) throw new Error("Project not found");

        setSourceProject(data as CanvasProject);
      } catch (err: any) {
        setError(err.message || "Failed to load project");
        toast.error("Failed to load project");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [projectId, userId]);

  // ─── Initialize Fabric canvas ─────────────────────────────────────────────

  useEffect(() => {
    if (!sourceProject || !canvasRef.current) return;
    if (fabricCanvasRef.current) return;

    const initCanvas = async () => {
      const canvas = new fabric.Canvas(canvasRef.current!, {
        width: sourceProject.canvas_width,
        height: sourceProject.canvas_height,
        backgroundColor: "#ffffff",
        selection: true,
        preserveObjectStacking: true,
      });

      fabricCanvasRef.current = canvas;

      if (sourceProject.canvas_data) {
        try {
          const canvasData = JSON.parse(JSON.stringify(sourceProject.canvas_data));
          await reconstructCanvasReferences(canvasData);
          await canvas.loadFromJSON(canvasData);
          await postProcessLoadedCanvas(canvas, canvasData);
        } catch (err) {
          console.error("Error loading canvas data:", err);
        }
      }

      // Build object map
      const objects = canvas.getObjects();
      const objMap = new Map<string, fabric.FabricObject>();

      objects.forEach((obj, index) => {
        const o = obj as any;
        if (isHelperObject(o)) return;
        const objectId = (o.id as string) || `obj_${index}`;
        if (!o.id) o.id = objectId;
        objMap.set(objectId, obj);
      });

      objectMapRef.current = objMap;

      // Sync Fabric.js selection with animation tracks
      canvas.on("selection:created", (e) => {
        const selected = e.selected?.[0] as any;
        if (selected?.id) {
          setSelectedTrackId(selected.id);
          _setSelectedKeyframeIndex(null);
          setSelectedKeyframes([]);
        }
      });
      canvas.on("selection:updated", (e) => {
        const selected = e.selected?.[0] as any;
        if (selected?.id) {
          setSelectedTrackId(selected.id);
          _setSelectedKeyframeIndex(null);
          setSelectedKeyframes([]);
        }
      });
      canvas.on("selection:cleared", () => {
        setSelectedTrackId(null);
        _setSelectedKeyframeIndex(null);
        setSelectedKeyframes([]);
      });

      // Auto-key: capture keyframes when objects are modified on canvas
      canvas.on("object:modified", (e) => {
        if (!autoKeyRef.current) return;
        const modified = e.target as any;
        if (!modified?.id) return;
        if (isHelperObject(modified)) return;

        const props = captureObjectProps(modified);
        const frame = frameRef.current;

        setAnimProject((prev) => {
          if (!prev) return prev;
          const trackIndex = prev.tracks.findIndex((t) => t.objectId === modified.id);
          if (trackIndex === -1) return prev;

          // Push undo state
          undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), prev];
          redoStackRef.current = [];

          const newKf: Keyframe = { frame, properties: props, easing: "easeInOut" as EasingType };
          const tracks = [...prev.tracks];
          tracks[trackIndex] = upsertKeyframe(tracks[trackIndex], newKf);
          return { ...prev, tracks };
        });
        setCanUndo(true);
        setCanRedo(false);
        setHasUnsavedChanges(true);
        toast.success(`Auto-key: keyframe at frame ${frame}`);
      });

      // Try loading existing animation (by animationId if provided, else by source project)
      let existing: AnimationProject | null = null;
      if (animationId) {
        existing = await persistLoadAnimationById(animationId);
      }
      if (!existing) {
        existing = await persistLoadAnimation(sourceProject.id);
      }
      if (existing) {
        setAnimProject(existing);
        toast.success("Restored saved animation");
      } else {
        const tracks: AnimationTrack[] = [];
        objects.forEach((obj, index) => {
          const o = obj as any;
          if (isHelperObject(o)) return;
          if (!o.id) o.id = `obj_${index}`;
          tracks.push(createTrackFromObject(o, index));
        });

        setAnimProject(
          createAnimationProject(sourceProject.id, sourceProject.name, tracks)
        );
      }
    };

    initCanvas();

    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, [sourceProject]);

  // ─── Onion skin helpers ──────────────────────────────────────────────────

  const clearOverlays = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const overlays = canvas.getObjects().filter((o: any) => o.isOnionSkin || o.isPathPreview);
    overlays.forEach((o) => canvas.remove(o));
  }, []);

  const renderOnionSkins = useCallback(
    (frame: number) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas || !animProject || !onionSkinning) return;

      for (let offset = -onionFrameCount; offset <= onionFrameCount; offset++) {
        if (offset === 0) continue;
        const f = frame + offset;
        if (f < 0 || f >= animProject.totalFrames) continue;

        const alpha = 0.35 * (1 - Math.abs(offset) / (onionFrameCount + 1));
        const strokeColor = offset < 0
          ? `rgba(59, 130, 246, ${alpha})`
          : `rgba(234, 88, 12, ${alpha})`;

        animProject.tracks.forEach((track) => {
          const obj = objectMapRef.current.get(track.objectId);
          if (!obj) return;

          const values = getInterpolatedValues(track, f);
          if (values.left === undefined && values.top === undefined) return;

          const ghost = new fabric.Rect({
            left: values.left ?? (obj as any).left ?? 0,
            top: values.top ?? (obj as any).top ?? 0,
            width: (obj as any).width ?? 20,
            height: (obj as any).height ?? 20,
            scaleX: values.scaleX ?? (obj as any).scaleX ?? 1,
            scaleY: values.scaleY ?? (obj as any).scaleY ?? 1,
            angle: values.angle ?? (obj as any).angle ?? 0,
            fill: "transparent",
            stroke: strokeColor,
            strokeWidth: 1.5,
            strokeDashArray: [4, 3],
            selectable: false,
            evented: false,
            originX: (obj as any).originX,
            originY: (obj as any).originY,
          });
          (ghost as any).isOnionSkin = true;
          canvas.add(ghost);
        });
      }

      canvas.requestRenderAll();
    },
    [animProject, onionSkinning, onionFrameCount]
  );

  // ─── Path preview ─────────────────────────────────────────────────────────

  const renderPathPreviews = useCallback(
    (frame: number) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas || !animProject || !pathPreview) return;

      animProject.tracks.forEach((track) => {
        if (track.keyframes.length < 2) return;
        const obj = objectMapRef.current.get(track.objectId);
        if (!obj) return;

        const isTrackSelected = selectedTrackId === track.objectId;

        // Sample positions along the animation curve
        const firstFrame = track.keyframes[0].frame;
        const lastFrame = track.keyframes[track.keyframes.length - 1].frame;
        if (lastFrame <= firstFrame) return;

        const sampleCount = Math.min(80, lastFrame - firstFrame);
        const step = Math.max(1, (lastFrame - firstFrame) / sampleCount);
        const points: { x: number; y: number }[] = [];

        for (let f = firstFrame; f <= lastFrame; f += step) {
          const values = getInterpolatedValues(track, Math.round(f));
          if (values.left !== undefined && values.top !== undefined) {
            points.push({ x: values.left, y: values.top });
          }
        }
        // Ensure last frame is included
        const lastValues = getInterpolatedValues(track, lastFrame);
        if (lastValues.left !== undefined && lastValues.top !== undefined) {
          const last = points[points.length - 1];
          if (!last || last.x !== lastValues.left || last.y !== lastValues.top) {
            points.push({ x: lastValues.left, y: lastValues.top });
          }
        }

        if (points.length < 2) return;

        // ── Speed-colored path segments ───────────────────────────────
        // Compute distances between consecutive sample points
        const distances: number[] = [];
        for (let i = 1; i < points.length; i++) {
          const dx = points[i].x - points[i - 1].x;
          const dy = points[i].y - points[i - 1].y;
          distances.push(Math.sqrt(dx * dx + dy * dy));
        }
        const maxDist = Math.max(...distances, 0.001);

        // Draw each segment with a color based on speed (distance)
        for (let i = 0; i < distances.length; i++) {
          const t = Math.min(distances[i] / maxDist, 1); // 0=slow, 1=fast
          // Interpolate from slow (dim purple) to fast (bright purple)
          const r = Math.round(139 + (167 - 139) * t);
          const g = Math.round(92 + (139 - 92) * t);
          const b = Math.round(246 + (250 - 246) * t);
          const a = 0.3 + (0.9 - 0.3) * t;
          const color = isTrackSelected
            ? `rgba(${r},${g},${b},${a})`
            : `rgba(0,0,0,${0.05 + 0.15 * t})`;

          const seg = new fabric.Polyline(
            [points[i], points[i + 1]],
            {
              fill: "transparent",
              stroke: color,
              strokeWidth: 1.5,
              strokeDashArray: [6, 3],
              selectable: false,
              evented: false,
              excludeFromExport: true,
            }
          );
          (seg as any).isPathPreview = true;
          canvas.add(seg);
        }

        // ── Direction arrows along path ──────────────────────────────
        // Compute cumulative path length
        const cumLen: number[] = [0];
        for (let i = 0; i < distances.length; i++) {
          cumLen.push(cumLen[i] + distances[i]);
        }
        const totalLen = cumLen[cumLen.length - 1];

        if (totalLen > 0) {
          const arrowCount = 5; // arrows at ~20% intervals
          for (let ai = 1; ai <= arrowCount; ai++) {
            const targetLen = (ai / (arrowCount + 1)) * totalLen;
            // Find which segment this falls on
            let segIdx = 0;
            for (let i = 1; i < cumLen.length; i++) {
              if (cumLen[i] >= targetLen) {
                segIdx = i - 1;
                break;
              }
            }
            const segFrac =
              distances[segIdx] > 0
                ? (targetLen - cumLen[segIdx]) / distances[segIdx]
                : 0;
            const ax =
              points[segIdx].x +
              (points[segIdx + 1].x - points[segIdx].x) * segFrac;
            const ay =
              points[segIdx].y +
              (points[segIdx + 1].y - points[segIdx].y) * segFrac;
            const dx = points[segIdx + 1].x - points[segIdx].x;
            const dy = points[segIdx + 1].y - points[segIdx].y;
            const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;

            const arrow = new fabric.Triangle({
              left: ax,
              top: ay,
              originX: "center",
              originY: "center",
              width: 6,
              height: 6,
              fill: isTrackSelected
                ? "rgba(139,92,246,0.55)"
                : "rgba(0,0,0,0.15)",
              stroke: "transparent",
              angle: angleDeg,
              selectable: false,
              evented: false,
              excludeFromExport: true,
            });
            (arrow as any).isPathPreview = true;
            canvas.add(arrow);
          }
        }

        // ── Keyframe dots + frame labels ─────────────────────────────
        track.keyframes.forEach((kf) => {
          const vals = getInterpolatedValues(track, kf.frame);
          if (vals.left === undefined || vals.top === undefined) return;
          const isCurrent = kf.frame === frame;
          const dot = new fabric.Circle({
            left: vals.left - 3,
            top: vals.top - 3,
            radius: 3,
            fill: isCurrent ? "rgba(74,143,168,0.9)" : "rgba(74,143,168,0.35)",
            stroke: "transparent",
            selectable: false,
            evented: false,
            excludeFromExport: true,
          });
          (dot as any).isPathPreview = true;
          canvas.add(dot);

          // Frame number label
          const label = new fabric.FabricText(String(kf.frame), {
            left: vals.left + 5,
            top: vals.top - 10,
            fontSize: 8,
            fill: isCurrent ? "rgba(74,143,168,0.9)" : "rgba(74,143,168,0.5)",
            selectable: false,
            evented: false,
            excludeFromExport: true,
          });
          (label as any).isPathPreview = true;
          canvas.add(label);
        });
      });

      canvas.requestRenderAll();
    },
    [animProject, pathPreview, selectedTrackId]
  );

  // ─── Render frame ─────────────────────────────────────────────────────────

  const renderFrame = useCallback(
    (frame: number) => {
      if (!animProject || !fabricCanvasRef.current) return;
      const canvas = fabricCanvasRef.current;

      // Clear overlays first
      clearOverlays();

      // Collect rigged part IDs for FK override
      const riggedPartIds = new Set<string>();
      for (const rig of rigsRef.current) {
        for (const pid of rig.partIds) riggedPartIds.add(pid);
      }

      animProject.tracks.forEach((track) => {
        const obj = objectMapRef.current.get(track.objectId);
        if (!obj) return;

        const values = getInterpolatedValues(track, frame);
        for (const [prop, val] of Object.entries(values)) {
          if (val !== undefined) {
            (obj as any).set(prop, val);
          }
        }
        obj.setCoords();
      });

      // Apply FK for rigged objects — override positions based on bone hierarchy
      for (const rig of rigsRef.current) {
        // Collect local rotations from each anchor's attached part's interpolated angle
        const localRotations = new Map<string, number>();
        for (const anchor of rig.anchors) {
          if (!anchor.attachedPartId) continue;
          const obj = objectMapRef.current.get(anchor.attachedPartId);
          if (obj) {
            localRotations.set(anchor.id, (obj as any).angle ?? 0);
          }
        }

        const fkResults = solveFK(rig.anchors, localRotations, rig.originX, rig.originY);
        applyFKToObjects(rig, fkResults, objectMapRef.current);
      }

      canvas.requestRenderAll();

      // Render overlays when not playing
      if (!playingRef.current) {
        if (onionSkinning) renderOnionSkins(frame);
        if (pathPreview) renderPathPreviews(frame);
      }
    },
    [animProject, clearOverlays, renderOnionSkins, renderPathPreviews, onionSkinning, pathPreview]
  );

  useEffect(() => {
    if (!playing) renderFrame(currentFrame);
  }, [currentFrame, renderFrame, playing]);

  // Re-render overlays when toggling
  useEffect(() => {
    if (!playing) renderFrame(currentFrame);
  }, [onionSkinning, onionFrameCount, pathPreview, selectedTrackId]);

  // ─── Audio helpers ────────────────────────────────────────────────────────

  const startAudioAtFrame = useCallback((frame: number) => {
    if (!audioBuffer || audioMuted) return;
    const fps = animProject?.fps ?? 30;
    const offset = frame / fps;
    if (offset >= audioBuffer.duration) return;

    // Stop any existing source
    try { audioSourceRef.current?.stop(); } catch { /* ignore */ }

    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;

    const gain = ctx.createGain();
    gain.gain.value = audioVolume;
    gain.connect(ctx.destination);
    audioGainRef.current = gain;

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gain);
    source.start(0, offset);
    audioSourceRef.current = source;
  }, [audioBuffer, audioMuted, audioVolume, animProject]);

  const stopAudio = useCallback(() => {
    try { audioSourceRef.current?.stop(); } catch { /* ignore */ }
    audioSourceRef.current = null;
  }, []);

  const importAudio = useCallback(async (file: File) => {
    try {
      const buffer = await decodeAudioFile(file);
      setAudioBuffer(buffer);
      toast.success(`Audio loaded: ${file.name}`);
    } catch (err) {
      console.error("Failed to decode audio:", err);
      toast.error("Failed to decode audio file");
    }
  }, []);

  const removeAudio = useCallback(() => {
    stopAudio();
    setAudioBuffer(null);
    toast.info("Audio removed");
  }, [stopAudio]);

  // Keep gain in sync with volume/mute
  useEffect(() => {
    if (audioGainRef.current) {
      audioGainRef.current.gain.value = audioMuted ? 0 : audioVolume;
    }
  }, [audioMuted, audioVolume]);

  // ─── Playback ─────────────────────────────────────────────────────────────

  const startPlayback = useCallback(() => {
    if (!animProject) return;
    playingRef.current = true;
    setPlaying(true);
    startAudioAtFrame(frameRef.current);

    const startTime = performance.now();
    const startFrame = frameRef.current;
    const totalFrames = animProject.totalFrames;

    const tick = () => {
      if (!playingRef.current) return;

      // Determine effective range (respects in/out points)
      const rangeStart = inPointRef.current;
      const rangeEnd = outPointRef.current >= 0 ? Math.min(outPointRef.current, totalFrames - 1) : totalFrames - 1;
      const rangeLength = rangeEnd - rangeStart + 1;

      const elapsed = performance.now() - startTime;
      const rawFrame = startFrame + Math.floor((elapsed / 1000) * animProject.fps * playbackSpeedRef.current);
      const mode = playbackModeRef.current;

      let frame: number;

      if (rangeLength <= 1) {
        // No meaningful range
        frame = rangeStart;
      } else if (mode === "once") {
        frame = rawFrame;
        if (frame > rangeEnd) {
          frameRef.current = rangeEnd;
          setCurrentFrame(rangeEnd);
          renderFrame(rangeEnd);
          playingRef.current = false;
          setPlaying(false);
          return;
        }
      } else if (mode === "loop") {
        const offset = (rawFrame - rangeStart) % rangeLength;
        frame = rangeStart + ((offset % rangeLength) + rangeLength) % rangeLength;
      } else {
        // ping-pong
        const cycle = (rangeLength - 1) * 2;
        const pos = Math.abs((rawFrame - rangeStart) % (cycle || 1));
        frame = pos < rangeLength ? rangeStart + pos : rangeStart + cycle - pos;
      }

      frame = Math.max(rangeStart, Math.min(rangeEnd, frame));
      frameRef.current = frame;
      setCurrentFrame(frame);
      renderFrame(frame);
      animationFrameId.current = requestAnimationFrame(tick);
    };

    animationFrameId.current = requestAnimationFrame(tick);
  }, [animProject, renderFrame, startAudioAtFrame]);

  const stopPlayback = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    stopAudio();
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
  }, [stopAudio]);

  const togglePlayback = useCallback(() => {
    if (playing) stopPlayback();
    else startPlayback();
  }, [playing, startPlayback, stopPlayback]);

  const goToFrame = useCallback((frame: number) => {
    setCurrentFrame(frame);
    frameRef.current = frame;
  }, []);

  const stepFrame = useCallback(
    (delta: number) => {
      setCurrentFrame((f) => {
        if (!animProject) return f;
        const next = Math.max(0, Math.min(animProject.totalFrames - 1, f + delta));
        frameRef.current = next;
        return next;
      });
    },
    [animProject]
  );

  // ─── Save ─────────────────────────────────────────────────────────────────

  const saveAnimation = useCallback(async () => {
    if (!animProject) return;
    try {
      const savedId = await persistSaveAnimation(
        animProject,
        userId,
        sourceProject?.canvas_width,
        sourceProject?.canvas_height
      );
      setAnimProject((prev) => (prev ? { ...prev, id: savedId } : prev));
      setHasUnsavedChanges(false);
      toast.success("Animation saved");
    } catch {
      toast.error("Failed to save animation");
    }
  }, [animProject, userId, sourceProject]);

  // ─── Auto-save (every 30s when there are unsaved changes) ──────────────────

  useEffect(() => {
    const interval = setInterval(() => {
      if (hasUnsavedChanges && animProject) {
        persistSaveAnimation(
          animProject,
          userId,
          sourceProject?.canvas_width,
          sourceProject?.canvas_height
        ).then((savedId) => {
          setAnimProject((prev) => (prev ? { ...prev, id: savedId } : prev));
          setHasUnsavedChanges(false);
          setLastSavedAt(new Date().toISOString());
        }).catch(() => {
          // Silent fail for auto-save; user can still manually save
        });
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [hasUnsavedChanges, animProject, userId, sourceProject]);

  // ─── Playback range helpers ─────────────────────────────────────────────

  const hasPlaybackRange = inPoint > 0 || outPoint >= 0;

  const clearPlaybackRange = useCallback(() => {
    setInPoint(0);
    setOutPoint(-1);
    inPointRef.current = 0;
    outPointRef.current = -1;
  }, []);

  // ─── Timeline markers ──────────────────────────────────────────────────

  const addMarker = useCallback((frame: number, label?: string) => {
    setMarkers((prev) => {
      if (prev.some((m) => m.frame === frame)) return prev;
      return [...prev, { frame, label: label || `Marker ${prev.length + 1}` }].sort((a, b) => a.frame - b.frame);
    });
  }, []);

  const removeMarker = useCallback((frame: number) => {
    setMarkers((prev) => prev.filter((m) => m.frame !== frame));
  }, []);

  const renameMarker = useCallback((frame: number, label: string) => {
    setMarkers((prev) => prev.map((m) => m.frame === frame ? { ...m, label } : m));
  }, []);

  const updateMarkerColor = useCallback((frame: number, color: string) => {
    setMarkers((prev) => prev.map((m) => m.frame === frame ? { ...m, color } : m));
  }, []);

  // ─── Duplicate keyframes ───────────────────────────────────────────────

  const duplicateSelectedKeyframes = useCallback((offsetFrames = 5) => {
    if (!animProject || selectedKeyframes.length === 0) return;

    commitAnimProject((prev) => {
      const tracks = [...prev.tracks];
      for (const sel of selectedKeyframes) {
        const trackIndex = tracks.findIndex((t) => t.objectId === sel.trackId);
        if (trackIndex === -1) continue;
        const track = tracks[trackIndex];
        const srcKf = track.keyframes.find((kf) => kf.frame === sel.frame);
        if (!srcKf) continue;
        const newFrame = Math.min(prev.totalFrames - 1, srcKf.frame + offsetFrames);
        const newKf: Keyframe = {
          frame: newFrame,
          properties: { ...srcKf.properties },
          easing: srcKf.easing,
          propertyEasings: srcKf.propertyEasings ? { ...srcKf.propertyEasings } : undefined,
        };
        tracks[trackIndex] = upsertKeyframe(tracks[trackIndex], newKf);
      }
      return { ...prev, tracks };
    });

    toast.success(`Duplicated ${selectedKeyframes.length} keyframe(s)`);
  }, [animProject, selectedKeyframes, commitAnimProject]);

  // ─── Canvas resize ──────────────────────────────────────────────────────

  const resizeCanvas = useCallback(
    (newWidth: number, newHeight: number) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas || !sourceProject || !animProject) return;

      const oldW = sourceProject.canvas_width;
      const oldH = sourceProject.canvas_height;
      if (newWidth === oldW && newHeight === oldH) return;

      const scaleX = newWidth / oldW;
      const scaleY = newHeight / oldH;

      // 1. Scale all Fabric objects on canvas
      const objects = canvas.getObjects();
      objects.forEach((obj: any) => {
        if (obj.isOnionSkin || obj.isPathPreview) return;

        const origLeft = obj.left ?? 0;
        const origTop = obj.top ?? 0;
        const origScaleX = obj.scaleX ?? 1;
        const origScaleY = obj.scaleY ?? 1;

        obj.set({
          left: origLeft * scaleX,
          top: origTop * scaleY,
          scaleX: origScaleX * scaleX,
          scaleY: origScaleY * scaleY,
        });
        obj.setCoords();
      });

      // 2. Update Fabric canvas dimensions
      canvas.setDimensions({ width: newWidth, height: newHeight });
      canvas.setZoom(1);
      canvas.requestRenderAll();

      // 3. Scale all keyframe position/scale values proportionally
      commitAnimProject((prev) => {
        const tracks = prev.tracks.map((track) => ({
          ...track,
          keyframes: track.keyframes.map((kf) => {
            const props = { ...kf.properties };
            if (props.left !== undefined) props.left = props.left * scaleX;
            if (props.top !== undefined) props.top = props.top * scaleY;
            if (props.scaleX !== undefined) props.scaleX = props.scaleX * scaleX;
            if (props.scaleY !== undefined) props.scaleY = props.scaleY * scaleY;
            return { ...kf, properties: props };
          }),
        }));
        return { ...prev, tracks };
      });

      // 4. Update source project dimensions
      setSourceProject((prev) =>
        prev ? { ...prev, canvas_width: newWidth, canvas_height: newHeight } : prev
      );

      toast.success(`Canvas resized to ${newWidth} × ${newHeight}`);
    },
    [sourceProject, animProject, fabricCanvasRef, commitAnimProject]
  );

  // ─── Canvas background color ────────────────────────────────────────────

  const [canvasBgColor, setCanvasBgColorState] = useState("#ffffff");

  const setCanvasBgColor = useCallback(
    (color: string) => {
      setCanvasBgColorState(color);
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      canvas.backgroundColor = color === "transparent" ? "" : color;
      canvas.requestRenderAll();
      setHasUnsavedChanges(true);
    },
    [fabricCanvasRef]
  );

  // ─── Update object property from properties panel ─────────────────────────

  const updateObjectProperty = useCallback(
    (property: keyof AnimatableProps, value: number | string) => {
      if (!animProject || !selectedTrackId) return;

      const canvas = fabricCanvasRef.current;
      const obj = objectMapRef.current.get(selectedTrackId);
      if (!obj || !canvas) return;

      // Update the Fabric object directly
      obj.set(property as string, value);
      obj.setCoords();
      canvas.requestRenderAll();

      // Determine whether to upsert a keyframe
      const track = animProject.tracks.find((t) => t.objectId === selectedTrackId);
      if (!track) return;

      const hasKeyframeAtCurrentFrame = track.keyframes.some(
        (kf) => kf.frame === currentFrame
      );

      if (autoKey || hasKeyframeAtCurrentFrame) {
        const props = captureObjectProps(obj);
        const newKf: Keyframe = {
          frame: currentFrame,
          properties: props,
          easing: "easeInOut" as EasingType,
        };

        commitAnimProject((prev) => {
          const trackIndex = prev.tracks.findIndex(
            (t) => t.objectId === selectedTrackId
          );
          if (trackIndex === -1) return prev;
          const tracks = [...prev.tracks];
          tracks[trackIndex] = upsertKeyframe(tracks[trackIndex], newKf);
          return { ...prev, tracks };
        });
      }
    },
    [animProject, selectedTrackId, currentFrame, autoKey, commitAnimProject]
  );

  // ─── Keyframe operations ──────────────────────────────────────────────────

  const addKeyframeAtCurrentFrame = useCallback(() => {
    if (!animProject || !selectedTrackId) return;

    const trackIndex = animProject.tracks.findIndex(
      (t) => t.objectId === selectedTrackId
    );
    if (trackIndex === -1) return;

    const obj = objectMapRef.current.get(selectedTrackId);
    if (!obj) return;

    const newKeyframe: Keyframe = {
      frame: currentFrame,
      properties: captureObjectProps(obj),
      easing: "easeInOut" as EasingType,
    };

    commitAnimProject((prev) => {
      const tracks = [...prev.tracks];
      tracks[trackIndex] = upsertKeyframe(tracks[trackIndex], newKeyframe);
      return { ...prev, tracks };
    });

    toast.success(`Keyframe added at frame ${currentFrame}`);
  }, [animProject, selectedTrackId, currentFrame, commitAnimProject]);

  const handleDeleteKeyframe = useCallback(
    (trackId: string, keyframeIndex: number) => {
      commitAnimProject((prev) => {
        const tracks = prev.tracks.map((track) =>
          track.objectId === trackId
            ? engineDeleteKeyframe(track, keyframeIndex)
            : track
        );
        return { ...prev, tracks };
      });
    },
    [commitAnimProject]
  );

  const handleEasingChange = useCallback(
    (trackId: string, keyframeIndex: number, easing: EasingType) => {
      commitAnimProject((prev) => {
        const tracks = prev.tracks.map((track) =>
          track.objectId === trackId
            ? updateKeyframeEasing(track, keyframeIndex, easing)
            : track
        );
        return { ...prev, tracks };
      });
    },
    [commitAnimProject]
  );

  const updateKeyframeCustomBezier = useCallback(
    (trackId: string, keyframeIndex: number, bezier: [number, number, number, number]) => {
      commitAnimProject((prev) => {
        const tracks = prev.tracks.map((track) => {
          if (track.objectId !== trackId) return track;
          const newKeyframes = [...track.keyframes];
          newKeyframes[keyframeIndex] = {
            ...newKeyframes[keyframeIndex],
            customBezier: bezier,
          };
          return { ...track, keyframes: newKeyframes };
        });
        return { ...prev, tracks };
      });
    },
    [commitAnimProject]
  );

  const toggleTrackVisibility = useCallback(
    (trackId: string) => {
      commitAnimProject((prev) => ({
        ...prev,
        tracks: prev.tracks.map((t) =>
          t.objectId === trackId ? { ...t, visible: !t.visible } : t
        ),
      }));
    },
    [commitAnimProject]
  );

  const toggleTrackLock = useCallback(
    (trackId: string) => {
      commitAnimProject((prev) => ({
        ...prev,
        tracks: prev.tracks.map((t) =>
          t.objectId === trackId ? { ...t, locked: !t.locked } : t
        ),
      }));
    },
    [commitAnimProject]
  );

  // ─── Object Management ────────────────────────────────────────────────────

  const removeObject = useCallback(
    (trackId: string) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      // Remove from canvas
      const obj = objectMapRef.current.get(trackId);
      if (obj) {
        canvas.remove(obj);
        canvas.requestRenderAll();
      }

      // Remove from objectMap
      objectMapRef.current.delete(trackId);

      // Remove track from animProject
      commitAnimProject((prev) => ({
        ...prev,
        tracks: prev.tracks.filter((t) => t.objectId !== trackId),
      }));

      // Clear selection if this was selected
      if (selectedTrackId === trackId) {
        setSelectedTrackId(null);
      }

      toast.success("Object removed");
    },
    [fabricCanvasRef, objectMapRef, commitAnimProject, selectedTrackId]
  );

  const reorderObject = useCallback(
    (trackId: string, direction: "up" | "down") => {
      const canvas = fabricCanvasRef.current;
      if (!canvas || !animProject) return;

      const obj = objectMapRef.current.get(trackId);
      if (!obj) return;

      if (direction === "up") {
        canvas.bringObjectForward(obj);
      } else {
        canvas.sendObjectBackwards(obj);
      }
      canvas.requestRenderAll();

      // Reorder tracks
      commitAnimProject((prev) => {
        const tracks = [...prev.tracks];
        const idx = tracks.findIndex((t) => t.objectId === trackId);
        if (idx < 0) return prev;
        const swapIdx = direction === "up" ? idx + 1 : idx - 1;
        if (swapIdx < 0 || swapIdx >= tracks.length) return prev;
        [tracks[idx], tracks[swapIdx]] = [tracks[swapIdx], tracks[idx]];
        return { ...prev, tracks };
      });
    },
    [fabricCanvasRef, animProject, objectMapRef, commitAnimProject]
  );

  const reorderTracksByIds = useCallback(
    (fromId: string, toId: string) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas || !animProject) return;

      commitAnimProject((prev) => {
        const tracks = [...prev.tracks];
        const oldIndex = tracks.findIndex((t) => t.objectId === fromId);
        const newIndex = tracks.findIndex((t) => t.objectId === toId);
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return prev;
        const [moved] = tracks.splice(oldIndex, 1);
        tracks.splice(newIndex, 0, moved);
        return { ...prev, tracks };
      });

      // Sync Fabric z-order after state update
      setTimeout(() => {
        if (!animProject) return;
        animProject.tracks.forEach((track, idx) => {
          const obj = objectMapRef.current.get(track.objectId);
          if (obj) canvas.moveTo(obj, idx);
        });
        canvas.requestRenderAll();
      }, 0);
    },
    [fabricCanvasRef, animProject, objectMapRef, commitAnimProject]
  );

  const addObjectToCanvas = useCallback(
    async (svgData: string, iconName?: string) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas || !animProject) return;

      const { objects, options } = await fabric.loadSVGFromString(svgData);
      if (!objects || objects.length === 0) return;

      const group = fabric.util.groupSVGElements(objects, options);

      const id = `icon_${Date.now()}`;
      (group as any).id = id;
      (group as any).name = iconName || "Imported Icon";

      group.scaleToWidth(Math.min(100, canvas.width! / 4));
      group.set({
        left: (canvas.width! / canvas.getZoom()) / 2,
        top: (canvas.height! / canvas.getZoom()) / 2,
        originX: 'center',
        originY: 'center',
      });

      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.requestRenderAll();

      objectMapRef.current.set(id, group);

      const track = createTrackFromObject(group, animProject.tracks.length);
      commitAnimProject((prev) => ({
        ...prev,
        tracks: [...prev.tracks, track],
      }));

      setSelectedTrackId(id);
      toast.success(`Added: ${iconName || "Icon"}`);
    },
    [fabricCanvasRef, animProject, objectMapRef, commitAnimProject]
  );

  // ─── Add generic Fabric object ─────────────────────────────────────────────

  const addFabricObject = useCallback(
    (obj: fabric.FabricObject, name?: string) => {
      const canvas = fabricCanvasRef.current;
      const proj = animProjectRef.current;
      if (!canvas || !proj) return;

      const id = `obj_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      (obj as any).id = id;
      (obj as any).name = name || obj.type || "Object";

      canvas.add(obj);
      canvas.setActiveObject(obj);
      canvas.requestRenderAll();

      objectMapRef.current.set(id, obj);

      const track = createTrackFromObject(obj, proj.tracks.length);
      commitAnimProject((prev) => ({
        ...prev,
        tracks: [...prev.tracks, track],
      }));

      setSelectedTrackId(id);
    },
    [fabricCanvasRef, objectMapRef, commitAnimProject]
  );

  // ─── Register existing Fabric object (already on canvas, e.g. freehand) ───

  const registerExistingObject = useCallback(
    (obj: fabric.FabricObject, name?: string) => {
      const proj = animProjectRef.current;
      if (!proj) return;

      const id = (obj as any).id || `obj_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      if (!(obj as any).id) (obj as any).id = id;
      if (!(obj as any).name) (obj as any).name = name || obj.type || "Object";

      objectMapRef.current.set(id, obj);

      const track = createTrackFromObject(obj, proj.tracks.length);
      commitAnimProject((prev) => ({
        ...prev,
        tracks: [...prev.tracks, track],
      }));

      setSelectedTrackId(id);
    },
    [objectMapRef, commitAnimProject]
  );

  // ─── Apply keyframes to a track (batch insert/update) ──────────────────────

  const applyKeyframesToTrack = useCallback(
    (trackId: string, keyframes: Keyframe[]) => {
      commitAnimProject((prev) => {
        const tracks = prev.tracks.map((t) => {
          if (t.objectId !== trackId) return t;
          let updated = { ...t, keyframes: [...t.keyframes] };
          for (const kf of keyframes) {
            updated = upsertKeyframe(updated, kf);
          }
          return updated;
        });
        return { ...prev, tracks };
      });
    },
    [commitAnimProject]
  );

  // ─── Insert Motion Graphic (batch creation) ────────────────────────────────

  const insertMotionGraphic = useCallback(
    (defId: string, position?: { x: number; y: number }) => {
      const canvas = fabricCanvasRef.current;
      const proj = animProjectRef.current;
      if (!canvas || !proj) {
        toast.error("No canvas or project available");
        return;
      }

      const def = MOTION_GRAPHICS.find((m) => m.id === defId);
      if (!def) {
        toast.error("Motion graphic not found");
        return;
      }

      // Default insertion at canvas center
      const cx = position?.x ?? (sourceProject?.canvas_width ?? 800) / 2;
      const cy = position?.y ?? (sourceProject?.canvas_height ?? 600) / 2;
      const fpsScale = (proj.fps || 30) / 30;
      const startFrame = frameRef.current;

      // Build a mapping from localId → generated objectId + Fabric object
      const idMap = new Map<string, { objectId: string; obj: fabric.FabricObject }>();

      for (const objDef of def.objects) {
        const objectId = `obj_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        let obj: fabric.FabricObject;

        const left = cx + objDef.relativeLeft;
        const top = cy + objDef.relativeTop;
        const props = { ...objDef.fabricProps, left, top };

        switch (objDef.type) {
          case "rect":
            obj = new fabric.Rect(props);
            break;
          case "circle":
            obj = new fabric.Circle(props);
            break;
          case "triangle":
            obj = new fabric.Triangle(props);
            break;
          case "textbox":
            obj = new fabric.Textbox(props.text || "Text", {
              ...props,
              text: undefined,
            });
            break;
          case "line":
            obj = new fabric.Line([0, 0, props.width || 100, 0], {
              ...props,
              width: undefined,
            });
            break;
          case "polygon": {
            const points = props.points || [
              { x: 0, y: 0 },
              { x: 50, y: 0 },
              { x: 25, y: 43 },
            ];
            obj = new fabric.Polygon(points, { ...props, points: undefined });
            break;
          }
          case "path":
            obj = new fabric.Path(props.path || "M 0 0 L 100 0", {
              ...props,
              path: undefined,
            });
            break;
          default:
            obj = new fabric.Rect(props);
        }

        (obj as any).id = objectId;
        (obj as any).name = objDef.name;

        canvas.add(obj);
        objectMapRef.current.set(objectId, obj);
        idMap.set(objDef.localId, { objectId, obj });
      }

      canvas.requestRenderAll();

      // Build all new tracks + keyframes in a single commit
      const groupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

      commitAnimProject((prev) => {
        const newTracks: AnimationTrack[] = [];

        for (const objDef of def.objects) {
          const entry = idMap.get(objDef.localId);
          if (!entry) continue;

          // Create the track
          const track: AnimationTrack = {
            objectId: entry.objectId,
            objectName: objDef.name,
            objectType: objDef.type,
            visible: true,
            locked: false,
            keyframes: [
              {
                frame: 0,
                properties: captureObjectProps(entry.obj),
                easing: "linear" as EasingType,
              },
            ],
            groupId,
          };

          // Find matching track keyframes from the definition and merge
          const trackDef = def.tracks.find(
            (t) => t.objectRef === objDef.localId
          );
          if (trackDef) {
            const kfs = buildKeyframes(trackDef, startFrame, fpsScale);
            let updated = track;
            for (const kf of kfs) {
              // Adjust relative position properties to absolute
              const adjustedProps = { ...kf.properties };
              if (adjustedProps.left !== undefined) {
                adjustedProps.left = cx + objDef.relativeLeft + adjustedProps.left;
              }
              if (adjustedProps.top !== undefined) {
                adjustedProps.top = cy + objDef.relativeTop + adjustedProps.top;
              }
              updated = upsertKeyframe(updated, {
                ...kf,
                properties: adjustedProps,
              });
            }
            newTracks.push(updated);
          } else {
            newTracks.push(track);
          }
        }

        const newGroup = {
          id: groupId,
          name: def.groupName,
          collapsed: false,
        };

        return {
          ...prev,
          tracks: [...prev.tracks, ...newTracks],
          trackGroups: [...(prev.trackGroups ?? []), newGroup],
        };
      });

      // Select the first new object
      const firstEntry = idMap.get(def.objects[0]?.localId);
      if (firstEntry) {
        setSelectedTrackId(firstEntry.objectId);
        canvas.setActiveObject(firstEntry.obj);
        canvas.requestRenderAll();
      }

      toast.success(`Inserted "${def.name}" (${def.objects.length} objects)`);
    },
    [fabricCanvasRef, objectMapRef, commitAnimProject, sourceProject]
  );

  // ─── Skeletal Rig Functions ─────────────────────────────────────────────────

  const updateRigs = useCallback((updater: (prev: RigData[]) => RigData[]) => {
    setRigs((prev) => {
      const next = updater(prev);
      rigsRef.current = next;
      return next;
    });
  }, []);

  const decomposeSVGForRig = useCallback(
    (objectId: string) => {
      const canvas = fabricCanvasRef.current;
      const proj = animProjectRef.current;
      if (!canvas || !proj) return;

      const obj = objectMapRef.current.get(objectId);
      if (!obj) {
        toast.error("Object not found");
        return;
      }

      // Check if it's a group (SVG icons are loaded as groups)
      const isGroup = obj.type === "group" || (obj as any)._objects?.length > 0;
      if (!isGroup) {
        toast.error("Select an SVG icon (group) to decompose");
        return;
      }

      const group = obj as fabric.Group;
      const children = group.getObjects().slice();

      if (children.length < 2) {
        toast.error("SVG has only one part — nothing to decompose");
        return;
      }

      // Capture group's world transform
      const groupLeft = group.left ?? 0;
      const groupTop = group.top ?? 0;
      const groupScaleX = group.scaleX ?? 1;
      const groupScaleY = group.scaleY ?? 1;
      const groupAngle = group.angle ?? 0;

      // Remove the group from canvas
      canvas.remove(group);
      objectMapRef.current.delete(objectId);

      // Remove the group's track
      commitAnimProject((prev) => ({
        ...prev,
        tracks: prev.tracks.filter((t) => t.objectId !== objectId),
      }));

      // Add each child as an independent object
      const partIds: string[] = [];
      const partInfos: { id: string; left: number; top: number; width: number; height: number; name: string }[] = [];
      const groupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

      for (let i = 0; i < children.length; i++) {
        const child = children[i];

        // Calculate world transform for the child
        // In Fabric.js, group children have coords relative to group center
        const childLeft = (child.left ?? 0) * groupScaleX;
        const childTop = (child.top ?? 0) * groupScaleY;

        // Rotate child offset by group angle
        const rad = (groupAngle * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const worldLeft = groupLeft + childLeft * cos - childTop * sin;
        const worldTop = groupTop + childLeft * sin + childTop * cos;

        child.set({
          left: worldLeft,
          top: worldTop,
          scaleX: (child.scaleX ?? 1) * groupScaleX,
          scaleY: (child.scaleY ?? 1) * groupScaleY,
          angle: (child.angle ?? 0) + groupAngle,
          originX: "center",
          originY: "center",
        });

        const id = `part_${Date.now()}_${Math.random().toString(36).slice(2, 5)}_${i}`;
        (child as any).id = id;
        const partName = (child as any).name || `Part ${i + 1}`;
        (child as any).name = partName;

        canvas.add(child);
        objectMapRef.current.set(id, child);
        partIds.push(id);

        partInfos.push({
          id,
          left: worldLeft,
          top: worldTop,
          width: (child.width ?? 10) * (child.scaleX ?? 1),
          height: (child.height ?? 10) * (child.scaleY ?? 1),
          name: partName,
        });
      }

      canvas.requestRenderAll();

      // Create tracks for all parts in a single commit
      commitAnimProject((prev) => {
        const newTracks: AnimationTrack[] = partIds.map((pid, idx) => {
          const child = objectMapRef.current.get(pid);
          return {
            objectId: pid,
            objectName: (child as any)?.name || `Part ${idx + 1}`,
            objectType: child?.type || "path",
            visible: true,
            locked: false,
            keyframes: [
              {
                frame: 0,
                properties: child ? captureObjectProps(child) : {},
                easing: "linear" as EasingType,
              },
            ],
            groupId,
          };
        });

        const newGroup = {
          id: groupId,
          name: "Rig Parts",
          collapsed: false,
        };

        return {
          ...prev,
          tracks: [...prev.tracks, ...newTracks],
          trackGroups: [...(prev.trackGroups ?? []), newGroup],
        };
      });

      // Auto-generate anchors from part positions
      const anchors = autoGenerateAnchors(partInfos, groupLeft, groupTop);

      const rig: RigData = {
        id: generateRigId(),
        sourceObjectId: objectId,
        originX: groupLeft,
        originY: groupTop,
        anchors,
        partIds,
      };

      updateRigs((prev) => [...prev, rig]);

      if (partIds.length > 0) {
        setSelectedTrackId(partIds[0]);
      }

      toast.success(
        `Decomposed into ${children.length} parts with ${anchors.length} joints`
      );
    },
    [fabricCanvasRef, objectMapRef, commitAnimProject, updateRigs]
  );

  const addAnchorToRig = useCallback(
    (rigId: string, x: number, y: number, name?: string) => {
      const rig = rigsRef.current.find((r) => r.id === rigId);
      if (!rig) return;

      const anchor: AnchorPoint = {
        id: generateAnchorId(),
        name: name || `Joint ${rig.anchors.length + 1}`,
        x: x - rig.originX,
        y: y - rig.originY,
        parentId: rig.anchors.length > 0 ? rig.anchors[0].id : null,
        attachedPartId: null,
      };

      updateRigs((prev) =>
        prev.map((r) =>
          r.id === rigId ? { ...r, anchors: [...r.anchors, anchor] } : r
        )
      );
    },
    [updateRigs]
  );

  const removeAnchorFromRig = useCallback(
    (rigId: string, anchorId: string) => {
      updateRigs((prev) =>
        prev.map((r) => {
          if (r.id !== rigId) return r;
          // Remove the anchor and reparent its children to its parent
          const anchor = r.anchors.find((a) => a.id === anchorId);
          if (!anchor) return r;
          return {
            ...r,
            anchors: r.anchors
              .filter((a) => a.id !== anchorId)
              .map((a) =>
                a.parentId === anchorId
                  ? { ...a, parentId: anchor.parentId }
                  : a
              ),
          };
        })
      );
    },
    [updateRigs]
  );

  const setAnchorParent = useCallback(
    (rigId: string, anchorId: string, parentId: string | null) => {
      updateRigs((prev) =>
        prev.map((r) => {
          if (r.id !== rigId) return r;
          // Prevent circular references
          if (parentId) {
            let current = parentId;
            const visited = new Set<string>();
            while (current) {
              if (current === anchorId) {
                toast.error("Cannot create circular bone chain");
                return r;
              }
              if (visited.has(current)) break;
              visited.add(current);
              const parent = r.anchors.find((a) => a.id === current);
              current = parent?.parentId ?? "";
            }
          }
          return {
            ...r,
            anchors: r.anchors.map((a) =>
              a.id === anchorId ? { ...a, parentId } : a
            ),
          };
        })
      );
    },
    [updateRigs]
  );

  const renameAnchor = useCallback(
    (rigId: string, anchorId: string, name: string) => {
      updateRigs((prev) =>
        prev.map((r) =>
          r.id === rigId
            ? {
                ...r,
                anchors: r.anchors.map((a) =>
                  a.id === anchorId ? { ...a, name } : a
                ),
              }
            : r
        )
      );
    },
    [updateRigs]
  );

  const removeRig = useCallback(
    (rigId: string) => {
      updateRigs((prev) => prev.filter((r) => r.id !== rigId));
      toast.success("Rig removed");
    },
    [updateRigs]
  );

  // ─── Track Groups ──────────────────────────────────────────────────────────

  const createTrackGroup = useCallback(
    (name: string, trackIds: string[]) => {
      const groupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      commitAnimProject((prev) => ({
        ...prev,
        trackGroups: [...(prev.trackGroups ?? []), { id: groupId, name, collapsed: false }],
        tracks: prev.tracks.map((t) =>
          trackIds.includes(t.objectId) ? { ...t, groupId } : t
        ),
      }));
      toast.success(`Created group "${name}"`);
    },
    [commitAnimProject]
  );

  const removeTrackGroup = useCallback(
    (groupId: string) => {
      commitAnimProject((prev) => ({
        ...prev,
        trackGroups: (prev.trackGroups ?? []).filter((g) => g.id !== groupId),
        tracks: prev.tracks.map((t) =>
          t.groupId === groupId ? { ...t, groupId: undefined } : t
        ),
      }));
    },
    [commitAnimProject]
  );

  const renameTrackGroup = useCallback(
    (groupId: string, name: string) => {
      commitAnimProject((prev) => ({
        ...prev,
        trackGroups: (prev.trackGroups ?? []).map((g) =>
          g.id === groupId ? { ...g, name } : g
        ),
      }));
    },
    [commitAnimProject]
  );

  const addTracksToGroup = useCallback(
    (groupId: string, trackIds: string[]) => {
      commitAnimProject((prev) => ({
        ...prev,
        tracks: prev.tracks.map((t) =>
          trackIds.includes(t.objectId) ? { ...t, groupId } : t
        ),
      }));
    },
    [commitAnimProject]
  );

  const removeTrackFromGroup = useCallback(
    (trackId: string) => {
      commitAnimProject((prev) => ({
        ...prev,
        tracks: prev.tracks.map((t) =>
          t.objectId === trackId ? { ...t, groupId: undefined } : t
        ),
      }));
    },
    [commitAnimProject]
  );

  const toggleGroupCollapsed = useCallback(
    (groupId: string) => {
      setAnimProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          trackGroups: (prev.trackGroups ?? []).map((g) =>
            g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
          ),
        };
      });
    },
    []
  );

  const applyKeyframesToGroup = useCallback(
    (groupId: string, keyframes: Keyframe[], staggerFrames = 0) => {
      commitAnimProject((prev) => {
        let trackIdx = 0;
        const tracks = prev.tracks.map((t) => {
          if (t.groupId !== groupId) return t;
          const offset = trackIdx * staggerFrames;
          trackIdx++;
          let updated = { ...t, keyframes: [...t.keyframes] };
          for (const kf of keyframes) {
            const offsetKf = { ...kf, frame: kf.frame + offset };
            updated = upsertKeyframe(updated, offsetKf);
          }
          return updated;
        });
        return { ...prev, tracks };
      });
    },
    [commitAnimProject]
  );

  // ─── Stagger Entrance (Annotation Sequencing) ─────────────────────────────

  const staggerEntranceForGroup = useCallback(
    (trackIds: string[], staggerFrames: number, startFrame: number = 0) => {
      commitAnimProject((prev) => {
        const tracks = prev.tracks.map((t) => {
          const idx = trackIds.indexOf(t.objectId);
          if (idx === -1) return t;
          const enterFrame = startFrame + idx * staggerFrames;
          let updated = { ...t, keyframes: [...t.keyframes] };
          // Add hidden keyframe (opacity 0) just before entrance
          if (enterFrame > 0) {
            updated = upsertKeyframe(updated, {
              frame: Math.max(0, enterFrame - 1),
              properties: { opacity: 0 },
              easing: "linear" as EasingType,
            });
          }
          // Start fade-in at enter frame
          updated = upsertKeyframe(updated, {
            frame: enterFrame,
            properties: { opacity: 0 },
            easing: "easeOut" as EasingType,
          });
          // Fully visible after fade duration
          updated = upsertKeyframe(updated, {
            frame: enterFrame + Math.min(staggerFrames, 10),
            properties: { opacity: 1 },
            easing: "easeOut" as EasingType,
          });
          return updated;
        });
        return { ...prev, tracks };
      });
      toast.success(`Staggered entrance for ${trackIds.length} objects`);
    },
    [commitAnimProject]
  );

  // ─── Apply Preset ──────────────────────────────────────────────────────────

  const applyPreset = useCallback(
    (presetId: string) => {
      if (!animProject || !selectedTrackId) return;
      const preset = getPresetById(presetId);
      if (!preset) return;

      const obj = objectMapRef.current.get(selectedTrackId);
      if (!obj) return;

      const currentProps = captureObjectProps(obj);
      const fps = animProject.fps;
      // Duration: 1 second or remaining frames, whichever is shorter
      const maxEnd = animProject.totalFrames - 1;
      const endFrame = Math.min(currentFrame + fps, maxEnd);

      const canvasWidth = sourceProject?.canvas_width ?? 1920;
      const canvasHeight = sourceProject?.canvas_height ?? 1080;

      const keyframes = preset.generate({
        currentProps,
        startFrame: currentFrame,
        endFrame,
        canvasWidth,
        canvasHeight,
      });

      commitAnimProject((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) =>
          track.objectId === selectedTrackId
            ? { ...track, keyframes }
            : track
        ),
      }));

      toast.success(`Applied: ${preset.name}`);
    },
    [animProject, selectedTrackId, currentFrame, sourceProject, commitAnimProject, objectMapRef]
  );

  const applyStaggeredPreset = useCallback(
    (presetId: string, trackIds: string[], staggerDelay: number, order: 'normal' | 'reverse' | 'center' = 'normal') => {
      if (!animProject) return;
      const preset = getPresetById(presetId);
      if (!preset) return;

      const tracks = animProject.tracks.filter(t => trackIds.includes(t.objectId));
      if (tracks.length === 0) return;

      const fps = animProject.fps;
      const canvasWidth = sourceProject?.canvas_width ?? 1920;
      const canvasHeight = sourceProject?.canvas_height ?? 1080;

      const staggeredKeyframes = generateStaggeredKeyframes(
        tracks,
        objectMapRef.current,
        {
          presetId,
          staggerDelay,
          order,
          startFrame: currentFrame,
          durationPerObject: fps, // 1 second per object
          canvasWidth,
          canvasHeight,
        },
      );

      commitAnimProject((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) => {
          const newKeyframes = staggeredKeyframes.get(track.objectId);
          return newKeyframes ? { ...track, keyframes: newKeyframes } : track;
        }),
      }));

      toast.success(`Applied staggered ${preset.name} to ${tracks.length} objects`);
    },
    [animProject, currentFrame, sourceProject, commitAnimProject, objectMapRef]
  );

  // ─── Path-follow ──────────────────────────────────────────────────────────

  /** Return list of path-type track IDs and names for the UI picker */
  const getPathTrackIds = useCallback((): { id: string; name: string }[] => {
    const proj = animProjectRef.current;
    if (!proj) return [];
    const results: { id: string; name: string }[] = [];
    for (const track of proj.tracks) {
      const obj = objectMapRef.current.get(track.objectId);
      if (obj && (obj as any).path && Array.isArray((obj as any).path)) {
        results.push({ id: track.objectId, name: track.objectName });
      }
    }
    return results;
  }, [objectMapRef]);

  const applyPathFollow = useCallback(
    (targetTrackId: string, pathTrackId: string, durationFrames: number = 60) => {
      const proj = animProjectRef.current;
      if (!proj) return;

      const pathObj = objectMapRef.current.get(pathTrackId);
      if (!pathObj || !(pathObj as any).path || !Array.isArray((pathObj as any).path)) {
        toast.error("Selected object is not a valid path");
        return;
      }

      const fabricPath = pathObj as fabric.Path;
      const pathData: any[] = (fabricPath as any).path;
      if (!pathData || pathData.length === 0) {
        toast.error("Path has no data");
        return;
      }

      // Extract endpoint from each path command
      const rawPoints: { x: number; y: number }[] = [];
      for (const cmd of pathData) {
        if (cmd.length >= 3) {
          rawPoints.push({ x: cmd[cmd.length - 2], y: cmd[cmd.length - 1] });
        }
      }

      if (rawPoints.length < 2) {
        toast.error("Path has too few points");
        return;
      }

      // Compute cumulative arc lengths
      const lengths: number[] = [0];
      for (let i = 1; i < rawPoints.length; i++) {
        const dx = rawPoints[i].x - rawPoints[i - 1].x;
        const dy = rawPoints[i].y - rawPoints[i - 1].y;
        lengths.push(lengths[i - 1] + Math.sqrt(dx * dx + dy * dy));
      }
      const totalLength = lengths[lengths.length - 1];
      if (totalLength === 0) {
        toast.error("Path has zero length");
        return;
      }

      // Sample evenly along arc length
      const numSamples = Math.max(2, Math.min(durationFrames, 60));
      const samples: { x: number; y: number }[] = [];
      for (let s = 0; s <= numSamples; s++) {
        const targetLen = (s / numSamples) * totalLength;
        let segIdx = 0;
        for (let i = 1; i < lengths.length; i++) {
          if (lengths[i] >= targetLen) {
            segIdx = i - 1;
            break;
          }
          segIdx = i - 1;
        }
        const segStart = lengths[segIdx];
        const segEnd = lengths[segIdx + 1] ?? segStart;
        const segLen = segEnd - segStart;
        const t = segLen > 0 ? (targetLen - segStart) / segLen : 0;
        const p0 = rawPoints[segIdx];
        const p1 = rawPoints[Math.min(segIdx + 1, rawPoints.length - 1)];
        samples.push({
          x: p0.x + (p1.x - p0.x) * t,
          y: p0.y + (p1.y - p0.y) * t,
        });
      }

      // Account for path object's own transform (position, scale)
      const pathLeft = fabricPath.left ?? 0;
      const pathTop = fabricPath.top ?? 0;
      const pathScaleX = fabricPath.scaleX ?? 1;
      const pathScaleY = fabricPath.scaleY ?? 1;
      // Path points are relative to the path's pathOffset (center of the path bounding box)
      const pathOffset = (fabricPath as any).pathOffset ?? { x: 0, y: 0 };

      const startFrame = currentFrame;

      commitAnimProject((prev) => {
        const tracks = prev.tracks.map((t) => {
          if (t.objectId !== targetTrackId) return t;
          let updated = { ...t, keyframes: [...t.keyframes] };

          for (let i = 0; i <= numSamples; i++) {
            const fraction = i / numSamples;
            const frame = startFrame + Math.round(fraction * durationFrames);
            if (frame >= prev.totalFrames) break;

            const pt = samples[i];
            // Transform path-local coordinates to canvas coordinates
            const canvasX = pathLeft + (pt.x - pathOffset.x) * pathScaleX;
            const canvasY = pathTop + (pt.y - pathOffset.y) * pathScaleY;

            updated = upsertKeyframe(updated, {
              frame,
              properties: {
                left: canvasX,
                top: canvasY,
              },
              easing: "linear" as EasingType,
            });
          }
          return updated;
        });
        return { ...prev, tracks };
      });
      toast.success("Applied path-follow animation");
    },
    [commitAnimProject, objectMapRef, currentFrame]
  );

  // ─── Camera animation ─────────────────────────────────────────────────

  const applyCameraMove = useCallback(
    (type: "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "pan-up" | "pan-down", durationFrames: number = 30) => {
      const proj = animProjectRef.current;
      if (!proj) {
        toast.error("No animation project loaded");
        return;
      }

      if (proj.tracks.length === 0) {
        toast.error("Add objects to the canvas first");
        return;
      }

      const frame = frameRef.current;
      const endFrame = Math.min(frame + durationFrames, proj.totalFrames - 1);
      if (endFrame <= frame) {
        toast.error("Not enough frames remaining for camera move");
        return;
      }

      const sp = sourceProject;
      const cx = (sp?.canvas_width ?? 800) / 2;
      const cy = (sp?.canvas_height ?? 600) / 2;

      const panAmount = Math.max(50, (sp?.canvas_width ?? 800) * 0.12);
      const panAmountY = Math.max(40, (sp?.canvas_height ?? 600) * 0.12);

      commitAnimProject((prev) => {
        let applied = 0;
        const tracks = prev.tracks.map((t) => {
          if (!t.visible) return t;
          const obj = objectMapRef.current.get(t.objectId);
          if (!obj) return t;

          const curLeft = obj.left ?? 0;
          const curTop = obj.top ?? 0;
          const curScaleX = obj.scaleX ?? 1;
          const curScaleY = obj.scaleY ?? 1;

          let endProps: Partial<AnimatableProps> = {};

          switch (type) {
            case "zoom-in":
              endProps = {
                scaleX: curScaleX * 1.5,
                scaleY: curScaleY * 1.5,
                left: cx + (curLeft - cx) * 1.5,
                top: cy + (curTop - cy) * 1.5,
              };
              break;
            case "zoom-out":
              endProps = {
                scaleX: curScaleX * 0.67,
                scaleY: curScaleY * 0.67,
                left: cx + (curLeft - cx) * 0.67,
                top: cy + (curTop - cy) * 0.67,
              };
              break;
            case "pan-left":
              endProps = { left: curLeft - panAmount };
              break;
            case "pan-right":
              endProps = { left: curLeft + panAmount };
              break;
            case "pan-up":
              endProps = { top: curTop - panAmountY };
              break;
            case "pan-down":
              endProps = { top: curTop + panAmountY };
              break;
          }

          applied++;
          let updated = { ...t, keyframes: [...t.keyframes] };
          updated = upsertKeyframe(updated, {
            frame,
            properties: { left: curLeft, top: curTop, scaleX: curScaleX, scaleY: curScaleY },
            easing: "easeInOut" as EasingType,
          });
          updated = upsertKeyframe(updated, {
            frame: endFrame,
            properties: endProps,
            easing: "easeInOut" as EasingType,
          });
          return updated;
        });

        if (applied === 0) {
          toast.error("No visible objects to apply camera move to");
          return prev;
        }

        return { ...prev, tracks };
      });

      const labels: Record<string, string> = {
        "zoom-in": "Zoom In",
        "zoom-out": "Zoom Out",
        "pan-left": "Pan Left",
        "pan-right": "Pan Right",
        "pan-up": "Pan Up",
        "pan-down": "Pan Down",
      };
      toast.success(`Camera: ${labels[type]}`);
    },
    [commitAnimProject, objectMapRef, sourceProject]
  );

  const moveKeyframe = useCallback(
    (trackId: string, keyframeIndex: number, newFrame: number) => {
      setAnimProject((prev) => {
        if (!prev) return prev;
        const raw = Math.max(0, Math.min(prev.totalFrames - 1, Math.round(newFrame)));
        const clamped = snapFrame(raw);
        const tracks = prev.tracks.map((track) => {
          if (track.objectId !== trackId) return track;
          const conflict = track.keyframes.some(
            (kf, i) => i !== keyframeIndex && kf.frame === clamped
          );
          if (conflict) return track;

          const newKeyframes = [...track.keyframes];
          newKeyframes[keyframeIndex] = { ...newKeyframes[keyframeIndex], frame: clamped };
          newKeyframes.sort((a, b) => a.frame - b.frame);
          return { ...track, keyframes: newKeyframes };
        });
        return { ...prev, tracks };
      });
      setHasUnsavedChanges(true);
    },
    [snapFrame]
  );

  const scaleTrackKeyframes = useCallback(
    (trackId: string, scaleFactor: number) => {
      setAnimProject((prev) => {
        if (!prev) return prev;
        const maxFrame = prev.totalFrames - 1;
        const tracks = prev.tracks.map((track) => {
          if (track.objectId !== trackId) return track;
          const scaled = track.keyframes.map((kf) => ({
            ...kf,
            frame: Math.max(0, Math.min(maxFrame, Math.round(kf.frame * scaleFactor))),
          }));
          // Sort and check for collisions — abort if any two land on the same frame
          scaled.sort((a, b) => a.frame - b.frame);
          const hasDuplicates = scaled.some(
            (kf, i) => i > 0 && kf.frame === scaled[i - 1].frame
          );
          if (hasDuplicates) return track;
          return { ...track, keyframes: scaled };
        });
        return { ...prev, tracks };
      });
      setHasUnsavedChanges(true);
    },
    []
  );

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Don't intercept keys while editing text on the Fabric canvas
      const canvas = fabricCanvasRef.current;
      if (canvas) {
        const activeObj = canvas.getActiveObject();
        if (activeObj && (activeObj as any).isEditing) return;
      }

      const modifier = e.ctrlKey || e.metaKey;

      if (modifier && e.key === "s") {
        e.preventDefault();
        saveAnimation();
        return;
      }

      if (modifier && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      if (modifier && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }

      if (modifier && e.key === "c") {
        if (selectedKeyframes.length > 0) {
          e.preventDefault();
          copySelectedKeyframes();
        }
        return;
      }

      if (modifier && e.key === "v" && e.shiftKey) {
        if (clipboard.length > 0 && selectedTrackId) {
          e.preventDefault();
          pasteKeyframesToTrack();
        }
        return;
      }

      if (modifier && e.key === "v") {
        if (clipboard.length > 0) {
          e.preventDefault();
          pasteKeyframes();
        }
        return;
      }

      if (modifier && e.key === "d") {
        if (selectedKeyframes.length > 0) {
          e.preventDefault();
          duplicateSelectedKeyframes();
        }
        return;
      }

      if (modifier && e.key === "a") {
        e.preventDefault();
        selectKeyframesAtFrame(currentFrame);
        return;
      }

      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlayback();
          break;
        case "k":
        case "K":
          e.preventDefault();
          addKeyframeAtCurrentFrame();
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          if (selectedKeyframes.length > 0) {
            deleteSelectedKeyframes();
          } else if (selectedTrackId !== null && _selectedKeyframeIndex !== null) {
            handleDeleteKeyframe(selectedTrackId, _selectedKeyframeIndex);
            _setSelectedKeyframeIndex(null);
          } else if (selectedTrackId !== null) {
            // Delete the selected object/track from canvas
            removeObject(selectedTrackId);
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.altKey && selectedKeyframes.length > 0) {
            moveSelectedKeyframes(e.shiftKey ? -10 : -1);
          } else {
            stepFrame(e.shiftKey ? -10 : -1);
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.altKey && selectedKeyframes.length > 0) {
            moveSelectedKeyframes(e.shiftKey ? 10 : 1);
          } else {
            stepFrame(e.shiftKey ? 10 : 1);
          }
          break;
        case "Home":
          e.preventDefault();
          goToFrame(0);
          break;
        case "End":
          e.preventDefault();
          if (animProject) goToFrame(animProject.totalFrames - 1);
          break;
        case "i":
        case "I":
          e.preventDefault();
          setInPoint(currentFrame);
          inPointRef.current = currentFrame;
          toast.success(`In point set at frame ${currentFrame}`);
          break;
        case "o":
        case "O":
          e.preventDefault();
          setOutPoint(currentFrame);
          outPointRef.current = currentFrame;
          toast.success(`Out point set at frame ${currentFrame}`);
          break;
        case "m":
        case "M":
          e.preventDefault();
          addMarker(currentFrame);
          toast.success(`Marker added at frame ${currentFrame}`);
          break;
        case "?":
          e.preventDefault();
          setShortcutsVisible((v) => !v);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    togglePlayback, addKeyframeAtCurrentFrame, saveAnimation,
    handleDeleteKeyframe, removeObject, selectedTrackId, _selectedKeyframeIndex,
    animProject, stepFrame, goToFrame, undo, redo,
    selectedKeyframes, deleteSelectedKeyframes, moveSelectedKeyframes,
    copySelectedKeyframes, pasteKeyframes, pasteKeyframesToTrack, clipboard,
    duplicateSelectedKeyframes, currentFrame, addMarker,
    selectKeyframesAtFrame,
  ]);

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  // ─── Computed ─────────────────────────────────────────────────────────────

  const currentTimeStr = animProject
    ? formatFrameTime(currentFrame, animProject.fps)
    : "0:00";

  const totalTimeStr = animProject
    ? formatFrameTime(animProject.totalFrames, animProject.fps)
    : "0:00";

  const selectedTrack = animProject?.tracks.find(
    (t) => t.objectId === selectedTrackId
  ) ?? null;

  // Compute selectedKeyframeIndex from selectedKeyframes for backward compat
  const selectedKeyframeIndex = (() => {
    if (!selectedTrackId || selectedKeyframes.length === 0 || !animProject) return _selectedKeyframeIndex;
    const sel = selectedKeyframes.find((s) => s.trackId === selectedTrackId);
    if (!sel) return _selectedKeyframeIndex;
    const track = animProject.tracks.find((t) => t.objectId === selectedTrackId);
    if (!track) return _selectedKeyframeIndex;
    const idx = track.keyframes.findIndex((kf) => kf.frame === sel.frame);
    return idx >= 0 ? idx : _selectedKeyframeIndex;
  })();

  const selectedKeyframe =
    selectedTrack && selectedKeyframeIndex !== null
      ? selectedTrack.keyframes[selectedKeyframeIndex] ?? null
      : null;

  // ─── Value ────────────────────────────────────────────────────────────────

  const value: AnimationContextValue = {
    sourceProject,
    loading,
    error,
    canvasRef,
    fabricCanvasRef,
    objectMapRef,
    animProject,
    setAnimProject,
    currentFrame,
    setCurrentFrame,
    playing,
    frameRef,
    togglePlayback,
    stopPlayback,
    goToFrame,
    stepFrame,
    playbackMode,
    setPlaybackMode,
    playbackSpeed,
    setPlaybackSpeed,
    selectedTrackId,
    setSelectedTrackId,
    selectedKeyframeIndex,
    setSelectedKeyframeIndex,
    selectedTrack,
    selectedKeyframe,
    selectedKeyframes,
    isKeyframeSelected,
    toggleKeyframeSelection,
    deleteSelectedKeyframes,
    moveSelectedKeyframes,
    selectKeyframesAtFrame,
    clipboard,
    copySelectedKeyframes,
    pasteKeyframes,
    pasteKeyframesToTrack,
    undo,
    redo,
    canUndo,
    canRedo,
    pushUndoState,
    onionSkinning,
    setOnionSkinning,
    onionFrameCount,
    setOnionFrameCount,
    updateFps,
    updateDuration,
    snapping,
    setSnapping,
    snapFrame,
    pathPreview,
    setPathPreview,
    autoKey,
    setAutoKey,
    inPoint,
    outPoint,
    setInPoint,
    setOutPoint,
    clearPlaybackRange,
    hasPlaybackRange,
    markers,
    addMarker,
    removeMarker,
    renameMarker,
    updateMarkerColor,
    duplicateSelectedKeyframes,
    shortcutsVisible,
    setShortcutsVisible,
    lastSavedAt,
    resizeCanvas,
    canvasBgColor,
    setCanvasBgColor,
    updateObjectProperty,
    handlePropertyEasingChange,
    updateKeyframeCustomBezier,
    applyPreset,
    applyStaggeredPreset,
    applyCameraMove,
    hasUnsavedChanges,
    saveAnimation,
    addKeyframeAtCurrentFrame,
    handleDeleteKeyframe,
    handleEasingChange,
    toggleTrackVisibility,
    toggleTrackLock,
    removeObject,
    reorderObject,
    reorderTracksByIds,
    addObjectToCanvas,
    addFabricObject,
    registerExistingObject,
    applyKeyframesToTrack,
    createTrackGroup,
    removeTrackGroup,
    renameTrackGroup,
    addTracksToGroup,
    removeTrackFromGroup,
    toggleGroupCollapsed,
    applyKeyframesToGroup,
    insertMotionGraphic,
    workspaceTheme,
    setWorkspaceTheme,
    rigs,
    rigMode,
    setRigMode,
    decomposeSVGForRig,
    addAnchorToRig,
    removeAnchorFromRig,
    setAnchorParent,
    renameAnchor,
    removeRig,
    staggerEntranceForGroup,
    moveKeyframe,
    scaleTrackKeyframes,
    timelineZoom,
    setTimelineZoom,
    timelineScrollLeft,
    setTimelineScrollLeft,
    currentTimeStr,
    totalTimeStr,
    audioBuffer,
    audioMuted,
    setAudioMuted,
    audioVolume,
    setAudioVolume,
    importAudio,
    removeAudio,
    applyPathFollow,
    getPathTrackIds,
  };

  return (
    <AnimationContext.Provider value={value}>
      {children}
    </AnimationContext.Provider>
  );
}
