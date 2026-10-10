/**
 * Canvas Icon System using Phosphor Icons
 * Provides professional, polished icons with duotone variants for active states
 */

import {
  CursorIcon,
  PenNibIcon,
  ScribbleIcon,
  TextTIcon,
  ImageIcon,
  EraserIcon,
  CropIcon,
  ShapesIcon,
  SquareIcon,
  CircleIcon,
  TriangleIcon,
  HexagonIcon,
  DiamondIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowsLeftRightIcon,
  LineSegmentIcon,
  BezierCurveIcon,
  FlowArrowIcon,
  ArrowCounterClockwiseIcon,
  ArrowClockwiseIcon,
  ScissorsIcon,
  CopyIcon,
  ClipboardTextIcon,
  TextAlignLeftIcon,
  TextAlignCenterIcon,
  TextAlignRightIcon,
  CaretDoubleUpIcon,
  CaretUpIcon,
  CaretDownIcon,
  CaretDoubleDownIcon,
  SelectionAllIcon,
  SplitVerticalIcon,
  GridFourIcon,
  RulerIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  CornersOutIcon,
  PlusIcon,
  CaretCircleDownIcon,
  LightbulbIcon,
  CommandIcon,
  FilePptIcon,
  ImageSquareIcon,
  WavesIcon,
  GitBranchIcon,
  PathIcon,
  ArrowBendRightDownIcon,
  ArrowBendDownRightIcon,
  ArrowBendUpRightIcon,
  ArrowBendRightUpIcon,
  TrendUpIcon,
  TrendDownIcon,
  TreeStructureIcon,
  ClockIcon,
  FileTextIcon,
  PaletteIcon,
  ArrowsClockwiseIcon,
  GraduationCapIcon,
  ArticleIcon,
} from "@phosphor-icons/react";

// Export regular weight icons for inactive states
export const CanvasIcons = {
  // Selection & Drawing
  cursor: CursorIcon,
  penNib: PenNibIcon,
  scribble: ScribbleIcon,
  bezierCurve: BezierCurveIcon,

  // Text & Content
  textT: TextTIcon,
  image: ImageIcon,
  imagePlus: ImageSquareIcon,
  waves: WavesIcon,

  // Tools
  eraser: EraserIcon,
  crop: CropIcon,

  // Shapes
  shapes: ShapesIcon,
  square: SquareIcon,
  circle: CircleIcon,
  triangle: TriangleIcon,
  hexagon: HexagonIcon,
  diamond: DiamondIcon,

  // Arrows
  arrowRight: ArrowRightIcon,
  arrowLeft: ArrowLeftIcon,
  arrowUp: ArrowUpIcon,
  arrowDown: ArrowDownIcon,
  arrowsLeftRight: ArrowsLeftRightIcon,

  // Lines & Connectors
  lineSegment: LineSegmentIcon,
  gitBranch: GitBranchIcon,
  path: PathIcon,
  flowArrow: FlowArrowIcon,
  treeStructure: TreeStructureIcon,

  // Bend arrows
  arrowBendRightDown: ArrowBendRightDownIcon,
  arrowBendDownRight: ArrowBendDownRightIcon,
  arrowBendUpRight: ArrowBendUpRightIcon,
  arrowBendRightUp: ArrowBendRightUpIcon,
  trendUp: TrendUpIcon,
  trendDown: TrendDownIcon,

  // Edit Actions
  undo: ArrowCounterClockwiseIcon,
  redo: ArrowClockwiseIcon,
  scissors: ScissorsIcon,
  copy: CopyIcon,
  clipboard: ClipboardTextIcon,

  // Alignment
  alignLeft: TextAlignLeftIcon,
  alignCenter: TextAlignCenterIcon,
  alignRight: TextAlignRightIcon,

  // Layer Controls
  bringToFront: CaretDoubleUpIcon,
  bringForward: CaretUpIcon,
  sendBackward: CaretDownIcon,
  sendToBack: CaretDoubleDownIcon,

  // Grouping
  group: SelectionAllIcon,
  ungroup: SplitVerticalIcon,

  // View Options
  grid: GridFourIcon,
  ruler: RulerIcon,

  // Zoom
  zoomIn: MagnifyingGlassPlusIcon,
  zoomOut: MagnifyingGlassMinusIcon,
  fitScreen: CornersOutIcon,

  // Bottom Bar
  plus: PlusIcon,
  caretDown: CaretCircleDownIcon,
  lightbulb: LightbulbIcon,
  command: CommandIcon,

  // Export
  filePpt: FilePptIcon,
  fileText: FileTextIcon,

  // Tools menu
  palette: PaletteIcon,
  refresh: ArrowsClockwiseIcon,
  graduationCap: GraduationCapIcon,
  clock: ClockIcon,
  article: ArticleIcon,
} as const;

// Type for icon names
export type CanvasIconName = keyof typeof CanvasIcons;

// Helper to get icon component
export const getCanvasIcon = (name: CanvasIconName) => CanvasIcons[name];
