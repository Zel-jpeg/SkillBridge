"""Provision at build time, then strictly verify all selectable NLP resources.

No Django settings/database or application secrets are required. Normal runs
only verify installed resources. --download is explicit and intended for builds.
"""
import argparse
import json
import os
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--download', action='store_true', help='Download English tokenize/lemma resources into the application image.')
    parser.add_argument('--directory', help='Stanza directory; defaults to STANZA_RESOURCES_DIR or .nlp/stanza for a build.')
    args = parser.parse_args()
    if args.directory:
        os.environ['STANZA_RESOURCES_DIR'] = str(Path(args.directory).expanduser().resolve())
    if args.download:
        import stanza
        target = os.environ.get('STANZA_RESOURCES_DIR') or str(ROOT / '.nlp' / 'stanza')
        os.environ['STANZA_RESOURCES_DIR'] = target
        stanza.download('en', model_dir=target, processors='tokenize,lemma', verbose=False)

    from api.recommendation_nlp import MODEL_OPTIONS, model_status
    failed = False
    for model_id in MODEL_OPTIONS:
        started = time.perf_counter()
        result = model_status(model_id, verify=True)
        failed |= not result['verified']
        print(json.dumps({'model': model_id, **result, 'cold_probe_seconds': round(time.perf_counter() - started, 3)}), flush=True)
    return 1 if failed else 0


if __name__ == '__main__':
    raise SystemExit(main())
