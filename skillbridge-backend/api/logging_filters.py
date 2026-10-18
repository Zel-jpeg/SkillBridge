"""Keep useful request diagnostics while removing credentials from URL logs."""
import logging
import re


class RedactCredentials(logging.Filter):
    query = re.compile(r'([?&](?:token|access_token|refresh_token|password|api_key|apikey)=)[^&\s"\']*', re.I)
    bearer = re.compile(r'(Bearer\s+)[A-Za-z0-9._~+/-]+', re.I)

    def filter(self, record):
        message = self.query.sub(r'\1[REDACTED]', record.getMessage())
        record.msg = self.bearer.sub(r'\1[REDACTED]', message)
        record.args = ()
        return True
