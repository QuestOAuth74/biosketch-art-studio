import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, Circle, Square } from "lucide-react";

interface ShapesWithTextDropdownProps {
  onShapeSelect: (shape: string) => void;
  activeTool?: string;
}

export const ShapesWithTextDropdown = ({ onShapeSelect, activeTool }: ShapesWithTextDropdownProps) => {
  const shapesWithTextTools = ['blue-box-with-text', 'emerald-box-with-text', 'amber-box-with-text', 'red-box-with-text', 'violet-box-with-text', 'pink-box-with-text', 'protein-with-text', 'enzyme-with-text', 'receptor-with-text', 'rna-with-text', 'dna-with-text', 'camp-with-text', 'atp-with-text', 'kinase-with-text'];
  const isActive = activeTool ? shapesWithTextTools.includes(activeTool) : false;

  const handleShapeClick = (shape: string) => {
    onShapeSelect(shape);
  };

  const toolButtonBase = "w-8 h-8 flex-shrink-0 rounded-md transition-all duration-150 hover:scale-105";
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
          <FileText style={{ width: 18, height: 18 }} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" className="w-56 bg-card z-50">
        <DropdownMenuLabel>Text Boxes</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => handleShapeClick("blue-box-with-text")}>
            <div className="mr-2 h-4 w-4 rounded-sm border-2" style={{ backgroundColor: '#dbeafe', borderColor: '#3b82f6' }} />
            <span>Blue Text Box</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("emerald-box-with-text")}>
            <div className="mr-2 h-4 w-4 rounded-sm border-2" style={{ backgroundColor: '#d1fae5', borderColor: '#10b981' }} />
            <span>Emerald Text Box</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("amber-box-with-text")}>
            <div className="mr-2 h-4 w-4 rounded-sm border-2" style={{ backgroundColor: '#fef3c7', borderColor: '#f59e0b' }} />
            <span>Amber Text Box</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("red-box-with-text")}>
            <div className="mr-2 h-4 w-4 rounded-sm border-2" style={{ backgroundColor: '#fee2e2', borderColor: '#ef4444' }} />
            <span>Red Text Box</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("violet-box-with-text")}>
            <div className="mr-2 h-4 w-4 rounded-sm border-2" style={{ backgroundColor: '#ede9fe', borderColor: '#8b5cf6' }} />
            <span>Violet Text Box</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("pink-box-with-text")}>
            <div className="mr-2 h-4 w-4 rounded-sm border-2" style={{ backgroundColor: '#fce7f3', borderColor: '#ec4899' }} />
            <span>Pink Text Box</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuLabel>Biological Entities</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => handleShapeClick("protein-with-text")}>
            <Square className="mr-2 h-4 w-4" />
            <span>Protein</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("enzyme-with-text")}>
            <Circle className="mr-2 h-4 w-4" />
            <span>Enzyme</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("receptor-with-text")}>
            <Square className="mr-2 h-4 w-4" />
            <span>Receptor</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("rna-with-text")}>
            <Square className="mr-2 h-4 w-4" />
            <span>RNA</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("dna-with-text")}>
            <Square className="mr-2 h-4 w-4" />
            <span>DNA</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("camp-with-text")}>
            <Circle className="mr-2 h-4 w-4" />
            <span>cAMP</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("atp-with-text")}>
            <Circle className="mr-2 h-4 w-4" />
            <span>ATP</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("kinase-with-text")}>
            <Square className="mr-2 h-4 w-4" />
            <span>Protein Kinase</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};