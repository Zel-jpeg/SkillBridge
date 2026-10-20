from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('api', '0019_remove_nlp_experiment')]

    operations = [migrations.AddField(
        model_name='combinedcompetencyprofile', name='ranking_input_fingerprint',
        field=models.CharField(blank=True, default='', max_length=64),
    )]
