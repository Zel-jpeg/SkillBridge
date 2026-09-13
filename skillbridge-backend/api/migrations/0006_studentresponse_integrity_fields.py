from django.db import migrations, models


def mark_existing_submissions(apps, schema_editor):
    StudentResponse = apps.get_model('api', 'StudentResponse')
    StudentResponse.objects.filter(submitted_at__isnull=False).update(status='submitted')


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0005_studentresponse_question_layout'),
    ]

    operations = [
        migrations.AddField(
            model_name='studentresponse',
            name='status',
            field=models.CharField(
                choices=[
                    ('in_progress', 'In progress'),
                    ('submitted', 'Submitted'),
                    ('stopped', 'Stopped'),
                ],
                default='in_progress',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='studentresponse',
            name='stopped_reason',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
        migrations.AddField(
            model_name='studentresponse',
            name='stopped_reason_display',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='studentresponse',
            name='stopped_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='studentresponse',
            name='violation_count',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='studentresponse',
            name='violation_events',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='studentresponse',
            name='is_flagged',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(mark_existing_submissions, migrations.RunPython.noop),
    ]
