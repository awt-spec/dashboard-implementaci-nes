-- ============================================================================
-- Autoría + edición + adjuntos en comentarios — gap Tanda E (PORTAL-012, 013)
-- La mesa de discusión (comments) no registraba autor real (solo "user" texto),
-- lo que impedía "editar/eliminar solo los míos". Se agrega author_user_id +
-- soporte de adjunto + marca de edición. RLS afina UPDATE/DELETE a autor o staff.
-- ============================================================================

ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS author_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_size bigint,
  ADD COLUMN IF NOT EXISTS edited_at       timestamptz;

CREATE INDEX IF NOT EXISTS idx_comments_author ON public.comments(author_user_id);

-- ── RLS: afinar UPDATE/DELETE a autor o staff ───────────────────────────────
-- SELECT/INSERT se mantienen para authenticated (mesa de discusión abierta a
-- staff + cliente del caso, ya controlado a nivel app por client_id).
-- UPDATE/DELETE: solo el autor del comentario o staff (moderación).

DROP POLICY IF EXISTS "Authenticated update comments" ON public.comments;
CREATE POLICY "Author or staff updates comments"
  ON public.comments FOR UPDATE
  TO authenticated
  USING (
    author_user_id = auth.uid()
    OR public.is_staff_user()
  )
  WITH CHECK (
    author_user_id = auth.uid()
    OR public.is_staff_user()
  );

DROP POLICY IF EXISTS "Authenticated delete comments" ON public.comments;
CREATE POLICY "Author or staff deletes comments"
  ON public.comments FOR DELETE
  TO authenticated
  USING (
    author_user_id = auth.uid()
    OR public.is_staff_user()
  );

COMMENT ON COLUMN public.comments.author_user_id IS
  'Autor real (auth.users). Permite editar/eliminar solo los propios. NULL en comentarios legacy (solo staff los modera). Gap Tanda E.';
COMMENT ON COLUMN public.comments.attachment_path IS
  'Path en bucket support-ticket-attachments con prefijo comments/. PORTAL-013.';
