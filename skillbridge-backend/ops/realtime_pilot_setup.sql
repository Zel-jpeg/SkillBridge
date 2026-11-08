-- Manual, reviewed pilot provisioning only. Not a Django migration or startup hook.
-- Do not apply to the live project until trusted-key and effective-privilege checks pass.
-- No managed Realtime table/function is created, altered or dropped by this script.
BEGIN;

DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sb_realtime_receiver') THEN
    RAISE EXCEPTION 'Receiver role already exists; refusing to change an unknown role';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator' AND NOT rolinherit) THEN
    RAISE EXCEPTION 'Expected NOINHERIT authenticator role is absent';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = to_regclass('realtime.messages') AND relrowsecurity) THEN
    RAISE EXCEPTION 'Expected Realtime messages table with RLS is absent';
  END IF;
  IF to_regprocedure('realtime.topic()') IS NULL THEN
    RAISE EXCEPTION 'Expected Realtime topic helper is absent';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'realtime.messages'::regclass
      AND polname = 'sb_realtime_pilot_receive_v1') THEN
    RAISE EXCEPTION 'Pilot policy name already exists; refusing to replace it';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'realtime.messages'::regclass
      AND polpermissive AND polcmd IN ('r', '*') AND 0 = ANY(polroles)) THEN
    RAISE EXCEPTION 'Existing PUBLIC receive policy prevents isolated pilot access';
  END IF;
END
$guard$;

CREATE ROLE sb_realtime_receiver NOLOGIN NOINHERIT NOBYPASSRLS NOSUPERUSER
  NOCREATEDB NOCREATEROLE NOREPLICATION;
COMMENT ON ROLE sb_realtime_receiver IS 'skillbridge-realtime-pilot-v1';
GRANT USAGE ON SCHEMA realtime TO sb_realtime_receiver;
GRANT SELECT ON TABLE realtime.messages TO sb_realtime_receiver;
-- realtime.topic() already has PUBLIC EXECUTE in the audited project. Do not
-- grant on a managed function that the operator may not own.
GRANT sb_realtime_receiver TO authenticator;

CREATE POLICY sb_realtime_pilot_receive_v1 ON realtime.messages
  FOR SELECT TO sb_realtime_receiver
  USING (
    extension = 'broadcast'
    AND (SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role') = 'sb_realtime_receiver'
    AND (SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sb_topic') ~ '^sb-pilot:[a-f0-9]{64}$'
    AND (SELECT realtime.topic()) = (SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sb_topic')
    AND topic = (SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sb_topic')
    AND CASE
      WHEN (SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'exp') ~ '^[0-9]{1,12}$'
      THEN (SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'exp')::bigint) > extract(epoch FROM now())
      ELSE false
    END
  );
COMMENT ON POLICY sb_realtime_pilot_receive_v1 ON realtime.messages IS 'skillbridge-realtime-pilot-v1';

DO $verify$
BEGIN
  -- PUBLIC privileges are inherited even by a NOINHERIT role. Fail instead of
  -- revoking shared permissions or silently broadening application access.
  IF NOT has_function_privilege('sb_realtime_receiver', 'realtime.topic()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Receiver cannot use the audited Realtime topic helper';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE CASE WHEN n.nspname IN ('public', 'storage') AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
        THEN has_table_privilege('sb_realtime_receiver', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        ELSE false END)
    OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE CASE WHEN n.nspname IN ('public', 'storage') AND c.relkind = 'S'
        THEN has_sequence_privilege('sb_realtime_receiver', c.oid, 'USAGE,SELECT,UPDATE')
        ELSE false END)
    OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prosecdef
      AND has_function_privilege('sb_realtime_receiver', p.oid, 'EXECUTE')) THEN
    RAISE EXCEPTION 'Receiver inherits application/Storage access or a public definer function';
  END IF;
  IF has_table_privilege('sb_realtime_receiver', 'realtime.messages', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
    RAISE EXCEPTION 'Receiver has unexpected Realtime write privileges';
  END IF;
END
$verify$;

COMMIT;
