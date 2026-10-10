import { useState, useRef, useEffect, useMemo } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { X, Loader2 } from "lucide-react";
import {
  ArrowLeft, Atom, Camera, PencilLine,
  TextAa, ArrowsClockwise, MagicWand, ImageSquare, Lightning,
  FlowArrow, ListChecks, Calendar,
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Download, ExternalLink, Eraser, ZoomIn, Lock, Info, History as HistoryIcon, Sparkles, Palette, Ratio, Crop, MessagesSquare, X as XIcon, ScrollText, RefreshCw, Type, LayoutTemplate, FileText, Upload as UploadIcon, ImageIcon, Square, Box, Pencil, PenLine, Feather, BookmarkPlus, BookmarkCheck, Aperture } from "lucide-react";
import { RecolorPickerModal } from "@/components/ai-illustrator/RecolorPickerModal";
import { AspectRatioModal, type TargetAspect, type ExtendDirection } from "@/components/ai-illustrator/AspectRatioModal";
import { RefineRegionOverlay } from "@/components/ai-illustrator/RefineRegionOverlay";
import { TextEditOverlay } from "@/components/ai-illustrator/TextEditOverlay";
import { buildRectMaskPng, compositeWithMask, eraseBoxToBackground, regionFromNormalized, type MaskBox } from "@/lib/regionRefine";
import { AI_ILLUSTRATOR_PRESETS, DEFAULT_AI_ILLUSTRATOR_PRESET_ID, getPresetById } from "@/lib/aiIllustratorPresets";
import { buildPosterSvg, POSTER_LAYOUTS, type PosterLayout } from "@/lib/posterSvg";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useAIGenerationUsage } from "@/hooks/useAIGenerationUsage";
import { InsufficientGenerationsDialog } from "@/components/credits/InsufficientGenerationsDialog";
import { PurchaseCreditsDialog } from "@/components/credits/PurchaseCreditsDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useGenerationBalance } from "@/hooks/useGenerationBalance";
import { useAiInvokeGuard } from "@/hooks/useAiInvokeGuard";
import { useQueryClient } from "@tanstack/react-query";
import { removeWhiteBackground, upscaleImage } from "@/utils/imageProcessing";
import { UserMenu } from "@/components/auth/UserMenu";
import { ClaudeChatInput } from "@/components/ui/claude-chat-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Check } from "lucide-react";

const BIOSKETCH_LOGO = "https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/sign/icon%20site/biosketch%20art-min.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zOWUxYTMwMi1lYjJkLTQxOGUtYjdkZS1hZGE0M2NhNTI0NDUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpY29uIHNpdGUvYmlvc2tldGNoIGFydC1taW4ucG5nIiwiaWF0IjoxNzYwODM2MjgxLCJleHAiOjIwNzYxOTYyODF9.LDw-xwHK6WmdeLwiG_BwtT0jX3N6fjdOvZmoUcI4FP0";

// ── AI Feature Modes ──
type AIMode = "flowchart" | "protocol" | "timeline" | "icon-generator" | "photo-to-2d" | "sketch-to-illustration" | "text-to-figure" | "image-to-figure" | "illustration-enhancer" | "ref-to-figure" | "abstract-to-figure" | "poster-from-doc";

type SizeOption = "1:1" | "16:9" | "4:3" | "9:16";

// Icon-generator visual style — mirrors admin Icon Factory's stylePrompts keys.
type IconStyle = "flat" | "3d" | "sketch" | "line-art" | "hand-drawn" | "glossy-3d";

const ICON_STYLE_OPTIONS: ReadonlyArray<{
  id: IconStyle;
  label: string;
  icon: typeof Square;
  hint: string;
}> = [
  { id: "flat",       label: "Flat",       icon: Square,   hint: "Flat 2D vector — clean solid fills" },
  { id: "3d",         label: "3D",         icon: Box,      hint: "3D rendered with realistic depth & lighting" },
  { id: "sketch",     label: "Sketch",     icon: Pencil,   hint: "Pencil sketch — hand-drawn graphite feel" },
  { id: "line-art",   label: "Line Art",   icon: PenLine,  hint: "Line-only outlines, no fills" },
  { id: "hand-drawn", label: "Hand-drawn", icon: Feather,  hint: "Warm textbook illustration — watercolor fills" },
  { id: "glossy-3d",  label: "Glossy 3D",  icon: Aperture, hint: "Medical Journal — soft airbrushed, muted palette" },
];

const SIZE_OPTIONS: { id: SizeOption; label: string; title: string }[] = [
  { id: "1:1", label: "1:1", title: "Square" },
  { id: "16:9", label: "16:9", title: "Landscape (slide)" },
  { id: "4:3", label: "4:3", title: "Landscape (classic)" },
  { id: "9:16", label: "9:16", title: "Portrait (story)" },
];

// Modes that do not use Gemini image generation (SVG renderer) or that must
// preserve the input image's dimensions — size selector is hidden for these.
const NO_SIZE_MODES: AIMode[] = ["flowchart", "protocol", "timeline", "illustration-enhancer", "abstract-to-figure", "poster-from-doc"];

// Modes that expose the visual-style picker (icon style + all its siblings,
// including glossy-3d NEJM). The backend applies ICON_STYLE_PROMPTS to the
// generation for each of these; other modes ignore the parameter.
const STYLE_PICKER_MODES: AIMode[] = ["icon-generator", "text-to-figure", "abstract-to-figure"];

interface AIFeature {
  id: AIMode;
  name: string;
  shortName: string;
  description: string;
  icon: React.ReactNode;
  placeholder: string;
  acceptsImage: boolean;
  requiresImage: boolean;
  color: string;
  suggestions: string[];
  /** Optional: shown as a chip on the mode picker when > 1 (currently only the
   *  two-pass abstract-to-figure). Default is 1 credit and no badge. */
  costCredits?: number;
}

const AI_FEATURES: AIFeature[] = [
  {
    id: "flowchart", name: "Flowchart", shortName: "Flowchart",
    description: "Convert text into clean, editable flowcharts",
    icon: <FlowArrow size={18} weight="duotone" />,
    placeholder: "Describe the logic or process, e.g. 'hematopoietic stem cell differentiation'",
    acceptsImage: false, requiresImage: false, color: "text-slate-700",
    suggestions: [
      "Hematopoietic stem cell differentiation into myeloid and lymphoid lineages",
      "Decision tree for first-line cancer treatment selection",
      "Apoptosis signaling: intrinsic vs extrinsic pathway logic",
      "PCR troubleshooting decision flowchart",
    ],
  },
  {
    id: "protocol", name: "Protocol", shortName: "Protocol",
    description: "Convert written methods into clear protocol diagrams",
    icon: <ListChecks size={18} weight="duotone" />,
    placeholder: "Paste or describe your method, e.g. 'Western blot from lysis to imaging'",
    acceptsImage: false, requiresImage: false, color: "text-slate-700",
    suggestions: [
      "NMR protein structural determination workflow",
      "Western blot protocol from lysis to imaging",
      "RNA-seq library prep and sequencing pipeline",
      "CRISPR knockout: design, transfection, validation",
    ],
  },
  {
    id: "timeline", name: "Timeline", shortName: "Timeline",
    description: "Generate editable experimental timelines from a study description",
    icon: <Calendar size={18} weight="duotone" />,
    placeholder: "Describe your study design, e.g. '30-day xenograft tumor experiment'",
    acceptsImage: false, requiresImage: false, color: "text-slate-700",
    suggestions: [
      "30-day subcutaneous tumor xenograft experiment in mice",
      "6-week behavior study with weekly assessments",
      "12-month longitudinal patient cohort sampling schedule",
      "Drug screening campaign: hit identification to lead validation",
    ],
  },
  {
    id: "icon-generator", name: "Icon Generator", shortName: "Icons",
    description: "Generate scientific icons from text",
    icon: <Atom size={18} weight="duotone" />,
    placeholder: "Describe the icon you want, e.g. 'a mitochondrion with cristae'",
    acceptsImage: false, requiresImage: false, color: "text-violet-600",
    suggestions: ["A phospholipid bilayer membrane", "DNA double helix with nucleotides", "Neuron with dendrites and axon", "Red blood cell (erythrocyte)"],
  },
  {
    id: "photo-to-2d", name: "Photo to 2D", shortName: "Photo→2D",
    description: "Convert photos into flat 2D illustrations",
    icon: <Camera size={18} weight="duotone" />,
    placeholder: "Upload a photo and describe the 2D style you want",
    acceptsImage: true, requiresImage: true, color: "text-blue-600",
    suggestions: ["Convert to flat 2D vector illustration", "Make it a clean line art diagram", "Render as a simplified scientific icon"],
  },
  {
    id: "sketch-to-illustration", name: "Sketch to Illustration", shortName: "Sketch→Art",
    description: "Transform sketches into clean illustrations",
    icon: <PencilLine size={18} weight="duotone" />,
    placeholder: "Upload your sketch and describe the style",
    acceptsImage: true, requiresImage: true, color: "text-emerald-600",
    suggestions: ["Clean up and vectorize this sketch", "Convert to a professional diagram", "Make it publication-ready with labels"],
  },
  {
    id: "text-to-figure", name: "Text to Figure", shortName: "Text→Fig",
    description: "Generate schematics from text descriptions",
    icon: <TextAa size={18} weight="duotone" />,
    placeholder: "Describe the figure, e.g. 'EGFR to MAPK signaling cascade'",
    acceptsImage: false, requiresImage: false, color: "text-orange-600",
    suggestions: ["CRISPR-Cas9 gene editing mechanism", "Insulin signaling pathway", "T-cell activation cascade", "Glycolysis metabolic pathway"],
  },
  {
    id: "image-to-figure", name: "Image to Figure", shortName: "Img→Fig",
    description: "Convert images into publication figures",
    icon: <ArrowsClockwise size={18} weight="duotone" />,
    placeholder: "Upload an image to convert into a scientific figure",
    acceptsImage: true, requiresImage: true, color: "text-pink-600",
    suggestions: ["Convert to a labeled anatomical diagram", "Make it a publication-quality figure", "Add scale bars and annotations"],
  },
  {
    id: "illustration-enhancer", name: "Illustration Enhancer", shortName: "Enhance",
    description: "Sharpen and clean illustrations with AI",
    icon: <MagicWand size={18} weight="duotone" />,
    placeholder: "Upload an illustration to enhance",
    acceptsImage: true, requiresImage: true, color: "text-amber-600",
    suggestions: ["Sharpen edges and clean up lines", "Increase resolution and clarity", "Fix colors and improve contrast"],
  },
  {
    id: "ref-to-figure", name: "Reference to Figure", shortName: "Ref→Fig",
    description: "Convert reference images to 2D vector figures",
    icon: <ImageSquare size={18} weight="duotone" />,
    placeholder: "Upload a reference image and describe the figure style",
    acceptsImage: true, requiresImage: true, color: "text-purple-600",
    suggestions: ["Recreate as a flat 2D scientific illustration", "Convert to vector-style diagram", "Redraw in flat 2D vector style"],
  },
  {
    id: "abstract-to-figure", name: "Abstract to Figure", shortName: "Abstract→Fig",
    description: "Paste a paper abstract — extracts a figure plan and draws it (2 credits)",
    icon: <ScrollText className="h-4 w-4" />,
    placeholder: "Paste an abstract or a paragraph of scientific text…",
    acceptsImage: false, requiresImage: false, color: "text-teal-600",
    costCredits: 2,
    suggestions: [
      "ERK1/2 signaling activates SRF-dependent transcription in cardiomyocytes, driving hypertrophic gene expression through Ras-Raf-MEK activation at the plasma membrane.",
      "SARS-CoV-2 spike binds ACE2 on airway epithelial cells, triggering TMPRSS2-mediated cleavage and viral entry through the endocytic pathway.",
      "Autophagy initiation requires ULK1 kinase complex activation, which recruits PI3K class III to nucleate a phagophore that engulfs cytoplasmic cargo for lysosomal degradation.",
    ],
  },
  {
    id: "poster-from-doc", name: "Poster from Doc", shortName: "Poster",
    description: "Upload a .docx paper — extracts sections and figures, then plans a landscape scientific poster (4-6 credits, staged)",
    icon: <LayoutTemplate className="h-4 w-4" />,
    placeholder: "Upload a Word document above, then add any layout notes here (optional)…",
    acceptsImage: false, requiresImage: false, color: "text-fuchsia-600",
    costCredits: 4,
    suggestions: [
      "Emphasize the results section — put those figures in the largest panels.",
      "Keep the abstract short at the top-left; make Results the centerpiece.",
      "Match the Nature journal style palette.",
    ],
  },
];

// ── Mode explainer + prompt tips ────────────────────────────────────────────
// Rendered under the mode picker so users see two things per mode without
// clicking anything: (a) a plain-English line about what the mode actually
// does, and (b) a collapsible list of concrete prompt-shape tips. Kept short
// on purpose — 3 tips per mode, one line each, actionable phrasing.
const MODE_TIPS: Record<AIMode, { what: string; tips: string[] }> = {
  "flowchart": {
    what: "Turns a written process or decision into a clean, editable SVG flowchart — nodes and arrows are real vector shapes.",
    tips: [
      "Write the logic as prose — start point, branches, and terminal states in one paragraph.",
      "Name each branch explicitly (\"if positive → …\") so the arrows land correctly.",
      "Keep node labels short (1–4 words). Long labels get truncated in the layout.",
    ],
  },
  "protocol": {
    what: "Converts a written lab method into a stepped SVG protocol diagram with numbered stages and timing.",
    tips: [
      "Paste the method verbatim from your methods section — the AI extracts steps better from prose than bullet points.",
      "Include timing cues (\"incubate 4 °C overnight\") so the timeline column populates.",
      "For repeated cycles say \"repeat steps 3–5 for 35 cycles\" — that becomes a loop annotation.",
    ],
  },
  "timeline": {
    what: "Builds an experimental timeline SVG with date markers, cohort lanes, and intervention arrows.",
    tips: [
      "State the total duration up front (\"30-day\", \"6-week\") — the AI uses it to space the axis.",
      "List each timepoint with what happens (\"Day 0: implantation, Day 7: first imaging\").",
      "Name distinct cohorts on their own lines so each gets a lane.",
    ],
  },
  "icon-generator": {
    what: "Generates a single scientific icon on a clean background — suitable for figures, slides, and teaching material.",
    tips: [
      "Say the noun + one modifier: \"mitochondrion with cristae\", not \"cell energy factory\".",
      "For a matched set, use the same Journal Style Preset across every icon.",
      "Turn on Exclude Text and add labels in the Canvas for crisp typography.",
    ],
  },
  "photo-to-2d": {
    what: "Redraws a photograph as a flat 2D illustration — same subject, editorial vector look, publication-safe.",
    tips: [
      "Upload a photo with a clear single subject — cluttered backgrounds confuse the AI.",
      "Describe the target style: \"flat vector, thick outlines, muted palette\".",
      "Higher-resolution uploads produce sharper 2D output. Under 1 MB tends to soften details.",
    ],
  },
  "sketch-to-illustration": {
    what: "Cleans up a hand sketch or whiteboard photo and turns it into a polished illustration, preserving your composition.",
    tips: [
      "Photograph the sketch straight-on with good light — perspective distortion carries through.",
      "Add labels or arrows in the sketch itself; the AI usually preserves their positions.",
      "Say the target medium: \"clean line art\" vs \"filled flat 2D\" — big style difference.",
    ],
  },
  "text-to-figure": {
    what: "Generates a schematic scientific figure from a text description — pathways, mechanisms, structures.",
    tips: [
      "Name the players and their relationships: \"EGFR activates RAS → RAF-MEK-ERK → nucleus\".",
      "Specify the scene: \"membrane at the top, nucleus at the bottom\".",
      "Pick a Journal Style Preset before generating — matches Nature / Cell / eLife house styles.",
    ],
  },
  "image-to-figure": {
    what: "Takes a reference image (screenshot, published figure, photo) and reinterprets it as a clean publication figure.",
    tips: [
      "Upload the reference and describe what to change: \"same layout, but relabel for our study\".",
      "Say what to preserve explicitly: \"keep the arrow directions\", \"keep the four-panel grid\".",
      "Best when structure matters more than style — use Reference → Vector for pure style transfer.",
    ],
  },
  "illustration-enhancer": {
    what: "Sharpens edges, cleans compression artifacts, and evens out colors — same content, higher quality.",
    tips: [
      "Skip the prompt or keep it minimal — this mode is style-preserving by design.",
      "For a pure resolution boost, Upscale is free and usually better.",
      "Not a redesign tool — Enhance won't restructure a bad composition.",
    ],
  },
  "ref-to-figure": {
    what: "Uses your reference as a visual anchor and generates a new 2D vector figure inspired by it — style transfer more than composition transfer.",
    tips: [
      "Upload ONE clean reference — multiple references confuse the style extraction.",
      "Describe the new content, not the reference (\"a mitochondrion\", not \"like this cell\").",
      "For a consistent set, reuse the same reference image across generations.",
    ],
  },
  "abstract-to-figure": {
    what: "Two-pass flow: the AI reads a paper abstract, drafts a figure plan (Stage 1), then draws from that plan (Stage 2).",
    tips: [
      "Paste the FULL abstract, not a summary — extra context sharpens the plan.",
      "Review the plan card carefully — you can nudge it in prose before hitting Draw.",
      "First generation = 2 credits (1 for plan + 1 for draw). Re-drawing from the same plan = 1 credit.",
    ],
  },
  "poster-from-doc": {
    what: "Multi-stage: parses your .docx, plans layout, generates figures, and assembles a landscape scientific poster.",
    tips: [
      "Upload a clean .docx under 8 MB with clear section headings — the parser uses them.",
      "Pick a Poster Layout template first — it strongly shapes the AI's plan.",
      "Budget 4 credits + ~1 per generated figure. Typical total: 6–10 credits.",
    ],
  },
};

// ── Starter examples ────────────────────────────────────────────────────────
// Real prompt / output pairs the home-page carousel is already showcasing.
// Reused here as one-click starters on the empty state: click a card and the
// mode + prompt are populated in one shot, so a new user's first generation
// runs on a known-good prompt and lands publication-grade output instead of
// the "what do I even type?" cliff. Removes the biggest activation-killer
// on the AI Illustrator without adding any modal, tour, or overlay chrome.
interface StarterExample {
  id: string;
  title: string;
  mode: AIMode;
  prompt: string;
  thumbnail: string;
}

const STARTER_EXAMPLES: StarterExample[] = [
  {
    id: "pathogen-evasion",
    title: "Six-panel pathogen infographic",
    mode: "text-to-figure",
    prompt:
      "Create a clean 2 × 3 educational infographic in a flat, biomedical illustration-inspired style on a white background. Separate the six panels with thin gray lines and place a light-lilac title bar with bold black text above each panel. Depict pathogens as simple blue circles, phagocytes as irregular yellow amoeboid cells containing a pale-purple multilobed nucleus and small purple lysosomes, toxins and proteins as red dots, antibodies as red Y-shapes, and processes with white outlined arrows or thin red arrows.\n\nAcross the top row, show toxin release, opsonization prevented, and contact with phagocyte prevented. Across the bottom row, show phagolysosome fusion inhibited, escape into the cytoplasm, and resistance to killing. Add a short explanatory caption beneath each panel and include representative organisms: staphylococci, streptococci, Streptococcus pneumoniae, Bacillus anthracis, Mycobacterium tuberculosis, Toxoplasma, Chlamydia, Leishmania, Trypanosoma cruzi, and Mycobacterium leprae.",
    thumbnail:
      "https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/public/badges%20folder/PROMPT%20TO%20ILLUSTRATION%20PATHOGEN%20EVASION.png",
  },
  {
    id: "peanut-botanical",
    title: "Botanical peanut plant",
    mode: "icon-generator",
    prompt:
      "Create a simple editorial botanical infographic of peanut plant, Arachis hypogaea centered isolated plant specimen, selective labels, peanut internal structure detail of a peanut, minimal botanical infographic style.",
    thumbnail:
      "https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/public/badges%20folder/PROMPT%20TO%20ILLUSTRATION%20PEANUT.png",
  },
  {
    id: "osteoporosis-3d",
    title: "Bone architecture comparison",
    mode: "text-to-figure",
    prompt:
      "Create a high-resolution, publication-ready biomedical comparison illustration showing the internal microarchitecture of normal trabecular bone versus osteoporotic trabecular bone. Use a clean 16:9 horizontal composition on a pure white background, with two large cutaway bone cubes positioned side by side at equal scale and viewed from a slightly elevated three-quarter angle.\n\nDepict Normal bone as a light blush-pink cube with a dense, interconnected trabecular network — many fine rounded marrow spaces surrounded by thick continuous struts. Depict Osteoporosis as a deeper rose-brown cube with clear structural loss — thinner fragile trabeculae, broken bridges, enlarged marrow cavities. Cubes must remain identical in overall size so the reduced bone density is immediately obvious. Muted clinical palette, subtle ambient occlusion, soft pale-gray shadows, no labels inside the cubes, no watermarks.",
    thumbnail:
      "https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/public/badges%20folder/PROMPT%20TO%20ILLUSTRATION%20OSTEOPOROSIS.png",
  },
  {
    id: "wnt-signaling",
    title: "Wnt signaling pathway",
    mode: "text-to-figure",
    prompt:
      "Create a publication-ready, landscape biomedical pathway infographic titled \"Wnt Signaling Pathways Regulate Cell-Cycle Progression.\" Cell Press–style aesthetic with a white background, crisp dark-gray linework, muted pastel colors, smooth semi-flat vector rendering.\n\nCompose the figure as an integrated left-to-right signaling map that connects Wnt receptor activation at the plasma membrane to two distinct outcomes: canonical β-catenin–dependent G1/S progression and Wnt/STOP–dependent G2/M progression and mitotic control. Show a Wnt ligand binding Frizzled + LRP5/6, DVL adaptor, an inhibited β-catenin destruction complex (APC · Axin · GSK3 · CK1), stabilized β-catenin entering the nucleus to activate c-MYC and Cyclin D. On the Wnt/STOP branch, show stabilization of Protein X/Y/Z leading to cell-size, spindle assembly, and mitotic control panels. Include a circular G1 · S · G2 · M cell-cycle diagram in the lower right.",
    thumbnail:
      "https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/public/badges%20folder/PROMPT%20TO%20ILLUSTRATION%20WNT%20SIGNALING.png",
  },
];

// ── Poster plan (Stage 2 output shape) ──
interface PosterPlanData {
  title: string;
  authors: string;
  affiliation: string;
  keyTakeaway: string;
  sections: {
    name: string;
    bullets: string[];
    figureIdx?: number;
  }[];
  figures: {
    caption: string;
    source: "embedded" | "generate";
    embeddedIndex?: number;
    generatePrompt?: string;
  }[];
  crossCheck: {
    ok: boolean;
    issues: string[];
  };
}

// ── Chat Message ──
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  image?: string;
  svg?: string;
  timestamp: Date;
  /**
   * The mode active when this message's image was created. Used by the
   * toolbar to decide when to expose mode-specific actions — currently just
   * "Save as icon" (icon-generator only). Propagated through derivative
   * operations (recolor, aspect, region edit, refine chat) so a modified
   * icon still counts as an icon.
   */
  sourceMode?: AIMode;
  /**
   * Planner meta-messages shown between the user's refine request and the
   * final refined image. `planning` = spinner while refine-plan is running;
   * `plan` = the resolved plan card the executor is about to act on;
   * `figure-planning` / `figure-plan` = the abstract-to-figure two-pass flow.
   */
  kind?:
    | "plan"
    | "planning"
    | "figure-plan"
    | "figure-planning"
    | "doc-extracted"
    | "poster-planning"
    | "poster-plan"
    | "poster-drawing"
    | "poster-figures";
  planScope?: "local" | "global" | "fresh";
  planChange?: string;
  planPreserve?: string;
  /**
   * abstract-to-figure structured plan. Rendered as a card and re-usable via
   * the "Regenerate from plan" button (skips the analyzer pass on the second
   * draw, costing 1 credit instead of 2).
   */
  figurePlan?: {
    subject: string;
    figureType: string;
    components: string[];
    spatialLayout: string;
    labels: string[];
    styleHints: string;
  };
  /** For figure-plan messages: the original abstract, so Regenerate can resend it. */
  sourceAbstract?: string;
  /**
   * For "doc-extracted" cards on the Poster-from-Doc flow. Holds the parsed
   * summary so subsequent stages (planner, generator) can reuse it without
   * re-uploading.
   */
  extractedDoc?: {
    fileName: string;
    wordCount: number;
    sections: string[];
    imageCount: number;
    warnings: string[];
  };
  /**
   * Poster planner output — shown as a card between the extracted-doc card
   * and (Stage 3) the final SVG poster.
   */
  posterPlan?: PosterPlanData;
  /**
   * Snapshot of the .docx's embedded image data URLs at the moment the plan
   * was drafted. Lives on the plan message so the Generate poster button
   * still works after the user swaps or clears the input dropzone.
   */
  posterEmbeddedImages?: string[];
  /**
   * Stage 3 progress meta for the "poster-drawing" spinner card:
   * how many figures have been drawn out of how many.
   */
  posterProgress?: { done: number; total: number };
  /**
   * Stage 3 result — full ordered list of resolved figures. Each entry
   * corresponds to plan.figures[i]. `imageDataUrl` is populated for both
   * generated and reused figures; `failed` flags any generate call that
   * couldn't produce an image (auto-refunded on the edge fn side).
   */
  posterFigures?: {
    plan: PosterPlanData;
    resolved: {
      caption: string;
      source: "embedded" | "generate";
      imageDataUrl: string;
      failed?: boolean;
    }[];
  };
  /**
   * Metadata carried on the assembled poster SVG message so the Download PPT
   * button can rebuild an editable PowerPoint from the same source data
   * (rather than converting the SVG post-hoc).
   */
  posterMeta?: {
    plan: PosterPlanData;
    resolved: {
      caption: string;
      source: "embedded" | "generate";
      imageDataUrl: string;
      failed?: boolean;
    }[];
    layout: PosterLayout;
    presetId: string;
  };
}

// ── Component ──
const AIIllustrator = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { hasAccess, remaining } = useFeatureAccess();
  const { usage, refetch: refetchUsage } = useAIGenerationUsage();
  // New credit system — authoritative for gating. Old `usage` still drives some
  // header + trial-banner UI but should NOT block generation on its own.
  const { data: balance } = useGenerationBalance();
  const { isGated, handleInvokeError, openWaitingPeriodDialog } = useAiInvokeGuard();
  const [activeMode, setActiveMode] = useState<AIMode>("icon-generator");
  const [showCreditsInfo, setShowCreditsInfo] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  /**
   * Poster-from-Doc state: the parsed .docx sitting in memory awaiting the
   * planner call. Lives here so the mode picker can display the upload chip
   * and handleSend can dispatch to the poster pipeline without re-parsing.
   */
  const [uploadedDoc, setUploadedDoc] = useState<import("@/lib/docxExtract").ExtractedDoc | null>(null);
  const [parsingDoc, setParsingDoc] = useState(false);
  const docFileInputRef = useRef<HTMLInputElement | null>(null);
  const [posterLayout, setPosterLayout] = useState<PosterLayout>("classic");
  /**
   * Poster-from-Doc: when ON, the planner is told to use ONLY images
   * embedded in the .docx and never suggest AI-generated figures. Useful
   * when authors want their real experimental panels on the poster
   * verbatim rather than an AI redraw.
   */
  const [posterEmbeddedOnly, setPosterEmbeddedOnly] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showInsufficientCredits, setShowInsufficientCredits] = useState(false);
  const [showPurchaseCredits, setShowPurchaseCredits] = useState(false);
  const queryClient = useQueryClient();
  const [generations, setGenerations] = useState<{ id: string; mode: string; prompt: string; image_url: string; created_at: string }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  /** Zero-indexed current page of the history grid (6 items per page). */
  const [historyPage, setHistoryPage] = useState(0);
  /** ID of the history item awaiting a confirm-click before delete. */
  const [historyDeleteConfirmId, setHistoryDeleteConfirmId] = useState<string | null>(null);
  const [excludeText, setExcludeText] = useState(false);
  const [size, setSize] = useState<SizeOption>("1:1");
  // Style preset — journal-specific palette/typography guidance appended to
  // the Gemini prompt on the edge function side. Default = no injection.
  const [stylePresetId, setStylePresetId] = useState<string>(DEFAULT_AI_ILLUSTRATOR_PRESET_ID);
  const [presetOpen, setPresetOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  // Icon-generator style — swaps the visual approach (flat/3D/sketch/line-art/hand-drawn).
  // Wired into the compose bar via a small dropdown next to Send when
  // activeMode === "icon-generator". Sent to the edge function as `iconStyle`.
  const [iconStyle, setIconStyle] = useState<IconStyle>("flat");
  const [iconStyleOpen, setIconStyleOpen] = useState(false);
  // Phase C opt-in: when ON and mode is icon-generator or text-to-figure, the
  // edge function fires two parallel image generations and returns the winner
  // — costs 2 credits. Default OFF matches the 1-credit single-candidate flow.
  const [higherQuality, setHigherQuality] = useState(false);
  // Phase E opt-in: when ON and mode is icon-generator, the server-side
  // post-process alpha-extracts the icon's white background so the returned
  // PNG has transparency. Whitening + auto-crop always fire on icon-generator
  // regardless of this flag — this only controls alpha.
  const [transparentBackground, setTransparentBackground] = useState(false);
  // Multi-turn conversational refinement: when ON, Send treats the request as
  // a follow-up edit to the last generated image, passing chat history +
  // previous image to the edge function's refine-chat path.
  const [refineChat, setRefineChat] = useState(false);
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);


  const activeFeature = AI_FEATURES.find(f => f.id === activeMode)!;

  // Load generation history on mount
  useEffect(() => {
    if (user) loadHistory();
  }, [user]);

  // Reset the history pagination + clear any pending delete confirm each
  // time the panel opens, so users land on the newest generations.
  useEffect(() => {
    if (showHistory) {
      setHistoryPage(0);
      setHistoryDeleteConfirmId(null);
    }
  }, [showHistory]);

  // Load generation history
  const loadHistory = async () => {
    if (!user) return;
    setHistoryLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("ai_illustrator_history")
        .select("id, mode, prompt, image_url, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setGenerations(data || []);
    } catch (e) {
      console.error("Failed to load history:", e);
    }
    setHistoryLoading(false);
  };

  // Save a generation
  const saveGeneration = async (mode: string, promptText: string, imageUrl: string) => {
    if (!user) return;
    try {
      // Store at the source resolution (capped at 1024 px on the long edge,
      // which matches Gemini's native output size — so AI illustrator outputs
      // are preserved exactly). Earlier code shrunk to a 256 px thumbnail
      // which is what made history images look blurry on reload.
      const stored = await new Promise<string>((resolve) => {
        const img = new window.Image();
        img.onload = () => {
          const maxDim = 1024;
          let w = img.naturalWidth, h = img.naturalHeight;
          if (w > maxDim || h > maxDim) {
            const scale = maxDim / Math.max(w, h);
            w = Math.round(w * scale); h = Math.round(h * scale);
          }
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          const ctx = c.getContext("2d")!;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, w, h);
          // PNG is lossless — the second arg has no effect on PNG output but
          // we keep it for parity if format is ever changed to image/webp.
          resolve(c.toDataURL("image/png"));
        };
        img.onerror = () => resolve(imageUrl.substring(0, 500));
        img.src = imageUrl;
      });

      await (supabase as any).from("ai_illustrator_history").insert({
        user_id: user.id,
        mode,
        prompt: promptText,
        image_url: stored,
      });
      loadHistory();
    } catch (e) {
      console.error("Failed to save generation:", e);
    }
  };

  const deleteGeneration = async (id: string) => {
    try {
      await (supabase as any).from("ai_illustrator_history").delete().eq("id", id);
      setGenerations(prev => prev.filter(g => g.id !== id));
      toast.success("Generation deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const hasMessages = messages.length > 0;
  const [processingMsgId, setProcessingMsgId] = useState<string | null>(null);

  const updateMessageImage = (msgId: string, newImage: string, appendText?: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      return { ...m, image: newImage, text: appendText ? m.text + "\n" + appendText : m.text };
    }));
  };

  const handleRemoveBg = async (msgId: string, imageUrl: string) => {
    setProcessingMsgId(msgId);
    try {
      const result = await removeWhiteBackground(imageUrl);
      updateMessageImage(msgId, result, "Background removed.");
      toast.success("Background removed");
    } catch { toast.error("Failed to remove background"); }
    setProcessingMsgId(null);
  };

  // Save a generated icon into the user's asset library. Opens a small dialog
  // so the user can fill in name / tags / description, then uploads the PNG
  // to the `user-assets` storage bucket and inserts a `user_assets` row with
  // category="ai-icons" so it shows up in the "My Library" section of the
  // canvas Icon Library. Tracks saved message IDs so the button flips to
  // "Saved" and can't be double-clicked.
  const [savedIconMsgIds, setSavedIconMsgIds] = useState<Set<string>>(new Set());
  const [savingIconInProgress, setSavingIconInProgress] = useState(false);
  const [saveIconMsg, setSaveIconMsg] = useState<ChatMessage | null>(null);
  const [saveIconName, setSaveIconName] = useState("");
  const [saveIconTags, setSaveIconTags] = useState("");
  const [saveIconDescription, setSaveIconDescription] = useState("");

  const openSaveIconDialog = (msg: ChatMessage) => {
    if (savedIconMsgIds.has(msg.id)) return;
    setSaveIconMsg(msg);
    setSaveIconName(msg.text.length > 80 ? msg.text.slice(0, 80) : (msg.text || "AI icon"));
    setSaveIconTags("");
    setSaveIconDescription("");
  };

  const handleSaveAsIconConfirm = async () => {
    const msg = saveIconMsg;
    if (!user?.id || !msg?.image) return;
    if (!saveIconName.trim()) {
      toast.error("Please enter a name for the icon");
      return;
    }
    setSavingIconInProgress(true);
    try {
      // Resize to max 512×512 (matches admin Icon Factory). AI-Illustrator
      // outputs are typically 1024×1024 or 1024×2048 — placing them on the
      // canvas at natural size makes them huge and hard to manipulate. We
      // downsample here so saved icons behave like every other library icon
      // when dropped onto a canvas. Original data URL is preserved earlier
      // in the chat message; only the SAVED copy is resized.
      const ICON_MAX_SIZE = 512;
      const { dataUrl: resizedDataUrl, width: outW, height: outH } = await new Promise<{
        dataUrl: string;
        width: number;
        height: number;
      }>((resolve, reject) => {
        const src = new window.Image();
        src.onload = () => {
          const nw = src.naturalWidth;
          const nh = src.naturalHeight;
          const longest = Math.max(nw, nh);
          const scale = longest > ICON_MAX_SIZE ? ICON_MAX_SIZE / longest : 1;
          const outW = Math.round(nw * scale);
          const outH = Math.round(nh * scale);
          const canvas = document.createElement("canvas");
          canvas.width = outW;
          canvas.height = outH;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("Canvas 2D unavailable")); return; }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(src, 0, 0, outW, outH);
          resolve({ dataUrl: canvas.toDataURL("image/png"), width: outW, height: outH });
        };
        src.onerror = () => reject(new Error("Failed to load image for resize"));
        src.src = msg.image!;
      });

      // Optimized data URL → Blob for upload. Always PNG output regardless
      // of source mime (the canvas re-encode produces PNG).
      const optimizedBase64 = resizedDataUrl.split(",")[1] || "";
      const byteChars = atob(optimizedBase64);
      const byteNums = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteNums], { type: "image/png" });
      const mimeExt = "png";
      const dims = { width: outW, height: outH };

      const timestamp = Date.now();
      const fileName = `icon-${timestamp}.${mimeExt}`;
      const storagePath = `${user.id}/ai-illustrator/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from("user-assets")
        .upload(storagePath, blob, { contentType: `image/${mimeExt}`, cacheControl: "3600" });
      if (uploadError) throw uploadError;

      const tagsArr = saveIconTags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const { error: insertError } = await supabase.from("user_assets").insert({
        user_id: user.id,
        file_name: fileName,
        original_name: saveIconName.trim(),
        // file_type is the extension (png/jpg/svg/etc.), not a semantic type —
        // UserAssetsLibrary.isImageType checks against exact extensions and
        // renders a fallback ("image" text) for anything else.
        file_type: mimeExt.toLowerCase(),
        mime_type: `image/${mimeExt}`,
        file_size: blob.size,
        storage_path: storagePath,
        category: "ai-icons",
        tags: tagsArr.length > 0 ? tagsArr : null,
        description: saveIconDescription.trim() || null,
        width: dims.width || null,
        height: dims.height || null,
      });
      if (insertError) throw insertError;

      setSavedIconMsgIds((prev) => new Set(prev).add(msg.id));
      toast.success("Saved to icon library");
      setSaveIconMsg(null);
    } catch (err: any) {
      console.error("Save as icon failed:", err);
      toast.error(err?.message || "Failed to save icon");
    } finally {
      setSavingIconInProgress(false);
    }
  };

  const handleUpscale = async (msgId: string, imageUrl: string, scale: number = 2) => {
    setProcessingMsgId(msgId);
    try {
      const result = await upscaleImage(imageUrl, scale);
      updateMessageImage(msgId, result, `Upscaled ${scale}x & sharpened.`);
      toast.success(`Image upscaled ${scale}x & sharpened`);
    } catch { toast.error("Failed to upscale"); }
    setProcessingMsgId(null);
  };

  // ── Recolor (Tier 1 refine) ────────────────────────────────────────────────
  // The clicked message becomes the "source" for the recolor. `recolorMsgId`
  // both opens the modal and marks the parent image as busy while we call the
  // edge function. On success we insert a NEW assistant message with the
  // recolored image so the user sees before/after and can iterate on palettes.
  const [recolorMsgId, setRecolorMsgId] = useState<string | null>(null);
  const [recolorBusy, setRecolorBusy] = useState(false);

  const handleRecolorSubmit = async (palette: string[]) => {
    if (!recolorMsgId) return;
    const sourceMsg = messages.find((m) => m.id === recolorMsgId);
    if (!sourceMsg?.image) {
      toast.error("Original image not found");
      return;
    }

    // Pre-check the credit balance so we don't send a payload for a call that
    // will bounce with 402 — matches the pattern used by handleGenerate.
    if (!usage?.isAdmin && balance && balance.total_available === 0) {
      setShowInsufficientCredits(true);
      return;
    }
    if (isGated()) return;

    setRecolorBusy(true);
    setProcessingMsgId(recolorMsgId);
    try {
      const { data, error } = await supabase.functions.invoke("refine-image", {
        body: {
          mode: "recolor",
          originalImage: sourceMsg.image,
          palette,
        },
      });

      // supabase-js wraps 402/500 responses into an error surface — pull the
      // actual body text if we can so we can differentiate INSUFFICIENT_CREDITS.
      if (error) {
        let detail = error.message ?? "";
        let body: any = null;
        try {
          body = await (error as any).context?.json?.();
          if (body?.error) detail = body.error;
        } catch { /* ignore parse failures */ }

        if (detail === "INSUFFICIENT_CREDITS") {
          setShowInsufficientCredits(true);
          return;
        }
        if (detail === "WAITING_PERIOD") {
          openWaitingPeriodDialog(body?.unlock_at ?? null);
          return;
        }
        throw new Error(detail || "Recolor failed");
      }

      if (!data?.success || !data?.image) {
        throw new Error(data?.error || "No image returned");
      }

      // Insert the recolored image as a NEW assistant message so the user can
      // compare before/after and continue iterating on palettes.
      const newMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: `Recolored (${palette.slice(0, 5).join(", ")})`,
        image: data.image,
        timestamp: new Date(),
        sourceMode: sourceMsg.sourceMode,
      };
      setMessages((prev) => [...prev, newMsg]);
      await saveGeneration("recolor", newMsg.text, data.image);
      // Refresh balance so the pill updates immediately.
      queryClient.invalidateQueries({ queryKey: ["generation-balance", user?.id] });
      toast.success("Recolored");
      setRecolorMsgId(null); // Close the modal
    } catch (err: any) {
      console.error("Recolor failed:", err);
      toast.error(err?.message || "Failed to recolor");
    } finally {
      setRecolorBusy(false);
      setProcessingMsgId(null);
    }
  };

  // ── Aspect ratio change (Tier 1 refine · sub-feature C) ───────────────────
  // Same shape as Recolor: modal picks target aspect + extend direction,
  // edge function outpaints, result inserted as a new chat message.
  const [aspectMsgId, setAspectMsgId] = useState<string | null>(null);
  const [aspectBusy, setAspectBusy] = useState(false);

  const handleAspectSubmit = async (targetAspect: TargetAspect, direction: ExtendDirection) => {
    if (!aspectMsgId) return;
    const sourceMsg = messages.find((m) => m.id === aspectMsgId);
    if (!sourceMsg?.image) {
      toast.error("Original image not found");
      return;
    }

    if (!usage?.isAdmin && balance && balance.total_available === 0) {
      setShowInsufficientCredits(true);
      return;
    }
    if (isGated()) return;

    setAspectBusy(true);
    setProcessingMsgId(aspectMsgId);
    try {
      const { data, error } = await supabase.functions.invoke("refine-image", {
        body: {
          mode: "aspect",
          originalImage: sourceMsg.image,
          targetAspect,
          direction,
        },
      });

      if (error) {
        let detail = error.message ?? "";
        let body: any = null;
        try {
          body = await (error as any).context?.json?.();
          if (body?.error) detail = body.error;
        } catch { /* ignore parse failures */ }

        if (detail === "INSUFFICIENT_CREDITS") {
          setShowInsufficientCredits(true);
          return;
        }
        if (detail === "WAITING_PERIOD") {
          openWaitingPeriodDialog(body?.unlock_at ?? null);
          return;
        }
        throw new Error(detail || "Aspect change failed");
      }

      if (!data?.success || !data?.image) {
        throw new Error(data?.error || "No image returned");
      }

      const newMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: `Aspect changed to ${targetAspect} (extended ${direction})`,
        image: data.image,
        timestamp: new Date(),
        sourceMode: sourceMsg.sourceMode,
      };
      setMessages((prev) => [...prev, newMsg]);
      await saveGeneration("aspect", newMsg.text, data.image);
      queryClient.invalidateQueries({ queryKey: ["generation-balance", user?.id] });
      toast.success(`Aspect changed to ${targetAspect}`);
      setAspectMsgId(null);
    } catch (err: any) {
      console.error("Aspect change failed:", err);
      toast.error(err?.message || "Failed to change aspect");
    } finally {
      setAspectBusy(false);
      setProcessingMsgId(null);
    }
  };

  // ── Region redraw (Tier 1 refine · sub-feature A · inpainting) ────────────
  // Flow: overlay opens → user drags a rectangle over the image and types a
  // prompt → we build a same-size mask PNG (white=edit, black=preserve),
  // hand original + mask + prompt to the edge function, then composite the
  // AI response back onto the original with a small feather so pixels outside
  // the user's selection stay pixel-exact.
  const [regionMsgId, setRegionMsgId] = useState<string | null>(null);
  const [regionBusy, setRegionBusy] = useState(false);

  const handleRegionSubmit = async ({
    maskImage,
    box,
    prompt: regionPrompt,
  }: { maskImage: string; box: MaskBox; prompt: string }) => {
    if (!regionMsgId) return;
    const sourceMsg = messages.find((m) => m.id === regionMsgId);
    if (!sourceMsg?.image) {
      toast.error("Original image not found");
      return;
    }

    if (!usage?.isAdmin && balance && balance.total_available === 0) {
      setShowInsufficientCredits(true);
      return;
    }
    if (isGated()) return;

    setRegionBusy(true);
    setProcessingMsgId(regionMsgId);
    try {
      const { data, error } = await supabase.functions.invoke("refine-image", {
        body: {
          mode: "region",
          originalImage: sourceMsg.image,
          maskImage,
          regionPrompt,
        },
      });

      if (error) {
        let detail = error.message ?? "";
        let body: any = null;
        try {
          body = await (error as any).context?.json?.();
          if (body?.error) detail = body.error;
        } catch { /* ignore parse failures */ }

        if (detail === "INSUFFICIENT_CREDITS") {
          setShowInsufficientCredits(true);
          return;
        }
        if (detail === "WAITING_PERIOD") {
          openWaitingPeriodDialog(body?.unlock_at ?? null);
          return;
        }
        throw new Error(detail || "Region redraw failed");
      }

      if (!data?.success || !data?.image) {
        throw new Error(data?.error || "No image returned");
      }

      // Composite guard: for both rect and pen masks, use the actual mask PNG
      // to blend AI output onto the original. Pixels outside the mask stay
      // pixel-exact; feather softens the seam at the mask edge.
      const composited = await compositeWithMask(sourceMsg.image, data.image, maskImage, 3);
      void box; // box is available for future analytics / logging if needed

      const newMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: `Region redraw: "${regionPrompt}"`,
        image: composited,
        timestamp: new Date(),
        sourceMode: sourceMsg.sourceMode,
      };
      setMessages((prev) => [...prev, newMsg]);
      await saveGeneration("region", newMsg.text, composited);
      queryClient.invalidateQueries({ queryKey: ["generation-balance", user?.id] });
      toast.success("Region redrawn");
      setRegionMsgId(null);
    } catch (err: any) {
      console.error("Region redraw failed:", err);
      toast.error(err?.message || "Failed to redraw region");
    } finally {
      setRegionBusy(false);
      setProcessingMsgId(null);
    }
  };

  // ── Text edit (Tier 2 · figure-labels edit) ──────────────────────────────
  // Two-stage flow: detect-text on the source image (absorbed cost), then
  // route through refine-image mode=text-edit with a client-built rect mask
  // around the selected label. compositeWithMask preserves everything outside
  // the label bbox pixel-exact — the drift protection is the same as region.
  const [textEditMsgId, setTextEditMsgId] = useState<string | null>(null);
  const [textEditBusy, setTextEditBusy] = useState(false);

  const handleTextEditSubmit = async ({
    maskImage,
    box,
    oldText,
    newText,
    fontMeta,
  }: {
    maskImage: string;
    box: MaskBox;
    oldText: string;
    newText: string;
    fontMeta?: { family?: string; size?: number; bold?: boolean; color?: string };
  }) => {
    if (!textEditMsgId) return;
    const sourceMsg = messages.find((m) => m.id === textEditMsgId);
    if (!sourceMsg?.image) {
      toast.error("Original image not found");
      return;
    }
    if (!usage?.isAdmin && balance && balance.total_available === 0) {
      setShowInsufficientCredits(true);
      return;
    }
    if (isGated()) return;

    setTextEditBusy(true);
    setProcessingMsgId(textEditMsgId);
    try {
      // Pre-erase the label region with the sampled background color BEFORE
      // handing to Gemini. The image-preview model preserves existing content
      // by default when given a mask, so leaving the OLD text visible turns
      // "replace" into "keep as-is". Erasing turns the task into an
      // unambiguous "draw NEW here" — much more reliable.
      // The composite step downstream still uses the ORIGINAL (un-erased)
      // image outside the mask, so context around the box stays pixel-exact.
      const erasedImage = await eraseBoxToBackground(sourceMsg.image, box);

      const { data, error } = await supabase.functions.invoke("refine-image", {
        body: {
          mode: "text-edit",
          originalImage: erasedImage,
          maskImage,
          oldText,
          newText,
          fontMeta,
        },
      });

      if (error) {
        let detail = error.message ?? "";
        let eBody: any = null;
        try {
          eBody = await (error as any).context?.json?.();
          if (eBody?.error) detail = eBody.error;
        } catch { /* ignore */ }
        if (detail === "INSUFFICIENT_CREDITS") {
          setShowInsufficientCredits(true);
          return;
        }
        if (detail === "WAITING_PERIOD") {
          openWaitingPeriodDialog(eBody?.unlock_at ?? null);
          return;
        }
        throw new Error(detail || "Text edit failed");
      }
      if (!data?.success || !data?.image) {
        throw new Error(data?.error || "No image returned");
      }

      // Pixel-lock outside the label bbox — same compositor as region refine.
      const composited = await compositeWithMask(sourceMsg.image, data.image, maskImage, 3);
      void box; // available for future analytics

      const newMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: `Text edit: "${oldText}" → "${newText}"`,
        image: composited,
        timestamp: new Date(),
        sourceMode: sourceMsg.sourceMode,
      };
      setMessages((prev) => [...prev, newMsg]);
      await saveGeneration("text-edit", newMsg.text, composited);
      queryClient.invalidateQueries({ queryKey: ["generation-balance", user?.id] });
      toast.success("Text edited");
      setTextEditMsgId(null);
    } catch (err: any) {
      console.error("Text edit failed:", err);
      toast.error(err?.message || "Failed to edit text");
    } finally {
      setTextEditBusy(false);
      setProcessingMsgId(null);
    }
  };

  const rasterizeSvgToPng = async (svgString: string, maxDim: number = 1024): Promise<string | null> => {
    return new Promise((resolve) => {
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new window.Image();
      img.onload = () => {
        let w = img.naturalWidth || 800;
        let h = img.naturalHeight || 600;
        if (w > maxDim || h > maxDim) {
          const s = maxDim / Math.max(w, h);
          w = Math.round(w * s);
          h = Math.round(h * s);
        }
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  };

  /**
   * Download a raster illustration as a plain single-slide PowerPoint.
   * Just: image → slide at matched aspect → download. No OCR, no text
   * overlays, no credit charge. The image lands on the slide as pixels
   * and any editing happens in PowerPoint using standard tools.
   */
  const handleDownloadFigurePpt = async (
    imageDataUrl: string,
    msgId: string,
    promptHint?: string,
  ) => {
    setProcessingMsgId(msgId);
    try {
      const { buildFigurePptx } = await import("@/lib/figurePptx");
      const safeHint = (promptHint || "biosketch-figure")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 60);
      const filename = `${safeHint || "biosketch-figure"}.pptx`;
      await buildFigurePptx({ imageDataUrl, filename });
      toast.success(`Downloaded ${filename}`);
    } catch (err: any) {
      console.error("Figure PPT export failed:", err);
      toast.error(err?.message || "Could not export PowerPoint");
    } finally {
      setProcessingMsgId(null);
    }
  };

  /**
   * Download the assembled poster as an editable PowerPoint. Rebuilds from
   * the poster meta (plan + resolved figures + layout + preset), NOT from
   * the rendered SVG — that's what keeps text editable in PowerPoint /
   * Keynote / Google Slides. Uses dynamic import so pptxgenjs only loads
   * when the button is clicked.
   */
  const handleDownloadPoster = async (meta: NonNullable<ChatMessage["posterMeta"]>) => {
    try {
      const { buildPosterPptx } = await import("@/lib/posterPptx");
      const preset = getPresetById(meta.presetId);
      const fileName = await buildPosterPptx({
        plan: meta.plan,
        resolved: meta.resolved,
        preset,
        layout: meta.layout,
      });
      toast.success(`Downloaded ${fileName} — editable in PowerPoint`);
    } catch (err: any) {
      console.error("Poster PPT export failed:", err);
      toast.error(err?.message || "Could not export PowerPoint");
    }
  };

  const handleDownloadSvg = (svgString: string, filename: string = "biosketch-diagram.svg") => {
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDownloadSvgAsPng = async (svgString: string) => {
    const png = await rasterizeSvgToPng(svgString, 2048);
    if (!png) {
      toast.error("Failed to rasterize SVG");
      return;
    }
    const a = document.createElement("a");
    a.href = png;
    a.download = "biosketch-diagram.png";
    a.click();
  };

  const handleOpenSvgInCanvas = (svgString: string) => {
    try {
      sessionStorage.setItem("ai_illustrator_svg_import", svgString);
      window.location.href = "/canvas";
    } catch {
      toast.error("Failed to transfer to canvas");
    }
  };

  const handleDownloadPpt = async (msgId: string, imageUrl: string) => {
    setProcessingMsgId(msgId);
    try {
      const pptxgen = (await import("pptxgenjs")).default;
      const pres = new pptxgen();
      pres.layout = "LAYOUT_WIDE"; // 13.33" × 7.5", 16:9

      // Probe the image to keep aspect ratio when laying it onto the slide.
      const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => reject(new Error("Could not load image for PPT export"));
        img.src = imageUrl;
      });

      // Fit-contain inside a 12 × 6 in usable area, leaving a 0.66" margin.
      const slideW = 13.33;
      const slideH = 7.5;
      const maxW = 12;
      const maxH = 6;
      const ratio = dims.w / dims.h;
      let imgW = maxW;
      let imgH = imgW / ratio;
      if (imgH > maxH) {
        imgH = maxH;
        imgW = imgH * ratio;
      }
      const x = (slideW - imgW) / 2;
      const y = (slideH - imgH) / 2;

      const slide = pres.addSlide();
      slide.background = { color: "FFFFFF" };
      slide.addImage({ data: imageUrl, x, y, w: imgW, h: imgH });

      await pres.writeFile({ fileName: "biosketch-ai-illustration.pptx" });
      toast.success("PowerPoint downloaded");
    } catch (e) {
      console.error("PPT export error:", e);
      toast.error("Failed to export PowerPoint");
    }
    setProcessingMsgId(null);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    const reader = new FileReader();
    reader.onload = () => setUploadedImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  /**
   * Poster-from-Doc uploader. Runs the .docx through mammoth client-side to
   * pull text + embedded images. On success drops the parsed doc into state
   * — the send handler picks it up from there. Bounded at 8 MB so we don't
   * blow the tab's memory on giant manuscripts.
   */
  const handleDocFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".docx")) {
      toast.error("Only .docx files are supported for now.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("File too large — please keep it under 8 MB.");
      return;
    }
    setParsingDoc(true);
    try {
      const { extractDocx } = await import("@/lib/docxExtract");
      const doc = await extractDocx(file);
      if (doc.wordCount < 20 && doc.images.length === 0) {
        toast.error("The document appears empty — no text or images found.");
        return;
      }
      setUploadedDoc(doc);
      toast.success(`${file.name} extracted — ${doc.wordCount.toLocaleString()} words, ${doc.images.length} image${doc.images.length === 1 ? "" : "s"}`);
    } catch (err: any) {
      console.error("docx extract failed:", err);
      toast.error(err?.message || "Could not read this document.");
    } finally {
      setParsingDoc(false);
    }
  };

  // Most-recent assistant message that produced an image — used as the "canvas"
  // for multi-turn refinement (see `refineChat` toggle).
  const previousAssistantImage = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant" && m.image) return m.image;
    }
    return null;
  })();

  // Auto-suggest refine mode once the user has a figure to iterate on. We only
  // set the toggle ON on the transition (empty → has image) so a user who
  // explicitly clicks "start fresh" isn't overridden every render.
  useEffect(() => {
    if (previousAssistantImage && !refineChat) {
      setRefineChat(true);
    } else if (!previousAssistantImage && refineChat) {
      setRefineChat(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previousAssistantImage]);

  /**
   * Serialize the last N chat turns as short {role, text} objects for the edge
   * function's refine-chat path. Strips images and long metadata to keep the
   * Gemini payload small.
   */
  const buildRecentChatHistory = (
    prior: ChatMessage[],
    latestUser: ChatMessage,
    n = 8,
  ): { role: "user" | "assistant"; text: string }[] => {
    const all = [...prior, latestUser];
    return all
      .slice(-n)
      .map((m) => ({
        role: m.role,
        text: (m.text || "").substring(0, 400),
      }))
      .filter((t) => t.text.length > 0);
  };

  const clearConversation = () => {
    setMessages([]);
    setRefineChat(false);
    setPrompt("");
    setUploadedImage(null);
  };

  /**
   * FigureLabs-style planned refinement. Runs when the user has the "Refining
   * last figure" toggle ON and there's a prior assistant image to edit.
   *
   *   1. Insert a "planning…" bubble.
   *   2. Call refine-plan (gemini-2.5-flash, free) → {scope, region, changeSummary, preserve}.
   *   3. Swap the planning bubble for a plan card.
   *   4. Route:
   *      - local  → auto-build rect mask from the normalized region → refine-image
   *                 mode=region → compositeWithMask (pixel-exact preservation
   *                 outside the mask, hard guarantee against Gemini drift).
   *      - global → ai-illustrator refineChat with the planner's `preserve`
   *                 injected as a MUST PRESERVE block in the system prompt.
   *      - fresh  → ai-illustrator normal generate (user pivoted to a new subject).
   *
   * Runs on the main handleSend timeline (setIsGenerating already flipped),
   * so it just returns; the caller handles the finally block.
   */
  const runPlannedRefine = async (userMsg: ChatMessage, sourceImage: string) => {
    const planningId = `planning-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: planningId,
        role: "assistant",
        text: "Analyzing your request…",
        kind: "planning",
        timestamp: new Date(),
      },
    ]);

    // Planner call. On any failure we fall back to a safe global plan so the
    // user still gets a refined image instead of a hard error.
    type PlanRegion = { x0: number; y0: number; x1: number; y1: number };
    type Plan = {
      scope: "local" | "global" | "fresh";
      region: PlanRegion | null;
      changeSummary: string;
      preserve: string;
      reasoning: string;
    };
    let plan: Plan;
    try {
      const { data, error } = await supabase.functions.invoke("refine-plan", {
        body: {
          previousImage: sourceImage,
          prompt: userMsg.text,
          chatHistory: buildRecentChatHistory(messages, userMsg, 6),
        },
      });
      if (error) throw error;
      if (!data?.success || !data?.plan) throw new Error(data?.error || "Planner failed");
      plan = data.plan as Plan;
    } catch (err) {
      console.warn("[refine-plan] failed, falling back to global refine:", err);
      plan = {
        scope: "global",
        region: null,
        changeSummary: userMsg.text,
        preserve: "The overall composition and subject of the figure.",
        reasoning: "Planner unavailable; using global refine.",
      };
    }

    // Replace the planning bubble with the resolved plan card.
    setMessages((prev) =>
      prev.map((m) =>
        m.id === planningId
          ? {
              ...m,
              kind: "plan" as const,
              planScope: plan.scope,
              planChange: plan.changeSummary,
              planPreserve: plan.preserve,
              text: plan.changeSummary,
            }
          : m,
      ),
    );

    const labelRequiredMode = ["flowchart", "protocol", "timeline"].includes(activeMode);

    // ── Route by scope ─────────────────────────────────────────────────────
    if (plan.scope === "local" && plan.region) {
      // Auto-mask + inpaint. compositeWithMask guarantees pixel-exact preservation
      // outside the bbox regardless of what Gemini returns.
      const box = await regionFromNormalized(sourceImage, plan.region);
      const maskImage = await buildRectMaskPng(sourceImage, box);
      const { data, error } = await supabase.functions.invoke("refine-image", {
        body: {
          mode: "region",
          originalImage: sourceImage,
          maskImage,
          regionPrompt: plan.changeSummary || userMsg.text,
        },
      });
      if (error) throw error;
      if (!data?.success || !data?.image) throw new Error(data?.error || "Refine failed");

      const composited = await compositeWithMask(sourceImage, data.image, maskImage, 3);
      const newMsg: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        text: "Refined figure  ·  Local edit",
        image: composited,
        timestamp: new Date(),
        sourceMode: activeMode,
      };
      setMessages((prev) => [...prev, newMsg]);
      await saveGeneration("refine-local", plan.changeSummary || userMsg.text, composited);
      queryClient.invalidateQueries({ queryKey: ["generation-balance", user?.id] });
      return;
    }

    if (plan.scope === "global") {
      const { data, error } = await supabase.functions.invoke("ai-illustrator", {
        body: {
          prompt: userMsg.text,
          mode: activeMode,
          refineChat: true,
          previousImage: sourceImage,
          chatHistory: buildRecentChatHistory(messages, userMsg, 8),
          preserveContext: plan.preserve || undefined,
          excludeText: labelRequiredMode ? false : excludeText,
          stylePreset: stylePresetId !== DEFAULT_AI_ILLUSTRATOR_PRESET_ID ? stylePresetId : undefined,
          iconStyle: STYLE_PICKER_MODES.includes(activeMode) ? iconStyle : undefined,
          higherQuality: higherQuality || undefined,
          transparentBackground: activeMode === "icon-generator" && transparentBackground ? true : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.success || !data?.image) throw new Error("No image returned");

      const activePreset = getPresetById(stylePresetId);
      const styleSuffix =
        activePreset && activePreset.id !== DEFAULT_AI_ILLUSTRATOR_PRESET_ID
          ? `  ·  ${activePreset.name} style`
          : "";
      const newMsg: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        text: "Refined figure  ·  Global edit" + styleSuffix,
        image: data.image,
        timestamp: new Date(),
        sourceMode: activeMode,
      };
      setMessages((prev) => [...prev, newMsg]);
      await saveGeneration("refine-global", plan.changeSummary || userMsg.text, data.image);
      queryClient.invalidateQueries({ queryKey: ["generation-balance", user?.id] });
      return;
    }

    // scope === "fresh" — user pivoted to a new subject. Skip refine entirely
    // and run a normal generate so we don't fight the previous image's shape.
    const { data, error } = await supabase.functions.invoke("ai-illustrator", {
      body: {
        prompt: userMsg.text,
        mode: activeMode,
        excludeText: labelRequiredMode ? false : excludeText,
        size: NO_SIZE_MODES.includes(activeMode) ? undefined : size,
        stylePreset: stylePresetId !== DEFAULT_AI_ILLUSTRATOR_PRESET_ID ? stylePresetId : undefined,
        iconStyle: STYLE_PICKER_MODES.includes(activeMode) ? iconStyle : undefined,
        higherQuality: higherQuality || undefined,
        transparentBackground: activeMode === "icon-generator" && transparentBackground ? true : undefined,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    if (!data?.success || !(data?.image || data?.svg)) throw new Error("No content returned");

    const newMsg: ChatMessage = {
      id: (Date.now() + 2).toString(),
      role: "assistant",
      text: "Here's the new figure:",
      image: data.image,
      svg: data.svg,
      timestamp: new Date(),
      sourceMode: activeMode,
    };
    setMessages((prev) => [...prev, newMsg]);
    if (data.image) await saveGeneration("refine-fresh", userMsg.text, data.image);
    queryClient.invalidateQueries({ queryKey: ["generation-balance", user?.id] });
  };

  /**
   * Two-pass abstract-to-figure. Invokes the abstract-to-figure edge function
   * which runs (analyzer → drawer) server-side and returns {plan, image}. When
   * called with `existingPlan`, the analyzer pass is skipped and the user is
   * only charged 1 credit — that's the "Regenerate from plan" flow.
   *
   * On the timeline this drops:
   *   1. planning bubble  ("Extracting figure plan…" / "Regenerating from plan…")
   *   2. plan card        (SCIENCE PLAN badge + subject/components/layout)
   *   3. image bubble     (final figure + normal Refine/Recolor/etc. actions)
   */
  const runAbstractToFigure = async (
    abstract: string,
    opts?: { existingPlan?: NonNullable<ChatMessage["figurePlan"]> },
  ) => {
    const planningId = `figure-planning-${Date.now()}`;
    const isRegen = !!opts?.existingPlan;
    setMessages((prev) => [
      ...prev,
      {
        id: planningId,
        role: "assistant",
        text: isRegen ? "Regenerating from plan…" : "Extracting figure plan and drawing…",
        kind: "figure-planning",
        timestamp: new Date(),
      },
    ]);

    try {
      const { data, error } = await supabase.functions.invoke("abstract-to-figure", {
        body: {
          abstract,
          existingPlan: opts?.existingPlan,
          stylePreset:
            stylePresetId !== DEFAULT_AI_ILLUSTRATOR_PRESET_ID ? stylePresetId : undefined,
          iconStyle: STYLE_PICKER_MODES.includes(activeMode) ? iconStyle : undefined,
        },
      });
      if (error) {
        // Edge function returned a non-2xx — surface INSUFFICIENT_CREDITS via
        // the standard dialog, otherwise throw for the outer catch.
        let detail = error.message ?? "";
        let eBody: any = null;
        try {
          eBody = await (error as any).context?.json?.();
          if (eBody?.error) detail = eBody.error;
        } catch { /* ignore */ }
        if (detail === "INSUFFICIENT_CREDITS" || detail === "INSUFFICIENT_CREDITS_FOR_DRAW") {
          setShowInsufficientCredits(true);
          // Drop the planning bubble — we didn't produce anything.
          setMessages((prev) => prev.filter((m) => m.id !== planningId));
          return;
        }
        if (detail === "WAITING_PERIOD") {
          openWaitingPeriodDialog(eBody?.unlock_at ?? null);
          setMessages((prev) => prev.filter((m) => m.id !== planningId));
          return;
        }
        throw new Error(detail || "Abstract-to-figure failed");
      }
      if (!data?.success) {
        throw new Error(data?.error || "Abstract-to-figure failed");
      }
      const plan = data.plan as NonNullable<ChatMessage["figurePlan"]>;
      const image = data.image as string;
      if (!plan || !image) throw new Error("Missing plan or image in response");

      const activePreset = getPresetById(stylePresetId);
      const styleSuffix =
        activePreset && activePreset.id !== DEFAULT_AI_ILLUSTRATOR_PRESET_ID
          ? `  ·  ${activePreset.name} style`
          : "";

      // Replace the planning bubble with the plan card, then append the image
      // as a separate assistant message so it inherits the standard image
      // action bar (Refine, Recolor, Aspect, Region, Remove BG, Upscale…).
      setMessages((prev) => {
        const swapped = prev.map((m) =>
          m.id === planningId
            ? {
                ...m,
                kind: "figure-plan" as const,
                figurePlan: plan,
                sourceAbstract: abstract,
                text: plan.subject,
              }
            : m,
        );
        return [
          ...swapped,
          {
            id: (Date.now() + 2).toString(),
            role: "assistant" as const,
            text: (isRegen ? "Figure (regenerated from plan)" : "Here's your figure from the abstract") + styleSuffix,
            image,
            timestamp: new Date(),
          },
        ];
      });

      await saveGeneration("abstract-to-figure", plan.subject, image);
      queryClient.invalidateQueries({ queryKey: ["generation-balance", user?.id] });
    } catch (err: any) {
      console.error("Abstract-to-figure failed:", err);
      // Remove the planning bubble on failure so the chat doesn't hang on a spinner.
      setMessages((prev) => prev.filter((m) => m.id !== planningId));
      const msg = err?.message?.includes("RATE_LIMITED")
        ? "Rate limited — please wait a moment and try again."
        : err?.message || "Failed to generate figure from abstract.";
      toast.error(msg);
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 3).toString(), role: "assistant", text: msg, timestamp: new Date() },
      ]);
    }
  };

  /**
   * Poster-from-Doc Stage 2 — planner call. Runs after the extracted-doc
   * card is on-screen. Adds a spinner card while flash chews on the text,
   * then swaps it for the poster-plan card with the credit disclosure.
   * Errors clean up the spinner and toast — the extracted card stays so
   * the user can re-send if they want to retry.
   */
  const runPosterPlan = async (
    notes: string,
    doc: import("@/lib/docxExtract").ExtractedDoc,
  ) => {
    const planningId = `poster-planning-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: planningId,
        role: "assistant",
        text: "Planning your poster…",
        kind: "poster-planning",
        timestamp: new Date(),
      },
    ]);
    try {
      const { data, error } = await supabase.functions.invoke("poster-plan", {
        body: {
          text: doc.text,
          sections: doc.sections,
          imageCount: doc.images.length,
          // The user text (if any) becomes optional layout guidance — pass it
          // through so users can nudge the plan with e.g. "emphasize Results".
          notes: notes && notes !== `[${activeFeature.name}]` ? notes : "",
          // When embeddedOnly is on the planner is forbidden from proposing
          // AI-generated figures — every entry in `figures` will be reused
          // from the doc, and Stage 3 spends 0 credits on figure generation.
          embeddedOnly: posterEmbeddedOnly,
        },
      });
      if (error) {
        let detail = error.message ?? "";
        let eBody: any = null;
        try {
          eBody = await (error as any).context?.json?.();
          if (eBody?.error) detail = eBody.error;
        } catch { /* ignore */ }
        if (detail === "INSUFFICIENT_CREDITS") {
          setShowInsufficientCredits(true);
          setMessages((prev) => prev.filter((m) => m.id !== planningId));
          return;
        }
        if (detail === "WAITING_PERIOD") {
          openWaitingPeriodDialog(eBody?.unlock_at ?? null);
          setMessages((prev) => prev.filter((m) => m.id !== planningId));
          return;
        }
        throw new Error(detail || "Planner failed");
      }
      if (!data?.success || !data?.plan) {
        throw new Error(data?.error || "Planner returned no plan");
      }
      const plan = data.plan as PosterPlanData;
      // Snapshot the embedded image data URLs onto the plan message so Stage
      // 3's Generate button still works if the user clears the dropzone
      // between plan and generation.
      const embeddedSnapshot = doc.images.map((im) => im.dataUrl);
      // Replace the spinner with the resolved plan card.
      setMessages((prev) =>
        prev.map((m) =>
          m.id === planningId
            ? {
                ...m,
                kind: "poster-plan" as const,
                text: plan.title,
                posterPlan: plan,
                posterEmbeddedImages: embeddedSnapshot,
              }
            : m,
        ),
      );
      queryClient.invalidateQueries({ queryKey: ["generation-balance", user?.id] });
    } catch (err: any) {
      console.error("Poster planner failed:", err);
      setMessages((prev) => prev.filter((m) => m.id !== planningId));
      const msg = err?.message?.includes("RATE_LIMITED")
        ? "Rate limited — please wait a moment and try again."
        : err?.message || "Failed to plan poster.";
      toast.error(msg);
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 3).toString(), role: "assistant", text: msg, timestamp: new Date() },
      ]);
    }
  };

  /**
   * Poster-from-Doc Stage 3 — figure generation. Loops the plan's figures
   * in order, calls ai-illustrator text-to-figure for each `source: "generate"`
   * (1 credit per, with auto-refund on failure inside the edge fn), and
   * pipes each embedded figure straight through from the snapshot.
   *
   * Progress is surfaced as a single "poster-drawing" card that updates
   * its posterProgress counter after each call. On completion we swap it
   * for a "poster-figures" card holding the ordered resolved figures.
   *
   * Failure policy: individual generate calls that fail are marked failed
   * and skipped. If more than 2 fail in a row we bail so the user isn't
   * charged for a fully-broken run.
   */
  const runPosterGenerateFigures = async (
    plan: PosterPlanData,
    embeddedImages: string[],
  ) => {
    if (!user) {
      setShowSignUpModal(true);
      return;
    }
    const toGenerate = plan.figures.filter((f) => f.source === "generate").length;
    // Pre-flight credit check — cover the whole batch, not just the first call.
    if (!isAdmin && balance && balance.total_available < toGenerate) {
      setShowInsufficientCredits(true);
      return;
    }
    if (isGated()) return;

    const drawingId = `poster-drawing-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: drawingId,
        role: "assistant",
        text: "Drawing figures…",
        kind: "poster-drawing",
        posterProgress: { done: 0, total: plan.figures.length },
        timestamp: new Date(),
      },
    ]);

    const resolved: NonNullable<ChatMessage["posterFigures"]>["resolved"] = [];
    let consecutiveFailures = 0;

    for (let i = 0; i < plan.figures.length; i++) {
      const fig = plan.figures[i];
      // Push progress up before the async call so the counter reads correctly.
      setMessages((prev) =>
        prev.map((m) =>
          m.id === drawingId
            ? { ...m, posterProgress: { done: i, total: plan.figures.length } }
            : m,
        ),
      );

      if (fig.source === "embedded") {
        const idx = fig.embeddedIndex ?? 0;
        const src = embeddedImages[idx];
        if (!src) {
          resolved.push({
            caption: fig.caption,
            source: "embedded",
            imageDataUrl: "",
            failed: true,
          });
          continue;
        }
        resolved.push({
          caption: fig.caption,
          source: "embedded",
          imageDataUrl: src,
        });
        consecutiveFailures = 0;
        continue;
      }

      // source === "generate" → 1 credit via ai-illustrator text-to-figure.
      try {
        const { data, error } = await supabase.functions.invoke("ai-illustrator", {
          body: {
            prompt: fig.generatePrompt || fig.caption,
            mode: "text-to-figure",
            excludeText: true,
            size: "4:3",
            stylePreset:
              stylePresetId !== DEFAULT_AI_ILLUSTRATOR_PRESET_ID ? stylePresetId : undefined,
          },
        });
        if (error) {
          let detail = error.message ?? "";
          let eBody: any = null;
          try {
            eBody = await (error as any).context?.json?.();
            if (eBody?.error) detail = eBody.error;
          } catch { /* ignore */ }
          if (detail === "INSUFFICIENT_CREDITS") {
            setShowInsufficientCredits(true);
            // Stop the whole run — nothing else will succeed.
            setMessages((prev) => prev.filter((m) => m.id !== drawingId));
            return;
          }
          if (detail === "WAITING_PERIOD") {
            openWaitingPeriodDialog(eBody?.unlock_at ?? null);
            setMessages((prev) => prev.filter((m) => m.id !== drawingId));
            return;
          }
          throw new Error(detail || "Figure generation failed");
        }
        if (!data?.success || !data?.image) {
          throw new Error(data?.error || "No image returned");
        }
        resolved.push({
          caption: fig.caption,
          source: "generate",
          imageDataUrl: data.image,
        });
        consecutiveFailures = 0;
      } catch (err: any) {
        console.error(`Poster figure ${i + 1} failed:`, err);
        resolved.push({
          caption: fig.caption,
          source: "generate",
          imageDataUrl: "",
          failed: true,
        });
        consecutiveFailures += 1;
        if (consecutiveFailures > 2) {
          toast.error("Multiple figures failed — stopping. Refunded credits.");
          break;
        }
      }
    }

    queryClient.invalidateQueries({ queryKey: ["generation-balance", user?.id] });

    // Replace the progress card with the results card.
    setMessages((prev) =>
      prev.map((m) =>
        m.id === drawingId
          ? {
              ...m,
              kind: "poster-figures" as const,
              text: `Figures ready — ${resolved.filter((r) => !r.failed).length} of ${plan.figures.length} drawn`,
              posterFigures: { plan, resolved },
              posterProgress: undefined,
            }
          : m,
      ),
    );
  };

  /**
   * Poster-from-Doc Stage 4 — SVG assembly. Composes the landscape A0
   * poster from the plan + resolved figures using the active journal
   * preset's palette. No AI, no credit — pure client-side rendering.
   * The output is emitted as a normal assistant SVG message, which
   * inherits the existing "Open in Canvas / Download SVG / Download PNG"
   * action bar.
   */
  const runPosterAssemble = async (
    pf: NonNullable<ChatMessage["posterFigures"]>,
  ) => {
    try {
      const preset = getPresetById(stylePresetId);
      const svg = buildPosterSvg({
        plan: pf.plan,
        resolved: pf.resolved,
        preset,
        layout: posterLayout,
      });
      const layoutName = POSTER_LAYOUTS.find((l) => l.id === posterLayout)?.name ?? "Classic Bold";
      const newMsg: ChatMessage = {
        id: (Date.now() + 4).toString(),
        role: "assistant",
        text: `Poster assembled: ${pf.plan.title} · ${layoutName}`,
        svg,
        posterMeta: {
          plan: pf.plan,
          resolved: pf.resolved,
          layout: posterLayout,
          presetId: stylePresetId,
        },
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, newMsg]);
      // Persist a rasterized copy so History has a preview.
      rasterizeSvgToPng(svg, 1600).then((png) => {
        if (png) void saveGeneration("poster", `${pf.plan.title} (${layoutName})`, png);
      });
      toast.success(`Poster assembled — ${layoutName}`);
    } catch (err: any) {
      console.error("Poster assemble failed:", err);
      toast.error(err?.message || "Failed to assemble poster");
    }
  };

  const handleSend = async () => {
    if (!prompt.trim() && !uploadedImage) return;
    if (activeFeature.requiresImage && !uploadedImage) {
      toast.error(`${activeFeature.name} requires an image upload`);
      return;
    }
    const userMsg: ChatMessage = {
      id: Date.now().toString(), role: "user",
      text: prompt.trim() || `[${activeFeature.name}]`,
      image: uploadedImage || undefined, timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setPrompt(""); setUploadedImage(null);

    if (!user) {
      setShowSignUpModal(true);
      return;
    }
    // Out-of-generations pre-check — authoritative source is the new balance
    // (grant + purchased). Open the buy/share dialog if truly empty.
    if (!isAdmin && balance && balance.total_available === 0) {
      setShowInsufficientCredits(true);
      return;
    }
    if (isGated()) return;

    // Poster-from-Doc (Stages 1 + 2) — Stage 1 shows the extracted-doc card
    // as a sanity check, then Stage 2 spends 1 credit to draft the poster
    // plan via the poster-plan edge fn. Stage 3 (figure generation) will
    // fire from a button on the resulting plan card, not from send.
    if (activeMode === "poster-from-doc") {
      if (!uploadedDoc) {
        toast.error("Upload a .docx file first.");
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        setPrompt(userMsg.text === `[${activeFeature.name}]` ? "" : userMsg.text);
        return;
      }
      // Stage 1 card — always shown.
      const extractedCard: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: `Document extracted from ${uploadedDoc.fileName}`,
        kind: "doc-extracted",
        extractedDoc: {
          fileName: uploadedDoc.fileName,
          wordCount: uploadedDoc.wordCount,
          sections: uploadedDoc.sections,
          imageCount: uploadedDoc.images.length,
          warnings: uploadedDoc.warnings,
        },
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, extractedCard]);
      // Chain into Stage 2 — planner. Kick off async, chat updates when it lands.
      void runPosterPlan(userMsg.text, uploadedDoc);
      return;
    }

    setIsGenerating(true);

    // Abstract-to-figure (two-pass, 2 credits) — handled by its own edge
    // function. Runs before the refineChat branch so a fresh abstract paste
    // always goes through the analyze+draw pipeline instead of being treated
    // as a chat follow-up on a previous image.
    if (activeMode === "abstract-to-figure") {
      try {
        await runAbstractToFigure(userMsg.text);
      } catch (e) {
        console.error("Abstract-to-figure branch failed:", e);
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    // FigureLabs-style planned refinement branch. When the toggle is on and we
    // have a prior assistant image, defer to the planner + router. Falls through
    // to the normal generate path on any failure so the user never gets stuck.
    if (refineChat && previousAssistantImage) {
      try {
        await runPlannedRefine(userMsg, previousAssistantImage);
        return;
      } catch (e: any) {
        if (await handleInvokeError(e)) return;
        console.error("Planned refine failed:", e);
        if (e.message?.includes("INSUFFICIENT_CREDITS")) {
          setShowInsufficientCredits(true);
          queryClient.invalidateQueries({ queryKey: ["generation-balance", user?.id] });
        } else {
          const errMsg = e.message?.includes("RATE_LIMITED")
            ? "Rate limited — please wait a moment and try again."
            : e.message || "Refine failed. Please try again.";
          setMessages((prev) => [
            ...prev,
            { id: (Date.now() + 1).toString(), role: "assistant", text: errMsg, timestamp: new Date() },
          ]);
          toast.error(errMsg);
        }
        return;
      } finally {
        setIsGenerating(false);
      }
    }

    try {
      const resizeForAPI = (dataUrl: string, maxDim: number = 512): Promise<string> => {
        return new Promise((resolve) => {
          const img = new window.Image();
          img.onload = () => {
            let w = img.naturalWidth, h = img.naturalHeight;
            if (w > maxDim || h > maxDim) {
              const scale = maxDim / Math.max(w, h);
              w = Math.round(w * scale); h = Math.round(h * scale);
            }
            const c = document.createElement("canvas");
            c.width = w; c.height = h;
            const ctx = c.getContext("2d")!;
            ctx.drawImage(img, 0, 0, w, h);
            resolve(c.toDataURL("image/png"));
          };
          img.onerror = () => resolve("");
          img.src = dataUrl;
        });
      };

      // Reference-Guide-style modes match the canvas page's AI Reference Guide
      // pipeline: a fresh single-pass call with only the user's prompt (and the
      // user-uploaded image if any). Do NOT auto-inject prior assistant images
      // — that flips every follow-up into the heavier multi-pass edit path.
      const referenceGuideStyleMode = [
        "icon-generator",
        "text-to-figure",
        "sketch-to-illustration",
        "image-to-figure",
      ].includes(activeMode);

      const lastAssistantImage = referenceGuideStyleMode
        ? undefined
        : [...messages].reverse().find(m => m.role === "assistant" && m.image)?.image;

      let refImage = userMsg.image || lastAssistantImage;
      let resizedRef: string | undefined;
      if (refImage) {
        // Higher cap (1024) for ref-guide modes preserves detail; legacy modes keep 512.
        resizedRef = await resizeForAPI(refImage, referenceGuideStyleMode ? 1024 : 512);
        if (!resizedRef) resizedRef = undefined;
      }

      const labelRequiredMode = ["flowchart", "protocol", "timeline"].includes(activeMode);

      const { data, error } = await supabase.functions.invoke("ai-illustrator", {
        body: {
          prompt: userMsg.text,
          mode: activeMode,
          referenceImage: resizedRef || undefined,
          excludeText: labelRequiredMode ? false : excludeText,
          size: NO_SIZE_MODES.includes(activeMode) ? undefined : size,
          stylePreset: stylePresetId !== DEFAULT_AI_ILLUSTRATOR_PRESET_ID ? stylePresetId : undefined,
          iconStyle: STYLE_PICKER_MODES.includes(activeMode) ? iconStyle : undefined,
          higherQuality: higherQuality || undefined,
          transparentBackground: activeMode === "icon-generator" && transparentBackground ? true : undefined,
          // Multi-turn refinement: when the toggle is ON AND we have a prior
          // assistant image, send the edge function the previous image + the
          // recent conversation so it edits with context instead of regenerating.
          ...(refineChat && previousAssistantImage
            ? {
                refineChat: true,
                previousImage: previousAssistantImage,
                chatHistory: buildRecentChatHistory(messages, userMsg, 8),
              }
            : {}),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      // Refresh the generation-balance pill immediately after a successful call.
      queryClient.invalidateQueries({ queryKey: ['generation-balance', user?.id] });

      console.log('[ai-illustrator] response:', { hasSvg: !!data?.svg, hasImage: !!data?.image, mode: data?.mode || activeMode, svgLength: data?.svg?.length });
      if (data?.success && (data?.image || data?.svg)) {
        const responseText = activeMode === "flowchart"
          ? "Here's your flowchart draft (editable vector):"
          : activeMode === "protocol"
          ? "Here's your protocol draft (editable vector):"
          : activeMode === "timeline"
          ? "Here's your timeline draft (editable vector):"
          : activeMode === "photo-to-2d"
          ? "Here's your 2D illustration:"
          : activeMode === "sketch-to-illustration"
          ? "Here's your illustration from the sketch:"
          : activeMode === "text-to-figure"
          ? "Here's your scientific figure:"
          : activeMode === "image-to-figure"
          ? "Here's your publication figure:"
          : activeMode === "illustration-enhancer"
          ? "Here's your enhanced HD illustration:"
          : activeMode === "ref-to-figure"
          ? "Here's your 2D vector-style figure:"
          : "Here's your generated icon:";
        // Suffix the message with the preset name so users see which style
        // the output was tuned to. Skipped when the default preset is active.
        const activePreset = getPresetById(stylePresetId);
        const isRefineTurn = refineChat && !!previousAssistantImage;
        const styledResponseText =
          (isRefineTurn ? "Refined figure:" : responseText) +
          (activePreset && activePreset.id !== DEFAULT_AI_ILLUSTRATOR_PRESET_ID
            ? `  ·  ${activePreset.name} style`
            : "");
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(), role: "assistant",
          text: styledResponseText,
          image: data.image,
          svg: data.svg,
          timestamp: new Date(),
          sourceMode: activeMode,
        }]);
        refetchUsage();
        if (data.image) {
          saveGeneration(activeMode, userMsg.text, data.image);
        } else if (data.svg) {
          // Rasterize SVG to a 1024 px PNG for history (saveGeneration caps
          // again at 1024 — kept identical here so the SVG rasterizer doesn't
          // pre-downsample below the storage target and lose crispness).
          rasterizeSvgToPng(data.svg, 1024).then((png) => {
            if (png) saveGeneration(activeMode, userMsg.text, png);
          });
        }
      } else {
        throw new Error("No content returned");
      }
    } catch (e: any) {
      if (await handleInvokeError(e)) return;
      console.error("AI generation error:", e);
      // Out-of-credits → open buy/share dialog rather than surfacing a raw error.
      if (e.message?.includes("INSUFFICIENT_CREDITS")) {
        setShowInsufficientCredits(true);
        queryClient.invalidateQueries({ queryKey: ['generation-balance', user?.id] });
      } else {
        const errMsg = e.message?.includes("RATE_LIMITED")
          ? "Rate limited — please wait a moment and try again."
          : e.message?.includes("QUOTA_EXCEEDED")
          ? "Monthly AI generation limit reached. Share more projects to earn credits."
          : e.message || "Failed to generate. Please try again.";
        refetchUsage();
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(), role: "assistant",
          text: errMsg, timestamp: new Date(),
        }]);
        toast.error(errMsg);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(suggestion);
  };

  // Load a full starter example: selects the correct mode AND drops the
  // verbatim prompt into the input in one click. Used on the empty state
  // so a first-time user's first generation runs on a known-good prompt
  // instead of the "what do I even type?" cliff.
  const handleStarterClick = (ex: StarterExample) => {
    setActiveMode(ex.mode);
    setPrompt(ex.prompt);
    setUploadedImage(null);
    // Nudge the focus to the input so hitting Enter fires immediately.
    setTimeout(() => {
      const ta = document.querySelector<HTMLTextAreaElement>('textarea[placeholder]');
      ta?.focus();
    }, 0);
  };

  // ── Greeting helpers ──
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12 ? "Good morning" : currentHour < 18 ? "Good afternoon" : "Good evening";

  const userName =
    user?.user_metadata?.full_name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "Scientist";

  const MODE_GROUPS: { label: string; ids: AIMode[] }[] = [
    { label: "Diagrams", ids: ["flowchart", "protocol", "timeline"] },
    { label: "From text", ids: ["icon-generator", "text-to-figure", "abstract-to-figure", "poster-from-doc"] },
    { label: "From image", ids: ["photo-to-2d", "sketch-to-illustration", "ref-to-figure", "illustration-enhancer", "image-to-figure"] },
  ];

  const renderModeChip = (f: AIFeature) => {
    const isActive = activeMode === f.id;
    return (
      <div
        key={f.id}
        className={`inline-flex items-stretch rounded-full border transition-all ${
          isActive
            ? "bg-primary/10 text-primary border-primary/30 shadow-sm"
            : "bg-white/70 backdrop-blur-sm text-slate-600 border-slate-200/80 hover:bg-white hover:border-slate-300 hover:text-slate-900"
        }`}
      >
        <button
          role="radio"
          aria-checked={isActive}
          onClick={() => setActiveMode(f.id)}
          title={f.description}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          type="button"
        >
          <span className={isActive ? "text-primary" : "text-slate-400"}>{f.icon}</span>
          {f.shortName}
          {(f.costCredits ?? 1) > 1 && (
            <span
              className="ml-0.5 inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-bold tracking-wide bg-amber-100 text-amber-700"
              title={`${f.costCredits} credits`}
            >
              {f.costCredits}c
            </span>
          )}
        </button>
      </div>
    );
  };

  const modePicker = (
    <div className="w-full max-w-6xl mx-auto mb-2 space-y-1.5" role="radiogroup" aria-label="AI mode">
      {MODE_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
          <span className="text-xs font-bold text-slate-400 shrink-0 mr-1">
            {group.label}
          </span>
          {group.ids
            .map((id) => AI_FEATURES.find((f) => f.id === id))
            .filter((f): f is AIFeature => Boolean(f))
            .map(renderModeChip)}
        </div>
      ))}
    </div>
  );

  // Journal-style preset picker — compact color-swatch chip that opens a
  // popover with all preset options. This replaces the old horizontal strip
  // of 7 buttons; users only see the current selection, and the choices
  // reveal on click (same pattern users know from color pickers).
  const activePreset = getPresetById(stylePresetId) ?? AI_ILLUSTRATOR_PRESETS[0];
  const presetPickerInline = (
    <>
      <Popover open={presetOpen} onOpenChange={setPresetOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Journal style: ${activePreset.name}`}
            title={`Journal style: ${activePreset.name}`}
            className={`inline-flex items-center gap-1 h-8 rounded-xl px-2.5 transition-colors text-xs ${
              presetOpen
                ? "bg-slate-100 text-slate-900"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <span className="flex items-center gap-0 rounded-full overflow-hidden ring-1 ring-white/70">
              {activePreset.palette.map((c, i) => (
                <span key={i} className="h-2.5 w-1.5" style={{ background: c }} />
              ))}
            </span>
            <span className="font-medium whitespace-nowrap">{activePreset.name}</span>
            <ChevronDown className={`w-3 h-3 opacity-75 transition-transform ${presetOpen ? "rotate-180" : ""}`} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="top"
          sideOffset={8}
          className="w-72 p-2 rounded-xl border border-slate-200 shadow-lg bg-white"
        >
          <div className="mb-1.5 px-1.5 py-1">
            <div className="text-xs font-bold text-slate-400">
              Journal style
            </div>
            <div className="text-xs text-slate-500 leading-relaxed">
              Applied as a palette + typography hint on the next generation.
            </div>
          </div>
          <div role="radiogroup" aria-label="Style preset" className="grid gap-0.5">
            {AI_ILLUSTRATOR_PRESETS.map((p) => {
              const isActive = stylePresetId === p.id;
              return (
                <button
                  key={p.id}
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => {
                    setStylePresetId(p.id);
                    setPresetOpen(false);
                  }}
                  title={p.description}
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors ${
                    isActive ? "bg-primary/8" : "hover:bg-slate-50"
                  }`}
                  type="button"
                >
                  <span className="flex items-center gap-0 rounded-full overflow-hidden ring-1 ring-white/70 shrink-0">
                    {p.palette.map((c, i) => (
                      <span key={i} className="h-4 w-2.5" style={{ background: c }} />
                    ))}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] font-semibold text-slate-800 leading-tight">
                      {p.name}
                    </span>
                    <span className="block text-xs text-slate-500 leading-tight truncate">
                      {p.description}
                    </span>
                  </span>
                  {isActive && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );

  const sizeSelectorInline = !NO_SIZE_MODES.includes(activeMode) ? (
    <Popover open={sizeOpen} onOpenChange={setSizeOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Size: ${size}`}
          title={`Size: ${size}`}
          className={`inline-flex items-center gap-1 h-8 rounded-xl px-2.5 transition-colors text-xs ${
            sizeOpen
              ? "bg-slate-100 text-slate-900"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Ratio className="w-3.5 h-3.5" />
          <span className="font-medium whitespace-nowrap">{size}</span>
          <ChevronDown className={`w-3 h-3 opacity-75 transition-transform ${sizeOpen ? "rotate-180" : ""}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" sideOffset={8} className="w-[220px] p-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl">
        <div role="radiogroup" aria-label="Output size" className="flex flex-col">
          {SIZE_OPTIONS.map((s) => {
            const [rw, rh] = s.id.split(":").map(Number);
            const maxDim = 14;
            const scale = maxDim / Math.max(rw, rh);
            const iw = rw * scale;
            const ih = rh * scale;
            const isActive = size === s.id;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => { setSize(s.id); setSizeOpen(false); }}
                className="w-full text-left px-2.5 py-2 rounded-xl flex items-center gap-2 hover:bg-slate-50 transition-colors"
              >
                <span aria-hidden className="inline-flex items-center justify-center shrink-0" style={{ width: 18, height: 18 }}>
                  <span
                    className={`block rounded-[1.5px] border ${isActive ? "border-primary" : "border-slate-400"}`}
                    style={{ width: iw, height: ih }}
                  />
                </span>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-[13px] font-semibold text-slate-900 leading-tight">{s.label}</span>
                  <span className="text-[11px] text-slate-500 leading-tight">{s.title}</span>
                </div>
                {isActive && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  ) : null;

  // Small toggle strip that shows above the prompt when the user has a figure
  // to iterate on. Left side = refine indicator + toggle; right side = "Start
  // fresh" to wipe the chat and drop back into a clean generate flow.
  const refineToggle = previousAssistantImage ? (
    <div className="w-full max-w-6xl mx-auto mb-2 flex items-center justify-between gap-2 rounded-full border border-slate-200/70 bg-white/70 backdrop-blur-sm px-3 py-1.5">
      <button
        type="button"
        onClick={() => setRefineChat((v) => !v)}
        aria-pressed={refineChat}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold transition-colors ${
          refineChat
            ? "bg-primary/10 text-primary"
            : "text-slate-500 hover:text-slate-800"
        }`}
        title={refineChat ? "Refining the last figure — click to disable" : "Enable to iterate on the last figure"}
      >
        <MessagesSquare className="h-3.5 w-3.5" />
        {refineChat ? "Refining last figure" : "Fresh generate"}
      </button>
      <button
        type="button"
        onClick={clearConversation}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
        title="Clear the conversation and start over"
      >
        <XIcon className="h-3 w-3" />
        Start fresh
      </button>
    </div>
  ) : null;

  /**
   * Doc uploader for Poster-from-Doc mode. Rendered above the input only
   * when this mode is active. Two visual states:
   *   - No doc yet → dashed dropzone-style card with a Choose file button.
   *   - Doc parsed → compact card showing filename + counts + a Remove chip.
   */
  const docUploader = activeMode === "poster-from-doc" ? (
    <div className="w-full max-w-6xl mx-auto mb-2">
      <input
        ref={docFileInputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleDocFile(f);
          // Reset so picking the same file twice re-triggers change.
          if (e.target) e.target.value = "";
        }}
      />
      {uploadedDoc ? (
        <div className="flex items-center gap-3 rounded-xl border border-fuchsia-200/70 bg-fuchsia-50/60 px-3 py-2.5">
          <div className="h-9 w-9 rounded-lg bg-white border border-fuchsia-200 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-fuchsia-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-800 truncate">
              {uploadedDoc.fileName}
            </div>
            <div className="text-xs text-slate-500 tabular-nums">
              {uploadedDoc.wordCount.toLocaleString()} words · {uploadedDoc.images.length} image
              {uploadedDoc.images.length === 1 ? "" : "s"}
              {uploadedDoc.sections.length > 0
                ? ` · ${uploadedDoc.sections.length} sections`
                : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setUploadedDoc(null)}
            className="text-slate-400 hover:text-slate-700 transition-colors shrink-0"
            title="Remove document"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => docFileInputRef.current?.click()}
          disabled={parsingDoc}
          className="w-full flex items-center gap-3 rounded-xl border-2 border-dashed border-fuchsia-200/70 bg-white/60 backdrop-blur-sm px-3 py-3 hover:border-fuchsia-300 hover:bg-fuchsia-50/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <div className="h-9 w-9 rounded-lg bg-fuchsia-50 border border-fuchsia-200 flex items-center justify-center shrink-0">
            {parsingDoc ? (
              <Loader2 className="h-4 w-4 text-fuchsia-600 animate-spin" />
            ) : (
              <UploadIcon className="h-4 w-4 text-fuchsia-600" />
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-xs font-semibold text-slate-800">
              {parsingDoc ? "Reading document…" : "Upload a Word document (.docx)"}
            </div>
            <div className="text-xs text-slate-500">
              Text and embedded images will be extracted. Up to 8 MB.
            </div>
          </div>
        </button>
      )}
    </div>
  ) : null;

  /**
   * Poster layout picker — 4 named variants (Classic Bold, Journal Modern,
   * Feature Center, Timeline / Story). Only shown when Poster mode is
   * active. Uses a Popover trigger + list, same pattern as the journal
   * style preset picker, so we don't add another horizontal chip strip.
   */
  const posterLayoutPicker = activeMode === "poster-from-doc" ? (
    <div className="w-full max-w-6xl mx-auto mb-2 flex flex-wrap items-center justify-center gap-2">
      <span className="text-xs font-bold text-slate-400">
        Layout
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Choose poster layout"
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-fuchsia-200/70 bg-white/80 backdrop-blur-sm text-xs font-bold text-fuchsia-800 hover:bg-fuchsia-50 shadow-sm transition-all"
          >
            <LayoutTemplate className="h-3 w-3 text-fuchsia-600" />
            {POSTER_LAYOUTS.find((l) => l.id === posterLayout)?.name ?? "Classic Bold"}
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="center"
          sideOffset={8}
          className="w-80 p-2 rounded-xl border border-slate-200 shadow-lg"
        >
          <div className="mb-1.5 px-1.5 py-1">
            <div className="text-xs font-bold text-slate-400">
              Poster layout
            </div>
            <div className="text-xs text-slate-500 leading-relaxed">
              Applied when Assemble poster runs. Switching after assembly needs one more click on Assemble to re-render (free).
            </div>
          </div>
          <div role="radiogroup" aria-label="Poster layout" className="grid gap-0.5">
            {POSTER_LAYOUTS.map((l) => {
              const isActive = posterLayout === l.id;
              return (
                <button
                  key={l.id}
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => setPosterLayout(l.id)}
                  title={l.description}
                  className={`w-full flex items-start gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors ${
                    isActive ? "bg-fuchsia-50" : "hover:bg-slate-50"
                  }`}
                  type="button"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] font-semibold text-slate-800 leading-tight">
                      {l.name}
                    </span>
                    <span className="block text-xs text-slate-500 leading-tight">
                      {l.description}
                    </span>
                  </span>
                  {isActive && <Check className="h-3.5 w-3.5 text-fuchsia-600 shrink-0 mt-0.5" />}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      <button
        type="button"
        onClick={() => setPosterEmbeddedOnly((v) => !v)}
        aria-pressed={posterEmbeddedOnly}
        title={
          posterEmbeddedOnly
            ? "Only images embedded in your document will be used. No AI figures generated."
            : "AI can propose additional figures where the document doesn't have one. Click to force embedded-only."
        }
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-bold transition-all ${
          posterEmbeddedOnly
            ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm"
            : "bg-white/80 text-slate-500 border-slate-200/70 hover:text-slate-800"
        }`}
      >
        <ImageIcon className="h-3 w-3" />
        {posterEmbeddedOnly ? "Embedded figures only" : "Allow AI figures"}
      </button>
    </div>
  ) : null;

  // Mode explainer + collapsible prompt tips — sits right under the mode
  // picker so users see (a) what the selected mode actually does and (b)
  // concrete prompt-shape guidance without opening any overlay. Single
  // sentence on top, tips behind a subtle disclosure so the hero doesn't
  // grow tall for users who don't need them.
  const modeTipData = MODE_TIPS[activeMode];
  const modeExplainer = modeTipData ? (
    <div className="w-full max-w-2xl mx-auto mb-2.5 text-center">
      <p className="text-sm text-slate-700 leading-relaxed">
        {modeTipData.what}
      </p>
      <details className="mt-1 group inline-block">
        <summary className="cursor-pointer inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-400 hover:text-slate-600 select-none list-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded">
          <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
          Prompt tips
        </summary>
        <ul className="mt-2 text-xs text-slate-600 space-y-1 text-left max-w-lg mx-auto">
          {modeTipData.tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="text-primary shrink-0 mt-[1px]">·</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  ) : null;

  // Icon-style picker — small dropdown button injected into ClaudeChatInput's
  // action bar (just left of Send) via the `rightSlot` prop. Only rendered
  // when the user is on Icon Generator; other modes leave the slot empty.
  const iconStyleActive = ICON_STYLE_OPTIONS.find((o) => o.id === iconStyle) ?? ICON_STYLE_OPTIONS[0];
  const IconStyleGlyph = iconStyleActive.icon;
  const iconStylePicker = STYLE_PICKER_MODES.includes(activeMode) ? (
    <Popover open={iconStyleOpen} onOpenChange={setIconStyleOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1 h-8 rounded-xl px-2.5 transition-colors text-xs ${
            iconStyleOpen
              ? "bg-slate-100 text-slate-900"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
          aria-label={`Visual style: ${iconStyleActive.label}`}
          title={`Visual style: ${iconStyleActive.label}`}
        >
          <IconStyleGlyph className="w-3.5 h-3.5" />
          <span className="font-medium whitespace-nowrap">{iconStyleActive.label}</span>
          <ChevronDown className={`w-3 h-3 opacity-75 transition-transform ${iconStyleOpen ? "rotate-180" : ""}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-[260px] p-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl">
        <div role="radiogroup" aria-label="Visual style preset" className="flex flex-col">
          {ICON_STYLE_OPTIONS.map((opt) => {
            const Glyph = opt.icon;
            const isActive = iconStyle === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => { setIconStyle(opt.id); setIconStyleOpen(false); }}
                className="w-full text-left px-2.5 py-2 rounded-xl flex items-start gap-2 hover:bg-slate-50 transition-colors"
              >
                <Glyph className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-[13px] font-semibold text-slate-900">{opt.label}</span>
                  <span className="text-[11px] text-slate-500 leading-snug">{opt.hint}</span>
                </div>
                {isActive && <Check className="w-4 h-4 text-primary mt-1 shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  ) : null;

  // Compose-bar picker group — journal style, size, icon style — rendered
  // just left of Send via ClaudeChatInput's rightSlot prop. Individual pickers
  // may be null (size on NO_SIZE_MODES; icon-style off Icon Generator); a
  // null group collapses to nothing.
  const composeBarPickers = (
    <div className="flex items-center gap-0.5">
      {presetPickerInline}
      {sizeSelectorInline}
      {iconStylePicker}
    </div>
  );

  const sharedInput = (
    <div>
      {modePicker}
      {modeExplainer}
      {refineToggle}
      {docUploader}
      {posterLayoutPicker}
      <ClaudeChatInput
        value={prompt}
        onChange={setPrompt}
        onSend={handleSend}
        placeholder={activeFeature.placeholder}
        isGenerating={isGenerating}
        acceptsImage={activeFeature.acceptsImage}
        uploadedImage={uploadedImage}
        onImageFile={handleImageFile}
        onImageRemove={() => setUploadedImage(null)}
        hint={activeFeature.requiresImage && !uploadedImage ? "needs image" : undefined}
        rightSlot={composeBarPickers}
      />
      {!["flowchart", "protocol", "timeline"].includes(activeMode) && (
        <details className="w-full max-w-6xl mx-auto mt-2 text-center group">
          <summary className="cursor-pointer text-xs font-bold text-slate-400 hover:text-slate-600 inline-flex items-center gap-1 select-none list-none">
            <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
            Advanced
          </summary>
          <div className="mt-2 flex flex-col items-center gap-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={excludeText}
                onChange={(e) => setExcludeText(e.target.checked)}
                className="accent-slate-700 w-3 h-3"
              />
              Exclude text from output
              <span className="text-slate-400 font-normal">(reduces typos)</span>
            </label>
            {(activeMode === "icon-generator" || activeMode === "text-to-figure") && (
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={higherQuality}
                  onChange={(e) => setHigherQuality(e.target.checked)}
                  className="accent-slate-700 w-3 h-3"
                />
                Higher quality
                <span className="text-slate-400 font-normal">(uses 2 credits — generates 2 candidates and picks the best)</span>
              </label>
            )}
            {activeMode === "icon-generator" && (
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={transparentBackground}
                  onChange={(e) => setTransparentBackground(e.target.checked)}
                  className="accent-slate-700 w-3 h-3"
                />
                Transparent background
                <span className="text-slate-400 font-normal">(cuts the white background so the icon composites onto any color)</span>
              </label>
            )}
          </div>
        </details>
      )}
    </div>
  );

  return (
    <>
      <SEOHead
        title="BioSketch AI Illustrator | AI-Powered Scientific Illustration"
        description="Create scientific illustrations with AI. Generate icons, convert photos to 2D, transform sketches, create figures from text."
        keywords="AI scientific illustration, AI icon generator, photo to illustration, text to figure, BioSketch AI"
        canonical="https://biosketch.art/ai-illustrator"
      />

      <div
        className="min-h-screen font-sans flex flex-col relative"
        style={{
          background:
            "linear-gradient(180deg, #FAF9F5 0%, #F5F4EE 50%, #FAF9F5 100%)",
        }}
      >
        {/* Soft decorative gradient orbs — sleek modern depth without color noise */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full opacity-[0.08]"
            style={{ background: "radial-gradient(circle, #1f2937 0%, transparent 70%)" }} />
          <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.06]"
            style={{ background: "radial-gradient(circle, #1f2937 0%, transparent 70%)" }} />
        </div>

        {/* ── Top bar ──
            All left/right actions share the same Primary tier: h-9 pill,
            text-sm font-bold, unified hover + focus ring for accessibility.
            The Credits pill drops its trailing "generations" secondary
            word — the number + lightning icon are self-explanatory and
            the extra word made the pill visually heavier than its
            neighbours. */}
        <div className="shrink-0 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors shadow-sm"
          >
            <ArrowLeft size={14} weight="bold" />
            Back
          </button>

          <div className="flex items-center gap-2">
            {/* Credits chip — reads from the new balance so purchases + grant
                refreshes are reflected immediately. */}
            <button
              onClick={() => setShowCreditsInfo(true)}
              className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors shadow-sm"
              title={
                isAdmin
                  ? 'Admin — unlimited'
                  : balance
                    ? `${balance.grant_remaining} free · ${balance.purchased} purchased`
                    : 'AI generations'
              }
            >
              <Lightning size={14} weight="duotone" className="text-primary" />
              <span className="tabular-nums">
                {isAdmin ? '∞' : (balance?.total_available ?? '—')}
              </span>
            </button>

            {/* History */}
            <button
              onClick={() => setShowHistory(true)}
              className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors shadow-sm"
            >
              <HistoryIcon className="h-3.5 w-3.5" />
              History
              {generations.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-slate-100 text-xs font-bold tabular-nums">
                  {generations.length}
                </span>
              )}
            </button>

            {/* User menu / sign in */}
            {user ? (
              <div className="bg-white rounded-full border border-slate-200 px-2 py-1 shadow-sm">
                <UserMenu />
              </div>
            ) : (
              <button
                onClick={() => navigate("/auth")}
                className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors shadow-md"
              >
                Sign in
              </button>
            )}
          </div>
        </div>

        {/* ── Empty state — Claude landing ── */}
        {!hasMessages && (
          <div className="flex-1 flex flex-col items-center justify-center px-4 pb-24">
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="w-20 h-20 mb-6 flex items-center justify-center"
            >
              <img
                src={BIOSKETCH_LOGO}
                alt="BioSketch"
                className="w-full h-full object-contain"
              />
            </motion.div>

            {/* Product hero: greeting + one-line intent statement. Kept the
                warm "greeting, name" opener; dropped the Source Serif 4
                display font and the hand-drawn SVG underline flourish —
                both read as demo, not product. */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="text-center mb-8"
            >
              <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight mb-2">
                {greeting}, <span className="text-primary">{userName}</span>
              </h1>
              <p className="text-sm sm:text-base text-slate-500">
                Generate publication-ready scientific figures — pick a mode below and describe what you need.
              </p>
            </motion.div>

            {/* Hero input card — one contained frame around the mode picker,
                 context row, refine toggle, doc uploader, poster picker, and
                 the chat input itself. Reads as a real product panel rather
                 than three floating strips over a subtle glow. */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="w-full max-w-6xl mx-auto"
            >
              <div className="rounded-xl bg-white border border-slate-200 shadow-lg px-4 sm:px-6 py-4 sm:py-5">
                {sharedInput}
              </div>
            </motion.div>

            {/* Starter examples — 4 real prompt / output pairs a new user
                 can load with one click so their first generation runs on
                 a proven prompt and lands publication-grade output. Only
                 shown when the input is empty so we don't clobber a
                 prompt the user has already started typing. */}
            {!prompt.trim() && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.15 }}
                className="w-full max-w-4xl mx-auto mt-6 px-4"
              >
                <div className="flex items-baseline gap-2 mb-3 px-1">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Start from an example
                  </span>
                  <span className="text-xs text-slate-400">
                    · one click loads the prompt + mode
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {STARTER_EXAMPLES.map((ex) => {
                    const modeName = AI_FEATURES.find((f) => f.id === ex.mode)?.shortName ?? ex.mode;
                    return (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => handleStarterClick(ex)}
                        className="group text-left rounded-xl border border-slate-200 bg-white overflow-hidden hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-all"
                      >
                        <div className="aspect-[4/3] w-full bg-slate-50 overflow-hidden">
                          <img
                            src={ex.thumbnail}
                            alt=""
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                          />
                        </div>
                        <div className="p-2.5">
                          <div className="text-xs font-bold text-slate-900 leading-tight mb-1 line-clamp-1">
                            {ex.title}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                              {modeName}
                            </span>
                            <span className="text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                              Try →
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Suggestion chips — grouped under a "Try:" label so they read
                 as example prompts, not floating actions. Tertiary tier size. */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeMode}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
                className="flex flex-wrap justify-center items-center gap-2 mt-5 max-w-6xl mx-auto px-4"
              >
                <span className="text-xs font-bold uppercase tracking-wide text-slate-400 mr-1">
                  Try
                </span>
                {activeFeature.suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSuggestionClick(s)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors"
                  >
                    <span className="text-slate-400">{activeFeature.icon}</span>
                    {s}
                  </button>
                ))}
              </motion.div>
            </AnimatePresence>

            {/* Bottom trial / lock banners — same rounded-xl bordered
                 container, single hue per state (emerald = trial-active,
                 amber = out-of-credits), buttons at Secondary tier. */}
            {user && !isAdmin && usage?.mode === 'trial' && (
              <div className="mt-8 max-w-md mx-auto rounded-xl bg-emerald-50 border border-emerald-200 shadow-sm px-4 py-3 flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-sm text-emerald-800 leading-snug">
                  <span className="font-bold">Free trial</span> —{" "}
                  <span className="font-bold">{usage.trialRemaining ?? usage.remaining ?? 0}</span>{" "}
                  of 3 AI generations left.{" "}
                  <button
                    onClick={() => navigate("/projects")}
                    className="font-bold underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 rounded"
                  >
                    Share projects to unlock more →
                  </button>
                </p>
              </div>
            )}
            {user && !isAdmin && usage?.mode === 'trial-exhausted' && balance?.total_available === 0 && (
              <div className="mt-8 max-w-md mx-auto rounded-xl bg-amber-50 border border-amber-200 shadow-sm px-4 py-3">
                <div className="flex items-start gap-2.5 mb-3">
                  <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 leading-snug">
                    <span className="font-bold">You're out of AI credits.</span>{" "}
                    Buy more or share{" "}
                    <span className="font-bold">{usage.needsApproved ?? 3}</span> approved
                    project{(usage.needsApproved ?? 3) !== 1 ? "s" : ""} to earn them.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 pl-6">
                  <button
                    onClick={() => setShowInsufficientCredits(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 shadow-sm transition-colors"
                  >
                    Buy generations
                  </button>
                  <button
                    onClick={() => navigate("/projects")}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-bold bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 transition-colors"
                  >
                    Publish a project
                  </button>
                  <button
                    onClick={() => navigate("/free-ai-credits")}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-bold bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 transition-colors"
                  >
                    Free credits
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Conversation state ── */}
        {hasMessages && (
          <>
            <div className="flex-1 overflow-auto">
              <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <img
                        src={BIOSKETCH_LOGO}
                        alt=""
                        className="h-7 w-7 rounded-full object-contain shrink-0 mt-0.5"
                      />
                    )}
                    <div
                      className={(() => {
                        // Status-card messages (planning, plan, figure-plan,
                        // poster-plan, etc.) render their own bordered
                        // container inside the message — don't double-wrap.
                        const isStatusCardMsg = msg.role === "assistant" && (
                          msg.kind === "plan" || msg.kind === "planning" ||
                          msg.kind === "figure-plan" || msg.kind === "figure-planning" ||
                          msg.kind === "doc-extracted" ||
                          msg.kind === "poster-planning" || msg.kind === "poster-plan" ||
                          msg.kind === "poster-drawing" || msg.kind === "poster-figures"
                        );
                        if (msg.role === "user") {
                          return "max-w-[75%] bg-white border border-slate-200 rounded-xl rounded-tr-sm px-4 py-3 shadow-sm";
                        }
                        if (msg.image || msg.svg) {
                          return "flex-1 min-w-0";
                        }
                        if (isStatusCardMsg) {
                          return "max-w-[75%]";
                        }
                        // Text-only assistant message → subtle mirror bubble
                        // (opposite-corner clip) so the eye can scan the
                        // conversation as paired turns instead of user
                        // bubbles vs. bare paragraphs.
                        return "max-w-[75%] bg-white/70 border border-slate-100 rounded-xl rounded-tl-sm px-4 py-3 shadow-sm";
                      })()}
                    >
                      {/* Planner meta-messages render as a compact card that
                          lives ABOVE the eventual result. `planning` shows the
                          in-flight spinner; `plan` shows the resolved plan the
                          executor is about to act on. */}
                      {msg.role === "assistant" && msg.kind === "planning" && (
                        <div className="mb-2 inline-flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200/70 px-3 py-2">
                          <Loader2 className="h-3.5 w-3.5 text-slate-500 animate-spin" />
                          <span className="text-xs text-slate-600">Analyzing your request…</span>
                        </div>
                      )}
                      {msg.role === "assistant" && msg.kind === "figure-planning" && (
                        <div className="mb-2 inline-flex items-center gap-2 rounded-lg bg-teal-50 border border-teal-200/70 px-3 py-2">
                          <Loader2 className="h-3.5 w-3.5 text-teal-600 animate-spin" />
                          <span className="text-xs text-teal-800">{msg.text}</span>
                        </div>
                      )}
                      {msg.role === "assistant" && msg.kind === "poster-planning" && (
                        <div className="mb-2 inline-flex items-center gap-2 rounded-lg bg-fuchsia-50 border border-fuchsia-200/70 px-3 py-2">
                          <Loader2 className="h-3.5 w-3.5 text-fuchsia-600 animate-spin" />
                          <span className="text-xs text-fuchsia-800">{msg.text}</span>
                        </div>
                      )}
                      {msg.role === "assistant" && msg.kind === "poster-drawing" && msg.posterProgress && (
                        <div className="mb-2 rounded-xl bg-white border border-slate-200 border-l-4 border-l-fuchsia-500 px-4 py-3 shadow-md max-w-md">
                          <div className="flex items-center gap-2 mb-2">
                            <Loader2 className="h-3.5 w-3.5 text-fuchsia-600 animate-spin" />
                            <span className="text-xs font-semibold text-fuchsia-800">
                              Drawing figure {Math.min(msg.posterProgress.done + 1, msg.posterProgress.total)} of {msg.posterProgress.total}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-fuchsia-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-fuchsia-500 transition-all duration-500"
                              style={{
                                width: `${Math.round((msg.posterProgress.done / Math.max(1, msg.posterProgress.total)) * 100)}%`,
                              }}
                            />
                          </div>
                          <div className="mt-1.5 text-xs text-fuchsia-700 tabular-nums">
                            {msg.posterProgress.done} / {msg.posterProgress.total} done
                          </div>
                        </div>
                      )}
                      {msg.role === "assistant" && msg.kind === "poster-figures" && msg.posterFigures && (() => {
                        const pf = msg.posterFigures;
                        const okCount = pf.resolved.filter((r) => !r.failed).length;
                        return (
                          <div className="mb-2 rounded-xl bg-white border border-slate-200 border-l-4 border-l-fuchsia-500 px-4 py-3 shadow-md max-w-2xl">
                            <div className="flex items-center gap-1.5 mb-2">
                              <ImageIcon className="h-3.5 w-3.5 text-fuchsia-600" />
                              <span className="text-sm font-bold text-fuchsia-800">
                                Figures ready
                              </span>
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 tabular-nums">
                                {okCount} / {pf.resolved.length}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {pf.resolved.map((r, i) => (
                                <div
                                  key={i}
                                  className={`rounded-lg overflow-hidden border ${
                                    r.failed
                                      ? "border-amber-200 bg-amber-50"
                                      : r.source === "embedded"
                                      ? "border-emerald-200 bg-white"
                                      : "border-fuchsia-200 bg-white"
                                  }`}
                                >
                                  <div className="aspect-video w-full bg-slate-50 flex items-center justify-center">
                                    {r.failed || !r.imageDataUrl ? (
                                      <span className="text-xs font-bold text-amber-700">
                                        Skipped
                                      </span>
                                    ) : (
                                      <img
                                        src={r.imageDataUrl}
                                        alt={r.caption}
                                        className="w-full h-full object-contain"
                                      />
                                    )}
                                  </div>
                                  <div className="px-2 py-1.5">
                                    <div className="flex items-center gap-1 mb-0.5">
                                      <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-fuchsia-100 text-fuchsia-800 font-bold text-[9px]">
                                        {i + 1}
                                      </span>
                                      <span
                                        className={`text-[10px] font-bold uppercase tracking-wide ${
                                          r.source === "embedded" ? "text-emerald-700" : "text-fuchsia-700"
                                        }`}
                                      >
                                        {r.source === "embedded" ? "Reused" : "Generated"}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-700 leading-tight line-clamp-2">
                                      {r.caption}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t border-fuchsia-100">
                              <div className="text-xs text-slate-600">
                                Ready to lay out {okCount} figure{okCount === 1 ? "" : "s"} into the poster template.
                              </div>
                              <button
                                type="button"
                                onClick={() => runPosterAssemble(pf)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-bold bg-fuchsia-600 text-white hover:bg-fuchsia-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/50 shadow-sm transition-colors"
                                title="Compose the landscape SVG poster from the plan + figures"
                              >
                                <LayoutTemplate className="h-3 w-3" />
                                Assemble poster
                              </button>
                            </div>
                            <div className="mt-2 text-xs text-slate-500 text-center">
                              Assembly is client-side — no additional credits.
                            </div>
                          </div>
                        );
                      })()}
                      {msg.role === "assistant" && msg.kind === "poster-plan" && msg.posterPlan && (() => {
                        const p = msg.posterPlan;
                        const genFigures = p.figures.filter((f) => f.source === "generate");
                        const embFigures = p.figures.filter((f) => f.source === "embedded");
                        const nextCost = genFigures.length; // 1 credit per generated figure in Stage 3.
                        return (
                          <div className="mb-2 rounded-xl bg-white border border-slate-200 border-l-4 border-l-fuchsia-500 px-4 py-3 shadow-md max-w-2xl">
                            <div className="flex items-center gap-1.5 mb-2">
                              <LayoutTemplate className="h-3.5 w-3.5 text-fuchsia-600" />
                              <span className="text-sm font-bold text-fuchsia-800">
                                Poster plan
                              </span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                p.crossCheck.ok
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}>
                                {p.crossCheck.ok ? "Cross-check OK" : "Review issues"}
                              </span>
                            </div>
                            <div className="text-sm font-semibold text-slate-900 leading-tight mb-0.5">
                              {p.title}
                            </div>
                            {p.authors && (
                              <div className="text-xs text-slate-600 truncate">{p.authors}</div>
                            )}
                            {p.affiliation && (
                              <div className="text-xs text-slate-500 truncate">{p.affiliation}</div>
                            )}
                            {p.keyTakeaway && (
                              <div className="mt-2 rounded-lg bg-white border border-fuchsia-100 px-2.5 py-1.5">
                                <div className="text-xs font-bold text-fuchsia-700 mb-0.5">
                                  Key takeaway
                                </div>
                                <div className="text-xs text-slate-800 leading-snug">
                                  {p.keyTakeaway}
                                </div>
                              </div>
                            )}
                            <div className="mt-3">
                              <div className="text-xs font-semibold text-slate-500 mb-1">
                                Sections ({p.sections.length})
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {p.sections.map((s, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-xs text-slate-700"
                                    title={s.bullets.join(" · ")}
                                  >
                                    {s.name}
                                    {typeof s.figureIdx === "number" && (
                                      <span className="text-[9px] font-bold text-fuchsia-600">
                                        · fig {s.figureIdx + 1}
                                      </span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="mt-3">
                              <div className="text-xs font-semibold text-slate-500 mb-1">
                                Figures ({p.figures.length}) · {embFigures.length} reused · {genFigures.length} to generate
                              </div>
                              <ol className="space-y-1">
                                {p.figures.map((f, i) => (
                                  <li key={i} className="flex items-start gap-2 text-xs">
                                    <span className="mt-0.5 shrink-0 inline-flex items-center justify-center h-4 w-4 rounded-full bg-fuchsia-100 text-fuchsia-800 font-bold text-[9px]">
                                      {i + 1}
                                    </span>
                                    <span className="flex-1 min-w-0">
                                      <span className="text-slate-800">{f.caption}</span>
                                      <span className={`ml-1 text-[10px] font-bold uppercase tracking-wide ${
                                        f.source === "embedded" ? "text-emerald-700" : "text-fuchsia-700"
                                      }`}>
                                        {f.source === "embedded" ? "· reused" : "· generate"}
                                      </span>
                                    </span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                            {p.crossCheck.issues.length > 0 && (
                              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-100 px-2.5 py-1.5">
                                <div className="text-xs font-bold text-amber-700 mb-0.5">
                                  Issues
                                </div>
                                <ul className="text-xs text-amber-800 space-y-0.5">
                                  {p.crossCheck.issues.slice(0, 4).map((iss, i) => (
                                    <li key={i}>· {iss}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t border-fuchsia-100">
                              <div className="text-xs text-slate-600">
                                {p.figures.length === 0
                                  ? "No figures to lay out — upload a document with images, or allow AI figures."
                                  : nextCost === 0
                                  ? "All figures reused from your doc — no extra credits."
                                  : `${nextCost} figure${nextCost === 1 ? "" : "s"} to generate at 1 credit each.`}
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  runPosterGenerateFigures(p, msg.posterEmbeddedImages ?? [])
                                }
                                disabled={p.figures.length === 0}
                                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-bold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/50 transition-colors ${
                                  p.figures.length === 0
                                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                    : "bg-fuchsia-600 text-white hover:bg-fuchsia-700"
                                }`}
                                title={
                                  p.figures.length === 0
                                    ? "No figures in the plan"
                                    : nextCost === 0
                                    ? "Use the embedded figures — no AI credits"
                                    : "Generate the AI figures and reuse the embedded ones"
                                }
                              >
                                <Sparkles className="h-3 w-3" />
                                {nextCost === 0 ? "Prepare figures · 0c" : `Generate figures · ${nextCost}c`}
                              </button>
                            </div>
                            <div className="mt-2 text-xs text-slate-500 text-center">
                              Stage 3 wires up figure generation. Stage 4 renders the editable SVG poster.
                            </div>
                          </div>
                        );
                      })()}
                      {msg.role === "assistant" && msg.kind === "doc-extracted" && msg.extractedDoc && (
                        <div className="mb-2 rounded-xl bg-white border border-slate-200 border-l-4 border-l-fuchsia-500 px-4 py-3 shadow-md max-w-lg">
                          <div className="flex items-center gap-1.5 mb-2">
                            <FileText className="h-3.5 w-3.5 text-fuchsia-600" />
                            <span className="text-sm font-bold text-fuchsia-800">
                              Document extracted
                            </span>
                          </div>
                          <div className="text-xs text-slate-800 font-semibold truncate mb-1.5">
                            {msg.extractedDoc.fileName}
                          </div>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-xs text-slate-700 tabular-nums">
                              <FileText className="h-3 w-3 text-slate-500" />
                              {msg.extractedDoc.wordCount.toLocaleString()} words
                            </span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-xs text-slate-700 tabular-nums">
                              <ImageIcon className="h-3 w-3 text-slate-500" />
                              {msg.extractedDoc.imageCount} image{msg.extractedDoc.imageCount === 1 ? "" : "s"}
                            </span>
                            {msg.extractedDoc.sections.length > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-xs text-slate-700 tabular-nums">
                                <LayoutTemplate className="h-3 w-3 text-slate-500" />
                                {msg.extractedDoc.sections.length} sections
                              </span>
                            )}
                          </div>
                          {msg.extractedDoc.sections.length > 0 && (
                            <div className="mb-2">
                              <div className="text-xs font-semibold text-slate-500 mb-1">
                                Detected sections
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {msg.extractedDoc.sections.slice(0, 12).map((s, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-fuchsia-50 border border-fuchsia-100 text-xs text-fuchsia-800"
                                    title={s}
                                  >
                                    {s.length > 30 ? s.substring(0, 30) + "…" : s}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {msg.extractedDoc.warnings.length > 0 && (
                            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">
                              <span className="font-semibold">Warnings:</span>{" "}
                              {msg.extractedDoc.warnings.slice(0, 2).join(" · ")}
                            </div>
                          )}
                          <div className="mt-2 text-xs text-slate-500">
                            Stage 1 complete — the parser saw your document correctly. Planner (Stage 2) will be wired next.
                          </div>
                        </div>
                      )}
                      {msg.role === "assistant" && msg.kind === "figure-plan" && msg.figurePlan && (
                        <div className="mb-2 rounded-xl bg-white border border-slate-200 border-l-4 border-l-teal-500 px-4 py-3 shadow-md max-w-md">
                          <div className="flex items-center gap-1.5 mb-2">
                            <ScrollText className="h-3.5 w-3.5 text-teal-600" />
                            <span className="text-sm font-bold text-teal-800">
                              Figure Plan
                            </span>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">
                              {msg.figurePlan.figureType.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-xs text-slate-700 mb-1.5">
                            <span className="font-medium text-slate-500">Subject:</span>{" "}
                            {msg.figurePlan.subject}
                          </div>
                          {msg.figurePlan.components.length > 0 && (
                            <div className="mb-1.5">
                              <span className="text-xs font-semibold text-slate-500">Components:</span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {msg.figurePlan.components.slice(0, 12).map((c, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-xs text-slate-700"
                                  >
                                    {c}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {msg.figurePlan.spatialLayout && (
                            <div className="text-xs text-slate-600 mb-2">
                              <span className="font-medium text-slate-500">Layout:</span>{" "}
                              {msg.figurePlan.spatialLayout}
                            </div>
                          )}
                          {msg.sourceAbstract && (
                            <button
                              onClick={() =>
                                runAbstractToFigure(msg.sourceAbstract!, { existingPlan: msg.figurePlan! })
                              }
                              disabled={isGenerating}
                              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-md text-sm font-bold bg-white border border-teal-300 text-teal-700 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/40 disabled:opacity-50 transition-colors"
                              title="Draw a new figure from this same plan (1 credit)"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Regenerate from plan · 1c
                            </button>
                          )}
                        </div>
                      )}
                      {msg.role === "assistant" && msg.kind === "plan" && (
                        <div className="mb-2 rounded-xl bg-white border border-slate-200 border-l-4 border-l-primary px-4 py-3 shadow-md">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                            <span className="text-sm font-bold text-slate-700">
                              Plan
                            </span>
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                msg.planScope === "local"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : msg.planScope === "global"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {msg.planScope === "local"
                                ? "LOCAL EDIT"
                                : msg.planScope === "global"
                                ? "GLOBAL EDIT"
                                : "NEW FIGURE"}
                            </span>
                          </div>
                          {msg.planChange && (
                            <div className="text-xs text-slate-700">
                              <span className="font-medium text-slate-500">Editing:</span>{" "}
                              {msg.planChange}
                            </div>
                          )}
                          {msg.planPreserve && msg.planScope !== "fresh" && (
                            <div className="text-xs text-slate-600 mt-0.5">
                              <span className="font-medium text-slate-500">Preserving:</span>{" "}
                              {msg.planPreserve}
                            </div>
                          )}
                        </div>
                      )}
                      {msg.svg && msg.role === "assistant" && (
                        <div className="mb-2">
                          <div
                            className="mx-auto max-w-full overflow-auto rounded-xl bg-white border border-slate-200 p-3"
                            style={{ maxHeight: 640 }}
                            dangerouslySetInnerHTML={{ __html: msg.svg }}
                          />
                          <div className="flex flex-wrap gap-2 mt-2">
                            <button
                              onClick={() => handleOpenSvgInCanvas(msg.svg!)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-[#D97757]/10 text-[#D97757] hover:bg-[#D97757]/15 transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Open in Canvas (editable)
                            </button>
                            <button
                              onClick={() => handleDownloadSvg(msg.svg!)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-900 transition-colors"
                            >
                              <Download className="h-3 w-3" />
                              SVG
                            </button>
                            <button
                              onClick={() => handleDownloadSvgAsPng(msg.svg!)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-900 transition-colors"
                            >
                              <Download className="h-3 w-3" />
                              PNG
                            </button>
                            {msg.posterMeta && (
                              <button
                                onClick={() => handleDownloadPoster(msg.posterMeta!)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-700 hover:bg-fuchsia-100 hover:border-fuchsia-300 transition-colors"
                                title="Download as editable PowerPoint — every text element stays editable"
                              >
                                <Download className="h-3 w-3" />
                                PPT (editable)
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {msg.image && !msg.svg && (
                        <div className="mb-2">
                          <img
                            src={msg.image}
                            alt=""
                            className="block mx-auto max-w-full max-h-[560px] rounded-xl object-contain bg-white border border-slate-200"
                          />
                          {msg.role === "assistant" && (
                            <div className="mt-2 space-y-1.5">
                              {/* Primary — take it away */}
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  onClick={() => {
                                    const a = document.createElement("a");
                                    a.href = msg.image!;
                                    a.download = "biosketch-ai-illustration.png";
                                    a.click();
                                  }}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-900 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-all"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  PNG
                                </button>
                                <button
                                  onClick={() => {
                                    const img = new window.Image();
                                    img.onload = () => {
                                      const w = img.naturalWidth, h = img.naturalHeight;
                                      const maxDim = 1024;
                                      let canvasW = w, canvasH = h;
                                      if (w > maxDim || h > maxDim) {
                                        const scale = maxDim / Math.max(w, h);
                                        canvasW = Math.round(w * scale);
                                        canvasH = Math.round(h * scale);
                                      }
                                      const c = document.createElement("canvas");
                                      c.width = canvasW; c.height = canvasH;
                                      const ctx = c.getContext("2d")!;
                                      ctx.imageSmoothingEnabled = true;
                                      ctx.imageSmoothingQuality = "high";
                                      ctx.drawImage(img, 0, 0, canvasW, canvasH);
                                      const dataUrl = c.toDataURL("image/png");
                                      const svgOut = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}"><image width="${canvasW}" height="${canvasH}" xlink:href="${dataUrl}"/></svg>`;
                                      try {
                                        sessionStorage.setItem("ai_illustrator_svg_import", svgOut);
                                        window.location.href = "/canvas";
                                      } catch (e) {
                                        toast.error("Image too large for canvas transfer. Try downloading instead.");
                                      }
                                    };
                                    img.src = msg.image!;
                                  }}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-[#D97757]/10 text-[#D97757] hover:bg-[#D97757]/15 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97757]/30 transition-all"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  Open in Canvas
                                </button>
                                <button
                                  onClick={() => handleDownloadFigurePpt(msg.image!, msg.id, msg.text)}
                                  disabled={processingMsgId === msg.id}
                                  title="Export to PowerPoint — one slide, sized to the image, ready to drop into your deck."
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-700 hover:bg-fuchsia-100 hover:border-fuchsia-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/40 transition-all disabled:opacity-50"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  {processingMsgId === msg.id ? "Exporting…" : "Export to PowerPoint"}
                                </button>
                                {msg.sourceMode === "icon-generator" && (
                                  <button
                                    onClick={() => openSaveIconDialog(msg)}
                                    disabled={savedIconMsgIds.has(msg.id)}
                                    title="Save to your icon library — appears in the Canvas Icon Library under My Library."
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-70 ${
                                      savedIconMsgIds.has(msg.id)
                                        ? "bg-emerald-50 border border-emerald-200 text-emerald-700 cursor-default"
                                        : "bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 hover:border-amber-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
                                    }`}
                                  >
                                    {savedIconMsgIds.has(msg.id) ? (
                                      <><BookmarkCheck className="h-3.5 w-3.5" /> Saved</>
                                    ) : (
                                      <><BookmarkPlus className="h-3.5 w-3.5" /> Save as icon</>
                                    )}
                                  </button>
                                )}
                              </div>

                              {/* Secondary — keep editing */}
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  onClick={() => handleRemoveBg(msg.id, msg.image!)}
                                  disabled={processingMsgId === msg.id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/60 transition-colors disabled:opacity-50"
                                >
                                  <Eraser className="h-3 w-3" />
                                  {processingMsgId === msg.id ? "Processing..." : "Remove BG"}
                                </button>
                                <button
                                  onClick={() => handleUpscale(msg.id, msg.image!, 2)}
                                  disabled={processingMsgId === msg.id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/60 transition-colors disabled:opacity-50"
                                >
                                  <ZoomIn className="h-3 w-3" />
                                  {processingMsgId === msg.id ? "Processing..." : "Upscale 2×"}
                                </button>
                                <button
                                  onClick={() => handleUpscale(msg.id, msg.image!, 4)}
                                  disabled={processingMsgId === msg.id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/60 transition-colors disabled:opacity-50"
                                >
                                  <ZoomIn className="h-3 w-3" />
                                  {processingMsgId === msg.id ? "Processing..." : "Upscale 4×"}
                                </button>
                                <button
                                  onClick={() => setRecolorMsgId(msg.id)}
                                  disabled={processingMsgId === msg.id}
                                  title="Recolor with a curated palette. 1 AI credit."
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold bg-primary/5 border border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors disabled:opacity-50"
                                >
                                  <Palette className="h-3 w-3" />
                                  {processingMsgId === msg.id && recolorMsgId === msg.id ? "Recoloring..." : "Recolor"}
                                  <span className="inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-bold tracking-wide bg-primary/15 text-primary">1c</span>
                                </button>
                                <button
                                  onClick={() => setAspectMsgId(msg.id)}
                                  disabled={processingMsgId === msg.id}
                                  title="Extend the image to a new aspect ratio. 1 AI credit."
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold bg-primary/5 border border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors disabled:opacity-50"
                                >
                                  <Ratio className="h-3 w-3" />
                                  {processingMsgId === msg.id && aspectMsgId === msg.id ? "Extending..." : "Change aspect"}
                                  <span className="inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-bold tracking-wide bg-primary/15 text-primary">1c</span>
                                </button>
                                <button
                                  onClick={() => setRegionMsgId(msg.id)}
                                  disabled={processingMsgId === msg.id}
                                  title="Select an area and redraw just that region. 1 AI credit."
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold bg-primary/5 border border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors disabled:opacity-50"
                                >
                                  <Crop className="h-3 w-3" />
                                  {processingMsgId === msg.id && regionMsgId === msg.id ? "Redrawing..." : "Refine region"}
                                  <span className="inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-bold tracking-wide bg-primary/15 text-primary">1c</span>
                                </button>
                                <button
                                  onClick={() => setTextEditMsgId(msg.id)}
                                  disabled={processingMsgId === msg.id}
                                  title="Click a label and rewrite it. 1 AI credit per edit."
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold bg-primary/5 border border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors disabled:opacity-50"
                                >
                                  <Type className="h-3 w-3" />
                                  {processingMsgId === msg.id && textEditMsgId === msg.id ? "Editing text..." : "Edit text"}
                                  <span className="inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-bold tracking-wide bg-primary/15 text-primary">1c</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {/* Suppress the standard text line for plan meta-messages —
                          the card above already shows the change/preserve text. */}
                      {!(msg.role === "assistant" && (msg.kind === "plan" || msg.kind === "planning" || msg.kind === "figure-plan" || msg.kind === "figure-planning" || msg.kind === "doc-extracted" || msg.kind === "poster-planning" || msg.kind === "poster-plan" || msg.kind === "poster-drawing" || msg.kind === "poster-figures")) && (
                        <p
                          className={`text-base leading-relaxed ${
                            msg.role === "user" ? "text-slate-900" : "text-slate-700"
                          }`}
                        >
                          {msg.text}
                        </p>
                      )}
                      <p className="text-xs mt-1.5 text-slate-500">
                        {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </motion.div>
                ))}

                {isGenerating && (
                  <div className="flex gap-3 items-start">
                    <img
                      src={BIOSKETCH_LOGO}
                      alt=""
                      className="h-7 w-7 rounded-full object-contain shrink-0 mt-0.5"
                    />
                    <div className="inline-flex items-center gap-2.5 bg-white/70 border border-slate-100 rounded-xl rounded-tl-sm px-4 py-3 shadow-sm">
                      <span className="inline-flex items-center gap-1" aria-hidden>
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="w-2 h-2 rounded-full bg-primary animate-bounce"
                            style={{ animationDelay: `${i * 150}ms` }}
                          />
                        ))}
                      </span>
                      <span className="text-sm font-semibold text-slate-500">
                        Thinking…
                      </span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Sticky chat input at bottom */}
            <div className="shrink-0 px-4 pb-6 pt-2 bg-gradient-to-t from-[#FAF9F5] via-[#FAF9F5]/95 to-transparent">
              {sharedInput}
            </div>
          </>
        )}

        {/* ── Credits info modal ── */}
        {showCreditsInfo && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowCreditsInfo(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-[#D97757]/10 flex items-center justify-center">
                  <Info className="h-5 w-5 text-[#D97757]" />
                </div>
                <h2
                  className="text-lg font-bold text-slate-900 tracking-tight"
                >
                  Your AI Generations
                </h2>
              </div>

              {/* Current balance — grant + purchased breakdown */}
              {balance && !isAdmin && (
                <div className="mb-4 rounded-xl border border-slate-200 bg-gradient-to-br from-[#D97757]/5 to-[#FAF9F5] p-4">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Available
                    </span>
                    <span className="text-2xl font-bold text-slate-900 tabular-nums">
                      {balance.total_available}
                      <span className="text-sm font-normal text-slate-500 ml-1">generations</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <span>
                      <span className="font-semibold text-slate-900 tabular-nums">{balance.grant_remaining}</span>
                      {" "}free (of {balance.monthly_grant}/month)
                    </span>
                    <span className="text-slate-300">·</span>
                    <span>
                      <span className="font-semibold text-slate-900 tabular-nums">{balance.purchased}</span>
                      {" "}purchased
                    </span>
                  </div>
                </div>
              )}
              {isAdmin && (
                <div className="mb-4 rounded-xl border border-purple-200 bg-purple-50 p-4 text-center">
                  <span className="text-sm font-semibold text-purple-700">Admin — unlimited generations</span>
                </div>
              )}

              <div className="space-y-4 text-sm text-slate-600">
                <p>
                  <span className="font-semibold text-slate-900">
                    BioSketch is free to use
                  </span>{" "}— AI generations are earned by sharing your work with the community, or bought any time.
                </p>

                <div className="bg-[#FAF9F5] border border-slate-200 rounded-xl p-4">
                  <p className="font-semibold text-slate-900 mb-2">How to earn AI credits:</p>
                  <ol className="space-y-2 text-slate-700">
                    <li className="flex gap-2">
                      <span className="font-bold shrink-0 text-[#D97757]">1.</span>
                      <span>Share <strong>3 approved projects</strong> = <strong>20 generations</strong> per 30-day window</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-bold shrink-0 text-[#D97757]">2.</span>
                      <span>Each <strong>additional approved share</strong> = <strong>+10</strong> per window. No cap.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-bold shrink-0 text-[#D97757]">3.</span>
                      <span>Or <strong>buy credits</strong> any time — packs from $5.</span>
                    </li>
                  </ol>
                </div>

                <p className="text-xs text-slate-400">
                  Grants reset on a rolling 30-day window. Purchased generations don't expire.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setShowCreditsInfo(false);
                    setShowPurchaseCredits(true);
                  }}
                  className="flex-1 min-w-[140px] px-4 py-2.5 rounded-full bg-[#D97757] text-white text-sm font-semibold hover:bg-[#C6613F] transition-colors shadow-md"
                >
                  Buy generations
                </button>
                <button
                  onClick={() => {
                    setShowCreditsInfo(false);
                    navigate("/projects");
                  }}
                  className="flex-1 min-w-[140px] px-4 py-2.5 rounded-full border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Share a project
                </button>
                <button
                  onClick={() => {
                    setShowCreditsInfo(false);
                    navigate("/free-ai-credits");
                  }}
                  className="flex-1 min-w-[140px] px-4 py-2.5 rounded-full border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Free credits
                </button>
                <button
                  onClick={() => setShowCreditsInfo(false)}
                  className="w-full px-4 py-2 rounded-full text-xs text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── History panel — slides in from right ── */}
        {showHistory && (
          <div
            className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm"
            onClick={() => setShowHistory(false)}
          >
            <div
              className="w-full max-w-sm bg-white border-l border-slate-200 shadow-2xl flex flex-col h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-14 flex items-center justify-between px-4 border-b border-slate-100 shrink-0">
                <h2
                  className="text-base font-bold text-slate-900"
                  style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.02em" }}
                >
                  Past Generations
                </h2>
                <button
                  onClick={() => setShowHistory(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-3">
                  {historyLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    </div>
                  ) : generations.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-sm text-slate-400">No generations yet</p>
                      <p className="text-xs text-slate-300 mt-1">
                        Your AI creations will appear here
                      </p>
                    </div>
                  ) : (() => {
                    const HISTORY_PAGE_SIZE = 6;
                    const totalPages = Math.max(1, Math.ceil(generations.length / HISTORY_PAGE_SIZE));
                    // Clamp so the current page stays valid when items are
                    // deleted or new ones are added at the front.
                    const safePage = Math.min(historyPage, totalPages - 1);
                    const pageStart = safePage * HISTORY_PAGE_SIZE;
                    const pageItems = generations.slice(pageStart, pageStart + HISTORY_PAGE_SIZE);
                    return (
                    <>
                    <div className="grid grid-cols-2 gap-2">
                      {pageItems.map((gen) => (
                        <div
                          key={gen.id}
                          className="group relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50"
                        >
                          <img
                            src={gen.image_url}
                            alt={gen.prompt}
                            className="w-full aspect-square object-contain p-1"
                            loading="lazy"
                          />
                          <div className="p-2 pr-6">
                            <p className="text-[10px] font-medium text-slate-700 truncate">
                              {gen.prompt}
                            </p>
                            <p className="text-[9px] text-slate-400 mt-0.5">
                              {gen.mode.replace(/-/g, " ")} ·{" "}
                              {new Date(gen.created_at).toLocaleDateString()}
                            </p>
                          </div>

                          {/* Always-visible delete affordance in the top-right
                              corner. First click asks for confirmation (button
                              turns red), second click within 3 s deletes. */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (historyDeleteConfirmId === gen.id) {
                                deleteGeneration(gen.id);
                                setHistoryDeleteConfirmId(null);
                              } else {
                                setHistoryDeleteConfirmId(gen.id);
                                window.setTimeout(() => {
                                  setHistoryDeleteConfirmId((cur) => (cur === gen.id ? null : cur));
                                }, 3000);
                              }
                            }}
                            title={
                              historyDeleteConfirmId === gen.id
                                ? "Click again to confirm delete"
                                : "Delete this generation"
                            }
                            className={`absolute top-1 right-1 h-5 w-5 rounded-full flex items-center justify-center shadow-sm transition-all ${
                              historyDeleteConfirmId === gen.id
                                ? "bg-rose-600 text-white scale-110"
                                : "bg-white/85 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                            }`}
                          >
                            <X className="h-3 w-3" />
                          </button>

                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                const a = document.createElement("a");
                                a.href = gen.image_url;
                                a.download = "biosketch-ai-" + gen.mode + ".png";
                                a.click();
                              }}
                              className="px-3 py-1 rounded-full bg-white text-black text-[10px] font-semibold hover:bg-slate-100"
                            >
                              Download
                            </button>
                            <button
                              onClick={() => {
                                setMessages((prev) => [
                                  ...prev,
                                  {
                                    id: Date.now().toString(),
                                    role: "assistant",
                                    text: "Loaded from history: " + gen.prompt,
                                    image: gen.image_url,
                                    timestamp: new Date(),
                                  },
                                ]);
                                setShowHistory(false);
                                toast.success("Loaded into chat");
                              }}
                              className="px-3 py-1 rounded-full bg-[#D97757] text-white text-[10px] font-semibold hover:bg-[#C6613F]"
                            >
                              Load in Chat
                            </button>
                            <button
                              onClick={() => {
                                const img = new window.Image();
                                img.crossOrigin = "anonymous";
                                img.onload = () => {
                                  const w = img.naturalWidth, h = img.naturalHeight;
                                  const maxDim = 1024;
                                  let cw = w, ch = h;
                                  if (w > maxDim || h > maxDim) {
                                    const scale = maxDim / Math.max(w, h);
                                    cw = Math.round(w * scale);
                                    ch = Math.round(h * scale);
                                  }
                                  const c = document.createElement("canvas");
                                  c.width = cw; c.height = ch;
                                  const ctx = c.getContext("2d")!;
                                  ctx.imageSmoothingEnabled = true;
                                  ctx.imageSmoothingQuality = "high";
                                  ctx.drawImage(img, 0, 0, cw, ch);
                                  const dataUrl = c.toDataURL("image/png");
                                  const svgOut = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${cw}" height="${ch}" viewBox="0 0 ${cw} ${ch}"><image width="${cw}" height="${ch}" xlink:href="${dataUrl}"/></svg>`;
                                  try {
                                    sessionStorage.setItem("ai_illustrator_svg_import", svgOut);
                                    window.location.href = "/canvas";
                                  } catch {
                                    toast.error("Image too large for canvas transfer. Try downloading instead.");
                                  }
                                };
                                img.onerror = () => toast.error("Failed to load image for canvas import");
                                img.src = gen.image_url;
                              }}
                              className="px-3 py-1 rounded-full bg-primary text-white text-[10px] font-semibold hover:bg-primary/90"
                            >
                              Import to Canvas
                            </button>
                            <button
                              onClick={() => deleteGeneration(gen.id)}
                              className="px-3 py-1 rounded-full bg-rose-600 text-white text-[10px] font-semibold hover:bg-rose-700"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {totalPages > 1 && (
                      <div className="mt-3 flex items-center justify-between gap-2 px-1">
                        <button
                          type="button"
                          onClick={() => setHistoryPage((p) => Math.max(0, p - 1))}
                          disabled={safePage === 0}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold text-slate-600 border border-slate-200 bg-white hover:border-slate-300 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          ← Prev
                        </button>
                        <span className="text-[10px] tabular-nums font-medium text-slate-500">
                          Page {safePage + 1} of {totalPages}
                          <span className="text-slate-400 ml-1">
                            ({generations.length} total)
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setHistoryPage((p) => Math.min(totalPages - 1, p + 1))}
                          disabled={safePage >= totalPages - 1}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold text-slate-600 border border-slate-200 bg-white hover:border-slate-300 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Next →
                        </button>
                      </div>
                    )}
                    </>
                    );
                  })()}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </div>

      {/* Sign-up modal for unauthenticated users */}
      {showSignUpModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSignUpModal(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center relative" style={{ fontFamily: "Inter, sans-serif" }}>
            <button
              onClick={() => setShowSignUpModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-5">
              <Sparkles className="h-7 w-7 text-white" />
            </div>

            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Sign up to use AI Illustrator
            </h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Create a free account and earn AI generation credits by sharing your scientific illustrations with the community. No credit card required.
            </p>

            <div className="space-y-3 text-left mb-6">
              {[
                { step: "1", text: "Sign up for free — takes 30 seconds" },
                { step: "2", text: "Create and share 3 illustrations" },
                { step: "3", text: "Unlock 20 AI credits per month" },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">
                    {item.step}
                  </span>
                  <span className="text-sm text-slate-700">{item.text}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => navigate("/auth")}
                className="w-full py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Get Started Free
              </button>
              <button
                onClick={() => { setShowSignUpModal(false); navigate("/free-ai-credits"); }}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              >
                Learn how credits work
              </button>
            </div>
          </div>
        </div>
      )}

      <InsufficientGenerationsDialog
        open={showInsufficientCredits}
        onOpenChange={setShowInsufficientCredits}
      />

      <PurchaseCreditsDialog
        open={showPurchaseCredits}
        onOpenChange={setShowPurchaseCredits}
      />

      <RecolorPickerModal
        open={recolorMsgId !== null}
        onOpenChange={(open) => { if (!open) setRecolorMsgId(null); }}
        onSubmit={handleRecolorSubmit}
        submitting={recolorBusy}
      />

      <AspectRatioModal
        open={aspectMsgId !== null}
        onOpenChange={(open) => { if (!open) setAspectMsgId(null); }}
        onSubmit={handleAspectSubmit}
        submitting={aspectBusy}
      />

      {regionMsgId !== null && (() => {
        const src = messages.find((m) => m.id === regionMsgId)?.image;
        if (!src) return null;
        return (
          <RefineRegionOverlay
            imageUrl={src}
            submitting={regionBusy}
            onClose={() => { if (!regionBusy) setRegionMsgId(null); }}
            onSubmit={handleRegionSubmit}
          />
        );
      })()}

      {textEditMsgId !== null && (() => {
        const src = messages.find((m) => m.id === textEditMsgId)?.image;
        if (!src) return null;
        return (
          <TextEditOverlay
            imageUrl={src}
            submitting={textEditBusy}
            onClose={() => { if (!textEditBusy) setTextEditMsgId(null); }}
            onSubmit={handleTextEditSubmit}
          />
        );
      })()}

      <Dialog
        open={saveIconMsg !== null}
        onOpenChange={(open) => { if (!open && !savingIconInProgress) setSaveIconMsg(null); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save to icon library</DialogTitle>
            <DialogDescription>
              Adds this icon to your personal library. It'll show up in Canvas under Icon Library → My Library.
            </DialogDescription>
          </DialogHeader>

          {saveIconMsg?.image && (
            <div className="flex justify-center py-1">
              <img
                src={saveIconMsg.image}
                alt=""
                className="max-h-32 rounded-lg border border-slate-200 bg-slate-50 object-contain"
              />
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label htmlFor="save-icon-name" className="block text-xs font-bold text-slate-600 mb-1">
                Name <span className="text-primary">*</span>
              </label>
              <input
                id="save-icon-name"
                type="text"
                value={saveIconName}
                onChange={(e) => setSaveIconName(e.target.value)}
                placeholder="e.g. Mitochondrion (flat)"
                disabled={savingIconInProgress}
                className="w-full px-3 py-2 rounded-md border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="save-icon-tags" className="block text-xs font-bold text-slate-600 mb-1">
                Tags <span className="font-normal text-slate-400">(optional, comma-separated)</span>
              </label>
              <input
                id="save-icon-tags"
                type="text"
                value={saveIconTags}
                onChange={(e) => setSaveIconTags(e.target.value)}
                placeholder="e.g. organelle, cell biology, energy"
                disabled={savingIconInProgress}
                className="w-full px-3 py-2 rounded-md border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="save-icon-description" className="block text-xs font-bold text-slate-600 mb-1">
                Description <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                id="save-icon-description"
                value={saveIconDescription}
                onChange={(e) => setSaveIconDescription(e.target.value)}
                placeholder="Notes about this icon — where you'd use it, its context…"
                disabled={savingIconInProgress}
                rows={2}
                className="w-full px-3 py-2 rounded-md border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none disabled:opacity-60"
              />
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setSaveIconMsg(null)}
              disabled={savingIconInProgress}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-900 transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAsIconConfirm}
              disabled={savingIconInProgress || !saveIconName.trim()}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors disabled:opacity-60 inline-flex items-center gap-1.5"
            >
              {savingIconInProgress && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {savingIconInProgress ? "Saving…" : "Save icon"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AIIllustrator;
