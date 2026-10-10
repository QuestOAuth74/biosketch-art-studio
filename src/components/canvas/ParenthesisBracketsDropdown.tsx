import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BracketsSquareIcon } from "@phosphor-icons/react";

interface ParenthesisBracketsDropdownProps {
  onShapeSelect: (shape: string) => void;
  activeTool?: string;
}

export const ParenthesisBracketsDropdown = ({
  onShapeSelect,
  activeTool,
}: ParenthesisBracketsDropdownProps) => {
  const bracketTools = [
    "paren-left",
    "paren-right",
    "paren-top",
    "paren-bottom",
    "bracket-left",
    "bracket-right",
    "bracket-top",
    "bracket-bottom",
    "paren-left-arrow",
    "paren-right-arrow",
  ];
  const isActive = activeTool ? bracketTools.includes(activeTool) : false;

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
        >
          <BracketsSquareIcon
            style={{ width: 18, height: 18 }}
            weight={isActive ? "duotone" : "bold"}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        className="w-56 bg-card z-50"
      >
        <DropdownMenuLabel>Parenthesis and Brackets</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onShapeSelect("paren-left")}>
          <span className="mr-2 text-lg">(</span>
          <span>Left Parenthesis (</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onShapeSelect("paren-right")}>
          <span className="mr-2 text-lg">)</span>
          <span>Right Parenthesis )</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onShapeSelect("paren-top")}>
          <span className="mr-2 text-lg">⌢</span>
          <span>Top Parenthesis ⌢</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onShapeSelect("paren-bottom")}>
          <span className="mr-2 text-lg">⌣</span>
          <span>Bottom Parenthesis ⌣</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onShapeSelect("bracket-left")}>
          <span className="mr-2 text-lg">[</span>
          <span>Left Bracket [</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onShapeSelect("bracket-right")}>
          <span className="mr-2 text-lg">]</span>
          <span>Right Bracket ]</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onShapeSelect("bracket-top")}>
          <span className="mr-2 text-lg">⊤</span>
          <span>Top Bracket ⊤</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onShapeSelect("bracket-bottom")}>
          <span className="mr-2 text-lg">⊥</span>
          <span>Bottom Bracket ⊥</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onShapeSelect("paren-left-arrow")}>
          <span className="mr-2 text-lg">(→</span>
          <span>Left Paren Arrow (→</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onShapeSelect("paren-right-arrow")}>
          <span className="mr-2 text-lg">)→</span>
          <span>Right Paren Arrow )→</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
