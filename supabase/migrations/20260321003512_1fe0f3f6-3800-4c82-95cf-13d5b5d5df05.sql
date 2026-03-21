ALTER TABLE public.action_items ALTER COLUMN responsible_party SET DEFAULT 'sysde';
ALTER TABLE public.deliverables ALTER COLUMN responsible_party SET DEFAULT 'sysde';
UPDATE public.action_items SET responsible_party = 'sysde' WHERE responsible_party = 'cisde';
UPDATE public.deliverables SET responsible_party = 'sysde' WHERE responsible_party = 'cisde';