import { Suspense, forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Bounds, Environment, useBounds, Html, Grid } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import {
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Tag,
  Camera,
  Play,
  Pause,
  Grid3X3,
  Box,
  Palette,
  Download,
  X,
} from "lucide-react";
import { Mesh, Box3, Vector3, type Group, type PerspectiveCamera, type OrthographicCamera, type Material } from "three";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// ── Public types ────────────────────────────────────────────────────────────
export interface LabelPoint {
  id: string;
  position: { x: number; y: number; z: number };
  normal?: { x: number; y: number; z: number } | null;
  title: string;
  description?: string | null;
  index: number;
  active?: boolean;
}

export type ViewerMode = "view" | "place";

export type ViewPreset = "front" | "back" | "left" | "right" | "top" | "bottom" | "iso";

export interface ViewerHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  setView: (preset: ViewPreset) => void;
  screenshot: () => string | null;
  /** Fly the camera to focus on a label given in the model's local frame. */
  focusLabel: (localPosition: { x: number; y: number; z: number }) => void;
}

type BackgroundKind = "studio" | "white" | "dark";

const BACKGROUNDS: Record<BackgroundKind, string> = {
  studio: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
  white: "#ffffff",
  dark: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
};

// ── Bridge inside Canvas: wires the imperative handle ───────────────────────
function ControlsBridge({
  handleRef,
  orbitRef,
  modelRootRef,
}: {
  handleRef: React.MutableRefObject<ViewerHandle | null>;
  orbitRef: React.RefObject<OrbitControlsImpl>;
  modelRootRef: React.MutableRefObject<Group | null>;
}) {
  const { camera, gl, scene } = useThree();
  const bounds = useBounds();

  useEffect(() => {
    handleRef.current = {
      zoomIn: () => {
        const ctrl = orbitRef.current;
        if (!ctrl) return;
        const dir = camera.position.clone().sub(ctrl.target);
        dir.multiplyScalar(1 / 1.2);
        camera.position.copy(ctrl.target).add(dir);
        ctrl.update();
      },
      zoomOut: () => {
        const ctrl = orbitRef.current;
        if (!ctrl) return;
        const dir = camera.position.clone().sub(ctrl.target);
        dir.multiplyScalar(1.2);
        camera.position.copy(ctrl.target).add(dir);
        ctrl.update();
      },
      resetView: () => {
        bounds?.refresh().fit();
      },
      setView: (preset) => {
        const ctrl = orbitRef.current;
        if (!ctrl) return;
        const distance = camera.position.distanceTo(ctrl.target);
        const t = ctrl.target;
        switch (preset) {
          case "front":  camera.position.set(t.x, t.y, t.z + distance); break;
          case "back":   camera.position.set(t.x, t.y, t.z - distance); break;
          case "right":  camera.position.set(t.x + distance, t.y, t.z); break;
          case "left":   camera.position.set(t.x - distance, t.y, t.z); break;
          case "top":    camera.position.set(t.x, t.y + distance, t.z); break;
          case "bottom": camera.position.set(t.x, t.y - distance, t.z); break;
          case "iso": {
            const d = distance / Math.sqrt(3);
            camera.position.set(t.x + d, t.y + d, t.z + d);
            break;
          }
        }
        camera.lookAt(ctrl.target);
        (camera as PerspectiveCamera | OrthographicCamera).updateProjectionMatrix?.();
        ctrl.update();
      },
      screenshot: () => {
        try {
          // Force a fresh render so the latest frame is on the buffer.
          gl.render(scene, camera);
          return gl.domElement.toDataURL("image/png");
        } catch (err) {
          console.error("[viewer] screenshot failed:", err);
          return null;
        }
      },
      focusLabel: (localPosition) => {
        const ctrl = orbitRef.current;
        const root = modelRootRef.current;
        if (!ctrl || !root) return;
        // Convert local position to world space using the model root.
        const worldTarget = new Vector3(localPosition.x, localPosition.y, localPosition.z);
        root.localToWorld(worldTarget);
        // Keep the existing viewing direction; pull the camera in to ~80% of
        // its current distance so the focused area fills more of the frame.
        const currentOffset = camera.position.clone().sub(ctrl.target);
        const newDistance = Math.max(currentOffset.length() * 0.7, 0.5);
        currentOffset.normalize().multiplyScalar(newDistance);
        ctrl.target.copy(worldTarget);
        camera.position.copy(worldTarget).add(currentOffset);
        camera.lookAt(worldTarget);
        (camera as PerspectiveCamera | OrthographicCamera).updateProjectionMatrix?.();
        ctrl.update();
      },
    };
  }, [camera, gl, scene, bounds, handleRef, orbitRef, modelRootRef]);

  return null;
}

// ── The loaded mesh + click handler + label pins ────────────────────────────
// Singleton Draco + KTX2 decoders so we don't re-init for every model load.
// Decoder WASM streams from Google's CDN — keeps our bundle small, and the
// browser caches them across sessions.
let _dracoLoader: DRACOLoader | null = null;
let _ktx2Loader: KTX2Loader | null = null;
const configureGltfLoader = (loader: GLTFLoader, gl?: { capabilities?: unknown } | null) => {
  if (!_dracoLoader) {
    _dracoLoader = new DRACOLoader();
    _dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");
    _dracoLoader.setDecoderConfig({ type: "js" });
  }
  loader.setDRACOLoader(_dracoLoader);

  if (!_ktx2Loader) {
    _ktx2Loader = new KTX2Loader();
    _ktx2Loader.setTranscoderPath("https://unpkg.com/three@0.183.0/examples/jsm/libs/basis/");
  }
  if (gl) {
    _ktx2Loader.detectSupport(gl as never);
  }
  loader.setKTX2Loader(_ktx2Loader);
};

function GltfModel({
  url,
  mode,
  onMeshClick,
  labels,
  onLabelClick,
  showLabels,
  wireframe,
  externalRootRef,
}: {
  url: string;
  mode: ViewerMode;
  onMeshClick?: (
    position: { x: number; y: number; z: number },
    normal: { x: number; y: number; z: number } | null,
  ) => void;
  labels: LabelPoint[];
  onLabelClick?: (id: string) => void;
  showLabels: boolean;
  wireframe: boolean;
  /** Populated when the gltf scene mounts; lets ControlsBridge convert local→world. */
  externalRootRef?: React.MutableRefObject<Group | null>;
}) {
  const { gl } = useThree();
  // The third arg to useLoader runs once on the loader instance — perfect spot
  // to attach Draco + KTX2 decoders so compressed GLBs Just Work.
  const gltf = useLoader(GLTFLoader, url, (loader) => configureGltfLoader(loader as GLTFLoader, gl));
  const ref = useRef<Group>(null);
  useEffect(() => {
    if (externalRootRef) externalRootRef.current = ref.current;
    return () => {
      if (externalRootRef) externalRootRef.current = null;
    };
  }, [externalRootRef, gltf.scene]);
  const bounds = useBounds();
  const [modelDiagonal, setModelDiagonal] = useState(1);
  // Stable, hand-rolled occlusion: a Set of ids that are currently hidden
  // because the model surface is between the camera and the pin. Updated
  // inside useFrame, but state only changes when the set actually differs —
  // no flicker, no per-frame re-render.
  const [occludedIds, setOccludedIds] = useState<Set<string>>(new Set());
  const occludedRef = useRef<Set<string>>(new Set());
  const { camera, raycaster } = useThree();

  useEffect(() => {
    if (bounds && gltf.scene) {
      setTimeout(() => bounds.refresh().fit(), 0);
    }
  }, [gltf.scene, bounds]);

  useEffect(() => {
    if (!gltf.scene) return;
    const box = new Box3().setFromObject(gltf.scene);
    const size = box.getSize(new Vector3());
    setModelDiagonal(Math.max(size.length(), 0.1));
  }, [gltf.scene]);

  // Small surface offset so pins float ever-so-slightly off the mesh — keeps
  // the raycast hit distinct from the pin distance even with thin tissue.
  const surfaceOffset = modelDiagonal * 0.01;

  // Per-frame stable occlusion check.
  useFrame(() => {
    if (!ref.current || !showLabels || labels.length === 0) return;
    const next = new Set<string>();
    const worldPos = new Vector3();
    for (const label of labels) {
      // pin world position = local position (+ small normal offset) → world
      const nx = label.normal?.x ?? 0;
      const ny = label.normal?.y ?? 0;
      const nz = label.normal?.z ?? 0;
      const nLen = Math.max(Math.sqrt(nx * nx + ny * ny + nz * nz), 0.001);
      worldPos.set(
        label.position.x + (nx / nLen) * surfaceOffset,
        label.position.y + (ny / nLen) * surfaceOffset,
        label.position.z + (nz / nLen) * surfaceOffset,
      );
      ref.current.localToWorld(worldPos);

      const dir = worldPos.clone().sub(camera.position);
      const pinDist = dir.length();
      dir.normalize();

      raycaster.set(camera.position, dir);
      raycaster.near = 0.001;
      raycaster.far = pinDist;
      const hits = raycaster.intersectObject(ref.current, true);
      // If the nearest mesh hit sits clearly closer than the pin, the pin is
      // occluded. A 0.5% tolerance kills boundary jitter.
      if (hits.length > 0 && hits[0].distance < pinDist - pinDist * 0.005) {
        next.add(label.id);
      }
    }

    // Only commit to React state if the set actually changed.
    const prev = occludedRef.current;
    if (prev.size !== next.size) {
      occludedRef.current = next;
      setOccludedIds(next);
      return;
    }
    for (const id of next) {
      if (!prev.has(id)) {
        occludedRef.current = next;
        setOccludedIds(next);
        return;
      }
    }
  });

  // Apply wireframe across every mesh material in the scene.
  useEffect(() => {
    gltf.scene.traverse((obj) => {
      if (obj instanceof Mesh) {
        const mat = obj.material as Material | Material[];
        if (Array.isArray(mat)) {
          mat.forEach((m) => ((m as Material & { wireframe?: boolean }).wireframe = wireframe));
        } else {
          (mat as Material & { wireframe?: boolean }).wireframe = wireframe;
        }
      }
    });
  }, [gltf.scene, wireframe]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (mode !== "place" || !onMeshClick) return;
    e.stopPropagation();
    const local = e.point.clone();
    gltf.scene.worldToLocal(local);
    const n = e.face?.normal ?? null;
    onMeshClick(
      { x: local.x, y: local.y, z: local.z },
      n ? { x: n.x, y: n.y, z: n.z } : null,
    );
  };

  return (
    <primitive
      ref={ref}
      object={gltf.scene}
      onClick={handleClick}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        if (mode === "place") {
          e.stopPropagation();
          document.body.style.cursor = "crosshair";
        }
      }}
      onPointerOut={() => {
        if (mode === "place") document.body.style.cursor = "default";
      }}
    >
      {showLabels && labels.map((label) => {
        if (occludedIds.has(label.id)) return null; // hidden behind the surface

        const nx = label.normal?.x ?? 0;
        const ny = label.normal?.y ?? 0;
        const nz = label.normal?.z ?? 0;
        const nLen = Math.max(Math.sqrt(nx * nx + ny * ny + nz * nz), 0.001);
        const pinPos: [number, number, number] = [
          label.position.x + (nx / nLen) * surfaceOffset,
          label.position.y + (ny / nLen) * surfaceOffset,
          label.position.z + (nz / nLen) * surfaceOffset,
        ];
        return (
          <Html
            key={label.id}
            position={pinPos}
            center
            zIndexRange={[10, 0]}
            style={{ pointerEvents: "auto" }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onLabelClick?.(label.id);
              }}
              title={label.title}
              className={`inline-flex items-center justify-center rounded-full text-white text-[11px] font-bold shadow-lg transition-all ${
                label.active
                  ? "bg-violet-600 ring-4 ring-violet-300/60 scale-110"
                  : "bg-slate-900/80 hover:bg-violet-600 hover:scale-110"
              }`}
              style={{ width: 22, height: 22, lineHeight: 1 }}
            >
              {label.index}
            </button>
          </Html>
        );
      })}
    </primitive>
  );
}

// ── Public viewer component ────────────────────────────────────────────────
interface Props {
  url: string;
  cacheKey?: string;
  className?: string;
  labels?: LabelPoint[];
  mode?: ViewerMode;
  onMeshClick?: (
    position: { x: number; y: number; z: number },
    normal: { x: number; y: number; z: number } | null,
  ) => void;
  onLabelClick?: (id: string) => void;
}

export const MedicalModelViewer = forwardRef<ViewerHandle, Props>(function MedicalModelViewer(
  {
    url,
    cacheKey,
    className,
    labels = [],
    mode = "view",
    onMeshClick,
    onLabelClick,
  },
  ref,
) {
  const orbitRef = useRef<OrbitControlsImpl>(null);
  const handleRef = useRef<ViewerHandle | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Shared ref to the loaded gltf root so ControlsBridge can do local→world
  // conversions for focusLabel. Populated by GltfModel on mount.
  const modelRootRef = useRef<Group | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [background, setBackground] = useState<BackgroundKind>("studio");
  const [isFullscreen, setIsFullscreen] = useState(false);

  useImperativeHandle(ref, () => ({
    zoomIn: () => handleRef.current?.zoomIn(),
    zoomOut: () => handleRef.current?.zoomOut(),
    resetView: () => handleRef.current?.resetView(),
    setView: (preset: ViewPreset) => handleRef.current?.setView(preset),
    screenshot: () => handleRef.current?.screenshot() ?? null,
    focusLabel: (pos) => handleRef.current?.focusLabel(pos),
  }), []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement === containerRef.current) {
      await document.exitFullscreen().catch(() => {});
    } else {
      await containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  const cycleBackground = () => {
    setBackground((b) => (b === "studio" ? "white" : b === "white" ? "dark" : "studio"));
  };

  const downloadScreenshot = () => {
    const dataUrl = handleRef.current?.screenshot();
    if (!dataUrl) {
      toast.error("Could not capture screenshot");
      return;
    }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `biosketch-3d-${Date.now()}.png`;
    a.click();
    toast.success("Screenshot saved");
  };

  const isDark = background === "dark";
  const activeLabel = labels.find((l) => l.active) ?? null;

  return (
    <div
      ref={containerRef}
      className={`relative ${className ?? "w-full h-full"}`}
      style={{ background: BACKGROUNDS[background] }}
    >
      <Canvas
        key={cacheKey ?? url}
        camera={{ position: [3, 2, 4], fov: 45, near: 0.01, far: 1000 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
      >
        <ambientLight intensity={isDark ? 0.4 : 0.6} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} castShadow />
        <directionalLight position={[-5, -3, -5]} intensity={0.35} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.15}>
            <GltfModel
              url={url}
              mode={mode}
              onMeshClick={onMeshClick}
              labels={labels}
              onLabelClick={onLabelClick}
              showLabels={showLabels}
              wireframe={wireframe}
              externalRootRef={modelRootRef}
            />
            <ControlsBridge handleRef={handleRef} orbitRef={orbitRef} modelRootRef={modelRootRef} />
          </Bounds>
          {showGrid && (
            <Grid
              args={[20, 20]}
              cellSize={0.5}
              cellThickness={0.6}
              cellColor={isDark ? "#475569" : "#cbd5e1"}
              sectionSize={2}
              sectionThickness={1}
              sectionColor={isDark ? "#64748b" : "#94a3b8"}
              fadeDistance={30}
              fadeStrength={1}
              position={[0, -0.5, 0]}
              infiniteGrid
            />
          )}
          <Environment preset="studio" />
        </Suspense>
        <OrbitControls
          ref={orbitRef}
          enableDamping
          dampingFactor={0.08}
          minDistance={0.5}
          maxDistance={50}
          autoRotate={autoRotate}
          autoRotateSpeed={1.2}
          makeDefault
        />
      </Canvas>

      {/* Floating control toolbar (overlay) */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 pointer-events-auto">
        {/* Group 1: camera */}
        <ToolbarButton title="Zoom in" onClick={() => handleRef.current?.zoomIn()} icon={<ZoomIn className="h-4 w-4" />} />
        <ToolbarButton title="Zoom out" onClick={() => handleRef.current?.zoomOut()} icon={<ZoomOut className="h-4 w-4" />} />
        <ToolbarButton title="Reset view" onClick={() => handleRef.current?.resetView()} icon={<RotateCcw className="h-4 w-4" />} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              title="Camera angle"
              className="inline-flex items-center justify-center h-11 w-11 sm:h-8 sm:w-8 rounded-md bg-white/90 backdrop-blur border border-slate-200 shadow-sm hover:bg-white hover:border-slate-300 transition-colors text-slate-700"
            >
              <Camera className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem onClick={() => handleRef.current?.setView("front")}>Front</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleRef.current?.setView("back")}>Back</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleRef.current?.setView("left")}>Left</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleRef.current?.setView("right")}>Right</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleRef.current?.setView("top")}>Top</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleRef.current?.setView("bottom")}>Bottom</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleRef.current?.setView("iso")}>Isometric</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* divider */}
        <div className="h-px bg-slate-300/60 mx-1 my-0.5" />

        {/* Group 2: scene appearance */}
        <ToolbarButton
          title={autoRotate ? "Stop rotation" : "Auto-rotate"}
          onClick={() => setAutoRotate((v) => !v)}
          icon={autoRotate ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          active={autoRotate}
        />
        <ToolbarButton
          title={wireframe ? "Solid view" : "Wireframe view"}
          onClick={() => setWireframe((v) => !v)}
          icon={<Box className="h-4 w-4" />}
          active={wireframe}
        />
        <ToolbarButton
          title={showGrid ? "Hide grid" : "Show grid"}
          onClick={() => setShowGrid((v) => !v)}
          icon={<Grid3X3 className="h-4 w-4" />}
          active={showGrid}
        />
        <ToolbarButton
          title={`Background: ${background} (click to cycle)`}
          onClick={cycleBackground}
          icon={<Palette className="h-4 w-4" />}
        />
        <ToolbarButton
          title={`Labels: ${showLabels ? "ON" : "OFF"} — click to toggle`}
          onClick={() => setShowLabels((v) => !v)}
          icon={<Tag className="h-4 w-4" />}
          active={showLabels}
        />

        {/* divider */}
        <div className="h-px bg-slate-300/60 mx-1 my-0.5" />

        {/* Group 3: actions */}
        <ToolbarButton
          title="Download screenshot (PNG)"
          onClick={downloadScreenshot}
          icon={<Download className="h-4 w-4" />}
        />
        <ToolbarButton
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          onClick={() => void toggleFullscreen()}
          icon={isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        />
      </div>

      {/* Active label side panel — left edge of the viewport */}
      {activeLabel && (
        <div
          className="absolute top-3 left-3 z-10 max-w-[280px] animate-in fade-in slide-in-from-left-2 duration-200"
        >
          <div className={`rounded-xl shadow-xl border overflow-hidden ${
            isDark ? "bg-slate-900/95 border-slate-700" : "bg-white/95 border-violet-200"
          } backdrop-blur`}>
            {/* Header with index + title + close */}
            <div className="flex items-start gap-2 px-3 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white">
              <span className="inline-flex items-center justify-center bg-white/25 rounded-full w-5 h-5 text-[10px] font-bold shrink-0">
                {activeLabel.index}
              </span>
              <span className="flex-1 text-[12px] font-bold tracking-tight leading-tight pt-0.5">
                {activeLabel.title}
              </span>
              <button
                type="button"
                onClick={() => onLabelClick?.(activeLabel.id)}
                title="Close"
                className="text-white/80 hover:text-white shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* Description */}
            {activeLabel.description ? (
              <div className={`px-3 py-2.5 text-[12px] leading-relaxed whitespace-pre-wrap break-words ${
                isDark ? "text-slate-200" : "text-slate-700"
              }`}>
                {activeLabel.description}
              </div>
            ) : (
              <div className={`px-3 py-2 text-[11px] italic ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                No description yet — add one in the sidebar.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hint strip showing rotate / zoom controls */}
      <div className={`absolute bottom-3 left-3 text-[10px] rounded-md px-2 py-1 border pointer-events-none ${
        isDark
          ? "text-slate-300 bg-slate-900/70 backdrop-blur border-slate-700/60"
          : "text-slate-500 bg-white/70 backdrop-blur border-slate-200/60"
      }`}>
        Drag to rotate · Scroll to zoom · Right-drag to pan
      </div>

      {/* Product watermark — lower-right */}
      <div className="absolute bottom-3 right-3 pointer-events-none select-none">
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md backdrop-blur border shadow-sm ${
          isDark
            ? "bg-slate-900/70 border-slate-700/60"
            : "bg-white/80 border-slate-200/60"
        }`}>
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)" }}
            aria-hidden
          />
          <span
            className={`text-[10px] font-semibold tracking-tight ${isDark ? "text-slate-200" : "text-slate-700"}`}
            style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.005em" }}
          >
            BioSketch <span className="text-violet-400">3D Viewer</span>
          </span>
        </div>
      </div>
    </div>
  );
});

function ToolbarButton({
  title,
  onClick,
  icon,
  active,
}: {
  title: string;
  onClick: () => void;
  icon: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      title={title}
      onClick={onClick}
      // 44 px tap target on coarse-pointer / small screens (Apple HIG),
      // 32 px on desktop where mouse precision is fine.
      className={`h-11 w-11 sm:h-8 sm:w-8 backdrop-blur border shadow-sm transition-colors ${
        active
          ? "bg-violet-600 border-violet-700 text-white hover:bg-violet-600/90"
          : "bg-white/90 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300"
      }`}
    >
      {icon}
    </Button>
  );
}

export function MedicalModelViewerLoader() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/50 pointer-events-none">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      <p className="text-xs text-slate-500 mt-2">Loading 3D model…</p>
    </div>
  );
}
