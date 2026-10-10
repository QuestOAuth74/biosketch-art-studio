-- Drop the problematic B-tree index on thumbnail column
-- This index was causing failures when storing optimized SVG thumbnails
-- that exceeded the B-tree size limit of 8191 bytes
DROP INDEX IF EXISTS idx_icons_thumbnail;