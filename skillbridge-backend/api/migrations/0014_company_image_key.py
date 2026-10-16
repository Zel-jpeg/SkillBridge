from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('api', '0013_changeevent')]
    operations = [migrations.AddField(
        model_name='company', name='image_key',
        field=models.CharField(max_length=255, blank=True, default=''),
    )]
