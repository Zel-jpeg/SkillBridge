from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('api', '0014_company_image_key')]
    operations = [migrations.AddField(model_name='user', name='department',
        field=models.CharField(blank=True, default='Institute of Computing', max_length=255))]
