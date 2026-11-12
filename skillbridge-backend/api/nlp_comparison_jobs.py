"""Durable queue for the administrator's synthetic workflow comparison."""
from datetime import timedelta
import logging

from django.db import transaction
from django.utils import timezone

from .models import NlpComparisonJob, RecommendationConfiguration
from .nlp_workflow_evaluation import run_workflow_comparison
from .recommendation_nlp import MODEL_OPTIONS

logger = logging.getLogger(__name__)
MODEL_LIMIT_SECONDS = 5 * 60
RUN_LIMIT_SECONDS = MODEL_LIMIT_SECONDS * len(MODEL_OPTIONS)
ACTIVE = ('queued', 'running')


def expire_jobs():
    now = timezone.now()
    NlpComparisonJob.objects.filter(
        status='running', started_at__lt=now - timedelta(seconds=RUN_LIMIT_SECONDS + 60),
    ).update(status='failed', progress='The comparison worker stopped. Start a new run.', finished_at=now)
    NlpComparisonJob.objects.filter(
        status='queued', created_at__lt=now - timedelta(hours=1),
    ).update(status='failed', progress='The comparison worker did not pick up the job. Check the worker service.', finished_at=now)


def enqueue(program_scope):
    expire_jobs()
    NlpComparisonJob.objects.filter(finished_at__lt=timezone.now() - timedelta(days=1)).delete()
    job, _ = NlpComparisonJob.objects.filter(status__in=ACTIVE).get_or_create(program_scope=program_scope)
    return job


@transaction.atomic
def claim_next_job():
    job = (NlpComparisonJob.objects.select_for_update(skip_locked=True).filter(status='queued')
           .order_by('created_at', 'id').first())
    if job:
        job.status = 'running'
        job.started_at = timezone.now()
        job.save(update_fields=['status', 'started_at'])
    return job


def fail_job(job_id, message):
    NlpComparisonJob.objects.filter(pk=job_id, status='running').update(
        status='failed', progress=message, finished_at=timezone.now(),
    )


def report_progress(job_id, message):
    logger.warning('NLP comparison %s: %s', job_id, message)
    NlpComparisonJob.objects.filter(pk=job_id, status='running').update(progress=message)


def execute_job(job, run_model):
    job_id = job.pk
    current = NlpComparisonJob.objects.filter(pk=job_id, status='running')
    result = run_workflow_comparison(job.program_scope, balanced_subset=True, model_ids=())
    result['timing_note'] += ' Each hosted model has five minutes to load and finish evaluation.'
    for model_id in MODEL_OPTIONS:
        result['models'].append(run_model(job, model_id))
    result['active_model'] = (RecommendationConfiguration.objects.filter(pk=1)
                              .values_list('active_model', flat=True).first() or 'spacy_md')
    finished = timezone.now()
    result['evaluated_at'] = finished.isoformat()
    current.update(status='complete', result=result, progress='', finished_at=finished)
