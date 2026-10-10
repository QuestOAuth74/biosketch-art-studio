import { Canvas as FabricCanvas, Circle, Textbox, Group, Rect, FabricObject } from "fabric";

export interface NumberedCalloutData {
  calloutNumber: number;
  calloutId: string;
  calloutLabel: string;
}

export interface NumberedCalloutOptions {
  number: number;
  left?: number;
  top?: number;
  radius?: number;
  circleStroke?: string;
  circleFill?: string;
  textColor?: string;
  fontSize?: number;
}

interface CalloutRegistryEntry {
  id: string;
  number: number;
  group: Group;
}

/**
 * Creates a numbered callout (circle with number)
 */
export const createNumberedCallout = (options: NumberedCalloutOptions): Group => {
  const radius = options.radius || 15;
  const circleStroke = options.circleStroke || "#3b82f6";
  const circleFill = options.circleFill || "rgba(59, 130, 246, 0.1)";
  const textColor = options.textColor || "#000000";
  const fontSize = options.fontSize || 16;

  // Create circle
  const circle = new Circle({
    radius: radius,
    fill: circleFill,
    stroke: circleStroke,
    strokeWidth: 2,
    strokeUniform: true,
    left: 0,
    top: 0,
    selectable: false,
    evented: false,
  });

  // Create number text
  const numberText = new Textbox(options.number.toString(), {
    fontSize: fontSize,
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fill: textColor,
    textAlign: "center",
    width: radius * 2,
    left: 0,
    top: radius - fontSize / 2,
    selectable: false,
    evented: false,
    fontWeight: "bold",
  });

  // Create group
  const group = new Group([circle, numberText], {
    left: options.left || 100,
    top: options.top || 100,
    subTargetCheck: false, // Don't allow selecting individual elements
  });

  // Add custom properties
  const calloutId = `callout-${Date.now()}-${Math.random()}`;
  (group as any).customType = "numbered-callout";
  (group as any).calloutNumber = options.number;
  (group as any).calloutId = calloutId;
  (group as any).calloutLabel = `Item ${options.number}`;

  // Ensure custom properties are serialized when saving to JSON
  group.set('customType', 'numbered-callout');
  group.set('calloutNumber', options.number);
  group.set('calloutId', calloutId);
  group.set('calloutLabel', `Item ${options.number}`);

  // Override toObject to ensure custom properties are included in JSON
  const originalToObject = group.toObject.bind(group);
  group.toObject = function(propertiesToInclude?: string[]) {
    return originalToObject([
      'customType',
      'calloutNumber',
      'calloutId',
      'calloutLabel',
      ...(propertiesToInclude || [])
    ]);
  };

  return group;
};

/**
 * Gets the next callout number to use
 */
export const getNextCalloutNumber = (canvas: FabricCanvas): number => {
  // Initialize counter if not exists
  if (typeof (canvas as any).calloutCounter === 'undefined') {
    (canvas as any).calloutCounter = 0;
  }

  return ++(canvas as any).calloutCounter;
};

/**
 * Registers a callout in the canvas registry
 */
export const registerCallout = (canvas: FabricCanvas, callout: Group): void => {
  // Initialize registry if not exists
  if (!(canvas as any).calloutRegistry) {
    (canvas as any).calloutRegistry = new Map<string, CalloutRegistryEntry>();
  }

  const registry = (canvas as any).calloutRegistry as Map<string, CalloutRegistryEntry>;
  const calloutId = (callout as any).calloutId;
  const calloutNumber = (callout as any).calloutNumber;

  registry.set(calloutId, {
    id: calloutId,
    number: calloutNumber,
    group: callout,
  });
};

/**
 * Renumbers all callouts sequentially after a deletion
 */
export const renumberCallouts = (canvas: FabricCanvas): void => {
  const registry = (canvas as any).calloutRegistry as Map<string, CalloutRegistryEntry> | undefined;
  if (!registry) return;

  // Get all callouts and sort by ID (creation order)
  const callouts = Array.from(registry.values()).sort((a, b) =>
    a.id.localeCompare(b.id)
  );

  // Renumber each callout
  callouts.forEach((entry, index) => {
    const newNumber = index + 1;
    updateCalloutNumber(entry.group, newNumber);
    entry.number = newNumber;
  });

  // Update counter
  (canvas as any).calloutCounter = callouts.length;
};

/**
 * Updates the number displayed in a callout
 */
const updateCalloutNumber = (group: Group, newNumber: number): void => {
  if (!isCallout(group)) return;

  // Update the text element (second element in group)
  const textbox = group.getObjects()[1] as Textbox;
  if (textbox) {
    textbox.set({ text: newNumber.toString() });
  }

  // Update custom properties
  (group as any).calloutNumber = newNumber;

  group.dirty = true;
  group.setCoords();
};

/**
 * Creates or updates the legend for all callouts
 */
export const createOrUpdateLegend = (canvas: FabricCanvas): void => {
  const registry = (canvas as any).calloutRegistry as Map<string, CalloutRegistryEntry> | undefined;
  if (!registry || registry.size === 0) {
    // Remove legend if no callouts
    removeLegend(canvas);
    return;
  }

  // Find existing legend
  const existingLegend = canvas.getObjects().find(obj =>
    (obj as any).customType === 'callout-legend'
  ) as Group | undefined;

  // Check if user has explicitly hidden the legend
  const wasHidden = existingLegend ? (existingLegend as any).legendHidden === true : (canvas as any).legendHidden === true;

  // Get all callouts sorted by number
  const callouts = Array.from(registry.values()).sort((a, b) => a.number - b.number);

  const legendWidth = 220;
  const rowHeight = 30;
  const legendHeight = Math.max(60, callouts.length * rowHeight + 20);
  const circleRadius = 12;
  const leftMargin = 15;
  const topMargin = 15;

  // Remove existing legend to rebuild
  if (existingLegend) {
    const legendPos = { left: existingLegend.left, top: existingLegend.top };
    const legendHidden = (existingLegend as any).legendHidden || false;
    // If legendHidden is true, force visible to false; otherwise use the visible property
    const legendVisible = legendHidden ? false : (existingLegend.visible !== false);

    // Suppress rendering during rebuild to prevent flash
    const prevRenderOnAddRemove = canvas.renderOnAddRemove;
    canvas.renderOnAddRemove = false;

    canvas.remove(existingLegend);

    // Create new legend at same position with preserved visibility
    const newLegend = buildLegend(callouts, legendWidth, legendHeight, circleRadius, leftMargin, topMargin);
    newLegend.set({
      left: legendPos.left,
      top: legendPos.top,
      visible: legendVisible
    });
    (newLegend as any).legendHidden = legendHidden;
    canvas.add(newLegend);

    // Restore rendering behavior
    canvas.renderOnAddRemove = prevRenderOnAddRemove;
  } else {
    // Create new legend
    const legendGroup = buildLegend(callouts, legendWidth, legendHeight, circleRadius, leftMargin, topMargin);
    legendGroup.set({
      left: canvas.width! - legendWidth - 30,
      top: canvas.height! - legendHeight - 30,
      visible: !wasHidden // Respect user's previous choice
    });
    (legendGroup as any).legendHidden = wasHidden;
    canvas.add(legendGroup);
  }

  canvas.requestRenderAll();
};

/**
 * Builds the legend group with circles and editable labels
 */
function buildLegend(
  callouts: CalloutRegistryEntry[],
  legendWidth: number,
  legendHeight: number,
  circleRadius: number,
  leftMargin: number,
  topMargin: number
): Group {
  const elements: FabricObject[] = [];

  // Background frame
  const frame = new Rect({
    width: legendWidth,
    height: legendHeight,
    fill: "rgba(255, 255, 255, 0.95)",
    stroke: "#9ca3af",
    strokeWidth: 1,
    strokeUniform: true,
    left: 0,
    top: 0,
    selectable: false,
    evented: false,
  });
  elements.push(frame);

  // Create legend entries
  const rowHeight = 30;
  callouts.forEach((entry, index) => {
    const yPos = topMargin + index * rowHeight;

    // Get styling from the actual callout
    const calloutGroup = entry.group;
    const calloutObjects = calloutGroup.getObjects();
    const calloutCircle = calloutObjects[0] as Circle; // First element is the circle
    const calloutNumberText = calloutObjects[1] as Textbox; // Second element is the number text

    // Extract styles from the callout
    // Handle both direct properties and get() method
    // Don't use fallbacks - we want to show the actual current state, even if empty
    const circleFill = calloutCircle?.get ? calloutCircle.get('fill') : calloutCircle?.fill;
    const circleStroke = calloutCircle?.get ? calloutCircle.get('stroke') : calloutCircle?.stroke;
    const circleStrokeWidth = calloutCircle?.get ? calloutCircle.get('strokeWidth') : calloutCircle?.strokeWidth;
    const numberFill = calloutNumberText?.get ? calloutNumberText.get('fill') : calloutNumberText?.fill;

    // Circled number (non-editable) - styled to match the callout
    const circle = new Circle({
      radius: circleRadius,
      fill: circleFill,
      stroke: circleStroke,
      strokeWidth: circleStrokeWidth,
      strokeUniform: true,
      left: leftMargin,
      top: yPos,
      selectable: false,
      evented: false,
    });
    elements.push(circle);

    const numberText = new Textbox(entry.number.toString(), {
      fontSize: 12,
      fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fill: numberFill,
      textAlign: "center",
      width: circleRadius * 2,
      left: leftMargin,
      top: yPos + circleRadius - 6,
      selectable: false,
      evented: false,
      fontWeight: "bold",
    });
    elements.push(numberText);

    // Editable label
    const label = (entry.group as any).calloutLabel || `Item ${entry.number}`;
    const labelText = new Textbox(label, {
      fontSize: 13,
      fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fill: "#000000",
      textAlign: "left",
      width: legendWidth - leftMargin - circleRadius * 2 - 30,
      left: leftMargin + circleRadius * 2 + 10,
      top: yPos + circleRadius - 9,
      selectable: true,
      evented: true,
      editable: true,
    });

    // Store callout ID on the label for updates
    (labelText as any).calloutId = entry.id;
    (labelText as any).isLegendLabel = true; // Mark as legend label for special handling
    elements.push(labelText);
  });

  const legendGroup = new Group(elements, {
    subTargetCheck: true, // Allow clicking on individual elements
    interactive: true, // Allow interaction with sub-objects
    lockMovementX: false,
    lockMovementY: false,
  });

  (legendGroup as any).customType = "callout-legend";
  (legendGroup as any).isLegend = true;
  (legendGroup as any).legendHidden = false;

  // Ensure custom properties are serialized when saving to JSON
  legendGroup.set('customType', 'callout-legend');
  legendGroup.set('isLegend', true);
  legendGroup.set('legendHidden', false);

  // Override toObject to ensure custom properties are included in JSON
  const originalToObject = legendGroup.toObject.bind(legendGroup);
  legendGroup.toObject = function(propertiesToInclude?: string[]) {
    return originalToObject([
      'customType',
      'isLegend',
      'legendHidden',
      ...(propertiesToInclude || [])
    ]);
  };

  return legendGroup;
}

/**
 * Removes the legend from the canvas
 */
const removeLegend = (canvas: FabricCanvas): void => {
  const legend = canvas.getObjects().find(obj =>
    (obj as any).customType === 'callout-legend'
  );

  if (legend) {
    canvas.remove(legend);
    canvas.requestRenderAll();
  }
};

/**
 * Updates a callout's label text
 */
export const updateCalloutLabel = (canvas: FabricCanvas, calloutId: string, label: string): void => {
  const registry = (canvas as any).calloutRegistry as Map<string, CalloutRegistryEntry> | undefined;
  if (!registry) return;

  const entry = registry.get(calloutId);
  if (entry) {
    (entry.group as any).calloutLabel = label;
    createOrUpdateLegend(canvas);
  }
};

/**
 * Gets all callouts from the registry
 */
export const getCalloutRegistry = (canvas: FabricCanvas): CalloutRegistryEntry[] => {
  const registry = (canvas as any).calloutRegistry as Map<string, CalloutRegistryEntry> | undefined;
  if (!registry) return [];

  return Array.from(registry.values()).sort((a, b) => a.number - b.number);
};

/**
 * Type guard to check if an object is a callout
 */
export const isCallout = (obj: FabricObject | null | undefined): obj is Group => {
  return obj instanceof Group && (obj as any).customType === "numbered-callout";
};

/**
 * Type guard to check if an object is a legend
 */
export const isLegend = (obj: FabricObject | null | undefined): obj is Group => {
  return obj instanceof Group && (obj as any).customType === "callout-legend";
};

/**
 * Gets callout data from a group
 */
export const getCalloutData = (group: Group): NumberedCalloutData | null => {
  if (!isCallout(group)) return null;

  return {
    calloutNumber: (group as any).calloutNumber,
    calloutId: (group as any).calloutId,
    calloutLabel: (group as any).calloutLabel,
  };
};
