
-- Create enum for guest type
CREATE TYPE public.guest_type AS enum ('guest', 'special');

-- Create enum for app roles
CREATE TYPE public.app_role AS enum ('admin', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  room_number TEXT,
  guest_type guest_type NOT NULL DEFAULT 'guest',
  total_hookahs_ordered INTEGER NOT NULL DEFAULT 0,
  loyalty_level INTEGER NOT NULL DEFAULT 1,
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user roles table for security
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Create loyalty levels reference table
CREATE TABLE public.loyalty_levels (
  level INTEGER PRIMARY KEY,
  name_ru TEXT NOT NULL,
  name_en TEXT NOT NULL,
  hookahs_required INTEGER NOT NULL,
  discount_percent INTEGER NOT NULL,
  free_drink BOOLEAN NOT NULL DEFAULT false,
  free_snack BOOLEAN NOT NULL DEFAULT false,
  special_bonus TEXT
);

-- Insert loyalty levels with names
INSERT INTO public.loyalty_levels (level, name_ru, name_en, hookahs_required, discount_percent, free_drink, free_snack, special_bonus) VALUES
(1, 'Новичок', 'Newcomer', 0, 0, false, false, NULL),
(2, 'Любитель', 'Amateur', 30, 2, false, false, NULL),
(3, 'Знаток', 'Connoisseur', 60, 4, true, false, NULL),
(4, 'Ценитель', 'Appreciator', 90, 6, true, false, NULL),
(5, 'Эксперт', 'Expert', 120, 8, true, true, NULL),
(6, 'Мастер', 'Master', 150, 10, true, true, NULL),
(7, 'Гуру', 'Guru', 180, 12, true, true, 'Приоритетное обслуживание'),
(8, 'Легенда', 'Legend', 210, 15, true, true, 'Эксклюзивные миксы'),
(9, 'Султан', 'Sultan', 240, 18, true, true, 'VIP зона'),
(10, 'Шах', 'Shah', 270, 20, true, true, 'Персональный кальянщик');

-- Create purchases table
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  hookah_count INTEGER NOT NULL DEFAULT 1,
  amount DECIMAL(10,2),
  discount_applied INTEGER DEFAULT 0,
  free_drink_used BOOLEAN DEFAULT false,
  free_snack_used BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Loyalty levels are public read
CREATE POLICY "Anyone can view loyalty levels" ON public.loyalty_levels
  FOR SELECT USING (true);

-- Purchases policies
CREATE POLICY "Users can view own purchases" ON public.purchases
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own purchases" ON public.purchases
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update loyalty level after purchase
CREATE OR REPLACE FUNCTION public.update_loyalty_after_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_total INTEGER;
  new_level INTEGER;
BEGIN
  -- Update total hookahs ordered
  UPDATE public.profiles
  SET total_hookahs_ordered = total_hookahs_ordered + NEW.hookah_count,
      updated_at = now()
  WHERE id = NEW.user_id
  RETURNING total_hookahs_ordered INTO new_total;
  
  -- Calculate new loyalty level (every 30 hookahs = 1 level, max 10)
  new_level := LEAST(10, 1 + (new_total / 30));
  
  -- Update loyalty level if changed
  UPDATE public.profiles
  SET loyalty_level = new_level,
      loyalty_points = new_total
  WHERE id = NEW.user_id AND loyalty_level < new_level;
  
  RETURN NEW;
END;
$$;

-- Trigger for purchase
CREATE TRIGGER on_purchase_created
  AFTER INSERT ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_loyalty_after_purchase();

-- Function to update room number and guest type
CREATE OR REPLACE FUNCTION public.update_room_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If room number is set (not null and not empty), make guest "special"
  IF NEW.room_number IS NOT NULL AND NEW.room_number != '' THEN
    NEW.guest_type := 'special';
  ELSE
    NEW.guest_type := 'guest';
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Trigger for room status
CREATE TRIGGER on_profile_room_update
  BEFORE UPDATE OF room_number ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_room_status();

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
