from django.db import migrations, models
from django.db.migrations.exceptions import IrreversibleError


def protect_decision_history(apps, schema_editor):
    rows = apps.get_model('api', 'OJTPlacement').objects.using(schema_editor.connection.alias)
    if rows.filter(status='approved').values('student_id').annotate(n=models.Count('id')).filter(n__gt=1).exists():
        raise IrreversibleError('Multiple batch approvals are preserved. Use a forward recovery; do not discard decision history to restore the old global constraint.')


class Migration(migrations.Migration):
    dependencies = [('api', '0028_ojt_cycle_lifecycle')]

    operations = [
        migrations.RemoveConstraint(model_name='ojtplacement', name='unique_approved_placement_per_student'),
        migrations.AddConstraint(model_name='ojtplacement', constraint=models.UniqueConstraint(
            fields=('student', 'batch'), condition=models.Q(status='approved', batch__isnull=False),
            name='unique_approved_student_batch')),
        migrations.AddConstraint(model_name='ojtplacement', constraint=models.UniqueConstraint(
            fields=('student',), condition=models.Q(status='approved', batch__isnull=True),
            name='unique_detached_approved_student')),
        migrations.AlterField(model_name='ojtplacement', name='status', field=models.CharField(
            choices=[('suggested', 'Suggested'), ('approved', 'Approved'), ('completed', 'Legacy record'),
                     ('removed', 'Removed'), ('rejected', 'Rejected')], default='suggested', max_length=20)),
        migrations.RunPython(migrations.RunPython.noop, protect_decision_history),
    ]
