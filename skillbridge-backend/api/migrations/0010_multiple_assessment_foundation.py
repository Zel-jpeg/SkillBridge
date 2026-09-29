from django.db import migrations, models


def migrate_publication_state(apps, schema_editor):
    Assessment = apps.get_model('api', 'Assessment')
    Assessment.objects.filter(is_active=False).update(publication_status='closed')


def reverse_publication_state(apps, schema_editor):
    # The old flag is retained and synchronized, so no record change is needed.
    pass


class Migration(migrations.Migration):
    dependencies = [('api', '0009_add_ojt_placement')]

    operations = [
        migrations.AddField(model_name='assessment', name='publication_status', field=models.CharField(choices=[('draft', 'Draft'), ('published', 'Published'), ('closed', 'Closed')], default='published', max_length=20)),
        migrations.AddField(model_name='assessment', name='is_required', field=models.BooleanField(default=True)),
        migrations.AddField(model_name='assessment', name='include_in_competency', field=models.BooleanField(default=True)),
        migrations.AddField(model_name='assessment', name='display_order', field=models.PositiveIntegerField(default=0)),
        migrations.AddField(model_name='assessment', name='available_at', field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name='assessment', name='due_at', field=models.DateTimeField(blank=True, null=True)),
        migrations.RunPython(migrate_publication_state, reverse_publication_state),
    ]
