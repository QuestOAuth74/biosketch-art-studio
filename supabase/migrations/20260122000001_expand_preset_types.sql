-- Expand user_style_presets type constraint to support all new object types
-- Drop the old constraint
ALTER TABLE public.user_style_presets
  DROP CONSTRAINT IF EXISTS user_style_presets_type_check;

-- Add new constraint with expanded types
ALTER TABLE public.user_style_presets
  ADD CONSTRAINT user_style_presets_type_check
  CHECK (type IN (
    'text',
    'textbox',
    'text-on-path',
    'shape',
    'line',
    'image',
    'icon',
    'membrane',
    'bracket',
    'leader-line',
    'callout',
    'masked-image',
    'mixed'
  ));
