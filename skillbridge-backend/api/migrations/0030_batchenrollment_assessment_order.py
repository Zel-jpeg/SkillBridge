from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('api', '0029_recommendation_cycle_scope')]

    operations = [
        migrations.AddField(
            model_name='batchenrollment', name='assessment_order',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
