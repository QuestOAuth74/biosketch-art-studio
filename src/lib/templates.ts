export interface Template {
  id: string;
  name: string;
  description: string;
  category: 'flowchart' | 'scientific' | 'business' | 'educational';
  thumbnail: string;
  canvasData: any;
  dimensions: { width: number; height: number };
  paperSize: string;
}

export const GETTING_STARTED_TEMPLATE: Template = {
  id: 'getting-started',
  name: 'Getting Started',
  description: 'Interactive guide to help you learn the basics',
  category: 'educational',
  paperSize: 'letter',
  dimensions: { width: 1200, height: 800 },
  thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjx0ZXh0IHg9IjE1MCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM3YzNhZWQiPkdldHRpbmcgU3RhcnRlZDwvdGV4dD48L3N2Zz4=',
  canvasData: {
    version: '6.0.0',
    objects: [
      // Welcome text box at top
      {
        type: 'textbox',
        left: 600,
        top: 50,
        width: 800,
        text: 'Welcome to BioSketch! 🎨',
        fontSize: 36,
        fontFamily: 'Inter',
        fontWeight: 700,
        fill: '#7c3aed',
        textAlign: 'center',
        originX: 'center',
      },
      {
        type: 'textbox',
        left: 600,
        top: 110,
        width: 900,
        text: 'Get started by exploring the tools below. Click on any object to select and edit it.',
        fontSize: 16,
        fontFamily: 'Inter',
        fill: '#64748b',
        textAlign: 'center',
        originX: 'center',
      },
      
      // Example shapes section
      {
        type: 'textbox',
        left: 150,
        top: 200,
        width: 200,
        text: 'Basic Shapes',
        fontSize: 20,
        fontFamily: 'Inter',
        fontWeight: 600,
        fill: '#1e293b',
      },
      {
        type: 'rect',
        left: 100,
        top: 250,
        width: 100,
        height: 80,
        fill: '#e0e7ff',
        stroke: '#7c3aed',
        strokeWidth: 2,
        rx: 8,
        ry: 8,
      },
      {
        type: 'circle',
        left: 240,
        top: 250,
        radius: 45,
        fill: '#fce7f3',
        stroke: '#ec4899',
        strokeWidth: 2,
      },
      {
        type: 'textbox',
        left: 100,
        top: 350,
        width: 200,
        text: 'Click shapes to select\nDrag to move\nResize using corners',
        fontSize: 13,
        fontFamily: 'Inter',
        fill: '#64748b',
        lineHeight: 1.5,
      },

      // Text example
      {
        type: 'textbox',
        left: 450,
        top: 200,
        width: 250,
        text: 'Add Text & Labels',
        fontSize: 20,
        fontFamily: 'Inter',
        fontWeight: 600,
        fill: '#1e293b',
      },
      {
        type: 'textbox',
        left: 450,
        top: 250,
        width: 300,
        text: 'Double-click any text to edit it. Use the toolbar to change colors, fonts, and styles.',
        fontSize: 14,
        fontFamily: 'Inter',
        fill: '#334155',
        lineHeight: 1.6,
      },
      {
        type: 'textbox',
        left: 450,
        top: 340,
        width: 200,
        text: '💡 Pro Tip:',
        fontSize: 14,
        fontFamily: 'Inter',
        fontWeight: 600,
        fill: '#7c3aed',
      },
      {
        type: 'textbox',
        left: 450,
        top: 365,
        width: 300,
        text: 'Press "T" to quickly add a text box, or use Ctrl+C/V to copy and paste objects.',
        fontSize: 13,
        fontFamily: 'Inter',
        fill: '#64748b',
        lineHeight: 1.6,
      },

      // Arrows and connectors
      {
        type: 'textbox',
        left: 850,
        top: 200,
        width: 250,
        text: 'Arrows & Connectors',
        fontSize: 20,
        fontFamily: 'Inter',
        fontWeight: 600,
        fill: '#1e293b',
      },
      {
        type: 'line',
        left: 850,
        top: 280,
        x1: 0,
        y1: 0,
        x2: 150,
        y2: 0,
        stroke: '#7c3aed',
        strokeWidth: 3,
      },
      {
        type: 'textbox',
        left: 850,
        top: 310,
        width: 300,
        text: 'Find arrows and connectors in the left toolbar to link your shapes together.',
        fontSize: 13,
        fontFamily: 'Inter',
        fill: '#64748b',
        lineHeight: 1.6,
      },

      // Action items box at bottom
      {
        type: 'rect',
        left: 100,
        top: 500,
        width: 1000,
        height: 180,
        fill: '#f8fafc',
        stroke: '#cbd5e1',
        strokeWidth: 2,
        rx: 12,
        ry: 12,
      },
      {
        type: 'textbox',
        left: 120,
        top: 520,
        width: 960,
        text: '🚀 Ready to Create?',
        fontSize: 24,
        fontFamily: 'Inter',
        fontWeight: 700,
        fill: '#1e293b',
        textAlign: 'center',
      },
      {
        type: 'textbox',
        left: 120,
        top: 570,
        width: 960,
        text: '1. Delete these examples (select and press Delete)\n2. Browse templates in the Menu bar or press Ctrl+Shift+T\n3. Add icons from the left sidebar\n4. Export your work as PNG or SVG when done',
        fontSize: 15,
        fontFamily: 'Inter',
        fill: '#475569',
        lineHeight: 1.8,
        textAlign: 'center',
      },
    ],
  },
};

export const TEMPLATES: Template[] = [
  // Scientific Templates
  {
    id: 'western-blot',
    name: 'Western Blot Figure',
    description: 'Basic western blot with lanes, bands, and labels for protein detection',
    category: 'scientific',
    paperSize: 'letter',
    dimensions: { width: 900, height: 700 },
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjxyZWN0IHg9IjUwIiB5PSI1MCIgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNmNWY1ZjUiIHN0cm9rZT0iIzMzMyIgc3Ryb2tlLXdpZHRoPSIyIi8+PGxpbmUgeDE9IjkwIiB5MT0iNTAiIHgyPSI5MCIgeTI9IjE1MCIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjEiLz48bGluZSB4MT0iMTMwIiB5MT0iNTAiIHgyPSIxMzAiIHkyPSIxNTAiIHN0cm9rZT0iIzMzMyIgc3Ryb2tlLXdpZHRoPSIxIi8+PGxpbmUgeDE9IjE3MCIgeTE9IjUwIiB4Mj0iMTcwIiB5Mj0iMTUwIiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iMSIvPjxsaW5lIHgxPSIyMTAiIHkxPSI1MCIgeDI9IjIxMCIgeTI9IjE1MCIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjEiLz48cmVjdCB4PSI2MCIgeT0iNzAiIHdpZHRoPSIyMCIgaGVpZ2h0PSI1IiBmaWxsPSIjNDQ0Ii8+PHJlY3QgeD0iMTAwIiB5PSI3MCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjUiIGZpbGw9IiM0NDQiLz48cmVjdCB4PSIxNDAiIHk9IjcwIiB3aWR0aD0iMjAiIGhlaWdodD0iNSIgZmlsbD0iIzQ0NCIvPjxyZWN0IHg9IjE4MCIgeT0iNzAiIHdpZHRoPSIyMCIgaGVpZ2h0PSI1IiBmaWxsPSIjNDQ0Ii8+PHRleHQgeD0iMTUwIiB5PSIxNzUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+V2VzdGVybiBCbG90PC90ZXh0Pjwvc3ZnPg==',
    canvasData: {
      version: '6.0.0',
      objects: [
        // Title
        { type: 'textbox', left: 450, top: 25, width: 400, text: 'Western Blot Analysis', fontSize: 22, fontFamily: 'Inter', fontWeight: 'bold', textAlign: 'center', originX: 'center' },
        // Subtitle - protein name
        { type: 'textbox', left: 450, top: 55, width: 300, text: 'Anti-TargetProtein (XX kDa)', fontSize: 14, fontFamily: 'Inter', textAlign: 'center', fill: '#555555', originX: 'center' },

        // Gel image area
        { type: 'rect', left: 160, top: 100, width: 660, height: 300, fill: '#e8e8e8', stroke: '#333333', strokeWidth: 2 },

        // Lane dividers (7 lanes = 6 dividers)
        { type: 'line', left: 270, top: 100, x1: 0, y1: 0, x2: 0, y2: 300, stroke: '#cccccc', strokeWidth: 1, strokeDashArray: [4, 4] },
        { type: 'line', left: 380, top: 100, x1: 0, y1: 0, x2: 0, y2: 300, stroke: '#cccccc', strokeWidth: 1, strokeDashArray: [4, 4] },
        { type: 'line', left: 490, top: 100, x1: 0, y1: 0, x2: 0, y2: 300, stroke: '#cccccc', strokeWidth: 1, strokeDashArray: [4, 4] },
        { type: 'line', left: 600, top: 100, x1: 0, y1: 0, x2: 0, y2: 300, stroke: '#cccccc', strokeWidth: 1, strokeDashArray: [4, 4] },
        { type: 'line', left: 710, top: 100, x1: 0, y1: 0, x2: 0, y2: 300, stroke: '#cccccc', strokeWidth: 1, strokeDashArray: [4, 4] },

        // Molecular weight markers (left side)
        { type: 'textbox', left: 110, top: 108, width: 45, text: '250', fontSize: 10, fontFamily: 'Inter', textAlign: 'right', fill: '#333333' },
        { type: 'line', left: 158, top: 115, x1: 0, y1: 0, x2: 8, y2: 0, stroke: '#999999', strokeWidth: 1 },
        { type: 'textbox', left: 110, top: 148, width: 45, text: '130', fontSize: 10, fontFamily: 'Inter', textAlign: 'right', fill: '#333333' },
        { type: 'line', left: 158, top: 155, x1: 0, y1: 0, x2: 8, y2: 0, stroke: '#999999', strokeWidth: 1 },
        { type: 'textbox', left: 110, top: 198, width: 45, text: '70', fontSize: 10, fontFamily: 'Inter', textAlign: 'right', fill: '#333333' },
        { type: 'line', left: 158, top: 205, x1: 0, y1: 0, x2: 8, y2: 0, stroke: '#999999', strokeWidth: 1 },
        { type: 'textbox', left: 110, top: 228, width: 45, text: '55', fontSize: 10, fontFamily: 'Inter', textAlign: 'right', fill: '#333333' },
        { type: 'line', left: 158, top: 235, x1: 0, y1: 0, x2: 8, y2: 0, stroke: '#999999', strokeWidth: 1 },
        { type: 'textbox', left: 110, top: 278, width: 45, text: '35', fontSize: 10, fontFamily: 'Inter', textAlign: 'right', fill: '#333333' },
        { type: 'line', left: 158, top: 285, x1: 0, y1: 0, x2: 8, y2: 0, stroke: '#999999', strokeWidth: 1 },
        { type: 'textbox', left: 110, top: 328, width: 45, text: '25', fontSize: 10, fontFamily: 'Inter', textAlign: 'right', fill: '#333333' },
        { type: 'line', left: 158, top: 335, x1: 0, y1: 0, x2: 8, y2: 0, stroke: '#999999', strokeWidth: 1 },
        { type: 'textbox', left: 100, top: 85, width: 55, text: 'kDa', fontSize: 10, fontFamily: 'Inter', textAlign: 'right', fill: '#333333', fontStyle: 'italic' },

        // Marker lane bands (lane 1 - multi-colored ladder)
        { type: 'rect', left: 185, top: 115, width: 60, height: 6, fill: '#1565c0', rx: 1, ry: 1 },
        { type: 'rect', left: 185, top: 155, width: 60, height: 6, fill: '#e65100', rx: 1, ry: 1 },
        { type: 'rect', left: 185, top: 205, width: 60, height: 6, fill: '#2e7d32', rx: 1, ry: 1 },
        { type: 'rect', left: 185, top: 235, width: 60, height: 6, fill: '#6a1b9a', rx: 1, ry: 1 },
        { type: 'rect', left: 185, top: 285, width: 60, height: 6, fill: '#c62828', rx: 1, ry: 1 },
        { type: 'rect', left: 185, top: 335, width: 60, height: 6, fill: '#ef6c00', rx: 1, ry: 1 },

        // Target protein bands (lanes 2-6, varying positions to show different expression)
        { type: 'rect', left: 295, top: 230, width: 60, height: 8, fill: '#222222', rx: 1, ry: 1 },
        { type: 'rect', left: 405, top: 228, width: 60, height: 10, fill: '#111111', rx: 1, ry: 1 },
        { type: 'rect', left: 515, top: 226, width: 60, height: 12, fill: '#000000', rx: 1, ry: 1 },
        { type: 'rect', left: 625, top: 227, width: 60, height: 11, fill: '#0a0a0a', rx: 1, ry: 1 },
        { type: 'rect', left: 735, top: 229, width: 60, height: 9, fill: '#181818', rx: 1, ry: 1 },

        // Lane labels at bottom
        { type: 'textbox', left: 170, top: 410, width: 80, text: 'Marker', fontSize: 11, fontFamily: 'Inter', textAlign: 'center' },
        { type: 'textbox', left: 280, top: 410, width: 80, text: 'Control', fontSize: 11, fontFamily: 'Inter', textAlign: 'center' },
        { type: 'textbox', left: 390, top: 410, width: 80, text: 'Treatment 1', fontSize: 11, fontFamily: 'Inter', textAlign: 'center' },
        { type: 'textbox', left: 500, top: 410, width: 80, text: 'Treatment 2', fontSize: 11, fontFamily: 'Inter', textAlign: 'center' },
        { type: 'textbox', left: 610, top: 410, width: 80, text: 'Treatment 3', fontSize: 11, fontFamily: 'Inter', textAlign: 'center' },
        { type: 'textbox', left: 720, top: 410, width: 80, text: 'Treatment 4', fontSize: 11, fontFamily: 'Inter', textAlign: 'center' },

        // Loading control section
        { type: 'textbox', left: 450, top: 450, width: 200, text: 'Loading Control', fontSize: 14, fontFamily: 'Inter', fontWeight: 'bold', textAlign: 'center', originX: 'center' },
        { type: 'rect', left: 160, top: 475, width: 660, height: 60, fill: '#e8e8e8', stroke: '#333333', strokeWidth: 2 },
        // Beta-actin bands (uniform across lanes)
        { type: 'rect', left: 185, top: 498, width: 60, height: 6, fill: '#333333', rx: 1, ry: 1 },
        { type: 'rect', left: 295, top: 498, width: 60, height: 6, fill: '#333333', rx: 1, ry: 1 },
        { type: 'rect', left: 405, top: 498, width: 60, height: 6, fill: '#333333', rx: 1, ry: 1 },
        { type: 'rect', left: 515, top: 498, width: 60, height: 6, fill: '#333333', rx: 1, ry: 1 },
        { type: 'rect', left: 625, top: 498, width: 60, height: 6, fill: '#333333', rx: 1, ry: 1 },
        { type: 'rect', left: 735, top: 498, width: 60, height: 6, fill: '#333333', rx: 1, ry: 1 },
        { type: 'textbox', left: 60, top: 495, width: 95, text: '\u03B2-actin\n(42 kDa)', fontSize: 10, fontFamily: 'Inter', textAlign: 'right', fill: '#333333' },

        // Caption area
        { type: 'textbox', left: 100, top: 560, width: 700, text: 'Figure X. Western blot analysis of TargetProtein expression. Cells were treated as indicated and lysates were probed with anti-TargetProtein antibody. \u03B2-actin served as a loading control.', fontSize: 12, fontFamily: 'Inter', textAlign: 'left', fill: '#444444', fontStyle: 'italic' },
      ],
    },
  },
  {
    id: 'microscopy-panel',
    name: 'Microscopy Panel',
    description: '2x2 image panel layout for microscopy or imaging data',
    category: 'scientific',
    paperSize: 'letter',
    dimensions: { width: 900, height: 750 },
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjxyZWN0IHg9IjMwIiB5PSIzMCIgd2lkdGg9IjExMCIgaGVpZ2h0PSI3MCIgZmlsbD0iI2U1ZTVlNSIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjIiLz48cmVjdCB4PSIxNjAiIHk9IjMwIiB3aWR0aD0iMTEwIiBoZWlnaHQ9IjcwIiBmaWxsPSIjZTVlNWU1IiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iMiIvPjxyZWN0IHg9IjMwIiB5PSIxMTAiIHdpZHRoPSIxMTAiIGhlaWdodD0iNzAiIGZpbGw9IiNlNWU1ZTUiIHN0cm9rZT0iIzMzMyIgc3Ryb2tlLXdpZHRoPSIyIi8+PHJlY3QgeD0iMTYwIiB5PSIxMTAiIHdpZHRoPSIxMTAiIGhlaWdodD0iNzAiIGZpbGw9IiNlNWU1ZTUiIHN0cm9rZT0iIzMzMyIgc3Ryb2tlLXdpZHRoPSIyIi8+PHRleHQgeD0iODUiIHk9IjcwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTAiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkE8L3RleHQ+PHRleHQgeD0iMjE1IiB5PSI3MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5CPC90ZXh0Pjx0ZXh0IHg9Ijg1IiB5PSIxNTAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+QzwvdGV4dD48dGV4dCB4PSIyMTUiIHk9IjE1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5EPC90ZXh0Pjwvc3ZnPg==',
    canvasData: {
      version: '6.0.0',
      objects: [
        // Title
        { type: 'textbox', left: 450, top: 25, width: 600, text: 'Figure X. Microscopy Analysis', fontSize: 20, fontFamily: 'Inter', fontWeight: 'bold', textAlign: 'center', originX: 'center' },

        // Panel A - top left
        { type: 'rect', left: 120, top: 70, width: 280, height: 200, fill: '#1a1a2e', stroke: '#333333', strokeWidth: 2 },
        { type: 'textbox', left: 128, top: 75, width: 30, text: 'A', fontSize: 18, fontFamily: 'Inter', fontWeight: 'bold', fill: '#ffffff', textAlign: 'left' },
        { type: 'textbox', left: 120, top: 278, width: 280, text: 'DAPI', fontSize: 13, fontFamily: 'Inter', textAlign: 'center', fill: '#333333' },

        // Panel B - top right
        { type: 'rect', left: 430, top: 70, width: 280, height: 200, fill: '#1a2e1a', stroke: '#333333', strokeWidth: 2 },
        { type: 'textbox', left: 438, top: 75, width: 30, text: 'B', fontSize: 18, fontFamily: 'Inter', fontWeight: 'bold', fill: '#ffffff', textAlign: 'left' },
        { type: 'textbox', left: 430, top: 278, width: 280, text: 'GFP', fontSize: 13, fontFamily: 'Inter', textAlign: 'center', fill: '#333333' },

        // Panel C - bottom left
        { type: 'rect', left: 120, top: 320, width: 280, height: 200, fill: '#2e1a1a', stroke: '#333333', strokeWidth: 2 },
        { type: 'textbox', left: 128, top: 325, width: 30, text: 'C', fontSize: 18, fontFamily: 'Inter', fontWeight: 'bold', fill: '#ffffff', textAlign: 'left' },
        { type: 'textbox', left: 120, top: 528, width: 280, text: 'RFP', fontSize: 13, fontFamily: 'Inter', textAlign: 'center', fill: '#333333' },

        // Panel D - bottom right
        { type: 'rect', left: 430, top: 320, width: 280, height: 200, fill: '#2a2a2a', stroke: '#333333', strokeWidth: 2 },
        { type: 'textbox', left: 438, top: 325, width: 30, text: 'D', fontSize: 18, fontFamily: 'Inter', fontWeight: 'bold', fill: '#ffffff', textAlign: 'left' },
        { type: 'textbox', left: 430, top: 528, width: 280, text: 'Merge', fontSize: 13, fontFamily: 'Inter', textAlign: 'center', fill: '#333333' },

        // Scale bar in panel D (bottom-right corner)
        { type: 'rect', left: 630, top: 500, width: 60, height: 4, fill: '#ffffff' },
        { type: 'textbox', left: 620, top: 505, width: 80, text: '100 \u03BCm', fontSize: 10, fontFamily: 'Inter', textAlign: 'center', fill: '#ffffff' },

        // Caption area
        { type: 'textbox', left: 80, top: 570, width: 740, text: 'Figure X. Representative fluorescence microscopy images of cells stained with DAPI (A), GFP (B), RFP (C), and merged channels (D). Scale bar = 100 \u03BCm.', fontSize: 12, fontFamily: 'Inter', textAlign: 'left', fill: '#444444', fontStyle: 'italic' },
      ],
    },
  },
  {
    id: 'cell-workflow',
    name: 'Cell Culture Workflow',
    description: 'Step-by-step cell culture process with arrows and labels',
    category: 'scientific',
    paperSize: 'letter',
    dimensions: { width: 1100, height: 550 },
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iMTAwIiByPSIyNSIgZmlsbD0iI2U4ZjVlOSIgc3Ryb2tlPSIjNGNhZjUwIiBzdHJva2Utd2lkdGg9IjIiLz48bGluZSB4MT0iNzUiIHkxPSIxMDAiIHgyPSIxMTAiIHkyPSIxMDAiIHN0cm9rZT0iIzMzMyIgc3Ryb2tlLXdpZHRoPSIyIiBtYXJrZXItZW5kPSJ1cmwoI2Fycm93KSIvPjxyZWN0IHg9IjExMCIgeT0iNzUiIHdpZHRoPSI2MCIgaGVpZ2h0PSI1MCIgZmlsbD0iI2UzZjJmZCIgc3Ryb2tlPSIjMjE5NmYzIiBzdHJva2Utd2lkdGg9IjIiLz48bGluZSB4MT0iMTcwIiB5MT0iMTAwIiB4Mj0iMjA1IiB5Mj0iMTAwIiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iMiIgbWFya2VyLWVuZD0idXJsKCNhcnJvdykiLz48Y2lyY2xlIGN4PSIyMzAiIGN5PSIxMDAiIHI9IjI1IiBmaWxsPSIjZmZlYmVlIiBzdHJva2U9IiNmZjU3MjIiIHN0cm9rZS13aWR0aD0iMiIvPjx0ZXh0IHg9IjUwIiB5PSIxNTUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+U2VlZDwvdGV4dD48dGV4dCB4PSIxNDAiIHk9IjE1NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5DdWx0dXJlPC90ZXh0Pjx0ZXh0IHg9IjIzMCIgeT0iMTU1IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTAiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkFuYWx5c2lzPC90ZXh0PjxkZWZzPjxtYXJrZXIgaWQ9ImFycm93IiBtYXJrZXJXaWR0aD0iMTAiIG1hcmtlckhlaWdodD0iMTAiIHJlZlg9IjUiIHJlZlk9IjMiIG9yaWVudD0iYXV0byI+PHBhdGggZD0iTSAwIDAgTCA1IDMgTCAwIDYiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzMzMyIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9tYXJrZXI+PC9kZWZzPjwvc3ZnPg==',
    canvasData: {
      version: '6.0.0',
      objects: [
        // Title
        { type: 'textbox', left: 550, top: 30, width: 500, text: 'Cell Culture Workflow', fontSize: 22, fontFamily: 'Inter', textAlign: 'center', fontWeight: 'bold', originX: 'center' },

        // Step 1: Seed
        { type: 'rect', left: 60, top: 140, width: 180, height: 160, fill: '#e8f5e9', stroke: '#4caf50', strokeWidth: 3, rx: 12, ry: 12 },
        { type: 'rect', left: 90, top: 155, width: 120, height: 50, fill: '#c8e6c9', stroke: '#388e3c', strokeWidth: 1, rx: 6, ry: 6 },
        { type: 'textbox', left: 90, top: 162, width: 120, text: '\uD83E\uDDEB', fontSize: 24, fontFamily: 'Inter', textAlign: 'center' },
        { type: 'textbox', left: 70, top: 215, width: 160, text: 'Seed Cells', fontSize: 16, fontFamily: 'Inter', textAlign: 'center', fontWeight: 'bold' },
        { type: 'textbox', left: 70, top: 240, width: 160, text: '5\u00D710\u2074 cells/well\n6-well plate', fontSize: 11, fontFamily: 'Inter', textAlign: 'center', fill: '#555555' },

        // Arrow 1
        { type: 'textbox', left: 250, top: 205, width: 50, text: '\u2192', fontSize: 28, fontFamily: 'Inter', textAlign: 'center', fill: '#333333', fontWeight: 'bold' },
        // Time label 1
        { type: 'textbox', left: 245, top: 180, width: 60, text: '24h', fontSize: 12, fontFamily: 'Inter', textAlign: 'center', fill: '#888888', fontStyle: 'italic' },

        // Step 2: Culture
        { type: 'rect', left: 310, top: 140, width: 180, height: 160, fill: '#e3f2fd', stroke: '#2196f3', strokeWidth: 3, rx: 12, ry: 12 },
        { type: 'rect', left: 340, top: 155, width: 120, height: 50, fill: '#bbdefb', stroke: '#1565c0', strokeWidth: 1, rx: 6, ry: 6 },
        { type: 'textbox', left: 340, top: 162, width: 120, text: '\uD83E\uDDEA', fontSize: 24, fontFamily: 'Inter', textAlign: 'center' },
        { type: 'textbox', left: 320, top: 215, width: 160, text: 'Culture', fontSize: 16, fontFamily: 'Inter', textAlign: 'center', fontWeight: 'bold' },
        { type: 'textbox', left: 320, top: 240, width: 160, text: '37\u00B0C, 5% CO\u2082\nComplete media', fontSize: 11, fontFamily: 'Inter', textAlign: 'center', fill: '#555555' },

        // Arrow 2
        { type: 'textbox', left: 500, top: 205, width: 50, text: '\u2192', fontSize: 28, fontFamily: 'Inter', textAlign: 'center', fill: '#333333', fontWeight: 'bold' },
        // Time label 2
        { type: 'textbox', left: 495, top: 180, width: 60, text: '48h', fontSize: 12, fontFamily: 'Inter', textAlign: 'center', fill: '#888888', fontStyle: 'italic' },

        // Step 3: Treat
        { type: 'rect', left: 560, top: 140, width: 180, height: 160, fill: '#fff3e0', stroke: '#ff9800', strokeWidth: 3, rx: 12, ry: 12 },
        { type: 'rect', left: 590, top: 155, width: 120, height: 50, fill: '#ffe0b2', stroke: '#e65100', strokeWidth: 1, rx: 6, ry: 6 },
        { type: 'textbox', left: 590, top: 162, width: 120, text: '\uD83D\uDC89', fontSize: 24, fontFamily: 'Inter', textAlign: 'center' },
        { type: 'textbox', left: 570, top: 215, width: 160, text: 'Treat', fontSize: 16, fontFamily: 'Inter', textAlign: 'center', fontWeight: 'bold' },
        { type: 'textbox', left: 570, top: 240, width: 160, text: 'Drug X (10 \u03BCM)\nVehicle control', fontSize: 11, fontFamily: 'Inter', textAlign: 'center', fill: '#555555' },

        // Arrow 3
        { type: 'textbox', left: 750, top: 205, width: 50, text: '\u2192', fontSize: 28, fontFamily: 'Inter', textAlign: 'center', fill: '#333333', fontWeight: 'bold' },
        // Time label 3
        { type: 'textbox', left: 745, top: 180, width: 60, text: '72h', fontSize: 12, fontFamily: 'Inter', textAlign: 'center', fill: '#888888', fontStyle: 'italic' },

        // Step 4: Analyze
        { type: 'rect', left: 810, top: 140, width: 180, height: 160, fill: '#fce4ec', stroke: '#e91e63', strokeWidth: 3, rx: 12, ry: 12 },
        { type: 'rect', left: 840, top: 155, width: 120, height: 50, fill: '#f8bbd0', stroke: '#ad1457', strokeWidth: 1, rx: 6, ry: 6 },
        { type: 'textbox', left: 840, top: 162, width: 120, text: '\uD83D\uDCCA', fontSize: 24, fontFamily: 'Inter', textAlign: 'center' },
        { type: 'textbox', left: 820, top: 215, width: 160, text: 'Analyze', fontSize: 16, fontFamily: 'Inter', textAlign: 'center', fontWeight: 'bold' },
        { type: 'textbox', left: 820, top: 240, width: 160, text: 'Western blot\nFlow cytometry', fontSize: 11, fontFamily: 'Inter', textAlign: 'center', fill: '#555555' },

        // Notes section
        { type: 'textbox', left: 60, top: 340, width: 930, text: 'Notes:', fontSize: 14, fontFamily: 'Inter', fontWeight: 'bold', fill: '#333333' },
        { type: 'rect', left: 60, top: 365, width: 930, height: 120, fill: '#fafafa', stroke: '#cccccc', strokeWidth: 1, rx: 6, ry: 6 },
        { type: 'textbox', left: 75, top: 375, width: 900, text: '\u2022 Passage cells at 80% confluency before seeding\n\u2022 Change media every 24 hours\n\u2022 Include biological triplicates for each condition\n\u2022 Harvest cells on ice for protein analysis', fontSize: 12, fontFamily: 'Inter', fill: '#555555' },
      ],
    },
  },
  // Flowchart Templates
  {
    id: 'basic-flowchart',
    name: 'Basic Flowchart',
    description: 'Simple process flowchart with start, decision, and end points',
    category: 'flowchart',
    paperSize: 'letter',
    dimensions: { width: 800, height: 600 },
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjxyZWN0IHg9IjExMCIgeT0iMjAiIHdpZHRoPSI4MCIgaGVpZ2h0PSIzMCIgZmlsbD0iI2U4ZjVlOSIgc3Ryb2tlPSIjNGNhZjUwIiBzdHJva2Utd2lkdGg9IjIiIHJ4PSIxNSIvPjxsaW5lIHgxPSIxNTAiIHkxPSI1MCIgeDI9IjE1MCIgeTI9IjcwIiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iMiIvPjxyZWN0IHg9IjExMCIgeT0iNzAiIHdpZHRoPSI4MCIgaGVpZ2h0PSIzMCIgZmlsbD0iI2UzZjJmZCIgc3Ryb2tlPSIjMjE5NmYzIiBzdHJva2Utd2lkdGg9IjIiLz48bGluZSB4MT0iMTUwIiB5MT0iMTAwIiB4Mj0iMTUwIiB5Mj0iMTIwIiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iMiIvPjxwb2x5Z29uIHBvaW50cz0iMTUwLDEyMCAxMjAsMTQ1IDE1MCwxNzAgMTgwLDE0NSIgZmlsbD0iI2ZmZjNlMCIgc3Ryb2tlPSIjZmZiMzAwIiBzdHJva2Utd2lkdGg9IjIiLz48dGV4dCB4PSIxNTAiIHk9IjM3IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTAiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlN0YXJ0PC90ZXh0Pjx0ZXh0IHg9IjE1MCIgeT0iODgiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Qcm9jZXNzPC90ZXh0Pjx0ZXh0IHg9IjE1MCIgeT0iMTUwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iOCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+RGVjaXNpb248L3RleHQ+PC9zdmc+',
    canvasData: {
      version: '6.0.0',
      objects: [
        // Start
        { type: 'rect', left: 350, top: 80, width: 100, height: 50, fill: '#e8f5e9', stroke: '#4caf50', strokeWidth: 2, rx: 25, ry: 25 },
        { type: 'textbox', left: 365, top: 97, width: 70, text: 'Start', fontSize: 16, fontFamily: 'Inter', textAlign: 'center', fontWeight: 'bold' },
        
        // Arrow down
        { 
          type: 'group',
          left: 400,
          top: 130,
          subTargetCheck: false,
          objects: [
            { type: 'line', x1: 0, y1: 0, x2: 0, y2: 40, stroke: '#333333', strokeWidth: 2, selectable: false, evented: false },
            { type: 'polygon', points: [{x:0,y:40},{x:-5,y:30},{x:5,y:30}], fill: '#333333', stroke: '#333333', strokeWidth: 1, selectable: false, evented: false }
          ]
        },
        
        // Process
        { type: 'rect', left: 350, top: 180, width: 100, height: 50, fill: '#e3f2fd', stroke: '#2196f3', strokeWidth: 2 },
        { type: 'textbox', left: 355, top: 195, width: 90, text: 'Process\nStep', fontSize: 14, fontFamily: 'Inter', textAlign: 'center' },
        
        // Arrow down
        { 
          type: 'group',
          left: 400,
          top: 230,
          subTargetCheck: false,
          objects: [
            { type: 'line', x1: 0, y1: 0, x2: 0, y2: 40, stroke: '#333333', strokeWidth: 2, selectable: false, evented: false },
            { type: 'polygon', points: [{x:0,y:40},{x:-5,y:30},{x:5,y:30}], fill: '#333333', stroke: '#333333', strokeWidth: 1, selectable: false, evented: false }
          ]
        },
        
        // Decision diamond
        { type: 'polygon', left: 400, top: 280, points: [{x:0,y:-40},{x:50,y:0},{x:0,y:40},{x:-50,y:0}], fill: '#fff3e0', stroke: '#ffb300', strokeWidth: 2 },
        { type: 'textbox', left: 365, top: 272, width: 70, text: 'Decision?', fontSize: 14, fontFamily: 'Inter', textAlign: 'center' },
        
        // Yes arrow (right)
        { 
          type: 'group',
          left: 450,
          top: 280,
          subTargetCheck: false,
          objects: [
            { type: 'line', x1: 0, y1: 0, x2: 60, y2: 0, stroke: '#333333', strokeWidth: 2, selectable: false, evented: false },
            { type: 'polygon', points: [{x:60,y:0},{x:50,y:-5},{x:50,y:5}], fill: '#333333', stroke: '#333333', strokeWidth: 1, selectable: false, evented: false }
          ]
        },
        { type: 'textbox', left: 460, top: 255, width: 30, text: 'Yes', fontSize: 12, fontFamily: 'Inter' },
        
        // Process 2 (right)
        { type: 'rect', left: 520, top: 255, width: 100, height: 50, fill: '#e3f2fd', stroke: '#2196f3', strokeWidth: 2 },
        { type: 'textbox', left: 525, top: 270, width: 90, text: 'Action A', fontSize: 14, fontFamily: 'Inter', textAlign: 'center' },
        
        // No arrow (down)
        { 
          type: 'group',
          left: 400,
          top: 320,
          subTargetCheck: false,
          objects: [
            { type: 'line', x1: 0, y1: 0, x2: 0, y2: 40, stroke: '#333333', strokeWidth: 2, selectable: false, evented: false },
            { type: 'polygon', points: [{x:0,y:40},{x:-5,y:30},{x:5,y:30}], fill: '#333333', stroke: '#333333', strokeWidth: 1, selectable: false, evented: false }
          ]
        },
        { type: 'textbox', left: 405, top: 330, width: 30, text: 'No', fontSize: 12, fontFamily: 'Inter' },
        
        // Process 3 (down)
        { type: 'rect', left: 350, top: 370, width: 100, height: 50, fill: '#e3f2fd', stroke: '#2196f3', strokeWidth: 2 },
        { type: 'textbox', left: 355, top: 385, width: 90, text: 'Action B', fontSize: 14, fontFamily: 'Inter', textAlign: 'center' },
        
        // Arrows to End - combined into single path with arrow
        { 
          type: 'group',
          left: 570,
          top: 305,
          subTargetCheck: false,
          objects: [
            { type: 'line', x1: 0, y1: 0, x2: 0, y2: 135, stroke: '#333333', strokeWidth: 2, selectable: false, evented: false },
            { type: 'polygon', points: [{x:0,y:135},{x:-5,y:125},{x:5,y:125}], fill: '#333333', stroke: '#333333', strokeWidth: 1, selectable: false, evented: false }
          ]
        },
        { type: 'line', left: 400, top: 420, x1: 0, y1: 0, x2: 170, y2: 0, stroke: '#333333', strokeWidth: 2 },
        
        // End
        { type: 'rect', left: 520, top: 450, width: 100, height: 50, fill: '#ffebee', stroke: '#f44336', strokeWidth: 2, rx: 25, ry: 25 },
        { type: 'textbox', left: 535, top: 467, width: 70, text: 'End', fontSize: 16, fontFamily: 'Inter', textAlign: 'center', fontWeight: 'bold' },
      ],
    },
  },
  {
    id: 'swim-lane',
    name: 'Swim Lane Diagram',
    description: 'Cross-functional process flow with department lanes',
    category: 'flowchart',
    paperSize: 'letter',
    dimensions: { width: 1000, height: 700 },
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjxyZWN0IHg9IjIwIiB5PSIyMCIgd2lkdGg9IjI2MCIgaGVpZ2h0PSI1MCIgZmlsbD0iI2YwZjBmMCIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjEiLz48cmVjdCB4PSIyMCIgeT0iNzAiIHdpZHRoPSIyNjAiIGhlaWdodD0iNTAiIGZpbGw9IiNmOWY5ZjkiIHN0cm9rZT0iIzMzMyIgc3Ryb2tlLXdpZHRoPSIxIi8+PHJlY3QgeD0iMjAiIHk9IjEyMCIgd2lkdGg9IjI2MCIgaGVpZ2h0PSI1MCIgZmlsbD0iI2YwZjBmMCIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjEiLz48cmVjdCB4PSI0MCIgeT0iMzUiIHdpZHRoPSI1MCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2UzZjJmZCIgc3Ryb2tlPSIjMjE5NmYzIiBzdHJva2Utd2lkdGg9IjEiLz48cmVjdCB4PSIxMjAiIHk9Ijg1IiB3aWR0aD0iNTAiIGhlaWdodD0iMjAiIGZpbGw9IiNlM2YyZmQiIHN0cm9rZT0iIzIxOTZmMyIgc3Ryb2tlLXdpZHRoPSIxIi8+PHJlY3QgeD0iMjAwIiB5PSIxMzUiIHdpZHRoPSI1MCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2UzZjJmZCIgc3Ryb2tlPSIjMjE5NmYzIiBzdHJva2Utd2lkdGg9IjEiLz48dGV4dCB4PSI4MCIgeT0iMTgiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXdlaWdodD0iYm9sZCI+RGVwdCBBPC90ZXh0Pjx0ZXh0IHg9IjE0NSIgeT0iNjgiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXdlaWdodD0iYm9sZCI+RGVwdCBCPC90ZXh0Pjx0ZXh0IHg9IjIyNSIgeT0iMTE4IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iOSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC13ZWlnaHQ9ImJvbGQiPkRlcHQgQzwvdGV4dD48L3N2Zz4=',
    canvasData: {
      version: '6.0.0',
      objects: [
        // Lane backgrounds
        { type: 'rect', left: 50, top: 100, width: 900, height: 120, fill: '#f5f5f5', stroke: '#999999', strokeWidth: 1 },
        { type: 'rect', left: 50, top: 220, width: 900, height: 120, fill: '#fafafa', stroke: '#999999', strokeWidth: 1 },
        { type: 'rect', left: 50, top: 340, width: 900, height: 120, fill: '#f5f5f5', stroke: '#999999', strokeWidth: 1 },
        
        // Lane labels
        { type: 'textbox', left: 60, top: 140, width: 140, text: 'Department A', fontSize: 16, fontFamily: 'Inter', fontWeight: 'bold', fill: '#555555' },
        { type: 'textbox', left: 60, top: 260, width: 140, text: 'Department B', fontSize: 16, fontFamily: 'Inter', fontWeight: 'bold', fill: '#555555' },
        { type: 'textbox', left: 60, top: 380, width: 140, text: 'Department C', fontSize: 16, fontFamily: 'Inter', fontWeight: 'bold', fill: '#555555' },
        
        // Process boxes in lanes
        { type: 'rect', left: 250, top: 130, width: 120, height: 60, fill: '#e3f2fd', stroke: '#2196f3', strokeWidth: 2 },
        { type: 'textbox', left: 260, top: 150, width: 100, text: 'Task 1', fontSize: 14, fontFamily: 'Inter', textAlign: 'center' },
        
        { type: 'rect', left: 500, top: 250, width: 120, height: 60, fill: '#e3f2fd', stroke: '#2196f3', strokeWidth: 2 },
        { type: 'textbox', left: 510, top: 270, width: 100, text: 'Task 2', fontSize: 14, fontFamily: 'Inter', textAlign: 'center' },
        
        { type: 'rect', left: 750, top: 370, width: 120, height: 60, fill: '#e3f2fd', stroke: '#2196f3', strokeWidth: 2 },
        { type: 'textbox', left: 760, top: 390, width: 100, text: 'Task 3', fontSize: 14, fontFamily: 'Inter', textAlign: 'center' },
        
        // Connecting arrows
        { type: 'line', left: 370, top: 160, x1: 0, y1: 0, x2: 80, y2: 90, stroke: '#333333', strokeWidth: 2 },
        { type: 'polygon', left: 445, top: 245, points: [{x:0,y:0},{x:-8,y:-5},{x:-5,y:-8}], fill: '#333333' },
        
        { type: 'line', left: 620, top: 280, x1: 0, y1: 0, x2: 80, y2: 90, stroke: '#333333', strokeWidth: 2 },
        { type: 'polygon', left: 695, top: 365, points: [{x:0,y:0},{x:-8,y:-5},{x:-5,y:-8}], fill: '#333333' },
        
        // Title
        { type: 'textbox', left: 300, top: 50, width: 400, text: 'Cross-Functional Process Flow', fontSize: 20, fontFamily: 'Inter', textAlign: 'center', fontWeight: 'bold' },
      ],
    },
  },
  
  // ─── Diagrams & Flowcharts ───

  {
    id: 'experimental-flowchart',
    name: 'Experimental Flowchart',
    description: 'Sample collection → treatment → analysis → results pipeline',
    category: 'flowchart',
    paperSize: 'letter',
    dimensions: { width: 1200, height: 700 },
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjxyZWN0IHg9IjEwIiB5PSI3MCIgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiByeD0iMzAiIGZpbGw9IiMxZDRlZDgiLz48cmVjdCB4PSI4NSIgeT0iNzAiIHdpZHRoPSI1MCIgaGVpZ2h0PSI2MCIgcng9IjQiIGZpbGw9IiM3YzNhZWQiLz48cmVjdCB4PSIxNTAiIHk9IjcwIiB3aWR0aD0iNTAiIGhlaWdodD0iNjAiIHJ4PSI0IiBmaWxsPSIjMTZhMzRhIi8+PHJlY3QgeD0iMjE1IiB5PSI3MCIgd2lkdGg9IjUwIiBoZWlnaHQ9IjYwIiByeD0iNCIgZmlsbD0iI2VhNTgwYyIvPjx0ZXh0IHg9IjE1MCIgeT0iMzAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC13ZWlnaHQ9ImJvbGQiPkV4cGVyaW1lbnRhbCBGbG93Y2hhcnQ8L3RleHQ+PC9zdmc+',
    canvasData: {
      version: '6.0.0',
      objects: [
        // Title
        { type: 'textbox', left: 600, top: 25, width: 1000, text: 'Experimental Flowchart', fontSize: 24, fontFamily: 'Inter', fontWeight: 700, fill: '#1e293b', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 600, top: 58, width: 800, text: 'Customize each step with your experimental details and add icons from the sidebar', fontSize: 13, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },

        // Step 1: Sample Collection (rounded/pill shape)
        { type: 'rect', left: 40, top: 120, width: 220, height: 180, fill: '#eff6ff', stroke: '#1d4ed8', strokeWidth: 2, rx: 100, ry: 100 },
        { type: 'textbox', left: 150, top: 155, width: 180, text: 'Sample\nCollection', fontSize: 18, fontFamily: 'Inter', fontWeight: 700, fill: '#1d4ed8', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 150, top: 215, width: 160, text: '• Tissue / blood / cells\n• n = __ per group\n• Storage conditions', fontSize: 11, fontFamily: 'Inter', fill: '#475569', textAlign: 'center', originX: 'center', lineHeight: 1.5 },

        // Arrow 1→2
        { type: 'textbox', left: 290, top: 195, width: 40, text: '→', fontSize: 32, fontFamily: 'Inter', fill: '#cbd5e1', textAlign: 'center', originX: 'center' },

        // Step 2: Treatment / Processing
        { type: 'rect', left: 320, top: 120, width: 220, height: 180, fill: '#f5f3ff', stroke: '#7c3aed', strokeWidth: 2, rx: 10, ry: 10 },
        { type: 'textbox', left: 430, top: 135, width: 180, text: 'Treatment /', fontSize: 18, fontFamily: 'Inter', fontWeight: 700, fill: '#7c3aed', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 430, top: 160, width: 180, text: 'Processing', fontSize: 18, fontFamily: 'Inter', fontWeight: 700, fill: '#7c3aed', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 430, top: 215, width: 180, text: '• Drug / compound / stimulus\n• Concentrations used\n• Duration of treatment', fontSize: 11, fontFamily: 'Inter', fill: '#475569', textAlign: 'center', originX: 'center', lineHeight: 1.5 },

        // Arrow 2→3
        { type: 'textbox', left: 570, top: 195, width: 40, text: '→', fontSize: 32, fontFamily: 'Inter', fill: '#cbd5e1', textAlign: 'center', originX: 'center' },

        // Step 3: Analysis / Assay (diamond-ish with rx)
        { type: 'rect', left: 600, top: 120, width: 220, height: 180, fill: '#f0fdf4', stroke: '#16a34a', strokeWidth: 2, rx: 10, ry: 10 },
        { type: 'textbox', left: 710, top: 145, width: 180, text: 'Analysis / Assay', fontSize: 18, fontFamily: 'Inter', fontWeight: 700, fill: '#16a34a', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 710, top: 215, width: 180, text: '• qPCR / Western Blot\n• Flow cytometry\n• Imaging / microscopy', fontSize: 11, fontFamily: 'Inter', fill: '#475569', textAlign: 'center', originX: 'center', lineHeight: 1.5 },

        // Arrow 3→4
        { type: 'textbox', left: 850, top: 195, width: 40, text: '→', fontSize: 32, fontFamily: 'Inter', fill: '#cbd5e1', textAlign: 'center', originX: 'center' },

        // Step 4: Results / Data
        { type: 'rect', left: 880, top: 120, width: 220, height: 180, fill: '#fff7ed', stroke: '#ea580c', strokeWidth: 2, rx: 10, ry: 10 },
        { type: 'textbox', left: 990, top: 145, width: 180, text: 'Results / Data', fontSize: 18, fontFamily: 'Inter', fontWeight: 700, fill: '#ea580c', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 990, top: 215, width: 180, text: '• Graphs / charts\n• Statistical analysis\n• Key observations', fontSize: 11, fontFamily: 'Inter', fill: '#475569', textAlign: 'center', originX: 'center', lineHeight: 1.5 },

        // === DETAILS ROW (below) ===
        { type: 'rect', left: 40, top: 350, width: 1120, height: 2, fill: '#e2e8f0' },

        // Controls section
        { type: 'rect', left: 40, top: 380, width: 350, height: 140, fill: '#fefce8', stroke: '#ca8a04', strokeWidth: 1.5, rx: 8, ry: 8 },
        { type: 'textbox', left: 215, top: 395, width: 310, text: 'Controls', fontSize: 15, fontFamily: 'Inter', fontWeight: 700, fill: '#854d0e', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 215, top: 425, width: 310, text: '• Positive control: ___\n• Negative control: ___\n• Vehicle control: ___', fontSize: 12, fontFamily: 'Inter', fill: '#713f12', textAlign: 'center', originX: 'center', lineHeight: 1.6 },

        // Replicates section
        { type: 'rect', left: 420, top: 380, width: 350, height: 140, fill: '#fdf2f8', stroke: '#db2777', strokeWidth: 1.5, rx: 8, ry: 8 },
        { type: 'textbox', left: 595, top: 395, width: 310, text: 'Replicates & Statistics', fontSize: 15, fontFamily: 'Inter', fontWeight: 700, fill: '#9d174d', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 595, top: 425, width: 310, text: '• Biological replicates: n = __\n• Technical replicates: __\n• Statistical test: ___', fontSize: 12, fontFamily: 'Inter', fill: '#831843', textAlign: 'center', originX: 'center', lineHeight: 1.6 },

        // Output section
        { type: 'rect', left: 800, top: 380, width: 360, height: 140, fill: '#f0f9ff', stroke: '#0284c7', strokeWidth: 1.5, rx: 8, ry: 8 },
        { type: 'textbox', left: 980, top: 395, width: 320, text: 'Expected Output', fontSize: 15, fontFamily: 'Inter', fontWeight: 700, fill: '#075985', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 980, top: 425, width: 320, text: '• Primary endpoint: ___\n• Secondary endpoints: ___\n• Timeline: ___', fontSize: 12, fontFamily: 'Inter', fill: '#0c4a6e', textAlign: 'center', originX: 'center', lineHeight: 1.6 },

        // Footer
        { type: 'textbox', left: 600, top: 555, width: 1000, text: 'Tip: Replace placeholder text, drag icons from the sidebar, and use line tools to connect steps.', fontSize: 12, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },
      ],
      background: '#ffffff',
    },
  },

  {
    id: 'decision-tree',
    name: 'Clinical Decision Tree',
    description: 'Branching diagnostic or clinical decision logic with yes/no paths',
    category: 'flowchart',
    paperSize: 'letter',
    dimensions: { width: 1200, height: 800 },
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjxwb2x5Z29uIHBvaW50cz0iMTUwLDMwIDExMCw3MCAxOTAsNzAiIGZpbGw9IiNmZWYzYzciIHN0cm9rZT0iI2NhOGEwNCIgc3Ryb2tlLXdpZHRoPSIxLjUiLz48bGluZSB4MT0iMTIwIiB5MT0iNzAiIHgyPSI3MCIgeTI9IjExMCIgc3Ryb2tlPSIjMTZhMzRhIiBzdHJva2Utd2lkdGg9IjEuNSIvPjxsaW5lIHgxPSIxODAiIHkxPSI3MCIgeDI9IjIzMCIgeTI9IjExMCIgc3Ryb2tlPSIjZGMyNjI2IiBzdHJva2Utd2lkdGg9IjEuNSIvPjxyZWN0IHg9IjMwIiB5PSIxMTAiIHdpZHRoPSI4MCIgaGVpZ2h0PSI0MCIgcng9IjQiIGZpbGw9IiNmMGZkZjQiIHN0cm9rZT0iIzE2YTM0YSIgc3Ryb2tlLXdpZHRoPSIxIi8+PHJlY3QgeD0iMTkwIiB5PSIxMTAiIHdpZHRoPSI4MCIgaGVpZ2h0PSI0MCIgcng9IjQiIGZpbGw9IiNmZWYyZjIiIHN0cm9rZT0iI2RjMjYyNiIgc3Ryb2tlLXdpZHRoPSIxIi8+PHRleHQgeD0iMTUwIiB5PSI1NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjgiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkRlY2lzaW9uPC90ZXh0Pjx0ZXh0IHg9IjkwIiB5PSI5NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjgiIGZpbGw9IiMxNmEzNGEiPlllczwvdGV4dD48dGV4dCB4PSIyMTAiIHk9Ijk1IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iOCIgZmlsbD0iI2RjMjYyNiI+Tm88L3RleHQ+PC9zdmc+',
    canvasData: {
      version: '6.0.0',
      objects: [
        // Title
        { type: 'textbox', left: 600, top: 20, width: 1000, text: 'Clinical Decision Tree', fontSize: 24, fontFamily: 'Inter', fontWeight: 700, fill: '#1e293b', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 600, top: 52, width: 800, text: 'Edit decision nodes, add branches with the line tool, and customize outcomes', fontSize: 13, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },

        // === LEVEL 1: Initial Assessment ===
        { type: 'rect', left: 450, top: 100, width: 300, height: 60, fill: '#1d4ed8', stroke: '#1e40af', strokeWidth: 2, rx: 30, ry: 30 },
        { type: 'textbox', left: 600, top: 118, width: 260, text: 'Patient Presents with\nSymptom X', fontSize: 14, fontFamily: 'Inter', fontWeight: 700, fill: '#ffffff', textAlign: 'center', originX: 'center' },

        // Arrow down to decision 1
        { type: 'rect', left: 598, top: 160, width: 4, height: 30, fill: '#64748b' },

        // === LEVEL 2: Decision 1 (diamond) ===
        { type: 'rect', left: 475, top: 190, width: 250, height: 70, fill: '#fef3c7', stroke: '#ca8a04', strokeWidth: 2, rx: 8, ry: 8 },
        { type: 'textbox', left: 600, top: 210, width: 220, text: 'Meets Criteria A?', fontSize: 15, fontFamily: 'Inter', fontWeight: 700, fill: '#854d0e', textAlign: 'center', originX: 'center' },

        // YES branch (left)
        { type: 'rect', left: 350, top: 250, width: 4, height: 40, fill: '#16a34a' },
        { type: 'rect', left: 200, top: 290, width: 304, height: 4, fill: '#16a34a' },
        { type: 'rect', left: 200, top: 290, width: 4, height: 30, fill: '#16a34a' },
        { type: 'textbox', left: 310, top: 265, width: 40, text: 'YES', fontSize: 12, fontFamily: 'Inter', fontWeight: 700, fill: '#16a34a', textAlign: 'center', originX: 'center' },

        // NO branch (right)
        { type: 'rect', left: 850, top: 250, width: 4, height: 40, fill: '#dc2626' },
        { type: 'rect', left: 700, top: 290, width: 304, height: 4, fill: '#dc2626' },
        { type: 'rect', left: 1000, top: 290, width: 4, height: 30, fill: '#dc2626' },
        { type: 'textbox', left: 895, top: 265, width: 40, text: 'NO', fontSize: 12, fontFamily: 'Inter', fontWeight: 700, fill: '#dc2626', textAlign: 'center', originX: 'center' },

        // === LEVEL 3 LEFT: Decision 2 ===
        { type: 'rect', left: 75, top: 320, width: 250, height: 70, fill: '#fef3c7', stroke: '#ca8a04', strokeWidth: 2, rx: 8, ry: 8 },
        { type: 'textbox', left: 200, top: 340, width: 220, text: 'Lab Result B positive?', fontSize: 14, fontFamily: 'Inter', fontWeight: 700, fill: '#854d0e', textAlign: 'center', originX: 'center' },

        // Left YES → Treatment A
        { type: 'rect', left: 118, top: 390, width: 4, height: 30, fill: '#16a34a' },
        { type: 'textbox', left: 100, top: 395, width: 30, text: 'Y', fontSize: 11, fontFamily: 'Inter', fontWeight: 700, fill: '#16a34a' },
        { type: 'rect', left: 30, top: 420, width: 180, height: 80, fill: '#f0fdf4', stroke: '#16a34a', strokeWidth: 2, rx: 8, ry: 8 },
        { type: 'textbox', left: 120, top: 440, width: 150, text: 'Treatment A\n\nFirst-line therapy', fontSize: 12, fontFamily: 'Inter', fill: '#15803d', textAlign: 'center', originX: 'center', lineHeight: 1.4 },

        // Left NO → Treatment B
        { type: 'rect', left: 280, top: 390, width: 4, height: 30, fill: '#dc2626' },
        { type: 'textbox', left: 288, top: 395, width: 30, text: 'N', fontSize: 11, fontFamily: 'Inter', fontWeight: 700, fill: '#dc2626' },
        { type: 'rect', left: 220, top: 420, width: 180, height: 80, fill: '#fff7ed', stroke: '#ea580c', strokeWidth: 2, rx: 8, ry: 8 },
        { type: 'textbox', left: 310, top: 440, width: 150, text: 'Treatment B\n\nAlternative therapy', fontSize: 12, fontFamily: 'Inter', fill: '#c2410c', textAlign: 'center', originX: 'center', lineHeight: 1.4 },

        // === LEVEL 3 RIGHT: Decision 3 ===
        { type: 'rect', left: 875, top: 320, width: 250, height: 70, fill: '#fef3c7', stroke: '#ca8a04', strokeWidth: 2, rx: 8, ry: 8 },
        { type: 'textbox', left: 1000, top: 340, width: 220, text: 'Risk Factor C present?', fontSize: 14, fontFamily: 'Inter', fontWeight: 700, fill: '#854d0e', textAlign: 'center', originX: 'center' },

        // Right YES → Monitor
        { type: 'rect', left: 918, top: 390, width: 4, height: 30, fill: '#16a34a' },
        { type: 'textbox', left: 900, top: 395, width: 30, text: 'Y', fontSize: 11, fontFamily: 'Inter', fontWeight: 700, fill: '#16a34a' },
        { type: 'rect', left: 830, top: 420, width: 180, height: 80, fill: '#eff6ff', stroke: '#1d4ed8', strokeWidth: 2, rx: 8, ry: 8 },
        { type: 'textbox', left: 920, top: 440, width: 150, text: 'Close Monitoring\n\nFollow-up in 4 wks', fontSize: 12, fontFamily: 'Inter', fill: '#1d4ed8', textAlign: 'center', originX: 'center', lineHeight: 1.4 },

        // Right NO → Reassess
        { type: 'rect', left: 1080, top: 390, width: 4, height: 30, fill: '#dc2626' },
        { type: 'textbox', left: 1088, top: 395, width: 30, text: 'N', fontSize: 11, fontFamily: 'Inter', fontWeight: 700, fill: '#dc2626' },
        { type: 'rect', left: 1020, top: 420, width: 180, height: 80, fill: '#fdf2f8', stroke: '#db2777', strokeWidth: 2, rx: 8, ry: 8 },
        { type: 'textbox', left: 1110, top: 440, width: 150, text: 'Reassess\n\nConsider other Dx', fontSize: 12, fontFamily: 'Inter', fill: '#9d174d', textAlign: 'center', originX: 'center', lineHeight: 1.4 },

        // === LEGEND ===
        { type: 'rect', left: 30, top: 550, width: 1140, height: 80, fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1, rx: 8, ry: 8 },
        { type: 'textbox', left: 50, top: 565, width: 100, text: 'Legend:', fontSize: 13, fontFamily: 'Inter', fontWeight: 700, fill: '#475569' },
        { type: 'rect', left: 150, top: 568, width: 40, height: 18, fill: '#1d4ed8', rx: 9, ry: 9 },
        { type: 'textbox', left: 200, top: 565, width: 100, text: 'Start / Entry', fontSize: 12, fontFamily: 'Inter', fill: '#475569' },
        { type: 'rect', left: 330, top: 568, width: 40, height: 18, fill: '#fef3c7', stroke: '#ca8a04', strokeWidth: 1, rx: 4 },
        { type: 'textbox', left: 380, top: 565, width: 100, text: 'Decision', fontSize: 12, fontFamily: 'Inter', fill: '#475569' },
        { type: 'rect', left: 490, top: 568, width: 40, height: 18, fill: '#f0fdf4', stroke: '#16a34a', strokeWidth: 1, rx: 4 },
        { type: 'textbox', left: 540, top: 565, width: 100, text: 'Action / Outcome', fontSize: 12, fontFamily: 'Inter', fill: '#475569' },
        { type: 'rect', left: 690, top: 575, width: 30, height: 3, fill: '#16a34a' },
        { type: 'textbox', left: 730, top: 565, width: 40, text: 'Yes', fontSize: 12, fontFamily: 'Inter', fill: '#16a34a' },
        { type: 'rect', left: 790, top: 575, width: 30, height: 3, fill: '#dc2626' },
        { type: 'textbox', left: 830, top: 565, width: 40, text: 'No', fontSize: 12, fontFamily: 'Inter', fill: '#dc2626' },

        // Footer
        { type: 'textbox', left: 600, top: 660, width: 1000, text: 'Tip: Add more decision nodes by duplicating boxes. Use the line tool to connect branches.', fontSize: 12, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },
      ],
      background: '#ffffff',
    },
  },

  {
    id: 'comparison-table',
    name: 'Comparison Table',
    description: 'Side-by-side treatment vs control layout with icon placeholders',
    category: 'flowchart',
    paperSize: 'letter',
    dimensions: { width: 1100, height: 700 },
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjxyZWN0IHg9IjEwIiB5PSI0MCIgd2lkdGg9IjEzMCIgaGVpZ2h0PSIxNTAiIHJ4PSI0IiBmaWxsPSIjZWZmNmZmIiBzdHJva2U9IiMxZDRlZDgiIHN0cm9rZS13aWR0aD0iMSIvPjxyZWN0IHg9IjE2MCIgeT0iNDAiIHdpZHRoPSIxMzAiIGhlaWdodD0iMTUwIiByeD0iNCIgZmlsbD0iI2ZlZjJmMiIgc3Ryb2tlPSIjZGMyNjI2IiBzdHJva2Utd2lkdGg9IjEiLz48dGV4dCB4PSI3NSIgeT0iMzAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjMWQ0ZWQ4IiBmb250LXdlaWdodD0iYm9sZCI+VHJlYXRtZW50PC90ZXh0Pjx0ZXh0IHg9IjIyNSIgeT0iMzAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZGMyNjI2IiBmb250LXdlaWdodD0iYm9sZCI+Q29udHJvbDwvdGV4dD48dGV4dCB4PSIxNTAiIHk9IjE1IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtd2VpZ2h0PSJib2xkIj5Db21wYXJpc29uPC90ZXh0Pjwvc3ZnPg==',
    canvasData: {
      version: '6.0.0',
      objects: [
        // Title
        { type: 'textbox', left: 550, top: 25, width: 900, text: 'Treatment vs Control Comparison', fontSize: 24, fontFamily: 'Inter', fontWeight: 700, fill: '#1e293b', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 550, top: 58, width: 800, text: 'Side-by-side comparison of experimental conditions', fontSize: 13, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },

        // Header row
        { type: 'rect', left: 30, top: 100, width: 200, height: 50, fill: '#f1f5f9', stroke: '#e2e8f0', strokeWidth: 1.5, rx: 6, ry: 6 },
        { type: 'textbox', left: 130, top: 115, width: 170, text: 'Parameter', fontSize: 15, fontFamily: 'Inter', fontWeight: 700, fill: '#475569', textAlign: 'center', originX: 'center' },

        { type: 'rect', left: 250, top: 100, width: 380, height: 50, fill: '#eff6ff', stroke: '#1d4ed8', strokeWidth: 1.5, rx: 6, ry: 6 },
        { type: 'textbox', left: 440, top: 115, width: 340, text: 'Treatment Group', fontSize: 15, fontFamily: 'Inter', fontWeight: 700, fill: '#1d4ed8', textAlign: 'center', originX: 'center' },

        { type: 'rect', left: 650, top: 100, width: 380, height: 50, fill: '#fef2f2', stroke: '#dc2626', strokeWidth: 1.5, rx: 6, ry: 6 },
        { type: 'textbox', left: 840, top: 115, width: 340, text: 'Control Group', fontSize: 15, fontFamily: 'Inter', fontWeight: 700, fill: '#dc2626', textAlign: 'center', originX: 'center' },

        // Row 1: Intervention
        { type: 'rect', left: 30, top: 165, width: 200, height: 70, fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1 },
        { type: 'textbox', left: 130, top: 190, width: 170, text: 'Intervention', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#334155', textAlign: 'center', originX: 'center' },

        { type: 'rect', left: 250, top: 165, width: 380, height: 70, fill: '#ffffff', stroke: '#e2e8f0', strokeWidth: 1 },
        { type: 'textbox', left: 440, top: 185, width: 340, text: 'Drug X at 10 mg/kg daily\nfor 14 days', fontSize: 12, fontFamily: 'Inter', fill: '#334155', textAlign: 'center', originX: 'center', lineHeight: 1.5 },

        { type: 'rect', left: 650, top: 165, width: 380, height: 70, fill: '#ffffff', stroke: '#e2e8f0', strokeWidth: 1 },
        { type: 'textbox', left: 840, top: 185, width: 340, text: 'Vehicle (saline) daily\nfor 14 days', fontSize: 12, fontFamily: 'Inter', fill: '#334155', textAlign: 'center', originX: 'center', lineHeight: 1.5 },

        // Row 2: Primary Endpoint
        { type: 'rect', left: 30, top: 250, width: 200, height: 70, fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1 },
        { type: 'textbox', left: 130, top: 275, width: 170, text: 'Primary Endpoint', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#334155', textAlign: 'center', originX: 'center' },

        { type: 'rect', left: 250, top: 250, width: 380, height: 70, fill: '#ffffff', stroke: '#e2e8f0', strokeWidth: 1 },
        { type: 'textbox', left: 440, top: 270, width: 340, text: 'Tumor volume: 45 ± 12 mm³\n(p < 0.001 vs control)', fontSize: 12, fontFamily: 'Inter', fill: '#15803d', textAlign: 'center', originX: 'center', lineHeight: 1.5 },

        { type: 'rect', left: 650, top: 250, width: 380, height: 70, fill: '#ffffff', stroke: '#e2e8f0', strokeWidth: 1 },
        { type: 'textbox', left: 840, top: 270, width: 340, text: 'Tumor volume: 120 ± 25 mm³', fontSize: 12, fontFamily: 'Inter', fill: '#334155', textAlign: 'center', originX: 'center', lineHeight: 1.5 },

        // Row 3: Secondary Endpoint
        { type: 'rect', left: 30, top: 335, width: 200, height: 70, fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1 },
        { type: 'textbox', left: 130, top: 360, width: 170, text: 'Secondary\nEndpoint', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#334155', textAlign: 'center', originX: 'center' },

        { type: 'rect', left: 250, top: 335, width: 380, height: 70, fill: '#ffffff', stroke: '#e2e8f0', strokeWidth: 1 },
        { type: 'textbox', left: 440, top: 360, width: 340, text: 'Survival: 85% at 30 days', fontSize: 12, fontFamily: 'Inter', fill: '#15803d', textAlign: 'center', originX: 'center' },

        { type: 'rect', left: 650, top: 335, width: 380, height: 70, fill: '#ffffff', stroke: '#e2e8f0', strokeWidth: 1 },
        { type: 'textbox', left: 840, top: 360, width: 340, text: 'Survival: 40% at 30 days', fontSize: 12, fontFamily: 'Inter', fill: '#334155', textAlign: 'center', originX: 'center' },

        // Row 4: Safety
        { type: 'rect', left: 30, top: 420, width: 200, height: 70, fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1 },
        { type: 'textbox', left: 130, top: 445, width: 170, text: 'Safety / Toxicity', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#334155', textAlign: 'center', originX: 'center' },

        { type: 'rect', left: 250, top: 420, width: 380, height: 70, fill: '#ffffff', stroke: '#e2e8f0', strokeWidth: 1 },
        { type: 'textbox', left: 440, top: 440, width: 340, text: 'Weight loss: 3.2 ± 1.1%\nNo organ toxicity observed', fontSize: 12, fontFamily: 'Inter', fill: '#334155', textAlign: 'center', originX: 'center', lineHeight: 1.5 },

        { type: 'rect', left: 650, top: 420, width: 380, height: 70, fill: '#ffffff', stroke: '#e2e8f0', strokeWidth: 1 },
        { type: 'textbox', left: 840, top: 440, width: 340, text: 'Weight loss: 1.5 ± 0.8%\nNo adverse effects', fontSize: 12, fontFamily: 'Inter', fill: '#334155', textAlign: 'center', originX: 'center', lineHeight: 1.5 },

        // Summary row
        { type: 'rect', left: 30, top: 510, width: 1000, height: 60, fill: '#f0fdf4', stroke: '#16a34a', strokeWidth: 1.5, rx: 8, ry: 8 },
        { type: 'textbox', left: 530, top: 525, width: 960, text: 'Conclusion: Treatment group showed significant reduction in tumor volume (62.5%, p < 0.001) with improved survival and acceptable safety profile.', fontSize: 13, fontFamily: 'Inter', fill: '#15803d', textAlign: 'center', originX: 'center', lineHeight: 1.4 },

        // Footer
        { type: 'textbox', left: 550, top: 600, width: 1000, text: 'Tip: Edit values, add rows by duplicating, and replace text with your experimental data.', fontSize: 12, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },
      ],
      background: '#ffffff',
    },
  },

  // Business Templates
  {
    id: 'swot-analysis',
    name: 'SWOT Analysis',
    description: '2x2 grid for Strengths, Weaknesses, Opportunities, Threats',
    category: 'business',
    paperSize: 'letter',
    dimensions: { width: 800, height: 600 },
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjxyZWN0IHg9IjMwIiB5PSI0MCIgd2lkdGg9IjExNSIgaGVpZ2h0PSI3MCIgZmlsbD0iI2U4ZjVlOSIgc3Ryb2tlPSIjNGNhZjUwIiBzdHJva2Utd2lkdGg9IjIiLz48cmVjdCB4PSIxNTUiIHk9IjQwIiB3aWR0aD0iMTE1IiBoZWlnaHQ9IjcwIiBmaWxsPSIjZmZlYmVlIiBzdHJva2U9IiNmNDQzMzYiIHN0cm9rZS13aWR0aD0iMiIvPjxyZWN0IHg9IjMwIiB5PSIxMjAiIHdpZHRoPSIxMTUiIGhlaWdodD0iNzAiIGZpbGw9IiNlM2YyZmQiIHN0cm9rZT0iIzIxOTZmMyIgc3Ryb2tlLXdpZHRoPSIyIi8+PHJlY3QgeD0iMTU1IiB5PSIxMjAiIHdpZHRoPSIxMTUiIGhlaWdodD0iNzAiIGZpbGw9IiNmZmYzZTAiIHN0cm9rZT0iI2ZmYjMwMCIgc3Ryb2tlLXdpZHRoPSIyIi8+PHRleHQgeD0iODciIHk9IjM1IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTEiIGZvbnQtd2VpZ2h0PSJib2xkIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5TdHJlbmd0aHM8L3RleHQ+PHRleHQgeD0iMjEyIiB5PSIzNSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjExIiBmb250LXdlaWdodD0iYm9sZCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+V2Vha25lc3NlczwvdGV4dD48dGV4dCB4PSI4NyIgeT0iMTE1IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTEiIGZvbnQtd2VpZ2h0PSJib2xkIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5PcHBvcnR1bml0aWVzPC90ZXh0Pjx0ZXh0IHg9IjIxMiIgeT0iMTE1IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTEiIGZvbnQtd2VpZ2h0PSJib2xkIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5UaHJlYXRzPC90ZXh0Pjwvc3ZnPg==',
    canvasData: {
      version: '6.0.0',
      objects: [
        // Title
        { type: 'textbox', left: 250, top: 80, width: 300, text: 'SWOT Analysis', fontSize: 24, fontFamily: 'Inter', textAlign: 'center', fontWeight: 'bold' },
        
        // Strengths (top left)
        { type: 'rect', left: 150, top: 150, width: 280, height: 180, fill: '#e8f5e9', stroke: '#4caf50', strokeWidth: 3 },
        { type: 'textbox', left: 160, top: 160, width: 260, text: 'STRENGTHS', fontSize: 18, fontFamily: 'Inter', fontWeight: 'bold', fill: '#2e7d32' },
        { type: 'textbox', left: 160, top: 195, width: 260, text: '• Internal positive factors\n• Core competencies\n• Competitive advantages\n• Resources & assets', fontSize: 13, fontFamily: 'Inter', fill: '#333333' },
        
        // Weaknesses (top right)
        { type: 'rect', left: 450, top: 150, width: 280, height: 180, fill: '#ffebee', stroke: '#f44336', strokeWidth: 3 },
        { type: 'textbox', left: 460, top: 160, width: 260, text: 'WEAKNESSES', fontSize: 18, fontFamily: 'Inter', fontWeight: 'bold', fill: '#c62828' },
        { type: 'textbox', left: 460, top: 195, width: 260, text: '• Internal limitations\n• Areas needing improvement\n• Resource constraints\n• Disadvantages', fontSize: 13, fontFamily: 'Inter', fill: '#333333' },
        
        // Opportunities (bottom left)
        { type: 'rect', left: 150, top: 350, width: 280, height: 180, fill: '#e3f2fd', stroke: '#2196f3', strokeWidth: 3 },
        { type: 'textbox', left: 160, top: 360, width: 260, text: 'OPPORTUNITIES', fontSize: 18, fontFamily: 'Inter', fontWeight: 'bold', fill: '#1565c0' },
        { type: 'textbox', left: 160, top: 395, width: 260, text: '• External positive factors\n• Market trends\n• Growth potential\n• Partnerships', fontSize: 13, fontFamily: 'Inter', fill: '#333333' },
        
        // Threats (bottom right)
        { type: 'rect', left: 450, top: 350, width: 280, height: 180, fill: '#fff3e0', stroke: '#ffb300', strokeWidth: 3 },
        { type: 'textbox', left: 460, top: 360, width: 260, text: 'THREATS', fontSize: 18, fontFamily: 'Inter', fontWeight: 'bold', fill: '#e65100' },
        { type: 'textbox', left: 460, top: 395, width: 260, text: '• External challenges\n• Market competition\n• Regulatory changes\n• Economic factors', fontSize: 13, fontFamily: 'Inter', fill: '#333333' },
      ],
    },
  },
  {
    id: 'venn-diagram',
    name: 'Venn Diagram',
    description: 'Two or three overlapping circles for comparison',
    category: 'business',
    paperSize: 'letter',
    dimensions: { width: 800, height: 600 },
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjxjaXJjbGUgY3g9IjExMCIgY3k9IjEwMCIgcj0iNTUiIGZpbGw9IiNlM2YyZmQiIGZpbGwtb3BhY2l0eT0iMC42IiBzdHJva2U9IiMyMTk2ZjMiIHN0cm9rZS13aWR0aD0iMiIvPjxjaXJjbGUgY3g9IjE5MCIgY3k9IjEwMCIgcj0iNTUiIGZpbGw9IiNmM2U1ZjUiIGZpbGwtb3BhY2l0eT0iMC42IiBzdHJva2U9IiM5YzI3YjAiIHN0cm9rZS13aWR0aD0iMiIvPjx0ZXh0IHg9Ijg1IiB5PSI5MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEwIiBmb250LXdlaWdodD0iYm9sZCI+U2V0IEE8L3RleHQ+PHRleHQgeD0iMTkwIiB5PSI5MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEwIiBmb250LXdlaWdodD0iYm9sZCI+U2V0IEI8L3RleHQ+PHRleHQgeD0iMTUwIiB5PSIxMDUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Cb3RoPC90ZXh0Pjwvc3ZnPg==',
    canvasData: {
      version: '6.0.0',
      objects: [
        // Title
        { type: 'textbox', left: 250, top: 80, width: 300, text: 'Venn Diagram Comparison', fontSize: 22, fontFamily: 'Inter', textAlign: 'center', fontWeight: 'bold' },
        
        // Left circle
        { type: 'circle', left: 200, top: 180, radius: 120, fill: '#e3f2fd', fillOpacity: 0.6, stroke: '#2196f3', strokeWidth: 3 },
        { type: 'textbox', left: 230, top: 200, width: 80, text: 'Category A', fontSize: 16, fontFamily: 'Inter', fontWeight: 'bold', textAlign: 'center' },
        { type: 'textbox', left: 215, top: 230, width: 110, text: '• Feature 1\n• Feature 2\n• Feature 3', fontSize: 13, fontFamily: 'Inter' },
        
        // Right circle
        { type: 'circle', left: 380, top: 180, radius: 120, fill: '#f3e5f5', fillOpacity: 0.6, stroke: '#9c27b0', strokeWidth: 3 },
        { type: 'textbox', left: 470, top: 200, width: 80, text: 'Category B', fontSize: 16, fontFamily: 'Inter', fontWeight: 'bold', textAlign: 'center' },
        { type: 'textbox', left: 455, top: 230, width: 110, text: '• Feature 4\n• Feature 5\n• Feature 6', fontSize: 13, fontFamily: 'Inter' },
        
        // Overlap label
        { type: 'textbox', left: 350, top: 265, width: 100, text: 'Common\nFeatures', fontSize: 14, fontFamily: 'Inter', fontWeight: 'bold', textAlign: 'center', fill: '#6a1b9a' },
      ],
    },
  },
  
  // Educational Templates
  {
    id: 'mind-map',
    name: 'Mind Map',
    description: 'Central idea with branching concepts and sub-topics',
    category: 'educational',
    paperSize: 'letter',
    dimensions: { width: 1000, height: 700 },
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjxjaXJjbGUgY3g9IjE1MCIgY3k9IjEwMCIgcj0iMzAiIGZpbGw9IiNmZmYzZTAiIHN0cm9rZT0iI2ZmYjMwMCIgc3Ryb2tlLXdpZHRoPSIzIi8+PGxpbmUgeDE9IjE4MCIgeTE9IjEwMCIgeDI9IjI0MCIgeTI9IjYwIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMiIvPjxjaXJjbGUgY3g9IjI0MCIgY3k9IjYwIiByPSIxOCIgZmlsbD0iI2UzZjJmZCIgc3Ryb2tlPSIjMjE5NmYzIiBzdHJva2Utd2lkdGg9IjIiLz48bGluZSB4MT0iMTgwIiB5MT0iMTAwIiB4Mj0iMjQwIiB5Mj0iMTQwIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMiIvPjxjaXJjbGUgY3g9IjI0MCIgY3k9IjE0MCIgcj0iMTgiIGZpbGw9IiNlM2YyZmQiIHN0cm9rZT0iIzIxOTZmMyIgc3Ryb2tlLXdpZHRoPSIyIi8+PGxpbmUgeDE9IjEyMCIgeTE9IjEwMCIgeDI9IjYwIiB5Mj0iNjAiIHN0cm9rZT0iIzY2NiIgc3Ryb2tlLXdpZHRoPSIyIi8+PGNpcmNsZSBjeD0iNjAiIGN5PSI2MCIgcj0iMTgiIGZpbGw9IiNlOGY1ZTkiIHN0cm9rZT0iIzRjYWY1MCIgc3Ryb2tlLXdpZHRoPSIyIi8+PHRleHQgeD0iMTUwIiB5PSIxMDUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC13ZWlnaHQ9ImJvbGQiPkNlbnRlcjwvdGV4dD48L3N2Zz4=',
    canvasData: {
      version: '6.0.0',
      objects: [
        // Central node
        { type: 'circle', left: 450, top: 300, radius: 60, fill: '#fff3e0', stroke: '#ffb300', strokeWidth: 4 },
        { type: 'textbox', left: 425, top: 350, width: 90, text: 'Main\nTopic', fontSize: 16, fontFamily: 'Inter', fontWeight: 'bold', textAlign: 'center' },
        
        // Branch 1 (top)
        { type: 'line', left: 500, top: 260, x1: 0, y1: 0, x2: 0, y2: -80, stroke: '#666666', strokeWidth: 3 },
        { type: 'circle', left: 470, top: 120, radius: 40, fill: '#e3f2fd', stroke: '#2196f3', strokeWidth: 3 },
        { type: 'textbox', left: 455, top: 150, width: 70, text: 'Idea 1', fontSize: 14, fontFamily: 'Inter', fontWeight: 'bold', textAlign: 'center' },
        
        // Branch 2 (right)
        { type: 'line', left: 570, top: 350, x1: 0, y1: 0, x2: 120, y2: 0, stroke: '#666666', strokeWidth: 3 },
        { type: 'circle', left: 690, top: 320, radius: 40, fill: '#f3e5f5', stroke: '#9c27b0', strokeWidth: 3 },
        { type: 'textbox', left: 675, top: 350, width: 70, text: 'Idea 2', fontSize: 14, fontFamily: 'Inter', fontWeight: 'bold', textAlign: 'center' },
        
        // Branch 3 (bottom)
        { type: 'line', left: 500, top: 420, x1: 0, y1: 0, x2: 0, y2: 80, stroke: '#666666', strokeWidth: 3 },
        { type: 'circle', left: 470, top: 500, radius: 40, fill: '#e8f5e9', stroke: '#4caf50', strokeWidth: 3 },
        { type: 'textbox', left: 455, top: 530, width: 70, text: 'Idea 3', fontSize: 14, fontFamily: 'Inter', fontWeight: 'bold', textAlign: 'center' },
        
        // Branch 4 (left)
        { type: 'line', left: 350, top: 350, x1: 0, y1: 0, x2: -120, y2: 0, stroke: '#666666', strokeWidth: 3 },
        { type: 'circle', left: 190, top: 320, radius: 40, fill: '#ffebee', stroke: '#f44336', strokeWidth: 3 },
        { type: 'textbox', left: 175, top: 350, width: 70, text: 'Idea 4', fontSize: 14, fontFamily: 'Inter', fontWeight: 'bold', textAlign: 'center' },
        
        // Sub-branches
        { type: 'line', left: 530, top: 140, x1: 0, y1: 0, x2: 60, y2: -30, stroke: '#999999', strokeWidth: 2 },
        { type: 'circle', left: 580, top: 80, radius: 25, fill: '#e1f5fe', stroke: '#2196f3', strokeWidth: 2 },
        { type: 'textbox', left: 570, top: 100, width: 40, text: 'Sub', fontSize: 11, fontFamily: 'Inter', textAlign: 'center' },
        
        { type: 'line', left: 750, top: 350, x1: 0, y1: 0, x2: 50, y2: 30, stroke: '#999999', strokeWidth: 2 },
        { type: 'circle', left: 790, top: 370, radius: 25, fill: '#f3e5f5', stroke: '#9c27b0', strokeWidth: 2 },
        { type: 'textbox', left: 780, top: 390, width: 40, text: 'Sub', fontSize: 11, fontFamily: 'Inter', textAlign: 'center' },
      ],
    },
  },
  {
    id: "consort-flow-diagram",
    name: "Flow Chart for Study",
    description: "CONSORT 2010 Flow Diagram for reporting clinical trial participant flow",
    category: "flowchart",
    thumbnail: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZmZmZiIvPjxyZWN0IHg9IjIwIiB5PSIxMCIgd2lkdGg9IjI2MCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2I3ZDRmNCIgc3Ryb2tlPSIjMDAzZDdhIiBzdHJva2Utd2lkdGg9IjEiLz48cmVjdCB4PSI3NSIgeT0iNDAiIHdpZHRoPSIxNTAiIGhlaWdodD0iMjUiIGZpbGw9IiNmZmZmZmYiIHN0cm9rZT0iIzAwMDAwMCIgc3Ryb2tlLXdpZHRoPSIxIi8+PHJlY3QgeD0iMjAiIHk9Ijc1IiB3aWR0aD0iMjYwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjYjdkNGY0IiBzdHJva2U9IiMwMDNkN2EiIHN0cm9rZS13aWR0aD0iMSIvPjxyZWN0IHg9IjIwIiB5PSIxMDUiIHdpZHRoPSIxMTAiIGhlaWdodD0iMjUiIGZpbGw9IiNmZmZmZmYiIHN0cm9rZT0iIzAwMDAwMCIgc3Ryb2tlLXdpZHRoPSIxIi8+PHJlY3QgeD0iMTcwIiB5PSIxMDUiIHdpZHRoPSIxMTAiIGhlaWdodD0iMjUiIGZpbGw9IiNmZmZmZmYiIHN0cm9rZT0iIzAwMDAwMCIgc3Ryb2tlLXdpZHRoPSIxIi8+PHJlY3QgeD0iMjAiIHk9IjE0MCIgd2lkdGg9IjI2MCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2I3ZDRmNCIgc3Ryb2tlPSIjMDAzZDdhIiBzdHJva2Utd2lkdGg9IjEiLz48cmVjdCB4PSIyMCIgeT0iMTcwIiB3aWR0aD0iMTEwIiBoZWlnaHQ9IjI1IiBmaWxsPSIjZmZmZmZmIiBzdHJva2U9IiMwMDAwMDAiIHN0cm9rZS13aWR0aD0iMSIvPjxyZWN0IHg9IjE3MCIgeT0iMTcwIiB3aWR0aD0iMTEwIiBoZWlnaHQ9IjI1IiBmaWxsPSIjZmZmZmZmIiBzdHJva2U9IiMwMDAwMDAiIHN0cm9rZS13aWR0aD0iMSIvPjwvc3ZnPg==",
    canvasData: {
      version: "6.0.0",
      objects: [
        // Header
        {
          type: "textbox",
          left: 400,
          top: 30,
          width: 600,
          fontSize: 20,
          fontWeight: "bold",
          text: "CONSORT 2010 Flow Diagram",
          fill: "#000000",
          fontFamily: "Inter",
          textAlign: "center",
          originX: "center",
          originY: "top",
        },
        
        // ENROLLMENT Section
        {
          type: "rect",
          left: 100,
          top: 80,
          width: 600,
          height: 35,
          fill: "#b7d4f4",
          stroke: "#003d7a",
          strokeWidth: 2,
          rx: 3,
          ry: 3,
        },
        {
          type: "textbox",
          left: 400,
          top: 88,
          width: 580,
          fontSize: 14,
          fontWeight: "bold",
          text: "Enrollment",
          fill: "#003d7a",
          fontFamily: "Inter",
          textAlign: "center",
          originX: "center",
          originY: "top",
        },
        
        // Assessed for eligibility
        {
          type: "rect",
          left: 250,
          top: 130,
          width: 300,
          height: 50,
          fill: "#ffffff",
          stroke: "#000000",
          strokeWidth: 2,
        },
        {
          type: "textbox",
          left: 260,
          top: 145,
          width: 280,
          fontSize: 12,
          text: "Assessed for eligibility (n= )",
          fill: "#000000",
          fontFamily: "Inter",
          textAlign: "center",
        },
        
        // Arrow down
        {
          type: "group",
          left: 400,
          top: 180,
          subTargetCheck: false,
          objects: [
            {
              type: "line",
              x1: 0,
              y1: 0,
              x2: 0,
              y2: 30,
              stroke: "#000000",
              strokeWidth: 2,
              selectable: false,
              evented: false,
            },
            {
              type: "polygon",
              points: [{ x: 0, y: 30 }, { x: -5, y: 22 }, { x: 5, y: 22 }],
              fill: "#000000",
              stroke: "#000000",
              strokeWidth: 1,
              selectable: false,
              evented: false,
            },
          ],
        },
        
        // Horizontal arrow from "Assessed for eligibility" to "Excluded"
        {
          type: "group",
          left: 550,
          top: 155,
          subTargetCheck: false,
          objects: [
            {
              type: "line",
              x1: 0,
              y1: 0,
              x2: 30,
              y2: 0,
              stroke: "#000000",
              strokeWidth: 2,
              selectable: false,
              evented: false,
            },
            {
              type: "line",
              x1: 30,
              y1: 0,
              x2: 30,
              y2: 65,
              stroke: "#000000",
              strokeWidth: 2,
              selectable: false,
              evented: false,
            },
            {
              type: "polygon",
              points: [{ x: 30, y: 65 }, { x: 25, y: 57 }, { x: 35, y: 57 }],
              fill: "#000000",
              stroke: "#000000",
              strokeWidth: 1,
              selectable: false,
              evented: false,
            },
          ],
        },

        // Excluded box
        {
          type: "rect",
          left: 580,
          top: 220,
          width: 200,
          height: 110,
          fill: "#ffffff",
          stroke: "#000000",
          strokeWidth: 2,
        },
        {
          type: "textbox",
          left: 590,
          top: 228,
          width: 180,
          fontSize: 11,
          text: "Excluded (n= )\n• Not meeting inclusion criteria (n= )\n• Declined to participate (n= )\n• Other reasons (n= )",
          fill: "#000000",
          fontFamily: "Inter",
          textAlign: "left",
        },
        
        // Randomized box
        {
          type: "rect",
          left: 250,
          top: 220,
          width: 300,
          height: 50,
          fill: "#ffffff",
          stroke: "#000000",
          strokeWidth: 2,
        },
        {
          type: "textbox",
          left: 260,
          top: 235,
          width: 280,
          fontSize: 12,
          text: "Randomized (n= )",
          fill: "#000000",
          fontFamily: "Inter",
          textAlign: "center",
        },
        
        // Arrow from randomized down
        {
          type: "group",
          left: 400,
          top: 270,
          subTargetCheck: false,
          objects: [
            {
              type: "line",
              x1: 0,
              y1: 0,
              x2: 0,
              y2: 30,
              stroke: "#000000",
              strokeWidth: 2,
              selectable: false,
              evented: false,
            },
            {
              type: "polygon",
              points: [{ x: 0, y: 30 }, { x: -5, y: 22 }, { x: 5, y: 22 }],
              fill: "#000000",
              stroke: "#000000",
              strokeWidth: 1,
              selectable: false,
              evented: false,
            },
          ],
        },
        
        // ALLOCATION Section
        {
          type: "rect",
          left: 100,
          top: 310,
          width: 600,
          height: 35,
          fill: "#b7d4f4",
          stroke: "#003d7a",
          strokeWidth: 2,
          rx: 3,
          ry: 3,
        },
        {
          type: "textbox",
          left: 400,
          top: 318,
          width: 580,
          fontSize: 14,
          fontWeight: "bold",
          text: "Allocation",
          fill: "#003d7a",
          fontFamily: "Inter",
          textAlign: "center",
          originX: "center",
          originY: "top",
        },
        
        // Split arrows down
        {
          type: "line",
          left: 400,
          top: 345,
          x1: 0,
          y1: 0,
          x2: -150,
          y2: 20,
          stroke: "#000000",
          strokeWidth: 2,
        },
        {
          type: "line",
          left: 400,
          top: 345,
          x1: 0,
          y1: 0,
          x2: 150,
          y2: 20,
          stroke: "#000000",
          strokeWidth: 2,
        },
        
        // Left branch - Allocated to intervention
        {
          type: "rect",
          left: 100,
          top: 370,
          width: 250,
          height: 60,
          fill: "#ffffff",
          stroke: "#000000",
          strokeWidth: 2,
        },
        {
          type: "textbox",
          left: 110,
          top: 378,
          width: 230,
          fontSize: 11,
          text: "Allocated to intervention (n= )\n• Received allocated intervention (n= )\n• Did not receive allocated intervention (give reasons) (n= )",
          fill: "#000000",
          fontFamily: "Inter",
          textAlign: "left",
        },
        
        // Right branch - Allocated to comparison
        {
          type: "rect",
          left: 450,
          top: 370,
          width: 250,
          height: 60,
          fill: "#ffffff",
          stroke: "#000000",
          strokeWidth: 2,
        },
        {
          type: "textbox",
          left: 460,
          top: 378,
          width: 230,
          fontSize: 11,
          text: "Allocated to comparison (n= )\n• Received allocated intervention (n= )\n• Did not receive allocated intervention (give reasons) (n= )",
          fill: "#000000",
          fontFamily: "Inter",
          textAlign: "left",
        },
        
        // Arrows down from allocation
        {
          type: "group",
          left: 225,
          top: 430,
          subTargetCheck: false,
          objects: [
            {
              type: "line",
              x1: 0,
              y1: 0,
              x2: 0,
              y2: 30,
              stroke: "#000000",
              strokeWidth: 2,
              selectable: false,
              evented: false,
            },
            {
              type: "polygon",
              points: [{ x: 0, y: 30 }, { x: -5, y: 22 }, { x: 5, y: 22 }],
              fill: "#000000",
              stroke: "#000000",
              strokeWidth: 1,
              selectable: false,
              evented: false,
            },
          ],
        },
        {
          type: "group",
          left: 575,
          top: 430,
          subTargetCheck: false,
          objects: [
            {
              type: "line",
              x1: 0,
              y1: 0,
              x2: 0,
              y2: 30,
              stroke: "#000000",
              strokeWidth: 2,
              selectable: false,
              evented: false,
            },
            {
              type: "polygon",
              points: [{ x: 0, y: 30 }, { x: -5, y: 22 }, { x: 5, y: 22 }],
              fill: "#000000",
              stroke: "#000000",
              strokeWidth: 1,
              selectable: false,
              evented: false,
            },
          ],
        },
        
        // FOLLOW-UP Section
        {
          type: "rect",
          left: 100,
          top: 470,
          width: 600,
          height: 35,
          fill: "#b7d4f4",
          stroke: "#003d7a",
          strokeWidth: 2,
          rx: 3,
          ry: 3,
        },
        {
          type: "textbox",
          left: 400,
          top: 478,
          width: 580,
          fontSize: 14,
          fontWeight: "bold",
          text: "Follow-Up",
          fill: "#003d7a",
          fontFamily: "Inter",
          textAlign: "center",
          originX: "center",
          originY: "top",
        },
        
        // Left follow-up
        {
          type: "rect",
          left: 100,
          top: 520,
          width: 250,
          height: 60,
          fill: "#ffffff",
          stroke: "#000000",
          strokeWidth: 2,
        },
        {
          type: "textbox",
          left: 110,
          top: 528,
          width: 230,
          fontSize: 11,
          text: "Lost to follow-up (give reasons) (n= )\nDiscontinued intervention (give reasons) (n= )",
          fill: "#000000",
          fontFamily: "Inter",
          textAlign: "left",
        },
        
        // Right follow-up
        {
          type: "rect",
          left: 450,
          top: 520,
          width: 250,
          height: 60,
          fill: "#ffffff",
          stroke: "#000000",
          strokeWidth: 2,
        },
        {
          type: "textbox",
          left: 460,
          top: 528,
          width: 230,
          fontSize: 11,
          text: "Lost to follow-up (give reasons) (n= )\nDiscontinued intervention (give reasons) (n= )",
          fill: "#000000",
          fontFamily: "Inter",
          textAlign: "left",
        },
        
        // Arrows down from follow-up
        {
          type: "group",
          left: 225,
          top: 580,
          subTargetCheck: false,
          objects: [
            {
              type: "line",
              x1: 0,
              y1: 0,
              x2: 0,
              y2: 30,
              stroke: "#000000",
              strokeWidth: 2,
              selectable: false,
              evented: false,
            },
            {
              type: "polygon",
              points: [{ x: 0, y: 30 }, { x: -5, y: 22 }, { x: 5, y: 22 }],
              fill: "#000000",
              stroke: "#000000",
              strokeWidth: 1,
              selectable: false,
              evented: false,
            },
          ],
        },
        {
          type: "group",
          left: 575,
          top: 580,
          subTargetCheck: false,
          objects: [
            {
              type: "line",
              x1: 0,
              y1: 0,
              x2: 0,
              y2: 30,
              stroke: "#000000",
              strokeWidth: 2,
              selectable: false,
              evented: false,
            },
            {
              type: "polygon",
              points: [{ x: 0, y: 30 }, { x: -5, y: 22 }, { x: 5, y: 22 }],
              fill: "#000000",
              stroke: "#000000",
              strokeWidth: 1,
              selectable: false,
              evented: false,
            },
          ],
        },
        
        // ANALYSIS Section
        {
          type: "rect",
          left: 100,
          top: 620,
          width: 600,
          height: 35,
          fill: "#b7d4f4",
          stroke: "#003d7a",
          strokeWidth: 2,
          rx: 3,
          ry: 3,
        },
        {
          type: "textbox",
          left: 400,
          top: 628,
          width: 580,
          fontSize: 14,
          fontWeight: "bold",
          text: "Analysis",
          fill: "#003d7a",
          fontFamily: "Inter",
          textAlign: "center",
          originX: "center",
          originY: "top",
        },
        
        // Left analysis
        {
          type: "rect",
          left: 100,
          top: 670,
          width: 250,
          height: 60,
          fill: "#ffffff",
          stroke: "#000000",
          strokeWidth: 2,
        },
        {
          type: "textbox",
          left: 110,
          top: 678,
          width: 230,
          fontSize: 11,
          text: "Analysed (n= )\n• Excluded from analysis (give reasons) (n= )",
          fill: "#000000",
          fontFamily: "Inter",
          textAlign: "left",
        },
        
        // Right analysis
        {
          type: "rect",
          left: 450,
          top: 670,
          width: 250,
          height: 60,
          fill: "#ffffff",
          stroke: "#000000",
          strokeWidth: 2,
        },
        {
          type: "textbox",
          left: 460,
          top: 678,
          width: 230,
          fontSize: 11,
          text: "Analysed (n= )\n• Excluded from analysis (give reasons) (n= )",
          fill: "#000000",
          fontFamily: "Inter",
          textAlign: "left",
        },
      ],
      background: "#ffffff",
    },
    dimensions: { width: 800, height: 850 },
    paperSize: "letter",
  },

  // ─── Presentation-Ready Templates ───

  {
    id: 'title-slide',
    name: 'Title Slide',
    description: 'Presentation title slide with logo area, title, authors, and institution',
    category: 'scientific',
    paperSize: 'widescreen',
    dimensions: { width: 1280, height: 720 },
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzBmMTcyYSIvPjxyZWN0IHg9IjAiIHk9IjE2MCIgd2lkdGg9IjMwMCIgaGVpZ2h0PSI0MCIgZmlsbD0iIzFkNGVkOCIvPjxjaXJjbGUgY3g9IjE1MCIgY3k9IjUwIiByPSIyMCIgZmlsbD0iIzMzNCIgc3Ryb2tlPSIjNjY2IiBzdHJva2Utd2lkdGg9IjEiLz48dGV4dCB4PSIxNTAiIHk9IjEwMCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZmZmIiBmb250LXdlaWdodD0iYm9sZCI+VGl0bGUgU2xpZGU8L3RleHQ+PHRleHQgeD0iMTUwIiB5PSIxMjUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTRhM2I4Ij5BdXRob3IgTmFtZTwvdGV4dD48dGV4dCB4PSIxNTAiIHk9IjE4MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNiZmRiZmUiPkluc3RpdHV0aW9uPC90ZXh0Pjwvc3ZnPg==',
    canvasData: {
      version: '6.0.0',
      objects: [
        // Dark background
        { type: 'rect', left: 0, top: 0, width: 1280, height: 720, fill: '#0f172a', selectable: false },

        // Accent stripe at bottom
        { type: 'rect', left: 0, top: 620, width: 1280, height: 100, fill: '#1d4ed8' },

        // Thin gold line separator
        { type: 'rect', left: 100, top: 610, width: 1080, height: 2, fill: '#f59e0b' },

        // Logo placeholder
        { type: 'circle', left: 640, top: 140, radius: 50, fill: '#1e293b', stroke: '#334155', strokeWidth: 2, originX: 'center', originY: 'center' },
        { type: 'textbox', left: 640, top: 130, width: 80, text: 'LOGO', fontSize: 14, fontFamily: 'Inter', fontWeight: 700, fill: '#64748b', textAlign: 'center', originX: 'center' },

        // Title
        { type: 'textbox', left: 640, top: 230, width: 1000, text: 'Your Presentation Title Goes Here', fontSize: 40, fontFamily: 'Inter', fontWeight: 700, fill: '#f8fafc', textAlign: 'center', originX: 'center', lineHeight: 1.2 },

        // Subtitle
        { type: 'textbox', left: 640, top: 320, width: 800, text: 'A Subtitle or Brief Description of the Topic', fontSize: 20, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },

        // Horizontal divider
        { type: 'rect', left: 490, top: 370, width: 300, height: 1, fill: '#334155' },

        // Authors
        { type: 'textbox', left: 640, top: 400, width: 800, text: 'First Author¹, Second Author², Third Author¹', fontSize: 18, fontFamily: 'Inter', fill: '#cbd5e1', textAlign: 'center', originX: 'center' },

        // Affiliations
        { type: 'textbox', left: 640, top: 440, width: 900, text: '¹Department of Biology, University Name, City, Country\n²Department of Chemistry, University Name, City, Country', fontSize: 13, fontFamily: 'Inter', fill: '#64748b', textAlign: 'center', originX: 'center', lineHeight: 1.6 },

        // Date / Conference
        { type: 'textbox', left: 640, top: 530, width: 600, text: 'Conference Name — March 2026', fontSize: 14, fontFamily: 'Inter', fill: '#475569', textAlign: 'center', originX: 'center' },

        // Bottom bar text
        { type: 'textbox', left: 640, top: 655, width: 1000, text: 'University Name  |  Department  |  email@university.edu', fontSize: 13, fontFamily: 'Inter', fill: '#bfdbfe', textAlign: 'center', originX: 'center' },
      ],
      background: '#0f172a',
    },
  },

  {
    id: 'results-slide',
    name: 'Results Slide',
    description: 'Split layout with figure area and bullet points for presenting data',
    category: 'scientific',
    paperSize: 'widescreen',
    dimensions: { width: 1280, height: 720 },
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjxyZWN0IHg9IjEwIiB5PSI4IiB3aWR0aD0iMjgwIiBoZWlnaHQ9IjI1IiByeD0iMyIgZmlsbD0iIzFkNGVkOCIvPjx0ZXh0IHg9IjIwIiB5PSIyNSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEwIiBmaWxsPSIjZmZmIiBmb250LXdlaWdodD0iYm9sZCI+UmVzdWx0czwvdGV4dD48cmVjdCB4PSIxMCIgeT0iNDUiIHdpZHRoPSIxNjAiIGhlaWdodD0iMTIwIiByeD0iNCIgZmlsbD0iI2Y1ZjVmNSIgc3Ryb2tlPSIjZGRkIiBzdHJva2Utd2lkdGg9IjEiLz48dGV4dCB4PSI5MCIgeT0iMTEwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTkiPkZpZ3VyZTwvdGV4dD48dGV4dCB4PSIxODUiIHk9IjYwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iOCIgZmlsbD0iIzMzMyI+4oCiIEtleSBmaW5kaW5nIDE8L3RleHQ+PHRleHQgeD0iMTg1IiB5PSI4MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjgiIGZpbGw9IiMzMzMiPuKAoiBLZXkgZmluZGluZyAyPC90ZXh0Pjx0ZXh0IHg9IjE4NSIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iOCIgZmlsbD0iIzMzMyI+4oCiIEtleSBmaW5kaW5nIDM8L3RleHQ+PC9zdmc+',
    canvasData: {
      version: '6.0.0',
      objects: [
        // Header bar
        { type: 'rect', left: 0, top: 0, width: 1280, height: 70, fill: '#1d4ed8' },
        { type: 'textbox', left: 60, top: 18, width: 800, text: 'Results: Your Finding Title', fontSize: 28, fontFamily: 'Inter', fontWeight: 700, fill: '#ffffff' },

        // Thin accent line
        { type: 'rect', left: 0, top: 70, width: 1280, height: 3, fill: '#f59e0b' },

        // Left side — Figure area
        { type: 'rect', left: 40, top: 100, width: 680, height: 480, fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1.5, rx: 8, ry: 8 },
        { type: 'rect', left: 60, top: 120, width: 640, height: 400, fill: '#f1f5f9', stroke: '#cbd5e1', strokeWidth: 1, rx: 4, ry: 4, strokeDashArray: [8, 4] },
        { type: 'textbox', left: 380, top: 300, width: 300, text: 'Place your figure,\ngraph, or image here', fontSize: 16, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },

        // Figure caption
        { type: 'textbox', left: 60, top: 535, width: 640, text: 'Figure 1. Caption describing the figure, including statistical significance (p < 0.05).', fontSize: 12, fontFamily: 'Inter', fill: '#64748b', lineHeight: 1.5 },

        // Right side — Key findings
        { type: 'textbox', left: 780, top: 110, width: 440, text: 'Key Findings', fontSize: 20, fontFamily: 'Inter', fontWeight: 700, fill: '#1e293b' },

        // Divider under key findings
        { type: 'rect', left: 780, top: 142, width: 60, height: 3, fill: '#1d4ed8', rx: 1 },

        // Bullet points
        { type: 'textbox', left: 780, top: 170, width: 440, text: '•  Treatment group showed 3.2× increase\n   in target expression (p < 0.001)\n\n•  Dose-dependent response observed\n   across all concentrations tested\n\n•  No significant toxicity at therapeutic\n   doses (cell viability > 95%)\n\n•  Effect was sustained for 72 hours\n   post-treatment', fontSize: 15, fontFamily: 'Inter', fill: '#334155', lineHeight: 1.5 },

        // Statistical note box
        { type: 'rect', left: 780, top: 480, width: 440, height: 90, fill: '#eff6ff', stroke: '#93c5fd', strokeWidth: 1, rx: 6, ry: 6 },
        { type: 'textbox', left: 800, top: 495, width: 400, text: 'Statistical Analysis', fontSize: 13, fontFamily: 'Inter', fontWeight: 700, fill: '#1d4ed8' },
        { type: 'textbox', left: 800, top: 520, width: 400, text: 'One-way ANOVA with Tukey post-hoc test.\nn = 6 per group, mean ± SEM. *p < 0.05, **p < 0.01', fontSize: 12, fontFamily: 'Inter', fill: '#475569', lineHeight: 1.5 },

        // Footer
        { type: 'rect', left: 0, top: 690, width: 1280, height: 30, fill: '#f1f5f9' },
        { type: 'textbox', left: 640, top: 695, width: 1200, text: 'Author Name  |  Lab Name  |  Conference 2026', fontSize: 11, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },
      ],
      background: '#ffffff',
    },
  },

  {
    id: 'hypothesis-diagram',
    name: 'Hypothesis Diagram',
    description: 'Visual flow from research question through mechanism to prediction',
    category: 'scientific',
    paperSize: 'letter',
    dimensions: { width: 1200, height: 700 },
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjxyZWN0IHg9IjIwIiB5PSI2MCIgd2lkdGg9IjcwIiBoZWlnaHQ9IjgwIiByeD0iOCIgZmlsbD0iI2VmZjZmZiIgc3Ryb2tlPSIjMWQ0ZWQ4IiBzdHJva2Utd2lkdGg9IjEiLz48dGV4dCB4PSI1NSIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iNyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzFkNGVkOCI+UXVlc3Rpb248L3RleHQ+PHRleHQgeD0iMTEwIiB5PSIxMDUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0iI2NiZDVlMSI+4oaSPC90ZXh0PjxyZWN0IHg9IjEyMCIgeT0iNjAiIHdpZHRoPSI3MCIgaGVpZ2h0PSI4MCIgcng9IjgiIGZpbGw9IiNmNWYzZmYiIHN0cm9rZT0iIzdjM2FlZCIgc3Ryb2tlLXdpZHRoPSIxIi8+PHRleHQgeD0iMTU1IiB5PSIxMDAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI3IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjN2MzYWVkIj5NZWNoYW5pc208L3RleHQ+PHRleHQgeD0iMjEwIiB5PSIxMDUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0iI2NiZDVlMSI+4oaSPC90ZXh0PjxyZWN0IHg9IjIyMCIgeT0iNjAiIHdpZHRoPSI3MCIgaGVpZ2h0PSI4MCIgcng9IjgiIGZpbGw9IiNmMGZkZjQiIHN0cm9rZT0iIzE2YTM0YSIgc3Ryb2tlLXdpZHRoPSIxIi8+PHRleHQgeD0iMjU1IiB5PSIxMDAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI3IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjMTZhMzRhIj5QcmVkaWN0aW9uPC90ZXh0Pjwvc3ZnPg==',
    canvasData: {
      version: '6.0.0',
      objects: [
        // Title
        { type: 'textbox', left: 600, top: 30, width: 1000, text: 'Research Hypothesis', fontSize: 26, fontFamily: 'Inter', fontWeight: 700, fill: '#1e293b', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 600, top: 65, width: 800, text: 'From question to testable prediction', fontSize: 14, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },

        // === QUESTION BLOCK ===
        { type: 'rect', left: 30, top: 120, width: 340, height: 260, fill: '#eff6ff', stroke: '#1d4ed8', strokeWidth: 2, rx: 12, ry: 12 },
        // Question icon circle
        { type: 'circle', left: 200, top: 155, radius: 22, fill: '#1d4ed8', originX: 'center', originY: 'center' },
        { type: 'textbox', left: 200, top: 145, width: 30, text: '?', fontSize: 22, fontFamily: 'Inter', fontWeight: 800, fill: '#ffffff', textAlign: 'center', originX: 'center' },
        // Question label
        { type: 'textbox', left: 200, top: 190, width: 300, text: 'RESEARCH QUESTION', fontSize: 13, fontFamily: 'Inter', fontWeight: 700, fill: '#1d4ed8', textAlign: 'center', originX: 'center' },
        // Question content
        { type: 'textbox', left: 200, top: 220, width: 290, text: 'Does [independent variable] affect [dependent variable] in [model system]?', fontSize: 15, fontFamily: 'Inter', fill: '#334155', textAlign: 'center', originX: 'center', lineHeight: 1.6 },
        // Background context
        { type: 'textbox', left: 200, top: 310, width: 290, text: 'Background: Briefly state what is known and the gap your study addresses.', fontSize: 12, fontFamily: 'Inter', fill: '#64748b', textAlign: 'center', originX: 'center', lineHeight: 1.5 },

        // Arrow 1
        { type: 'textbox', left: 400, top: 230, width: 40, text: '→', fontSize: 36, fontFamily: 'Inter', fill: '#cbd5e1', textAlign: 'center', originX: 'center' },

        // === MECHANISM BLOCK ===
        { type: 'rect', left: 430, top: 120, width: 340, height: 260, fill: '#f5f3ff', stroke: '#7c3aed', strokeWidth: 2, rx: 12, ry: 12 },
        // Mechanism icon circle
        { type: 'circle', left: 600, top: 155, radius: 22, fill: '#7c3aed', originX: 'center', originY: 'center' },
        { type: 'textbox', left: 600, top: 145, width: 30, text: '⚙', fontSize: 18, fontFamily: 'Inter', fill: '#ffffff', textAlign: 'center', originX: 'center' },
        // Mechanism label
        { type: 'textbox', left: 600, top: 190, width: 300, text: 'PROPOSED MECHANISM', fontSize: 13, fontFamily: 'Inter', fontWeight: 700, fill: '#7c3aed', textAlign: 'center', originX: 'center' },
        // Mechanism content
        { type: 'textbox', left: 600, top: 220, width: 290, text: '[Variable A] activates [Pathway B] which leads to [Outcome C] through [specific molecular interaction].', fontSize: 15, fontFamily: 'Inter', fill: '#334155', textAlign: 'center', originX: 'center', lineHeight: 1.6 },
        // Placeholder for diagram
        { type: 'rect', left: 490, top: 310, width: 220, height: 50, fill: '#ede9fe', stroke: '#a78bfa', strokeWidth: 1, rx: 6, ry: 6, strokeDashArray: [6, 4] },
        { type: 'textbox', left: 600, top: 325, width: 200, text: 'Add pathway diagram here', fontSize: 11, fontFamily: 'Inter', fill: '#a78bfa', textAlign: 'center', originX: 'center' },

        // Arrow 2
        { type: 'textbox', left: 800, top: 230, width: 40, text: '→', fontSize: 36, fontFamily: 'Inter', fill: '#cbd5e1', textAlign: 'center', originX: 'center' },

        // === PREDICTION BLOCK ===
        { type: 'rect', left: 830, top: 120, width: 340, height: 260, fill: '#f0fdf4', stroke: '#16a34a', strokeWidth: 2, rx: 12, ry: 12 },
        // Prediction icon circle
        { type: 'circle', left: 1000, top: 155, radius: 22, fill: '#16a34a', originX: 'center', originY: 'center' },
        { type: 'textbox', left: 1000, top: 145, width: 30, text: '✓', fontSize: 20, fontFamily: 'Inter', fontWeight: 800, fill: '#ffffff', textAlign: 'center', originX: 'center' },
        // Prediction label
        { type: 'textbox', left: 1000, top: 190, width: 300, text: 'TESTABLE PREDICTION', fontSize: 13, fontFamily: 'Inter', fontWeight: 700, fill: '#16a34a', textAlign: 'center', originX: 'center' },
        // Prediction content
        { type: 'textbox', left: 1000, top: 220, width: 290, text: 'If the hypothesis is correct, then [specific measurable outcome] will be observed when [experimental condition] is applied.', fontSize: 15, fontFamily: 'Inter', fill: '#334155', textAlign: 'center', originX: 'center', lineHeight: 1.6 },
        // Expected results
        { type: 'textbox', left: 1000, top: 325, width: 290, text: 'Expected: ↑ expression by >2-fold\nControl: No change', fontSize: 12, fontFamily: 'Inter', fill: '#15803d', textAlign: 'center', originX: 'center', lineHeight: 1.5 },

        // === EXPERIMENTAL APPROACH (bottom) ===
        { type: 'rect', left: 30, top: 420, width: 1140, height: 130, fill: '#fefce8', stroke: '#ca8a04', strokeWidth: 1.5, rx: 10, ry: 10 },
        { type: 'textbox', left: 600, top: 435, width: 1080, text: 'Experimental Approach', fontSize: 16, fontFamily: 'Inter', fontWeight: 700, fill: '#854d0e', textAlign: 'center', originX: 'center' },
        // 3 approach columns
        { type: 'textbox', left: 230, top: 470, width: 340, text: 'Model System\n\nDescribe cell line, animal model, or clinical cohort used.', fontSize: 12, fontFamily: 'Inter', fill: '#713f12', textAlign: 'center', originX: 'center', lineHeight: 1.5 },
        { type: 'rect', left: 400, top: 465, width: 1, height: 70, fill: '#d4a017' },
        { type: 'textbox', left: 600, top: 470, width: 340, text: 'Key Methods\n\nList primary techniques (qPCR, Western Blot, Flow Cytometry, etc.)', fontSize: 12, fontFamily: 'Inter', fill: '#713f12', textAlign: 'center', originX: 'center', lineHeight: 1.5 },
        { type: 'rect', left: 800, top: 465, width: 1, height: 70, fill: '#d4a017' },
        { type: 'textbox', left: 970, top: 470, width: 340, text: 'Controls & Statistics\n\nPositive/negative controls, n per group, statistical tests planned.', fontSize: 12, fontFamily: 'Inter', fill: '#713f12', textAlign: 'center', originX: 'center', lineHeight: 1.5 },

        // Footer
        { type: 'textbox', left: 600, top: 580, width: 800, text: 'Tip: Replace placeholder text, add pathway diagrams from the icon library, and connect elements with line tools.', fontSize: 12, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },
      ],
      background: '#ffffff',
    },
  },

  {
    id: 'poster-section',
    name: 'Research Poster',
    description: 'Scientific poster layout with Introduction, Methods, Results, and Conclusion sections',
    category: 'scientific',
    paperSize: 'poster',
    dimensions: { width: 1400, height: 1000 },
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjxyZWN0IHg9IjEwIiB5PSI4IiB3aWR0aD0iMjgwIiBoZWlnaHQ9IjMwIiByeD0iMyIgZmlsbD0iIzFkNGVkOCIvPjx0ZXh0IHg9IjE1MCIgeT0iMjgiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2ZmZiI+UG9zdGVyIFRpdGxlPC90ZXh0PjxyZWN0IHg9IjEwIiB5PSI0NSIgd2lkdGg9IjYyIiBoZWlnaHQ9IjcwIiByeD0iMyIgZmlsbD0iI2Y1ZjVmNSIgc3Ryb2tlPSIjZGRkIiBzdHJva2Utd2lkdGg9IjEiLz48dGV4dCB4PSI0MSIgeT0iODAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI3IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5JbnRybzwvdGV4dD48cmVjdCB4PSI4MCIgeT0iNDUiIHdpZHRoPSI2MiIgaGVpZ2h0PSI3MCIgcng9IjMiIGZpbGw9IiNmNWY1ZjUiIHN0cm9rZT0iI2RkZCIgc3Ryb2tlLXdpZHRoPSIxIi8+PHRleHQgeD0iMTExIiB5PSI4MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjciIHRleHQtYW5jaG9yPSJtaWRkbGUiPk1ldGhvZHM8L3RleHQ+PHJlY3QgeD0iMTUwIiB5PSI0NSIgd2lkdGg9IjcwIiBoZWlnaHQ9IjcwIiByeD0iMyIgZmlsbD0iI2Y1ZjVmNSIgc3Ryb2tlPSIjZGRkIiBzdHJva2Utd2lkdGg9IjEiLz48dGV4dCB4PSIxODUiIHk9IjgwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iNyIgdGV4dC1hbmNob3I9Im1pZGRsZSI+UmVzdWx0czwvdGV4dD48cmVjdCB4PSIyMjgiIHk9IjQ1IiB3aWR0aD0iNjIiIGhlaWdodD0iNzAiIHJ4PSIzIiBmaWxsPSIjZjVmNWY1IiBzdHJva2U9IiNkZGQiIHN0cm9rZS13aWR0aD0iMSIvPjx0ZXh0IHg9IjI1OSIgeT0iODAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI3IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Db25jbC48L3RleHQ+PC9zdmc+',
    canvasData: {
      version: '6.0.0',
      objects: [
        // Header bar
        { type: 'rect', left: 0, top: 0, width: 1400, height: 120, fill: '#1d4ed8' },

        // Logo placeholder (left)
        { type: 'circle', left: 80, top: 60, radius: 35, fill: '#1e40af', stroke: '#3b82f6', strokeWidth: 2, originX: 'center', originY: 'center' },
        { type: 'textbox', left: 80, top: 52, width: 50, text: 'LOGO', fontSize: 11, fontFamily: 'Inter', fontWeight: 700, fill: '#93c5fd', textAlign: 'center', originX: 'center' },

        // Logo placeholder (right)
        { type: 'circle', left: 1320, top: 60, radius: 35, fill: '#1e40af', stroke: '#3b82f6', strokeWidth: 2, originX: 'center', originY: 'center' },
        { type: 'textbox', left: 1320, top: 52, width: 50, text: 'LOGO', fontSize: 11, fontFamily: 'Inter', fontWeight: 700, fill: '#93c5fd', textAlign: 'center', originX: 'center' },

        // Title
        { type: 'textbox', left: 700, top: 18, width: 1100, text: 'Your Research Poster Title Goes Here', fontSize: 32, fontFamily: 'Inter', fontWeight: 700, fill: '#ffffff', textAlign: 'center', originX: 'center' },

        // Authors
        { type: 'textbox', left: 700, top: 62, width: 1000, text: 'First Author¹, Second Author², Third Author¹', fontSize: 16, fontFamily: 'Inter', fill: '#bfdbfe', textAlign: 'center', originX: 'center' },

        // Affiliations
        { type: 'textbox', left: 700, top: 88, width: 1000, text: '¹Department of Biology, University Name  |  ²Department of Chemistry, University Name', fontSize: 12, fontFamily: 'Inter', fill: '#93c5fd', textAlign: 'center', originX: 'center' },

        // === INTRODUCTION (col 1) ===
        { type: 'rect', left: 30, top: 145, width: 320, height: 500, fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1.5, rx: 8, ry: 8 },
        { type: 'rect', left: 30, top: 145, width: 320, height: 40, fill: '#1d4ed8', rx: 8, ry: 8 },
        { type: 'rect', left: 30, top: 170, width: 320, height: 20, fill: '#1d4ed8' },
        { type: 'textbox', left: 190, top: 152, width: 280, text: 'Introduction', fontSize: 16, fontFamily: 'Inter', fontWeight: 700, fill: '#ffffff', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 50, top: 200, width: 280, text: 'Background\n\n• Describe the context and significance of your research\n\n• Explain what is currently known about the topic\n\n• Identify the knowledge gap\n\n\nObjective\n\nState the specific aim of this study and your hypothesis.', fontSize: 12, fontFamily: 'Inter', fill: '#334155', lineHeight: 1.5 },

        // === METHODS (col 2) ===
        { type: 'rect', left: 375, top: 145, width: 320, height: 500, fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1.5, rx: 8, ry: 8 },
        { type: 'rect', left: 375, top: 145, width: 320, height: 40, fill: '#7c3aed', rx: 8, ry: 8 },
        { type: 'rect', left: 375, top: 170, width: 320, height: 20, fill: '#7c3aed' },
        { type: 'textbox', left: 535, top: 152, width: 280, text: 'Methods', fontSize: 16, fontFamily: 'Inter', fontWeight: 700, fill: '#ffffff', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 395, top: 200, width: 280, text: 'Study Design\n\n• Model system / participants\n• Sample size and groups\n• Treatment conditions\n\nProcedures\n\n• Key experimental steps\n• Techniques used\n• Measurements collected\n\nStatistical Analysis\n\n• Tests used and significance level', fontSize: 12, fontFamily: 'Inter', fill: '#334155', lineHeight: 1.5 },

        // === RESULTS (col 3 — wider) ===
        { type: 'rect', left: 720, top: 145, width: 380, height: 500, fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1.5, rx: 8, ry: 8 },
        { type: 'rect', left: 720, top: 145, width: 380, height: 40, fill: '#16a34a', rx: 8, ry: 8 },
        { type: 'rect', left: 720, top: 170, width: 380, height: 20, fill: '#16a34a' },
        { type: 'textbox', left: 910, top: 152, width: 340, text: 'Results', fontSize: 16, fontFamily: 'Inter', fontWeight: 700, fill: '#ffffff', textAlign: 'center', originX: 'center' },
        // Figure placeholder
        { type: 'rect', left: 740, top: 200, width: 340, height: 200, fill: '#f0fdf4', stroke: '#86efac', strokeWidth: 1, rx: 6, ry: 6, strokeDashArray: [6, 4] },
        { type: 'textbox', left: 910, top: 285, width: 300, text: 'Place figures / charts here', fontSize: 13, fontFamily: 'Inter', fill: '#86efac', textAlign: 'center', originX: 'center' },
        // Results text
        { type: 'textbox', left: 740, top: 420, width: 340, text: '• Key finding 1 with quantitative data\n\n• Key finding 2 with statistical significance\n\n• Key finding 3 supporting your hypothesis', fontSize: 12, fontFamily: 'Inter', fill: '#334155', lineHeight: 1.5 },

        // === CONCLUSION (col 4) ===
        { type: 'rect', left: 1125, top: 145, width: 250, height: 500, fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1.5, rx: 8, ry: 8 },
        { type: 'rect', left: 1125, top: 145, width: 250, height: 40, fill: '#ea580c', rx: 8, ry: 8 },
        { type: 'rect', left: 1125, top: 170, width: 250, height: 20, fill: '#ea580c' },
        { type: 'textbox', left: 1250, top: 152, width: 210, text: 'Conclusion', fontSize: 16, fontFamily: 'Inter', fontWeight: 700, fill: '#ffffff', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 1145, top: 200, width: 210, text: 'Summary\n\n• Main conclusion supported by data\n\n• How findings address the research question\n\n\nSignificance\n\n• Broader impact of findings\n\n\nFuture Directions\n\n• Next steps and follow-up experiments', fontSize: 12, fontFamily: 'Inter', fill: '#334155', lineHeight: 1.5 },

        // === REFERENCES & ACKNOWLEDGEMENTS (bottom) ===
        { type: 'rect', left: 30, top: 670, width: 660, height: 100, fill: '#f1f5f9', stroke: '#e2e8f0', strokeWidth: 1, rx: 6, ry: 6 },
        { type: 'textbox', left: 50, top: 680, width: 620, text: 'References', fontSize: 13, fontFamily: 'Inter', fontWeight: 700, fill: '#475569' },
        { type: 'textbox', left: 50, top: 700, width: 620, text: '1. Author A, et al. (2024) Title. Journal Name. 12(3):45-67.\n2. Author B, et al. (2023) Title. Journal Name. 8(1):12-34.', fontSize: 11, fontFamily: 'Inter', fill: '#64748b', lineHeight: 1.5 },

        { type: 'rect', left: 715, top: 670, width: 660, height: 100, fill: '#f1f5f9', stroke: '#e2e8f0', strokeWidth: 1, rx: 6, ry: 6 },
        { type: 'textbox', left: 735, top: 680, width: 620, text: 'Acknowledgements', fontSize: 13, fontFamily: 'Inter', fontWeight: 700, fill: '#475569' },
        { type: 'textbox', left: 735, top: 700, width: 620, text: 'This work was supported by [Funding Agency, Grant Number]. We thank [collaborators and facilities] for their contributions.', fontSize: 11, fontFamily: 'Inter', fill: '#64748b', lineHeight: 1.5 },

        // Footer
        { type: 'rect', left: 0, top: 785, width: 1400, height: 30, fill: '#1d4ed8' },
        { type: 'textbox', left: 700, top: 790, width: 1200, text: 'Contact: email@university.edu  |  Lab Website: www.labname.edu  |  Created with BioSketch.art', fontSize: 11, fontFamily: 'Inter', fill: '#bfdbfe', textAlign: 'center', originX: 'center' },
      ],
      background: '#ffffff',
    },
  },

  // ─── Research & Publication Templates ───

  {
    id: 'graphical-abstract',
    name: 'Graphical Abstract',
    description: 'Journal-ready layout with title, figure panels, and conclusion',
    category: 'scientific',
    paperSize: 'letter',
    dimensions: { width: 1200, height: 800 },
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjxyZWN0IHg9IjEwIiB5PSI4IiB3aWR0aD0iMjgwIiBoZWlnaHQ9IjMwIiByeD0iNCIgZmlsbD0iIzFkNGVkOCIvPjx0ZXh0IHg9IjE1MCIgeT0iMjgiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2ZmZiI+R3JhcGhpY2FsIEFic3RyYWN0PC90ZXh0PjxyZWN0IHg9IjEwIiB5PSI0NSIgd2lkdGg9IjEzMCIgaGVpZ2h0PSI5MCIgcng9IjQiIGZpbGw9IiNlZWU3ZmUiIHN0cm9rZT0iIzdjM2FlZCIgc3Ryb2tlLXdpZHRoPSIxIi8+PHJlY3QgeD0iMTUwIiB5PSI0NSIgd2lkdGg9IjE0MCIgaGVpZ2h0PSI5MCIgcng9IjQiIGZpbGw9IiNkYmVhZmUiIHN0cm9rZT0iIzE2YTM0YSIgc3Ryb2tlLXdpZHRoPSIxIi8+PHJlY3QgeD0iMTAiIHk9IjE0NSIgd2lkdGg9IjI4MCIgaGVpZ2h0PSI0NSIgcng9IjQiIGZpbGw9IiNmMGY5ZmYiIHN0cm9rZT0iIzBjNGE2ZSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9zdmc+',
    canvasData: {
      version: '6.0.0',
      objects: [
        // Title bar
        { type: 'rect', left: 0, top: 0, width: 1200, height: 80, fill: '#1d4ed8', selectable: true },
        { type: 'textbox', left: 600, top: 25, width: 1000, text: 'Your Title Here: A Graphical Abstract', fontSize: 28, fontFamily: 'Inter', fontWeight: 700, fill: '#ffffff', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 600, top: 58, width: 1000, text: 'Author Name¹, Co-Author Name² — Journal Name, 2026', fontSize: 13, fontFamily: 'Inter', fill: '#bfdbfe', textAlign: 'center', originX: 'center' },

        // Left panel — Hypothesis / Introduction
        { type: 'rect', left: 30, top: 110, width: 360, height: 320, fill: '#f5f3ff', stroke: '#7c3aed', strokeWidth: 1.5, rx: 8, ry: 8 },
        { type: 'textbox', left: 210, top: 125, width: 320, text: 'Hypothesis', fontSize: 18, fontFamily: 'Inter', fontWeight: 700, fill: '#5b21b6', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 210, top: 160, width: 310, text: 'Describe your hypothesis or research question here. Add icons from the sidebar to illustrate key concepts.', fontSize: 13, fontFamily: 'Inter', fill: '#6b7280', textAlign: 'center', originX: 'center', lineHeight: 1.6 },
        // Placeholder icon area
        { type: 'rect', left: 110, top: 240, width: 200, height: 150, fill: '#ede9fe', stroke: '#a78bfa', strokeWidth: 1, rx: 6, ry: 6, strokeDashArray: [6, 4] },
        { type: 'textbox', left: 210, top: 300, width: 180, text: 'Drag icons here', fontSize: 12, fontFamily: 'Inter', fill: '#a78bfa', textAlign: 'center', originX: 'center' },

        // Center panel — Methods / Key Finding
        { type: 'rect', left: 420, top: 110, width: 360, height: 320, fill: '#f0fdf4', stroke: '#16a34a', strokeWidth: 1.5, rx: 8, ry: 8 },
        { type: 'textbox', left: 600, top: 125, width: 320, text: 'Key Finding', fontSize: 18, fontFamily: 'Inter', fontWeight: 700, fill: '#15803d', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 600, top: 160, width: 310, text: 'Present your main result or experimental data. Use shapes and connectors to build diagrams.', fontSize: 13, fontFamily: 'Inter', fill: '#6b7280', textAlign: 'center', originX: 'center', lineHeight: 1.6 },
        { type: 'rect', left: 500, top: 240, width: 200, height: 150, fill: '#dcfce7', stroke: '#4ade80', strokeWidth: 1, rx: 6, ry: 6, strokeDashArray: [6, 4] },
        { type: 'textbox', left: 600, top: 300, width: 180, text: 'Add figure here', fontSize: 12, fontFamily: 'Inter', fill: '#4ade80', textAlign: 'center', originX: 'center' },

        // Right panel — Result / Impact
        { type: 'rect', left: 810, top: 110, width: 360, height: 320, fill: '#fff7ed', stroke: '#ea580c', strokeWidth: 1.5, rx: 8, ry: 8 },
        { type: 'textbox', left: 990, top: 125, width: 320, text: 'Impact', fontSize: 18, fontFamily: 'Inter', fontWeight: 700, fill: '#c2410c', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 990, top: 160, width: 310, text: 'Summarize the broader significance of your findings and potential applications.', fontSize: 13, fontFamily: 'Inter', fill: '#6b7280', textAlign: 'center', originX: 'center', lineHeight: 1.6 },
        { type: 'rect', left: 890, top: 240, width: 200, height: 150, fill: '#ffedd5', stroke: '#fb923c', strokeWidth: 1, rx: 6, ry: 6, strokeDashArray: [6, 4] },
        { type: 'textbox', left: 990, top: 300, width: 180, text: 'Add figure here', fontSize: 12, fontFamily: 'Inter', fill: '#fb923c', textAlign: 'center', originX: 'center' },

        // Arrow connectors between panels
        { type: 'textbox', left: 395, top: 255, width: 20, text: '→', fontSize: 28, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 785, top: 255, width: 20, text: '→', fontSize: 28, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },

        // Conclusion bar
        { type: 'rect', left: 30, top: 460, width: 1140, height: 80, fill: '#f0f9ff', stroke: '#0c4a6e', strokeWidth: 1.5, rx: 8, ry: 8 },
        { type: 'textbox', left: 600, top: 475, width: 1060, text: 'Conclusion', fontSize: 16, fontFamily: 'Inter', fontWeight: 700, fill: '#0c4a6e', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 600, top: 500, width: 1060, text: 'Write your one-line takeaway message here. This should summarize the story of your graphical abstract.', fontSize: 13, fontFamily: 'Inter', fill: '#475569', textAlign: 'center', originX: 'center' },

        // Footer
        { type: 'textbox', left: 600, top: 565, width: 400, text: 'Created with BioSketch.art', fontSize: 11, fontFamily: 'Inter', fill: '#cbd5e1', textAlign: 'center', originX: 'center' },
      ],
      background: '#ffffff',
    },
  },

  {
    id: 'figure-panel-2x2',
    name: 'Figure Panel (2×2)',
    description: 'Publication figure with labeled panels A–D and caption area',
    category: 'scientific',
    paperSize: 'letter',
    dimensions: { width: 1000, height: 900 },
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjxyZWN0IHg9IjEwIiB5PSIxMCIgd2lkdGg9IjEzMCIgaGVpZ2h0PSI3NSIgcng9IjQiIGZpbGw9IiNmNWY1ZjUiIHN0cm9rZT0iIzMzMyIgc3Ryb2tlLXdpZHRoPSIxIi8+PHRleHQgeD0iMTgiIHk9IjI4IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZvbnQtd2VpZ2h0PSJib2xkIj5BPC90ZXh0PjxyZWN0IHg9IjE1MCIgeT0iMTAiIHdpZHRoPSIxMzAiIGhlaWdodD0iNzUiIHJ4PSI0IiBmaWxsPSIjZjVmNWY1IiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iMSIvPjx0ZXh0IHg9IjE1OCIgeT0iMjgiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZm9udC13ZWlnaHQ9ImJvbGQiPkI8L3RleHQ+PHJlY3QgeD0iMTAiIHk9Ijk1IiB3aWR0aD0iMTMwIiBoZWlnaHQ9Ijc1IiByeD0iNCIgZmlsbD0iI2Y1ZjVmNSIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjEiLz48dGV4dCB4PSIxOCIgeT0iMTEzIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZvbnQtd2VpZ2h0PSJib2xkIj5DPC90ZXh0PjxyZWN0IHg9IjE1MCIgeT0iOTUiIHdpZHRoPSIxMzAiIGhlaWdodD0iNzUiIHJ4PSI0IiBmaWxsPSIjZjVmNWY1IiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iMSIvPjx0ZXh0IHg9IjE1OCIgeT0iMTEzIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZvbnQtd2VpZ2h0PSJib2xkIj5EPC90ZXh0Pjwvc3ZnPg==',
    canvasData: {
      version: '6.0.0',
      objects: [
        // Title
        { type: 'textbox', left: 500, top: 25, width: 900, text: 'Figure 1. Your Figure Title Here', fontSize: 18, fontFamily: 'Inter', fontWeight: 700, fill: '#1e293b', textAlign: 'center', originX: 'center' },

        // Panel A
        { type: 'rect', left: 40, top: 70, width: 440, height: 320, fill: '#fafafa', stroke: '#d1d5db', strokeWidth: 1.5, rx: 4, ry: 4 },
        { type: 'textbox', left: 55, top: 78, width: 30, text: 'A', fontSize: 22, fontFamily: 'Inter', fontWeight: 800, fill: '#1e293b' },
        { type: 'textbox', left: 260, top: 220, width: 200, text: 'Panel A content', fontSize: 13, fontFamily: 'Inter', fill: '#9ca3af', textAlign: 'center', originX: 'center' },

        // Panel B
        { type: 'rect', left: 520, top: 70, width: 440, height: 320, fill: '#fafafa', stroke: '#d1d5db', strokeWidth: 1.5, rx: 4, ry: 4 },
        { type: 'textbox', left: 535, top: 78, width: 30, text: 'B', fontSize: 22, fontFamily: 'Inter', fontWeight: 800, fill: '#1e293b' },
        { type: 'textbox', left: 740, top: 220, width: 200, text: 'Panel B content', fontSize: 13, fontFamily: 'Inter', fill: '#9ca3af', textAlign: 'center', originX: 'center' },

        // Panel C
        { type: 'rect', left: 40, top: 420, width: 440, height: 320, fill: '#fafafa', stroke: '#d1d5db', strokeWidth: 1.5, rx: 4, ry: 4 },
        { type: 'textbox', left: 55, top: 428, width: 30, text: 'C', fontSize: 22, fontFamily: 'Inter', fontWeight: 800, fill: '#1e293b' },
        { type: 'textbox', left: 260, top: 570, width: 200, text: 'Panel C content', fontSize: 13, fontFamily: 'Inter', fill: '#9ca3af', textAlign: 'center', originX: 'center' },

        // Panel D
        { type: 'rect', left: 520, top: 420, width: 440, height: 320, fill: '#fafafa', stroke: '#d1d5db', strokeWidth: 1.5, rx: 4, ry: 4 },
        { type: 'textbox', left: 535, top: 428, width: 30, text: 'D', fontSize: 22, fontFamily: 'Inter', fontWeight: 800, fill: '#1e293b' },
        { type: 'textbox', left: 740, top: 570, width: 200, text: 'Panel D content', fontSize: 13, fontFamily: 'Inter', fill: '#9ca3af', textAlign: 'center', originX: 'center' },

        // Caption area
        { type: 'rect', left: 40, top: 770, width: 920, height: 100, fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1, rx: 4, ry: 4 },
        { type: 'textbox', left: 60, top: 780, width: 880, text: 'Figure 1. Caption text goes here. (A) Description of panel A. (B) Description of panel B. (C) Description of panel C. (D) Description of panel D. Scale bar = 100 μm.', fontSize: 12, fontFamily: 'Inter', fill: '#475569', lineHeight: 1.8 },
      ],
      background: '#ffffff',
    },
  },

  {
    id: 'methods-workflow',
    name: 'Methods Workflow',
    description: 'Horizontal pipeline with numbered steps and connecting arrows',
    category: 'scientific',
    paperSize: 'letter',
    dimensions: { width: 1400, height: 600 },
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjxjaXJjbGUgY3g9IjQwIiBjeT0iMTAwIiByPSIyNSIgZmlsbD0iIzFkNGVkOCIvPjx0ZXh0IHg9IjQwIiB5PSIxMDUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2ZmZiI+MTwvdGV4dD48bGluZSB4MT0iNjUiIHkxPSIxMDAiIHgyPSI5NSIgeTI9IjEwMCIgc3Ryb2tlPSIjOTRhM2I4IiBzdHJva2Utd2lkdGg9IjIiIG1hcmtlci1lbmQ9InVybCgjaGVhZCkiLz48Y2lyY2xlIGN4PSIxMjAiIGN5PSIxMDAiIHI9IjI1IiBmaWxsPSIjN2MzYWVkIi8+PHRleHQgeD0iMTIwIiB5PSIxMDUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2ZmZiI+MjwvdGV4dD48bGluZSB4MT0iMTQ1IiB5MT0iMTAwIiB4Mj0iMTc1IiB5Mj0iMTAwIiBzdHJva2U9IiM5NGEzYjgiIHN0cm9rZS13aWR0aD0iMiIvPjxjaXJjbGUgY3g9IjIwMCIgY3k9IjEwMCIgcj0iMjUiIGZpbGw9IiMxNmEzNGEiLz48dGV4dCB4PSIyMDAiIHk9IjEwNSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZmZmIj4zPC90ZXh0PjxsaW5lIHgxPSIyMjUiIHkxPSIxMDAiIHgyPSIyNTUiIHkyPSIxMDAiIHN0cm9rZT0iIzk0YTNiOCIgc3Ryb2tlLXdpZHRoPSIyIi8+PGNpcmNsZSBjeD0iMjgwIiBjeT0iMTAwIiByPSIyNSIgZmlsbD0iI2VhNTgwYyIvPjx0ZXh0IHg9IjI4MCIgeT0iMTA1IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNmZmYiPjQ8L3RleHQ+PC9zdmc+',
    canvasData: {
      version: '6.0.0',
      objects: [
        // Title
        { type: 'textbox', left: 700, top: 30, width: 1200, text: 'Experimental Methods Workflow', fontSize: 24, fontFamily: 'Inter', fontWeight: 700, fill: '#1e293b', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 700, top: 62, width: 800, text: 'Replace the placeholder text and icons below with your experimental steps', fontSize: 13, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },

        // Step 1
        { type: 'circle', left: 120, top: 180, radius: 40, fill: '#1d4ed8', originX: 'center', originY: 'center' },
        { type: 'textbox', left: 120, top: 170, width: 40, text: '1', fontSize: 24, fontFamily: 'Inter', fontWeight: 800, fill: '#ffffff', textAlign: 'center', originX: 'center' },
        { type: 'rect', left: 40, top: 240, width: 160, height: 160, fill: '#eff6ff', stroke: '#93c5fd', strokeWidth: 1, rx: 8, ry: 8, strokeDashArray: [6, 4] },
        { type: 'textbox', left: 120, top: 260, width: 140, text: 'Sample\nCollection', fontSize: 15, fontFamily: 'Inter', fontWeight: 600, fill: '#1d4ed8', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 120, top: 320, width: 130, text: 'Drag icons here', fontSize: 11, fontFamily: 'Inter', fill: '#93c5fd', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 120, top: 420, width: 150, text: 'Describe step details', fontSize: 11, fontFamily: 'Inter', fill: '#64748b', textAlign: 'center', originX: 'center', lineHeight: 1.5 },

        // Arrow 1→2
        { type: 'textbox', left: 255, top: 300, width: 40, text: '→', fontSize: 32, fontFamily: 'Inter', fill: '#cbd5e1', textAlign: 'center', originX: 'center' },

        // Step 2
        { type: 'circle', left: 400, top: 180, radius: 40, fill: '#7c3aed', originX: 'center', originY: 'center' },
        { type: 'textbox', left: 400, top: 170, width: 40, text: '2', fontSize: 24, fontFamily: 'Inter', fontWeight: 800, fill: '#ffffff', textAlign: 'center', originX: 'center' },
        { type: 'rect', left: 320, top: 240, width: 160, height: 160, fill: '#f5f3ff', stroke: '#c4b5fd', strokeWidth: 1, rx: 8, ry: 8, strokeDashArray: [6, 4] },
        { type: 'textbox', left: 400, top: 260, width: 140, text: 'Treatment\n/ Processing', fontSize: 15, fontFamily: 'Inter', fontWeight: 600, fill: '#7c3aed', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 400, top: 320, width: 130, text: 'Drag icons here', fontSize: 11, fontFamily: 'Inter', fill: '#c4b5fd', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 400, top: 420, width: 150, text: 'Describe step details', fontSize: 11, fontFamily: 'Inter', fill: '#64748b', textAlign: 'center', originX: 'center', lineHeight: 1.5 },

        // Arrow 2→3
        { type: 'textbox', left: 535, top: 300, width: 40, text: '→', fontSize: 32, fontFamily: 'Inter', fill: '#cbd5e1', textAlign: 'center', originX: 'center' },

        // Step 3
        { type: 'circle', left: 680, top: 180, radius: 40, fill: '#16a34a', originX: 'center', originY: 'center' },
        { type: 'textbox', left: 680, top: 170, width: 40, text: '3', fontSize: 24, fontFamily: 'Inter', fontWeight: 800, fill: '#ffffff', textAlign: 'center', originX: 'center' },
        { type: 'rect', left: 600, top: 240, width: 160, height: 160, fill: '#f0fdf4', stroke: '#86efac', strokeWidth: 1, rx: 8, ry: 8, strokeDashArray: [6, 4] },
        { type: 'textbox', left: 680, top: 260, width: 140, text: 'Analysis\n/ Assay', fontSize: 15, fontFamily: 'Inter', fontWeight: 600, fill: '#16a34a', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 680, top: 320, width: 130, text: 'Drag icons here', fontSize: 11, fontFamily: 'Inter', fill: '#86efac', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 680, top: 420, width: 150, text: 'Describe step details', fontSize: 11, fontFamily: 'Inter', fill: '#64748b', textAlign: 'center', originX: 'center', lineHeight: 1.5 },

        // Arrow 3→4
        { type: 'textbox', left: 815, top: 300, width: 40, text: '→', fontSize: 32, fontFamily: 'Inter', fill: '#cbd5e1', textAlign: 'center', originX: 'center' },

        // Step 4
        { type: 'circle', left: 960, top: 180, radius: 40, fill: '#ea580c', originX: 'center', originY: 'center' },
        { type: 'textbox', left: 960, top: 170, width: 40, text: '4', fontSize: 24, fontFamily: 'Inter', fontWeight: 800, fill: '#ffffff', textAlign: 'center', originX: 'center' },
        { type: 'rect', left: 880, top: 240, width: 160, height: 160, fill: '#fff7ed', stroke: '#fdba74', strokeWidth: 1, rx: 8, ry: 8, strokeDashArray: [6, 4] },
        { type: 'textbox', left: 960, top: 260, width: 140, text: 'Data\nVisualization', fontSize: 15, fontFamily: 'Inter', fontWeight: 600, fill: '#ea580c', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 960, top: 320, width: 130, text: 'Drag icons here', fontSize: 11, fontFamily: 'Inter', fill: '#fdba74', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 960, top: 420, width: 150, text: 'Describe step details', fontSize: 11, fontFamily: 'Inter', fill: '#64748b', textAlign: 'center', originX: 'center', lineHeight: 1.5 },

        // Arrow 4→5
        { type: 'textbox', left: 1095, top: 300, width: 40, text: '→', fontSize: 32, fontFamily: 'Inter', fill: '#cbd5e1', textAlign: 'center', originX: 'center' },

        // Step 5
        { type: 'circle', left: 1240, top: 180, radius: 40, fill: '#dc2626', originX: 'center', originY: 'center' },
        { type: 'textbox', left: 1240, top: 170, width: 40, text: '5', fontSize: 24, fontFamily: 'Inter', fontWeight: 800, fill: '#ffffff', textAlign: 'center', originX: 'center' },
        { type: 'rect', left: 1160, top: 240, width: 160, height: 160, fill: '#fef2f2', stroke: '#fca5a5', strokeWidth: 1, rx: 8, ry: 8, strokeDashArray: [6, 4] },
        { type: 'textbox', left: 1240, top: 260, width: 140, text: 'Results\n/ Conclusion', fontSize: 15, fontFamily: 'Inter', fontWeight: 600, fill: '#dc2626', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 1240, top: 320, width: 130, text: 'Drag icons here', fontSize: 11, fontFamily: 'Inter', fill: '#fca5a5', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 1240, top: 420, width: 150, text: 'Describe step details', fontSize: 11, fontFamily: 'Inter', fill: '#64748b', textAlign: 'center', originX: 'center', lineHeight: 1.5 },

        // Bottom note
        { type: 'textbox', left: 700, top: 510, width: 1000, text: 'Tip: Replace placeholder text, add icons from the sidebar, and connect steps with line tools.', fontSize: 12, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },
      ],
      background: '#ffffff',
    },
  },

  {
    id: 'experimental-timeline',
    name: 'Experimental Timeline',
    description: 'Horizontal timeline for experimental protocols with day markers',
    category: 'scientific',
    paperSize: 'letter',
    dimensions: { width: 1400, height: 500 },
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjxsaW5lIHgxPSIyMCIgeTE9IjEwMCIgeDI9IjI4MCIgeTI9IjEwMCIgc3Ryb2tlPSIjMWQ0ZWQ4IiBzdHJva2Utd2lkdGg9IjMiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjEwMCIgcj0iOCIgZmlsbD0iIzFkNGVkOCIvPjx0ZXh0IHg9IjUwIiB5PSI4MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5EYXkgMDwvdGV4dD48Y2lyY2xlIGN4PSIxMjAiIGN5PSIxMDAiIHI9IjgiIGZpbGw9IiM3YzNhZWQiLz48dGV4dCB4PSIxMjAiIHk9IjgwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTAiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkRheSAzPC90ZXh0PjxjaXJjbGUgY3g9IjE5MCIgY3k9IjEwMCIgcj0iOCIgZmlsbD0iIzE2YTM0YSIvPjx0ZXh0IHg9IjE5MCIgeT0iODAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+RGF5IDc8L3RleHQ+PGNpcmNsZSBjeD0iMjYwIiBjeT0iMTAwIiByPSI4IiBmaWxsPSIjZWE1ODBjIi8+PHRleHQgeD0iMjYwIiB5PSI4MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5EYXkgMTQ8L3RleHQ+PC9zdmc+',
    canvasData: {
      version: '6.0.0',
      objects: [
        // Title
        { type: 'textbox', left: 700, top: 25, width: 1200, text: 'Experimental Protocol Timeline', fontSize: 22, fontFamily: 'Inter', fontWeight: 700, fill: '#1e293b', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 700, top: 55, width: 800, text: 'Edit day labels, descriptions, and add icons for each time point', fontSize: 13, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },

        // Main timeline line
        { type: 'rect', left: 80, top: 220, width: 1240, height: 4, fill: '#cbd5e1', rx: 2, ry: 2 },

        // Day 0
        { type: 'circle', left: 140, top: 222, radius: 14, fill: '#1d4ed8', stroke: '#ffffff', strokeWidth: 3, originX: 'center', originY: 'center' },
        { type: 'textbox', left: 140, top: 170, width: 120, text: 'Day 0', fontSize: 14, fontFamily: 'Inter', fontWeight: 700, fill: '#1d4ed8', textAlign: 'center', originX: 'center' },
        { type: 'rect', left: 70, top: 260, width: 140, height: 120, fill: '#eff6ff', stroke: '#93c5fd', strokeWidth: 1, rx: 6, ry: 6 },
        { type: 'textbox', left: 140, top: 275, width: 120, text: 'Cell Seeding\n& Treatment', fontSize: 12, fontFamily: 'Inter', fontWeight: 600, fill: '#1d4ed8', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 140, top: 330, width: 120, text: 'Add details...', fontSize: 11, fontFamily: 'Inter', fill: '#93c5fd', textAlign: 'center', originX: 'center' },

        // Day 3
        { type: 'circle', left: 400, top: 222, radius: 14, fill: '#7c3aed', stroke: '#ffffff', strokeWidth: 3, originX: 'center', originY: 'center' },
        { type: 'textbox', left: 400, top: 170, width: 120, text: 'Day 3', fontSize: 14, fontFamily: 'Inter', fontWeight: 700, fill: '#7c3aed', textAlign: 'center', originX: 'center' },
        { type: 'rect', left: 330, top: 260, width: 140, height: 120, fill: '#f5f3ff', stroke: '#c4b5fd', strokeWidth: 1, rx: 6, ry: 6 },
        { type: 'textbox', left: 400, top: 275, width: 120, text: 'Media Change\n& Stimulation', fontSize: 12, fontFamily: 'Inter', fontWeight: 600, fill: '#7c3aed', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 400, top: 330, width: 120, text: 'Add details...', fontSize: 11, fontFamily: 'Inter', fill: '#c4b5fd', textAlign: 'center', originX: 'center' },

        // Day 7
        { type: 'circle', left: 660, top: 222, radius: 14, fill: '#16a34a', stroke: '#ffffff', strokeWidth: 3, originX: 'center', originY: 'center' },
        { type: 'textbox', left: 660, top: 170, width: 120, text: 'Day 7', fontSize: 14, fontFamily: 'Inter', fontWeight: 700, fill: '#16a34a', textAlign: 'center', originX: 'center' },
        { type: 'rect', left: 590, top: 260, width: 140, height: 120, fill: '#f0fdf4', stroke: '#86efac', strokeWidth: 1, rx: 6, ry: 6 },
        { type: 'textbox', left: 660, top: 275, width: 120, text: 'Sample\nCollection', fontSize: 12, fontFamily: 'Inter', fontWeight: 600, fill: '#16a34a', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 660, top: 330, width: 120, text: 'Add details...', fontSize: 11, fontFamily: 'Inter', fill: '#86efac', textAlign: 'center', originX: 'center' },

        // Day 14
        { type: 'circle', left: 920, top: 222, radius: 14, fill: '#ea580c', stroke: '#ffffff', strokeWidth: 3, originX: 'center', originY: 'center' },
        { type: 'textbox', left: 920, top: 170, width: 120, text: 'Day 14', fontSize: 14, fontFamily: 'Inter', fontWeight: 700, fill: '#ea580c', textAlign: 'center', originX: 'center' },
        { type: 'rect', left: 850, top: 260, width: 140, height: 120, fill: '#fff7ed', stroke: '#fdba74', strokeWidth: 1, rx: 6, ry: 6 },
        { type: 'textbox', left: 920, top: 275, width: 120, text: 'Analysis\n& Imaging', fontSize: 12, fontFamily: 'Inter', fontWeight: 600, fill: '#ea580c', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 920, top: 330, width: 120, text: 'Add details...', fontSize: 11, fontFamily: 'Inter', fill: '#fdba74', textAlign: 'center', originX: 'center' },

        // Day 21
        { type: 'circle', left: 1180, top: 222, radius: 14, fill: '#dc2626', stroke: '#ffffff', strokeWidth: 3, originX: 'center', originY: 'center' },
        { type: 'textbox', left: 1180, top: 170, width: 120, text: 'Day 21', fontSize: 14, fontFamily: 'Inter', fontWeight: 700, fill: '#dc2626', textAlign: 'center', originX: 'center' },
        { type: 'rect', left: 1110, top: 260, width: 140, height: 120, fill: '#fef2f2', stroke: '#fca5a5', strokeWidth: 1, rx: 6, ry: 6 },
        { type: 'textbox', left: 1180, top: 275, width: 120, text: 'Results\n& Endpoints', fontSize: 12, fontFamily: 'Inter', fontWeight: 600, fill: '#dc2626', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 1180, top: 330, width: 120, text: 'Add details...', fontSize: 11, fontFamily: 'Inter', fill: '#fca5a5', textAlign: 'center', originX: 'center' },

        // Bottom note
        { type: 'textbox', left: 700, top: 430, width: 1000, text: 'Tip: Edit day labels, add icons from the sidebar, and adjust colors in the Properties panel.', fontSize: 12, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },
      ],
      background: '#ffffff',
    },
  },

  // ─── Template: Cell Signaling Pathway ───
  {
    id: 'cell-signaling-pathway',
    name: 'Cell Signaling Pathway',
    description: 'Horizontal signal transduction cascade from ligand binding to gene expression',
    category: 'scientific',
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==',
    paperSize: 'custom',
    dimensions: { width: 1300, height: 700 },
    canvasData: {
      version: '6.0.0',
      objects: [
        // Title
        { type: 'textbox', left: 650, top: 30, width: 600, text: 'Cell Signaling Pathway', fontSize: 28, fontFamily: 'Inter', fontWeight: 700, fill: '#1e293b', textAlign: 'center', originX: 'center' },

        // Region labels
        { type: 'textbox', left: 120, top: 80, width: 200, text: 'Extracellular', fontSize: 14, fontFamily: 'Inter', fontWeight: 600, fill: '#64748b', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 650, top: 280, width: 200, text: 'Cytoplasm', fontSize: 14, fontFamily: 'Inter', fontWeight: 600, fill: '#64748b', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 1050, top: 280, width: 200, text: 'Nucleus', fontSize: 14, fontFamily: 'Inter', fontWeight: 600, fill: '#64748b', textAlign: 'center', originX: 'center' },

        // Cell membrane bar
        { type: 'rect', left: 210, top: 150, width: 30, height: 400, fill: '#fbbf24', stroke: '#ca8a04', strokeWidth: 2, rx: 4, ry: 4 },
        { type: 'textbox', left: 225, top: 570, width: 80, text: 'Cell\nMembrane', fontSize: 11, fontFamily: 'Inter', fontWeight: 600, fill: '#ca8a04', textAlign: 'center', originX: 'center' },

        // 1. Ligand (extracellular)
        { type: 'rect', left: 60, top: 120, width: 110, height: 50, fill: '#dbeafe', stroke: '#1d4ed8', strokeWidth: 2, rx: 12, ry: 12 },
        { type: 'textbox', left: 115, top: 130, width: 100, text: 'Ligand', fontSize: 14, fontFamily: 'Inter', fontWeight: 600, fill: '#1d4ed8', textAlign: 'center', originX: 'center' },

        // Arrow Ligand → Receptor
        { type: 'textbox', left: 185, top: 130, width: 30, text: '→', fontSize: 22, fontFamily: 'Inter', fontWeight: 700, fill: '#475569', textAlign: 'center', originX: 'center' },

        // 2. Receptor (spanning membrane)
        { type: 'rect', left: 250, top: 100, width: 120, height: 90, fill: '#fef3c7', stroke: '#ca8a04', strokeWidth: 2, rx: 12, ry: 12 },
        { type: 'textbox', left: 310, top: 115, width: 110, text: 'Receptor\n(Activated)', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#ca8a04', textAlign: 'center', originX: 'center' },

        // Arrow Receptor → Kinase Cascade
        { type: 'textbox', left: 390, top: 130, width: 30, text: '→', fontSize: 22, fontFamily: 'Inter', fontWeight: 700, fill: '#475569', textAlign: 'center', originX: 'center' },

        // 3. Kinase Cascade (stacked)
        { type: 'rect', left: 420, top: 100, width: 140, height: 180, fill: '#f5f3ff', stroke: '#7c3aed', strokeWidth: 2, rx: 8, ry: 8 },
        { type: 'textbox', left: 490, top: 105, width: 130, text: 'Kinase Cascade', fontSize: 12, fontFamily: 'Inter', fontWeight: 700, fill: '#7c3aed', textAlign: 'center', originX: 'center' },
        // Kinase 1
        { type: 'rect', left: 440, top: 130, width: 100, height: 36, fill: '#ede9fe', stroke: '#7c3aed', strokeWidth: 1.5, rx: 8, ry: 8 },
        { type: 'textbox', left: 490, top: 136, width: 90, text: 'MAPKKK', fontSize: 12, fontFamily: 'Inter', fontWeight: 600, fill: '#7c3aed', textAlign: 'center', originX: 'center' },
        // Arrow down
        { type: 'textbox', left: 490, top: 164, width: 30, text: '↓', fontSize: 16, fontFamily: 'Inter', fontWeight: 700, fill: '#7c3aed', textAlign: 'center', originX: 'center' },
        // Kinase 2
        { type: 'rect', left: 440, top: 185, width: 100, height: 36, fill: '#ede9fe', stroke: '#7c3aed', strokeWidth: 1.5, rx: 8, ry: 8 },
        { type: 'textbox', left: 490, top: 191, width: 90, text: 'MAPKK', fontSize: 12, fontFamily: 'Inter', fontWeight: 600, fill: '#7c3aed', textAlign: 'center', originX: 'center' },
        // Arrow down
        { type: 'textbox', left: 490, top: 219, width: 30, text: '↓', fontSize: 16, fontFamily: 'Inter', fontWeight: 700, fill: '#7c3aed', textAlign: 'center', originX: 'center' },
        // Kinase 3
        { type: 'rect', left: 440, top: 238, width: 100, height: 36, fill: '#ede9fe', stroke: '#7c3aed', strokeWidth: 1.5, rx: 8, ry: 8 },
        { type: 'textbox', left: 490, top: 244, width: 90, text: 'MAPK', fontSize: 12, fontFamily: 'Inter', fontWeight: 600, fill: '#7c3aed', textAlign: 'center', originX: 'center' },

        // Arrow Kinase → TF
        { type: 'textbox', left: 580, top: 200, width: 30, text: '→', fontSize: 22, fontFamily: 'Inter', fontWeight: 700, fill: '#475569', textAlign: 'center', originX: 'center' },

        // 4. Transcription Factor
        { type: 'rect', left: 610, top: 180, width: 140, height: 55, fill: '#dcfce7', stroke: '#16a34a', strokeWidth: 2, rx: 12, ry: 12 },
        { type: 'textbox', left: 680, top: 190, width: 130, text: 'Transcription\nFactor', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#16a34a', textAlign: 'center', originX: 'center' },

        // Arrow TF → Nucleus
        { type: 'textbox', left: 770, top: 200, width: 30, text: '→', fontSize: 22, fontFamily: 'Inter', fontWeight: 700, fill: '#475569', textAlign: 'center', originX: 'center' },

        // 5. Nucleus boundary
        { type: 'rect', left: 800, top: 100, width: 280, height: 250, fill: '#eff6ff', stroke: '#1d4ed8', strokeWidth: 2, rx: 20, ry: 20, strokeDashArray: [8, 4] },
        { type: 'textbox', left: 940, top: 108, width: 120, text: 'Nucleus', fontSize: 13, fontFamily: 'Inter', fontWeight: 700, fill: '#1d4ed8', textAlign: 'center', originX: 'center' },

        // DNA / Gene target
        { type: 'rect', left: 830, top: 170, width: 220, height: 50, fill: '#dbeafe', stroke: '#1d4ed8', strokeWidth: 2, rx: 8, ry: 8 },
        { type: 'textbox', left: 940, top: 180, width: 200, text: 'Target Gene (DNA)', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#1d4ed8', textAlign: 'center', originX: 'center' },

        // Arrow → Gene Expression
        { type: 'textbox', left: 940, top: 225, width: 30, text: '↓', fontSize: 22, fontFamily: 'Inter', fontWeight: 700, fill: '#475569', textAlign: 'center', originX: 'center' },

        // 6. Gene Expression output
        { type: 'rect', left: 840, top: 260, width: 200, height: 55, fill: '#fef3c7', stroke: '#ca8a04', strokeWidth: 2, rx: 12, ry: 12 },
        { type: 'textbox', left: 940, top: 270, width: 180, text: 'Gene Expression\n(mRNA → Protein)', fontSize: 12, fontFamily: 'Inter', fontWeight: 600, fill: '#ca8a04', textAlign: 'center', originX: 'center' },

        // Process labels
        { type: 'textbox', left: 490, top: 80, width: 140, text: 'Phosphorylation', fontSize: 11, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 680, top: 160, width: 140, text: 'Nuclear\nTranslocation', fontSize: 11, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 940, top: 148, width: 140, text: 'Transcription', fontSize: 11, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },

        // Bottom legend
        { type: 'textbox', left: 650, top: 650, width: 900, text: 'Tip: Click any box to rename proteins. Duplicate steps to extend the cascade. Add inhibitors from the sidebar.', fontSize: 12, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },
      ],
      background: '#ffffff',
    },
  },

  // ─── Template: Cell Membrane Diagram ───
  {
    id: 'cell-membrane-diagram',
    name: 'Cell Membrane Structure',
    description: 'Detailed phospholipid bilayer with labeled membrane components',
    category: 'scientific',
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==',
    paperSize: 'custom',
    dimensions: { width: 1200, height: 700 },
    canvasData: {
      version: '6.0.0',
      objects: [
        // Title
        { type: 'textbox', left: 600, top: 25, width: 600, text: 'Cell Membrane Structure', fontSize: 28, fontFamily: 'Inter', fontWeight: 700, fill: '#1e293b', textAlign: 'center', originX: 'center' },

        // Region labels
        { type: 'textbox', left: 600, top: 75, width: 300, text: 'Extracellular Space', fontSize: 16, fontFamily: 'Inter', fontWeight: 600, fill: '#1d4ed8', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 600, top: 540, width: 300, text: 'Cytoplasm', fontSize: 16, fontFamily: 'Inter', fontWeight: 600, fill: '#7c3aed', textAlign: 'center', originX: 'center' },

        // Phospholipid bilayer — outer leaflet
        { type: 'rect', left: 50, top: 250, width: 1100, height: 60, fill: '#bfdbfe', stroke: '#1d4ed8', strokeWidth: 2, rx: 4, ry: 4 },
        { type: 'textbox', left: 120, top: 260, width: 180, text: 'Outer Leaflet\n(Hydrophilic Heads)', fontSize: 10, fontFamily: 'Inter', fontWeight: 600, fill: '#1d4ed8', textAlign: 'center', originX: 'center' },

        // Hydrophobic core
        { type: 'rect', left: 50, top: 310, width: 1100, height: 70, fill: '#fef9c3', stroke: '#ca8a04', strokeWidth: 1, rx: 0, ry: 0 },
        { type: 'textbox', left: 120, top: 330, width: 180, text: 'Hydrophobic\nFatty Acid Tails', fontSize: 10, fontFamily: 'Inter', fontWeight: 600, fill: '#ca8a04', textAlign: 'center', originX: 'center' },

        // Inner leaflet
        { type: 'rect', left: 50, top: 380, width: 1100, height: 60, fill: '#e9d5ff', stroke: '#7c3aed', strokeWidth: 2, rx: 4, ry: 4 },
        { type: 'textbox', left: 120, top: 390, width: 180, text: 'Inner Leaflet\n(Hydrophilic Heads)', fontSize: 10, fontFamily: 'Inter', fontWeight: 600, fill: '#7c3aed', textAlign: 'center', originX: 'center' },

        // ── Component 1: Channel Protein ──
        { type: 'rect', left: 340, top: 230, width: 60, height: 230, fill: '#dcfce7', stroke: '#16a34a', strokeWidth: 2, rx: 10, ry: 10 },
        { type: 'rect', left: 355, top: 280, width: 30, height: 130, fill: '#ffffff', stroke: '#16a34a', strokeWidth: 1.5, rx: 6, ry: 6 },
        // Label
        { type: 'textbox', left: 370, top: 480, width: 120, text: 'Channel\nProtein', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#16a34a', textAlign: 'center', originX: 'center' },
        // Leader line (vertical bar)
        { type: 'rect', left: 368, top: 460, width: 2, height: 20, fill: '#16a34a' },

        // ── Component 2: Receptor ──
        { type: 'rect', left: 530, top: 160, width: 70, height: 150, fill: '#fef3c7', stroke: '#ca8a04', strokeWidth: 2, rx: 10, ry: 10 },
        { type: 'rect', left: 545, top: 140, width: 40, height: 40, fill: '#fbbf24', stroke: '#ca8a04', strokeWidth: 2, rx: 20, ry: 20 },
        // Label
        { type: 'textbox', left: 565, top: 110, width: 120, text: 'Receptor', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#ca8a04', textAlign: 'center', originX: 'center' },
        // Binding site label
        { type: 'textbox', left: 565, top: 125, width: 120, text: '(Binding Site)', fontSize: 10, fontFamily: 'Inter', fill: '#ca8a04', textAlign: 'center', originX: 'center' },

        // ── Component 3: Peripheral Protein ──
        { type: 'rect', left: 720, top: 220, width: 100, height: 35, fill: '#ede9fe', stroke: '#7c3aed', strokeWidth: 2, rx: 14, ry: 14 },
        // Label
        { type: 'textbox', left: 770, top: 190, width: 130, text: 'Peripheral Protein', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#7c3aed', textAlign: 'center', originX: 'center' },

        // ── Component 4: Glycoprotein ──
        { type: 'rect', left: 920, top: 200, width: 60, height: 120, fill: '#fce7f3', stroke: '#db2777', strokeWidth: 2, rx: 10, ry: 10 },
        // Sugar chain placeholder (small circles above)
        { type: 'circle', left: 935, top: 180, radius: 8, fill: '#f9a8d4', stroke: '#db2777', strokeWidth: 1.5 },
        { type: 'circle', left: 955, top: 168, radius: 8, fill: '#f9a8d4', stroke: '#db2777', strokeWidth: 1.5 },
        { type: 'circle', left: 945, top: 155, radius: 8, fill: '#f9a8d4', stroke: '#db2777', strokeWidth: 1.5 },
        { type: 'circle', left: 960, top: 143, radius: 8, fill: '#f9a8d4', stroke: '#db2777', strokeWidth: 1.5 },
        // Label
        { type: 'textbox', left: 950, top: 110, width: 130, text: 'Glycoprotein', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#db2777', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 950, top: 126, width: 130, text: '(Sugar Chains)', fontSize: 10, fontFamily: 'Inter', fill: '#db2777', textAlign: 'center', originX: 'center' },

        // Bilayer thickness annotation
        { type: 'rect', left: 1070, top: 250, width: 2, height: 190, fill: '#94a3b8' },
        { type: 'textbox', left: 1110, top: 330, width: 80, text: '~7.5 nm', fontSize: 12, fontFamily: 'Inter', fontWeight: 600, fill: '#64748b', textAlign: 'center', originX: 'center' },

        // Bottom tip
        { type: 'textbox', left: 600, top: 650, width: 900, text: 'Tip: Click components to rename. Add cholesterol molecules or additional proteins from the sidebar.', fontSize: 12, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },
      ],
      background: '#ffffff',
    },
  },

  // ─── Template: Central Dogma ───
  {
    id: 'central-dogma',
    name: 'Central Dogma of Molecular Biology',
    description: 'DNA to RNA to Protein — the core flow of genetic information',
    category: 'scientific',
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==',
    paperSize: 'custom',
    dimensions: { width: 1200, height: 600 },
    canvasData: {
      version: '6.0.0',
      objects: [
        // Title
        { type: 'textbox', left: 600, top: 30, width: 700, text: 'Central Dogma of Molecular Biology', fontSize: 28, fontFamily: 'Inter', fontWeight: 700, fill: '#1e293b', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 600, top: 68, width: 700, text: 'The flow of genetic information in biological systems', fontSize: 14, fontFamily: 'Inter', fill: '#64748b', textAlign: 'center', originX: 'center' },

        // ── Stage 1: DNA ──
        { type: 'circle', left: 180, top: 200, radius: 65, fill: '#dbeafe', stroke: '#1d4ed8', strokeWidth: 3 },
        { type: 'textbox', left: 180, top: 180, width: 100, text: 'DNA', fontSize: 22, fontFamily: 'Inter', fontWeight: 700, fill: '#1d4ed8', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 180, top: 210, width: 100, text: 'Double\nHelix', fontSize: 12, fontFamily: 'Inter', fill: '#3b82f6', textAlign: 'center', originX: 'center' },

        // Replication arrow (self-loop label)
        { type: 'rect', left: 130, top: 120, width: 100, height: 30, fill: '#eff6ff', stroke: '#93c5fd', strokeWidth: 1.5, rx: 8, ry: 8 },
        { type: 'textbox', left: 180, top: 123, width: 90, text: '↻ Replication', fontSize: 11, fontFamily: 'Inter', fontWeight: 600, fill: '#1d4ed8', textAlign: 'center', originX: 'center' },

        // Arrow DNA → mRNA
        { type: 'rect', left: 270, top: 198, width: 110, height: 4, fill: '#475569', rx: 2, ry: 2 },
        { type: 'textbox', left: 325, top: 172, width: 120, text: 'Transcription', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#7c3aed', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 375, top: 195, width: 20, text: '▶', fontSize: 14, fontFamily: 'Inter', fill: '#475569', textAlign: 'center', originX: 'center' },

        // ── Stage 2: mRNA ──
        { type: 'circle', left: 480, top: 200, radius: 65, fill: '#f5f3ff', stroke: '#7c3aed', strokeWidth: 3 },
        { type: 'textbox', left: 480, top: 180, width: 100, text: 'mRNA', fontSize: 22, fontFamily: 'Inter', fontWeight: 700, fill: '#7c3aed', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 480, top: 210, width: 100, text: 'Messenger\nRNA', fontSize: 12, fontFamily: 'Inter', fill: '#8b5cf6', textAlign: 'center', originX: 'center' },

        // Arrow mRNA → Protein
        { type: 'rect', left: 570, top: 198, width: 110, height: 4, fill: '#475569', rx: 2, ry: 2 },
        { type: 'textbox', left: 625, top: 172, width: 120, text: 'Translation', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#16a34a', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 675, top: 195, width: 20, text: '▶', fontSize: 14, fontFamily: 'Inter', fill: '#475569', textAlign: 'center', originX: 'center' },

        // ── Stage 3: Protein ──
        { type: 'circle', left: 780, top: 200, radius: 65, fill: '#dcfce7', stroke: '#16a34a', strokeWidth: 3 },
        { type: 'textbox', left: 780, top: 180, width: 100, text: 'Protein', fontSize: 22, fontFamily: 'Inter', fontWeight: 700, fill: '#16a34a', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 780, top: 210, width: 100, text: 'Folded\nPolypeptide', fontSize: 12, fontFamily: 'Inter', fill: '#22c55e', textAlign: 'center', originX: 'center' },

        // ── Reverse Transcription (dashed) ──
        { type: 'rect', left: 270, top: 260, width: 180, height: 3, fill: '#94a3b8', rx: 1, ry: 1, strokeDashArray: [6, 4] },
        { type: 'textbox', left: 360, top: 268, width: 160, text: 'Reverse Transcription', fontSize: 10, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 275, top: 256, width: 20, text: '◀', fontSize: 12, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },

        // Organelle context boxes at bottom
        { type: 'rect', left: 130, top: 340, width: 400, height: 50, fill: '#eff6ff', stroke: '#93c5fd', strokeWidth: 1.5, rx: 10, ry: 10 },
        { type: 'textbox', left: 330, top: 350, width: 380, text: 'Nucleus — DNA replication & transcription occur here', fontSize: 12, fontFamily: 'Inter', fontWeight: 600, fill: '#1d4ed8', textAlign: 'center', originX: 'center' },

        { type: 'rect', left: 560, top: 340, width: 350, height: 50, fill: '#dcfce7', stroke: '#86efac', strokeWidth: 1.5, rx: 10, ry: 10 },
        { type: 'textbox', left: 735, top: 350, width: 330, text: 'Ribosome / Cytoplasm — translation occurs here', fontSize: 12, fontFamily: 'Inter', fontWeight: 600, fill: '#16a34a', textAlign: 'center', originX: 'center' },

        // Additional context: special cases
        { type: 'textbox', left: 600, top: 430, width: 800, text: 'Special cases: Reverse transcription (retroviruses), RNA replication (RNA viruses), direct RNA→DNA (not observed in normal cells)', fontSize: 11, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },

        // Bottom tip
        { type: 'textbox', left: 600, top: 560, width: 900, text: 'Tip: Add enzyme names (RNA Polymerase, Ribosome) and regulatory elements to customize this diagram.', fontSize: 12, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },
      ],
      background: '#ffffff',
    },
  },

  // ─── Template: Lab Equipment Setup ───
  {
    id: 'lab-equipment-setup',
    name: 'Laboratory Equipment Setup',
    description: 'Bench layout diagram with common lab equipment positions and specifications',
    category: 'scientific',
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==',
    paperSize: 'custom',
    dimensions: { width: 1200, height: 700 },
    canvasData: {
      version: '6.0.0',
      objects: [
        // Title
        { type: 'textbox', left: 600, top: 25, width: 600, text: 'Laboratory Equipment Setup', fontSize: 28, fontFamily: 'Inter', fontWeight: 700, fill: '#1e293b', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 600, top: 62, width: 600, text: 'Bench & Room Layout', fontSize: 14, fontFamily: 'Inter', fill: '#64748b', textAlign: 'center', originX: 'center' },

        // Room outline
        { type: 'rect', left: 50, top: 95, width: 1100, height: 550, fill: '#f8fafc', stroke: '#cbd5e1', strokeWidth: 2, rx: 4, ry: 4 },

        // Door marker (left wall)
        { type: 'rect', left: 50, top: 350, width: 8, height: 80, fill: '#ea580c', rx: 2, ry: 2 },
        { type: 'textbox', left: 25, top: 378, width: 50, text: 'Door', fontSize: 10, fontFamily: 'Inter', fontWeight: 600, fill: '#ea580c', textAlign: 'center', originX: 'center' },

        // Window marker (right wall)
        { type: 'rect', left: 1142, top: 200, width: 8, height: 120, fill: '#0ea5e9', rx: 2, ry: 2 },
        { type: 'textbox', left: 1170, top: 248, width: 60, text: 'Window', fontSize: 10, fontFamily: 'Inter', fontWeight: 600, fill: '#0ea5e9', textAlign: 'center', originX: 'center' },

        // Bench surface
        { type: 'rect', left: 100, top: 120, width: 1000, height: 480, fill: '#f1f5f9', stroke: '#94a3b8', strokeWidth: 1.5, rx: 6, ry: 6 },
        { type: 'textbox', left: 600, top: 125, width: 200, text: 'Bench Surface', fontSize: 12, fontFamily: 'Inter', fontWeight: 600, fill: '#94a3b8', textAlign: 'center', originX: 'center' },

        // ── Row 1: Top row of equipment ──
        // Microscope
        { type: 'rect', left: 140, top: 160, width: 260, height: 170, fill: '#ffffff', stroke: '#1d4ed8', strokeWidth: 2, rx: 8, ry: 8, strokeDashArray: [6, 4] },
        { type: 'textbox', left: 270, top: 200, width: 220, text: 'Microscope', fontSize: 16, fontFamily: 'Inter', fontWeight: 700, fill: '#1d4ed8', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 270, top: 230, width: 220, text: 'Model: ___________\nMagnification: ____\nLight Source: _____', fontSize: 11, fontFamily: 'Inter', fill: '#64748b', textAlign: 'center', originX: 'center' },

        // Centrifuge
        { type: 'rect', left: 440, top: 160, width: 260, height: 170, fill: '#ffffff', stroke: '#7c3aed', strokeWidth: 2, rx: 8, ry: 8, strokeDashArray: [6, 4] },
        { type: 'textbox', left: 570, top: 200, width: 220, text: 'Centrifuge', fontSize: 16, fontFamily: 'Inter', fontWeight: 700, fill: '#7c3aed', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 570, top: 230, width: 220, text: 'Model: ___________\nMax RPM: ________\nRotor Type: ______', fontSize: 11, fontFamily: 'Inter', fill: '#64748b', textAlign: 'center', originX: 'center' },

        // Incubator
        { type: 'rect', left: 740, top: 160, width: 260, height: 170, fill: '#ffffff', stroke: '#16a34a', strokeWidth: 2, rx: 8, ry: 8, strokeDashArray: [6, 4] },
        { type: 'textbox', left: 870, top: 200, width: 220, text: 'Incubator', fontSize: 16, fontFamily: 'Inter', fontWeight: 700, fill: '#16a34a', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 870, top: 230, width: 220, text: 'Temp: _____ °C\nCO₂: _______ %\nHumidity: _____ %', fontSize: 11, fontFamily: 'Inter', fill: '#64748b', textAlign: 'center', originX: 'center' },

        // ── Row 2: Bottom row of equipment ──
        // PCR Machine
        { type: 'rect', left: 140, top: 370, width: 260, height: 170, fill: '#ffffff', stroke: '#ea580c', strokeWidth: 2, rx: 8, ry: 8, strokeDashArray: [6, 4] },
        { type: 'textbox', left: 270, top: 410, width: 220, text: 'PCR Machine', fontSize: 16, fontFamily: 'Inter', fontWeight: 700, fill: '#ea580c', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 270, top: 440, width: 220, text: 'Model: ___________\nWell Count: ______\nRamp Rate: ______', fontSize: 11, fontFamily: 'Inter', fill: '#64748b', textAlign: 'center', originX: 'center' },

        // Spectrophotometer
        { type: 'rect', left: 440, top: 370, width: 260, height: 170, fill: '#ffffff', stroke: '#ca8a04', strokeWidth: 2, rx: 8, ry: 8, strokeDashArray: [6, 4] },
        { type: 'textbox', left: 570, top: 410, width: 220, text: 'Spectrophotometer', fontSize: 16, fontFamily: 'Inter', fontWeight: 700, fill: '#ca8a04', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 570, top: 440, width: 220, text: 'Model: ___________\nRange: ______ nm\nCuvette: _________', fontSize: 11, fontFamily: 'Inter', fill: '#64748b', textAlign: 'center', originX: 'center' },

        // Fume Hood
        { type: 'rect', left: 740, top: 370, width: 260, height: 170, fill: '#ffffff', stroke: '#dc2626', strokeWidth: 2, rx: 8, ry: 8, strokeDashArray: [6, 4] },
        { type: 'textbox', left: 870, top: 410, width: 220, text: 'Fume Hood', fontSize: 16, fontFamily: 'Inter', fontWeight: 700, fill: '#dc2626', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 870, top: 440, width: 220, text: 'Sash Height: _____ cm\nAirflow: ______ fpm\nLast Cert: __/__/____', fontSize: 11, fontFamily: 'Inter', fill: '#64748b', textAlign: 'center', originX: 'center' },

        // Bottom tip
        { type: 'textbox', left: 600, top: 660, width: 900, text: 'Tip: Fill in equipment specs, drag positions to match your lab layout, and add safety labels from the sidebar.', fontSize: 12, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },
      ],
      background: '#ffffff',
    },
  },

  // ─── Template: Dose-Response Curve ───
  {
    id: 'dose-response-layout',
    name: 'Dose-Response Curve',
    description: 'Dose-response layout with chart area, EC50 annotation, and data table',
    category: 'scientific',
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==',
    paperSize: 'custom',
    dimensions: { width: 1000, height: 700 },
    canvasData: {
      version: '6.0.0',
      objects: [
        // Title
        { type: 'textbox', left: 500, top: 20, width: 500, text: 'Dose-Response Curve', fontSize: 26, fontFamily: 'Inter', fontWeight: 700, fill: '#1e293b', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 500, top: 52, width: 500, text: 'Drug Name: _________________     Conditions: _________________', fontSize: 12, fontFamily: 'Inter', fill: '#64748b', textAlign: 'center', originX: 'center' },

        // Chart area background
        { type: 'rect', left: 120, top: 90, width: 600, height: 340, fill: '#fafafa', stroke: '#1e293b', strokeWidth: 2, rx: 0, ry: 0 },

        // Y-axis
        { type: 'rect', left: 120, top: 90, width: 2, height: 340, fill: '#1e293b' },
        { type: 'textbox', left: 55, top: 240, width: 120, text: '% Response', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#1e293b', textAlign: 'center', originX: 'center', angle: -90 },
        // Y-axis ticks
        { type: 'textbox', left: 105, top: 90, width: 30, text: '100', fontSize: 10, fontFamily: 'Inter', fill: '#64748b', textAlign: 'right' },
        { type: 'textbox', left: 105, top: 175, width: 30, text: '75', fontSize: 10, fontFamily: 'Inter', fill: '#64748b', textAlign: 'right' },
        { type: 'textbox', left: 105, top: 260, width: 30, text: '50', fontSize: 10, fontFamily: 'Inter', fill: '#64748b', textAlign: 'right' },
        { type: 'textbox', left: 105, top: 345, width: 30, text: '25', fontSize: 10, fontFamily: 'Inter', fill: '#64748b', textAlign: 'right' },
        { type: 'textbox', left: 105, top: 420, width: 30, text: '0', fontSize: 10, fontFamily: 'Inter', fill: '#64748b', textAlign: 'right' },

        // X-axis
        { type: 'rect', left: 120, top: 430, width: 600, height: 2, fill: '#1e293b' },
        { type: 'textbox', left: 420, top: 442, width: 300, text: 'Log [Concentration] (M)', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#1e293b', textAlign: 'center', originX: 'center' },
        // X-axis ticks
        { type: 'textbox', left: 170, top: 435, width: 40, text: '-9', fontSize: 10, fontFamily: 'Inter', fill: '#64748b', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 290, top: 435, width: 40, text: '-7', fontSize: 10, fontFamily: 'Inter', fill: '#64748b', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 420, top: 435, width: 40, text: '-5', fontSize: 10, fontFamily: 'Inter', fill: '#64748b', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 550, top: 435, width: 40, text: '-3', fontSize: 10, fontFamily: 'Inter', fill: '#64748b', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 670, top: 435, width: 40, text: '-1', fontSize: 10, fontFamily: 'Inter', fill: '#64748b', textAlign: 'center', originX: 'center' },

        // Curve placeholder area
        { type: 'rect', left: 160, top: 120, width: 520, height: 280, fill: 'transparent', stroke: '#93c5fd', strokeWidth: 1.5, rx: 4, ry: 4, strokeDashArray: [6, 4] },
        { type: 'textbox', left: 420, top: 240, width: 300, text: 'Place sigmoid curve here\n(paste image or draw)', fontSize: 13, fontFamily: 'Inter', fill: '#93c5fd', textAlign: 'center', originX: 'center' },

        // EC50 horizontal dashed line at 50%
        { type: 'rect', left: 120, top: 260, width: 600, height: 1.5, fill: '#dc2626', strokeDashArray: [6, 4] },
        { type: 'textbox', left: 740, top: 252, width: 60, text: 'EC₅₀', fontSize: 13, fontFamily: 'Inter', fontWeight: 700, fill: '#dc2626', textAlign: 'left' },

        // Emax label
        { type: 'textbox', left: 740, top: 86, width: 60, text: 'Emax', fontSize: 13, fontFamily: 'Inter', fontWeight: 700, fill: '#16a34a', textAlign: 'left' },
        { type: 'rect', left: 120, top: 95, width: 600, height: 1.5, fill: '#16a34a', strokeDashArray: [6, 4] },

        // Data table
        { type: 'textbox', left: 500, top: 478, width: 200, text: 'Data Table', fontSize: 15, fontFamily: 'Inter', fontWeight: 700, fill: '#1e293b', textAlign: 'center', originX: 'center' },

        // Table header
        { type: 'rect', left: 120, top: 500, width: 200, height: 30, fill: '#e2e8f0', stroke: '#94a3b8', strokeWidth: 1 },
        { type: 'textbox', left: 220, top: 505, width: 190, text: 'Concentration (M)', fontSize: 11, fontFamily: 'Inter', fontWeight: 700, fill: '#1e293b', textAlign: 'center', originX: 'center' },
        { type: 'rect', left: 320, top: 500, width: 160, height: 30, fill: '#e2e8f0', stroke: '#94a3b8', strokeWidth: 1 },
        { type: 'textbox', left: 400, top: 505, width: 150, text: 'Response %', fontSize: 11, fontFamily: 'Inter', fontWeight: 700, fill: '#1e293b', textAlign: 'center', originX: 'center' },
        { type: 'rect', left: 480, top: 500, width: 120, height: 30, fill: '#e2e8f0', stroke: '#94a3b8', strokeWidth: 1 },
        { type: 'textbox', left: 540, top: 505, width: 110, text: 'SEM', fontSize: 11, fontFamily: 'Inter', fontWeight: 700, fill: '#1e293b', textAlign: 'center', originX: 'center' },
        { type: 'rect', left: 600, top: 500, width: 120, height: 30, fill: '#e2e8f0', stroke: '#94a3b8', strokeWidth: 1 },
        { type: 'textbox', left: 660, top: 505, width: 110, text: 'n', fontSize: 11, fontFamily: 'Inter', fontWeight: 700, fill: '#1e293b', textAlign: 'center', originX: 'center' },

        // Table rows (3 empty)
        { type: 'rect', left: 120, top: 530, width: 600, height: 28, fill: '#ffffff', stroke: '#e2e8f0', strokeWidth: 1 },
        { type: 'rect', left: 120, top: 558, width: 600, height: 28, fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1 },
        { type: 'rect', left: 120, top: 586, width: 600, height: 28, fill: '#ffffff', stroke: '#e2e8f0', strokeWidth: 1 },

        // Notes section
        { type: 'textbox', left: 800, top: 500, width: 170, text: 'Notes', fontSize: 14, fontFamily: 'Inter', fontWeight: 700, fill: '#1e293b', textAlign: 'left' },
        { type: 'rect', left: 780, top: 520, width: 190, height: 100, fill: '#fefce8', stroke: '#ca8a04', strokeWidth: 1, rx: 6, ry: 6 },
        { type: 'textbox', left: 875, top: 545, width: 170, text: 'Add experimental\nnotes here...', fontSize: 11, fontFamily: 'Inter', fill: '#ca8a04', textAlign: 'center', originX: 'center' },

        // Bottom tip
        { type: 'textbox', left: 500, top: 660, width: 800, text: 'Tip: Paste your curve image into the chart area. Edit axis labels and fill in the data table.', fontSize: 12, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },
      ],
      background: '#ffffff',
    },
  },

  // ─── Template: Phylogenetic Tree ───
  {
    id: 'phylogenetic-tree',
    name: 'Phylogenetic Tree',
    description: 'Bifurcating cladogram with 8 terminal taxa and bootstrap values',
    category: 'scientific',
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==',
    paperSize: 'custom',
    dimensions: { width: 1100, height: 800 },
    canvasData: {
      version: '6.0.0',
      objects: [
        // Title
        { type: 'textbox', left: 550, top: 25, width: 500, text: 'Phylogenetic Tree', fontSize: 28, fontFamily: 'Inter', fontWeight: 700, fill: '#1e293b', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 550, top: 60, width: 500, text: 'Method: ____________     Bootstrap: 1000 replicates', fontSize: 12, fontFamily: 'Inter', fill: '#64748b', textAlign: 'center', originX: 'center' },

        // Root (vertical trunk)
        { type: 'rect', left: 100, top: 200, width: 4, height: 400, fill: '#1e293b' },

        // ── Level 1 split: Root → Upper clade + Lower clade ──
        // Upper horizontal from root
        { type: 'rect', left: 100, top: 300, width: 80, height: 3, fill: '#1e293b' },
        // Lower horizontal from root
        { type: 'rect', left: 100, top: 500, width: 80, height: 3, fill: '#1e293b' },
        // Bootstrap at root
        { type: 'textbox', left: 110, top: 390, width: 40, text: '99', fontSize: 10, fontFamily: 'Inter', fontWeight: 600, fill: '#94a3b8', textAlign: 'center', originX: 'center' },

        // ── Level 2: Upper clade splits ──
        // Vertical connector for upper clade
        { type: 'rect', left: 180, top: 200, width: 3, height: 200, fill: '#1d4ed8' },
        // Upper-upper horizontal
        { type: 'rect', left: 180, top: 200, width: 80, height: 3, fill: '#1d4ed8' },
        // Upper-lower horizontal
        { type: 'rect', left: 180, top: 400, width: 80, height: 3, fill: '#1d4ed8' },
        // Bootstrap
        { type: 'textbox', left: 195, top: 290, width: 40, text: '95', fontSize: 10, fontFamily: 'Inter', fontWeight: 600, fill: '#94a3b8', textAlign: 'center', originX: 'center' },

        // ── Level 2: Lower clade splits ──
        // Vertical connector for lower clade
        { type: 'rect', left: 180, top: 500, width: 3, height: 200, fill: '#7c3aed' },
        // Lower-upper horizontal
        { type: 'rect', left: 180, top: 500, width: 80, height: 3, fill: '#7c3aed' },
        // Lower-lower horizontal
        { type: 'rect', left: 180, top: 700, width: 80, height: 3, fill: '#7c3aed' },
        // Bootstrap
        { type: 'textbox', left: 195, top: 590, width: 40, text: '88', fontSize: 10, fontFamily: 'Inter', fontWeight: 600, fill: '#94a3b8', textAlign: 'center', originX: 'center' },

        // ── Level 3: Terminals ──
        // Upper-upper clade (Species A, B)
        { type: 'rect', left: 260, top: 150, width: 3, height: 100, fill: '#1d4ed8' },
        { type: 'rect', left: 260, top: 150, width: 80, height: 3, fill: '#1d4ed8' },
        { type: 'rect', left: 260, top: 250, width: 80, height: 3, fill: '#1d4ed8' },
        { type: 'textbox', left: 270, top: 190, width: 40, text: '78', fontSize: 10, fontFamily: 'Inter', fontWeight: 600, fill: '#94a3b8', textAlign: 'center', originX: 'center' },

        // Upper-lower clade (Species C, D)
        { type: 'rect', left: 260, top: 350, width: 3, height: 100, fill: '#1d4ed8' },
        { type: 'rect', left: 260, top: 350, width: 80, height: 3, fill: '#1d4ed8' },
        { type: 'rect', left: 260, top: 450, width: 80, height: 3, fill: '#1d4ed8' },
        { type: 'textbox', left: 270, top: 390, width: 40, text: '92', fontSize: 10, fontFamily: 'Inter', fontWeight: 600, fill: '#94a3b8', textAlign: 'center', originX: 'center' },

        // Lower-upper clade (Species E, F)
        { type: 'rect', left: 260, top: 460, width: 3, height: 80, fill: '#7c3aed' },
        { type: 'rect', left: 260, top: 460, width: 80, height: 3, fill: '#7c3aed' },
        { type: 'rect', left: 260, top: 540, width: 80, height: 3, fill: '#7c3aed' },
        { type: 'textbox', left: 270, top: 490, width: 40, text: '67', fontSize: 10, fontFamily: 'Inter', fontWeight: 600, fill: '#94a3b8', textAlign: 'center', originX: 'center' },

        // Lower-lower clade (Species G, H)
        { type: 'rect', left: 260, top: 660, width: 3, height: 80, fill: '#7c3aed' },
        { type: 'rect', left: 260, top: 660, width: 80, height: 3, fill: '#7c3aed' },
        { type: 'rect', left: 260, top: 740, width: 80, height: 3, fill: '#7c3aed' },
        { type: 'textbox', left: 270, top: 690, width: 40, text: '84', fontSize: 10, fontFamily: 'Inter', fontWeight: 600, fill: '#94a3b8', textAlign: 'center', originX: 'center' },

        // ── Terminal taxa labels ──
        { type: 'rect', left: 350, top: 140, width: 160, height: 30, fill: '#dbeafe', stroke: '#1d4ed8', strokeWidth: 1.5, rx: 6, ry: 6 },
        { type: 'textbox', left: 430, top: 145, width: 150, text: 'Species A', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#1d4ed8', textAlign: 'center', originX: 'center' },

        { type: 'rect', left: 350, top: 240, width: 160, height: 30, fill: '#dbeafe', stroke: '#1d4ed8', strokeWidth: 1.5, rx: 6, ry: 6 },
        { type: 'textbox', left: 430, top: 245, width: 150, text: 'Species B', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#1d4ed8', textAlign: 'center', originX: 'center' },

        { type: 'rect', left: 350, top: 340, width: 160, height: 30, fill: '#dbeafe', stroke: '#1d4ed8', strokeWidth: 1.5, rx: 6, ry: 6 },
        { type: 'textbox', left: 430, top: 345, width: 150, text: 'Species C', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#1d4ed8', textAlign: 'center', originX: 'center' },

        { type: 'rect', left: 350, top: 440, width: 160, height: 30, fill: '#dbeafe', stroke: '#1d4ed8', strokeWidth: 1.5, rx: 6, ry: 6 },
        { type: 'textbox', left: 430, top: 445, width: 150, text: 'Species D', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#1d4ed8', textAlign: 'center', originX: 'center' },

        { type: 'rect', left: 350, top: 450, width: 160, height: 30, fill: '#f5f3ff', stroke: '#7c3aed', strokeWidth: 1.5, rx: 6, ry: 6 },
        { type: 'textbox', left: 430, top: 455, width: 150, text: 'Species E', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#7c3aed', textAlign: 'center', originX: 'center' },

        { type: 'rect', left: 350, top: 530, width: 160, height: 30, fill: '#f5f3ff', stroke: '#7c3aed', strokeWidth: 1.5, rx: 6, ry: 6 },
        { type: 'textbox', left: 430, top: 535, width: 150, text: 'Species F', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#7c3aed', textAlign: 'center', originX: 'center' },

        { type: 'rect', left: 350, top: 650, width: 160, height: 30, fill: '#f5f3ff', stroke: '#7c3aed', strokeWidth: 1.5, rx: 6, ry: 6 },
        { type: 'textbox', left: 430, top: 655, width: 150, text: 'Species G', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#7c3aed', textAlign: 'center', originX: 'center' },

        { type: 'rect', left: 350, top: 730, width: 160, height: 30, fill: '#f5f3ff', stroke: '#7c3aed', strokeWidth: 1.5, rx: 6, ry: 6 },
        { type: 'textbox', left: 430, top: 735, width: 150, text: 'Species H', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#7c3aed', textAlign: 'center', originX: 'center' },

        // Scale bar
        { type: 'rect', left: 100, top: 770, width: 150, height: 3, fill: '#1e293b' },
        { type: 'rect', left: 100, top: 765, width: 3, height: 12, fill: '#1e293b' },
        { type: 'rect', left: 247, top: 765, width: 3, height: 12, fill: '#1e293b' },
        { type: 'textbox', left: 175, top: 775, width: 100, text: '0.1 substitutions/site', fontSize: 10, fontFamily: 'Inter', fill: '#64748b', textAlign: 'center', originX: 'center' },

        // Legend / info box
        { type: 'rect', left: 700, top: 130, width: 350, height: 200, fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1.5, rx: 8, ry: 8 },
        { type: 'textbox', left: 875, top: 140, width: 330, text: 'Tree Information', fontSize: 14, fontFamily: 'Inter', fontWeight: 700, fill: '#1e293b', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 875, top: 170, width: 320, text: 'Alignment: _______________\nModel: __________________\nOutgroup: _______________\nBootstrap: 1000 replicates\nSoftware: _______________', fontSize: 12, fontFamily: 'Inter', fill: '#64748b', textAlign: 'left', originX: 'center' },

        // Bottom tip
        { type: 'textbox', left: 550, top: 775, width: 700, text: 'Tip: Edit species names, adjust branch lengths by moving nodes, and color clades by taxonomy.', fontSize: 12, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },
      ],
      background: '#ffffff',
    },
  },

  // ─── Template: Inclusion/Exclusion Criteria ───
  {
    id: 'inclusion-exclusion',
    name: 'Study Enrollment: Inclusion/Exclusion Criteria',
    description: 'Funnel-style enrollment flow with inclusion and exclusion criteria',
    category: 'flowchart',
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==',
    paperSize: 'custom',
    dimensions: { width: 900, height: 800 },
    canvasData: {
      version: '6.0.0',
      objects: [
        // Title
        { type: 'textbox', left: 450, top: 20, width: 600, text: 'Study Enrollment: Inclusion/Exclusion Criteria', fontSize: 22, fontFamily: 'Inter', fontWeight: 700, fill: '#1e293b', textAlign: 'center', originX: 'center' },

        // ── Step 1: Total Screened (wide) ──
        { type: 'rect', left: 150, top: 70, width: 400, height: 60, fill: '#dbeafe', stroke: '#1d4ed8', strokeWidth: 2, rx: 10, ry: 10 },
        { type: 'textbox', left: 350, top: 80, width: 380, text: 'Total Screened (n=         )', fontSize: 16, fontFamily: 'Inter', fontWeight: 700, fill: '#1d4ed8', textAlign: 'center', originX: 'center' },

        // Arrow down
        { type: 'textbox', left: 350, top: 135, width: 30, text: '↓', fontSize: 28, fontFamily: 'Inter', fontWeight: 700, fill: '#475569', textAlign: 'center', originX: 'center' },

        // ── Step 2: Inclusion Criteria Met (slightly narrower) ──
        { type: 'rect', left: 175, top: 170, width: 350, height: 60, fill: '#dcfce7', stroke: '#16a34a', strokeWidth: 2, rx: 10, ry: 10 },
        { type: 'textbox', left: 350, top: 180, width: 330, text: 'Inclusion Criteria Met (n=         )', fontSize: 15, fontFamily: 'Inter', fontWeight: 700, fill: '#16a34a', textAlign: 'center', originX: 'center' },

        // Exclusion side box 1 (right)
        { type: 'rect', left: 350, top: 165, width: 2, height: 10, fill: '#475569' },
        { type: 'rect', left: 580, top: 100, width: 270, height: 120, fill: '#fef2f2', stroke: '#dc2626', strokeWidth: 2, rx: 8, ry: 8 },
        { type: 'textbox', left: 715, top: 108, width: 250, text: 'Excluded: Did Not Meet\nInclusion Criteria (n=         )', fontSize: 13, fontFamily: 'Inter', fontWeight: 700, fill: '#dc2626', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 715, top: 152, width: 240, text: '• Age outside range\n• Comorbidity present\n• Consent not obtained', fontSize: 11, fontFamily: 'Inter', fill: '#dc2626', textAlign: 'left', originX: 'center' },
        // Connector line
        { type: 'rect', left: 550, top: 160, width: 30, height: 2, fill: '#dc2626' },

        // Arrow down
        { type: 'textbox', left: 350, top: 240, width: 30, text: '↓', fontSize: 28, fontFamily: 'Inter', fontWeight: 700, fill: '#475569', textAlign: 'center', originX: 'center' },

        // ── Step 3: Exclusion Criteria Applied (narrower) ──
        { type: 'rect', left: 200, top: 280, width: 300, height: 60, fill: '#fef3c7', stroke: '#ca8a04', strokeWidth: 2, rx: 10, ry: 10 },
        { type: 'textbox', left: 350, top: 290, width: 280, text: 'Exclusion Criteria Applied (n=         )', fontSize: 14, fontFamily: 'Inter', fontWeight: 700, fill: '#ca8a04', textAlign: 'center', originX: 'center' },

        // Exclusion side box 2 (right)
        { type: 'rect', left: 580, top: 270, width: 270, height: 130, fill: '#fef2f2', stroke: '#dc2626', strokeWidth: 2, rx: 8, ry: 8 },
        { type: 'textbox', left: 715, top: 278, width: 250, text: 'Excluded: Met Exclusion\nCriteria (n=         )', fontSize: 13, fontFamily: 'Inter', fontWeight: 700, fill: '#dc2626', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 715, top: 322, width: 240, text: '• Active infection\n• Concurrent medication\n• Prior enrollment\n• Pregnancy', fontSize: 11, fontFamily: 'Inter', fill: '#dc2626', textAlign: 'left', originX: 'center' },
        // Connector line
        { type: 'rect', left: 500, top: 310, width: 80, height: 2, fill: '#dc2626' },

        // Arrow down
        { type: 'textbox', left: 350, top: 350, width: 30, text: '↓', fontSize: 28, fontFamily: 'Inter', fontWeight: 700, fill: '#475569', textAlign: 'center', originX: 'center' },

        // ── Step 4: Randomized ──
        { type: 'rect', left: 225, top: 395, width: 250, height: 55, fill: '#f5f3ff', stroke: '#7c3aed', strokeWidth: 2, rx: 10, ry: 10 },
        { type: 'textbox', left: 350, top: 405, width: 230, text: 'Randomized (n=         )', fontSize: 14, fontFamily: 'Inter', fontWeight: 700, fill: '#7c3aed', textAlign: 'center', originX: 'center' },

        // Arrow down
        { type: 'textbox', left: 350, top: 458, width: 30, text: '↓', fontSize: 28, fontFamily: 'Inter', fontWeight: 700, fill: '#475569', textAlign: 'center', originX: 'center' },

        // ── Step 5: Final Enrolled (narrow, green) ──
        { type: 'rect', left: 250, top: 500, width: 200, height: 60, fill: '#16a34a', stroke: '#15803d', strokeWidth: 2, rx: 12, ry: 12 },
        { type: 'textbox', left: 350, top: 510, width: 180, text: 'Final Enrolled\n(n=         )', fontSize: 15, fontFamily: 'Inter', fontWeight: 700, fill: '#ffffff', textAlign: 'center', originX: 'center' },

        // Funnel shading guide lines (subtle)
        { type: 'rect', left: 148, top: 100, width: 2, height: 460, fill: '#e2e8f0', strokeDashArray: [4, 4] },
        { type: 'rect', left: 550, top: 100, width: 2, height: 460, fill: '#e2e8f0', strokeDashArray: [4, 4] },

        // Legend
        { type: 'rect', left: 40, top: 620, width: 18, height: 18, fill: '#dcfce7', stroke: '#16a34a', strokeWidth: 1.5, rx: 4, ry: 4 },
        { type: 'textbox', left: 65, top: 622, width: 100, text: 'Included', fontSize: 12, fontFamily: 'Inter', fontWeight: 600, fill: '#16a34a' },
        { type: 'rect', left: 170, top: 620, width: 18, height: 18, fill: '#fef2f2', stroke: '#dc2626', strokeWidth: 1.5, rx: 4, ry: 4 },
        { type: 'textbox', left: 195, top: 622, width: 100, text: 'Excluded', fontSize: 12, fontFamily: 'Inter', fontWeight: 600, fill: '#dc2626' },

        // Bottom tip
        { type: 'textbox', left: 450, top: 760, width: 700, text: 'Tip: Fill in sample sizes and edit exclusion reasons. Add additional screening steps as needed.', fontSize: 12, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },
      ],
      background: '#ffffff',
    },
  },

  // ─── Template: PRISMA 2020 Flow Diagram ───
  {
    id: 'prisma-flowchart',
    name: 'PRISMA 2020 Flow Diagram',
    description: 'Standard PRISMA systematic review flow diagram with all four phases',
    category: 'flowchart',
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==',
    paperSize: 'custom',
    dimensions: { width: 900, height: 900 },
    canvasData: {
      version: '6.0.0',
      objects: [
        // Title
        { type: 'textbox', left: 450, top: 15, width: 600, text: 'PRISMA 2020 Flow Diagram', fontSize: 24, fontFamily: 'Inter', fontWeight: 700, fill: '#1e293b', textAlign: 'center', originX: 'center' },

        // ═══ PHASE 1: IDENTIFICATION ═══
        { type: 'rect', left: 20, top: 55, width: 110, height: 180, fill: '#dbeafe', stroke: '#1d4ed8', strokeWidth: 2, rx: 6, ry: 6 },
        { type: 'textbox', left: 75, top: 60, width: 100, text: 'Identification', fontSize: 13, fontFamily: 'Inter', fontWeight: 700, fill: '#1d4ed8', textAlign: 'center', originX: 'center', angle: -90 },

        // Database records
        { type: 'rect', left: 160, top: 60, width: 280, height: 55, fill: '#eff6ff', stroke: '#1d4ed8', strokeWidth: 2, rx: 8, ry: 8 },
        { type: 'textbox', left: 300, top: 68, width: 260, text: 'Records identified from\ndatabases (n=         )', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#1e293b', textAlign: 'center', originX: 'center' },

        // Other sources
        { type: 'rect', left: 540, top: 60, width: 280, height: 55, fill: '#eff6ff', stroke: '#1d4ed8', strokeWidth: 2, rx: 8, ry: 8 },
        { type: 'textbox', left: 680, top: 68, width: 260, text: 'Records from other\nsources (n=         )', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#1e293b', textAlign: 'center', originX: 'center' },

        // Arrows down merging
        { type: 'textbox', left: 300, top: 118, width: 30, text: '↓', fontSize: 22, fontFamily: 'Inter', fontWeight: 700, fill: '#475569', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 680, top: 118, width: 30, text: '↓', fontSize: 22, fontFamily: 'Inter', fontWeight: 700, fill: '#475569', textAlign: 'center', originX: 'center' },

        // Duplicates removed
        { type: 'rect', left: 200, top: 145, width: 500, height: 50, fill: '#f1f5f9', stroke: '#64748b', strokeWidth: 1.5, rx: 8, ry: 8 },
        { type: 'textbox', left: 450, top: 155, width: 480, text: 'Records after duplicates removed (n=         )', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#1e293b', textAlign: 'center', originX: 'center' },

        // Arrow down
        { type: 'textbox', left: 350, top: 198, width: 30, text: '↓', fontSize: 22, fontFamily: 'Inter', fontWeight: 700, fill: '#475569', textAlign: 'center', originX: 'center' },

        // ═══ PHASE 2: SCREENING ═══
        { type: 'rect', left: 20, top: 240, width: 110, height: 150, fill: '#fef3c7', stroke: '#ca8a04', strokeWidth: 2, rx: 6, ry: 6 },
        { type: 'textbox', left: 75, top: 250, width: 100, text: 'Screening', fontSize: 13, fontFamily: 'Inter', fontWeight: 700, fill: '#ca8a04', textAlign: 'center', originX: 'center', angle: -90 },

        // Records screened
        { type: 'rect', left: 160, top: 250, width: 320, height: 55, fill: '#fefce8', stroke: '#ca8a04', strokeWidth: 2, rx: 8, ry: 8 },
        { type: 'textbox', left: 320, top: 258, width: 300, text: 'Records screened\n(n=         )', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#1e293b', textAlign: 'center', originX: 'center' },

        // Records excluded (side)
        { type: 'rect', left: 520, top: 255, width: 40, height: 2, fill: '#dc2626' },
        { type: 'rect', left: 560, top: 245, width: 260, height: 55, fill: '#fef2f2', stroke: '#dc2626', strokeWidth: 2, rx: 8, ry: 8 },
        { type: 'textbox', left: 690, top: 253, width: 240, text: 'Records excluded\n(n=         )', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#dc2626', textAlign: 'center', originX: 'center' },

        // Arrow down
        { type: 'textbox', left: 350, top: 310, width: 30, text: '↓', fontSize: 22, fontFamily: 'Inter', fontWeight: 700, fill: '#475569', textAlign: 'center', originX: 'center' },

        // Reports sought
        { type: 'rect', left: 160, top: 340, width: 320, height: 45, fill: '#fefce8', stroke: '#ca8a04', strokeWidth: 1.5, rx: 8, ry: 8 },
        { type: 'textbox', left: 320, top: 348, width: 300, text: 'Reports sought for retrieval (n=         )', fontSize: 12, fontFamily: 'Inter', fontWeight: 600, fill: '#1e293b', textAlign: 'center', originX: 'center' },

        // Arrow down
        { type: 'textbox', left: 350, top: 388, width: 30, text: '↓', fontSize: 22, fontFamily: 'Inter', fontWeight: 700, fill: '#475569', textAlign: 'center', originX: 'center' },

        // ═══ PHASE 3: ELIGIBILITY ═══
        { type: 'rect', left: 20, top: 415, width: 110, height: 160, fill: '#f5f3ff', stroke: '#7c3aed', strokeWidth: 2, rx: 6, ry: 6 },
        { type: 'textbox', left: 75, top: 430, width: 100, text: 'Eligibility', fontSize: 13, fontFamily: 'Inter', fontWeight: 700, fill: '#7c3aed', textAlign: 'center', originX: 'center', angle: -90 },

        // Full-text assessed
        { type: 'rect', left: 160, top: 420, width: 320, height: 55, fill: '#f5f3ff', stroke: '#7c3aed', strokeWidth: 2, rx: 8, ry: 8 },
        { type: 'textbox', left: 320, top: 428, width: 300, text: 'Full-text articles assessed\nfor eligibility (n=         )', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#1e293b', textAlign: 'center', originX: 'center' },

        // Full-text excluded (side)
        { type: 'rect', left: 520, top: 445, width: 40, height: 2, fill: '#dc2626' },
        { type: 'rect', left: 560, top: 415, width: 260, height: 90, fill: '#fef2f2', stroke: '#dc2626', strokeWidth: 2, rx: 8, ry: 8 },
        { type: 'textbox', left: 690, top: 422, width: 240, text: 'Full-text articles excluded\nwith reasons (n=         )', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#dc2626', textAlign: 'center', originX: 'center' },
        { type: 'textbox', left: 690, top: 460, width: 230, text: '• Reason 1 (n= )\n• Reason 2 (n= )\n• Reason 3 (n= )', fontSize: 11, fontFamily: 'Inter', fill: '#dc2626', textAlign: 'left', originX: 'center' },

        // Arrow down
        { type: 'textbox', left: 350, top: 480, width: 30, text: '↓', fontSize: 22, fontFamily: 'Inter', fontWeight: 700, fill: '#475569', textAlign: 'center', originX: 'center' },

        // Reports assessed
        { type: 'rect', left: 160, top: 510, width: 320, height: 45, fill: '#f5f3ff', stroke: '#7c3aed', strokeWidth: 1.5, rx: 8, ry: 8 },
        { type: 'textbox', left: 320, top: 518, width: 300, text: 'Reports assessed for eligibility (n=         )', fontSize: 12, fontFamily: 'Inter', fontWeight: 600, fill: '#1e293b', textAlign: 'center', originX: 'center' },

        // Arrow down
        { type: 'textbox', left: 350, top: 558, width: 30, text: '↓', fontSize: 22, fontFamily: 'Inter', fontWeight: 700, fill: '#475569', textAlign: 'center', originX: 'center' },

        // ═══ PHASE 4: INCLUDED ═══
        { type: 'rect', left: 20, top: 590, width: 110, height: 150, fill: '#dcfce7', stroke: '#16a34a', strokeWidth: 2, rx: 6, ry: 6 },
        { type: 'textbox', left: 75, top: 605, width: 100, text: 'Included', fontSize: 13, fontFamily: 'Inter', fontWeight: 700, fill: '#16a34a', textAlign: 'center', originX: 'center', angle: -90 },

        // Studies in qualitative synthesis
        { type: 'rect', left: 160, top: 595, width: 320, height: 55, fill: '#dcfce7', stroke: '#16a34a', strokeWidth: 2, rx: 8, ry: 8 },
        { type: 'textbox', left: 320, top: 603, width: 300, text: 'Studies included in\nqualitative synthesis (n=         )', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#1e293b', textAlign: 'center', originX: 'center' },

        // Arrow down
        { type: 'textbox', left: 350, top: 653, width: 30, text: '↓', fontSize: 22, fontFamily: 'Inter', fontWeight: 700, fill: '#475569', textAlign: 'center', originX: 'center' },

        // Studies in meta-analysis
        { type: 'rect', left: 185, top: 680, width: 270, height: 50, fill: '#16a34a', stroke: '#15803d', strokeWidth: 2, rx: 10, ry: 10 },
        { type: 'textbox', left: 320, top: 690, width: 250, text: 'Studies in meta-analysis\n(n=         )', fontSize: 13, fontFamily: 'Inter', fontWeight: 700, fill: '#ffffff', textAlign: 'center', originX: 'center' },

        // Citation
        { type: 'textbox', left: 450, top: 755, width: 700, text: 'Page MJ, McKenzie JE, Bossuyt PM, et al. The PRISMA 2020 statement. BMJ 2021;372:n71', fontSize: 10, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },

        // Bottom tip
        { type: 'textbox', left: 450, top: 860, width: 700, text: 'Tip: Fill in all sample sizes. Add additional exclusion reasons and customize phase colors as needed.', fontSize: 12, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },
      ],
      background: '#ffffff',
    },
  },

  // ─── Template: Cornell Notes ───
  {
    id: 'cornell-notes',
    name: 'Cornell Notes',
    description: 'Classic Cornell note-taking layout with cue column, notes area, and summary',
    category: 'educational',
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==',
    paperSize: 'custom',
    dimensions: { width: 900, height: 700 },
    canvasData: {
      version: '6.0.0',
      objects: [
        // Title bar
        { type: 'rect', left: 30, top: 20, width: 840, height: 50, fill: '#1d4ed8', rx: 8, ry: 8 },
        { type: 'textbox', left: 450, top: 30, width: 400, text: 'Cornell Notes', fontSize: 24, fontFamily: 'Inter', fontWeight: 700, fill: '#ffffff', textAlign: 'center', originX: 'center' },

        // Date / Subject / Topic line
        { type: 'rect', left: 30, top: 80, width: 840, height: 40, fill: '#eff6ff', stroke: '#93c5fd', strokeWidth: 1, rx: 4, ry: 4 },
        { type: 'textbox', left: 50, top: 88, width: 250, text: 'Date: ______________', fontSize: 13, fontFamily: 'Inter', fill: '#64748b' },
        { type: 'textbox', left: 320, top: 88, width: 250, text: 'Subject: ______________', fontSize: 13, fontFamily: 'Inter', fill: '#64748b' },
        { type: 'textbox', left: 590, top: 88, width: 250, text: 'Topic: ______________', fontSize: 13, fontFamily: 'Inter', fill: '#64748b' },

        // ── Cue Column (left ~25%) ──
        { type: 'rect', left: 30, top: 130, width: 210, height: 400, fill: '#fefce8', stroke: '#ca8a04', strokeWidth: 1.5, rx: 6, ry: 6 },
        { type: 'textbox', left: 135, top: 138, width: 190, text: 'Cue Column', fontSize: 14, fontFamily: 'Inter', fontWeight: 700, fill: '#ca8a04', textAlign: 'center', originX: 'center' },
        { type: 'rect', left: 50, top: 160, width: 170, height: 1, fill: '#ca8a04' },
        { type: 'textbox', left: 135, top: 175, width: 180, text: 'Key questions,\nterms, and cues\ngo here.\n\nWrite these AFTER\nthe lecture.\n\nUse for self-testing\nand review.', fontSize: 12, fontFamily: 'Inter', fill: '#d4a904', textAlign: 'center', originX: 'center' },

        // ── Notes Area (right ~75%) ──
        { type: 'rect', left: 250, top: 130, width: 620, height: 400, fill: '#f8fafc', stroke: '#94a3b8', strokeWidth: 1.5, rx: 6, ry: 6 },
        { type: 'textbox', left: 560, top: 138, width: 200, text: 'Notes', fontSize: 14, fontFamily: 'Inter', fontWeight: 700, fill: '#475569', textAlign: 'center', originX: 'center' },
        { type: 'rect', left: 270, top: 160, width: 580, height: 1, fill: '#94a3b8' },
        { type: 'textbox', left: 560, top: 175, width: 570, text: 'Record lecture notes here during class.\n\n• Use abbreviations and shorthand\n• Capture main ideas, not every word\n• Leave space between topics\n• Use diagrams and sketches when helpful\n• Mark important points with stars or highlights\n\nOrganize by topic headings:\n\n1. ____________________________________________\n\n2. ____________________________________________\n\n3. ____________________________________________', fontSize: 12, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'left', originX: 'center' },

        // ── Summary Section (bottom, full width) ──
        { type: 'rect', left: 30, top: 545, width: 840, height: 110, fill: '#dcfce7', stroke: '#16a34a', strokeWidth: 1.5, rx: 6, ry: 6 },
        { type: 'textbox', left: 450, top: 553, width: 200, text: 'Summary', fontSize: 14, fontFamily: 'Inter', fontWeight: 700, fill: '#16a34a', textAlign: 'center', originX: 'center' },
        { type: 'rect', left: 50, top: 575, width: 800, height: 1, fill: '#16a34a' },
        { type: 'textbox', left: 450, top: 590, width: 790, text: 'Write a brief summary of the main ideas within 24 hours of the lecture. This reinforces learning and aids long-term retention.', fontSize: 12, fontFamily: 'Inter', fill: '#86efac', textAlign: 'center', originX: 'center' },

        // Bottom tip
        { type: 'textbox', left: 450, top: 670, width: 700, text: 'Tip: Click any section to start typing. The cue column is best filled after reviewing your notes.', fontSize: 12, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },
      ],
      background: '#ffffff',
    },
  },

  // ─── Template: Concept Map ───
  {
    id: 'concept-map',
    name: 'Concept Map',
    description: 'Radial concept map with central topic, secondary branches, and relationship labels',
    category: 'educational',
    thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==',
    paperSize: 'custom',
    dimensions: { width: 1200, height: 800 },
    canvasData: {
      version: '6.0.0',
      objects: [
        // Title
        { type: 'textbox', left: 600, top: 15, width: 400, text: 'Concept Map', fontSize: 26, fontFamily: 'Inter', fontWeight: 700, fill: '#1e293b', textAlign: 'center', originX: 'center' },

        // ── Central Concept Node ──
        { type: 'circle', left: 600, top: 370, radius: 65, fill: '#7c3aed', stroke: '#6d28d9', strokeWidth: 3 },
        { type: 'textbox', left: 600, top: 350, width: 100, text: 'Central\nConcept', fontSize: 16, fontFamily: 'Inter', fontWeight: 700, fill: '#ffffff', textAlign: 'center', originX: 'center' },

        // ── Connection lines (from center to secondary nodes) ──
        // To Node 1 (top-left): ~(350, 160)
        { type: 'rect', left: 420, top: 210, width: 250, height: 2.5, fill: '#1d4ed8', angle: -40 },
        { type: 'textbox', left: 440, top: 230, width: 100, text: 'leads to', fontSize: 11, fontFamily: 'Inter', fontWeight: 600, fill: '#1d4ed8', textAlign: 'center', originX: 'center', angle: -40 },

        // To Node 2 (top-right): ~(850, 160)
        { type: 'rect', left: 660, top: 210, width: 250, height: 2.5, fill: '#16a34a', angle: 40 },
        { type: 'textbox', left: 790, top: 230, width: 100, text: 'requires', fontSize: 11, fontFamily: 'Inter', fontWeight: 600, fill: '#16a34a', textAlign: 'center', originX: 'center', angle: 40 },

        // To Node 3 (right): ~(1000, 370)
        { type: 'rect', left: 680, top: 368, width: 260, height: 2.5, fill: '#ea580c' },
        { type: 'textbox', left: 810, top: 350, width: 100, text: 'enables', fontSize: 11, fontFamily: 'Inter', fontWeight: 600, fill: '#ea580c', textAlign: 'center', originX: 'center' },

        // To Node 4 (bottom-right): ~(850, 580)
        { type: 'rect', left: 660, top: 440, width: 250, height: 2.5, fill: '#dc2626', angle: -40 },
        { type: 'textbox', left: 790, top: 500, width: 100, text: 'results in', fontSize: 11, fontFamily: 'Inter', fontWeight: 600, fill: '#dc2626', textAlign: 'center', originX: 'center', angle: -40 },

        // To Node 5 (bottom-left): ~(350, 580)
        { type: 'rect', left: 420, top: 440, width: 250, height: 2.5, fill: '#ca8a04', angle: 40 },
        { type: 'textbox', left: 430, top: 500, width: 100, text: 'is part of', fontSize: 11, fontFamily: 'Inter', fontWeight: 600, fill: '#ca8a04', textAlign: 'center', originX: 'center', angle: 40 },

        // To Node 6 (left): ~(200, 370)
        { type: 'rect', left: 270, top: 368, width: 260, height: 2.5, fill: '#0ea5e9' },
        { type: 'textbox', left: 390, top: 350, width: 100, text: 'depends on', fontSize: 11, fontFamily: 'Inter', fontWeight: 600, fill: '#0ea5e9', textAlign: 'center', originX: 'center' },

        // ── Secondary Node 1 (top-left, blue) ──
        { type: 'circle', left: 300, top: 160, radius: 50, fill: '#dbeafe', stroke: '#1d4ed8', strokeWidth: 2.5 },
        { type: 'textbox', left: 300, top: 145, width: 80, text: 'Sub-\nconcept 1', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#1d4ed8', textAlign: 'center', originX: 'center' },

        // Tertiary from Node 1
        { type: 'rect', left: 150, top: 95, width: 120, height: 2, fill: '#93c5fd' },
        { type: 'rect', left: 50, top: 75, width: 120, height: 40, fill: '#eff6ff', stroke: '#93c5fd', strokeWidth: 1.5, rx: 8, ry: 8 },
        { type: 'textbox', left: 110, top: 83, width: 100, text: 'Detail A', fontSize: 11, fontFamily: 'Inter', fontWeight: 600, fill: '#1d4ed8', textAlign: 'center', originX: 'center' },

        { type: 'rect', left: 150, top: 160, width: 100, height: 2, fill: '#93c5fd' },
        { type: 'rect', left: 40, top: 140, width: 120, height: 40, fill: '#eff6ff', stroke: '#93c5fd', strokeWidth: 1.5, rx: 8, ry: 8 },
        { type: 'textbox', left: 100, top: 148, width: 100, text: 'Detail B', fontSize: 11, fontFamily: 'Inter', fontWeight: 600, fill: '#1d4ed8', textAlign: 'center', originX: 'center' },

        // ── Secondary Node 2 (top-right, green) ──
        { type: 'circle', left: 900, top: 160, radius: 50, fill: '#dcfce7', stroke: '#16a34a', strokeWidth: 2.5 },
        { type: 'textbox', left: 900, top: 145, width: 80, text: 'Sub-\nconcept 2', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#16a34a', textAlign: 'center', originX: 'center' },

        // Tertiary from Node 2
        { type: 'rect', left: 960, top: 120, width: 100, height: 2, fill: '#86efac' },
        { type: 'rect', left: 1050, top: 100, width: 120, height: 40, fill: '#f0fdf4', stroke: '#86efac', strokeWidth: 1.5, rx: 8, ry: 8 },
        { type: 'textbox', left: 1110, top: 108, width: 100, text: 'Detail C', fontSize: 11, fontFamily: 'Inter', fontWeight: 600, fill: '#16a34a', textAlign: 'center', originX: 'center' },

        // ── Secondary Node 3 (right, orange) ──
        { type: 'circle', left: 1020, top: 370, radius: 50, fill: '#fff7ed', stroke: '#ea580c', strokeWidth: 2.5 },
        { type: 'textbox', left: 1020, top: 355, width: 80, text: 'Sub-\nconcept 3', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#ea580c', textAlign: 'center', originX: 'center' },

        // ── Secondary Node 4 (bottom-right, red) ──
        { type: 'circle', left: 900, top: 580, radius: 50, fill: '#fef2f2', stroke: '#dc2626', strokeWidth: 2.5 },
        { type: 'textbox', left: 900, top: 565, width: 80, text: 'Sub-\nconcept 4', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#dc2626', textAlign: 'center', originX: 'center' },

        // Tertiary from Node 4
        { type: 'rect', left: 960, top: 620, width: 100, height: 2, fill: '#fca5a5' },
        { type: 'rect', left: 1050, top: 600, width: 120, height: 40, fill: '#fef2f2', stroke: '#fca5a5', strokeWidth: 1.5, rx: 8, ry: 8 },
        { type: 'textbox', left: 1110, top: 608, width: 100, text: 'Detail D', fontSize: 11, fontFamily: 'Inter', fontWeight: 600, fill: '#dc2626', textAlign: 'center', originX: 'center' },

        // ── Secondary Node 5 (bottom-left, gold) ──
        { type: 'circle', left: 300, top: 580, radius: 50, fill: '#fefce8', stroke: '#ca8a04', strokeWidth: 2.5 },
        { type: 'textbox', left: 300, top: 565, width: 80, text: 'Sub-\nconcept 5', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#ca8a04', textAlign: 'center', originX: 'center' },

        // ── Secondary Node 6 (left, sky blue) ──
        { type: 'circle', left: 180, top: 370, radius: 50, fill: '#e0f2fe', stroke: '#0ea5e9', strokeWidth: 2.5 },
        { type: 'textbox', left: 180, top: 355, width: 80, text: 'Sub-\nconcept 6', fontSize: 13, fontFamily: 'Inter', fontWeight: 600, fill: '#0ea5e9', textAlign: 'center', originX: 'center' },

        // ── Legend ──
        { type: 'rect', left: 30, top: 710, width: 1140, height: 50, fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1, rx: 8, ry: 8 },
        { type: 'textbox', left: 80, top: 722, width: 60, text: 'Legend:', fontSize: 12, fontFamily: 'Inter', fontWeight: 700, fill: '#1e293b', textAlign: 'left' },

        { type: 'circle', left: 170, top: 735, radius: 8, fill: '#7c3aed' },
        { type: 'textbox', left: 220, top: 727, width: 70, text: 'Central', fontSize: 11, fontFamily: 'Inter', fill: '#475569' },

        { type: 'circle', left: 310, top: 735, radius: 8, fill: '#dbeafe', stroke: '#1d4ed8', strokeWidth: 1.5 },
        { type: 'textbox', left: 360, top: 727, width: 50, text: 'Blue', fontSize: 11, fontFamily: 'Inter', fill: '#1d4ed8' },

        { type: 'circle', left: 430, top: 735, radius: 8, fill: '#dcfce7', stroke: '#16a34a', strokeWidth: 1.5 },
        { type: 'textbox', left: 480, top: 727, width: 55, text: 'Green', fontSize: 11, fontFamily: 'Inter', fill: '#16a34a' },

        { type: 'circle', left: 555, top: 735, radius: 8, fill: '#fff7ed', stroke: '#ea580c', strokeWidth: 1.5 },
        { type: 'textbox', left: 605, top: 727, width: 60, text: 'Orange', fontSize: 11, fontFamily: 'Inter', fill: '#ea580c' },

        { type: 'circle', left: 685, top: 735, radius: 8, fill: '#fef2f2', stroke: '#dc2626', strokeWidth: 1.5 },
        { type: 'textbox', left: 730, top: 727, width: 40, text: 'Red', fontSize: 11, fontFamily: 'Inter', fill: '#dc2626' },

        { type: 'circle', left: 800, top: 735, radius: 8, fill: '#fefce8', stroke: '#ca8a04', strokeWidth: 1.5 },
        { type: 'textbox', left: 845, top: 727, width: 45, text: 'Gold', fontSize: 11, fontFamily: 'Inter', fill: '#ca8a04' },

        { type: 'circle', left: 920, top: 735, radius: 8, fill: '#e0f2fe', stroke: '#0ea5e9', strokeWidth: 1.5 },
        { type: 'textbox', left: 965, top: 727, width: 40, text: 'Sky', fontSize: 11, fontFamily: 'Inter', fill: '#0ea5e9' },

        { type: 'rect', left: 1030, top: 727, width: 25, height: 2.5, fill: '#475569' },
        { type: 'textbox', left: 1090, top: 727, width: 70, text: 'Relationship', fontSize: 11, fontFamily: 'Inter', fill: '#475569' },

        // Bottom tip
        { type: 'textbox', left: 600, top: 770, width: 900, text: 'Tip: Click any node to rename it. Drag nodes to rearrange. Edit relationship labels on the connecting lines.', fontSize: 12, fontFamily: 'Inter', fill: '#94a3b8', textAlign: 'center', originX: 'center' },
      ],
      background: '#ffffff',
    },
  },
];
