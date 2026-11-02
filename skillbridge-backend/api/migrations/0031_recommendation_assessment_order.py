from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('api', '0030_batchenrollment_assessment_order')]

    operations = [
        migrations.AddField(model_name='recommendation', name='assessment_rank',
                            field=models.PositiveIntegerField(blank=True, null=True)),
        migrations.AddField(model_name='recommendation', name='assessment_details',
                            field=models.JSONField(blank=True, default=dict)),
    ]
