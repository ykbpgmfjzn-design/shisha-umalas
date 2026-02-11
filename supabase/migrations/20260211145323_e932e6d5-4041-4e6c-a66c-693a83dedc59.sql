-- Clean up DOKU Invoice info from notes field in existing purchases
UPDATE public.purchases 
SET notes = regexp_replace(notes, E'\n?DOKU Invoice:.*$', '', 'g')
WHERE notes ILIKE '%DOKU Invoice:%';

-- Also handle case where notes starts with "DOKU Invoice:" (no item before it)
UPDATE public.purchases 
SET notes = NULL
WHERE notes IS NOT NULL AND trim(notes) = '';