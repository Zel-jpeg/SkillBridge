"""Patch PostgreSQL IO in gevent workers before Django opens any connections."""


def post_fork(server, worker):
    from psycogreen.gevent import patch_psycopg
    patch_psycopg()
