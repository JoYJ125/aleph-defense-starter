REVOKE ALL PRIVILEGES ON TABLE public.learning_memos
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.learning_memos
TO authenticated;

DROP POLICY IF EXISTS learning_memos_select_own
ON public.learning_memos;
CREATE POLICY learning_memos_select_own
ON public.learning_memos
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = owner_id);

DROP POLICY IF EXISTS learning_memos_insert_own
ON public.learning_memos;
CREATE POLICY learning_memos_insert_own
ON public.learning_memos
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = owner_id);

DROP POLICY IF EXISTS learning_memos_update_own
ON public.learning_memos;
CREATE POLICY learning_memos_update_own
ON public.learning_memos
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = owner_id)
WITH CHECK ((SELECT auth.uid()) = owner_id);

DROP POLICY IF EXISTS learning_memos_delete_own
ON public.learning_memos;
CREATE POLICY learning_memos_delete_own
ON public.learning_memos
FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = owner_id);