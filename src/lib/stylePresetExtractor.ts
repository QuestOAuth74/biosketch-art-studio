import { FabricObject, Textbox, ActiveSelection, Group, Image as FabricImage, Path } from 'fabric';
import { StylePresetProperties, PresetType, PresetImageFilterConfig } from '@/types/stylePresets';
import { GradientConfig, ShadowConfig } from '@/types/effects';

// ===== OBJECT TYPE DETECTION HELPERS =====

/**
 * Check if object is a TextBox tool object (group with textbox + background)
 */
export function isTextBox(obj: FabricObject): boolean {
  if (obj.type !== 'group') return false;
  const group = obj as Group;
  const objects = group.getObjects();

  // TextBox is a group with a background rect and a textbox
  // Check if it has the textBoxData property
  return !!(obj as any).textBoxData;
}

/**
 * Check if object is text on a path (deprecated — feature removed)
 */
export function isTextOnPath(_obj: FabricObject): boolean {
  return false;
}

/**
 * Check if object is an icon (SVG group)
 */
export function isIconGroup(obj: FabricObject): boolean {
  if (obj.type !== 'group') return false;
  const group = obj as Group;

  // Icons can be identified by:
  // 1. Having iconData or isIcon property (explicitly marked)
  // 2. Having iconToneColor property (tone applied via Icon Styling panel)
  // 3. Being a group with only paths/shapes (typical SVG icon structure)
  //    BUT NOT having other specialized markers

  // FIRST: Check if it has specialized type markers that exclude it from being an icon
  // This check MUST happen before checking iconToneColor, because any object can have tone applied
  const customType = (obj as any).customType;
  const hasTextBoxData = !!(obj as any).textBoxData;
  const hasPathTextData = !!(obj as any).pathTextData;
  const hasMembraneData = !!(obj as any).isMembrane;

  // Exclude objects with specialized customType markers
  if (customType === 'bracket-label' || customType === 'leader-line' ||
      customType === 'numbered-callout' || customType === 'callout-legend') {
    return false;
  }

  // Exclude objects with other specialized data markers
  if (hasTextBoxData || hasPathTextData || hasMembraneData) {
    return false;
  }

  // SECOND: Check for explicit icon markers
  const hasIconMarker = !!(obj as any).iconData || !!(obj as any).isIcon;
  const hasIconToneColor = !!(obj as any).iconToneColor;

  // If explicitly marked as icon or has icon tone, return true
  if (hasIconMarker || hasIconToneColor) {
    return true;
  }

  // THIRD: Fallback - Check if it's a group with only paths/shapes (typical SVG icon structure)
  // This helps catch icons from the library that don't have explicit markers yet
  const objects = group.getObjects();
  const hasOnlyPathsAndShapes = objects.length > 0 && objects.every((o: any) =>
    o.type === 'path' || o.type === 'rect' || o.type === 'circle' ||
    o.type === 'ellipse' || o.type === 'polygon' || o.type === 'polyline' ||
    o.type === 'group' || o.type === 'line'
  );

  return hasOnlyPathsAndShapes;
}

/**
 * Check if object is a membrane
 */
export function isMembrane(obj: FabricObject): boolean {
  return !!(obj as any).isMembrane || obj.type === 'membrane';
}

/**
 * Check if object is a bracket
 */
export function isBracket(obj: FabricObject): boolean {
  return (obj as any).customType === 'bracket-label';
}

/**
 * Check if object is a leader line
 */
export function isLeaderLine(obj: FabricObject): boolean {
  return (obj as any).customType === 'leader-line';
}

/**
 * Check if object is a callout
 */
export function isCallout(obj: FabricObject): boolean {
  return (obj as any).customType === 'numbered-callout';
}

/**
 * Check if object is a masked image
 */
export function isMaskedImage(obj: FabricObject): boolean {
  if (obj.type !== 'group') return false;
  const group = obj as Group;
  const objects = group.getObjects();

  // Masked images have an image and a clipping shape
  return objects.some(o => o.type === 'image') && (group as any).clipPath !== undefined;
}

/**
 * Determines the type of preset based on the selected object(s)
 */
export function detectPresetType(obj: FabricObject): PresetType {
  // Check for ActiveSelection (multiple objects)
  if (obj.type === 'activeSelection') {
    const selection = obj as ActiveSelection;
    const objects = selection.getObjects();

    // Check if all objects are the same type
    const types = new Set(objects.map(o => getObjectCategory(o)));

    if (types.size === 1) {
      return Array.from(types)[0];
    }

    return 'mixed';
  }

  return getObjectCategory(obj);
}

/**
 * Categorizes a single object into its preset type
 */
function getObjectCategory(obj: FabricObject): PresetType {
  // Check specialized types with explicit markers FIRST
  // These have definitive identifying properties and take priority

  if (isTextBox(obj)) {
    return 'textbox';
  }

  // Check membrane, bracket, leader-line, callout BEFORE icon
  // These can have tone/shadows applied (originalColors property)
  // but should not be misidentified as icons
  if (isMembrane(obj)) {
    return 'membrane';
  }

  if (isBracket(obj)) {
    return 'bracket';
  }

  if (isLeaderLine(obj)) {
    return 'leader-line';
  }

  if (isCallout(obj)) {
    return 'callout';
  }

  if (isMaskedImage(obj)) {
    return 'masked-image';
  }

  // Check icon AFTER other specialized types
  // Icons are more generic groups that can be confused with other types
  if (isIconGroup(obj)) {
    return 'icon';
  }

  // Images
  if (obj.type === 'image') {
    return 'image';
  }

  // Regular text objects
  if (obj.type === 'textbox' || obj instanceof Textbox) {
    return 'text';
  }

  // Check for shape-text groups (shapes with labels)
  if (obj.type === 'group') {
    const objects = (obj as any).getObjects?.() || [];
    if (objects.length === 2 && objects[1].type === 'textbox') {
      return 'shape';
    }
  }

  // Line objects
  if (
    obj.type === 'path' ||
    obj.type === 'line' ||
    (obj as any).isFreeformLine ||
    (obj as any).isConnector ||
    (obj as any).isCurvedLine ||
    (obj as any).isOrthogonalLine ||
    (obj as any).isStraightLine
  ) {
    return 'line';
  }

  // Shapes
  if (
    obj.type === 'rect' ||
    obj.type === 'circle' ||
    obj.type === 'ellipse' ||
    obj.type === 'polygon'
  ) {
    return 'shape';
  }

  return 'mixed';
}

/**
 * Helper to check if object is a shape-with-text group
 */
function isShapeWithTextGroup(obj: any): boolean {
  if (obj.type !== 'group') return false;
  const objects = obj.getObjects();
  return (objects.length === 2 &&
         (objects[0].type === 'circle' || objects[0].type === 'rect') &&
         objects[1].type === 'textbox') ||
         (objects.length === 3 &&
         objects[0].type === 'rect' &&
         objects[1].type === 'textbox' &&
         objects[2].type === 'textbox');
}

/**
 * Extracts styleable properties from a Fabric object
 */
export function extractStyleProperties(obj: FabricObject): StylePresetProperties {
  const properties: StylePresetProperties = {};

  const type = detectPresetType(obj);

  // Get the target object for property extraction
  // For shape-text groups, extract from the inner shape
  // EXCEPT for callouts - callouts need shadow extracted from the group
  const isCalloutType = type === 'callout';
  const sourceObj = (isShapeWithTextGroup(obj) && !isCalloutType)
    ? (obj as any).getObjects()[0]
    : obj;
  // Common properties for all objects (except some specialized types)
  if (sourceObj.fill !== undefined && sourceObj.fill !== null) {
    // Check if fill is a gradient
    if (typeof sourceObj.fill === 'object' && (sourceObj.fill as any).type) {
      const gradientConfig = fabricGradientToConfig(sourceObj.fill as any);
      if (gradientConfig) {
        properties.gradient = gradientConfig;
        properties.gradientTarget = 'fill';
      }
    } else {
      properties.fill = sourceObj.fill as string;
    }
  }

  if (sourceObj.stroke !== undefined && sourceObj.stroke !== null) {
    properties.stroke = sourceObj.stroke as string;
  }

  if (sourceObj.strokeWidth !== undefined) {
    properties.strokeWidth = sourceObj.strokeWidth;
  }

  if (sourceObj.opacity !== undefined) {
    properties.opacity = sourceObj.opacity;
  }

  // Shadow - extract from sourceObj (inner shape for shape-text groups)
  if (sourceObj.shadow) {
    properties.shadow = fabricShadowToConfig(sourceObj.shadow);
  } else {
  }

  // ===== TYPE-SPECIFIC PROPERTY EXTRACTION =====

  // TextBox properties (includes text styling + box styling)
  if (type === 'textbox') {
    Object.assign(properties, extractTextBoxProperties(obj as Group));
  }

  // Regular text properties
  if (type === 'text') {
    const textObj = obj as Textbox;

    if (textObj.fontFamily) {
      properties.fontFamily = textObj.fontFamily;
    }
    if (textObj.fontSize) {
      properties.fontSize = textObj.fontSize;
    }
    if (textObj.fontWeight) {
      properties.fontWeight = textObj.fontWeight;
    }
    if (textObj.fontStyle) {
      properties.fontStyle = textObj.fontStyle as 'normal' | 'italic';
    }
    if (textObj.textAlign) {
      properties.textAlign = textObj.textAlign as any;
    }
    if (textObj.underline !== undefined) {
      properties.underline = textObj.underline;
    }
    if (textObj.overline !== undefined) {
      properties.overline = textObj.overline;
    }
    if (textObj.linethrough !== undefined) {
      properties.linethrough = textObj.linethrough;
    }
    if ((textObj as any).lineHeight) {
      properties.lineHeight = (textObj as any).lineHeight;
    }
    if ((textObj as any).charSpacing) {
      properties.charSpacing = (textObj as any).charSpacing;
    }
  }

  // Image properties (filters, color maps, tones)
  if (type === 'image') {
    Object.assign(properties, extractImageProperties(obj as FabricImage));
  }

  // Icon properties (tone styling)
  if (type === 'icon') {
    Object.assign(properties, extractIconProperties(obj as Group));
  }

  // Membrane properties
  if (type === 'membrane') {
    Object.assign(properties, extractMembraneProperties(obj));
  }

  // Bracket properties
  if (type === 'bracket') {
    Object.assign(properties, extractBracketProperties(obj));
  }

  // Leader line properties
  if (type === 'leader-line') {
    Object.assign(properties, extractLeaderLineProperties(obj));
  }

  // Callout properties
  if (type === 'callout') {
    Object.assign(properties, extractCalloutProperties(obj));
  }

  // Line-specific properties
  if (type === 'line') {
    if (sourceObj.strokeDashArray) {
      properties.strokeDashArray = sourceObj.strokeDashArray as number[];
    }

    const lineObj = sourceObj as any;
    if (lineObj.startMarker) {
      properties.startMarker = lineObj.startMarker;
    }
    if (lineObj.endMarker) {
      properties.endMarker = lineObj.endMarker;
    }
    if (lineObj.lineStyle) {
      properties.lineStyle = lineObj.lineStyle;
    }

    // Extract advanced line properties
    Object.assign(properties, extractLineAdvancedProperties(obj as Path));
  }

  return properties;
}

/**
 * Converts Fabric.js gradient to GradientConfig
 */
function fabricGradientToConfig(gradient: any): GradientConfig | null {
  if (!gradient || !gradient.type) return null;

  try {
    if (gradient.type === 'linear') {
      // Calculate angle from coordinates
      const dx = gradient.coords.x2 - gradient.coords.x1;
      const dy = gradient.coords.y2 - gradient.coords.y1;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      return {
        type: 'linear',
        angle: angle,
        stops: gradient.colorStops.map((stop: any) => ({
          color: stop.color,
          offset: stop.offset,
          opacity: stop.opacity
        }))
      };
    } else if (gradient.type === 'radial') {
      return {
        type: 'radial',
        centerX: gradient.coords.r1 || 0.5,
        centerY: gradient.coords.r2 || 0.5,
        radius: gradient.coords.r2 || 100,
        stops: gradient.colorStops.map((stop: any) => ({
          color: stop.color,
          offset: stop.offset,
          opacity: stop.opacity
        }))
      };
    }
  } catch (error) {
    console.error('Error converting gradient:', error);
  }

  return null;
}

/**
 * Converts Fabric.js shadow to ShadowConfig
 */
function fabricShadowToConfig(shadow: any): ShadowConfig {
  const { baseColor, opacity } = extractColorAndOpacity(shadow.color || '#000000');
  return {
    enabled: true,
    blur: shadow.blur || 0,
    offsetX: shadow.offsetX || 0,
    offsetY: shadow.offsetY || 0,
    color: baseColor,
    opacity: opacity
  };
}

/**
 * Extracts base color and opacity from color string
 * Handles both rgba() format and hex format with alpha (#RRGGBBAA)
 */
function extractColorAndOpacity(color: string): { baseColor: string; opacity: number } {
  if (typeof color !== 'string') {
    return { baseColor: '#000000', opacity: 1 };
  }

  // Handle rgba() format
  const rgbaMatch = color.match(/rgba?\(([\d\s,]+),\s*([\d.]+)\)/);
  if (rgbaMatch) {
    const opacity = parseFloat(rgbaMatch[2]);
    // Extract base color without alpha
    const baseColor = color.replace(/,\s*[\d.]+\)/, ')').replace('rgba', 'rgb');
    return { baseColor, opacity };
  }

  // Handle hex format with alpha (#RRGGBBAA)
  if (color.startsWith('#') && color.length === 9) {
    const baseColor = color.substring(0, 7); // #RRGGBB
    const alphaHex = color.substring(7, 9); // AA
    const opacity = parseInt(alphaHex, 16) / 255;
    return { baseColor, opacity };
  }

  // Handle standard hex or named colors (no alpha)
  return { baseColor: color, opacity: 1 };
}

/**
 * @deprecated Use extractColorAndOpacity instead
 * Extracts opacity from rgba color string
 */
function extractOpacityFromColor(color: string): number {
  const { opacity } = extractColorAndOpacity(color);
  return opacity;
}

// ===== SPECIALIZED PROPERTY EXTRACTION HELPERS =====

/**
 * Extract TextBox-specific properties (including text styling)
 */
function extractTextBoxProperties(obj: Group): Partial<StylePresetProperties> {
  const props: Partial<StylePresetProperties> = {};

  // Get the inner textbox object
  const textbox = obj.getObjects().find(o => o.type === 'textbox') as Textbox | undefined;

  if (textbox) {
    // Extract text styling from inner textbox
    if (textbox.fontFamily) props.fontFamily = textbox.fontFamily;
    if (textbox.fontSize) props.fontSize = textbox.fontSize;
    if (textbox.fontWeight) props.fontWeight = textbox.fontWeight;
    if (textbox.fontStyle) props.fontStyle = textbox.fontStyle as 'normal' | 'italic';
    if (textbox.textAlign) props.textAlign = textbox.textAlign as any;
    if (textbox.underline !== undefined) props.underline = textbox.underline;
    if (textbox.overline !== undefined) props.overline = textbox.overline;
    if (textbox.linethrough !== undefined) props.linethrough = textbox.linethrough;
    if ((textbox as any).lineHeight) props.lineHeight = (textbox as any).lineHeight;
    if ((textbox as any).charSpacing) props.charSpacing = (textbox as any).charSpacing;
    if (textbox.fill) props.fill = textbox.fill as string;  // Text color
  }

  // Extract textbox-specific properties from group data
  const textBoxData = (obj as any).textBoxData;
  if (textBoxData) {
    if (textBoxData.width) props.textboxWidth = textBoxData.width;
    if (textBoxData.height) props.textboxHeight = textBoxData.height;
    if (textBoxData.padding) props.textboxPadding = textBoxData.padding;
    if (textBoxData.backgroundColor) props.textboxBackgroundColor = textBoxData.backgroundColor;
    if (textBoxData.borderColor) props.textboxBorderColor = textBoxData.borderColor;
    if (textBoxData.borderWidth !== undefined) props.textboxBorderWidth = textBoxData.borderWidth;
  }

  return props;
}

/**
 * Extract image properties (filters, color maps, tones)
 */
function extractImageProperties(obj: FabricImage): Partial<StylePresetProperties> {
  const props: Partial<StylePresetProperties> = {};

  // Extract image filters
  if (obj.filters && obj.filters.length > 0) {
    const filterConfig: PresetImageFilterConfig = {};

    obj.filters.forEach((filter: any) => {
      if (!filter) return;

      switch (filter.type) {
        case 'Brightness':
          filterConfig.brightness = filter.brightness;
          break;
        case 'Contrast':
          filterConfig.contrast = filter.contrast;
          break;
        case 'Saturation':
          filterConfig.saturation = filter.saturation;
          break;
        case 'Blur':
          filterConfig.blur = filter.blur;
          break;
        case 'Pixelate':
          filterConfig.pixelate = filter.blocksize;
          break;
        case 'Noise':
          filterConfig.noise = filter.noise;
          break;
        case 'RemoveColor':
          if (filter.color && filter.distance !== undefined) {
            filterConfig.removeColor = {
              color: filter.color,
              distance: filter.distance
            };
          }
          break;
        case 'HueRotation':
          filterConfig.hueRotation = filter.rotation;
          break;
        case 'Vibrance':
          filterConfig.vibrance = filter.vibrance;
          break;
        case 'Grayscale':
          filterConfig.grayscale = true;
          break;
        case 'Invert':
          filterConfig.invert = true;
          break;
        case 'Sepia':
          filterConfig.sepia = true;
          break;
      }
    });

    if (Object.keys(filterConfig).length > 0) {
      props.imageFilters = filterConfig;
    }
  }

  // Extract color map
  const colorMapConfig = (obj as any).colorMapConfig;
  if (colorMapConfig) {
    props.colorMap = {
      mapName: colorMapConfig.mapName,
      intensity: colorMapConfig.intensity
    };
  }

  // Extract tone (blend color filter)
  const toneFilter = obj.filters?.find((f: any) => f && f.type === 'BlendColor');
  if (toneFilter) {
    props.imageTone = {
      color: (toneFilter as any).color || '#000000',
      opacity: (toneFilter as any).alpha || 1
    };
  }

  return props;
}

/**
 * Extract icon tone properties
 */
function extractIconProperties(obj: Group): Partial<StylePresetProperties> {
  const props: Partial<StylePresetProperties> = {};

  // The useIconToneManagement hook stores tone data directly on the object
  const iconToneColor = (obj as any).iconToneColor;
  const iconToneIntensity = (obj as any).iconToneIntensity;
  if (iconToneColor !== undefined && iconToneIntensity !== undefined) {
    props.iconTone = {
      customColor: iconToneColor,
      intensity: iconToneIntensity
    };
  } else {
  }

  return props;
}

/**
 * Extract membrane properties
 */
function extractMembraneProperties(obj: FabricObject): Partial<StylePresetProperties> {
  const props: Partial<StylePresetProperties> = {};

  const membraneData = (obj as any).membraneData;
  if (membraneData) {
    if (membraneData.iconId) props.membraneIconId = membraneData.iconId;
    if (membraneData.iconSize) props.membraneIconSize = membraneData.iconSize;
    if (membraneData.spacing) props.membraneSpacing = membraneData.spacing;
    if (membraneData.orientation !== undefined) props.membraneOrientation = membraneData.orientation;
    if (membraneData.rotateToPath !== undefined) props.membraneRotateToPath = membraneData.rotateToPath;
    if (membraneData.doubleSided !== undefined) props.membraneDoubleSided = membraneData.doubleSided;
  }

  return props;
}

/**
 * Extract bracket properties
 */
function extractBracketProperties(obj: FabricObject): Partial<StylePresetProperties> {
  const props: Partial<StylePresetProperties> = {};
  // Extract bracket-specific properties (stored directly on the group object)
  const bracketSize = (obj as any).bracketSize;
  const bracketGap = (obj as any).bracketGap;

  if (bracketSize !== undefined) {
    props.bracketSize = bracketSize;
  }
  if (bracketGap !== undefined) {
    props.bracketDepth = bracketGap; // Map bracketGap to bracketDepth for UI consistency
  }
  // Extract font properties from the text object inside the bracket
  if (obj.type === 'group') {
    const group = obj as Group;
    const textObj = group.getObjects().find(o => o.type === 'text' || o.type === 'textbox') as Textbox | undefined;

    if (textObj) {
      if (textObj.fontFamily) props.fontFamily = textObj.fontFamily;
      if (textObj.fontSize) props.fontSize = textObj.fontSize;
      if (textObj.fontWeight) props.fontWeight = textObj.fontWeight;
      if (textObj.fontStyle) props.fontStyle = textObj.fontStyle as 'normal' | 'italic';
      if (textObj.fill) props.fill = textObj.fill as string;
    } else {
    }
  }
  return props;
}

/**
 * Extract leader line properties
 */
function extractLeaderLineProperties(obj: FabricObject): Partial<StylePresetProperties> {
  const props: Partial<StylePresetProperties> = {};
  // Extract arrow visibility (arrow is second element in group)
  if (obj.type === 'group') {
    const group = obj as Group;
    const objects = group.getObjects();
    const arrow = objects[1]; // Arrow is always index 1

    if (arrow) {
      props.showArrow = arrow.visible !== false; // Default to true if undefined
    }

    // Extract font properties from the label (fourth element in group)
    const label = objects[3] as Textbox | undefined;
    if (label) {
      if (label.fontFamily) props.fontFamily = label.fontFamily;
      if (label.fontSize) props.fontSize = label.fontSize;
      if (label.fontWeight) props.fontWeight = label.fontWeight;
      if (label.fontStyle) props.fontStyle = label.fontStyle as 'normal' | 'italic';
      if (label.fill) props.fill = label.fill as string;
    }
  }
  return props;
}

/**
 * Extract callout properties
 */
function extractCalloutProperties(obj: FabricObject): Partial<StylePresetProperties> {
  const props: Partial<StylePresetProperties> = {};
  // Callout structure: [Circle, NumberText]
  if (obj.type === 'group') {
    const group = obj as Group;
    const objects = group.getObjects();

    const circle = objects[0]; // Circle
    const numberText = objects[1] as Textbox; // Number text

    // Extract circle properties (stroke/fill)
    if (circle) {
      if (circle.fill) props.fill = circle.fill as string; // Circle fill color
      if (circle.stroke) props.stroke = circle.stroke as string; // Circle border color
      if (circle.strokeWidth !== undefined) props.strokeWidth = circle.strokeWidth;

      // NOTE: Shadow is extracted from the GROUP by universal shadow extraction
      // Don't extract from circle to avoid overwriting the correct shadow
    }

    // Extract font properties from number text
    if (numberText) {
      if (numberText.fontFamily) props.fontFamily = numberText.fontFamily;
      if (numberText.fontSize) props.fontSize = numberText.fontSize;
      if (numberText.fontWeight) props.fontWeight = numberText.fontWeight;
      if (numberText.fontStyle) props.fontStyle = numberText.fontStyle as 'normal' | 'italic';
      // Extract text color inside the circle separately (not the circle fill)
      if (numberText.fill) props.textFill = numberText.fill as string;
    }
  }
  return props;
}

/**
 * Extract advanced line properties (smoothing, intersection, gradients)
 */
function extractLineAdvancedProperties(obj: Path): Partial<StylePresetProperties> {
  const props: Partial<StylePresetProperties> = {};

  // Smoothing strength for freeform lines
  if ((obj as any).smoothingStrength !== undefined) {
    props.smoothingStrength = (obj as any).smoothingStrength;
  }

  // Line gradient
  if ((obj as any).lineGradient) {
    props.lineGradient = (obj as any).lineGradient;
  }

  // Line intersection style
  if ((obj as any).lineIntersection) {
    props.lineIntersection = (obj as any).lineIntersection;
  }

  return props;
}
