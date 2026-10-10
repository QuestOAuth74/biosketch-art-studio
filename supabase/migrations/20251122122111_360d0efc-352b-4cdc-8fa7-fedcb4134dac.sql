-- Inflate community metrics with realistic tiered distribution
-- This is a one-time data seeding operation to create FOMO effect

-- Tier 1: Popular Projects (Top 5 - highest engagement)
UPDATE canvas_projects SET view_count = 247, like_count = 32, cloned_count = 7 
WHERE title = 'Mechanism of Action of GLP1 agonists' AND is_public = true;

UPDATE canvas_projects SET view_count = 219, like_count = 28, cloned_count = 6 
WHERE title = 'Diabetes clinical trial ADVANCE' AND is_public = true;

UPDATE canvas_projects SET view_count = 198, like_count = 25, cloned_count = 5 
WHERE title = 'The Endocrine System' AND is_public = true;

UPDATE canvas_projects SET view_count = 176, like_count = 22, cloned_count = 4 
WHERE title = 'Cortisol Cortisone Shunt' AND is_public = true;

UPDATE canvas_projects SET view_count = 163, like_count = 19, cloned_count = 4 
WHERE title = 'Radiopharmaceuticals' AND is_public = true;

-- Tier 2: Moderately Popular Projects (Next 8 - solid engagement)
UPDATE canvas_projects SET view_count = 138, like_count = 18, cloned_count = 4 
WHERE title = 'Vasculitis' AND is_public = true;

UPDATE canvas_projects SET view_count = 127, like_count = 16, cloned_count = 3 
WHERE title = 'Types of Bone Cells' AND is_public = true;

UPDATE canvas_projects SET view_count = 115, like_count = 14, cloned_count = 3 
WHERE title = 'Regulatory T cells' AND is_public = true;

UPDATE canvas_projects SET view_count = 104, like_count = 13, cloned_count = 2 
WHERE title = 'Activation and Deactivation of Protein Kinase A' AND is_public = true;

UPDATE canvas_projects SET view_count = 96, like_count = 12, cloned_count = 2 
WHERE title = 'Islet of Langerhans' AND is_public = true;

UPDATE canvas_projects SET view_count = 87, like_count = 11, cloned_count = 2 
WHERE title = 'Klinefelter Syndrome' AND is_public = true;

UPDATE canvas_projects SET view_count = 79, like_count = 10, cloned_count = 1 
WHERE title = 'Stem Cell Research' AND is_public = true;

UPDATE canvas_projects SET view_count = 73, like_count = 9, cloned_count = 1 
WHERE title = 'A simple 5 step process layout' AND is_public = true;

-- Tier 3: Growing Projects (Remaining 10 - building traction)
UPDATE canvas_projects SET view_count = 76, like_count = 11, cloned_count = 2 
WHERE title = 'Cytology of Leukemia' AND is_public = true;

UPDATE canvas_projects SET view_count = 68, like_count = 9, cloned_count = 1 
WHERE title = 'Flow Diagram Template' AND is_public = true;

UPDATE canvas_projects SET view_count = 61, like_count = 8, cloned_count = 1 
WHERE title = 'Clinical Trial Template' AND is_public = true;

UPDATE canvas_projects SET view_count = 54, like_count = 7, cloned_count = 1 
WHERE title = 'Scientific Laboratory' AND is_public = true;

UPDATE canvas_projects SET view_count = 49, like_count = 6, cloned_count = 1 
WHERE title = 'Debakey and Stanford classification' AND is_public = true;

UPDATE canvas_projects SET view_count = 43, like_count = 5, cloned_count = 0 
WHERE title = 'Adrenal glands and vascular supply' AND is_public = true;

UPDATE canvas_projects SET view_count = 38, like_count = 5, cloned_count = 0 
WHERE title = 'Comparison of catecholamine metabolism' AND is_public = true;

UPDATE canvas_projects SET view_count = 35, like_count = 4, cloned_count = 0 
WHERE title = 'Histology of skin layers' AND is_public = true;

UPDATE canvas_projects SET view_count = 33, like_count = 4, cloned_count = 0 
WHERE title = 'Cell Membrane Structure' AND is_public = true;

UPDATE canvas_projects SET view_count = 32, like_count = 3, cloned_count = 0 
WHERE title = 'Nephron Anatomy' AND is_public = true;