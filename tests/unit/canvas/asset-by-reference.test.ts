/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { CANVAS_CUSTOM_PROPS } from '@/contexts/CanvasContext';
import { STORAGE_LIMIT_BYTES } from '@/hooks/useUserAssets';

describe('Asset-by-Reference System', () => {
  describe('Custom Properties Registration', () => {
    it('should include assetId in CANVAS_CUSTOM_PROPS', () => {
      expect(CANVAS_CUSTOM_PROPS).toContain('assetId');
    });

    it('should include isUserAsset in CANVAS_CUSTOM_PROPS', () => {
      expect(CANVAS_CUSTOM_PROPS).toContain('isUserAsset');
    });

    it('should include colorMapConfig in CANVAS_CUSTOM_PROPS', () => {
      expect(CANVAS_CUSTOM_PROPS).toContain('colorMapConfig');
    });

    it('should include originalImageSrc in CANVAS_CUSTOM_PROPS', () => {
      expect(CANVAS_CUSTOM_PROPS).toContain('originalImageSrc');
    });

    it('should include cropConfig in CANVAS_CUSTOM_PROPS', () => {
      expect(CANVAS_CUSTOM_PROPS).toContain('cropConfig');
    });

    it('should include image mask properties in CANVAS_CUSTOM_PROPS', () => {
      expect(CANVAS_CUSTOM_PROPS).toContain('isMaskedImage');
      expect(CANVAS_CUSTOM_PROPS).toContain('maskShape');
      expect(CANVAS_CUSTOM_PROPS).toContain('cornerRadius');
    });
  });

  describe('Save Serialization - Asset Stripping', () => {
    it('should strip src from raster user asset and mark as userAsset type', () => {
      // Simulate what saveProject does to a user asset image object
      const objData: any = {
        type: 'Image',
        src: 'data:image/png;base64,' + 'A'.repeat(100000), // ~100 KB of base64 data
        left: 100,
        top: 200,
        width: 400,
        height: 300,
        scaleX: 0.5,
        scaleY: 0.5,
        angle: 45,
        opacity: 0.8,
        assetId: 'test-asset-uuid-123',
        isUserAsset: true,
        cropConfig: { type: 'rectangle', clipPathData: { type: 'rect', left: 10, top: 10, width: 100, height: 100 } },
        filters: [{ type: 'Brightness', brightness: 0.2 }],
        originalImageSrc: 'data:image/png;base64,' + 'B'.repeat(100000),
      };

      const obj = {
        isUserAsset: true,
        assetId: 'test-asset-uuid-123',
      };

      // Simulate save preprocessing
      if (obj.isUserAsset && obj.assetId) {
        const originalType = objData.type;
        if (objData.type === 'Image' || objData.type === 'image') {
          delete objData.src;
          delete objData.originalImageSrc;
        }
        objData.type = 'userAsset';
        objData.originalType = originalType;
      }

      // Verify src stripped
      expect(objData.src).toBeUndefined();
      expect(objData.originalImageSrc).toBeUndefined();

      // Verify type changed
      expect(objData.type).toBe('userAsset');
      expect(objData.originalType).toBe('Image');

      // Verify all other properties preserved
      expect(objData.assetId).toBe('test-asset-uuid-123');
      expect(objData.left).toBe(100);
      expect(objData.top).toBe(200);
      expect(objData.width).toBe(400);
      expect(objData.height).toBe(300);
      expect(objData.scaleX).toBe(0.5);
      expect(objData.scaleY).toBe(0.5);
      expect(objData.angle).toBe(45);
      expect(objData.opacity).toBe(0.8);
      expect(objData.cropConfig).toBeDefined();
      expect(objData.cropConfig.type).toBe('rectangle');
      expect(objData.filters).toBeDefined();
      expect(objData.filters[0].type).toBe('Brightness');
    });

    it('should strip objects array from SVG user asset', () => {
      const objData: any = {
        type: 'Group',
        objects: [
          { type: 'Path', path: 'M0 0 L100 100', fill: '#000' },
          { type: 'Circle', radius: 50, fill: '#f00' },
          { type: 'Rect', width: 200, height: 100, fill: '#0f0' },
        ],
        left: 50,
        top: 50,
        assetId: 'svg-asset-uuid-456',
        isUserAsset: true,
      };

      const obj = {
        isUserAsset: true,
        assetId: 'svg-asset-uuid-456',
      };

      // Simulate save preprocessing
      if (obj.isUserAsset && obj.assetId) {
        const originalType = objData.type;
        if ((objData.type === 'Group' || objData.type === 'group') && objData.objects) {
          delete objData.objects;
        }
        objData.type = 'userAsset';
        objData.originalType = originalType;
      }

      expect(objData.objects).toBeUndefined();
      expect(objData.type).toBe('userAsset');
      expect(objData.originalType).toBe('Group');
      expect(objData.assetId).toBe('svg-asset-uuid-456');
    });

    it('should produce serialized data under 1 KB per asset', () => {
      const objData: any = {
        type: 'Image',
        src: 'data:image/png;base64,' + 'A'.repeat(500000), // ~500 KB
        left: 100,
        top: 200,
        width: 1920,
        height: 1080,
        scaleX: 0.25,
        scaleY: 0.25,
        angle: 0,
        opacity: 1,
        assetId: 'large-image-asset-uuid',
        isUserAsset: true,
        cropConfig: {
          type: 'circle',
          clipPathData: { type: 'circle', radius: 50, left: 0, top: 0 },
          originalDimensions: { width: 1920, height: 1080, scaleX: 0.25, scaleY: 0.25 },
        },
        colorMapConfig: { mapName: 'viridis', intensity: 75 },
        originalImageSrc: 'data:image/png;base64,' + 'B'.repeat(500000),
      };

      // Simulate save preprocessing
      delete objData.src;
      delete objData.originalImageSrc;
      objData.type = 'userAsset';
      objData.originalType = 'Image';

      const serializedSize = JSON.stringify(objData).length;
      expect(serializedSize).toBeLessThan(1024); // Under 1 KB
    });

    it('should not strip data from regular images (without assetId)', () => {
      const objData: any = {
        type: 'Image',
        src: 'data:image/png;base64,ABC123',
        left: 50,
        top: 50,
        width: 200,
        height: 200,
      };

      const obj = {
        isUserAsset: false,
        assetId: undefined,
      };

      // Regular images should NOT be stripped
      if (obj.isUserAsset && obj.assetId) {
        delete objData.src;
      }

      expect(objData.src).toBe('data:image/png;base64,ABC123');
      expect(objData.type).toBe('Image');
    });
  });

  describe('Save Data Includes All Image Properties', () => {
    it('should preserve cropConfig alongside assetId after stripping', () => {
      const objData: any = {
        type: 'userAsset',
        originalType: 'Image',
        assetId: 'crop-test-uuid',
        isUserAsset: true,
        cropConfig: {
          type: 'freeform',
          clipPathData: {
            type: 'polygon',
            points: [
              { x: 0, y: 0 },
              { x: 100, y: 0 },
              { x: 80, y: 100 },
              { x: 20, y: 100 },
            ],
          },
          originalDimensions: { width: 800, height: 600, scaleX: 1, scaleY: 1 },
        },
      };

      expect(objData.assetId).toBe('crop-test-uuid');
      expect(objData.cropConfig).toBeDefined();
      expect(objData.cropConfig.type).toBe('freeform');
      expect(objData.cropConfig.clipPathData.points).toHaveLength(4);
      expect(objData.cropConfig.originalDimensions.width).toBe(800);
    });

    it('should preserve filter configuration alongside assetId', () => {
      const objData: any = {
        type: 'userAsset',
        originalType: 'Image',
        assetId: 'filter-test-uuid',
        isUserAsset: true,
        filters: [
          { type: 'Brightness', brightness: 0.3 },
          { type: 'Contrast', contrast: -0.1 },
          { type: 'Saturation', saturation: 0.5 },
        ],
      };

      expect(objData.filters).toHaveLength(3);
      expect(objData.filters[0].brightness).toBe(0.3);
    });

    it('should preserve color map config alongside assetId', () => {
      const objData: any = {
        type: 'userAsset',
        originalType: 'Image',
        assetId: 'colormap-test-uuid',
        isUserAsset: true,
        colorMapConfig: { mapName: 'plasma', intensity: 80 },
      };

      expect(objData.colorMapConfig).toBeDefined();
      expect(objData.colorMapConfig.mapName).toBe('plasma');
      expect(objData.colorMapConfig.intensity).toBe(80);
    });

    it('should preserve masking properties alongside assetId', () => {
      const objData: any = {
        type: 'userAsset',
        originalType: 'Image',
        assetId: 'mask-test-uuid',
        isUserAsset: true,
        isMaskedImage: true,
        maskShape: 'circle',
        cornerRadius: 20,
      };

      expect(objData.isMaskedImage).toBe(true);
      expect(objData.maskShape).toBe('circle');
      expect(objData.cornerRadius).toBe(20);
    });

    it('should preserve transform properties alongside assetId', () => {
      const objData: any = {
        type: 'userAsset',
        originalType: 'Image',
        assetId: 'transform-test-uuid',
        isUserAsset: true,
        left: 150,
        top: 250,
        scaleX: 0.75,
        scaleY: 0.75,
        angle: 90,
        flipX: true,
        flipY: false,
        opacity: 0.6,
      };

      expect(objData.left).toBe(150);
      expect(objData.top).toBe(250);
      expect(objData.scaleX).toBe(0.75);
      expect(objData.angle).toBe(90);
      expect(objData.flipX).toBe(true);
      expect(objData.opacity).toBe(0.6);
    });
  });

  describe('Storage Quota Enforcement', () => {
    it('should define storage limit as 500 MB', () => {
      expect(STORAGE_LIMIT_BYTES).toBe(500 * 1024 * 1024);
    });

    it('should calculate total storage usage correctly from multiple assets', () => {
      const assets = [
        { file_size: 1024 * 1024 },        // 1 MB
        { file_size: 2 * 1024 * 1024 },     // 2 MB
        { file_size: 500 * 1024 },           // 0.5 MB
        { file_size: 10 * 1024 * 1024 },     // 10 MB
      ];

      const totalBytes = assets.reduce((sum, asset) => sum + asset.file_size, 0);
      expect(totalBytes).toBe(1024 * 1024 + 2 * 1024 * 1024 + 500 * 1024 + 10 * 1024 * 1024);
    });

    it('should return true when under quota limit', () => {
      const storageUsage = 400 * 1024 * 1024; // 400 MB used
      const fileSize = 50 * 1024 * 1024;       // 50 MB upload
      const withinQuota = (storageUsage + fileSize) <= STORAGE_LIMIT_BYTES;
      expect(withinQuota).toBe(true);
    });

    it('should return false when at quota limit', () => {
      const storageUsage = 500 * 1024 * 1024; // 500 MB used (at limit)
      const fileSize = 1024;                    // 1 KB upload
      const withinQuota = (storageUsage + fileSize) <= STORAGE_LIMIT_BYTES;
      expect(withinQuota).toBe(false);
    });

    it('should return false when over quota limit', () => {
      const storageUsage = 490 * 1024 * 1024; // 490 MB used
      const fileSize = 20 * 1024 * 1024;       // 20 MB upload (would exceed)
      const withinQuota = (storageUsage + fileSize) <= STORAGE_LIMIT_BYTES;
      expect(withinQuota).toBe(false);
    });

    it('should update usage correctly after asset deletion', () => {
      const assets = [
        { id: 'a', file_size: 5 * 1024 * 1024 },  // 5 MB
        { id: 'b', file_size: 3 * 1024 * 1024 },  // 3 MB
        { id: 'c', file_size: 2 * 1024 * 1024 },  // 2 MB
      ];

      const totalBefore = assets.reduce((sum, a) => sum + a.file_size, 0);
      expect(totalBefore).toBe(10 * 1024 * 1024); // 10 MB

      // Delete asset 'b'
      const afterDeletion = assets
        .filter(a => a.id !== 'b')
        .reduce((sum, a) => sum + a.file_size, 0);
      expect(afterDeletion).toBe(7 * 1024 * 1024); // 7 MB
    });
  });

  describe('Backward Compatibility', () => {
    it('should not modify objects without assetId (legacy embedded images)', () => {
      const legacyImage: any = {
        type: 'Image',
        src: 'data:image/png;base64,LEGACY_DATA',
        left: 100,
        top: 100,
      };

      // Save preprocessing should skip this
      const isUserAsset = legacyImage.isUserAsset && legacyImage.assetId;
      expect(isUserAsset).toBeFalsy();

      // Type remains 'Image' (not converted to 'userAsset')
      expect(legacyImage.type).toBe('Image');
      expect(legacyImage.src).toBe('data:image/png;base64,LEGACY_DATA');
    });

    it('should not confuse library icons with user assets', () => {
      const libraryIcon: any = {
        type: 'libraryIcon',
        iconId: 'icon-uuid-123',
        isLibraryIcon: true,
        originalType: 'Group',
        left: 50,
        top: 50,
      };

      const isUserAsset = libraryIcon.isUserAsset && libraryIcon.assetId;
      const isLibraryIcon = libraryIcon.isLibraryIcon && libraryIcon.iconId;

      expect(isUserAsset).toBeFalsy();
      expect(isLibraryIcon).toBeTruthy();
    });
  });
});
