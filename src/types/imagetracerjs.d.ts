declare module 'imagetracerjs' {
  interface ImageTracerInstance {
    imagedataToSVG(imgd: ImageData, options: Record<string, any>): string;
    imageToSVG(url: string, callback: (svg: string) => void, options?: Record<string, any>): void;
  }
  const instance: ImageTracerInstance;
  export default instance;
}
