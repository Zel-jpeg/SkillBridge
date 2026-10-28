"""Run as a dedicated worker; never start a daemon thread in a web request."""
import time
from django.core.management.base import BaseCommand, CommandError
from django.db import close_old_connections
from api.email_outbox import email_storage_ready, process_one


class Command(BaseCommand):
    help = 'Process saved email jobs. Use --once for a bounded scheduled run.'

    def add_arguments(self, parser):
        parser.add_argument('--once', action='store_true')
        parser.add_argument('--limit', type=int, default=100)
        parser.add_argument('--poll-seconds', type=float, default=5)

    def handle(self, *args, **options):
        if not 1 <= options['limit'] <= 1000 or not 1 <= options['poll_seconds'] <= 300:
            raise CommandError('Use a limit of 1–1000 and a poll interval of 1–300 seconds.')
        if not email_storage_ready():
            raise CommandError('Email delivery setup is pending. Apply backend migration 0027 before starting the worker.')
        try:
            while True:
                close_old_connections()
                processed = 0
                for _ in range(options['limit']):
                    if not process_one():
                        break
                    processed += 1
                if options['once']:
                    self.stdout.write(f'Processed {processed} saved email jobs.')
                    return
                time.sleep(options['poll_seconds'])
        except KeyboardInterrupt:
            self.stdout.write('Email worker stopped; pending jobs remain saved.')
