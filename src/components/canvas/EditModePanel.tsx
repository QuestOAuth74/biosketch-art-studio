import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useCanvas } from "@/contexts/CanvasContext";
import { BezierPath } from "@/types/bezier";
import { toast } from "sonner";
import {
  CheckCircleIcon,
  CircleIcon,
  SquareIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import React from "react";

export const EditModePanel = () => {
  // Force re-render mechanism for membrane edit mode
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  const {
    canvas,
    saveState,
    bezierEditModeRef,
    editingBezierPath,
    setEditingBezierPath,
    exitBezierEditMode,
    isBezierEditMode,
    curvedLineEditModeRef,
    editingCurvedLine,
    exitCurvedLineEditMode,
    isCurvedLineEditMode,
    straightLineEditModeRef,
    editingStraightLine,
    exitStraightLineEditMode,
    isStraightLineEditMode,
    orthogonalLineEditModeRef,
    editingOrthogonalLine,
    exitOrthogonalLineEditMode,
    isOrthogonalLineEditMode,
    isMembraneEditMode,
    membraneEditModeRef,
    editingMembrane,
    setEditingMembrane,
    exitMembraneEditMode,
    membraneEditTab,
    setMembraneEditTab,
    smartConnectorsEnabled,
    setSmartConnectorsEnabled,
    autoPathfindingEnabled,
    setAutoPathfindingEnabled,
  } = useCanvas();


  // Listen for canvas events during membrane edit mode to update UI
  React.useEffect(() => {
    if (!canvas || !isMembraneEditMode) {
      return;
    }

    const handleCanvasChange = () => {
      forceUpdate();
    };

    // Listen to various canvas events that might indicate state changes
    canvas.on('object:modified', handleCanvasChange);
    canvas.on('object:added', handleCanvasChange); // New anchor points being added
    canvas.on('object:removed', handleCanvasChange); // Anchor points being deleted
    canvas.on('selection:created', handleCanvasChange);
    canvas.on('selection:updated', handleCanvasChange);
    canvas.on('selection:cleared', handleCanvasChange);

    return () => {
      canvas.off('object:modified', handleCanvasChange);
      canvas.off('object:added', handleCanvasChange);
      canvas.off('object:removed', handleCanvasChange);
      canvas.off('selection:created', handleCanvasChange);
      canvas.off('selection:updated', handleCanvasChange);
      canvas.off('selection:cleared', handleCanvasChange);
    };
  }, [canvas, isMembraneEditMode, forceUpdate]);

  // Handle bezier edit mode
  if (isBezierEditMode && bezierEditModeRef.current && editingBezierPath) {
    const editMode = bezierEditModeRef.current;
    const selectedPath = editingBezierPath as BezierPath;

    if (!editMode.isActive()) {
      return null;
    }

    const selectedAnchorId = editMode.getSelectedAnchorId();
    const bezierPoints = (selectedPath as any).bezierPoints || [];
    const selectedPoint = bezierPoints.find(
      (p: any) => p.id === selectedAnchorId,
    );

    const handleToggleType = () => {
      if (selectedAnchorId) {
        editMode.togglePointType(selectedAnchorId);
        // Force React to re-render by updating the state
        setEditingBezierPath({ ...editingBezierPath });
      }
    };

    const handleDeletePoint = () => {
      if (selectedAnchorId) {
        editMode.deleteAnchorPoint(selectedAnchorId);
      }
    };

    return (
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-semibold">Edit Mode Active</span>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                • Click path to add point
              </p>
              <p className="text-xs text-muted-foreground">
                • Click anchor to select
              </p>
              <p className="text-xs text-muted-foreground">
                • Drag handles to reshape
              </p>
            </div>

            {selectedPoint && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs font-semibold">Selected Anchor</p>

                <div className="flex items-center justify-between gap-3 p-2 rounded-md bg-muted/50">
                  <div className="flex flex-col items-center gap-1">
                    <SquareIcon
                      size={16}
                      weight={
                        selectedPoint.type === "corner" ? "fill" : "regular"
                      }
                    />
                    <span className="text-xs font-medium">Corner</span>
                  </div>
                  <Switch
                    checked={selectedPoint.type === "smooth"}
                    onCheckedChange={handleToggleType}
                    className="data-[state=unchecked]:bg-border"
                  />
                  <div className="flex flex-col items-center gap-1">
                    <CircleIcon
                      size={16}
                      weight={
                        selectedPoint.type === "smooth" ? "fill" : "regular"
                      }
                    />
                    <span className="text-xs font-medium">Smooth</span>
                  </div>
                </div>

                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={handleDeletePoint}
                  disabled={bezierPoints.length <= 2}
                >
                  <TrashIcon
                    size={14}
                    className="mr-1"
                  />
                  Delete Point
                </Button>
              </div>
            )}

            {/* Smart Connection Control */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs font-medium">Smart Connection</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Snap to connection points
                  </p>
                </div>
                <Switch
                  checked={smartConnectorsEnabled}
                  onCheckedChange={setSmartConnectorsEnabled}
                />
              </div>
            </div>

            {/* Close Path Button - only show if path is open and has 3+ points */}
            {editingBezierPath && !(editingBezierPath as any).isClosed && bezierPoints.length >= 3 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  if (editMode && editingBezierPath && canvas) {
                    // Mark as closed
                    (editingBezierPath as any).isClosed = true;

                    // Recalculate control points for closed path
                    const bezierPoints = (editingBezierPath as any).bezierPoints;
                    const tension = 0.5;

                    // For closed paths, all points are interior points in a loop
                    for (let i = 0; i < bezierPoints.length; i++) {
                      const prev = bezierPoints[(i - 1 + bezierPoints.length) % bezierPoints.length];
                      const curr = bezierPoints[i];
                      const next = bezierPoints[(i + 1) % bezierPoints.length];

                      const tx = (next.x - prev.x) * tension;
                      const ty = (next.y - prev.y) * tension;

                      curr.controlPoint1 = {
                        x: curr.x - tx / 2,
                        y: curr.y - ty / 2,
                      };
                      curr.controlPoint2 = {
                        x: curr.x + tx / 2,
                        y: curr.y + ty / 2,
                      };
                    }

                    // Rebuild path data
                    let pathData = `M ${bezierPoints[0].x} ${bezierPoints[0].y}`;

                    for (let i = 0; i < bezierPoints.length - 1; i++) {
                      const curr = bezierPoints[i];
                      const next = bezierPoints[i + 1];

                      if (curr.controlPoint2 && next.controlPoint1) {
                        pathData += ` C ${curr.controlPoint2.x} ${curr.controlPoint2.y}, ${next.controlPoint1.x} ${next.controlPoint1.y}, ${next.x} ${next.y}`;
                      } else {
                        pathData += ` L ${next.x} ${next.y}`;
                      }
                    }

                    // Add closing bezier curve
                    const last = bezierPoints[bezierPoints.length - 1];
                    const first = bezierPoints[0];

                    if (last.controlPoint2 && first.controlPoint1) {
                      pathData += ` C ${last.controlPoint2.x} ${last.controlPoint2.y}, ${first.controlPoint1.x} ${first.controlPoint1.y}, ${first.x} ${first.y}`;
                    }

                    // Update the path
                    (editingBezierPath as any).set({ path: pathData });
                    (editingBezierPath as any).setCoords();

                    // Update edit mode to show the new control points
                    editMode.deactivate();
                    editMode.activate(editingBezierPath as any);

                    canvas.requestRenderAll();
                    saveState();
                    setEditingBezierPath({ ...editingBezierPath }); // Force re-render
                    toast.success("Path closed with smooth curve");
                  }
                }}
              >
                <CheckCircleIcon size={16} className="mr-1" />
                Close Path
              </Button>
            )}

            <Button
              variant="default"
              size="sm"
              className="w-full"
              onClick={exitBezierEditMode}
            >
              <CheckCircleIcon
                size={16}
                className="mr-1"
              />
              Done Editing
            </Button>
          </div>
        </div>
      </ScrollArea>
    );
  }

  // Handle curved line edit mode
  if (
    isCurvedLineEditMode &&
    curvedLineEditModeRef.current &&
    editingCurvedLine
  ) {
    const editMode = curvedLineEditModeRef.current;

    if (!editMode.isActive()) {
      return null;
    }

    return (
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-semibold">Edit Mode Active</span>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                • Drag the green control point to adjust the curve
              </p>
              <p className="text-xs text-muted-foreground">
                • Dashed lines show the curve control
              </p>
            </div>

            {/* Smart Connection Control */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs font-medium">Smart Connection</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Snap to connection points
                  </p>
                </div>
                <Switch
                  checked={smartConnectorsEnabled}
                  onCheckedChange={setSmartConnectorsEnabled}
                />
              </div>
            </div>

            <Button
              variant="default"
              size="sm"
              className="w-full"
              onClick={exitCurvedLineEditMode}
            >
              <CheckCircleIcon
                size={16}
                className="mr-1"
              />
              Done Editing
            </Button>
          </div>
        </div>
      </ScrollArea>
    );
  }

  // Handle straight line edit mode
  if (
    isStraightLineEditMode &&
    straightLineEditModeRef.current &&
    editingStraightLine
  ) {
    const editMode = straightLineEditModeRef.current;

    if (!editMode.isActive()) {
      return null;
    }

    return (
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-semibold">Edit Mode Active</span>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                • Drag the blue anchor points to adjust the line
              </p>
              <p className="text-xs text-muted-foreground">
                • Move start and end points to reposition
              </p>
            </div>

            {/* Smart Connection Control */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs font-medium">Smart Connection</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Snap to connection points
                  </p>
                </div>
                <Switch
                  checked={smartConnectorsEnabled}
                  onCheckedChange={setSmartConnectorsEnabled}
                />
              </div>
            </div>

            <Button
              variant="default"
              size="sm"
              className="w-full"
              onClick={exitStraightLineEditMode}
            >
              <CheckCircleIcon
                size={16}
                className="mr-1"
              />
              Done Editing
            </Button>
          </div>
        </div>
      </ScrollArea>
    );
  }

  // Handle orthogonal line edit mode

  if (
    isOrthogonalLineEditMode &&
    orthogonalLineEditModeRef.current &&
    editingOrthogonalLine
  ) {
    const editMode = orthogonalLineEditModeRef.current;

    if (!editMode.isActive()) {
      return null;
    }

    const selectedWaypointIndex = editMode.getSelectedWaypointIndex?.();
    const lineData = editingOrthogonalLine as any;
    const worldWaypoints = lineData?.orthogonalWorldPoints as Array<{ x: number; y: number }> | undefined;
    const waypointCount = worldWaypoints?.length || 0;

    const handleDeleteWaypoint = () => {
      if (selectedWaypointIndex !== null) {
        editMode.deleteWaypoint?.(selectedWaypointIndex);
      }
    };

    return (
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-semibold">Edit Mode Active</span>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                • Double-click line to add waypoint
              </p>
              <p className="text-xs text-muted-foreground">
                • Click waypoint to select
              </p>
              <p className="text-xs text-muted-foreground">
                • Drag waypoints to adjust path
              </p>
            </div>

            {selectedWaypointIndex !== null && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs font-semibold">Selected Waypoint</p>

                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={handleDeleteWaypoint}
                  disabled={waypointCount <= 2}
                >
                  <TrashIcon
                    size={14}
                    className="mr-1"
                  />
                  Delete Waypoint
                </Button>
              </div>
            )}

            {/* Smart Connection Control */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs font-medium">Smart Connection</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Snap to connection points
                  </p>
                </div>
                <Switch
                  checked={smartConnectorsEnabled}
                  onCheckedChange={setSmartConnectorsEnabled}
                />
              </div>
            </div>

            <Button
              variant="default"
              size="sm"
              className="w-full"
              onClick={exitOrthogonalLineEditMode}
            >
              <CheckCircleIcon
                size={16}
                className="mr-1"
              />
              Done Editing
            </Button>
          </div>
        </div>
      </ScrollArea>
    );
  }

  // Handle membrane edit mode - use tabs for line vs icon editing
  if (isMembraneEditMode && membraneEditModeRef.current && editingMembrane) {
    const membraneEditMode = membraneEditModeRef.current;

    if (!membraneEditMode.isActive()) {
      return null;
    }

    // Get the underlying BezierEditMode and virtual path
    const bezierEditMode = (membraneEditMode as any).pathEditMode;
    const virtualPath = (membraneEditMode as any).virtualPath;

    if (!bezierEditMode || !virtualPath) {
      return null;
    }

    const selectedAnchorId = bezierEditMode.getSelectedAnchorId();
    const bezierPoints = (virtualPath as any).bezierPoints || [];
    const selectedPoint = bezierPoints.find(
      (p: any) => p.id === selectedAnchorId,
    );

    const handleToggleType = () => {
      if (selectedAnchorId) {
        bezierEditMode.togglePointType(selectedAnchorId);
        setEditingMembrane({ ...editingMembrane });
      }
    };

    const handleDeletePoint = () => {
      if (selectedAnchorId) {
        bezierEditMode.deleteAnchorPoint(selectedAnchorId);
      }
    };

    return (
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-semibold">Edit Mode Active</span>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                • Click path to add point
              </p>
              <p className="text-xs text-muted-foreground">
                • Click anchor to select
              </p>
              <p className="text-xs text-muted-foreground">
                • Drag handles to reshape
              </p>
            </div>

            {selectedPoint && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs font-semibold">Selected Anchor</p>

                <div className="flex items-center justify-between gap-3 p-2 rounded-md bg-muted/50">
                  <div className="flex flex-col items-center gap-1">
                    <SquareIcon
                      size={16}
                      weight={
                        selectedPoint.type === "corner" ? "fill" : "regular"
                      }
                    />
                    <span className="text-xs font-medium">Corner</span>
                  </div>
                  <Switch
                    checked={selectedPoint.type === "smooth"}
                    onCheckedChange={handleToggleType}
                    className="data-[state=unchecked]:bg-border"
                  />
                  <div className="flex flex-col items-center gap-1">
                    <CircleIcon
                      size={16}
                      weight={
                        selectedPoint.type === "smooth" ? "fill" : "regular"
                      }
                    />
                    <span className="text-xs font-medium">Smooth</span>
                  </div>
                </div>

                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={handleDeletePoint}
                  disabled={bezierPoints.length <= 2}
                >
                  <TrashIcon
                    size={14}
                    className="mr-1"
                  />
                  Delete Point
                </Button>
              </div>
            )}

            <Button
              variant="default"
              size="sm"
              className="w-full"
              onClick={exitMembraneEditMode}
            >
              <CheckCircleIcon
                size={16}
                className="mr-1"
              />
              Done Editing
            </Button>
          </div>
        </div>
      </ScrollArea>
    );
  }

  return null;
};
