# Icon Query Audit

**Date:** 2026-01-12
**Purpose:** Identify all icon SELECT queries and determine which need pagination or optimization

---

## Query Inventory

### 1. IconLibrary.tsx (Canvas Sidebar)

**Location:** `src/components/canvas/IconLibrary.tsx`

**Queries:**
- **Line 164:** Search query
  ```typescript
  .from('icons')
  .select('id, name, category, thumbnail')
  .textSearch('search_vector', searchTerms)
  .limit(100)
  ```
  ✅ **Status:** OPTIMIZED - Uses thumbnails only, has LIMIT

- **Line 208-211:** Category load query
  ```typescript
  .from('icons')
  .select('id, name, category, thumbnail')
  .or(orFilter)  // Loads ALL icons in category
  .order('name')
  ```
  ❌ **Problem:** NO LIMIT - loads 237+ icons × 230 KB = 54.8 MB
  🔧 **Fix Needed:** Add pagination (20-50 icons per page)

- **Line 365-368:** On-demand svg_content fetch
  ```typescript
  .from('icons')
  .select('svg_content')
  .eq('id', icon.id)
  .single()
  ```
  ✅ **Status:** CORRECT - Fetches svg_content only when icon clicked

**Impact:** HIGH - Main user-facing component, loads large categories without pagination

---

### 2. ShapesLibrary.tsx (Alternative Canvas Sidebar)

**Location:** `src/components/canvas/ShapesLibrary.tsx`

**Queries:**
- **Line 60:** Category load
  ```typescript
  .from('icons')
  .select('id, name, category, thumbnail, created_at')
  .eq('category', categoryId)
  .order('name')
  ```
  ❌ **Problem:** NO LIMIT
  🔧 **Fix Needed:** Add pagination

- **Line 98-101:** On-demand svg_content
  ```typescript
  .from('icons')
  .select('svg_content')
  .eq('id', icon.id)
  .single()
  ```
  ✅ **Status:** CORRECT

- **Line 162-164:** Favorites load
  ```typescript
  .from('icons')
  .select('id, name, category, thumbnail, created_at')
  .in('id', Array.from(favoriteIconIds))
  ```
  ⚠️ **Status:** OK IF favorites list is small (<100 icons)

**Impact:** MEDIUM - Alternative component, same pagination issue

---

### 3. MembraneBrushIconSelector.tsx

**Location:** `src/components/canvas/MembraneBrushIconSelector.tsx`

**Queries:**
- **Line 163-164:** Search (AFTER optimization)
  ```typescript
  .from('icons')
  .select('id, name, category, thumbnail')
  .textSearch(...)
  .limit(100)
  ```
  ✅ **Status:** OPTIMIZED (just fixed)

- **Line 187-189:** Category load (AFTER optimization)
  ```typescript
  .from('icons')
  .select('id, name, category, thumbnail')
  .eq('category', categoryId)
  .order('name')
  ```
  ❌ **Problem:** NO LIMIT
  🔧 **Fix Needed:** Add pagination

**Impact:** MEDIUM - Specialized feature, less frequent use

---

### 4. IconManager.tsx (Admin Panel)

**Location:** `src/components/admin/IconManager.tsx`

**Queries:**
- **Line 60:** Grid load with pagination
  ```typescript
  .from('icons')
  .select('id, name, category, thumbnail, created_at')
  .range(offset, offset + limit - 1)
  ```
  ✅ **Status:** OPTIMIZED - Has pagination (20 per page)

- **Line 175-178:** On-demand svg_content for regeneration
  ```typescript
  .from('icons')
  .select('svg_content')
  .eq('id', icon.id)
  .single()
  ```
  ✅ **Status:** CORRECT

**Impact:** LOW - Admin only, already paginated

---

### 5. IconCleanup.tsx (Admin Utility)

**Location:** `src/components/admin/IconCleanup.tsx`

**Queries:**
- **Line 29-30:** Metadata scan
  ```typescript
  .from('icons')
  .select('id, name, category, thumbnail')
  ```
  ❌ **Problem:** NO LIMIT - scans ALL icons
  ⚠️ **Note:** This is intentional for cleanup scan, but problematic

- **Line 70-72:** SVG validation (limited)
  ```typescript
  .from('icons')
  .select('id, name, category, thumbnail, svg_content')
  .limit(100)
  ```
  ✅ **Status:** OPTIMIZED - Limited to 100 icons

- **Line 116-119:** On-demand svg_content
  ```typescript
  .from('icons')
  .select('svg_content')
  .eq('id', icon.id)
  .single()
  ```
  ✅ **Status:** CORRECT

**Impact:** LOW - Admin utility, infrequent use

---

### 6. IconUploader.tsx (Admin Upload)

**Location:** `src/components/admin/IconUploader.tsx`

**Queries:**
- **Line 494-500, 581-588:** INSERT operations (AFTER optimization)
  ```typescript
  .from('icons')
  .insert([{
    name, category, svg_content, thumbnail: compressedThumbnail
  }])
  ```
  ✅ **Status:** OPTIMIZED - Now uses compressed thumbnails

**Impact:** N/A - Insert only, not SELECT

---

## Summary

### Critical Fixes Needed

1. **IconLibrary.tsx line 208-211** 🔴 HIGH PRIORITY
   - Add pagination to category load
   - Currently loads 237+ icons without limit (54.8 MB transfer)

2. **ShapesLibrary.tsx line 60** 🟡 MEDIUM PRIORITY
   - Add pagination to category load
   - Same issue as IconLibrary

3. **MembraneBrushIconSelector.tsx line 187-189** 🟡 MEDIUM PRIORITY
   - Add pagination to category load

### Already Optimized

- IconManager.tsx ✅ (has pagination)
- All svg_content fetches ✅ (on-demand only)
- All search queries ✅ (have LIMIT 100)
- IconUploader.tsx ✅ (now creates compressed thumbnails)

---

## Action Plan

1. ✅ **Thumbnail Compression**
   - Created `generateCompressedThumbnail()` utility
   - Updated IconUploader to use compression
   - Created migration script

2. 🔄 **Add Pagination to IconLibrary** (NEXT)
   - Implement UI pagination controls
   - Update query to use `.range(offset, offset + limit - 1)`
   - Default page size: 20-50 icons

3. 🔄 **Add Pagination to ShapesLibrary**
   - Similar to IconLibrary implementation

4. 🔄 **Add Pagination to MembraneBrushIconSelector**
   - Similar to IconLibrary implementation

5. 🔄 **Run Migration Script**
   - Compress all existing thumbnails in database
   - Verify data savings

6. 🔄 **E2E Testing**
   - Create tests for all paginated queries
   - Verify dev_io_logs show small query sizes
