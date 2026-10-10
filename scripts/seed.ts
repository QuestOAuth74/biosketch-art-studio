import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables with fallback
// Load .env first (base configuration), then .env.local (overrides)
// This allows .env.local to override specific keys while falling back to .env for others
const envLocalPath = resolve(__dirname, "../.env.local");
const envPath = resolve(__dirname, "../.env");

let envLoaded = false;

if (existsSync(envPath)) {
  console.log("Loading base environment from .env");
  dotenv.config({ path: envPath });
  envLoaded = true;
}

if (existsSync(envLocalPath)) {
  console.log("Loading environment overrides from .env.local");
  dotenv.config({ path: envLocalPath, override: true });
  envLoaded = true;
}

if (!envLoaded) {
  console.warn("⚠ No .env.local or .env file found");
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing required environment variables:");
  console.error("- VITE_SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
  console.error("- SUPABASE_SERVICE_ROLE_KEY:", serviceRoleKey ? "✓" : "✗");
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'apikey': serviceRoleKey,
    },
  },
});

// Icon categories seed data
const iconCategories = [
  { id: "bioicons-chemistry", name: "Bioicons - Chemistry" },
  { id: "bioicons-biology", name: "Bioicons - Biology" },
  { id: "bioicons-physics", name: "Bioicons - Physics" },
  { id: "bioicons-medical", name: "Bioicons - Medical" },
  { id: "cells", name: "Cells & Organelles" },
  { id: "molecules", name: "Molecules & Proteins" },
  { id: "lab", name: "Lab Equipment" },
  { id: "anatomy", name: "Anatomy" },
  { id: "plants", name: "Plants" },
  { id: "animals", name: "Animals" },
  { id: "symbols", name: "Symbols & Arrows" },
  { id: "other", name: "Other" },
];

// Sample testimonials seed data
const testimonials = [
  {
    name: "Dr. Sarah Chen",
    country: "United States",
    scientific_discipline: "Molecular Biology",
    message:
      "BioSketch has transformed how I create figures for my papers. The interface is intuitive and the icon library is comprehensive. Highly recommend!",
    rating: 5,
    is_approved: true,
  },
  {
    name: "Miguel Rodriguez",
    country: "Spain",
    scientific_discipline: "Neuroscience",
    message:
      "Finally, a free tool that actually works well! I have been using it for all my presentations and the results look professional.",
    rating: 5,
    is_approved: true,
  },
  {
    name: "Dr. Priya Patel",
    country: "India",
    scientific_discipline: "Biochemistry",
    message:
      "As a graduate student on a tight budget, BioSketch is a lifesaver. The quality is amazing for a free tool.",
    rating: 5,
    is_approved: true,
  },
  {
    name: "James Wilson",
    country: "United Kingdom",
    scientific_discipline: "Immunology",
    message:
      "Great tool for creating publication-quality figures. Saves me hours compared to other software.",
    rating: 4,
    is_approved: true,
  },
  {
    name: "Dr. Li Wei",
    country: "China",
    scientific_discipline: "Cell Biology",
    message:
      "The drag and drop feature makes it so easy to design complex diagrams. Thank you for making this free!",
    rating: 5,
    is_approved: true,
  },
  {
    name: "Emma Thompson",
    country: "Canada",
    scientific_discipline: "Genetics",
    message:
      "Simple, effective, and free. Everything a researcher needs for creating scientific illustrations.",
    rating: 5,
    is_approved: true,
  },
  {
    name: "Dr. Ahmed Hassan",
    country: "Egypt",
    scientific_discipline: "Microbiology",
    message:
      "I use BioSketch for all my teaching materials. My students love the clear, professional diagrams.",
    rating: 4,
    is_approved: true,
  },
  {
    name: "Sofia Martinez",
    country: "Argentina",
    scientific_discipline: "Bioinformatics",
    message:
      "The best free alternative for scientific illustration. Clean interface and great icon selection.",
    rating: 5,
    is_approved: true,
  },
  {
    name: "Dr. Thomas Müller",
    country: "Germany",
    scientific_discipline: "Pharmacology",
    message:
      "Excellent tool for creating figures quickly. The export quality is perfect for journals.",
    rating: 5,
    is_approved: true,
  },
];

// Admin user email and password
const ADMIN_EMAIL = process.env.CONTACT_ADMIN_EMAIL || "dev@gazzola.dev";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Password123!";

// Blog categories seed data
const blogCategories = [
  {
    name: "Tutorials",
    slug: "tutorials",
    description: "Step-by-step guides for creating scientific figures",
    color: "#3b82f6",
    icon: "BookOpen",
    order_index: 1,
  },
  {
    name: "Research Tips",
    slug: "research-tips",
    description: "Best practices for scientific visualization",
    color: "#8b5cf6",
    icon: "Lightbulb",
    order_index: 2,
  },
  {
    name: "Updates",
    slug: "updates",
    description: "Latest features and improvements to BioSketch",
    color: "#10b981",
    icon: "Sparkles",
    order_index: 3,
  },
  {
    name: "Scientific Publishing",
    slug: "scientific-publishing",
    description: "Tips for preparing figures for publication",
    color: "#f59e0b",
    icon: "FileText",
    order_index: 4,
  },
  {
    name: "Community Showcase",
    slug: "community-showcase",
    description: "Featured figures created by our community",
    color: "#ec4899",
    icon: "Users",
    order_index: 5,
  },
];

// Blog tags seed data
const blogTags = [
  { name: "Figure Design", slug: "figure-design" },
  { name: "Molecular Biology", slug: "molecular-biology" },
  { name: "Cell Biology", slug: "cell-biology" },
  { name: "Workflow Tips", slug: "workflow-tips" },
  { name: "Export Quality", slug: "export-quality" },
  { name: "Beginner", slug: "beginner" },
  { name: "Advanced", slug: "advanced" },
  { name: "Icons", slug: "icons" },
  { name: "Collaboration", slug: "collaboration" },
  { name: "Templates", slug: "templates" },
];

// Sample blog posts with TipTap JSON content
const getSampleBlogPosts = (adminUserId: string) => [
  {
    title: "Getting Started with BioSketch: Create Your First Scientific Figure",
    slug: "getting-started-with-biosketch",
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Welcome to BioSketch!" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Creating professional scientific figures has never been easier. In this tutorial, we'll walk you through the basics of using BioSketch to create publication-ready diagrams.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Step 1: Choose Your Canvas Size" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Start by selecting the appropriate canvas size for your figure. BioSketch offers preset sizes for common journal requirements, or you can create a custom size.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Step 2: Add Icons and Shapes" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Browse our extensive icon library to find the perfect scientific symbols for your diagram. Simply drag and drop icons onto your canvas and customize their appearance.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Step 3: Export Your Figure" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "When you're done, export your figure in multiple formats including PNG, JPEG, and SVG. Choose the appropriate DPI for your publication needs.",
            },
          ],
        },
      ],
    },
    excerpt:
      "Learn how to create your first professional scientific figure with BioSketch in just a few simple steps.",
    author_id: adminUserId,
    status: "published",
    published_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    reading_time: 5,
    seo_title: "Getting Started with BioSketch - Create Scientific Figures",
    seo_description:
      "Step-by-step guide to creating your first scientific figure with BioSketch. Learn the basics of canvas setup, icon placement, and exporting.",
    seo_keywords: ["scientific figures", "biosketch tutorial", "getting started", "figure creation"],
  },
  {
    title: "Best Practices for Creating Publication-Ready Figures",
    slug: "publication-ready-figures-best-practices",
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Publishing in scientific journals requires figures that meet specific quality standards. Here are the essential best practices to ensure your figures are accepted on the first submission.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Resolution and DPI Requirements" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Most journals require figures at 300 DPI minimum for print publication. Use BioSketch's export settings to ensure your figures meet these requirements. For online-only journals, 150 DPI is often sufficient.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Color vs. Grayscale" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Consider how your figures will look in grayscale if the journal prints in black and white. Use patterns or line styles in addition to colors to ensure clarity.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Font Sizes and Readability" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Labels should remain readable when figures are reduced to single-column width. Aim for a minimum font size of 8-10 points after reduction.",
            },
          ],
        },
      ],
    },
    excerpt:
      "Essential tips for creating scientific figures that meet journal publication standards on the first submission.",
    author_id: adminUserId,
    status: "published",
    published_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
    reading_time: 7,
    seo_title: "Publication-Ready Scientific Figures - Best Practices Guide",
    seo_description:
      "Learn the best practices for creating scientific figures that meet journal requirements. DPI, color, fonts, and formatting tips.",
    seo_keywords: ["publication figures", "journal requirements", "scientific publishing", "figure quality"],
  },
  {
    title: "New Feature: Advanced Path Editing and Bezier Curves",
    slug: "advanced-path-editing-bezier-curves",
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "We're excited to announce powerful new path editing capabilities in BioSketch! You can now create and edit complex curves with precision.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "What's New" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Add and remove anchor points on existing paths" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Convert between smooth and corner anchor points" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Path simplification to reduce complexity" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Improved freehand smoothing algorithms" }],
                },
              ],
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "How to Use Path Editing" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Select any path or line on your canvas, then click on the path to add new anchor points. Right-click on existing anchor points to convert between smooth and corner types, or delete them entirely.",
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "These new features give you the precision needed to create complex molecular pathways and biological process diagrams.",
            },
          ],
        },
      ],
    },
    excerpt:
      "Discover the new advanced path editing features including anchor point manipulation, curve smoothing, and path simplification.",
    author_id: adminUserId,
    status: "published",
    published_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    reading_time: 4,
    seo_title: "New Feature: Advanced Path Editing in BioSketch",
    seo_description:
      "Learn about the new path editing features in BioSketch including bezier curves, anchor points, and path simplification.",
    seo_keywords: ["path editing", "bezier curves", "anchor points", "new features", "updates"],
  },
];

// Site settings seed data
const siteSettings = [
  {
    setting_key: "rate_limits",
    setting_value: {
      ai_icon_generation_monthly_limit: 2,
      ai_icon_generation_admin_unlimited: true,
      download_quota_default: 10,
      download_quota_premium_threshold: 3, // 3 approved public projects
    },
  },
  {
    setting_key: "feature_flags",
    setting_value: {
      enable_blog: true,
      enable_community_showcase: true,
      enable_ai_icon_generation: true,
      enable_powerpoint_export: true,
      enable_pdf_export: false, // Coming soon
      enable_collaboration: true,
      enable_version_history: true,
    },
  },
  {
    setting_key: "email_settings",
    setting_value: {
      from_name: "BioSketch",
      from_email: "noreply@biosketch.io",
      support_email: "support@biosketch.io",
    },
  },
];

// Sample icons seed data - scientifically relevant SVGs for testing
const sampleIcons = [
  // Chemistry icons
  {
    name: "Beaker",
    category: "bioicons-chemistry",
    svg_content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v6m8-6v6"/><path d="M8 8h8v8a4 4 0 0 1-4 4 4 4 0 0 1-4-4V8z"/><path d="M6 8h12"/></svg>`,
  },
  {
    name: "Molecule Structure",
    category: "bioicons-chemistry",
    svg_content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="7.5" y1="7.5" x2="10.5" y2="16.5"/><line x1="16.5" y1="7.5" x2="13.5" y2="16.5"/></svg>`,
  },

  // Biology icons
  {
    name: "DNA Double Helix",
    category: "bioicons-biology",
    svg_content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3c2 0 4 2 6 5s4 5 6 5M6 21c2 0 4-2 6-5s4-5 6-5"/><path d="M6 3v18M18 3v18"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="17" x2="16" y2="17"/></svg>`,
  },
  {
    name: "Microscope",
    category: "bioicons-biology",
    svg_content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18h8M3 22h18"/><path d="M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 14h2"/><path d="M9 12a3 3 0 0 1-3-3V5l3-3 3 3v4a3 3 0 0 1-3 3z"/></svg>`,
  },

  // Physics icons
  {
    name: "Atom",
    category: "bioicons-physics",
    svg_content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5z"/><path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5z"/></svg>`,
  },
  {
    name: "Wave Pattern",
    category: "bioicons-physics",
    svg_content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12c1.5-3 4-5 6.5-5s5 2 6.5 5 4 5 6.5 5"/></svg>`,
  },

  // Medical icons
  {
    name: "Heart Medical",
    category: "bioicons-medical",
    svg_content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"/></svg>`,
  },
  {
    name: "Medical Cross",
    category: "bioicons-medical",
    svg_content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2h2v8h8v2h-8v8h-2v-8H3v-2h8V2z"/></svg>`,
  },

  // Cells & Organelles
  {
    name: "Cell Membrane",
    category: "cells",
    svg_content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6" opacity="0.5"/><circle cx="12" cy="12" r="2"/></svg>`,
  },
  {
    name: "Mitochondria",
    category: "cells",
    svg_content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="12" rx="10" ry="6"/><path d="M5 12c1-1.5 2-2 3-2s2 .5 3 2 2 2 3 2 2-.5 3-2"/><path d="M5 12c1 1.5 2 2 3 2s2-.5 3-2 2-2 3-2 2 .5 3 2"/></svg>`,
  },

  // Molecules & Proteins
  {
    name: "Protein Structure",
    category: "molecules",
    svg_content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12c0-3 2-5 4-6s4-1 6 0 4 3 6 6-2 5-4 6-4 1-6 0-4-3-6-6z"/><circle cx="7" cy="9" r="1.5"/><circle cx="12" cy="8" r="1.5"/><circle cx="17" cy="11" r="1.5"/><circle cx="14" cy="15" r="1.5"/></svg>`,
  },
  {
    name: "Glucose Molecule",
    category: "molecules",
    svg_content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L4 7v10l8 5 8-5V7l-8-5z"/><circle cx="12" cy="8" r="1"/><circle cx="8" cy="11" r="1"/><circle cx="16" cy="11" r="1"/><circle cx="12" cy="16" r="1"/></svg>`,
  },

  // Lab Equipment
  {
    name: "Test Tube",
    category: "lab",
    svg_content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2v8.5M15 2v8.5"/><path d="M9 10.5v5a3.5 3.5 0 0 0 7 0v-5"/><rect x="7" y="2" width="10" height="2"/><path d="M9 14h6"/></svg>`,
  },
  {
    name: "Petri Dish",
    category: "lab",
    svg_content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="8" opacity="0.3"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="11" r="1"/><circle cx="11" cy="14" r="1"/></svg>`,
  },

  // Anatomy
  {
    name: "Brain",
    category: "anatomy",
    svg_content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/></svg>`,
  },
  {
    name: "Lungs",
    category: "anatomy",
    svg_content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v4M12 8a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3 3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3z"/><path d="M9 11C7.5 11 6 12 6 14v3c0 2 1.5 3 3 3"/><path d="M15 11c1.5 0 3 1 3 3v3c0 2-1.5 3-3 3"/></svg>`,
  },

  // Plants
  {
    name: "Leaf",
    category: "plants",
    svg_content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`,
  },
  {
    name: "Flower",
    category: "plants",
    svg_content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2a3 3 0 0 0 3 3 3 3 0 0 0-3 3 3 3 0 0 0-3-3 3 3 0 0 0 3-3z"/><path d="M19 9a3 3 0 0 0 0 6 3 3 0 0 0 0-6zM5 9a3 3 0 0 0 0 6 3 3 0 0 0 0-6z"/><path d="M15 19a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3z"/></svg>`,
  },

  // Animals
  {
    name: "Mouse",
    category: "animals",
    svg_content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6c3.5 0 6 2.5 6 6v4a4 4 0 0 1-8 0v-4c0-3.5 2.5-6 6-6z"/><circle cx="10" cy="12" r="1"/><path d="M7 10c-1-1-2-2-2-3a2 2 0 0 1 4 0c0 1-1 2-2 3"/><path d="M17 10c1-1 2-2 2-3a2 2 0 0 0-4 0c0 1 1 2 2 3"/></svg>`,
  },
  {
    name: "Fish",
    category: "animals",
    svg_content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6z"/><path d="M18 12v.5M16.5 13.5l-1-1M2 12h1M5.2 8.8l2 2M7 21l2-5"/><circle cx="15" cy="12" r="1"/></svg>`,
  },

  // Symbols & Arrows
  {
    name: "Arrow Right",
    category: "symbols",
    svg_content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  },
  {
    name: "Plus Symbol",
    category: "symbols",
    svg_content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  },
  {
    name: "Reaction Arrow",
    category: "symbols",
    svg_content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="12" x2="22" y2="12"/><polyline points="15 5 22 12 15 19"/><line x1="22" y1="16" x2="2" y2="16"/></svg>`,
  },

  // Other
  {
    name: "Pipette",
    category: "other",
    svg_content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4l-4 4M12 8l-8 8v4h4l8-8"/><path d="M15 3l6 6"/></svg>`,
  },
  {
    name: "Graph Chart",
    category: "other",
    svg_content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="3" x2="3" y2="21"/><line x1="3" y1="21" x2="21" y2="21"/><polyline points="7 14 12 9 16 13 21 8"/></svg>`,
  },
];

async function seedIconCategories() {
  console.log("Seeding icon categories...");

  const { error } = await supabase.from("icon_categories").upsert(iconCategories, {
    onConflict: "id",
  });

  if (error) {
    console.error("Error seeding icon categories:", error.message);
    return false;
  }

  console.log(`✓ Seeded ${iconCategories.length} icon categories`);
  return true;
}

async function seedTestimonials() {
  console.log("Seeding testimonials...");

  // Check if testimonials already exist
  const { count } = await supabase
    .from("testimonials")
    .select("*", { count: "exact", head: true });

  if (count && count > 0) {
    console.log(`✓ Testimonials already exist (${count} found), skipping...`);
    return true;
  }

  const { error } = await supabase.from("testimonials").insert(testimonials);

  if (error) {
    console.error("Error seeding testimonials:", error.message);
    return false;
  }

  console.log(`✓ Seeded ${testimonials.length} testimonials`);
  return true;
}

async function seedAdminUser() {
  console.log(`Setting up admin user ${ADMIN_EMAIL}...`);

  // Find user by email using auth.users (requires service role)
  const { data: users, error: userError } = await supabase.auth.admin.listUsers();

  if (userError) {
    console.error("Error listing users:", userError.message);
    return false;
  }

  let adminUser = users.users.find((u) => u.email === ADMIN_EMAIL);

  // Create admin user if they don't exist
  if (!adminUser) {
    console.log(`Creating admin user ${ADMIN_EMAIL}...`);

    const { data, error: createError } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true, // Auto-confirm email
    });

    if (createError) {
      console.error("Error creating admin user:", createError.message);
      return false;
    }

    adminUser = data.user;
    console.log(`✓ Created admin user ${ADMIN_EMAIL}`);
  } else {
    console.log(`✓ Admin user ${ADMIN_EMAIL} already exists`);
  }

  // Insert admin role (upsert to avoid conflicts)
  const { error } = await supabase.from("user_roles").upsert(
    {
      user_id: adminUser.id,
      role: "admin",
    },
    {
      onConflict: "user_id,role",
    }
  );

  if (error) {
    console.error("Error granting admin role:", error.message);
    return false;
  }

  console.log(`✓ Granted admin role to ${ADMIN_EMAIL}`);
  return true;
}

async function seedBlogCategories() {
  console.log("Seeding blog categories...");

  const { error } = await supabase.from("blog_categories").upsert(blogCategories, {
    onConflict: "slug",
  });

  if (error) {
    console.error("Error seeding blog categories:", error.message);
    return false;
  }

  console.log(`✓ Seeded ${blogCategories.length} blog categories`);
  return true;
}

async function seedBlogTags() {
  console.log("Seeding blog tags...");

  const { error } = await supabase.from("blog_tags").upsert(blogTags, {
    onConflict: "slug",
  });

  if (error) {
    console.error("Error seeding blog tags:", error.message);
    return false;
  }

  console.log(`✓ Seeded ${blogTags.length} blog tags`);
  return true;
}

async function seedBlogPosts() {
  console.log("Seeding blog posts...");

  // Get admin user
  const { data: users, error: userError } = await supabase.auth.admin.listUsers();

  if (userError) {
    console.error("Error listing users:", userError.message);
    return false;
  }

  const adminUser = users.users.find((u) => u.email === ADMIN_EMAIL);

  if (!adminUser) {
    console.log(`⚠ User ${ADMIN_EMAIL} not found, skipping blog posts seeding`);
    return true;
  }

  const sampleBlogPosts = getSampleBlogPosts(adminUser.id);

  // Check if blog posts already exist
  const { count } = await supabase
    .from("blog_posts")
    .select("*", { count: "exact", head: true });

  if (count && count > 0) {
    console.log(`✓ Blog posts already exist (${count} found), skipping...`);
    return true;
  }

  const { error } = await supabase.from("blog_posts").insert(sampleBlogPosts);

  if (error) {
    console.error("Error seeding blog posts:", error.message);
    return false;
  }

  console.log(`✓ Seeded ${sampleBlogPosts.length} blog posts`);
  return true;
}

async function seedSiteSettings() {
  console.log("Seeding site settings...");

  const { error } = await supabase.from("site_settings").upsert(siteSettings, {
    onConflict: "setting_key",
  });

  if (error) {
    console.error("Error seeding site settings:", error.message);
    return false;
  }

  console.log(`✓ Seeded ${siteSettings.length} site settings`);
  return true;
}

async function seedSampleIcons() {
  console.log("Seeding sample icons...");

  // Check if icons already exist
  const { count } = await supabase
    .from("icons")
    .select("*", { count: "exact", head: true });

  if (count && count > 0) {
    console.log(`✓ Icons already exist (${count} found), skipping...`);
    return true;
  }

  const { error } = await supabase.from("icons").insert(sampleIcons);

  if (error) {
    console.error("Error seeding sample icons:", error.message);
    return false;
  }

  console.log(`✓ Seeded ${sampleIcons.length} sample icons across ${iconCategories.length} categories`);
  return true;
}

async function main() {
  console.log("Starting database seed...\n");
  console.log(`Supabase URL: ${supabaseUrl}\n`);

  let success = true;

  // Core data
  success = (await seedIconCategories()) && success;
  success = (await seedSampleIcons()) && success;
  success = (await seedTestimonials()) && success;
  success = (await seedAdminUser()) && success;

  // Blog data
  success = (await seedBlogCategories()) && success;
  success = (await seedBlogTags()) && success;
  success = (await seedBlogPosts()) && success;

  // Site settings
  success = (await seedSiteSettings()) && success;

  console.log("");
  if (success) {
    console.log("✓ Database seeding completed successfully!");
  } else {
    console.error("✗ Database seeding completed with errors");
    process.exit(1);
  }
}

main();
