-- Disable both pilot flags and disconnect test clients before running manually.
-- Remove only the marked pilot policy/grants/role. Unexpected dependencies abort
-- the entire transaction; never use DROP OWNED, REASSIGN OWNED, or CASCADE here.
BEGIN;

DO $cleanup$
DECLARE
  receiver oid;
  pilot_policy oid;
BEGIN
  SELECT oid INTO receiver FROM pg_roles WHERE rolname = 'sb_realtime_receiver';
  IF receiver IS NULL THEN
    RETURN;
  END IF;
  IF shobj_description(receiver, 'pg_authid') IS DISTINCT FROM 'skillbridge-realtime-pilot-v1' THEN
    RAISE EXCEPTION 'Unmarked receiver role; refusing cleanup';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE oid = receiver
      AND (rolcanlogin OR rolinherit OR rolbypassrls OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication))
    OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member = receiver
      OR (roleid = receiver AND member <> (SELECT oid FROM pg_roles WHERE rolname = 'authenticator'))) THEN
    RAISE EXCEPTION 'Receiver attributes or memberships changed; refusing cleanup';
  END IF;
  SELECT oid INTO pilot_policy FROM pg_policy
    WHERE polrelid = to_regclass('realtime.messages') AND polname = 'sb_realtime_pilot_receive_v1';
  IF pilot_policy IS NOT NULL AND (
      obj_description(pilot_policy, 'pg_policy') IS DISTINCT FROM 'skillbridge-realtime-pilot-v1'
      OR EXISTS (SELECT 1 FROM pg_policy WHERE oid = pilot_policy
          AND (polcmd <> 'r' OR polroles <> ARRAY[receiver]))) THEN
    RAISE EXCEPTION 'Unmarked or changed pilot policy; refusing cleanup';
  END IF;
  IF pilot_policy IS NOT NULL THEN
    EXECUTE 'DROP POLICY sb_realtime_pilot_receive_v1 ON realtime.messages';
  END IF;
  EXECUTE 'REVOKE sb_realtime_receiver FROM authenticator';
  EXECUTE 'REVOKE SELECT ON TABLE realtime.messages FROM sb_realtime_receiver';
  EXECUTE 'REVOKE USAGE ON SCHEMA realtime FROM sb_realtime_receiver';
  EXECUTE 'DROP ROLE sb_realtime_receiver';
END
$cleanup$;

COMMIT;
