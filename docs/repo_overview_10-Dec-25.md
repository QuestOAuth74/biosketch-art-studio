# BioSketch - Repository Overview

**Date:** 10 December 2025
**App Name:** BioSketch - Professional Scientific Illustration Software

---

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **Styling:** Tailwind CSS (notebook-themed aesthetic)
- **UI Components:** Radix UI, shadcn/ui
- **Canvas:** Fabric.js
- **Backend:** Supabase (auth, database, storage)
- **State:** React Context, TanStack React Query
- **Rich Text:** TipTap editor

---

## Pages & Routes

### Public Pages
| Route | Description |
|-------|-------------|
| `/` | Landing page with hero, testimonials, featured projects, blog carousel |
| `/auth` | Sign in/up, password reset, account recovery |
| `/terms` | Terms of Service |
| `/testimonials` | User testimonials showcase |
| `/release-notes` | Feature changelog |
| `/contact` | Contact form |
| `/share` | Project sharing page |

### Protected Pages (Requires Auth)
| Route | Description |
|-------|-------------|
| `/canvas` | Main illustration editor |
| `/projects` | User's saved projects gallery |
| `/profile` | User profile, stats, settings |
| `/community` | Public projects gallery with search/filter |
| `/author/:userId` | Author profile showcase |
| `/blog` | Blog listing with categories and search |
| `/blog/:slug` | Individual blog post reader |
| `/my-submissions` | User's icon submission tracker |

### Admin Pages
| Route | Description |
|-------|-------------|
| `/admin` | Admin dashboard |
| `/admin/analytics` | User analytics and exports |
| `/admin/email-notifications` | Email campaign management |
| `/admin/powerpoint-generator` | PowerPoint template builder |
| `/admin/ai-settings` | AI provider configuration |
| `/admin/rate-limits` | Rate limiting controls |
| `/admin/blog` | Blog post management |
| `/admin/blog/categories` | Category management |
| `/admin/blog/tags` | Tag management |

---

## Core Functionality

### Canvas Editor
- Vector-based drawing with shapes, text, images
- Scientific connectors with biological markers (inhibition, activation, phosphorylation)
- Orthogonal and curved line tools
- Grid system with snap-to-grid (lines, dots, isometric patterns)
- Layer management with visibility/lock controls
- Journal-specific paper sizes (Nature, Science, Cell, PNAS, eLife, etc.)
- Undo/redo with version history
- Multi-object selection, grouping, alignment guides

### Asset Library
- Extensive biomedical SVG icon library organized by category
- User-uploaded assets management
- Icon search and favorites
- Community icon submission system

### Export Options
- PNG (150, 300, 600 DPI) for publication quality
- JPEG with quality settings
- SVG for vector editing
- Transparent background option
- Selection-only export

### AI Features
- AI figure generation from text prompts
- AI icon generation
- Style transfer effects
- Usage quota tracking

### Project Management
- Auto-save with status indicators
- Public/private project visibility
- Project sharing and cloning
- Thumbnail generation
- Metadata (title, description, keywords, citations)
- View/like tracking

### Community
- Public project gallery with filtering
- Trending projects
- Project cloning with attribution
- User profiles with stats
- Verified creator badges
- Admin approval workflow

### Blog System
- Rich text editor with TipTap
- Categories and tags
- SEO metadata and OG images
- View counting and reading time
- Related posts suggestions

---

## Key UI Components

### Canvas Components
- **FabricCanvas** - Main drawing surface
- **TopToolbar** - File operations, shortcuts
- **ContextualToolbar** - Context-sensitive tools
- **Toolbar** - Left-side drawing tools
- **PropertiesPanel** - Object properties editor
- **LayersPanel** - Layer management
- **IconLibrary** - SVG icon browser
- **ExportDialog** - Multi-format export settings
- **VersionHistory** - Project version rollback
- **CommandPalette** - Quick action search

### Community Components
- **ProjectCard** - Project preview with thumbnail
- **ProjectPreviewModal** - Full project preview
- **CommunityCarousel** - Featured projects
- **IconSubmissionDialog** - Custom icon submission

### Admin Components
- **IconManager** - Icon CRUD operations
- **IconUploader** - Bulk icon import
- **SubmittedProjects** - Project approval interface
- **TestimonialManager** - Testimonial CRUD
- **PowerPointTemplateBuilder** - Template design tool
- **AnalyticsDashboard** - User statistics

---

## User Roles

| Role | Access |
|------|--------|
| Anonymous | Public pages, view community projects |
| Authenticated | Canvas editor, projects, community features |
| Admin | Full admin panel, content management, analytics |

---

## Data Models (Summary)

- **Profiles** - User info, avatar, bio, country, field of study
- **Canvas Projects** - Project data, thumbnails, visibility, approval status
- **Project Versions** - Version history for rollback
- **Icon Items** - SVG icons with categories and thumbnails
- **Icon Submissions** - Community-submitted icons pending approval
- **Blog Posts** - Rich content with SEO, categories, tags
- **User Assets** - Uploaded files and images
- **Contact Messages** - Form submissions
- **Tool Feedback** - User ratings and feedback

---

## Design Philosophy

BioSketch uses a **notebook-themed aesthetic** with pencil-drawn styling, inspired by scientific research workflows. The interface prioritizes:

- Professional publication-quality output
- Intuitive tools familiar to researchers
- Extensive scientific icon library
- Collaboration and community sharing
- AI-assisted content creation
