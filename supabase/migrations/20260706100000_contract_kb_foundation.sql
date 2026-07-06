-- ════════════════════════════════════════════════════════════════════════
-- Frente A — Knowledge Base de contratos (pipeline RAG) · Backbone de datos
--
-- Capa de persistencia para el pipeline RAG de contratos:
--   • contract_documents        — un PDF firmado subido (metadata + estado de
--                                  ingesta), vinculado a client + client_contracts.
--   • contract_document_chunks  — fragmentos del documento con su embedding
--                                  (vector), sobre los que se hace recuperación.
--   • match_contract_chunks()   — RPC de recuperación semántica kNN (cosine),
--                                  con enforcement de visibilidad por cliente.
--
-- Embeddings: el stack de chat es Anthropic (sin API de embeddings propia), así
-- que el vector store usa un proveedor de embeddings aparte. Dimensión fijada a
-- 1536 (compatible con text-embedding-3-small de OpenAI y con voyage-3-large a
-- 1536). Si se cambia de modelo/dimensión, ajustar vector(N) y reindexar.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists vector;

-- ── Bucket privado para los PDFs firmados ────────────────────────────────
insert into storage.buckets (id, name, public)
values ('contract-docs', 'contract-docs', false)
on conflict (id) do nothing;

-- ── Documentos ───────────────────────────────────────────────────────────
create table if not exists public.contract_documents (
  id           uuid primary key default gen_random_uuid(),
  client_id    text not null,
  contract_id  uuid references public.client_contracts(id) on delete set null,
  storage_path text not null,
  filename     text not null,
  mime_type    text,
  byte_size    bigint,
  page_count   int,
  status       text not null default 'pending'
               check (status in ('pending','ingesting','ingested','failed')),
  error        text,
  chunk_count  int not null default 0,
  uploaded_by  uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_contract_documents_client on public.contract_documents(client_id);
create index if not exists idx_contract_documents_contract on public.contract_documents(contract_id);
create index if not exists idx_contract_documents_status on public.contract_documents(status);

-- ── Chunks + embeddings ──────────────────────────────────────────────────
create table if not exists public.contract_document_chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.contract_documents(id) on delete cascade,
  client_id   text not null,               -- denormalizado para scoping RLS y filtro
  chunk_index int not null,
  content     text not null,
  token_count int,
  embedding   vector(1536),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (document_id, chunk_index)
);
create index if not exists idx_contract_chunks_document on public.contract_document_chunks(document_id);
create index if not exists idx_contract_chunks_client on public.contract_document_chunks(client_id);
-- Índice ANN para recuperación por similitud coseno (HNSW: mejor recall que ivfflat).
create index if not exists idx_contract_chunks_embedding
  on public.contract_document_chunks using hnsw (embedding vector_cosine_ops);

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Contratos = datos internos: lectura para staff que pueda ver al cliente;
-- escritura directa para admin/pm. La ingesta corre con service role (bypassa
-- RLS), así que estas políticas de escritura sólo acotan el acceso vía API.
alter table public.contract_documents enable row level security;
alter table public.contract_document_chunks enable row level security;

drop policy if exists "Staff read contract_documents" on public.contract_documents;
create policy "Staff read contract_documents" on public.contract_documents for select
  using (public.is_staff_user() and public.user_can_see_client(client_id));

drop policy if exists "Admin/PM write contract_documents" on public.contract_documents;
create policy "Admin/PM write contract_documents" on public.contract_documents for all
  using (has_role(auth.uid(),'admin'::app_role) or has_role(auth.uid(),'pm'::app_role))
  with check (has_role(auth.uid(),'admin'::app_role) or has_role(auth.uid(),'pm'::app_role));

drop policy if exists "Staff read contract_chunks" on public.contract_document_chunks;
create policy "Staff read contract_chunks" on public.contract_document_chunks for select
  using (public.is_staff_user() and public.user_can_see_client(client_id));

drop policy if exists "Admin/PM write contract_chunks" on public.contract_document_chunks;
create policy "Admin/PM write contract_chunks" on public.contract_document_chunks for all
  using (has_role(auth.uid(),'admin'::app_role) or has_role(auth.uid(),'pm'::app_role))
  with check (has_role(auth.uid(),'admin'::app_role) or has_role(auth.uid(),'pm'::app_role));

-- ── Recuperación semántica kNN ───────────────────────────────────────────
-- Devuelve los match_count chunks más similares (distancia coseno), opcionalmente
-- acotados a un cliente. SECURITY DEFINER para poder usar el índice ANN, pero se
-- enforcea la visibilidad con user_can_see_client() dentro del WHERE.
create or replace function public.match_contract_chunks(
  query_embedding vector(1536),
  match_count int default 8,
  p_client_id text default null
)
returns table (
  id uuid,
  document_id uuid,
  client_id text,
  chunk_index int,
  content text,
  similarity float
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select c.id, c.document_id, c.client_id, c.chunk_index, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.contract_document_chunks c
  where c.embedding is not null
    and (p_client_id is null or c.client_id = p_client_id)
    and public.user_can_see_client(c.client_id)
  order by c.embedding <=> query_embedding
  limit greatest(1, least(match_count, 50));
$$;

grant execute on function public.match_contract_chunks(vector, int, text) to authenticated;
