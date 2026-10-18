"""API envelopes are objects; list-valued fields remain supported inside them."""
from rest_framework.exceptions import ParseError
from rest_framework.parsers import JSONParser


class ObjectJSONParser(JSONParser):
    def parse(self, stream, media_type=None, parser_context=None):
        value = super().parse(stream, media_type=media_type, parser_context=parser_context)
        if not isinstance(value, dict):
            raise ParseError('Expected a JSON object.')
        return value
