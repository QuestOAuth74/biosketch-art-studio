import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ImageIcon } from "@phosphor-icons/react";
import { ImageSquareIcon } from "@phosphor-icons/react/dist/ssr";
import { CanvasEditorTestIds } from "@/lib/test-ids";

interface ImageDropdownProps {
  onToolChange: (tool: string) => void;
  onImagePlaceholder: () => void;
  activeTool?: string;
}

export const ImageDropdown = ({
  onToolChange,
  onImagePlaceholder,
  activeTool,
}: ImageDropdownProps) => {
  const isActive = activeTool === "image";

  const toolButtonBase =
    "w-8 h-8 flex-shrink-0 rounded-md transition-all duration-150 hover:scale-105";
  const toolButtonActive = `${toolButtonBase} bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30`;
  const toolButtonInactive = `${toolButtonBase} text-muted-foreground hover:text-foreground hover:bg-blue-200/60 hover:shadow-sm`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={isActive ? toolButtonActive : toolButtonInactive}
          data-testid={CanvasEditorTestIds.IMAGE_BUTTON}
        >
          <ImageIcon
            style={{ width: 18, height: 18 }}
            weight={isActive ? "duotone" : "bold"}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        className="w-56 bg-card z-50"
      >
        <DropdownMenuLabel>Insert Image</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onToolChange("image")}>
          <ImageIcon
            style={{ width: 18, height: 18 }}
            weight="regular"
            className="mr-2"
          />
          <span>Image</span>
          <span className="ml-auto text-xs text-muted-foreground">8</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onImagePlaceholder}>
          <ImageSquareIcon
            style={{ width: 18, height: 18 }}
            weight="regular"
            className="mr-2"
          />
          <span>Image Placeholder</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
