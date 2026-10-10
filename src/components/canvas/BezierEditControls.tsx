import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BezierEditMode } from "@/lib/bezierEditMode";
import { BezierPath } from "@/types/bezier";
import {
  CheckCircleIcon,
  CircleIcon,
  SquareIcon,
  TrashIcon,
} from "@phosphor-icons/react";

interface BezierEditControlsProps {
  editMode: BezierEditMode | null;
  selectedPath: BezierPath | null;
  onExitEditMode: () => void;
}

export const BezierEditControls = ({
  editMode,
  selectedPath,
  onExitEditMode,
}: BezierEditControlsProps) => {
  if (!editMode || !editMode.isActive() || !selectedPath) {
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
    }
  };

  const handleDeletePoint = () => {
    if (selectedAnchorId) {
      editMode.deleteAnchorPoint(selectedAnchorId);
    }
  };

  return (
    <Card className="fixed top-20 right-4 p-3 shadow-lg bg-background/95 backdrop-blur z-50 border-2">
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

            <div className="flex gap-2">
              <Button
                variant={
                  selectedPoint.type === "smooth" ? "default" : "outline"
                }
                size="sm"
                className="flex-1"
                onClick={handleToggleType}
              >
                <CircleIcon
                  size={14}
                  className="mr-1"
                />
                Smooth
              </Button>
              <Button
                variant={
                  selectedPoint.type === "corner" ? "default" : "outline"
                }
                size="sm"
                className="flex-1"
                onClick={handleToggleType}
              >
                <SquareIcon
                  size={14}
                  className="mr-1"
                />
                Corner
              </Button>
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
          onClick={onExitEditMode}
        >
          <CheckCircleIcon
            size={16}
            className="mr-1"
          />
          Done Editing
        </Button>
      </div>
    </Card>
  );
};
