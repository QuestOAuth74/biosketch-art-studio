import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ShapesIcon,
} from "@phosphor-icons/react";
import { CanvasEditorTestIds } from "@/lib/test-ids";

interface ShapesDropdownProps {
  onShapeSelect: (shape: string) => void;
  activeTool?: string;
}

export const ShapesDropdown = ({ onShapeSelect, activeTool }: ShapesDropdownProps) => {
  // Define tools that should NOT activate the shapes dropdown
  const nonShapeTools = ['select', 'text', 'pen', 'freeform-line', 'eraser', 'image', 'membrane-path', 'chart', 'comment'];
  const nonShapeToolPrefixes = ['connector-', 'line-', 'straight-line', 'orthogonal-line', 'curved-line', 'membrane-brush', 'leader-line', 'bracket'];

  // Include labeled shapes tools in the active check
  const shapesWithTextTools = ['blue-box-with-text', 'emerald-box-with-text', 'amber-box-with-text', 'red-box-with-text', 'violet-box-with-text', 'pink-box-with-text', 'protein-with-text', 'enzyme-with-text', 'receptor-with-text', 'rna-with-text', 'dna-with-text', 'camp-with-text', 'atp-with-text', 'kinase-with-text'];

  const isShapeActive = activeTool
    ? (!nonShapeTools.includes(activeTool) &&
      !nonShapeToolPrefixes.some(prefix => activeTool.startsWith(prefix))) ||
      shapesWithTextTools.includes(activeTool)
    : false;

  const handleShapeClick = (shape: string) => {
    onShapeSelect(shape);
  };

  const toolButtonBase = "w-8 h-8 flex-shrink-0 rounded-md transition-all duration-150 hover:scale-105";
  const toolButtonActive = `${toolButtonBase} bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30`;
  const toolButtonInactive = `${toolButtonBase} text-muted-foreground hover:text-foreground hover:bg-blue-200/60 hover:shadow-sm`;

  // Inline SVG shape preview components
  const svgProps = { width: 18, height: 18, className: "mr-2", fill: "none", stroke: "currentColor", strokeWidth: 1.5 };

  const RectanglePreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <rect x="1" y="3" width="16" height="12" />
    </svg>
  );

  const SquarePreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <rect x="2" y="2" width="14" height="14" />
    </svg>
  );

  const RoundedRectPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <rect x="1" y="3" width="16" height="12" rx="3" ry="3" />
    </svg>
  );

  const CirclePreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="7" />
    </svg>
  );

  const EllipsePreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <ellipse cx="9" cy="9" rx="8" ry="5" />
    </svg>
  );

  const TrianglePreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <polygon points="9,1 17,16 1,16" />
    </svg>
  );

  const RightTrianglePreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <polygon points="1,16 17,16 1,2" />
    </svg>
  );

  const PentagonPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <polygon points="9,1 17,7 14.5,16 3.5,16 1,7" />
    </svg>
  );

  const HexagonPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <polygon points="5,1 13,1 17,9 13,17 5,17 1,9" />
    </svg>
  );

  const OctagonPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <polygon points="6,1 12,1 17,6 17,12 12,17 6,17 1,12 1,6" />
    </svg>
  );

  const StarPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <polygon points="9,1 11,6.5 17,7 12.5,11 14,17 9,13.5 4,17 5.5,11 1,7 7,6.5" />
    </svg>
  );

  const RhombusPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <polygon points="9,1 17,9 9,17 1,9" />
    </svg>
  );

  const ParallelogramPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <polygon points="5,3 17,3 13,15 1,15" />
    </svg>
  );

  const TrapezoidPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <polygon points="4,3 14,3 17,15 1,15" />
    </svg>
  );

  const CustomPolygonPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <polygon points="3,2 15,4 16,10 11,16 2,13" />
    </svg>
  );

  const ArrowRightPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <polygon points="1,6 11,6 11,2 17,9 11,16 11,12 1,12" />
    </svg>
  );

  const ArrowLeftPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <polygon points="17,6 7,6 7,2 1,9 7,16 7,12 17,12" />
    </svg>
  );

  const ArrowUpPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <polygon points="6,17 6,7 2,7 9,1 16,7 12,7 12,17" />
    </svg>
  );

  const ArrowDownPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <polygon points="6,1 12,1 12,11 16,11 9,17 2,11 6,11" />
    </svg>
  );

  const DoubleArrowPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <polygon points="1,9 5,3 5,6 13,6 13,3 17,9 13,15 13,12 5,12 5,15" />
    </svg>
  );

  const ThickArrowPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <polygon points="1,5 10,5 10,1 17,9 10,17 10,13 1,13" />
    </svg>
  );

  // Colored text box previews
  const ColoredBoxPreview = ({ fill, stroke }: { fill: string; stroke: string }) => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <rect x="1" y="2" width="16" height="14" rx="3" ry="3" fill={fill} stroke={stroke} strokeWidth="1.5" />
      <line x1="4" y1="7" x2="14" y2="7" stroke={stroke} strokeWidth="1.5" />
      <line x1="4" y1="11" x2="12" y2="11" stroke={stroke} strokeWidth="0.8" opacity="0.5" />
    </svg>
  );

  // Biological entity previews
  const ProteinPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <rect x="1" y="3" width="16" height="12" rx="3" ry="3" />
      <text x="9" y="12" textAnchor="middle" fontSize="5" fill="currentColor" stroke="none" fontWeight="bold">Pro</text>
    </svg>
  );

  const EnzymePreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <ellipse cx="9" cy="9" rx="8" ry="6" />
      <text x="9" y="11" textAnchor="middle" fontSize="5" fill="currentColor" stroke="none" fontWeight="bold">Enz</text>
    </svg>
  );

  const ReceptorPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <rect x="5" y="1" width="8" height="16" />
      <text x="9" y="11" textAnchor="middle" fontSize="4.5" fill="currentColor" stroke="none" fontWeight="bold">Rec</text>
    </svg>
  );

  const RNAPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <rect x="1" y="4" width="16" height="10" rx="2" ry="2" />
      <text x="9" y="12" textAnchor="middle" fontSize="5.5" fill="currentColor" stroke="none" fontWeight="bold">RNA</text>
    </svg>
  );

  const DNAPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <rect x="1" y="3" width="16" height="12" />
      <text x="9" y="12" textAnchor="middle" fontSize="5.5" fill="currentColor" stroke="none" fontWeight="bold">DNA</text>
    </svg>
  );

  const CAMPPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="7" />
      <text x="9" y="11" textAnchor="middle" fontSize="4.5" fill="currentColor" stroke="none" fontWeight="bold">cAMP</text>
    </svg>
  );

  const ATPPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="7" />
      <text x="9" y="11" textAnchor="middle" fontSize="5.5" fill="currentColor" stroke="none" fontWeight="bold">ATP</text>
    </svg>
  );

  const KinasePreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <rect x="0.5" y="3" width="17" height="12" rx="3" ry="3" />
      <text x="9" y="11" textAnchor="middle" fontSize="4" fill="currentColor" stroke="none" fontWeight="bold">PK</text>
    </svg>
  );

  // Flowchart shape previews
  const ProcessPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <rect x="1" y="3" width="16" height="12" />
    </svg>
  );

  const DecisionPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <polygon points="9,1 17,9 9,17 1,9" />
    </svg>
  );

  const DataPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <polygon points="5,3 17,3 13,15 1,15" />
    </svg>
  );

  const TerminatorPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <rect x="1" y="4" width="16" height="10" rx="5" ry="5" />
    </svg>
  );

  const DocumentPreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <path d="M2,2 L16,2 L16,13 Q12,16 9,13 Q6,10 2,13 Z" />
    </svg>
  );

  const DatabasePreview = () => (
    <svg {...svgProps} viewBox="0 0 18 18">
      <ellipse cx="9" cy="4" rx="7" ry="2.5" />
      <path d="M2,4 L2,14" />
      <path d="M16,4 L16,14" />
      <ellipse cx="9" cy="14" rx="7" ry="2.5" />
    </svg>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={isShapeActive ? toolButtonActive : toolButtonInactive}
          data-testid={CanvasEditorTestIds.SHAPES_DROPDOWN}
        >
          <ShapesIcon style={{ width: 18, height: 18 }} weight={isShapeActive ? "duotone" : "bold"} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" className="w-56 max-h-[500px] overflow-y-auto bg-card z-50">
        <DropdownMenuLabel>Basic Shapes</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => handleShapeClick("rectangle")} data-testid={CanvasEditorTestIds.RECTANGLE_TOOL}>
            <RectanglePreview />
            <span>Rectangle</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("square")}>
            <SquarePreview />
            <span>Square</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("rounded-rect")}>
            <RoundedRectPreview />
            <span>Rounded Rectangle</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("circle")} data-testid={CanvasEditorTestIds.CIRCLE_TOOL}>
            <CirclePreview />
            <span>Circle</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("ellipse")}>
            <EllipsePreview />
            <span>Ellipse</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("triangle")}>
            <TrianglePreview />
            <span>Triangle</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("right-triangle")}>
            <RightTrianglePreview />
            <span>Right Triangle</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Polygons</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => handleShapeClick("pentagon")}>
            <PentagonPreview />
            <span>Pentagon</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("hexagon")}>
            <HexagonPreview />
            <span>Hexagon</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("octagon")}>
            <OctagonPreview />
            <span>Octagon</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("star")}>
            <StarPreview />
            <span>Star</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("rhombus")}>
            <RhombusPreview />
            <span>Rhombus</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("parallelogram")}>
            <ParallelogramPreview />
            <span>Parallelogram</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("trapezoid")}>
            <TrapezoidPreview />
            <span>Trapezoid</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Custom Shapes</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => handleShapeClick("custom-polygon")}>
            <CustomPolygonPreview />
            <span>Custom Polygon</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Arrows</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => handleShapeClick("arrow-right")}>
            <ArrowRightPreview />
            <span>Arrow Right</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("arrow-left")}>
            <ArrowLeftPreview />
            <span>Arrow Left</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("arrow-up")}>
            <ArrowUpPreview />
            <span>Arrow Up</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("arrow-down")}>
            <ArrowDownPreview />
            <span>Arrow Down</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("arrow-double-h")}>
            <DoubleArrowPreview />
            <span>Double Arrow (Horizontal)</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("arrow-thick")}>
            <ThickArrowPreview />
            <span>Thick Arrow</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Text Boxes</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => handleShapeClick("blue-box-with-text")}>
            <ColoredBoxPreview fill="#dbeafe" stroke="#3b82f6" />
            <span>Blue Text Box</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("emerald-box-with-text")}>
            <ColoredBoxPreview fill="#d1fae5" stroke="#10b981" />
            <span>Emerald Text Box</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("amber-box-with-text")}>
            <ColoredBoxPreview fill="#fef3c7" stroke="#f59e0b" />
            <span>Amber Text Box</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("red-box-with-text")}>
            <ColoredBoxPreview fill="#fee2e2" stroke="#ef4444" />
            <span>Red Text Box</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("violet-box-with-text")}>
            <ColoredBoxPreview fill="#ede9fe" stroke="#8b5cf6" />
            <span>Violet Text Box</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("pink-box-with-text")}>
            <ColoredBoxPreview fill="#fce7f3" stroke="#ec4899" />
            <span>Pink Text Box</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Biological Entities</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => handleShapeClick("protein-with-text")}>
            <ProteinPreview />
            <span>Protein</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("enzyme-with-text")}>
            <EnzymePreview />
            <span>Enzyme</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("receptor-with-text")}>
            <ReceptorPreview />
            <span>Receptor</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("rna-with-text")}>
            <RNAPreview />
            <span>RNA</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("dna-with-text")}>
            <DNAPreview />
            <span>DNA</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("camp-with-text")}>
            <CAMPPreview />
            <span>cAMP</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("atp-with-text")}>
            <ATPPreview />
            <span>ATP</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("kinase-with-text")}>
            <KinasePreview />
            <span>Protein Kinase</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Flowchart Shapes</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => handleShapeClick("process")}>
            <ProcessPreview />
            <span>Process</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("decision")}>
            <DecisionPreview />
            <span>Decision</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("data")}>
            <DataPreview />
            <span>Data</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("terminator")}>
            <TerminatorPreview />
            <span>Terminator</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("document")}>
            <DocumentPreview />
            <span>Document</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShapeClick("database")}>
            <DatabasePreview />
            <span>Database</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
