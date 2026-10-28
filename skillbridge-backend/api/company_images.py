"""Company branding only. Originals never leave Django; provider photos stay remote."""
from io import BytesIO
import json
import logging
import math
import re
from urllib.parse import quote, urlsplit
from uuid import uuid4
import warnings

from django.conf import settings
from django.db import transaction
from PIL import Image, ImageOps, UnidentifiedImageError, features
import requests
from rest_framework.exceptions import APIException

MAX_INPUT_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 20_000_000
MAX_INPUT_SIDE = 10_000
MAX_OUTPUT_SIDE = 512
MAX_OUTPUT_BYTES = 200 * 1024
# At most nine encodes, with progressively smaller dimensions; never upscale.
ENCODING_STEPS = ((512, 85), (512, 70), (512, 55), (384, 75), (384, 55),
                  (256, 70), (256, 50), (128, 60), (128, 40))
STORAGE_TIMEOUT = (3.05, 10)
logger = logging.getLogger(__name__)


class ImageValidationError(APIException):
    status_code = 400

    def __init__(self, message):
        super().__init__({'error': message})


class ImageStorageError(APIException):
    status_code = 503

    def __init__(self):
        super().__init__({'error': 'Partner image storage is unavailable. Your changes were not saved. Please retry.'})


def convert_company_image(upload):
    if upload.size > MAX_INPUT_BYTES:
        raise ImageValidationError('Partner image must be at most 5 MiB.')
    raw = upload.read(MAX_INPUT_BYTES + 1)
    if len(raw) > MAX_INPUT_BYTES:
        raise ImageValidationError('Partner image must be at most 5 MiB.')
    if not features.check('webp'):
        raise ImageStorageError()
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(BytesIO(raw)) as source:
                if source.format not in ('JPEG', 'PNG', 'WEBP'):
                    raise ImageValidationError('Use a static JPEG, PNG, or WebP image. SVG is not supported.')
                width, height = source.size
                if width * height > MAX_PIXELS or max(width, height) > MAX_INPUT_SIDE:
                    raise ImageValidationError('Partner image must be at most 20 megapixels and 10,000 pixels per side.')
                if getattr(source, 'n_frames', 1) != 1 or getattr(source, 'is_animated', False):
                    raise ImageValidationError('Animated or multiframe partner images are not supported.')
                source.verify()
            with Image.open(BytesIO(raw)) as source:
                source.load()
                oriented = ImageOps.exif_transpose(source)
                mode = 'RGBA' if 'A' in oriented.getbands() or 'transparency' in oriented.info else 'RGB'
                converted = oriented.convert(mode)
                converted.thumbnail((MAX_OUTPUT_SIDE, MAX_OUTPUT_SIDE), Image.Resampling.LANCZOS)
                # A fresh pixel-only image drops EXIF, ICC, XMP, comments and DPI.
                clean = Image.new(mode, converted.size)
                clean.paste(converted)
        for side, quality in ENCODING_STEPS:
            candidate = clean.copy()
            candidate.thumbnail((side, side), Image.Resampling.LANCZOS)
            output = BytesIO()
            candidate.save(output, format='WEBP', quality=quality, method=4,
                           exif=b'', icc_profile=b'', xmp=b'')
            encoded = output.getvalue()
            if len(encoded) <= MAX_OUTPUT_BYTES:
                return encoded
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError,
            Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise ImageValidationError('Partner image is corrupt or cannot be decoded safely.') from exc
    raise ImageValidationError('Partner image cannot fit within 200 KiB. Please choose a simpler image.')


def company_data(request):
    """Multipart uses one JSON envelope, preserving nulls, arrays and objects."""
    if request.content_type.startswith('multipart/'):
        if 'payload' in request.data:
            if set(request.data) - {'payload', 'image'} or len(request.data.getlist('payload')) != 1:
                raise ImageValidationError('Send one JSON payload field and an optional image file.')
            try:
                data = json.loads(request.data['payload'])
            except (ValueError, TypeError) as exc:
                raise ImageValidationError('payload must contain valid JSON.') from exc
        else:
            # Legacy no-file form callers remain valid. Structured form values
            # are explicitly JSON-decoded rather than stored as opaque strings.
            if request.FILES or any(len(request.data.getlist(k)) != 1 for k in request.data):
                raise ImageValidationError('Image uploads require one JSON payload field.')
            data = request.data.dict()
            for field in ('address', 'positions'):
                if field in data:
                    try:
                        data[field] = json.loads(data[field])
                    except (ValueError, TypeError) as exc:
                        raise ImageValidationError(f'{field} must contain valid JSON.') from exc
            for field in ('lat', 'lng'):
                if data.get(field) in ('', 'null'):
                    data[field] = None
    else:
        data = request.data
    if not isinstance(data, dict):
        raise ImageValidationError('Partner details must be a JSON object.')
    data = dict(data)
    if {'image_key', 'image_url'} & data.keys():
        raise ImageValidationError('Partner image references are managed by the server.')
    if 'address' in data and data['address'] is not None and not isinstance(data['address'], dict):
        raise ImageValidationError('address must be a JSON object or null.')
    if 'positions' in data and (not isinstance(data['positions'], list) or
                               any(not isinstance(p, dict) for p in data['positions'])):
        raise ImageValidationError('positions must be a JSON array of objects.')
    if 'name' in data and (not isinstance(data['name'], str) or len(data['name']) > 255):
        raise ImageValidationError('Organization name must be text with at most 255 characters.')
    for field, limit in (('lat', 90), ('lng', 180)):
        if field in data and data[field] is not None:
            try:
                if isinstance(data[field], bool):
                    raise ValueError()
                value = float(data[field])
                if not math.isfinite(value) or abs(value) > limit:
                    raise ValueError()
                data[field] = value
            except (ValueError, TypeError) as exc:
                raise ImageValidationError(f'{field} must be a valid coordinate or null.') from exc
    return data


def owned_key(key):
    return bool(re.fullmatch(re.escape(settings.COMPANY_IMAGE_PREFIX) + r'/[0-9a-f]{32}\.webp', key or ''))


def company_image_url(key):
    if not owned_key(key) or not settings.SUPABASE_STORAGE_URL:
        return None
    return (f'{settings.SUPABASE_STORAGE_URL.rstrip("/")}/storage/v1/object/public/'
            f'{quote(settings.COMPANY_IMAGE_BUCKET, safe="")}/{quote(key, safe="/")}')


def image_fields(company, prefix=''):
    return {f'{prefix}image_key': company.image_key,
            f'{prefix}image_url': company_image_url(company.image_key)}


def _storage_request(method, key=None, **kwargs):
    base = settings.SUPABASE_STORAGE_URL.rstrip('/')
    credential = settings.SUPABASE_STORAGE_SERVICE_KEY
    parsed = urlsplit(base)
    if (not credential or parsed.scheme != 'https' or not parsed.netloc or
            parsed.username or parsed.password or parsed.query or parsed.fragment or
            parsed.path not in ('', '/') or not re.fullmatch(r'[a-z0-9][a-z0-9-]*', settings.COMPANY_IMAGE_BUCKET)):
        raise ImageStorageError()
    url = f'{base}/storage/v1/object/{quote(settings.COMPANY_IMAGE_BUCKET, safe="")}'
    if key:
        if not owned_key(key):
            raise ImageValidationError('Invalid partner image object key.')
        url += '/' + quote(key, safe='/')
    try:
        response = requests.request(method, url, headers={
            'Authorization': f'Bearer {credential}', 'apikey': credential,
            **kwargs.pop('headers', {}),
        }, timeout=STORAGE_TIMEOUT, allow_redirects=False, **kwargs)
        response.raise_for_status()
        if not 200 <= response.status_code < 300:
            raise ImageStorageError()
    except requests.RequestException as exc:
        # Never log request/response bodies or credentials.
        raise ImageStorageError() from exc


def upload_image(key, content):
    _storage_request('POST', key, data=content, headers={
        'Content-Type': 'image/webp', 'Cache-Control': 'max-age=31536000', 'x-upsert': 'false',
    })


def cleanup_image(key):
    """Best effort after commit/rollback. Never delete a referenced or foreign key."""
    from .models import Company
    if not key or not owned_key(key):
        return
    try:
        if Company.objects.filter(image_key=key).exists():
            return
        _storage_request('DELETE', json={'prefixes': [key]})
    except Exception:
        logger.error('Company image cleanup failed for owned key %s; manual cleanup required.', key)


class CompanyImageChange:
    """Wrap the whole DB transaction so failures clean newly uploaded objects.

    Call save after ordinary validation inside atomic(), with existing companies
    obtained using select_for_update(). No client may supply old keys.
    """
    def __init__(self, request, data):
        self.new_key = None
        self.action = data.get('image_action', 'unchanged')
        files = request.FILES.getlist('image')
        if self.action not in ('unchanged', 'replace', 'remove'):
            raise ImageValidationError('image_action must be unchanged, replace, or remove.')
        if len(files) > 1 or bool(files) != (self.action == 'replace'):
            raise ImageValidationError('Replacement requires exactly one image; unchanged/remove must have no file.')
        self.content = convert_company_image(files[0]) if files else None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        if exc_type and self.new_key:
            cleanup_image(self.new_key)

    def save(self, company):
        old_key = company.image_key
        if self.action == 'replace':
            self.new_key = f'{settings.COMPANY_IMAGE_PREFIX}/{uuid4().hex}.webp'
            upload_image(self.new_key, self.content)
            company.image_key = self.new_key
        elif self.action == 'remove':
            company.image_key = ''
        company.save()
        if old_key and old_key != company.image_key:
            transaction.on_commit(lambda: cleanup_image(old_key), robust=True)
