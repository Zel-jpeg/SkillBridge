"""Private, backend-authorized evidence. Never use the public branding bucket."""
from io import BytesIO
import re
from urllib.parse import quote, urlsplit
from uuid import uuid4
import warnings

from django.conf import settings
from PIL import Image, ImageOps, UnidentifiedImageError
import requests
from rest_framework.exceptions import APIException, ValidationError

MAX_OUTPUT = 512 * 1024


class EvidenceUnavailable(APIException):
    status_code = 503
    default_detail = {'error': 'Private evidence storage is unavailable. Your request was not changed. Please retry.'}


def convert_evidence(upload):
    if upload.size > 5 * 1024 * 1024:
        raise ValidationError({'error': 'Evidence image must be at most 5 MiB.'})
    raw = upload.read(5 * 1024 * 1024 + 1)
    if len(raw) > 5 * 1024 * 1024:
        raise ValidationError({'error': 'Evidence image must be at most 5 MiB.'})
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(BytesIO(raw)) as source:
                if source.format not in ('JPEG', 'PNG', 'WEBP') or getattr(source, 'n_frames', 1) != 1:
                    raise ValueError()
                if source.width * source.height > 20_000_000 or max(source.size) > 10_000:
                    raise ValueError()
                source.verify()
            with Image.open(BytesIO(raw)) as source:
                oriented = ImageOps.exif_transpose(source).convert('RGB')
                oriented.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
                clean = Image.new('RGB', oriented.size)
                clean.paste(oriented)
            for side, quality in ((1600, 85), (1600, 70), (1280, 80), (1280, 65), (1024, 70)):
                candidate = clean.copy()
                candidate.thumbnail((side, side), Image.Resampling.LANCZOS)
                output = BytesIO()
                candidate.save(output, 'WEBP', quality=quality, method=4, exif=b'', icc_profile=b'', xmp=b'')
                if output.tell() <= MAX_OUTPUT:
                    return output.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ValidationError({'error': 'Use a valid static JPEG, PNG or WebP image, at most 20 megapixels and 10,000 pixels per side.'}) from None
    raise ValidationError({'error': 'Image is too complex to compress clearly. Please crop it and retry.'})


def storage(method, suffix, **kwargs):
    base = settings.SUPABASE_STORAGE_URL.rstrip('/')
    parsed = urlsplit(base)
    bucket = settings.RETAKE_EVIDENCE_BUCKET
    if (parsed.scheme != 'https' or not parsed.netloc or parsed.path not in ('', '/') or
            parsed.username or parsed.password or parsed.query or parsed.fragment or
            not settings.SUPABASE_STORAGE_SERVICE_KEY or not re.fullmatch(r'[a-z0-9][a-z0-9-]*', bucket) or
            bucket == settings.COMPANY_IMAGE_BUCKET):
        raise EvidenceUnavailable()
    try:
        result = requests.request(method, f'{base}/storage/v1/{suffix}', headers={
            'Authorization': f'Bearer {settings.SUPABASE_STORAGE_SERVICE_KEY}',
            'apikey': settings.SUPABASE_STORAGE_SERVICE_KEY,
            **kwargs.pop('headers', {}),
        }, timeout=(3.05, 10), allow_redirects=False, **kwargs)
        result.raise_for_status()
        if not 200 <= result.status_code < 300:
            raise EvidenceUnavailable()
        return result
    except requests.RequestException:
        raise EvidenceUnavailable() from None


def private_bucket():
    result = storage('GET', f'bucket/{quote(settings.RETAKE_EVIDENCE_BUCKET, safe="")}')
    try:
        if result.json().get('public') is not False:
            raise EvidenceUnavailable()
    except (ValueError, AttributeError):
        raise EvidenceUnavailable() from None


def owned_key(key):
    return bool(re.fullmatch(r'retakes/[0-9a-f]{32}\.webp', key or ''))


def upload(content):
    private_bucket()  # Fail closed if a bucket was accidentally made public.
    key = f'retakes/{uuid4().hex}.webp'
    try:
        storage('POST', f'object/{quote(settings.RETAKE_EVIDENCE_BUCKET, safe="")}/{key}',
                data=content, headers={'Content-Type': 'image/webp', 'Cache-Control': 'no-store', 'x-upsert': 'false'})
    except Exception:
        cleanup(key)
        raise
    return key


def download(key):
    if not owned_key(key):
        raise EvidenceUnavailable()
    private_bucket()
    result = storage('GET', f'object/authenticated/{quote(settings.RETAKE_EVIDENCE_BUCKET, safe="")}/{key}')
    if len(result.content) > MAX_OUTPUT:
        raise EvidenceUnavailable()
    return result.content


def cleanup(key):
    if not owned_key(key):
        return
    from .models import StudentResponse, AssessmentAttemptHistory
    if StudentResponse.objects.filter(retake_image_key=key).exists() or AssessmentAttemptHistory.objects.filter(retake_request__image_key=key).exists():
        return
    try:
        storage('DELETE', f'object/{quote(settings.RETAKE_EVIDENCE_BUCKET, safe="")}', json={'prefixes': [key]})
    except EvidenceUnavailable:
        # No credentials, student details or image contents in logs.
        import logging
        logging.getLogger(__name__).error('Unreferenced retake evidence cleanup needs operator attention.')
