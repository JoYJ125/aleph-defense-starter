CREATE POLICY learning_memos_public_read
ON public.learning_memos
FOR SELECT
TO anon, authenticated
USING (true);