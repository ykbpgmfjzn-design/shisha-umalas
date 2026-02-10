ALTER TABLE public.training_materials ADD COLUMN language text NOT NULL DEFAULT 'en';

-- Add index for filtering by language
CREATE INDEX idx_training_materials_language ON public.training_materials(language);