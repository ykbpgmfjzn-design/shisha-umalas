
CREATE TABLE public.tobacco_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  category text NOT NULL DEFAULT 'tobacco',
  amount numeric NOT NULL,
  supplier text,
  invoice_number text,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tobacco_expenses ENABLE ROW LEVEL SECURITY;

-- Admin & Owner full access
CREATE POLICY "Admins and owners can manage expenses"
  ON public.tobacco_expenses FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

-- Accounting read-only
CREATE POLICY "Accounting can view expenses"
  ON public.tobacco_expenses FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'accounting'::app_role));

-- Updated at trigger
CREATE TRIGGER update_tobacco_expenses_updated_at
  BEFORE UPDATE ON public.tobacco_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
