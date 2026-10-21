"""Typeset the report using the supplied institutional page as letterhead.

Use the bundled artifact Python with reportlab/pypdf. The original PDF is read
only. Its form instructions are covered in the body area of the new document.
"""
from copy import deepcopy
from io import BytesIO
from pathlib import Path
import argparse
import json
import re
from xml.sax.saxutils import escape

from pypdf import PdfReader, PdfWriter, PageObject
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak, KeepTogether, Flowable

folder = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, default=folder / 'PROGRESS_REPORT.md')
parser.add_argument('--output', type=Path, default=folder / 'SkillBridge_Progress_Report_2026-10-20.pdf')
parser.add_argument('--reference-style', action='store_true', help='Fit paired evidence with explanatory bullets.')
parser.add_argument('--gantt-appendix', type=Path, help='Append the unmodified chart on a landscape page.')
args = parser.parse_args()
template = Path(r'C:/Users/acer/Downloads/Progress Report.docx.pdf')
source = PdfReader(template)
width, height = map(float, (source.pages[0].mediabox.width, source.pages[0].mediabox.height))
styles = getSampleStyleSheet()
body = ParagraphStyle('Report body', fontName='Helvetica', fontSize=10.5, leading=14,
                      spaceAfter=7, textColor=colors.black)
title = ParagraphStyle('Report title', parent=body, fontName='Helvetica-Bold', fontSize=16,
                       leading=19, alignment=TA_CENTER, spaceAfter=12)
heading = ParagraphStyle('Report heading', parent=body, fontName='Helvetica-Bold', fontSize=12,
                         leading=15, spaceBefore=10, spaceAfter=7, keepWithNext=True)
subhead = ParagraphStyle('Report subheading', parent=body, fontName='Helvetica-Bold', fontSize=10.5,
                         leading=14, spaceBefore=7, spaceAfter=5, keepWithNext=True)
cellstyle = ParagraphStyle('Table text', parent=body, fontSize=9.2, leading=12, spaceAfter=0)
cellhead = ParagraphStyle('Table heading', parent=cellstyle, fontName='Helvetica-Bold')
ganttcell = ParagraphStyle('Gantt value', parent=cellstyle, alignment=TA_CENTER)
captionstyle = ParagraphStyle('Figure caption', parent=body, fontSize=9.3, leading=12,
                              spaceAfter=8)
bulletstyle = ParagraphStyle('Report bullet', parent=body, leftIndent=14,
                             bulletIndent=2, spaceAfter=8)


def markup(value):
    value = escape(value).replace('–', '-').replace('—', '-')
    value = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', value)
    return value


content_width = width - 92


class CaptureSlot(Flowable):
    """A printable image-insertion area, not a screenshot or simulated UI."""
    def __init__(self, spec):
        super().__init__()
        self.width = content_width - 12
        self.height = spec['height']
        self.spec = spec

    def draw(self):
        c = self.canv
        c.saveState()
        c.setStrokeColor(colors.HexColor('#9AA7B2'))
        c.setFillColor(colors.HexColor('#FAFBFC'))
        c.setDash(4, 3)
        c.roundRect(0, 0, self.width, self.height, 8, stroke=1, fill=1)
        c.setDash()
        c.setFillColor(colors.HexColor('#344054'))
        c.setFont('Helvetica-Bold', 11)
        c.drawCentredString(self.width/2, self.height/2 + 20, 'INSERT YOUR SCREENSHOT HERE')
        c.setFont('Helvetica-Bold', 10)
        c.drawCentredString(self.width/2, self.height/2 + 2, self.spec['title'])
        detail_style = ParagraphStyle('Slot detail', parent=captionstyle, alignment=TA_CENTER,
                                      textColor=colors.HexColor('#667085'))
        detail = Paragraph(markup(self.spec['detail']), detail_style)
        _, detail_h = detail.wrap(self.width-40, self.height/2-20)
        detail.drawOn(c, 20, self.height/2-14-detail_h)
        c.restoreState()


story = []
lines = args.source.read_text(encoding='utf-8').splitlines()
index = 0
while index < len(lines):
    line = lines[index].strip()
    if not line:
        index += 1
        continue
    if line == '<!-- pagebreak -->':
        story.append(PageBreak())
        index += 1
        continue
    if line.startswith('<!-- capture-slot ') and line.endswith(' -->'):
        spec = json.loads(line[len('<!-- capture-slot '):-len(' -->')])
        group = [CaptureSlot(spec), Spacer(1, 8)]
        index += 1
        while index < len(lines) and not lines[index].strip():
            index += 1
        if index < len(lines) and lines[index].startswith('**Figure '):
            group.append(Paragraph(markup(lines[index]), captionstyle))
            index += 1
        story.extend([KeepTogether(group), Spacer(1, 8)])
        continue
    image_match = re.fullmatch(r'!\[(.*?)\]\((.*?)\)', line)
    if image_match:
        path = args.source.parent / image_match[2]
        picture = Image(str(path))
        figure_widths = ({'figure-1-company-position.png': 290,
                          'figure-2-assessment-authoring.png': 370,
                          'figure-3-nlp-comparison-code.png': 450}
                         if args.reference_style else
                         {'figure-1-company-position.png': 300,
                          'figure-2-assessment-authoring.png': 380,
                          'figure-3-nlp-comparison-code.png': 500})
        image_width = figure_widths.get(path.name, content_width)
        native_width, native_height = picture.imageWidth, picture.imageHeight
        picture.drawWidth = image_width
        picture.drawHeight = native_height * image_width / native_width
        picture.hAlign = 'CENTER'
        group = [picture, Spacer(1, 7)]
        index += 1
        while index < len(lines) and not lines[index].strip():
            index += 1
        if index < len(lines) and lines[index].startswith('**Figure '):
            group.append(Paragraph(markup(lines[index]), captionstyle))
            index += 1
        story.extend([KeepTogether(group), Spacer(1, 5)])
        continue
    if line.startswith('|'):
        rows = []
        while index < len(lines) and lines[index].strip().startswith('|'):
            cells = [x.strip() for x in lines[index].strip().strip('|').split('|')]
            if not all(re.fullmatch(r':?-+:?', x) for x in cells):
                rows.append(cells)
            index += 1
        count = len(rows[0])
        if count == 6:
            widths = [content_width * .40] + [content_width * .12] * 5
        elif rows[0][0] == 'Study objective':
            widths = [content_width * .30, content_width * .70]
        elif count == 2 and rows[0] == ['Task', 'Planned timing']:
            widths = [content_width * .60, content_width * .40]
        elif count == 2 and rows[0][0] == 'Task':
            widths = [content_width * .74, content_width * .26]
        elif count == 2:
            widths = [content_width * .44, content_width * .56]
        elif rows[0][0] == 'Objective':
            widths = [content_width * .26, content_width * .34, content_width * .40]
        else:
            widths = [content_width * .43, content_width * .15, content_width * .42]
        formatted = [[Paragraph(markup(v), cellhead if r == 0 else
                     ganttcell if count == 6 and c > 0 else cellstyle)
                      for c, v in enumerate(row)] for r, row in enumerate(rows)]
        table = Table(formatted, colWidths=widths, repeatRows=1, hAlign='LEFT')
        table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), .5, colors.HexColor('#D9D9D9')),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E9EDF0')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 7), ('RIGHTPADDING', (0, 0), (-1, -1), 7),
            ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ]))
        story.extend([table, Spacer(1, 10)])
        continue
    if line.startswith('# '):
        story.append(Paragraph(markup(line[2:]), title))
    elif line.startswith('## '):
        story.append(Paragraph(markup(line[3:]), heading))
    elif line.startswith('### '):
        story.append(Paragraph(markup(line[4:]), subhead))
    elif line.startswith('- '):
        story.append(Paragraph(markup(line[2:]), bulletstyle, bulletText='\u2022'))
    else:
        story.append(Paragraph(markup(line), body))
    index += 1

target = args.output
target.parent.mkdir(parents=True, exist_ok=True)
template_image = folder.parents[2] / 'tmp/pdfs/review_2026_10_20/template-200.png'


def letterhead(c, _doc):
    c.saveState()
    c.drawImage(str(template_image), 0, 0, width=width, height=height)
    c.setFillColor(colors.white)
    c.rect(22, 84, width-44, height-84-123, fill=1, stroke=0)
    c.restoreState()


class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.states = []

    def showPage(self):
        self.states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self.states) + bool(args.gantt_appendix)
        for state in self.states:
            self.__dict__.update(state)
            self.setFont('Helvetica', 8)
            self.drawString(46, 91, 'SkillBridge | 20 October 2026')
            self.drawRightString(width-46, 91, f'{self._pageNumber} of {total}')
            super().showPage()
        if args.gantt_appendix:
            from reportlab.lib.utils import ImageReader
            self.setPageSize((height, width))
            self.setFont('Helvetica-Bold', 13)
            self.drawString(26, width-27, 'SkillBridge Progress Report - Updated Project Gantt Chart')
            self.setFont('Helvetica', 9)
            self.drawString(26, width-43, 'Team-supplied schedule, 20 October 2026. Month ranges in the report are approximate readings of this chart.')
            chart = ImageReader(str(args.gantt_appendix))
            native_w, native_h = chart.getSize()
            scale = min((height-52)/native_w, (width-100)/native_h)
            chart_w, chart_h = native_w*scale, native_h*scale
            self.drawImage(chart, (height-chart_w)/2, 43+(width-100-chart_h)/2,
                           width=chart_w, height=chart_h)
            self.setFont('Helvetica', 8)
            self.drawString(26, 20, 'SkillBridge | 20 October 2026 | Original chart reproduced without date or bar changes')
            self.drawRightString(height-26, 20, f'{total} of {total}')
            super().showPage()
        super().save()


SimpleDocTemplate(str(target), pagesize=(width, height), leftMargin=46, rightMargin=46,
                  topMargin=154, bottomMargin=101, title='SkillBridge Progress Report 20 October 2026',
                  author='SkillBridge Research Team').build(story, onFirstPage=letterhead,
                        onLaterPages=letterhead, canvasmaker=NumberedCanvas)
print(f'Created {target.name}: {len(PdfReader(target).pages)} pages, {target.stat().st_size} bytes')
