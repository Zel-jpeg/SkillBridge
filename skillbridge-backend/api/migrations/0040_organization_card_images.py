from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('api', '0039_coordinator_catalog_authority')]

    operations = [
        migrations.AddField(model_name='institute', name='image_key', field=models.CharField(blank=True, max_length=120, null=True)),
        migrations.AddField(model_name='program', name='image_key', field=models.CharField(blank=True, max_length=120, null=True)),
    ]
