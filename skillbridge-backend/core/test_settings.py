from .settings import *  # noqa: F401,F403


DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
BREVO_API_KEY = ''
ENROLLMENT_SMTP_FALLBACK = False
GOOGLE_OAUTH_CLIENT_ID = 'synthetic-skillbridge-client.apps.googleusercontent.com'
# Unit/API tests do not run collectstatic; production keeps manifest storage.
STORAGES = {**STORAGES, 'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'}}
