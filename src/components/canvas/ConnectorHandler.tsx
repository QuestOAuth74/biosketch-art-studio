import { useState, useEffect } from "react";
import { Canvas as FabricCanvas, Circle } from "fabric";
import { createConnector } from "@/lib/connectorSystem";
import { showPortIndicators, hidePortIndicators, findNearestPort } from "@/lib/portManager";
import { ArrowMarkerType, LineStyle, RoutingStyle } from "@/types/connector";
import { toast } from "sonner";

interface ConnectorState {
  isDrawing: boolean;
  startX: number | null;
  startY: number | null;
  startShapeId: string | null;
  startPortId: string | null;
  portIndicators: Circle[];
}

export const useConnectorTool = (
  canvas: FabricCanvas | null,
  activeTool: string
) => {
  const [connectorState, setConnectorState] = useState<ConnectorState>({
    isDrawing: false,
    startX: null,
    startY: null,
    startShapeId: null,
    startPortId: null,
    portIndicators: [],
  });

  useEffect(() => {
    if (!canvas || !activeTool.startsWith('connector-')) return;

    // Determine connector properties from tool name
    const getConnectorProps = (): {
      startMarker: ArrowMarkerType;
      endMarker: ArrowMarkerType;
      lineStyle: LineStyle;
      routingStyle: RoutingStyle;
    } => {
      switch (activeTool) {
        case 'connector-straight':
          return {
            startMarker: 'none',
            endMarker: 'arrow',
            lineStyle: 'solid',
            routingStyle: 'straight',
          };
        case 'connector-curved':
          return {
            startMarker: 'none',
            endMarker: 'arrow',
            lineStyle: 'solid',
            routingStyle: 'curved',
          };
        case 'connector-orthogonal':
          return {
            startMarker: 'none',
            endMarker: 'arrow',
            lineStyle: 'solid',
            routingStyle: 'orthogonal',
          };
        case 'line-arrow':
          return {
            startMarker: 'none',
            endMarker: 'arrow',
            lineStyle: 'solid',
            routingStyle: 'straight',
          };
        case 'line-double-arrow':
          return {
            startMarker: 'arrow',
            endMarker: 'arrow',
            lineStyle: 'solid',
            routingStyle: 'straight',
          };
        case 'line-plain':
          return {
            startMarker: 'none',
            endMarker: 'none',
            lineStyle: 'solid',
            routingStyle: 'straight',
          };
        case 'line-circle-arrow':
          return {
            startMarker: 'circle',
            endMarker: 'arrow',
            lineStyle: 'solid',
            routingStyle: 'straight',
          };
        case 'line-diamond':
          return {
            startMarker: 'diamond',
            endMarker: 'none',
            lineStyle: 'solid',
            routingStyle: 'straight',
          };
        default:
          return {
            startMarker: 'none',
            endMarker: 'arrow',
            lineStyle: 'solid',
            routingStyle: 'straight',
          };
      }
    };

    const handleMouseDown = (e: any) => {
      const pointer = canvas.getPointer(e.e);
      
      // Start drawing connector
      setConnectorState({
        isDrawing: true,
        startX: pointer.x,
        startY: pointer.y,
        startShapeId: null,
        startPortId: null,
        portIndicators: [],
      });

      canvas.selection = false; // Disable selection while drawing
      toast.info("Click to set end point");
    };

    const handleMouseUp = (e: any) => {
      if (!connectorState.isDrawing || connectorState.startX === null || connectorState.startY === null) {
        return;
      }

      const pointer = canvas.getPointer(e.e);
      const props = getConnectorProps();

      // Create the connector
      createConnector(canvas, {
        startX: connectorState.startX,
        startY: connectorState.startY,
        endX: pointer.x,
        endY: pointer.y,
        ...props,
      });

      // Reset state
      setConnectorState({
        isDrawing: false,
        startX: null,
        startY: null,
        startShapeId: null,
        startPortId: null,
        portIndicators: [],
      });

      canvas.selection = true;
      canvas.requestRenderAll();
      toast.success("Connector created!");
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:up', handleMouseUp);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:up', handleMouseUp);
      canvas.selection = true;
    };
  }, [canvas, activeTool, connectorState.isDrawing, connectorState.startX, connectorState.startY]);

  return connectorState;
};
