from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import ChangeEvent


class Command(BaseCommand):
    help = 'Delete invalidation metadata older than one day. Reconnect always resynchronizes.'

    def handle(self, *args, **options):
        count, _ = ChangeEvent.objects.filter(created_at__lt=timezone.now() - timedelta(days=1)).delete()
        self.stdout.write(f'Deleted {count} expired change events.')
