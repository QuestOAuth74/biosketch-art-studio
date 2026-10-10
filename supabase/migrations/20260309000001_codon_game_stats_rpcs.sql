-- RPC to increment codon game play count (bypasses RLS for anonymous users)
CREATE OR REPLACE FUNCTION public.increment_codon_play_count()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_val JSONB;
  updated_val JSONB;
BEGIN
  SELECT setting_value INTO current_val
  FROM site_settings
  WHERE setting_key = 'codon_game_stats';

  IF current_val IS NULL THEN
    updated_val := jsonb_build_object('total_plays', 1, 'total_ratings', 0, 'rating_sum', 0);
    INSERT INTO site_settings (setting_key, setting_value)
    VALUES ('codon_game_stats', updated_val);
  ELSE
    updated_val := jsonb_set(
      current_val,
      '{total_plays}',
      to_jsonb(COALESCE((current_val->>'total_plays')::int, 0) + 1)
    );
    UPDATE site_settings
    SET setting_value = updated_val, updated_at = now()
    WHERE setting_key = 'codon_game_stats';
  END IF;

  RETURN updated_val;
END;
$$;

-- RPC to submit a codon game rating (bypasses RLS for anonymous users)
-- previous_rating = 0 means first-time rating; non-zero means re-rating
CREATE OR REPLACE FUNCTION public.submit_codon_rating(new_rating INT, previous_rating INT DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_val JSONB;
  updated_val JSONB;
  cur_total_ratings INT;
  cur_rating_sum INT;
BEGIN
  IF new_rating < 1 OR new_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  SELECT setting_value INTO current_val
  FROM site_settings
  WHERE setting_key = 'codon_game_stats';

  IF current_val IS NULL THEN
    updated_val := jsonb_build_object('total_plays', 0, 'total_ratings', 1, 'rating_sum', new_rating);
    INSERT INTO site_settings (setting_key, setting_value)
    VALUES ('codon_game_stats', updated_val);
  ELSE
    cur_total_ratings := COALESCE((current_val->>'total_ratings')::int, 0);
    cur_rating_sum := COALESCE((current_val->>'rating_sum')::int, 0);

    -- If previous_rating is 0, this is a new rating; otherwise it's an update
    IF previous_rating = 0 THEN
      cur_total_ratings := cur_total_ratings + 1;
    END IF;
    cur_rating_sum := cur_rating_sum - previous_rating + new_rating;

    updated_val := current_val;
    updated_val := jsonb_set(updated_val, '{total_ratings}', to_jsonb(cur_total_ratings));
    updated_val := jsonb_set(updated_val, '{rating_sum}', to_jsonb(cur_rating_sum));

    UPDATE site_settings
    SET setting_value = updated_val, updated_at = now()
    WHERE setting_key = 'codon_game_stats';
  END IF;

  RETURN updated_val;
END;
$$;

-- Grant execute to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.increment_codon_play_count() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_codon_rating(INT, INT) TO anon, authenticated;
