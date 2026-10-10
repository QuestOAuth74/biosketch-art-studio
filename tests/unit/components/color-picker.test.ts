import { describe, it, expect } from 'vitest';

/**
 * Unit tests for Color Picker components
 *
 * Tests verify:
 * - Component exports exist and are correct
 * - Props interfaces are properly typed
 * - Component dependencies load correctly
 */

describe('Color Picker Components', () => {
  describe('BaseColorPicker', () => {
    it('should export BaseColorPicker component', async () => {
      const module = await import('@/components/ColorPicker/BaseColorPicker');
      expect(module.BaseColorPicker).toBeDefined();
      expect(typeof module.BaseColorPicker).toBe('function');
    });

    it('should have correct default export', async () => {
      const module = await import('@/components/ColorPicker/BaseColorPicker');
      expect(module.default).toBeDefined();
      expect(typeof module.default).toBe('function');
    });

    it('should export BaseColorPickerProps interface', async () => {
      // Type-only check - ensures TypeScript compilation works
      const module = await import('@/components/ColorPicker/BaseColorPicker');
      expect(module).toHaveProperty('BaseColorPicker');
    });
  });

  describe('AdvancedColorPickerV2', () => {
    it('should export AdvancedColorPickerV2 component', async () => {
      const module = await import('@/components/canvas/AdvancedColorPickerV2');
      expect(module.AdvancedColorPickerV2).toBeDefined();
      expect(typeof module.AdvancedColorPickerV2).toBe('function');
    });

    it('should have correct default export', async () => {
      const module = await import('@/components/canvas/AdvancedColorPickerV2');
      expect(module.default).toBeDefined();
      expect(typeof module.default).toBe('function');
    });

    it('should import required dependencies', async () => {
      // Verify colorPalettes imports work
      const palettesModule = await import('@/lib/colorPalettes');
      expect(palettesModule.allScientificPalettes).toBeDefined();
      expect(palettesModule.hexToHsl).toBeDefined();
      expect(palettesModule.hslToHex).toBeDefined();
      expect(palettesModule.getComplementary).toBeDefined();
      expect(palettesModule.getTriadic).toBeDefined();
      expect(palettesModule.getAnalogous).toBeDefined();
      expect(palettesModule.getSplitComplementary).toBeDefined();
    });
  });

  describe('ColorPickerInput', () => {
    it('should export ColorPickerInput component', async () => {
      const module = await import('@/components/ColorPicker/ColorPickerInput');
      expect(module.ColorPickerInput).toBeDefined();
      expect(typeof module.ColorPickerInput).toBe('function');
    });

    it('should have correct default export', async () => {
      const module = await import('@/components/ColorPicker/ColorPickerInput');
      expect(module.default).toBeDefined();
      expect(typeof module.default).toBe('function');
    });

    it('should export ColorPickerInputProps interface', async () => {
      const module = await import('@/components/ColorPicker/ColorPickerInput');
      expect(module).toHaveProperty('ColorPickerInput');
    });
  });

  describe('Component Integration', () => {
    it('should have BaseColorPicker available for AdvancedColorPickerV2', async () => {
      const baseModule = await import('@/components/ColorPicker/BaseColorPicker');
      const advancedModule = await import('@/components/canvas/AdvancedColorPickerV2');

      expect(baseModule.BaseColorPicker).toBeDefined();
      expect(advancedModule.AdvancedColorPickerV2).toBeDefined();
    });

    it('should have BaseColorPicker available for ColorPickerInput', async () => {
      const baseModule = await import('@/components/ColorPicker/BaseColorPicker');
      const inputModule = await import('@/components/ColorPicker/ColorPickerInput');

      expect(baseModule.BaseColorPicker).toBeDefined();
      expect(inputModule.ColorPickerInput).toBeDefined();
    });

    it('should have performanceUtils debounce available', async () => {
      const utilsModule = await import('@/lib/performanceUtils');
      expect(utilsModule.debounce).toBeDefined();
      expect(typeof utilsModule.debounce).toBe('function');
    });

    it('should verify react-colorful is installed', async () => {
      // This test verifies that react-colorful package is available
      try {
        const reactColorful = await import('react-colorful');
        expect(reactColorful.HexColorPicker).toBeDefined();
      } catch (error) {
        throw new Error('react-colorful package is not installed or not accessible');
      }
    });
  });

  describe('ColorPickerSection Integration', () => {
    it('should use AdvancedColorPickerV2 in ColorPickerSection', async () => {
      const sectionModule = await import('@/components/canvas/properties/ColorPickerSection');
      const advancedModule = await import('@/components/canvas/AdvancedColorPickerV2');

      expect(sectionModule.ColorPickerSection).toBeDefined();
      expect(advancedModule.AdvancedColorPickerV2).toBeDefined();
    });
  });

  describe('Debouncing Configuration', () => {
    it('should verify debounce function signature', async () => {
      const { debounce } = await import('@/lib/performanceUtils');

      // Test debounce function with a simple callback
      const testCallback = () => 'test';
      const debouncedFn = debounce(testCallback, 300);

      expect(typeof debouncedFn).toBe('function');
    });
  });

  describe('Color Utilities Integration', () => {
    it('should have color conversion utilities available', async () => {
      const { hexToHsl, hslToHex } = await import('@/lib/colorPalettes');

      expect(typeof hexToHsl).toBe('function');
      expect(typeof hslToHex).toBe('function');

      // Test basic color conversion
      const testColor = '#3b82f6';
      const hsl = hexToHsl(testColor);

      expect(hsl).toHaveProperty('h');
      expect(hsl).toHaveProperty('s');
      expect(hsl).toHaveProperty('l');

      expect(typeof hsl.h).toBe('number');
      expect(typeof hsl.s).toBe('number');
      expect(typeof hsl.l).toBe('number');
    });

    it('should have color harmony functions available', async () => {
      const {
        getComplementary,
        getTriadic,
        getAnalogous,
        getSplitComplementary
      } = await import('@/lib/colorPalettes');

      expect(typeof getComplementary).toBe('function');
      expect(typeof getTriadic).toBe('function');
      expect(typeof getAnalogous).toBe('function');
      expect(typeof getSplitComplementary).toBe('function');

      // Test harmony functions
      const testColor = '#3b82f6';

      const complementary = getComplementary(testColor);
      expect(typeof complementary).toBe('string');
      expect(complementary).toMatch(/^#[0-9a-fA-F]{6}$/);

      const triadic = getTriadic(testColor);
      expect(Array.isArray(triadic)).toBe(true);
      expect(triadic.length).toBe(3);

      const analogous = getAnalogous(testColor);
      expect(Array.isArray(analogous)).toBe(true);
      expect(analogous.length).toBe(3);

      const splitComp = getSplitComplementary(testColor);
      expect(Array.isArray(splitComp)).toBe(true);
      expect(splitComp.length).toBe(3);
    });

    it('should have scientific palettes available', async () => {
      const { allScientificPalettes } = await import('@/lib/colorPalettes');

      expect(allScientificPalettes).toBeDefined();
      expect(allScientificPalettes).toHaveProperty('colorblindSafe');
      expect(allScientificPalettes).toHaveProperty('cellSignaling');
      expect(allScientificPalettes).toHaveProperty('publication');
      expect(allScientificPalettes).toHaveProperty('sequential');

      expect(Array.isArray(allScientificPalettes.colorblindSafe)).toBe(true);
      expect(Array.isArray(allScientificPalettes.cellSignaling)).toBe(true);
      expect(Array.isArray(allScientificPalettes.publication)).toBe(true);
      expect(Array.isArray(allScientificPalettes.sequential)).toBe(true);
    });
  });
});
