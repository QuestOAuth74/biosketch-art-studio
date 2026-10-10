# Science Canvas Creator - Development Milestones

**Date:** 1 February 2026
**Total Price:** $5,995 USD
**Total Timeline:** 5-9 weeks

---

## Index

**Milestone 1:** [Core Improvements & Bug Fixes](#milestone-1-core-improvements--bug-fixes) - **$950** - 1-2 weeks

**Milestone 2:** [Line & Connector System Overhaul](#milestone-2-line--connector-system-overhaul) - **$1,450** - 1-2 weeks

**Milestone 3:** [Collaboration Features](#milestone-3-collaboration-features) - **$1,450** - 1-2 weeks

**Milestone 4:** [SciSketch AI Integration](#milestone-4-scisketch-ai-integration) - **$2,145** - 2-3 weeks

**Total:** **$5,995** - **5-9 weeks**

---

## Pricing Methodology

Pricing is determined by comparing each milestone to similar work completed in previous projects and evaluating relative complexity based on AI-assisted development requirements, technical complexity, integration needs, and testing requirements.

**Milestone 1: Core Improvements & Bug Fixes - $950**

- Performance optimization requiring profiling and targeted fixes
- Diagnostic debugging work with unknown root causes (SVG upload, canvas templates)
- Interactive crop tool with three modes and non-destructive editing
- Database enhancements with CSV import/export system
- _Benchmarked against:_ Previous UI optimization and canvas tool development work

**Milestone 2: Line & Connector System Overhaul - $1,450**

- Complex pathfinding algorithm (A\*, spatial indexing, dynamic rerouting)
- Smart connector system with snap-to-attach/detach and state management across all canvas objects
- Line edit mode for multiple line types with different editing interfaces
- Six endpoint types with correct orientation across all line configurations
- _Benchmarked against:_ Canvas editor features, interactive tool development, and algorithm implementation work

**Milestone 3: Collaboration Features - $1,450**

- Complete collaboration system with groups, invitations, and project sharing
- Real-time collaborative editing with Supabase Realtime (Presence + Broadcast)
- Operation-based sync with automatic conflict resolution (Figma-style)
- Live cursor tracking and presence indicators showing active users
- Canvas comment system with threading, positioning, and filtering
- Comprehensive RLS policies for database tables with role-based permissions
- _Benchmarked against:_ Database architecture, authentication systems, and real-time multiplayer implementations like Figma/Miro

**Milestone 4: SciSketch AI Integration - $2,145**

- LLM integration (OpenAI + Gemini) with structured output and cost tracking
- Three layout algorithms (hierarchical, force-directed, circular) with automatic selection
- Complex canvas integration using existing APIs with biological marker mappings
- Icon database preparation and classification (1000+ icons across 8 entity types)
- Preview/edit interface with entity and relationship management
- _Benchmarked against:_ Largest previous milestone (canvas editor with extensive features) and specialized algorithm work

**Total: $5,995** - Rate reflects the substantial scope and mix of canvas-intensive development, real-time collaboration systems, AI integration, and complex system architecture across all four milestones.

---

<div style="page-break-after: always;"></div>

# Milestone 1: Core Improvements & Bug Fixes

**Price:** $950
**Timeline:** 1-2 weeks

---

## Current State

The application has several core issues affecting usability: performance degradation with multiple icons on canvas, 4MB project save limit errors, SVG upload rendering failures, non-functional canvas size templates, inefficient icon browsing with infinite scroll, limited search functionality without tags, and a missing cropping tool that was lost during an update.

## Deliverables

### Canvas Performance Optimization

- Smooth object manipulation with 50+ icons on canvas without noticeable lag
- Elimination of "PROJECT TOO LARGE TO SAVE" error for projects up to 100+ icons
- Optimized membrane tool performance with 30+ repeated icons
- Project data compression reducing storage footprint

### SVG Upload Fix

- Newly uploaded SVG icons render correctly on canvas when clicked
- All SVG formats display with proper colors and sizing
- Comprehensive error handling for failed uploads

### Canvas Size Template Fix

- Canvas dimensions update correctly when premade style templates are selected
- Canvas size persists after template selection and project reload

### Paginated Icon Display

- 20 icons per page with Previous/Next pagination controls
- Page number indicator and total icon count display
- Preserved pagination state when switching categories

### Enhanced Search with Tagging

- Icon search across both names and tags with partial word matching
- Unified search results view from all categories
- Search result relevance sorting (exact name match > tag match > partial match)

### Admin Tag Management System

- CSV export of all icons with current tags
- CSV import for bulk tag updates with preview
- Individual icon tag editing in admin interface
- Tag auto-suggestions and usage statistics

### Three Crop Modes

All crop modes have translucent background outside of crop area

- Free-form crop with adjustable anchor points (Similar to bezier line edit mode)
- Square crop with optional 1:1 aspect ratio lock
- Circle crop with optional 1:1 aspect ratio lock

### Crop Tool Properties Panel Integration

- Crop mode buttons accessible when image selected in Properties panel
- Edit Crop and Reset to Original options for cropped images

### Non-Destructive Cropping

- Original image data preserved
- Crop editable after application
- Cropped state persists through save/load cycles

## Tasks

- Identify and fix performance bottlenecks: implement object virtualization, render throttling, optimize event handling and Fabric.js caching
- Optimize membrane tool performance for repeated icons
- Implement project data compression and chunked saving to resolve 4MB save limit
- Debug and fix SVG upload rendering pipeline: ensure uploaded SVGs render on canvas with proper colors and sizing
- Fix canvas size template selection: ensure dimensions update correctly when templates are selected and persist after reload
- Replace infinite scroll with pagination: 20 icons per page, Previous/Next controls, page indicator, preserve state when switching categories
- Add `tags` column to icons table (JSONB array, up to 3 tags per icon)
- Implement enhanced search: search across names and tags, partial word matching, unified results view, relevance sorting
- Build admin CSV export: generate downloadable CSV with all icons and tags
- Build admin CSV import: upload CSV, validate format, show preview, bulk update tags with success/error reporting
- Add admin tagging UI: individual icon tag editing, auto-suggest for existing tags, tag usage statistics
- Implement free-form crop: polygon overlay with draggable anchor points, using the same UI as the bezier line edit mode.
- Implement circle crop: circular overlay with resize/position handles, optional fixed aspect ratio
- Implement square crop with optional 1:1 aspect ratio lock, resize/position handles
- Add crop mode buttons to Properties panel (Free-Form, Circle, Square) when image selected
- Implement non-destructive cropping: preserve original image, apply as clipPath, enable re-editing, Reset to Original option

## Tests

### Unit Tests

**Search Algorithm:**

- Exact name match ranks higher than tag match
- Partial word matching works correctly (substring search)
- Search is case-insensitive
- Search handles special characters correctly
- Empty search returns no results

**Crop Calculations:**

- Polygon crop path calculation produces valid clipPath
- Circle crop maintains perfect 1:1 aspect ratio during resize
- Square crop maintains perfect 1:1 aspect ratio during resize

### End-to-end Tests

**SVG Upload:**

- Upload new SVG icon via admin interface → Icon appears in icon library
- Click newly uploaded icon in library → Icon appears on canvas at cursor position
- Drag newly uploaded icon onto canvas → Icon renders on canvas

**Pagination:**

- Open icon category with >20 icons → Only 20 icons display initially
- Click "Next" button → Page 2 loads with next 20 icons
- Click "Previous" button → Returns to page 1
- Navigate to page 3 → Page indicator shows "Page 3 of X"
- Switch to different category → Pagination resets to page 1

**Enhanced Search:**

- Search for exact icon name "mitochondria" → Icon appears in results
- Search for partial word "mito" → "mitochondria" appears in results
- Search for tag value "cellular-organelle" → All icons with that tag appear
- Search returns results from multiple categories in unified view
- Clear search → Returns to category browsing mode
- Search with no results → Shows "No icons found" message

**Admin Tagging:**

- Admin exports CSV → File downloads with all icons and current tags
- Admin adds tags to CSV rows → Imports CSV → Tags update in database
- Admin imports CSV with invalid format → Shows error message with details
- Admin views tag preview before import → Displays how many icons will be updated
- After import completes → Shows success message with count
- Edited icon tags appear in search results immediately

### Manual Tests

_Note: Performance testing will be conducted using Chrome DevTools (Performance tab for frame rate/rendering metrics, Memory Profiler for memory usage analysis)._

**Performance:**

- Add 50 icons to canvas → Drag objects → Movement is smooth without noticeable lag
- Create membrane with 30+ repeated icons → Manipulate objects → Performance remains acceptable
- Add 100 icons to canvas → Save project → Project saves successfully (no 4MB error)
- Load project with 100+ icons → Canvas loads and renders within reasonable time (<3 seconds)
- Stress test: Add 200 icons → Measure frame rate during manipulation (target: >30fps using Chrome DevTools Performance tab)
- Monitor memory usage during extended editing session with many objects (using Chrome DevTools Memory Profiler)
- Test auto-save performance with large projects (should not cause UI freezing)
- Verify compression reduces project data size without losing fidelity

**Canvas Size Templates:**

- Select "A4 Portrait" template → Canvas resizes to A4 dimensions
- Select "US Letter Landscape" template → Canvas resizes to letter landscape dimensions
- Select template → Save project → Reload → Canvas size persists

**SVG Upload:**

- Upload SVGs from provided zip file → Verify all icons render with correct colors and sizing
- Upload complex SVG (gradients, multiple paths) → Verify renders correctly on canvas
- Test various SVG formats: simple shapes, complex illustrations, icons with text
- Verify uploaded icons maintain aspect ratio and viewBox settings
- Drag uploaded icons onto canvas → Verify proper rendering and visual quality

**Canvas Templates:**

- Select template with existing objects on canvas → Verify objects remain positioned correctly relative to new canvas size

**Pagination UX:**

- Test pagination UX feels smooth and responsive
- Verify 20 icons per page is appropriate icon density (not too sparse/crowded)
- Return to previous category → Verify pagination state is preserved

**Search Quality:**

- Search result relevance feels accurate (most relevant icons appear first)

**Crop Tool UX:**

- Free-form crop anchor points are easy to grab and drag (sufficient hit area)
- Add/remove anchor points works smoothly (click edge to add, right-click to remove)
- Crop preview overlay clearly shows what will be kept vs removed
- Crop mode has clear visual indication (different cursor, highlighted boundary)
- All crop types produce clean edges (no pixelation or artifacts)
- Circle and square crops maintain proper aspect ratios during resize
- Performance remains smooth with complex free-form crops (15+ points)
- Complex multi-point crops (8+ anchor points) save and reload correctly
- Crop tool UX feels intuitive and discoverable
- Export quality: cropped images maintain transparency and quality in PNG/SVG exports

**Cropping:**

- Select image → Click "Free-Form Crop" → Crop overlay appears with draggable anchor points
- Drag anchor point → Point repositions, crop preview updates in real-time
- Click "Apply Crop" → Image cropped to custom shape
- Select cropped image → Click "Edit Crop" → Returns to crop mode with previous points
- Select cropped image → Click "Reset to Original" → Full original image restored
- Select image → Click "Circle Crop" → Circular overlay appears with resize/position handles
- Click "Apply Crop" → Image cropped to circle with transparent background
- Select image → Click "Square Crop" → Square overlay appears with 1:1 aspect ratio
- Apply any crop type → Save project → Reload → Crop preserved correctly
- Apply crop → Undo → Crop removed, Apply crop → Redo → Crop restored

---

<div style="page-break-after: always;"></div>

# Milestone 2: Line & Connector System Overhaul

**Price:** $1,450
**Timeline:** 1-2 weeks

---

## Current State

The current line and connector system is fragmented across multiple toolbar buttons and dropdowns ("Lines and Connectors", "Straight Lines", "Orthogonal Lines", "Curved Lines", "Connectors"). Lines have limited styling options, basic arrow endpoints, and the line gradient feature is not working as expected and has incorrect default settings. There is no smart connector point system for attaching lines to objects, and line edit mode is limited to curved and bezier lines.

## Deliverables

### Consolidated Line Toolbar

- Three dedicated line tool buttons in toolbar: Straight Line, Curved Line, Orthogonal Line
- Pen tool and freehand tool buttons remain unchanged.
- Removal of fragmented line dropdowns and multiple connector tools

### Smart Connector Point System

- When any line tool (including the pen tool) is active, all canvas objects (icons, images, shapes, text) display connection points at corners and side mid-points
- Clicking a connection point attaches the line to that object
- **Snap-to-attach:** Dragging a line endpoint near a connection point (within snap threshold) automatically snaps and attaches to that point
- **Snap-to-detach:** Dragging an attached line endpoint away from a connection point (beyond snap threshold) detaches it
- Moving attached objects maintains line connections automatically
- Smart connector system can be toggled on and off in the properties panel when a line tool is active or a line is selected

### Automatic Pathfinding for Orthogonal and Bezier Lines

- "Smart connectors" option in the properties panel enables orthogonal lines and bezier lines attached to objects to automatically route around obstacles on canvas
- Pathfinding algorithm calculates optimal path avoiding other objects
- Dynamic rerouting when obstacles are moved
- Manual override: users can disable auto-routing and manually position anchor points in edit mode

### Line Edit Mode

- Double-click any placed line to enter edit mode (excluding freehand lines)
- In edit mode: reposition line anchor points and adjust curves
- Connection points on other objects remain visible during edit mode
- Click outside line or press Escape to exit edit mode

### Intelligent Line Type Conversion

- Properties panel shows line type selector when line is selected (not in edit mode)
- Lines with 2 anchor points can convert to: straight, curved, orthogonal or bezier
- Lines with 3+ anchor points can convert to: orthogonal or bezier (straight/curved disabled)

### Customizable Line Endpoints

- Six endpoint options for both start and end: None, Arrow, Circle (hollow/filled), Dot, Diamond (hollow/filled), Inhibitor bar
- Visual endpoint preview in Properties panel

### Fixed Line Gradient System

- Line gradient defaults to "fade in" with "reverse" direction
- Arrows display correctly with gradient applied
- Gradient controls: fade in/out, direction toggle, opacity start/end sliders

### Advanced Line Styling

- Line weight slider and presets selector
- Dash pattern options (solid, dashed, dotted, custom)
- Corner style for orthogonal lines (sharp, rounded, beveled)

## Tasks

- Remove fragmented line tools and create three consolidated toolbar buttons: Straight, Curved, Orthogonal
- Implement connection point system: display points on objects when line tools active, snap-to-attach/detach behavior, maintain connections on object movement
- Build line edit mode: double-click to edit, anchor/curve handles, exit on click-outside or Escape
- Implement line type rendering: straight (2 anchors), curved (bezier), orthogonal (90-degree routing)
- Build pathfinding system: A\* algorithm, spatial indexing, dynamic rerouting, clearance settings, performance optimization with caching
- Add line type conversion logic: 2-anchor lines convert to any type, 3+ anchor lines convert to orthogonal/bezier only
- Create endpoint customization UI: 6 endpoint types with visual preview, correct orientation on all line types
- Fix line gradient defaults and add gradient controls (fade in/out, direction, opacity sliders)
- Implement line styling: weight slider, dash patterns, corner styles for orthogonal lines

## Tests

### Unit Tests

**Pathfinding Algorithm:**

- Calculates route that avoids obstacles using 90-degree segments
- Returns direct orthogonal route when no obstacles present
- Returns fallback direct route when no valid path exists

**Line Type Conversion:**

- Converts 2-anchor straight line to curved, orthogonal, or bezier
- Maintains object attachments when converting between types

**Endpoint Positioning:**

- Endpoints render with correct orientation on straight, curved, and orthogonal lines

### Manual Tests

**Smart Connection Points:**

- Line tool active → Objects display connection points at corners and mid-points
- Click connection point → Line attaches to object
- Move attached object → Line endpoint follows object

**Line Edit Mode:**

- Double-click line → Edit mode activates with anchor point handles
- Drag anchor point → Point repositions
- Connection points remain visible during edit mode
- Drag line endpoint near connection point → Snaps and attaches automatically
- Drag attached endpoint away from connection point → Detaches

**Line Type Conversion:**

- Select 2-point line → Properties panel shows all line type options
- Convert line between types → Line changes correctly
- Select 3+-point line → Properties panel disables straight/curved options, line changes correctly for remaining options

**Customizable Endpoints:**

- Set line start endpoint → Endpoint appears correctly
- Set line end endpoint → Endpoint appears correctly
- Save and reload project → Endpoints persist

**Line Gradient:**

- New line defaults to "fade in" with "reverse" direction
- Toggle gradient direction → Direction changes
- Adjust opacity sliders → Opacity values update

**Line Styling:**

- Adjust line weight → Weight updates
- Select dash pattern → Pattern applies
- Set corner style on orthogonal line → Style applies

**Automatic Pathfinding:**

- Create orthogonal line between objects with obstacle → Line routes around obstacle
- Move obstacle into line path → Line automatically reroutes
- Toggle auto-routing off → Line becomes manually editable
- Toggle auto-routing on → Line routes around obstacles

---

<div style="page-break-after: always;"></div>

# Milestone 3: Collaboration Features

**Price:** $1,450
**Timeline:** 1-2 weeks

---

## Current State

The application is single-user focused. No team collaboration, project sharing for editing, or communication features exist. Users work in isolation without ability to share projects for collaborative editing or provide feedback.

## Deliverables

### Group Account System

- Group creation and management interface
- Member invitation system with email notifications
- Group member roles (owner, admin, member) with appropriate permissions

### Lab Member Invitation System

- Email-based invitation flow with unique token links
- 7-day invitation expiration
- Invitation management (resend, cancel, history)

### Project Pages System

- Personal and group project pages for organizing collections
- Shareable project page URLs

### Real-time Collaborative Editing

- Project sharing with specific members or entire groups
- Permission levels (View Only, Edit Access)
- Real-time presence system showing who is currently viewing/editing
- Live cursor tracking and user avatars on canvas
- Operation-based sync (broadcast object-property changes, not full state)
- Automatic conflict resolution: last-write-wins at property level, no user intervention
- Manual project locking (admin/owner only) for maintenance or sensitive work

### Canvas Comment System

- Comment pins placed on canvas at specific locations
- Threaded comment conversations
- Resolve/unresolve functionality
- Comment filtering (All, Unresolved, Resolved)

### Email Notifications

- Notifications for invitations, collaborator additions, new comments, and comment replies

## Tasks

- Create database schema for groups, group members, group invitations, project pages, project page items, project collaborators, canvas comments, and user presence
- Build group management UI: creation form, groups list page, group detail page with member list and settings
- Implement invitation system: email invitations with unique tokens, 7-day expiration, invitation acceptance page, resend/cancel functionality
- Build project pages system: personal and group project pages, grid display with drag-and-drop reordering, add/remove projects, shareable URLs
- Implement project sharing: share dialog with member/group selection and permission levels, copy share link, collaborator list display
- Integrate Supabase Realtime Presence: track active users on canvas, display user avatars and names in header, show "Currently viewing" indicator
- Implement operation-based sync with Supabase Realtime Broadcast: broadcast canvas operations (object add/move/resize/color change) as object-property updates, not full state, with <100ms latency
- Build live cursor tracking: show other users' cursor positions and selections on canvas in real-time
- Implement optimistic updates with automatic conflict resolution: apply local changes immediately, broadcast operations with timestamps, apply last-write-wins at property level (e.g., if two users edit same object's position, latest timestamp wins)
- Build manual locking system: admin/owner can manually lock project for maintenance, lock status visible to all users, unlock capability
- Create comment system: comment toggle in toolbar, click-to-add comment pins, threaded popover with reply/resolve/edit/delete, sidebar panel with filtering
- Implement email notifications: invitations, collaborator additions, new comments, comment replies with user preference settings

## Tests

### Unit Tests

**Group & Invitation Logic:**

- Group creation creates owner role for creator
- Invitation tokens are unique and expire after 7 days
- Only group owners/admins can invite members

**Real-time Collaboration:**

- Presence tracking adds/removes users on join/leave
- Operations broadcast to all connected clients
- Last-write-wins uses timestamps correctly for same-property conflicts
- Manual lock prevents non-admin edits

**RLS Policies:**

- Users can only access groups they belong to
- Only owners/admins can modify group membership
- Project collaborators can access shared projects based on permission level
- Users can only edit/delete their own comments (except project owner can delete any)

### End-to-end Tests

**Group Management:**

- Create group → User becomes owner
- Invite member → Invitation sent and accepted → Member joins group
- Remove member → Member loses access to group projects

**Project Sharing:**

- Share project with Edit permission → Collaborator can edit
- Share project with View Only permission → Collaborator cannot edit
- Remove collaborator → Collaborator loses access

**Real-time Collaboration:**

- Two users open same project → Both see each other's avatars
- User A moves object → User B sees it move in real-time
- User A edits object color, User B edits same object position → Both changes apply
- User A and User B edit same property → Latest change wins
- User closes project → Avatar disappears from other users' view

**Cursor Tracking:**

- User moves cursor → Other users see cursor position with name label
- User selects object → Other users see selection highlight

**Manual Locking:**

- Admin locks project → All users see locked status, cannot edit
- Admin unlocks project → Users can edit again

**Comments:**

- Click canvas → Add comment → Comment appears with pin
- Reply to comment → Reply appears in thread
- Resolve comment → Comment marked resolved
- Filter comments → Shows only selected type

**Project Pages:**

- Create project page → Add projects → Projects display in grid
- Share page link → Page accessible via URL

### Manual Tests

**Real-time Performance:**

- Cursor tracking and canvas updates feel instant (<100ms)
- Multiple users editing simultaneously without lag
- Presence indicators update immediately

---

<div style="page-break-after: always;"></div>

# Milestone 4: SciSketch AI Integration

**Price:** $2,145
**Timeline:** 2-3 weeks

---

## Current State

An AI figure generator exists (admin-only) that creates flat images. SciSketch is an open-source AI-powered biological diagram generator that analyzes scientific text and generates editable, structured diagrams with biological entities and relationships. Integration would enable users to generate publication-ready scientific diagrams from text descriptions using vetted icon database.

## Deliverables

### AI Diagram Generation from Text

- Paste scientific abstract or text description into dialog
- AI extracts biological entities (8 types: proteins, molecules, cells, enzymes, organs, pathways, processes, structures)
- AI detects relationships between entities (6 types: activation, inhibition, conversion, transport, binding, generic arrows)
- Multi-step progress indicators during generation

### Smart Icon Matching System

- 3-tier icon matching: exact match → category match → generic fallback
- 1,000+ biological icons classified and tagged for accurate matching
- Icon thumbnails shown in preview with tier indicators
- Admin tools for bulk icon classification via CSV import/export

### Automatic Layout Generation

- Three layout algorithms: hierarchical (pathways), force-directed (networks), circular (feedback loops)
- Algorithm automatically selected based on diagram structure
- Generates positioned, non-overlapping diagrams ready for canvas

### Preview & Edit Interface

- Review extracted entities and relationships before finalizing
- Edit entity names and types
- Add/remove entities or relationships
- Choose alternative icons from matching options
- Modify relationship types (e.g., change activation to inhibition)

### Canvas Integration

- Generated diagrams appear as fully editable canvas objects
- Icons, connectors, and labels can be moved, resized, and styled
- Connectors attach to icons dynamically (move icon, connector follows)
- Biological relationship markers (activation arrows, inhibition bars, etc.)
- Generated diagrams save and export like any other canvas project

### Dual LLM Support

- OpenAI GPT-4 and Google Gemini API support
- Structured JSON output for reliable parsing
- Automatic retry on timeouts and errors
- Graceful fallbacks for API failures

### Cost Management

- Pre-generation cost estimates shown to user
- Token usage tracking per diagram
- Monthly usage dashboard for admins
- Rate limiting (3 concurrent generations per user)
- Optional user quotas configurable by admin

## Tasks

- Study Manus AI reference implementation for SciSketch integration approach: review LLM prompt templates, entity/relationship extraction logic, icon matching strategies, and layout algorithms; adapt patterns to BioSketch codebase
- Enhance `icons` table with SciSketch fields: `entity_type`, `keywords`, `tier`, `scisketch_compatible`; create `ai_diagrams` table for storing generated diagrams
- Build SciSketch service with four core functions: entity extraction (8 entity types), relationship detection (6 relationship types), icon matching (3-tier system), layout generation (3 algorithms with automatic selection)
- Create `/api/diagram/generate` endpoint: validate input, execute SciSketch functions, save to database, create canvas project
- Build AI diagram generator dialog: text input area, "Generate" button with multi-step progress indicators, error handling
- Build preview/edit interface: display entities with matched icons and tier indicators, show relationships, enable editing names/types/icons and adding/removing entities/relationships
- Implement canvas integration: use addIconToCanvas event for icon placement, createConnector() with dynamic connections, map relationship types to biological markers, add labels, ensure all elements fully editable
- Populate icon database: classify 1,000+ biological icons with all 8 entity types and keywords, ensure coverage across all types
- Create admin bulk classification tools: CSV export/import for entity type assignment, preview tool for verification
- Configure LLM integration: support OpenAI GPT-4 and Google Gemini, environment variable API keys, structured output enforcement
- Implement cost management: pre-generation cost estimates, token tracking per diagram, monthly usage dashboard, rate limiting (3 concurrent per user), optional user quotas

## Tests

### Unit Tests

**AI Generation Functions:**

- Entity extraction returns valid JSON with all 8 entity types
- Relationship detection identifies all 6 relationship types correctly
- Icon matching uses 3-tier system: exact → category → generic
- Layout algorithm calculates non-overlapping x,y coordinates
- Relationship type mapping returns correct biological marker strings

**Database Permissions:**

- Users can only access their own generated diagrams
- All users can read icon database
- Only admins can modify icons

### End-to-end Tests

**Diagram Generation:**

- Paste scientific text → Click Generate → Preview shows entities and relationships
- Click Generate Layout → Canvas shows positioned diagram with icons and connectors
- Generated diagram elements are editable and persist on save/reload

**Canvas Integration:**

- Generated icons appear on canvas at correct positions
- Move icon → Connector updates dynamically
- Generated elements can be moved, resized, and deleted

**Preview & Edit:**

- Edit entity name → Name updates
- Change entity type → Icon re-matches
- Add/remove entities or relationships → Preview updates
- Change relationship type → Updates in preview

**Icon Matching:**

- All entities have valid icons (no missing icons)

**Error Handling:**

- Empty text → Shows validation error
- Non-biological text → Shows "No entities found"
- API failure → Shows retry option
- Concurrent limit exceeded → Shows queue position

### Manual Tests

**AI Quality Verification:**

- Entity extraction accuracy (test with various scientific abstracts)
- Relationship detection accuracy
- Icon matching quality: well-known entities get appropriate tier 1 icons, generic entities use suitable tier 2/3 fallbacks
- All 6 relationship types render with correct biological markers (visual verification: activation arrows, inhibition bars, etc.)
- Layout produces readable, logical diagrams with appropriate spacing

---

<div style="page-break-after: always;"></div>

# Notes

## Development Database

An independently owned and managed development database will be provided for development and testing. Migrations, edge functions, and configuration will be deployed to the client's production database when each milestone is submitted. A seed script will be used to populate the development database with placeholder data for testing.

## GitHub Repository

The project repository will be cloned into an independently owned and managed private GitHub repository for development isolation. Changes will be pushed to the production repository when each milestone is submitted for review.

## Preview deployment

A preview deployment connected to the development database will be provided with the first milestone submission. This preview will be updated throughout the development process via continuous deployment of the development GitHub repository.

## Production deployment and database

Production deployment and database hosting can be directly managed by the developer via Vercel or Supabase (an invitation as a team member is required). Alternatively, detailed documentation can be provided, along with ongoing guidance and support via Upwork chat messaging.

## API Credentials and Integrations

Independently owned and managed API keys will be provided for development and testing (example: Resend, OpenRouter, Stripe, Twilio, SendGrid, OpenAI). Production accounts and API keys for external integrations will be provided by the client. Detailed documentation and ongoing guidance and support via Upwork messaging can be provided to assist in implementing and managing the accounts and configurations of any external integrations. Direct account management for these external services is not provided by the developer.

## Delivery Report

A delivery report will be provided when each milestone is submitted for approval. This report will include comprehensive test results for all tests related to the milestone scope. All milestone tests will be executed against the development database environment. The delivery report will describe the work completed and provide any additional context related to the development process and the work delivered.

## Post-Delivery Support

Ongoing messaging support, bug fixes, and issue resolution is provided for all unaltered code and related database infrastructure within the scope of completed milestones. This support applies exclusively to the codebase and database in their delivered state. Any modifications made after delivery, including changes to styling, configuration, or unrelated features, void this support as they cannot be validated against the delivered testing suite.

## Milestone Scope

Each milestone is complete when all items in the **Tasks** and **Deliverables** sections are implemented and all tests in the **Tests** section pass.
If functionality wasn't explicitly included in the deliverables or validated by a Test, then it is outside of the milestone scope.

## Contract Completion

Completion of all tasks described in all milestones constitutes completion of the contract. No additional tasks beyond the scope directly specified within each milestone are required for the contract to be considered successfully completed.
Additional milestones can be added if further work is required, provided that both parties agree to the expansion of the contract scope.

## Testing Philosophy

Testing is designed to verify that specified test cases pass and does not guarantee that the application is free of all defects or will meet all user expectations. Test coverage will be as comprehensive as reasonably achievable within the defined scope. Edge cases and scenarios not explicitly described in the deliverables may not be covered unless they emerge during testing.
