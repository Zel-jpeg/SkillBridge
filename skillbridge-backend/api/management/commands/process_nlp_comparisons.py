"""Process synthetic comparison jobs independently of Gunicorn."""
import logging
import subprocess
import sys
import time

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import close_old_connections

from api.nlp_comparison_jobs import RUN_LIMIT_SECONDS, claim_next_job, execute_job, expire_jobs, fail_job

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Process queued admin NLP comparisons in a dedicated service.'

    def add_arguments(self, parser):
        parser.add_argument('--once', action='store_true')
        parser.add_argument('--job-id', help='Internal child process entry point.')

    def handle(self, *args, **options):
        if options['job_id']:
            execute_job(options['job_id'])
            return

        self.stdout.write('NLP comparison worker ready.')
        while True:
            close_old_connections()
            expire_jobs()
            job = claim_next_job()
            if job:
                self.run_job(job)
            if options['once']:
                return
            if not job:
                time.sleep(3)

    def run_job(self, job):
        command = [sys.executable, str(settings.BASE_DIR / 'manage.py'), 'process_nlp_comparisons',
                   '--job-id', str(job.pk)]
        try:
            subprocess.run(command, timeout=RUN_LIMIT_SECONDS, check=True)
        except subprocess.TimeoutExpired:
            logger.warning('NLP comparison %s exceeded the worker limit', job.pk)
            fail_job(job.pk, 'The comparison exceeded the 15-minute worker limit. Check the worker logs.')
        except (subprocess.CalledProcessError, OSError):
            logger.exception('NLP comparison subprocess failed for %s', job.pk)
            fail_job(job.pk, 'The comparison worker failed. Check the worker logs before retrying.')
