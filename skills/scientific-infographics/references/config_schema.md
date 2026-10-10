# Infographic Configuration Schema

The `generate_infographic.py` script requires a JSON configuration file to define the layout and content of the infographic.

## Schema Structure

```json
{
  "title": "Main Title of the Infographic",
  "subtitle": "Optional Subtitle",
  "background_color": "#F0F4F8", // Optional, defaults to a light blue/gray
  "panels": [
    {
      "id": "panel_1",
      "title": "Panel Title",
      "x": 20, // X coordinate (pixels)
      "y": 80, // Y coordinate (pixels)
      "width": 570, // Width (pixels)
      "height": 280, // Height (pixels)
      "background_color": "#E1E8ED", // Optional panel background
      "content": [
        {
          "type": "text",
          "text": "Body text goes here. Can include multiple lines.",
          "x": 10, // Relative to panel x
          "y": 40, // Relative to panel y
          "font_size": 14,
          "color": "#333333",
          "bold": false
        },
        {
          "type": "image",
          "path": "/path/to/generated/icon.png",
          "x": 300, // Relative to panel x
          "y": 40, // Relative to panel y
          "width": 200, // Target width (will scale proportionally)
          "height": 200 // Target height
        },
        {
          "type": "table",
          "x": 10,
          "y": 100,
          "headers": ["Drug", "Monitoring", "Reversal"],
          "rows": [
            ["Warfarin", "INR", "Vit K + PCC"],
            ["UFH", "aPTT", "Protamine"]
          ],
          "col_widths": [100, 100, 150]
        }
      ]
    }
  ]
}
```

## Coordinate System

- The canvas is 1200 pixels wide and 680 pixels high.
- `(0, 0)` is the top-left corner of the canvas.
- Panel coordinates (`x`, `y`) are absolute relative to the canvas.
- Content coordinates (`x`, `y`) within a panel are relative to the panel's top-left corner.

## Layout Best Practices

- **Margins**: Leave at least 20px margins around the edges of the canvas.
- **Spacing**: Leave 10-20px spacing between panels.
- **2-Column Layout**: Left column x=20, width=570; Right column x=610, width=570.
- **3-Column Layout**: x=20, w=373; x=413, w=373; x=806, w=374.
