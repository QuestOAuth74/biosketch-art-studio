import { FabricObject } from "fabric";

export type PortPosition = 'top' | 'right' | 'bottom' | 'left' | 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';
export type PortType = 'input' | 'output' | 'both';
// Standard markers
export type StandardMarkerType = 'none' | 'arrow' | 'open-arrow' | 'diamond' | 'circle' | 'block' | 'tee';
// Biological pathway markers
export type BiologicalMarkerType = 'inhibition' | 'activation' | 'phosphorylation' | 'binding' | 'catalysis' | 'stimulation';
export type ArrowMarkerType = StandardMarkerType | BiologicalMarkerType;
export type LineStyle = 'solid' | 'dashed' | 'dotted' | 'dash-dot';
export type RoutingStyle = 'straight' | 'curved' | 'orthogonal';

export interface Port {
  id: string;
  position: PortPosition;
  x: number; // Absolute x position
  y: number; // Absolute y position
  relX: number; // Relative position (0-1)
  relY: number; // Relative position (0-1)
  type: PortType;
  angle?: number; // For entry/exit angle
}

export interface ConnectorData {
  id: string;
  sourceShapeId?: string;
  sourcePort?: string;
  targetShapeId?: string;
  targetPort?: string;
  startMarker: ArrowMarkerType;
  endMarker: ArrowMarkerType;
  lineStyle: LineStyle;
  routingStyle: RoutingStyle;
  strokeWidth: number;
  strokeColor: string;
  waypoints?: Array<{ x: number; y: number }>;
  gradientConfig?: any; // LineGradientConfig from effects.ts
}

export interface ShapeWithPorts extends FabricObject {
  ports?: Port[];
  connectorData?: ConnectorData;
  isConnector?: boolean;
}
