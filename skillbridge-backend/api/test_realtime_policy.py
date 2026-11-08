"""Model Realtime authorization only on explicitly owned local PostgreSQL.

These tests do not prove hosted JWT acceptance or managed-schema grant support.
The SQL under ops/ is never automatically applied to configured Supabase databases.
"""
from contextlib import contextmanager
import json
import os
from pathlib import Path
import time
from unittest import skipUnless, SkipTest

from django.db import connection, DatabaseError, transaction
from django.test import TransactionTestCase

OPS = Path(__file__).resolve().parents[1] / 'ops'
ROLE = 'sb_realtime_receiver'
TOPIC = 'sb-pilot:' + 'a' * 64
FOREIGN = 'sb-pilot:' + 'b' * 64


@skipUnless(connection.vendor == 'postgresql', 'PostgreSQL role/RLS semantics required')
class RealtimePolicyTests(TransactionTestCase):
    @classmethod
    def setUpClass(cls):
        if (connection.settings_dict.get('HOST') not in ('localhost', '127.0.0.1') or
                not os.environ.get('SB_TEST_DB_NAME', '').startswith('test_')):
            raise SkipTest('Requires an explicitly owned local PostgreSQL test cluster')
        super().setUpClass()

    def setUp(self):
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_roles WHERE rolname IN ('sb_realtime_receiver','authenticator','authenticated','anon')")
            self.assertIsNone(cursor.fetchone(), 'Refusing to modify preexisting test roles')
            cursor.execute("SELECT 1 FROM pg_namespace WHERE nspname IN ('realtime','storage')")
            self.assertIsNone(cursor.fetchone(), 'Refusing to modify preexisting schemas')
            cursor.execute('''
                CREATE ROLE authenticator NOLOGIN NOINHERIT;
                CREATE ROLE authenticated NOLOGIN NOINHERIT;
                CREATE ROLE anon NOLOGIN NOINHERIT;
                CREATE SCHEMA realtime;
                CREATE SCHEMA storage;
                CREATE TABLE realtime.messages (id integer PRIMARY KEY, topic text, extension text, payload jsonb);
                ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
                CREATE FUNCTION realtime.topic() RETURNS text LANGUAGE sql STABLE SECURITY INVOKER
                  AS $$ SELECT nullif(current_setting('realtime.topic', true), '')::text $$;
                CREATE TABLE public.sb_realtime_policy_app (id integer PRIMARY KEY, value text);
                CREATE TABLE storage.objects (id integer PRIMARY KEY, value text);
                GRANT USAGE ON SCHEMA public, storage TO authenticated, anon;
                GRANT ALL ON TABLE public.sb_realtime_policy_app, storage.objects TO authenticated, anon;
            ''')
            cursor.executemany('INSERT INTO realtime.messages VALUES (%s,%s,%s,%s)',
                [(1, TOPIC, 'broadcast', '{}'), (2, FOREIGN, 'broadcast', '{}'), (3, TOPIC, 'presence', '{}')])

    def tearDown(self):
        # Each fixture created these schemas/roles after proving their absence in
        # its own disposable cluster; no live/shared objects are being removed.
        connection.rollback()
        with connection.cursor() as cursor:
            cursor.execute('ROLLBACK')
            cursor.execute('RESET ROLE')
            cursor.execute('DROP SCHEMA realtime CASCADE; DROP SCHEMA storage CASCADE; DROP TABLE public.sb_realtime_policy_app')
            cursor.execute('REVOKE USAGE ON SCHEMA public FROM authenticated, anon')
            cursor.execute('DROP ROLE IF EXISTS sb_realtime_receiver; DROP ROLE authenticator; DROP ROLE authenticated; DROP ROLE anon')
        super().tearDown()

    def script(self, filename):
        try:
            with connection.cursor() as cursor:
                cursor.execute((OPS / filename).read_text(encoding='utf-8'))
        except DatabaseError:
            # The manual script owns an explicit SQL BEGIN even while Django
            # remains in autocommit mode; finish that SQL transaction explicitly.
            with connection.cursor() as cursor:
                cursor.execute('ROLLBACK')
            raise

    def setup_pilot(self):
        self.script('realtime_pilot_setup.sql')

    @contextmanager
    def receiver(self, claims=None, topic=TOPIC, role=ROLE):
        if claims is None:
            claims = {'role': ROLE, 'sb_topic': TOPIC, 'exp': int(time.time()) + 60}
        with transaction.atomic(), connection.cursor() as cursor:
            cursor.execute("SELECT set_config('role',%s,true), set_config('request.jwt.claims',%s,true), set_config('realtime.topic',%s,true)",
                           [role, json.dumps(claims), topic])
            yield cursor

    def read_ids(self, **options):
        with self.receiver(**options) as cursor:
            cursor.execute('SELECT id FROM realtime.messages ORDER BY id')
            return [row[0] for row in cursor.fetchall()]

    def test_only_own_topic_broadcast_rows_are_visible(self):
        self.setup_pilot()
        self.assertEqual(self.read_ids(), [1])
        self.assertEqual(self.read_ids(topic=FOREIGN), [])
        self.assertEqual(self.read_ids(claims={'role': ROLE, 'sb_topic': FOREIGN, 'exp': int(time.time()) + 60}, topic=FOREIGN), [2])

    def test_missing_malformed_expired_and_forged_role_claims_are_denied(self):
        self.setup_pilot()
        valid = {'role': ROLE, 'sb_topic': TOPIC, 'exp': int(time.time()) + 60}
        for claims in ({}, {**valid, 'sb_topic': None}, {**valid, 'sb_topic': 'sb-pilot:short'},
                       {**valid, 'sb_topic': 'sb-pilot:' + 'A' * 64},
                       {**valid, 'role': 'authenticated'}, {**valid, 'exp': 1},
                       {**valid, 'exp': 'invalid'}, {**valid, 'exp': None},
                       {**valid, 'exp': '9' * 30}, {**valid, 'exp': -1}):
            with self.subTest(claims=claims):
                self.assertEqual(self.read_ids(claims=claims), [])
        self.assertEqual(self.read_ids(topic=''), [])

    def test_receiver_attributes_and_memberships_do_not_inherit_application_roles(self):
        self.setup_pilot()
        with connection.cursor() as cursor:
            cursor.execute('''SELECT rolcanlogin, rolinherit, rolbypassrls, rolsuper,
                rolcreatedb, rolcreaterole, rolreplication FROM pg_roles WHERE rolname=%s''', [ROLE])
            self.assertEqual(cursor.fetchone(), (False,) * 7)
            cursor.execute('SELECT pg_has_role(%s,%s,\'MEMBER\'), pg_has_role(%s,%s,\'MEMBER\'), pg_has_role(%s,%s,\'MEMBER\')',
                           [ROLE, 'authenticated', ROLE, 'anon', 'authenticator', ROLE])
            self.assertEqual(cursor.fetchone(), (False, False, True))
        # Authenticator can explicitly select the receiver role for JWT requests.
        with transaction.atomic(), connection.cursor() as cursor:
            cursor.execute('SET LOCAL ROLE authenticator; SET LOCAL ROLE sb_realtime_receiver; SELECT current_user')
            self.assertEqual(cursor.fetchone()[0], ROLE)

    def test_application_storage_and_realtime_mutations_are_denied(self):
        self.setup_pilot()
        statements = [
            'SELECT * FROM public.sb_realtime_policy_app', 'SELECT * FROM storage.objects',
            "INSERT INTO realtime.messages VALUES (4,'synthetic','broadcast','{}')",
            "UPDATE realtime.messages SET payload='{}' WHERE id=1", 'DELETE FROM realtime.messages WHERE id=1',
            'TRUNCATE realtime.messages', 'CREATE TABLE realtime.unexpected (id integer)',
        ]
        for statement in statements:
            with self.subTest(statement=statement), self.assertRaises(DatabaseError):
                with self.receiver() as cursor:
                    cursor.execute(statement)
        for role in ('anon', 'authenticated'):
            with self.subTest(role=role), self.assertRaises(DatabaseError):
                self.read_ids(role=role)

    def test_setup_refuses_preexisting_role_without_changing_it(self):
        with connection.cursor() as cursor:
            cursor.execute("CREATE ROLE sb_realtime_receiver NOLOGIN; COMMENT ON ROLE sb_realtime_receiver IS 'unrelated-role'")
        with self.assertRaises(DatabaseError):
            self.setup_pilot()
        with connection.cursor() as cursor:
            cursor.execute("SELECT shobj_description(oid,'pg_authid') FROM pg_roles WHERE rolname=%s", [ROLE])
            self.assertEqual(cursor.fetchone()[0], 'unrelated-role')
        with self.assertRaises(DatabaseError):
            self.script('realtime_pilot_teardown.sql')

    def test_public_receive_policy_or_application_privilege_aborts_setup(self):
        with connection.cursor() as cursor:
            cursor.execute('CREATE POLICY unrelated_public_receive ON realtime.messages FOR SELECT TO PUBLIC USING (true)')
        with self.assertRaises(DatabaseError):
            self.setup_pilot()
        with connection.cursor() as cursor:
            cursor.execute('DROP POLICY unrelated_public_receive ON realtime.messages')
            cursor.execute('GRANT SELECT ON public.sb_realtime_policy_app TO PUBLIC')
        with self.assertRaises(DatabaseError):
            self.setup_pilot()
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1 FROM pg_roles WHERE rolname=%s', [ROLE])
            self.assertIsNone(cursor.fetchone())

    def test_teardown_removes_only_owned_objects_and_is_safe_to_repeat(self):
        self.setup_pilot()
        with connection.cursor() as cursor:
            cursor.execute('CREATE POLICY unrelated_authenticated ON realtime.messages FOR SELECT TO authenticated USING (false)')
        self.script('realtime_pilot_teardown.sql')
        self.script('realtime_pilot_teardown.sql')
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1 FROM pg_roles WHERE rolname=%s', [ROLE])
            self.assertIsNone(cursor.fetchone())
            cursor.execute("SELECT polname FROM pg_policy WHERE polrelid='realtime.messages'::regclass")
            self.assertEqual(cursor.fetchall(), [('unrelated_authenticated',)])

    def test_unknown_dependency_aborts_teardown_and_preserves_pilot_policy(self):
        self.setup_pilot()
        with connection.cursor() as cursor:
            cursor.execute('GRANT SELECT ON public.sb_realtime_policy_app TO sb_realtime_receiver')
        with self.assertRaises(DatabaseError):
            self.script('realtime_pilot_teardown.sql')
        self.assertEqual(self.read_ids(), [1])
        with connection.cursor() as cursor:
            cursor.execute('REVOKE SELECT ON public.sb_realtime_policy_app FROM sb_realtime_receiver')
        self.script('realtime_pilot_teardown.sql')

    def test_changed_role_membership_aborts_teardown(self):
        self.setup_pilot()
        with connection.cursor() as cursor:
            cursor.execute('GRANT sb_realtime_receiver TO authenticated')
        with self.assertRaises(DatabaseError):
            self.script('realtime_pilot_teardown.sql')
        self.assertEqual(self.read_ids(), [1])
        with connection.cursor() as cursor:
            cursor.execute('REVOKE sb_realtime_receiver FROM authenticated')
        self.script('realtime_pilot_teardown.sql')
