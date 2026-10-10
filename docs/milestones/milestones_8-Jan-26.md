# Science Canvas Creator - Development Milestones

**Date:** 8 January 2026
**Total Price:** $3,275 USD
**Total Timeline:** 5-7 weeks

---

## Overview

**Recommended Milestones (A, B, C):** Core improvements addressing performance diagnostics, UI organization, and essential UX enhancements. These milestones provide the foundation for a more maintainable, performant, and user-friendly application.

**Optional Milestones (D, E):** Feature additions that enhance specific functionality but are not critical to the core application experience. These can be implemented based on user needs and priority.

---

**Milestone A:** [Database I/O Diagnostics](#milestone-a-database-io-diagnostics) - **$595** - ~1 week

**Milestone B:** [UI Redesign](#milestone-b-ui-toolbar-consolidation) - **$645** - ~1 week

**Milestone C:** [Enhanced UX Features](#milestone-c-enhanced-ux-features) - **$795** - 1-2 weeks

**Milestone D:** [Membrane Tool Redesign](#milestone-d-membrane-tool-redesign) - **$645** - ~1 week

**Milestone E:** [Chart Integration](#milestone-e-chart-integration) - **$595** - ~1 week

**Total:** **$3,275** - **5-7 weeks**

---

<div style="page-break-after: always;"></div>

# Milestone A: Database I/O Diagnostics

**Price:** $595
**Timeline:** ~1 week

---

## Current State

The application frequently depletes its Disk I/O budget despite stress tests passing and some optimizations applied. The development database reaches quota limits with only a single user actively using the app and without running any tests, indicating that simply increasing I/O limits would not solve the underlying problem. There is no visibility into which functions in the codebase are causing excessive database operations.

## Deliverables

**Database Logging Table:**

Create `dev_io_log` table to track all database operations with their source:

**Supabase Operation Wrapper:**

- Wrap all Supabase database calls to log them with source context
- Add `source` parameter to every database operation identifying the calling function
- Log operation type, table name, data size, and source
- Development-only (`import.meta.env.DEV === true`)

**Dev Diagnostics Page (`/dev/io-diagnostics`):**

Simple development-only page showing database operations:

- Only accessible when `import.meta.env.DEV === true`
- Redirects to home page in production

**Operations Table:**

- Display last 1000 operations
- Columns: Timestamp, Type, Table, Size (KB), Source
- Sortable by any column
- Default sort: newest first

**Group by Source:**

- Shows operations grouped by source function
- Displays: Source → Count + Total MB
- Sortable by Total MB (descending)

**CSV Export:**

- "Export CSV" button downloads all filtered data
- Use for deeper analysis in spreadsheet

**Performance Optimization & Issue Resolution:**

After implementing the diagnostics system, track and analyze database I/O patterns during development to identify problematic functions:

- Monitor dev diagnostics page during typical usage scenarios (canvas editing, project loading, auto-save)
- Identify top 3-5 functions/features causing excessive database operations
- Apply targeted optimizations to reduce unnecessary database calls:
  - Implement debouncing for rapid sequential operations
  - Add batching for multiple related database writes
  - Optimize query patterns (reduce SELECT frequency, improve filtering)
  - Add client-side caching where appropriate
- Document baseline metrics before optimization and final metrics after
- Verify optimizations reduce I/O without breaking functionality

## Tests

**Expand e2e and/or unit test coverage as required:**

- Ensure that all features related to optimized queries have testing coverage applied to ensure that optimizations don't disrupt any existing functionality

**Manual Tests - Optimization Impact:**

- Review diagnostics page after typical 5-minute editing session
- Monitor diagnostics during stress test (100 rapid object additions)
- Compare baseline metrics (before optimization) vs. final metrics (after optimization) → Document improvement percentage
- Verify all canvas features still function correctly after optimization (no regressions)

---

<div style="page-break-after: always;"></div>

# Milestone B: UI Redesign

**Price:** $645
**Timeline:** ~1 week

---

## Deliverables

### Toolbar Consolidation:

- **Layer reorder buttons** (Bring to Front, Send to Back, etc.): Group into single "Arrange" popover menu in top toolbar (4 buttons → 1 popover button)
- **Text tools consolidation:** Remove text formatting tools from top toolbar, consolidate all text tools into single popover in left toolbar (multiple buttons → 1 popover button)
- **Shapes consolidation:** Remove shapes dropdown from top toolbar, keep only in left toolbar shapes popover
- **QuickSettings removal:** Remove QuickSettings gear icon, relocate functionality:
  - Grid/Ruler toggles, Snap to Grid, Grid Size slider, Grid Pattern selector → New "Grid & Rulers" popover in top toolbar
  - Gradient Background toggle → Move to Diagram tab in Properties panel (alongside existing background color)
- **Save button redesign:** Consolidate "Saved"/"Saving" badges into the save button itself:
  - Button disabled and shows "Saved ✓" when no unsaved changes
  - Button enabled when unsaved changes exist
  - Shows "Saving..." spinner when saving in progress
- **Tooltips:** All toolbar buttons must have descriptive tooltips
- **Vertical toolbar optimization:** Condense labels and separators to prevent vertical scrolling
- **Annotation tools consolidation:** Group callout, leader lines, bracket lines, and zoom callouts into single popover menu button
- **Tool placement improvements:**
  - Move eraser button to top toolbar group with select, pen, and freehand line tools
  - Remove crop button from toolbar, add to Properties panel when image/icon selected

#### Premium Features UI Redesign:

Current design shows "{X}/3 Projects" button that redirects to projects page. New integrated design:

**Header Layout Changes:**

- Remove PowerPoint button from vertical (left) toolbar
- Replace the "{X}/3 Projects" text button in the header with three new icon buttons:
  1. **AI Icon Generator button** (left-most of the three)
  2. **PowerPoint Generator button** (middle of the three)
  3. **Share button** (right-most of the three, outside locked buttons) - **NEW:** Currently Share button only exists on Projects page, needs to be added to canvas editor header; opens ShareProjectDialog when clicked

**Locked State Styling (when <3 approved projects):**

- AI Icon Generator and PowerPoint buttons enclosed in a **visual border with padlock icon**
- Border styling clearly indicates locked state (e.g., dashed border, muted colors, padlock overlay in corner)
- Buttons are disabled but clickable (click opens premium features popover)
- Share button is always enabled and positioned to the right of locked buttons - displayed with a key icon when <3 approved projects

**Premium Features Popover:**

- Clicking either locked premium buttons (AI Icon or PowerPoint) will open the popover

Popover content:

- **Progress bar:**
  1. **Published Progress:** Shows X/3 projects published (gray color) and Y/3 projects approved (blue/primary color)
  - Example: "2 of 3 published • 1 of 3 approved"
- **Explanation text:** "Premium features unlock when 3 projects are published and approved by admin"
- **Two feature cards** (one per premium feature):
  - Card 1: "🎨 AI Icon Generator" with brief description
  - Card 2: "📊 PowerPoint Maker" with brief description
- **Share button:** Opens ShareProjectDialog (allows user to publish current project directly from canvas editor)
- **Admin approval note:** "Admins typically review within 24-48 hours"

**Unlocked State (≥3 approved projects):**

- Padlock border disappears, key removed from share button
- AI Icon Generator and PowerPoint buttons become fully enabled
- Buttons style changes to indicate active/available state
- Clicking buttons opens their respective dialogs (not the popover)

#### AI Generated Icons UI Reorganization:

Current state: "BioSketch Icons" category in icon library contains AI-generated icons. New organization:

**New "AI Generated Icons" Section:**

Move the "BioSketch Icons" category into a dedicated section in left sidebar Icons panel, separate from category browsing:

- **Location:** Above search/filter and icon grid, replacing the current AI button
- **Layout:** Collapsible section with prominent header
- **Tabbed Interface:**

  - **Tab 1: "Community AI Icons"**

    - Shows AI-generated icons from other users that have been approved by admin
    - Only displays icons with `approval_status: 'approved'` from icon_submissions table

  - **Tab 2: "My Generated Icons"**

    - Shows all icons the current user has generated via AI Icon Generator

- **"Generate with AI" Button:**
  - Prominent button at top of AI Generated Icons section, visible in both tabs
  - Disabled (grayed out) when premium features locked
  - Shows padlock icon when locked
  - Clicking when locked opens premium features popover
  - When unlocked, opens AI Icon Generator dialog
  - Tooltip: "Premium feature - Share 3 approved projects to unlock" (when locked)

---

### Properties Panel Refactoring:

**Refactoring Goals:**

The properties panel has become bloated and complex, creating challenges for future development. The following tasks will improve the maintainability of the component:

1. Extract inline sections to dedicated components
2. Create reusable property control components
3. Consolidate related properties
4. Reorganize tab structure for clearer purpose separation
5. Extract business logic to custom hooks
6. Implement consistent accordion usage patterns

**Accordion Usage Guidelines:**

- **No accordion (always visible):** Primary controls used frequently (Colors, Position, Size)
- **Accordion (default open):** Secondary controls used regularly (Gradients, Rotation)
- **Accordion (default closed):** Advanced/occasional controls (Effects, Filters, Scientific Color Maps)
- Remove accordions from single-control sections (wastes space)

**New Tab Organization:**

**Style Tab** (universal styling that applies to all/most objects):

- Colors section - no accordion, always visible (Fill, Stroke with unified color picker)
- Gradients accordion - default open (Linear, Radial)
- Effects accordion - default closed (Shadow, Blur)
- Image-specific styling (when image selected):
  - Image Adjustments accordion - default closed (Brightness, Contrast, Saturation)
  - Image Filters accordion - default closed (Grayscale, Sepia)
  - Scientific Color Maps accordion - default closed (False color, heat map for microscopy)
- Icon Styling section (when icon/SVG group selected):
  - Tone presets, custom tone color, intensity slider
- Shape Masking section (when standalone shape selected):
  - "Add Image as Mask" button to upload image into shape

**Transform Tab** (when object selected):

- Position section - no accordion, always visible (X, Y inputs)
- Size section - no accordion, always visible (Width, Height with lock aspect ratio toggle)
- Rotation accordion - default open (Angle input, rotation buttons)
- Alignment accordion - default open (Left/Center/Right, Top/Middle/Bottom buttons)
- Distribution accordion - default closed (Horizontal/Vertical spacing, Match width/height)
- Layer Order accordion - default closed (Front/Back/Forward/Backward buttons)

**Properties Tab** (context-aware, object-type specific controls):

All object-specific properties consolidated here:

- **Text objects:** Font, size, color, alignment, subscript/superscript, special characters
- **Text on Path:** Path offset, position along path, flip orientation
- **Text Box:** Content textarea, dimensions, background color, border color and width
- **Lines:** Start/end markers, dash pattern, intersection jumps, simplification
- **Freeform lines:** Color, thickness, smoothing strength, start/end markers
- **Curved lines:** Edit mode instructions (double-click to edit control point)
- **Bezier paths:** Simplification panel (tolerance slider, simplify button)
- **Brackets:** Size (height/width), depth, label offset X/Y
- **Leader lines:** Arrow visibility toggle, label offset X/Y
- **Callouts:** Legend visibility toggle
- **Membranes:** Icon selection, spacing, curve editing, path edit mode instructions
- **Images:** Crop tool launcher (replaces toolbar crop button)
- **Masked Images:** Edit mask shape, replace image, adjust fit, remove mask

**Special UI States:**

- **Edit Mode:** When bezier/curved line edit mode active, dedicated EditModePanel replaces tab interface with edit-specific controls
- **Pin Object Section:** Displayed above tabs when object selected, allows pinning/unpinning objects to prevent accidental modification
- **Diagram Tab:** Shown when no object selected - grid, rulers, snap settings, background color, gradient toggle, paper size, custom dimensions

## Tests

**E2E Tests - Save Button:**

- Make canvas change → Save button enabled and shows "Save"
- Click Save button → Button shows "Saving..." with spinner
- After save completes → Button disabled and shows "Saved ✓"
- Make another change → Button enabled again

**E2E Tests - Premium Features UI:**

- **Locked state (user has <3 approved projects):**

  - Click AI Icon Generator button → Premium features popover opens
  - Click PowerPoint Generator button → Premium features popover opens
  - Click Share button → Opens ShareProjectDialog (not popover)

- **Premium features popover content:**

  - Published progress bar shows X/3 projects published (gray color)
  - Approved progress bar shows Y/3 projects approved (blue/primary color)
  - Text displays: "X of 3 published • Y of 3 approved"
  - Click Share button → Opens ShareProjectDialog for current project

- **Unlocked state (user has ≥3 approved projects):**

  - Click AI Icon Generator button → Opens AI Icon Generator dialog (NOT popover)
  - Click PowerPoint Generator button → Opens PowerPoint Generator dialog (NOT popover)
  - Click Share button → Opens ShareProjectDialog for current project

**E2E Tests - AI Generated Icons Section:**

- **"Generate with AI" button:**

  - Button visible at top of AI Generated Icons section
  - When locked (user has <3 approved projects):
    - Click button → Opens premium features popover
  - When unlocked:
    - Click button → Opens AI Icon Generator dialog

**Manual Tests - Properties Panel:**

- Style tab contains all visual properties
- Transform tab contains all position/size/rotation properties
- Properties tab shows only relevant controls for selected object type
- No duplicate controls across tabs (single source of truth for each property)

---

<div style="page-break-after: always;"></div>

# Milestone C: Enhanced UX Features

**Price:** $795
**Timeline:** 1-2 weeks

---

## Deliverables

**Comprehensive Undo/Redo System:**

- **Complete history tracking:** Every canvas operation tracked and can be undone/redone
- **Property-level tracking:** Color, position, size, rotation, opacity changes all undoable
- **Custom tool support:** Anchor point movements, control point adjustments, gradient edits all undoable
- **Deep history:** 100 operations can be undone (5x increase from current 20)
- **Transaction grouping:** Related changes (like multi-object drag) undo as single step

**Style Presets System:**

- **Save styles as presets:** Style an object (colors, stroke, opacity, shadow, gradients) → Click "Save as Preset" → Name it (e.g., "Main Figure Style", "Nature Journal")
- **Quick apply:** Select object → Click preset → All styles apply instantly
- **Bulk apply:** Select 10 objects → Apply preset → All update
- **Saves:** Fill color, stroke color/width, opacity, gradient, shadow effects, font (for text)

**Command Palette (⌘K Fuzzy Search):**

- Press ⌘K or click icon button in top toolbar to open command palette overlay
- Fuzzy search across all tools, actions, and menu items
- Search examples:
  - Type "undo" → Shows "Undo (⌘Z)" action
  - Type "rect" → Shows "Rectangle" tool
  - Type "align" → Shows all alignment options
  - Type "grid" → Shows grid toggle and settings
- Arrow keys to navigate results
- Enter to execute selected command
- Escape or ⌘K again to close
- Shows recent/frequently used commands at top
- Displays keyboard shortcuts for each command

**React-Colorful Color Pickers:**

- Replace standard HTML color inputs with react-colorful component
- **Debounced application:** Color changes apply after 300ms of no interaction (prevents lag during slider adjustments)

**Interactive Zoom Control:**

- Click zoom level → Opens dropdown popover with:
  - **Zoom presets:** 25%, 50%, 75%, 100%, 150%, 200%, 400%
  - **Fit to Screen** option
  - **Custom zoom input:** Text field to enter precise percentage (e.g., "137")

**Align Ruler to Grid:**

- Ruler markings align with grid intervals (e.g., if grid is 20px, ruler shows marks at 20, 40, 60, etc.)
- Provides visual consistency when using both grid and rulers together

**Smart Thumbnail Updates (Lazy Loading):**

- **Lazy loading on projects page** - Thumbnails generated only when viewing projects page
- **Stale detection** - Compare thumbnail timestamp vs. project timestamp to identify outdated thumbnails
- **Progressive regeneration:**
  - Show existing stale thumbnails immediately (instant page load)
  - Add loading spinner overlay to stale thumbnails
  - User can browse while thumbnails regenerate (no UI blocking)

## Tests

**E2E Tests - Undo/Redo System:**

- Resize shape → undo → size reverts to original
- Change shape color → undo → color reverts to original
- Move anchor point on line → undo → anchor point returns to original position
- Adjust curve control point → undo → curve reverts
- Make change → undo → make different change → redo stack cleared
- Perform 100 operations → Undo 100 times → All operations revert correctly
- Transaction grouping: Drag 5 objects together → Undo once → All 5 objects return to original positions

**Unit Tests - Undo/Redo:**

- Transaction grouping batches multi-object changes into single undo step
- History stack enforces 100 operation maximum and drops oldest
- Property diffing stores only changed property values, not full snapshots

**Manual Tests - Undo/Redo:**

- History works consistently across all tools (no tool-specific failures)
- Undo/redo with complex objects (groups, images, text) works correctly
- All property types can be undone (color, position, size, rotation, opacity, anchor points, control points, gradients)
- Memory usage remains stable after 100+ operations
- Performance: undo/redo completes in <50ms (feels instant)

**E2E Tests - Style Presets:**

- Create rectangle → Set fill to blue, stroke to black 2px, opacity 80%
- Click "Save as Preset" → Enter name "Blue Style" → Preset saves
- Preset appears in Style Presets panel under "Personal"
- Create circle → Click "Blue Style" preset → Circle adopts all styles
- Select 5 shapes → Click preset → All 5 adopt styles

**E2E Tests - Command Palette:**

- Press ⌘K → Command palette opens with search input focused
- Type "undo" → "Undo (⌘Z)" appears in results
- Press Enter → Undo action executes, palette closes
- Press ⌘K → Type "rect" → "Rectangle" tool appears
- Arrow down → Highlight moves to next result
- Press Escape → Palette closes
- Open palette → Recent commands shown at top of list

**E2E Tests - Zoom Control:**

- Click zoom level "100%" text → Dropdown popover opens
- Click "50%" → Canvas zooms to 50%, popover closes
- Click "Fit to Screen" → Canvas zooms to fit viewport
- Click zoom level → Type "125" in custom input → Press Enter → Canvas zooms to 125%
- Type invalid value "500" → Shows validation error (max 400%)

**Manual Tests:**

- Fuzzy matching works (typing "rect" finds "Rectangle")
- Align ruler to grid feature provides visual consistency

---

<div style="page-break-after: always;"></div>

# Milestone D: Membrane Tool Redesign

**Price:** $645
**Timeline:** ~1 week

---

## Current State

The existing membrane tool has limitations:

- **Icon filtering:** Searches all icons in library, not just membrane-specific icons
- **Incorrect arrangement:** Icons are strung together without proper directional alignment
- **Limited editing:** Cannot modify the path after creation
- **Fixed composition:** Cannot swap individual icons or adjust sizing dynamically

## Deliverables

**Path-Based Membrane Tool:**

The current dialog will be replaced with a section in the properties panel, allowing the following controls:

- **Draw custom paths:** User draws a line (open-ended like pen tool or closed like polygon tool)
- **Membrane icon selection:** Select from a set range of specific cell membrane organelles to arrange along the path
- **Intelligent alignment:** Icons automatically align correctly along the line's direction
- **Dynamic resizing:** Icons resize automatically, number of icons adjusts based on size
- **Individual icon editing:**
  - Swap any icon for another membrane organelle
  - All icons update position when path is modified
  - Icons maintain proper alignment and spacing
- **Edit mode:** Double-click element to enter edit mode (same as pen tool editing)
  - Modify anchor points and curves
  - Icons update in real-time as path changes
- **Context menu integration:** Replace current dialog with context menu in Properties panel
- **Path types:**
  - Open paths: Like pen tool (start and end points)
  - Closed paths: Like custom polygon tool (continuous loop)

**Membrane Icon Library:**

- Only appropriate membrane icons available for selection
- Icons categorized: channels, receptors, pumps, carriers, etc.
- Preview of selected icons before placement

## Tests

**Manual Tests:**

- Icons align correctly on curved paths (no rotation artifacts)
- Double-click edit mode matches pen tool behavior
- Icon swapping doesn't break alignment
- Resizing feels smooth and proportional
- Context menu in Properties panel is more discoverable than old dialog

# Milestone E: Chart Integration

**Price:** $595
**Timeline:** ~1 week

---

## Deliverables

**Chart Creation Dialog (Plotly-based):**

A tool icon button in the left toolbar opens a dialog with live preview and three sections:

**1. Data Section:**

- Editable spreadsheet table (similar to Excel/Google Sheets)
- Column headers are editable (click to rename)
- Add/remove rows with +/- buttons
- "Paste from Clipboard" button (detects CSV/TSV format)
- "Upload CSV" button (file picker)
- Auto-detect numeric vs text columns
- Minimum 2 columns required

**2. Chart Type & Mapping:**

- Chart type selector with 4 options:

  - **Bar Chart** (vertical bars, grouped if multiple Y columns)
  - **Line Chart** (connected points, multiple series supported)
  - **Scatter Plot** (points only, multiple series supported)
  - **Box Plot** (shows median, quartiles, outliers)

- Column mapping dropdowns:
  - **X-axis:** Select which column (required)
  - **Y-axis:** Select which column(s) - can select multiple for grouped charts (required)
  - **Error Bars:** Select column with error values (optional)
  - **Error Bar Type:** None / Standard Deviation (SD) / Standard Error (SEM)

**3. Customize Section:**

- **Chart Title:** Text input (optional)
- **X-axis Label:** Text input (defaults to column name)
- **Y-axis Label:** Text input (defaults to column name)
- **Series Colors:** Color picker for each data series (defaults to publication-safe palette)
- **Font Size:** Slider (10-18pt, default 12pt)
- **Show Legend:** Checkbox (default: true if multiple series)
- **Background:** Transparent / White toggle

**Live Preview:**

- Chart preview updates immediately as user changes any setting
- Shows in right half of dialog (or below on smaller screens)
- Preview scales to fit available space

**Insertion:**

- "Insert Chart" button adds chart to canvas as grouped object
- Chart data and configuration saved with canvas project
- Chart renders at 600×400px by default (user can resize after insertion)

**Editing After Insertion:**

- Select chart on canvas → Properties panel shows "Edit Chart" button
- Clicking "Edit Chart" reopens dialog with current data and settings
- Changes update chart immediately
- "Edit Data" shortcut button in Properties panel opens dialog to Data section
- "Edit Style" shortcut button opens dialog to Customize section

## Tests

**E2E Tests:**

- Click "Add Chart" → Dialog opens with empty table
- Paste CSV data (3 columns: Group, Mean, SEM) → Data populates table
- Select "Bar Chart" type → Map X-axis to "Group", Y-axis to "Mean", Error Bars to "SEM"
- Set Y-axis label to "Expression Level" → Preview shows bars with error bars
- Click "Insert Chart" → Chart appears on canvas
- Select chart → Click "Edit Chart" → Change data value → Preview updates → Click "Update" → Chart updates on canvas

**Manual Tests:**

- Paste data from Excel/Google Sheets works (comma and tab-delimited)
- Upload CSV file populates table correctly
- All 4 chart types render correctly (Bar, Line, Scatter, Box Plot)
- Multiple Y-axis columns create grouped charts with legend
- Error bars appear and scale correctly (SD and SEM types)
- Chart editing preserves all customization (colors, labels, data)
- Table editing feels responsive, preview updates quickly
- Charts resize on canvas without quality loss
- Undo/redo works with chart creation and editing
- Font sizes remain legible when chart resized

---

<div style="page-break-after: always;"></div>

## Notes

## Contract Completion

Completion of all tasks described in all milestones constitutes completion of the contract. No additional tasks beyond the scope directly specified within each milestone is required for the contract to be considered successfully completed.

## Progress report

A progress report will be provided when the milestone is submitted for approval. This report will include comprehensive test results for all tests related to the milestone scope. All milestone tests will be executed against the development database environment. The progress report will describe the work completed, summarize the results of the tests, and provide any additional context related to the development process and the work delivered.

## Post-Delivery Support

Ongoing messaging support, bug fixes, and issue resolution is provided for all unaltered code and related database infrastructure within the scope of completed milestones. This support applies exclusively to the codebase and database in their delivered state. Any modifications made after delivery, including changes to styling, configuration, or unrelated features, void this support as they cannot be validated against the delivered testing suite.
