# Database connection troubleshooting

When `python manage.py runserver` prints `System check identified no issues`
without reaching `Starting development server`, Django may be waiting for its
database migration check. Passing system checks does not establish that the
configured PostgreSQL server is reachable.

The backend sets PostgreSQL's `connect_timeout` to five seconds by default.
Override it with `DB_CONNECT_TIMEOUT` in the backend environment. The limit
applies separately to each resolved server address: three unreachable addresses
can take about fifteen seconds, plus DNS resolution and other startup work.
It bounds connection attempts; it does not repair connectivity or limit queries.

## Supabase checks

1. Confirm the project is healthy and a `SELECT 1` query succeeds in its SQL
   editor. The dashboard uses a different connection path from local Django.
2. Open **Connect** and compare the session pooler's host, port, database and
   username with the backend's `DB_HOST`, `DB_PORT`, `DB_NAME` and `DB_USER`.
   Copy the supplied host rather than constructing one from the project region.
   Session pooling supports IPv4; the usual direct endpoint requires IPv6 unless
   the project has the IPv4 add-on. Keep passwords out of screenshots and logs.
3. In **Database Settings**, review **Network Restrictions** and banned IPs.
   If an allowlist is configured, ensure the current development network is
   included without removing existing access rules. Review any ban before
   unbanning the relevant address. These changes require an authorized owner.
4. If TCP connects but PostgreSQL's initial SSL request receives no response,
   a successful port test alone has not established a usable database connection.
   Check VPN routing, security software and network filtering. Try another
   network; request a targeted application/endpoint exception if filtering is
   confirmed. The same symptom on multiple networks does not identify the cause.
5. Retry the server after resolving connectivity. Do not skip migration checks
   or run migrations as a workaround for an unreachable database.

An SQL editor query succeeding does not validate the password in the local
environment. A connection that stalls before authentication does not establish
that the password is incorrect either.

References: [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres),
[network restrictions](https://supabase.com/docs/guides/platform/network-restrictions),
[IP bans](https://supabase.com/docs/guides/troubleshooting/error-connection-refused-when-trying-to-connect-to-supabase-database-hwG0Dr),
and [libpq connection parameters](https://www.postgresql.org/docs/current/libpq-connect.html).
