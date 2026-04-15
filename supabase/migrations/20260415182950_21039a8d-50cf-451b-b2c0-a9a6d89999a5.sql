DELETE FROM public.support_tickets a USING public.support_tickets b
WHERE a.id > b.id AND a.client_id = b.client_id AND a.ticket_id = b.ticket_id;

ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_client_ticket_unique UNIQUE (client_id, ticket_id);