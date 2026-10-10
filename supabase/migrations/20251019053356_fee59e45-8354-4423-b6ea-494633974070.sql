-- Fix SVG namespace issues in existing icons
-- This updates icons that have ns0:svg or other namespace prefixes
UPDATE icons
SET svg_content = REGEXP_REPLACE(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(svg_content, '<ns(\d+):svg', '<svg', 'g'),
        '</ns(\d+):svg>', '</svg>', 'g'
      ),
      'xmlns:ns(\d+)=', 'xmlns=', 'g'
    ),
    '<(/?)ns(\d+):(\w+)', '<\1\3', 'g'
  ),
  'ns(\d+):', '', 'g'
)
WHERE svg_content ~ 'ns\d+:(svg|xmlns)';