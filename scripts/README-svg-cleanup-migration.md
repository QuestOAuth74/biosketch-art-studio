# SVG Cleanup Migration Script

## Purpose

This migration script fixes existing icons in the database that were uploaded before the SVG upload bug fix. It removes XML declarations and metadata that can cause rendering issues on the canvas.

## Background

**The Problem:** Icons uploaded before the SVG processor fix may contain:
- XML declarations (`<?xml version="1.0"?>`) that cause parsing errors in Fabric.js
- Adobe Illustrator metadata and namespaces
- Inkscape-specific attributes
- Unnecessary metadata, comments, and whitespace

**The Fix:** New uploads now automatically run through `minifySVG()` which removes these problematic elements. This script applies the same fix to existing icons.

## Usage

### Dry Run (Recommended First)

Preview what changes would be made without modifying the database:

```bash
npx tsx scripts/migrate-icon-svg-cleanup.ts --dry-run
```

### Full Migration

Apply the cleanup to all icons:

```bash
npx tsx scripts/migrate-icon-svg-cleanup.ts
```

### Options

- `--dry-run` - Preview changes without modifying database
- `--batch-size=N` - Process N icons at a time (default: 50)
- `--category=NAME` - Only process icons in a specific category

### Examples

```bash
# Dry run with smaller batch size
npx tsx scripts/migrate-icon-svg-cleanup.ts --dry-run --batch-size=20

# Process only biology icons
npx tsx scripts/migrate-icon-svg-cleanup.ts --category="Bioicons - Biology"

# Full migration with custom batch size
npx tsx scripts/migrate-icon-svg-cleanup.ts --batch-size=100
```

## What It Does

The script:

1. ✅ Fetches all icons from the database in batches
2. ✅ Checks if each icon's SVG content needs cleaning
3. ✅ Applies the same `minifySVG()` function used for new uploads
4. ✅ Validates SVG structure before and after cleaning
5. ✅ Updates only icons that actually need changes
6. ✅ Tracks statistics (bytes saved, success/failure counts)

### Specifically Removes

- XML declarations (`<?xml version="1.0"?>`)
- DOCTYPE declarations
- Metadata tags (`<metadata>`, `<title>`, `<desc>`)
- Editor-specific namespaces (Inkscape, Adobe Illustrator)
- Editor-specific attributes
- Comments (`<!-- ... -->`)
- Excessive whitespace
- Unnecessary decimal precision in numbers

### What It Preserves

- All visible SVG elements (`<path>`, `<circle>`, `<rect>`, etc.)
- Colors and styling
- Transformations
- The essential SVG structure

## Safety Features

- **Idempotent**: Can be run multiple times safely (already-clean icons are skipped)
- **Validation**: Checks SVG structure before and after cleaning
- **Batch processing**: Avoids memory issues and timeouts
- **Error handling**: Failures on individual icons don't stop the entire migration
- **Detailed logging**: Shows exactly what's happening with each icon
- **Dry-run mode**: Preview all changes before committing

## Expected Results

Based on typical SVG files with XML declarations and metadata:

- **Icons needing cleaning**: ~10-50% (depends on source of original uploads)
- **Average space savings**: 200-500 bytes per icon (~5-15% reduction)
- **Time**: ~1-2 minutes per 1000 icons (depends on database latency)

## Requirements

- Node.js environment with TypeScript support
- Environment variables in `.env.local`:
  - `VITE_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (recommended) or `VITE_SUPABASE_ANON_KEY`

## When to Run

Run this migration if:

- ✅ Icons were uploaded before the SVG upload bug fix (before Feb 2026)
- ✅ Users report icons not rendering correctly on canvas
- ✅ You see XML declarations in stored SVG content
- ✅ After migrating icons from an external source

## Related Files

- `src/lib/svgProcessor.ts` - Contains the `minifySVG()` function used by this script
- `tests/e2e/canvas/svg-upload-rendering.spec.ts` - Tests that verify the fix works
- `docs/updates/delivery_report-9-Feb-26.md` - Documentation of the original bug fix
