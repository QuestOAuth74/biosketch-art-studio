---
name: scientific-infographics
description: Create 1200x680 PNG scientific infographics with icons, diagrams, and rich visual elements. Use for board review notes, medical/scientific diagrams, and structured visual summaries.
---

# Scientific Infographics

This skill provides a structured workflow and Python script for generating high-quality 1200x680 PNG scientific infographics, modeled after professional board review notes and Cell journal illustrations.

## When to Use

Use this skill when the user requests:
- Scientific infographics
- Board review visual notes
- Medical diagrams with text and icons
- Structured visual summaries of biological or chemical processes

## Workflow

Creating a scientific infographic involves these steps:

1. **Information Architecture**: Organize the user's content into logical panels or sections.
2. **Asset Generation**: Generate necessary icons, diagrams, or illustrations using Manus's image generation capabilities (BioRender style, muted pastel palette, realistic icons).
3. **Layout Configuration**: Define the layout using the provided Python script, mapping text and generated images to specific regions.
4. **Rendering**: Run the script to generate the final 1200x680 PNG.

## Style Guidelines

- **Dimensions**: Strictly 1200x680 pixels.
- **Aesthetics**: Clean Cell journal style, BioRender 2D illustration style.
- **Colors**: Muted pastel medical color palette, soft gradients.
- **Elements**: Smooth semi-flat vector rendering, minimal shadows, thin outline strokes.
- **Composition**: Organized segmented layout (panels with headers), clean white or light blue/gray background, balanced spacing.
- **Icons**: Realistic aesthetic, avoiding overly stylized "AI looking" junk.

## Using the Generation Script

The skill includes a Python script (`scripts/generate_infographic.py`) that uses `Pillow` to render the infographic based on a JSON configuration.

1. **Create Configuration**: Write a JSON file (`config.json`) defining the infographic structure (title, panels, text, image paths). See `references/config_schema.md` for the schema.
2. **Prepare Images**: Ensure all required icons and diagrams are generated and saved locally.
3. **Run Script**: Execute the script with the configuration file.

```bash
python /home/ubuntu/skills/scientific-infographics/scripts/generate_infographic.py path/to/config.json path/to/output.png
```
