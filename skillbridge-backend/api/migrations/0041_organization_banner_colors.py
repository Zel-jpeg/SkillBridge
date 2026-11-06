from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('api', '0040_organization_card_images')]

    operations = [
        migrations.AddField(model_name='institute', name='banner_color',
                            field=models.PositiveSmallIntegerField(blank=True, null=True)),
        migrations.AddField(model_name='program', name='banner_color',
                            field=models.PositiveSmallIntegerField(blank=True, null=True)),
        migrations.AddConstraint(model_name='institute', constraint=models.CheckConstraint(
            condition=models.Q(banner_color__isnull=True) | models.Q(banner_color__lte=11),
            name='institute_banner_color_range')),
        migrations.AddConstraint(model_name='program', constraint=models.CheckConstraint(
            condition=models.Q(banner_color__isnull=True) | models.Q(banner_color__lte=11),
            name='program_banner_color_range')),
    ]
