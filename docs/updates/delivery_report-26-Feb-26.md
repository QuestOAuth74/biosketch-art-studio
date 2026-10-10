# Milestone: Asset-by-Reference System — Delivery Report

**Date:** 26 February 2026

**Preview URL:** https://science-canvas-creator.vercel.app

---

### 1. Reference-Based Image Storage

**Project save data stores a lightweight reference instead of the full image**

- Images added via the Image tool or Assets tab save only a reference ID and position/size data
- A single image reference is under 1 KB compared to ~650 KB for the previously embedded image data
- On project load, images are fetched from storage and placed back on the canvas automatically
- Copy/paste and undo/redo preserve image references and all properties

---

### 2. Image Upload Experience

**A loading toast indicates upload progress**

- Selecting an image shows a persistent loading notification while the upload completes

---

### 3. Image Feature Compatibility

**All existing image features work with the optimized storage**

- Crops, filters, color maps, masking, opacity, and blending modes are preserved through save and reload
- Cropped images with color maps render correctly on the local canvas, collaborator canvases, and after reload
- Original image data is available from storage for non-destructive editing (edit crop, remove color map, etc.)

---

### 4. Thumbnail Generation

**Project thumbnails render referenced images correctly**

- Thumbnails fetch images from storage and apply all saved effects (color maps, crops) before rendering
- Thumbnail previews on the Projects page accurately reflect the canvas content

---

### 5. Collaboration Compatibility

**Referenced images are accessible to all project collaborators**

- When a project is saved, the database records which images are used in which projects
- Anyone with access to a project — direct collaborators, group members, page members, and public viewers — can view and download the images used in that project
- Both users in a collaboration session can add images, and both can see each other's images
- Shared and public projects also reconstruct images correctly from references

---

### 6. Storage Quota Management

**500 MB storage limit per user with usage indicator**

- The Assets tab displays a usage bar showing space used vs. total available, with green/yellow/red color coding
- Uploads are blocked with a clear error message when the quota is exceeded
- The indicator updates in real time after uploads and deletions

---

### 7. Asset Deletion Warning

**Deleting an asset warns about impact on other projects**

- Deleting from the Assets tab shows: "This will remove the image from all projects using it. This action cannot be undone."
- Deleting an image from the canvas does not remove it from the Assets library

---

### 8. Missing Asset Handling

**Projects still load even if an image has been deleted from storage**

- A placeholder is shown where the missing image was, with a warning message
- The rest of the project loads normally

---

## Tests

### Unit Tests (257 passing)

**Asset-by-reference serialization (23 tests)**

- Image data stripped on save; serialized size < 1 KB per asset
- All image properties preserved: crops, filters, color maps, masking, transforms
- Load reconstructs images from storage for both raster and SVG formats
- Copy/paste preserves references; missing assets produce placeholder data

**Storage quota enforcement (4 tests)**

- Quota check passes under limit, fails at/over limit
- Usage updates after upload and delete

**History optimization (4 tests)**

- Undo/redo stores references instead of full image data

---

### End-to-end Tests (15 tests)

**Image tool upload**

- Select image → Loading toast → Upload completes → Image on canvas
- Works for JPG, PNG, and SVG; uploaded image appears in Assets tab

**Assets tab integration**

- Click asset → Added to canvas with reference
- Image tool and Assets tab produce identical referenced objects

**Save/load round-trip**

- Save project with 10 images → Save data < 1 MB → Reload → All images render correctly
- JPG, PNG (transparency), and SVG formats preserved
- Crops, filters, color maps, and masking preserved

**Missing asset handling**

- Deleted asset → Placeholder shown with warning

**Asset deletion**

- Delete from canvas → Remains in Assets tab
- Delete from Assets tab → Confirmation warning shown

**Storage quota**

- Usage indicator visible and updates on upload/delete
- Upload blocked when quota exceeded

---

### Manual Tests

1. **Thumbnail generation** — Thumbnails render all referenced images and effects correctly
2. **Collaboration** — Share a project containing images → Collaborator sees all images; both users can add images
3. **Color map + crop** — Apply crop then color map → Visible on local canvas, collaborator canvas, and after reload

---

## Summary

- **Reference-based storage** — Images save as lightweight references (approx 1 KB) instead of embedded data (approx 650 KB); reconstructed from storage on load

- **Upload experience** — Persistent loading toast during image upload

- **Full feature compatibility** — Crops, color maps, filters, and masking all preserved through save/load

- **Collaboration support** — Collaborators can view and add images in shared projects; access enforced at the database level

- **257 unit tests, 15 end-to-end tests passing**
