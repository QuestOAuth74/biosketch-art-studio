# SVG Upload and Canvas Rendering Tests

## Overview

This test suite validates the complete SVG upload and rendering pipeline, ensuring that uploaded SVG icons:
1. Are properly processed (XML declarations removed, metadata stripped)
2. Render correctly on the canvas
3. Have valid dimensions (not 0x0)

## Test Files

### 1. Test Fixture
**Location:** `tests/e2e/fixtures/test-svg-with-xml-declaration.svg`

This SVG deliberately includes problematic elements to test our fix:
- ✅ XML declaration (`<?xml version="1.0"...?>`)
- ✅ Adobe Illustrator namespace (`xmlns:i`)
- ✅ Metadata tags (`<metadata>`)
- ✅ Complex shapes (circle, path, text)

### 2. E2E Test Suite
**Location:** `tests/e2e/canvas/svg-upload-rendering.spec.ts`

Two comprehensive tests:

#### Test 1: Single Upload & Canvas Rendering
Tests the complete flow:
1. Upload SVG via admin interface
2. Verify icon appears in database
3. Verify XML declaration was removed
4. Verify Adobe metadata was removed
5. Create new canvas project
6. Click icon to add to canvas
7. Verify icon renders with valid dimensions
8. Verify no XML parsing errors

#### Test 2: Bulk ZIP Upload
Tests batch upload:
1. Create ZIP with multiple SVG files
2. Upload ZIP via admin interface
3. Verify all icons processed correctly
4. Verify XML declarations removed from all

## Running the Tests

### Run All Canvas Tests
```bash
npm run test:e2e:canvas
```

### Run Only SVG Upload Tests
```bash
npx playwright test tests/e2e/canvas/svg-upload-rendering
```

### Run in UI Mode (Visual)
```bash
npx playwright test tests/e2e/canvas/svg-upload-rendering --ui
```

### Run in Debug Mode
```bash
npx playwright test tests/e2e/canvas/svg-upload-rendering --debug
```

### Run in Headed Mode (See Browser)
```bash
npx playwright test tests/e2e/canvas/svg-upload-rendering --headed
```

## What the Tests Verify

### ✅ SVG Processing
- XML declarations removed
- Adobe Illustrator namespaces removed
- Metadata tags stripped
- Essential SVG structure preserved

### ✅ Canvas Rendering
- Icon appears on canvas after clicking
- Icon has valid width and height (not 0x0)
- No XML parsing errors in console
- Canvas objects count increases

### ✅ Database Storage
- Icon stored with correct name
- svg_content field contains processed SVG
- Thumbnail generated correctly

## Test Coverage

These tests cover the milestone requirements:
- ✅ Upload new SVG icon via admin interface → Icon appears in icon library
- ✅ Click newly uploaded icon in library → Icon appears on canvas
- ✅ Icon renders on canvas with valid dimensions

## Troubleshooting

### Test Fails with "Icon not found"
- Check that the category "Bioicons - Biology" exists
- Verify dev server is running on correct port
- Check database connection

### Test Fails with "XML Parsing Error"
- This indicates the fix is not working
- Check that `minifySVG` is being called
- Verify the regex for XML declaration removal

### Icon Renders as 0x0
- Check that Fabric.js is parsing SVG correctly
- Verify viewBox/width/height attributes exist
- Check console for parsing errors

## Related Files

### Source Code
- `src/lib/svgProcessor.ts` - SVG minification and processing
- `src/components/admin/IconUploader.tsx` - Upload handling
- `src/components/canvas/FabricCanvas.tsx` - Canvas rendering

### Other Tests
- `tests/e2e/admin/icon-upload-pathways.spec.ts` - Upload pathway tests
- `tests/unit/algorithms/svg-processing.test.ts` - Unit tests for SVG processor

## Success Criteria

All tests should pass with output similar to:
```
✅ SVG upload and canvas rendering test passed!
   - Icon ID: abc123...
   - XML declaration removed: ✓
   - Adobe metadata removed: ✓
   - Icon rendered on canvas: ✓
   - Icon has valid dimensions: ✓

✅ Bulk ZIP upload test passed!
   - 2 icons uploaded
   - All XML declarations removed: ✓
```
