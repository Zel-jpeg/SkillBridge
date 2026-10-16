from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [('api', '0012_user_unique_populated_school_id_and_more')]
    operations = [migrations.CreateModel(
        name='ChangeEvent',
        fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('payload', models.JSONField(default=dict)),
            ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
            ('recipient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
        ],
        options={'indexes': [models.Index(fields=['recipient', 'id'], name='change_recipient_cursor_idx')]},
    )]
