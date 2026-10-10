import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TextTIcon } from "@phosphor-icons/react";

interface TextToolsDropdownProps {
  onToolChange: (tool: string) => void;
  activeTool?: string;
}

const TEXT_BOX_COLORS = [
  { tool: "blue-box-with-text", label: "Blue Text Box", fill: "#dbeafe", stroke: "#3b82f6" },
  { tool: "emerald-box-with-text", label: "Emerald Text Box", fill: "#d1fae5", stroke: "#10b981" },
  { tool: "amber-box-with-text", label: "Amber Text Box", fill: "#fef3c7", stroke: "#f59e0b" },
  { tool: "red-box-with-text", label: "Red Text Box", fill: "#fee2e2", stroke: "#ef4444" },
  { tool: "violet-box-with-text", label: "Violet Text Box", fill: "#ede9fe", stroke: "#8b5cf6" },
  { tool: "pink-box-with-text", label: "Pink Text Box", fill: "#fce7f3", stroke: "#ec4899" },
];

export const TextToolsDropdown = ({
  onToolChange,
  activeTool,
}: TextToolsDropdownProps) => {
  const isTextToolActive = activeTool === "text" || activeTool?.endsWith("-box-with-text");

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
          className={isTextToolActive ? toolButtonActive : toolButtonInactive}
        >
          <TextTIcon
            style={{ width: 18, height: 18 }}
            weight={isTextToolActive ? "duotone" : "bold"}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        className="w-52"
      >
        <DropdownMenuLabel>Text Tools</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onToolChange("text")}>
          <TextTIcon
            style={{ width: 18, height: 18 }}
            weight="regular"
            className="mr-2"
          />
          <span>Text</span>
          <span className="ml-auto text-xs text-muted-foreground">T</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Text Boxes</DropdownMenuLabel>
        {TEXT_BOX_COLORS.map(({ tool, label, fill, stroke }) => (
          <DropdownMenuItem key={tool} onClick={() => onToolChange(tool)}>
            <div
              className="mr-2 h-4 w-4 rounded-sm border-2"
              style={{ backgroundColor: fill, borderColor: stroke }}
            />
            <span>{label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
