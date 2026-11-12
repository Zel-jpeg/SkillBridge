"""Process synthetic comparison jobs independently of Gunicorn."""
import json
import logging
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import time

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import close_old_connections

from api.models import NlpComparisonJob
from api.nlp_comparison_jobs import MODEL_LIMIT_SECONDS, claim_next_job, execute_job, expire_jobs, fail_job, report_progress
from api.nlp_workflow_evaluation import run_workflow_comparison
from api.recommendation_nlp import MODEL_OPTIONS

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Process queued admin NLP comparisons in a dedicated service.'

    def add_arguments(self, parser):
        parser.add_argument('--once', action='store_true')
        parser.add_argument('--job-id', help='Internal child process entry point.')
        parser.add_argument('--model-id', choices=tuple(MODEL_OPTIONS))
        parser.add_argument('--output', type=Path)

    def handle(self, *args, **options):
        if options['job_id']:
            job = NlpComparisonJob.objects.get(pk=options['job_id'], status='running')
            result = run_workflow_comparison(job.program_scope, balanced_subset=True,
                model_ids=(options['model_id'],), progress=lambda message: report_progress(job.pk, message))
            options['output'].write_text(json.dumps(result['models'][0]), encoding='utf-8')
            return

        self.stdout.write('NLP comparison worker ready.')
        while True:
            close_old_connections()
            expire_jobs()
            job = claim_next_job()
            if job:
                try:
                    execute_job(job, self.run_model)
                except Exception:
                    logger.exception('NLP comparison job failed for %s', job.pk)
                    fail_job(job.pk, 'The comparison worker failed. Check the worker logs before retrying.')
            if options['once']:
                return
            if not job:
                time.sleep(3)

    def run_model(self, job, model_id):
        model = {'id': model_id, **MODEL_OPTIONS[model_id], 'metrics': None}
        report_progress(job.pk, f'Preparing {model["label"]}…')
        try:
            with TemporaryDirectory(prefix='skillbridge-model-') as directory:
                output = Path(directory) / 'result.json'
                command = [sys.executable, str(settings.BASE_DIR / 'manage.py'), 'process_nlp_comparisons',
                           '--job-id', str(job.pk), '--model-id', model_id, '--output', str(output)]
                subprocess.run(command, timeout=MODEL_LIMIT_SECONDS, check=True)
                return json.loads(output.read_text(encoding='utf-8'))
        except subprocess.TimeoutExpired:
            report_progress(job.pk, f'{model["label"]} exceeded the five-minute limit.')
            return {**model, 'status': 'timed_out', 'limit_seconds': MODEL_LIMIT_SECONDS,
                    'message': 'Loading and evaluation exceeded the five-minute limit on this worker.'}
        except (subprocess.CalledProcessError, OSError, ValueError):
            logger.exception('NLP comparison subprocess failed for %s (%s)', job.pk, model_id)
            return {**model, 'status': 'error', 'message': 'The model process failed. Check the worker logs.'}
