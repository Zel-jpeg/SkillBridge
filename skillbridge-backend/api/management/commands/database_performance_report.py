"""Read-only PostgreSQL schema/maintenance evidence without business records."""
import json

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.db.migrations.executor import MigrationExecutor


class Command(BaseCommand):
    help = 'Report PostgreSQL indexes, table statistics and pending migrations; never run maintenance.'

    def handle(self, *args, **options):
        if connection.vendor != 'postgresql':
            raise CommandError('This report requires PostgreSQL.')
        # Bound each statement and ensure even accidental future writes fail.
        with transaction.atomic(), connection.cursor() as cursor:
            cursor.execute('SET LOCAL transaction_read_only = on')
            cursor.execute("SET LOCAL statement_timeout = '5s'")
            cursor.execute('SHOW server_version')
            version = cursor.fetchone()[0]
            cursor.execute('SHOW max_connections')
            max_connections = int(cursor.fetchone()[0])
            cursor.execute("SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()")
            connections = cursor.fetchone()[0]
            cursor.execute("""SELECT tablename, indexname, indexdef FROM pg_indexes
                WHERE schemaname = 'public' AND tablename LIKE 'api_%%'
                ORDER BY tablename, indexname""")
            indexes = [dict(zip(('table', 'name', 'definition'), row)) for row in cursor.fetchall()]
            cursor.execute("""SELECT relname, n_live_tup, n_dead_tup, seq_scan, idx_scan,
                last_autovacuum, last_autoanalyze, last_vacuum, last_analyze,
                pg_total_relation_size(relid)
                FROM pg_stat_user_tables WHERE schemaname = 'public' AND relname LIKE 'api_%%'
                ORDER BY relname""")
            keys = ('table', 'estimated_live_rows', 'estimated_dead_rows', 'sequential_scans', 'index_scans',
                    'last_autovacuum', 'last_autoanalyze', 'last_vacuum', 'last_analyze', 'total_bytes')
            tables = [dict(zip(keys, row)) for row in cursor.fetchall()]
            executor = MigrationExecutor(connection)
            pending = [f'{migration.app_label}.{migration.name}' for migration, _ in
                       executor.migration_plan(executor.loader.graph.leaf_nodes())]
        self.stdout.write(json.dumps({
            'postgresql_version': version, 'server_max_connections': max_connections,
            'visible_current_database_connections': connections,
            'django_conn_max_age': connection.settings_dict.get('CONN_MAX_AGE', 0),
            'pending_migrations': pending, 'indexes': indexes, 'tables': tables,
            'limits': ['Statistics are estimates/cumulative since their reset, not latency measurements.',
                       'Server limits do not establish external pooler limits or Railway capacity.',
                       'No record data, SQL activity text, credentials or connection addresses are included.',
                       'No EXPLAIN workload, ANALYZE, VACUUM, index creation, migration or deletion is run.'],
        }, default=str, indent=2))
