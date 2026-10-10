# Milestones for Web Dev

## 1. Refactor codebase

## 2. Fix RLS issues with Supabase and fix security vulnerabilities

## 3. PDF Export with Vector Graphics

**Current State:** Only PNG/JPG export (raster images)

**What to Build:**
- CMYK color mode option for print publications
- Embedded fonts or outlined text options
- Journal-specific paper size presets — add a custom size, where user can enter exact canvas size in inches, cms or px

---

## 4. Poorly implemented tools

**What to Build:** I will recommend trying out the live canvas to see some of these errors.

- The eraser tool does not stick to erased icon objects on the canvas or line or shapes. When a partially erased object is moved, the erased mask disappears.
- When an object on the canvas is selected, and user drags to rotate, I want the blue dot to be a grabbing hand symbol or rotation icon.
- Curved lines when drawn have a green dot with guidelines which are supposed to assist with the orientation of the curve. Unfortunately, this green dot tends to be persistent on exported canvas. Also, it becomes disjointed from the drawn curved lines making it a poor user experience.
- For shapes added to the canvas, opacity does not get saved and reverts to baseline opacity when user clicks the shape again.

---

## 5. Smart Distribution & Spacing Tools

**Current State:** Basic alignment guides exist

**What to Build:**
- Distribute evenly - horizontal/vertical with equal spacing
- Match size - make selected objects same width/height
- Real-time dimension labels showing distances between objects
- Smart spacing - auto-suggest equal gaps based on nearby objects
- Spacing input field (e.g., "space 20px apart")
- Visual spacing guides showing gap measurements

---

## 6. Numbered Annotations & Leader Lines

**Current State:** Basic text boxes only

**What to Build:**
- Numbered callout system - circles with auto-incrementing numbers (①②③)
- Leader lines - lines with text labels that point to specific areas
- Annotation presets - arrows with text, brackets with labels
- Legend builder - auto-generate figure legends from annotations

---

## 7. Image Masking & Clipping

**Current State:** Basic image cropping exists

**What to Build:**
- Shape masking - clip images to circles, rounded rects, custom shapes
- Non-destructive masking - original image preserved
- Color adjustment layers - brightness, contrast, saturation
- Image filters - grayscale, sepia, scientific color maps (e.g., false color for microscopy)

---

## 8. Advanced Polyline & Path Editing

**Current State:** Bezier curves with control handles exist but poorly implemented

**What to Build:**
- Add/remove anchor points on existing lines
- Convert point types - smooth ↔ corner anchors
- Line jumps - automatic arc when lines cross (common in circuit/pathway diagrams)
- Path simplify - reduce anchor points while maintaining shape
- Freehand to smooth path conversion (current implementation is poorly implemented and freely drawn lines do not smoothen as expected)

---

## 9. Icons

- Optimize SVG loading to reduce canvas load time for icons.
- Some icons are appearing completely black on the live canvas and icon library (on the left panel). This is also poor for user experience.
