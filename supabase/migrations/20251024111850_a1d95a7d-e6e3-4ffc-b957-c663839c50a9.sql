-- Add field_of_study column to profiles table
ALTER TABLE profiles 
ADD COLUMN field_of_study TEXT;

-- Add a comment for documentation
COMMENT ON COLUMN profiles.field_of_study IS 'User scientific discipline/field of study';

-- Update the handle_new_user function to include field_of_study
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, country, field_of_study)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'country',
    NEW.raw_user_meta_data->>'field_of_study'
  );
  
  -- Auto-assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$function$;