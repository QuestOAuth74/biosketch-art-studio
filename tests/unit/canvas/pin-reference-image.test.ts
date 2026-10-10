import { describe, it, expect, vi } from 'vitest';

/**
 * Unit tests for the Pin Reference Image feature.
 *
 * Tests cover:
 * 1. restoreObjectCustomProps correctly restores isReferenceGuide
 * 2. CANVAS_CUSTOM_PROPS includes isReferenceGuide for serialization
 * 3. AIReferenceChat prop interface accepts onPinToCanvas
 * 4. Reference guide properties (opacity, lockRotation, etc.)
 */

describe('Pin Reference Image Feature', () => {
  describe('canvasPostProcessing — restoreObjectCustomProps', () => {
    it('restores isReferenceGuide flag and locks opacity + rotation', async () => {
      const { restoreObjectCustomProps } = await import('@/lib/canvasPostProcessing');

      // Create a mock Fabric object
      const mockObj: any = {
        type: 'image',
        opacity: 1,
        lockRotation: false,
        set: vi.fn((props: Record<string, unknown>) => {
          Object.assign(mockObj, props);
        }),
        toObject: vi.fn(() => ({})),
      };

      const data: Record<string, unknown> = {
        isReferenceGuide: true,
      };

      restoreObjectCustomProps(mockObj, data);

      expect(mockObj.isReferenceGuide).toBe(true);
      // set() should have been called with opacity 0.4 and lockRotation true
      expect(mockObj.set).toHaveBeenCalledWith({ opacity: 0.4, lockRotation: true });
    });

    it('does not set isReferenceGuide when data does not contain it', async () => {
      const { restoreObjectCustomProps } = await import('@/lib/canvasPostProcessing');

      const mockObj: any = {
        type: 'image',
        opacity: 1,
        lockRotation: false,
        set: vi.fn(),
        toObject: vi.fn(() => ({})),
      };

      const data: Record<string, unknown> = {
        // No isReferenceGuide
      };

      restoreObjectCustomProps(mockObj, data);

      expect(mockObj.isReferenceGuide).toBeUndefined();
    });
  });

  describe('CanvasContext — CANVAS_CUSTOM_PROPS', () => {
    it('includes isReferenceGuide in the custom props list', async () => {
      // Read the source file to verify isReferenceGuide is in the array
      const fs = await import('fs');
      const path = await import('path');
      const content = fs.readFileSync(
        path.resolve(__dirname, '../../../src/contexts/CanvasContext.tsx'),
        'utf-8'
      );

      // Check that isReferenceGuide appears in CANVAS_CUSTOM_PROPS
      expect(content).toContain("'isReferenceGuide'");

      // Verify it's within the CANVAS_CUSTOM_PROPS block
      const propsMatch = content.match(/CANVAS_CUSTOM_PROPS\s*[=:]\s*\[([^\]]+)\]/s);
      expect(propsMatch).not.toBeNull();
      expect(propsMatch![1]).toContain('isReferenceGuide');
    });
  });

  describe('AIReferenceChat — onPinToCanvas prop', () => {
    it('component file includes onPinToCanvas in the props interface', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const content = fs.readFileSync(
        path.resolve(__dirname, '../../../src/components/canvas/AIReferenceChat.tsx'),
        'utf-8'
      );

      // Check props interface includes onPinToCanvas
      expect(content).toContain('onPinToCanvas');
      // Check the Pin button rendering
      expect(content).toContain('Pin as Reference on Canvas');
    });
  });

  describe('PropertiesPanel — reference guide handling', () => {
    it('excludes reference guides from ImagePropertiesSection', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const content = fs.readFileSync(
        path.resolve(__dirname, '../../../src/components/canvas/PropertiesPanel.tsx'),
        'utf-8'
      );

      // Should contain isReferenceGuide exclusion in the image properties condition
      expect(content).toContain('isReferenceGuide');
      // Should contain the Remove Reference button
      expect(content).toContain('Remove Reference');
      // Should contain the info text
      expect(content).toContain('pinned reference guide');
    });
  });

  describe('Canvas.tsx — handlePinReferenceToCanvas', () => {
    it('handler function exists and passes onPinToCanvas to AIReferenceChat', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const content = fs.readFileSync(
        path.resolve(__dirname, '../../../src/pages/Canvas.tsx'),
        'utf-8'
      );

      // Check handler function exists
      expect(content).toContain('handlePinReferenceToCanvas');
      // Check it's passed to AIReferenceChat
      expect(content).toContain('onPinToCanvas={handlePinReferenceToCanvas}');
      // Check it sets opacity to 0.4
      expect(content).toContain('opacity: 0.4');
      // Check it sets isReferenceGuide
      expect(content).toContain('isReferenceGuide');
      // Check it sends to back
      expect(content).toContain('sendObjectToBack');
      // Check toast notification
      expect(content).toContain('Reference image pinned');
    });
  });

  describe('Reference guide property values', () => {
    it('opacity is exactly 0.4 in both handler and post-processing', async () => {
      const fs = await import('fs');
      const path = await import('path');

      // Check Canvas.tsx handler
      const canvasContent = fs.readFileSync(
        path.resolve(__dirname, '../../../src/pages/Canvas.tsx'),
        'utf-8'
      );
      // Find the handlePinReferenceToCanvas function and verify opacity: 0.4
      const handlerMatch = canvasContent.match(
        /handlePinReferenceToCanvas[\s\S]*?opacity:\s*([\d.]+)/
      );
      expect(handlerMatch).not.toBeNull();
      expect(parseFloat(handlerMatch![1])).toBe(0.4);

      // Check canvasPostProcessing.ts
      const postProcContent = fs.readFileSync(
        path.resolve(__dirname, '../../../src/lib/canvasPostProcessing.ts'),
        'utf-8'
      );
      // Find the isReferenceGuide block and verify opacity: 0.4
      const restoreMatch = postProcContent.match(
        /isReferenceGuide[\s\S]*?opacity:\s*([\d.]+)/
      );
      expect(restoreMatch).not.toBeNull();
      expect(parseFloat(restoreMatch![1])).toBe(0.4);
    });

    it('lockRotation is true in both handler and post-processing', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const canvasContent = fs.readFileSync(
        path.resolve(__dirname, '../../../src/pages/Canvas.tsx'),
        'utf-8'
      );
      const handlerMatch = canvasContent.match(
        /handlePinReferenceToCanvas[\s\S]*?lockRotation:\s*(true|false)/
      );
      expect(handlerMatch).not.toBeNull();
      expect(handlerMatch![1]).toBe('true');

      const postProcContent = fs.readFileSync(
        path.resolve(__dirname, '../../../src/lib/canvasPostProcessing.ts'),
        'utf-8'
      );
      const restoreMatch = postProcContent.match(
        /isReferenceGuide[\s\S]*?lockRotation:\s*(true|false)/
      );
      expect(restoreMatch).not.toBeNull();
      expect(restoreMatch![1]).toBe('true');
    });
  });
});
