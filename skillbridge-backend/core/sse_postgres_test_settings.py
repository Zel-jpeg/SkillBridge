"""Opt-in disposable PostgreSQL tests; never reuse normal DB_* credentials."""
import os
from django.core.exceptions import ImproperlyConfigured
os.environ['PYTHON_DOTENV_DISABLED'] = '1'
from .test_settings import *  # noqa: F401,F403

test_name = os.environ.get('SB_TEST_DB_NAME', '')
if not test_name.startswith('test_'):
    raise ImproperlyConfigured('SB_TEST_DB_NAME must name a disposable test_ database.')
DATABASES = {'default': {
    'ENGINE': 'django.db.backends.postgresql',
    'NAME': test_name,
    'USER': os.environ['SB_TEST_DB_USER'],
    'PASSWORD': os.environ.get('SB_TEST_DB_PASSWORD', ''),
    'HOST': os.environ.get('SB_TEST_DB_HOST', '127.0.0.1'),
    'PORT': os.environ.get('SB_TEST_DB_PORT', '5432'),
    'TEST': {'NAME': test_name},
}}
