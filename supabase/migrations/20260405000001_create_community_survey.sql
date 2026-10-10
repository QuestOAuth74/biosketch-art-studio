-- Community Survey & Letter of Support
CREATE TABLE public.community_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Q1: Current role
  q1_role text,
  q1_role_other text,

  -- Q2: Primary research area
  q2_research_area text,
  q2_research_area_other text,

  -- Q3: Do you currently pay for a scientific illustration tool?
  q3_pay_for_tool text,

  -- Q4: If cost were not a factor, which tool would you use?
  q4_preferred_tool text,
  q4_preferred_tool_other text,

  -- Q5: Has cost affected the quality of your figures?
  q5_cost_affected_quality text,

  -- Q6: How familiar are you with BioSketch?
  q6_biosketch_familiarity text,

  -- Q7: What has limited your use of BioSketch? (multi-select)
  q7_limitations jsonb DEFAULT '[]',
  q7_limitations_other text,

  -- Q8: Have you used BioSketch in any of the following? (multi-select)
  q8_usage_contexts jsonb DEFAULT '[]',
  q8_usage_contexts_other text,
  q8_publication_link text,

  -- Q9: Feature ratings (object: { feature_key: rating_string })
  q9_feature_ratings jsonb DEFAULT '{}',

  -- Q10: What specific icons/organisms/topics does BioSketch lack?
  q10_missing_icons text,

  -- Q11: How important is it that tools are free and open source?
  q11_open_source_importance text,

  -- Q12: Would you be willing to contribute? (multi-select)
  q12_willing_to_contribute jsonb DEFAULT '[]',

  -- Letter of support fields
  signed_letter boolean DEFAULT false,
  supporter_name text,
  supporter_institution text,
  supporter_role text,
  supporter_country text,
  supporter_email text,
  supporter_comments text,

  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.community_survey_responses ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a survey response
CREATE POLICY "Anyone can submit survey responses"
  ON public.community_survey_responses
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Anyone can read signed supporter info (for public display)
CREATE POLICY "Anyone can read signed supporters"
  ON public.community_survey_responses
  FOR SELECT
  TO public
  USING (signed_letter = true);

-- Admins can view all responses
CREATE POLICY "Admins can view all survey responses"
  ON public.community_survey_responses
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update survey responses
CREATE POLICY "Admins can update survey responses"
  ON public.community_survey_responses
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete survey responses
CREATE POLICY "Admins can delete survey responses"
  ON public.community_survey_responses
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes
CREATE INDEX idx_survey_signed_letter ON public.community_survey_responses(signed_letter);
CREATE INDEX idx_survey_created_at ON public.community_survey_responses(created_at DESC);
