import uuid

from django.db import migrations, models


def protect_comparison_jobs(apps, schema_editor):
    if schema_editor.connection.vendor == 'postgresql':
        schema_editor.execute('ALTER TABLE api_nlpcomparisonjob ENABLE ROW LEVEL SECURITY')


class Migration(migrations.Migration):
    dependencies = [('api', '0043_institute_shared_skills')]

    operations = [
        migrations.CreateModel(
            name='NlpComparisonJob',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('program_scope', models.CharField(max_length=12)),
                ('status', models.CharField(db_index=True, default='queued', max_length=10)),
                ('progress', models.CharField(blank=True, max_length=100)),
                ('result', models.JSONField(null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('started_at', models.DateTimeField(null=True)),
                ('finished_at', models.DateTimeField(null=True)),
            ],
            options={'constraints': [models.UniqueConstraint(
                fields=('program_scope',), condition=models.Q(status__in=['queued', 'running']),
                name='unique_active_nlp_comparison_scope',
            )]},
        ),
        migrations.RunPython(protect_comparison_jobs, migrations.RunPython.noop),
    ]
