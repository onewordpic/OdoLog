DROP FUNCTION IF EXISTS public.get_public_garage(text);
DROP FUNCTION IF EXISTS public.get_public_garage_stats(text);
ALTER TABLE public.profiles DROP COLUMN IF EXISTS public_handle;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS public_bio;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS public_avatar_url;
ALTER TABLE public.vehicles DROP COLUMN IF EXISTS garage_visibility;