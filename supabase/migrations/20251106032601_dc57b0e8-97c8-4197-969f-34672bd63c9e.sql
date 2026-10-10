-- Add new columns to powerpoint_custom_templates for enhanced layouts
ALTER TABLE powerpoint_custom_templates
ADD COLUMN IF NOT EXISTS quote_styles JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS image_layouts JSONB DEFAULT NULL;

-- Add comment explaining the new columns
COMMENT ON COLUMN powerpoint_custom_templates.quote_styles IS 'Quote slide styling options: quoteSize, attributionSize, showQuoteMarks, quoteColor, alignment';
COMMENT ON COLUMN powerpoint_custom_templates.image_layouts IS 'Image layout configuration: gridColumns, imageSize, imageBorder, imageRounded, imageSpacing';