-- Add membrane-related columns to icons table
ALTER TABLE public.icons
ADD COLUMN IF NOT EXISTS is_membrane_icon BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS is_default_membrane_icon BOOLEAN DEFAULT false NOT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_icons_is_membrane_icon ON public.icons(is_membrane_icon)
WHERE is_membrane_icon = true;

CREATE INDEX IF NOT EXISTS idx_icons_default_membrane ON public.icons(is_default_membrane_icon)
WHERE is_default_membrane_icon = true;

-- Add check constraint: only membrane icons can be default
ALTER TABLE public.icons
ADD CONSTRAINT check_single_default_membrane_icon
CHECK (
  CASE WHEN is_default_membrane_icon = true
  THEN is_membrane_icon = true
  ELSE true
  END
);

-- Function to enforce single default (prevents race conditions)
CREATE OR REPLACE FUNCTION enforce_single_default_membrane_icon()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default_membrane_icon = true THEN
    IF NEW.is_membrane_icon = false THEN
      RAISE EXCEPTION 'Default membrane icon must also be marked as is_membrane_icon';
    END IF;

    -- Unset any other default membrane icons
    UPDATE public.icons
    SET is_default_membrane_icon = false
    WHERE id != NEW.id
      AND is_default_membrane_icon = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce single default
DROP TRIGGER IF EXISTS trigger_enforce_single_default_membrane_icon ON public.icons;
CREATE TRIGGER trigger_enforce_single_default_membrane_icon
BEFORE INSERT OR UPDATE ON public.icons
FOR EACH ROW
WHEN (NEW.is_default_membrane_icon = true)
EXECUTE FUNCTION enforce_single_default_membrane_icon();

-- Add helpful comments
COMMENT ON COLUMN public.icons.is_membrane_icon IS 'Indicates if this icon is suitable for membrane tool';
COMMENT ON COLUMN public.icons.is_default_membrane_icon IS 'Indicates if this is the default membrane icon (only one allowed)';
