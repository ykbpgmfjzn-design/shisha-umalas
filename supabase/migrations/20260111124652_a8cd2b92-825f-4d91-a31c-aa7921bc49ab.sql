-- Clear all data except users (profiles and user_roles)

-- Delete from tables with foreign key dependencies first
DELETE FROM public.reservations;
DELETE FROM public.purchases;
DELETE FROM public.feedback;
DELETE FROM public.activity_logs;
DELETE FROM public.training_materials;
DELETE FROM public.app_settings;