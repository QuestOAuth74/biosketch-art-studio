import { Group, FabricImage } from "fabric";

export type MaskShape =
  | "circle"
  | "rect"
  | "roundedRect"
  | "ellipse"
  | "polygon"
  | "custom";

export interface ImageMaskOptions {
  maskShape: MaskShape;
  imageScale: number;
  imagePosition: { x: number; y: number };
  cornerRadius?: number; // For rounded rectangles
}

export interface MaskedImageGroup extends Group {
  isMaskedImage: true;
  maskShape: MaskShape;
  isEditingImage?: boolean;
  originalImageData?: any;
  cornerRadius?: number;
}

export interface MaskedImageMetadata {
  isMaskedImage: boolean;
  maskShape: MaskShape;
  isEditingImage: boolean;
  cornerRadius?: number;
}
