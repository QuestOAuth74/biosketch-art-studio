import { useEffect } from 'react';
import { useUserAssets } from '@/hooks/useUserAssets';
import { toast } from 'sonner';

export function SaveUploadHandler() {
  const { uploadAsset } = useUserAssets();

  useEffect(() => {
    // Legacy handler: auto-save uploads to library (kept for backward compatibility)
    const handleSaveUpload = async (event: CustomEvent) => {
      const { file } = event.detail;
      if (!file) return;

      try {
        const result = await uploadAsset({
          file,
          category: 'uncategorized',
        });

        if (result) {
          toast.success('Image added to canvas and saved to your assets');
        }
      } catch (error) {
        console.error('Error saving upload to library:', error);
        toast.error('Failed to save to library');
      }
    };

    // Upload-first handler: upload image, then notify canvas with assetId
    const handleUploadImageAsset = async (event: CustomEvent) => {
      const { file, placeholderId } = event.detail;
      if (!file) return;

      try {
        const result = await uploadAsset({
          file,
          category: 'uncategorized',
        });

        if (result) {
          // Notify canvas that upload is complete with the assetId
          window.dispatchEvent(new CustomEvent('imageAssetUploaded', {
            detail: {
              assetId: result.id,
              storagePath: result.storage_path,
              mimeType: result.mime_type,
              placeholderId,
            },
          }));
        } else {
          // Upload failed (quota exceeded, validation error, etc.)
          window.dispatchEvent(new CustomEvent('imageAssetUploadFailed', {
            detail: { placeholderId },
          }));
        }
      } catch (error) {
        console.error('Error uploading image asset:', error);
        toast.error('Failed to upload image');
        window.dispatchEvent(new CustomEvent('imageAssetUploadFailed', {
          detail: { placeholderId },
        }));
      }
    };

    window.addEventListener('saveUploadToLibrary', handleSaveUpload as EventListener);
    window.addEventListener('uploadImageAsset', handleUploadImageAsset as EventListener);

    return () => {
      window.removeEventListener('saveUploadToLibrary', handleSaveUpload as EventListener);
      window.removeEventListener('uploadImageAsset', handleUploadImageAsset as EventListener);
    };
  }, [uploadAsset]);

  return null;
}
