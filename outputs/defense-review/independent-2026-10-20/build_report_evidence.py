"""Prepare faithful document-detail crops and a labeled source-code excerpt."""
import hashlib
import json
from pathlib import Path
import textwrap

from PIL import Image, ImageDraw, ImageFont

folder = Path(__file__).resolve().parent
root = folder.parents[2]
out = folder / 'evidence'
out.mkdir(exist_ok=True)
items = [
    ('figure-1-company-position.png', 'skillbridge-frontend/tests/artifacts/company-collection/desktop-position-expanded-map-collapsed.png', (270, 250, 835, 700), '2026-10-17', 'Mocked local UI with synthetic catalog'),
    ('figure-2-assessment-authoring.png', 'work/defense_audit/v01-artifacts/instructor-upload.png', (260, 1010, 1100, 1570), '2026-10-18', 'Local synthetic authoring UI'),
    ('figure-4-ranked-suggestion.png', 'work/defense_audit/v01-artifacts/admin-placements.png', (270, 400, 1265, 650), '2026-10-18', 'Local React/API synthetic student/company'),
    ('figure-5-generated-report.png', 'tmp/pdfs/review_2026_10_20/report-output-example.png', (0, 0, 1500, 700), '2026-10-18', 'Rendered saved synthetic company-placement PDF; detail crop'),
]
manifest = []
for target, source, box, date, scope in items:
    path = root / source
    picture = Image.open(path).convert('RGB')
    assert box[2] <= picture.width and box[3] <= picture.height, (source, picture.size)
    picture.crop(box).save(out / target)
    manifest.append({'file': target, 'source': source, 'source_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                     'crop_pixels': box, 'source_capture_date': date, 'scope': scope})

font = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 19)
title_font = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 22)
lines = []
sources = [('skillbridge-backend/api/recommendation_nlp.py', [(20, 33)]),
           ('skillbridge-backend/api/nlp_evaluation.py', [(193, 197), (203, 206)])]
for source, spans in sources:
    lines.append(('heading', source.removeprefix('skillbridge-backend/')))
    raw = (root / source).read_text(encoding='utf-8').splitlines()
    for start, end in spans:
        if start != spans[0][0]: lines.append(('code', '      ...'))
        for number in range(start, end + 1):
            value = f'{number:>4}  {raw[number - 1]}'
            for row in textwrap.wrap(value, width=91, subsequent_indent='      ', replace_whitespace=False, drop_whitespace=False) or ['']:
                lines.append(('code', row))
    lines.append(('code', ''))
canvas = Image.new('RGB', (1100, 64 + len(lines) * 27), '#FFFFFF')
draw = ImageDraw.Draw(canvas)
draw.rectangle((0, 0, canvas.width-1, canvas.height-1), outline='#D9D9D9', width=2)
y = 24
for kind, value in lines:
    draw.text((24, y), value, fill='#111111', font=title_font if kind == 'heading' else font)
    y += 27
canvas.save(out / 'figure-3-nlp-comparison-code.png')
manifest.append({'file': 'figure-3-nlp-comparison-code.png', 'type': 'source excerpt, not an IDE screenshot',
                 'capture_date': '2026-10-20', 'sources': [{'path': source, 'ranges': spans,
                  'sha256': hashlib.sha256((root/source).read_bytes()).hexdigest()} for source, spans in sources]})
(out / 'sources.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
print('Prepared five objective-linked figures; originals unchanged')
