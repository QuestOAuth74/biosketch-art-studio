-- Add enhanced_bullets and shaded_boxes columns to powerpoint_custom_templates table
ALTER TABLE powerpoint_custom_templates 
ADD COLUMN IF NOT EXISTS enhanced_bullets JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS shaded_boxes JSONB DEFAULT NULL;

COMMENT ON COLUMN powerpoint_custom_templates.enhanced_bullets IS 'Icon bullet configuration: {enabled, iconSet, circleSize, circleColor, iconColor}';
COMMENT ON COLUMN powerpoint_custom_templates.shaded_boxes IS 'Shaded box configuration: {enabled, opacity, backgroundColor, padding}';