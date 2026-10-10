import { FabricObject, Circle } from "fabric";
import { Port, PortPosition, ShapeWithPorts } from "@/types/connector";

// Calculate ports for a shape based on its geometry
export function calculateShapePorts(shape: FabricObject): Port[] {
  const ports: Port[] = [];
  const width = (shape.width || 100) * (shape.scaleX || 1);
  const height = (shape.height || 100) * (shape.scaleY || 1);
  const left = shape.left || 0;
  const top = shape.top || 0;
  const centerX = left + width / 2;
  const centerY = top + height / 2;

  // Define 8 connection points
  const portDefinitions: Array<{ pos: PortPosition; relX: number; relY: number }> = [
    { pos: 'top', relX: 0.5, relY: 0 },
    { pos: 'right', relX: 1, relY: 0.5 },
    { pos: 'bottom', relX: 0.5, relY: 1 },
    { pos: 'left', relX: 0, relY: 0.5 },
    { pos: 'top-left', relX: 0, relY: 0 },
    { pos: 'top-right', relX: 1, relY: 0 },
    { pos: 'bottom-right', relX: 1, relY: 1 },
    { pos: 'bottom-left', relX: 0, relY: 1 },
  ];

  portDefinitions.forEach(({ pos, relX, relY }) => {
    ports.push({
      id: `${shape.get('id') || 'shape'}-${pos}`,
      position: pos,
      x: left + width * relX,
      y: top + height * relY,
      relX,
      relY,
      type: 'both',
    });
  });

  return ports;
}

// Find the nearest port to a given point
export function findNearestPort(
  shape: FabricObject,
  point: { x: number; y: number },
  maxDistance: number = 30
): Port | null {
  const ports = calculateShapePorts(shape);
  let nearestPort: Port | null = null;
  let minDistance = maxDistance;

  ports.forEach(port => {
    const distance = Math.sqrt(
      Math.pow(port.x - point.x, 2) + Math.pow(port.y - point.y, 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      nearestPort = port;
    }
  });

  return nearestPort;
}

// Show visual indicators for connection ports
export function showPortIndicators(
  shape: FabricObject,
  canvas: any,
  activePort?: Port | null
): Circle[] {
  const ports = calculateShapePorts(shape);
  const indicators: Circle[] = [];

  ports.forEach(port => {
    const indicator = new Circle({
      left: port.x,
      top: port.y,
      radius: 5,
      fill: activePort?.id === port.id ? '#0D9488' : '#ffffff',
      stroke: '#0D9488',
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
    } as any);

    // Mark as ephemeral UI so we can hide on export
    (indicator as any).isPortIndicator = true;
    (indicator as any).isFeedback = true;

    canvas.add(indicator);
    indicators.push(indicator);
  });

  return indicators;
}

// Remove port indicators from canvas
export function hidePortIndicators(canvas: any, indicators: Circle[]): void {
  indicators.forEach(indicator => {
    canvas.remove(indicator);
  });
}

// Update ports when a shape is moved or resized
export function updateShapePorts(shape: ShapeWithPorts): void {
  if (!shape.ports) {
    shape.ports = calculateShapePorts(shape);
  } else {
    shape.ports = calculateShapePorts(shape);
  }
}

// Get entry/exit angle for a port (useful for routing)
export function getPortAngle(port: Port): number {
  const angleMap: Record<PortPosition, number> = {
    'top': -90,
    'right': 0,
    'bottom': 90,
    'left': 180,
    'top-left': -135,
    'top-right': -45,
    'bottom-right': 45,
    'bottom-left': 135,
  };
  return angleMap[port.position] || 0;
}

// Choose best ports based on relative positions
export function choosePortsByDirection(
  fromShape: FabricObject,
  toShape: FabricObject,
  preferredPorts?: { from: string; to: string }
): { sourcePort: Port; targetPort: Port } {
  const fromPorts = calculateShapePorts(fromShape);
  const toPorts = calculateShapePorts(toShape);
  
  // If preferred ports specified, try to use them
  if (preferredPorts) {
    const sourcePort = fromPorts.find(p => p.position === preferredPorts.from);
    const targetPort = toPorts.find(p => p.position === preferredPorts.to);
    if (sourcePort && targetPort) {
      return { sourcePort, targetPort };
    }
  }
  
  // Otherwise, choose based on relative positions
  const fromCenterX = (fromShape.left || 0) + ((fromShape.width || 0) * (fromShape.scaleX || 1)) / 2;
  const fromCenterY = (fromShape.top || 0) + ((fromShape.height || 0) * (fromShape.scaleY || 1)) / 2;
  const toCenterX = (toShape.left || 0) + ((toShape.width || 0) * (toShape.scaleX || 1)) / 2;
  const toCenterY = (toShape.top || 0) + ((toShape.height || 0) * (toShape.scaleY || 1)) / 2;
  
  const dx = toCenterX - fromCenterX;
  const dy = toCenterY - fromCenterY;
  
  // Determine primary direction
  let sourcePortName: PortPosition;
  let targetPortName: PortPosition;
  
  if (Math.abs(dy) > Math.abs(dx)) {
    // Vertical connection
    if (dy > 0) {
      sourcePortName = 'bottom';
      targetPortName = 'top';
    } else {
      sourcePortName = 'top';
      targetPortName = 'bottom';
    }
  } else {
    // Horizontal connection
    if (dx > 0) {
      sourcePortName = 'right';
      targetPortName = 'left';
    } else {
      sourcePortName = 'left';
      targetPortName = 'right';
    }
  }
  
  const sourcePort = fromPorts.find(p => p.position === sourcePortName) || fromPorts[1];
  const targetPort = toPorts.find(p => p.position === targetPortName) || toPorts[3];
  
  return { sourcePort, targetPort };
}

// Find specific port position by name
export function findPortPosition(shape: FabricObject, portName: string): { x: number; y: number } {
  const ports = calculateShapePorts(shape);
  const port = ports.find(p => p.position === portName);
  
  if (!port) {
    console.warn(`Port ${portName} not found on shape, using center`);
    const width = (shape.width || 100) * (shape.scaleX || 1);
    const height = (shape.height || 100) * (shape.scaleY || 1);
    return {
      x: (shape.left || 0) + width / 2,
      y: (shape.top || 0) + height / 2
    };
  }
  
  return { x: port.x, y: port.y };
}
