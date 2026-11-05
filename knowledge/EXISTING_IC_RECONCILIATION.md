# Existing IC reconciliation

The one-time reconciliation links a confirmed existing cohort to the regular
Institute of Computing entry. It links qualifying student profiles to BSIT or
BSIS, using the full program labels or their unambiguous codes and a matching
department label. The previous department default by itself supplies no evidence.
Conflicting enrollments, unknown labels and empty or partially unconfirmed
rosters stay available for administrator review with their original data.
The catalog uses the names on the [DNSC program offerings page](https://dnsc.edu.ph/program-offerings/).

Existing batches retain ownership and their active or archived status. Their
batch program and framework remain unset so prior assessments, category IDs,
recommendations, approved placements and capacity follow the rules under which
they were recorded. A mixed batch remains a single batch. Administrators can
find it by institute in Batches & students, and authorized staff can select IC
in Reports & Analytics. Student profiles show their linked program.

The reconciliation creates the confirmed IC, BSIT and BSIS catalog entries only
when there are confirmed records to link and the corresponding entries are
missing. It preserves existing catalog entries, instructor ownership and program
grants. Administrators can grant program catalog access through the regular
assignment screen if IC staff need to create new scoped work. Creating a new
batch still requires one program.

## Operator

Use the configured database environment with the approved PostgreSQL tools.
The default review uses a read-only transaction and prints only aggregate
counts, review buckets and fingerprints. Review those counts against the
known scope before using the apply command. Existing values and identifiers are
kept out of the operator output.

```powershell
python scripts/migrate_organization_catalog.py --reconcile-ic
python scripts/migrate_organization_catalog.py --reconcile-ic --apply --expected-target <target-fingerprint> --expected-plan <mapping-fingerprint>
```

Apply requires an up-to-date schema, an exact private public-schema backup
restored into an owned loopback PostgreSQL cluster, and a successful rehearsal on
that restore. The live transaction locks the mapping tables, rechecks the
reviewed mapping, and verifies all unrelated data against its own consistent
snapshot. This preserves unrelated activity that occurred after the backup.
Use the private backup and the operator receipt under ignored `work/` for recovery
verification. The
operator does not regrade, recalculate or send notifications.

See the [implementation tracker](MULTI_INSTITUTE_IMPLEMENTATION_TRACKER.md) for
the test and configured reconciliation receipts.
