import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PushPinIcon, PushPinSlashIcon } from "@phosphor-icons/react";

interface PinObjectSectionProps {
  isPinned: boolean;
  togglePin: () => void;
}

/**
 * Section for pinning/unpinning objects to prevent accidental modification
 */
export const PinObjectSection = ({
  isPinned,
  togglePin,
}: PinObjectSectionProps) => {
  return (
    <div className="p-3 border-b border-border/40 bg-accent/10 smooth-transition hover:bg-accent/20">
      <div className="flex items-center justify-between mb-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pin Object
        </Label>
        <Button
          variant={isPinned ? "default" : "outline"}
          size="sm"
          onClick={togglePin}
          className="gap-2"
        >
          {isPinned ? (
            <>
              <PushPinIcon
                style={{ width: 18, height: 18 }}
                weight="regular"
              />
              Unpin
            </>
          ) : (
            <>
              <PushPinSlashIcon
                style={{ width: 18, height: 18 }}
                weight="regular"
              />
              Pin
            </>
          )}
        </Button>
      </div>
      {isPinned && (
        <p className="text-xs text-muted-foreground">
          This object is pinned and cannot be moved or resized
        </p>
      )}
    </div>
  );
};
