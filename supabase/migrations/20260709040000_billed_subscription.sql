-- Suscripción recurrente en paquetes facturados: para saber si el servicio
-- está activo y cuándo es el próximo pago (extraído del contrato).
ALTER TABLE public.billed_packages ADD COLUMN IF NOT EXISTS is_subscription boolean NOT NULL DEFAULT false;
ALTER TABLE public.billed_packages ADD COLUMN IF NOT EXISTS billing_cycle text;       -- mensual/trimestral/semestral/anual
ALTER TABLE public.billed_packages ADD COLUMN IF NOT EXISTS next_payment_date date;
