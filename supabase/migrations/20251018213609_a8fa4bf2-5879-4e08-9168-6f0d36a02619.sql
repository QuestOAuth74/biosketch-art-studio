-- Add star rating column to testimonials
ALTER TABLE public.testimonials
ADD COLUMN rating integer DEFAULT 5 CHECK (rating >= 1 AND rating <= 5);

-- Sample testimonials are seeded by the seed script (scripts/seed.ts)