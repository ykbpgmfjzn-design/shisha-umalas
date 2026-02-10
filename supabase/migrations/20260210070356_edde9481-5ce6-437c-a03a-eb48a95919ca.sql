
-- Create menu_items table
CREATE TABLE public.menu_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  price_display TEXT NOT NULL DEFAULT '',
  strength TEXT NOT NULL DEFAULT 'Light',
  is_signature BOOLEAN NOT NULL DEFAULT false,
  item_type TEXT NOT NULL DEFAULT 'hookah',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Anyone can read active menu items
CREATE POLICY "Anyone can view active menu items"
ON public.menu_items
FOR SELECT
USING (true);

-- Admins can manage menu items
CREATE POLICY "Admins can insert menu items"
ON public.menu_items
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins can update menu items"
ON public.menu_items
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins can delete menu items"
ON public.menu_items
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_menu_items_updated_at
BEFORE UPDATE ON public.menu_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with existing menu data
INSERT INTO public.menu_items (id, name, price, price_display, strength, is_signature, item_type, keywords, sort_order) VALUES
('wl-vanilla', 'Whiteline Vanilla', 280000, 'IDR 280K', 'Ultra Light', false, 'hookah', ARRAY['vanilla', 'ваниль', 'vanila', 'whiteline vanilla'], 1),
('wl-oolong', 'Whiteline Oolong Tea', 280000, 'IDR 280K', 'Ultra Light', false, 'hookah', ARRAY['oolong', 'tea', 'чай', 'улун'], 2),
('hl-watermelon', 'Herbaline Watermelon', 280000, 'IDR 280K', 'Ultra Light', false, 'hookah', ARRAY['watermelon', 'арбуз', 'semangka'], 3),
('vanilla-breeze', 'Vanilla Breeze', 320000, 'IDR 320K', 'Ultra Light', true, 'hookah', ARRAY['vanilla breeze', 'breeze', 'ваниль бриз'], 4),
('watermelon-wave', 'Watermelon Wave', 320000, 'IDR 320K', 'Ultra Light', true, 'hookah', ARRAY['watermelon wave', 'wave', 'арбуз волна'], 5),
('wl-mint', 'Whiteline Mint', 295000, 'IDR 295K', 'Light', false, 'hookah', ARRAY['mint', 'мята', 'мятный'], 6),
('af-two-apple', 'Al Fakher Two Apple', 295000, 'IDR 295K', 'Light', false, 'hookah', ARRAY['apple', 'two apple', 'яблоко'], 7),
('minty-grapes', 'Minty Grapes', 335000, 'IDR 335K', 'Light', true, 'hookah', ARRAY['minty grapes', 'grape', 'виноград'], 8),
('minty-gum', 'Minty Gum', 335000, 'IDR 335K', 'Light', true, 'hookah', ARRAY['minty gum', 'gum', 'жвачка'], 9),
('bl-african', 'Blackline African Queen', 325000, 'IDR 325K', 'Medium', false, 'hookah', ARRAY['african queen', 'african', 'африка'], 10),
('bl-spicy-lime', 'Blackline Spicey Lime', 325000, 'IDR 325K', 'Medium', false, 'hookah', ARRAY['spicey lime', 'lime', 'лайм'], 11),
('bl-booster', 'Blackline Booster', 325000, 'IDR 325K', 'Medium', false, 'hookah', ARRAY['booster', 'energy', 'бустер'], 12),
('tipsy-lime', 'Tipsy Lime', 405000, 'IDR 405K', 'Medium', true, 'hookah', ARRAY['tipsy lime', 'tipsy', 'лайм коктейль'], 13),
('evening-moscow', 'Evening Moscow', 405000, 'IDR 405K', 'Medium', true, 'hookah', ARRAY['evening moscow', 'moscow', 'москва'], 14),
('tangiers-cooling', 'Tangiers Cooling', 450000, 'IDR 450K', 'Bold Strong', false, 'hookah', ARRAY['tangiers cooling', 'cooling', 'холод'], 15),
('tangiers-schnozz', 'Tangiers Schnozzberry', 450000, 'IDR 450K', 'Bold Strong', false, 'hookah', ARRAY['schnozzberry', 'berry', 'ягода'], 16),
('darkside-polar', 'Darkside Polar Cream', 450000, 'IDR 450K', 'Bold Strong', false, 'hookah', ARRAY['polar cream', 'cream', 'крем'], 17),
('berry-kiss', 'Berry Kiss', 485000, 'IDR 485K', 'Bold Strong', true, 'hookah', ARRAY['berry kiss', 'kiss', 'ягода поцелуй'], 18),
('wild-heart', 'Wild Heart', 485000, 'IDR 485K', 'Bold Strong', true, 'hookah', ARRAY['wild heart', 'wild', 'heart'], 19),
('mixed-nuts', 'Mixed Nuts', 10000, 'IDR 10K', 'Extra', false, 'snack', ARRAY['mixed nuts', 'nuts', 'орехи', 'kacang'], 20);
