import { useEffect } from "react";
import { FabricImage, loadSVGFromString, util } from "fabric";
import type { Canvas } from "fabric";
import { toast } from "sonner";
import { loadImageWithCORS } from "@/lib/utils";

export function useImageInsertionTool(
  canvas: Canvas | null,
  activeTool: string,
  onShapeCreated: (() => void) | undefined,
  saveState: () => void
) {
  // Handle image insertion tool (upload-first flow with placeholder)
  useEffect(() => {
    if (!canvas) return;

    if (activeTool === "image") {
      // Create a hidden file input
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".svg,.jpg,.jpeg,.png,image/svg+xml,image/jpeg,image/png";
      fileInput.style.display = "none";

      fileInput.onchange = async (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];

        if (!file) return;

        // Validate file type
        const validTypes = ["image/svg+xml", "image/jpeg", "image/jpg", "image/png"];
        const validExtensions = [".svg", ".jpg", ".jpeg", ".png"];
        const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));

        if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
          toast.error("Invalid file format. Only SVG, JPG, and PNG files are allowed.");
          return;
        }

        const placeholderId = crypto.randomUUID();
        const isSvg = file.type === "image/svg+xml" || fileExtension === ".svg";

        // Show persistent loading toast
        const toastId = toast.loading('Uploading image...');

        // Read file content locally for immediate display after upload
        const readPromise = new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = () => reject(new Error("Failed to read file"));
          // SVG must be read as text (loadSVGFromString expects XML, not data URL)
          if (isSvg) {
            reader.readAsText(file);
          } else {
            reader.readAsDataURL(file);
          }
        });

        // Store upload metadata for the completion handler
        (window as any).__pendingUploads = (window as any).__pendingUploads || {};
        (window as any).__pendingUploads[placeholderId] = { isSvg, toastId, fileContent: null as string | null };

        readPromise.then(fileContent => {
          const pending = (window as any).__pendingUploads?.[placeholderId];
          if (pending) pending.fileContent = fileContent;
        }).catch(() => {
          toast.error("Failed to read image file", { id: toastId });
          delete (window as any).__pendingUploads?.[placeholderId];
        });

        // Dispatch upload event - SaveUploadHandler will handle the upload
        window.dispatchEvent(new CustomEvent('uploadImageAsset', {
          detail: { file, placeholderId },
        }));
      };

      // Listen for upload completion
      const handleUploadComplete = async (event: CustomEvent) => {
        const { assetId, placeholderId } = event.detail;
        if (!canvas) return;

        const pending = (window as any).__pendingUploads?.[placeholderId];
        if (!pending) return;

        const { fileContent, isSvg, toastId } = pending;
        delete (window as any).__pendingUploads[placeholderId];

        if (!fileContent) {
          toast.error("Failed to read image file", { id: toastId });
          return;
        }

        // Place image at center of canvas
        const centerLeft = (canvas.width || 0) / 2;
        const centerTop = (canvas.height || 0) / 2;

        try {
          if (isSvg) {
            const { objects, options } = await loadSVGFromString(fileContent);
            const group = util.groupSVGElements(objects, options);

            const maxW = (canvas.width || 0) * 0.6;
            const maxH = (canvas.height || 0) * 0.6;
            const scale = Math.min(maxW / (group.width || 1), maxH / (group.height || 1), 1);
            group.scale(scale);

            group.set({
              left: centerLeft - ((group.width || 0) * scale) / 2,
              top: centerTop - ((group.height || 0) * scale) / 2,
            });

            // Mark with asset reference
            (group as any).assetId = assetId;
            (group as any).isUserAsset = true;

            canvas.add(group);
            canvas.setActiveObject(group);
            canvas.requestRenderAll();
            toast.success("Image added to canvas", { id: toastId });
          } else {
            const img = await loadImageWithCORS(fileContent);
            const fabricImage = new FabricImage(img, {
              originX: "left",
              originY: "top",
            });

            const maxW = (canvas.width || 0) * 0.6;
            const maxH = (canvas.height || 0) * 0.6;
            const scale = Math.min(maxW / fabricImage.width!, maxH / fabricImage.height!, 1);
            fabricImage.scale(scale);

            fabricImage.set({
              left: centerLeft - (fabricImage.width! * scale) / 2,
              top: centerTop - (fabricImage.height! * scale) / 2,
            });

            // Mark with asset reference
            (fabricImage as any).assetId = assetId;
            (fabricImage as any).isUserAsset = true;

            canvas.add(fabricImage);
            canvas.setActiveObject(fabricImage);
            canvas.requestRenderAll();
            toast.success("Image added to canvas", { id: toastId });
          }

          if (onShapeCreated) onShapeCreated();
        } catch (error) {
          console.error("Failed to add uploaded image to canvas:", error);
          toast.error("Failed to add image to canvas", { id: toastId });
        }
      };

      // Listen for upload failure
      const handleUploadFailed = (event: CustomEvent) => {
        const { placeholderId } = event.detail;
        const pending = (window as any).__pendingUploads?.[placeholderId];
        if (pending) {
          toast.error("Upload failed", { id: pending.toastId });
          delete (window as any).__pendingUploads[placeholderId];
        }
      };

      window.addEventListener('imageAssetUploaded', handleUploadComplete as EventListener);
      window.addEventListener('imageAssetUploadFailed', handleUploadFailed as EventListener);

      // Trigger the file input
      document.body.appendChild(fileInput);
      fileInput.click();

      // Clean up file input
      setTimeout(() => {
        document.body.removeChild(fileInput);
      }, 100);

      return () => {
        window.removeEventListener('imageAssetUploaded', handleUploadComplete as EventListener);
        window.removeEventListener('imageAssetUploadFailed', handleUploadFailed as EventListener);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, activeTool]);
}
