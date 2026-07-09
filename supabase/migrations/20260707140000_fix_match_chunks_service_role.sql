-- Fix: match_contract_chunks enforzaba user_can_see_client(), que usa auth.uid().
-- Las edge functions (extract-contract-terms, audit-contract-scope) llaman esta
-- RPC con service_role, donde auth.uid() es NULL → el chequeo devolvía false y
-- filtraba TODOS los fragmentos → la extracción fallaba con 409 aunque el
-- contrato estuviera ingestado. Esas funciones ya autorizan por su cuenta
-- (requireRole admin/pm) antes de llamar, así que se salta la visibilidad
-- cuando no hay usuario (service_role). Los llamados con JWT de usuario siguen
-- acotados por user_can_see_client().
CREATE OR REPLACE FUNCTION public.match_contract_chunks(
  query_embedding vector(1536),
  match_count int default 8,
  p_client_id text default null
)
returns table (id uuid, document_id uuid, client_id text, chunk_index int, content text, similarity float)
language sql stable security definer set search_path to 'public'
as $$
  select c.id, c.document_id, c.client_id, c.chunk_index, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.contract_document_chunks c
  where c.embedding is not null
    and (p_client_id is null or c.client_id = p_client_id)
    and (auth.uid() is null or public.user_can_see_client(c.client_id))
  order by c.embedding <=> query_embedding
  limit greatest(1, least(match_count, 50));
$$;
