import { Group, Rect, Textbox, FabricObject } from "fabric";

export interface TextBoxData {
  text: string;
  width: number;
  height: number;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  padding: number;
  textAlign: string;
  fontSize: number;
  fontFamily: string;
  fontColor: string;
}

export interface TextBoxOptions extends Partial<TextBoxData> {
  left?: number;
  top?: number;
}

/**
 * Creates a text box group containing a frame (Rect) and a text (Textbox)
 */
export const createTextBox = (options: TextBoxOptions): Group => {
  const defaults: TextBoxData = {
    text: "Enter text here...",
    width: 300,
    height: 150,
    backgroundColor: "#ffffff",
    borderColor: "#000000",
    borderWidth: 1,
    padding: 15,
    textAlign: "left",
    fontSize: 16,
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontColor: "#000000",
  };

  const data = { ...defaults, ...options };

  // Create the frame rectangle
  const frame = new Rect({
    width: data.width,
    height: data.height,
    fill: data.backgroundColor,
    stroke: data.borderColor,
    strokeWidth: data.borderWidth,
    strokeUniform: true,
    left: 0,
    top: 0,
    selectable: false,
    evented: false,
  });

  // Calculate text box dimensions based on padding
  const textWidth = data.width - (2 * data.padding);
  const textHeight = data.height - (2 * data.padding);

  // Create the text
  const textbox = new Textbox(data.text, {
    width: textWidth,
    fontSize: data.fontSize,
    fontFamily: data.fontFamily,
    fill: data.fontColor,
    textAlign: data.textAlign as any,
    left: data.padding,
    top: data.padding,
    selectable: false,
    evented: false,
    splitByGrapheme: true, // Better text wrapping
  });

  // Create group
  const group = new Group([frame, textbox], {
    left: options.left || 100,
    top: options.top || 100,
    subTargetCheck: true,
  });

  // Add custom properties for identification
  (group as any).customType = "text-box";
  (group as any).textBoxData = data;

  return group;
};

/**
 * Updates an existing text box with new properties
 */
export const updateTextBox = (group: Group, updates: Partial<TextBoxData>): void => {
  if (!isTextBox(group)) {
    throw new Error("Object is not a text box");
  }

  const currentData = getTextBoxData(group);
  const newData = { ...currentData, ...updates };

  const frame = group.getObjects()[0] as Rect;
  const textbox = group.getObjects()[1] as Textbox;

  // Update frame
  if (updates.width !== undefined || updates.height !== undefined) {
    frame.set({
      width: newData.width,
      height: newData.height,
    });
  }

  if (updates.backgroundColor !== undefined) {
    frame.set({ fill: newData.backgroundColor });
  }

  if (updates.borderColor !== undefined) {
    frame.set({ stroke: newData.borderColor });
  }

  if (updates.borderWidth !== undefined) {
    frame.set({ strokeWidth: newData.borderWidth });
  }

  // Update text
  if (updates.text !== undefined) {
    textbox.set({ text: newData.text });
  }

  if (updates.fontSize !== undefined) {
    textbox.set({ fontSize: newData.fontSize });
  }

  if (updates.fontFamily !== undefined) {
    textbox.set({ fontFamily: newData.fontFamily });
  }

  if (updates.fontColor !== undefined) {
    textbox.set({ fill: newData.fontColor });
  }

  if (updates.textAlign !== undefined) {
    textbox.set({ textAlign: newData.textAlign as any });
  }

  // Recalculate text dimensions when padding or frame size changes
  if (updates.padding !== undefined || updates.width !== undefined || updates.height !== undefined) {
    const textWidth = newData.width - (2 * newData.padding);
    textbox.set({
      width: textWidth,
      left: newData.padding,
      top: newData.padding,
    });
  }

  // Update stored data
  (group as any).textBoxData = newData;

  // Force group to recalculate dimensions
  group.setCoords();
  group.dirty = true;
};

/**
 * Handles resize events for text boxes
 */
export const handleTextBoxResize = (group: Group): void => {
  if (!isTextBox(group)) return;

  const data = getTextBoxData(group);
  const frame = group.getObjects()[0] as Rect;
  const textbox = group.getObjects()[1] as Textbox;

  // Get the current scaled dimensions
  const scaleX = group.scaleX || 1;
  const scaleY = group.scaleY || 1;
  const newWidth = frame.width! * scaleX;
  const newHeight = frame.height! * scaleY;

  // Update frame to new size without scale
  frame.set({
    width: newWidth,
    height: newHeight,
    scaleX: 1,
    scaleY: 1,
  });

  // Recalculate text width based on new frame width and padding
  const textWidth = newWidth - (2 * data.padding);
  textbox.set({
    width: textWidth,
    scaleX: 1,
    scaleY: 1,
  });

  // Reset group scale
  group.set({
    scaleX: 1,
    scaleY: 1,
  });

  // Update stored data
  (group as any).textBoxData = {
    ...data,
    width: newWidth,
    height: newHeight,
  };

  // Force recalculation
  group.setCoords();
  group.dirty = true;
};

/**
 * Checks if an object is a text box
 */
export const isTextBox = (obj: FabricObject | null | undefined): obj is Group => {
  return obj instanceof Group && (obj as any).customType === "text-box";
};

/**
 * Gets text box data from a group
 */
export const getTextBoxData = (group: Group): TextBoxData => {
  if (!isTextBox(group)) {
    throw new Error("Object is not a text box");
  }
  return (group as any).textBoxData as TextBoxData;
};

/**
 * Gets the text content from a text box
 */
export const getTextBoxText = (group: Group): string => {
  if (!isTextBox(group)) return "";
  const textbox = group.getObjects()[1] as Textbox;
  return textbox.text || "";
};

/**
 * Gets the frame rectangle from a text box
 */
export const getTextBoxFrame = (group: Group): Rect | null => {
  if (!isTextBox(group)) return null;
  return group.getObjects()[0] as Rect;
};

/**
 * Gets the textbox element from a text box
 */
export const getTextBoxTextElement = (group: Group): Textbox | null => {
  if (!isTextBox(group)) return null;
  return group.getObjects()[1] as Textbox;
};
