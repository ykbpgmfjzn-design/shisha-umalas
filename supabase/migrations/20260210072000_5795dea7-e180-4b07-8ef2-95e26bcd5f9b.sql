-- Add translations JSONB column to menu_items
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS name_translations jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Add description column for English description
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

-- Add description_translations JSONB column
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS description_translations jsonb NOT NULL DEFAULT '{}'::jsonb;