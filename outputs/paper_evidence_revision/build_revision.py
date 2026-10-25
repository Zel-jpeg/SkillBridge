"""Focused PDF manuscript revision preserving every unrelated page."""
from pathlib import Path
from io import BytesIO
import hashlib
import json
import re

from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.lib import colors
from reportlab.platypus import Paragraph, Table, TableStyle

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SOURCE = Path(r'C:\Users\acer\Downloads\rev3_SKILLBRIDGE_ A_WEB-BASED OJT PLACEMENT DECISION SUPPORT SYSTEM WITH NLP-ASSISTED SKILLS ASSESSMENT AND COMPANY-POSITION RECOMMENDATION.docx.pdf')
OUT = HERE / 'SkillBridge_Research_Supported_Revision.pdf'
pdfmetrics.registerFont(TTFont('Arial', r'C:\Windows\Fonts\arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialBold', r'C:\Windows\Fonts\arialbd.ttf'))
body = ParagraphStyle('Body', fontName='Arial', fontSize=12, leading=24,
                      alignment=TA_JUSTIFY, firstLineIndent=36, spaceAfter=10)
heading = ParagraphStyle('Heading', fontName='ArialBold', fontSize=12, leading=18, spaceAfter=14)
note = ParagraphStyle('Note', fontName='Arial', fontSize=10, leading=15, spaceAfter=10)
cell = ParagraphStyle('Cell', fontName='Arial', fontSize=9, leading=12)
headcell = ParagraphStyle('HeadCell', fontName='ArialBold', fontSize=9, leading=12)

# Keys are physical PDF page numbers. Existing printed numbering is one less.
PAGES = {
55: [
('p', 'in the study: spaCy en_core_web_sm, spaCy en_core_web_md, and Stanford Stanza English. These pretrained configurations process generated competency profiles and position descriptions before TF-IDF vectorization and cosine similarity. They are preprocessing configurations, not three different recommendation algorithms. No additional model training was performed.'),
('p', 'Tokenization separates text into tokens; lemmatization reduces inflected forms; and stopword filtering removes selected common terms. Qi et al. [32, Sec. 4, Tables 2 and 4] provide a research basis for considering preprocessing quality and speed together. Their linguistic tasks and toolkit versions differ from SkillBridge, so their results cannot directly select the best configuration for this system. Official pipeline capabilities are documented separately in [18].'),
('p', 'Selection must follow the identified SkillBridge comparison run. The reported downstream accuracy is equal across configurations, while manuscript and saved-notebook timing values differ. The fastest-model conclusion therefore remains provisional until the run conditions and repeated timing measurements are reconciled.'),
('h', 'TF-IDF for Skill Category Suggestion and Text Vectorization'),
('p', 'Term Frequency-Inverse Document Frequency represents term importance relative to a document collection. Salton and Buckley discuss term weighting for text retrieval [17]. SkillBridge uses TF-IDF for skill-category suggestion and text matching. Kara et al. [31, Abstract and Sec. 4] also use a TF-IDF/cosine baseline in job recommendation; this supports its relevance without establishing that it is universally best.')
],
70: [
('h', 'SYSTEM TESTING AND IMPLEMENTATION'),
('p', 'Testing examines whether SkillBridge integrates authentication, profile management, assessment creation and submission, automated scoring, competency profiling, text preprocessing, recommendation generation, location matching, dashboards, and reports. Application functionality and usability are evaluated separately from recommendation quality. Deployment preparation includes configuration, database setup, account provisioning, and user orientation.'),
('h', 'Results of Testing NLP Models and Evaluation Metrics'),
('p', 'The notebook experiments compared spaCy en_core_web_sm, spaCy en_core_web_md, and Stanford Stanza English as pretrained preprocessing configurations. The resulting text was represented through TF-IDF and ranked by cosine similarity. This follows the approved comparison scope; it does not evaluate three separately trained placement classifiers.'),
('p', 'Qi et al. [32, Sec. 4] compare linguistic annotation quality and runtime across NLP toolkits. This supports considering efficiency alongside quality, while differences in task, version, and hardware limit numerical transfer. Kara et al. [31, Abstract and Secs. 2.1 and 4] provide a related skill-based matching framework and a TF-IDF/cosine baseline. Neither study establishes SkillBridge accuracy or a preferred preprocessing configuration.')
],
71: [
('h', 'Evaluation Design and Metric Definitions'),
('p', 'The notebook evaluation uses 300 synthetic student profiles, six candidate positions, and one expected role assigned through each synthetic archetype. Its labels represent the simulation design, not independent judgments or observed placement outcomes. Role-related terms inferred from assessment scores also enter notebook student text, and the evaluated cohort participates in TF-IDF corpus construction. No independent final cohort reserved from design selection is documented.'),
('p', 'Top-1 accuracy measures whether the first-ranked position matches the expected role. Hit Rate@3, called Top-3 accuracy in the original notebooks, measures whether that role appears among three suggestions. Precision, recall, and F1 are macro averages of first-ranked role predictions; they are not Precision@3, Recall@3, or proof that every suggested role is suitable. The confusion matrix identifies recurring errors.'),
('p', 'Gunawardana and Shani [33, Secs. 4.2, 5.2 and 5.4] relate experimental design and evaluation measures to the recommendation task. Their shortlist discussion supports evaluating the displayed candidates; it does not prescribe SkillBridge macro averaging or a passing percentage. Complete suitability judgments would be needed to assess Precision@3 beyond the current single expected-role labels.')
],
72: [
('h', 'Table 4 Comparative Analysis of NLP Configurations'),
('table', 'rich'),
('note', 'Times are retained from the supplied manuscript and describe reported batch computation, not measured website latency. Macro metrics are fractions. The dataset has 300 synthetic cases and six candidates.'),
('p', 'All configurations produced the same recorded Top-1 accuracy and Hit Rate@3 in this experiment. This is agreement with synthetic expected-role labels, rather than evidence of actual placement suitability or statistical equivalence across all possible data.'),
('p', 'Qi et al. [32, Sec. 4, Speed comparison and Table 4] support examining runtime trade-offs. Their study does not choose between current spaCy small and medium for SkillBridge. The manuscript timings above differ from the attached rich-text notebook outputs; consequently, a final model-selection claim requires an identified run, stated hardware and versions, and repeated measurements.'),
('h', 'Outcome of Evaluating the Final Recommendation Model'),
('p', 'The hybrid experiment adds category-score and location similarity to text matching. Category vectors summarize assessed percentages, text similarity compares generated profiles and descriptions, and location similarity represents geographic proximity. These components address different matching considerations.')
],
73: [
('h', 'Weighted Hybrid Recommendation Rationale'),
('p', 'Burke [29, Sec. 3.1] describes weighted hybrids that numerically combine component recommendation scores. This supports the score-combination architecture. It does not prescribe SkillBridge components or coefficients. Reference [30] remains a broader hybrid-recommender review.'),
('formula', 'Final score = 0.60 C + 0.25 T + 0.15 L'),
('note', 'C is category-score similarity; T is NLP-assisted text similarity; L is location similarity. The component scores are expressed on a 0-to-1 scale before percentage display.'),
('p', 'The implemented coefficients express the project design priority: assessed competency receives the largest coefficient, text alignment supplements that evidence, and proximity supplies a practical geographic consideration. This is the stated design rationale, not a weight set derived from Burke or an experimentally established optimum.'),
('p', 'Stronger coefficient justification requires a sensitivity comparison on identical inputs, candidate positions, and labels, varying both text and location weights and including component-removal controls. Such validation is not claimed by this revision. Common numeric ranges do not ensure equal score distributions or equal effects on ranking.'),
('p', 'The hybrid is evaluated using Top-1 accuracy, Hit Rate@3, macro precision, macro recall, macro F1, and computation time. Gunawardana and Shani [33] support task-appropriate comparison design; they do not validate these exact weights. Similarity scores are not calibrated probabilities of placement success.')
],
74: [
('h', 'Table 5 Final Hybrid Recommendation Testing Findings'),
('table', 'hybrid'),
('note', 'Original manuscript values are retained. Timing reconciliation is pending; these numbers must not be mixed with timings from another run. Macro metrics use first-ranked predictions.'),
('p', 'The hybrid achieved 89.33% Top-1 accuracy and 100% Hit Rate@3 against synthetic expected roles, with macro F1 of 0.8936. The expected role was therefore in the shortlist for every case; this does not show that all three recommendations were suitable. The NLP-only experiment recorded 93% Top-1 accuracy, so these experiments do not establish that hybridization improved first-choice accuracy.'),
('p', 'The saved final-hybrid notebook records different batch times and a different fastest spaCy configuration from this manuscript table. Neither table alone establishes a consistently fastest model. Repeated runs, timer boundaries, actual model identifiers, hardware, and software versions must be reconciled before final selection. This is a project evidence gap, not something an external citation can resolve.'),
('p', 'Notebook computation excludes model loading and application/database/network operations; its scoring timer also includes feature construction. Partial batch computation must be distinguished from per-instance model inference and end-to-end application response time.')
],
75: [
('p', 'These preliminary findings support further evaluation of the matching approach. They do not establish superior real-world placement outcomes, optimal hybrid coefficients, or a universally best preprocessor. Runtime model configuration and the final research selection should be reconciled explicitly; a configured default is not selection evidence.'),
('h', 'System Test Plan'),
('p', 'In order to provide for the validation process of the SkillBridge software, a well-detailed System Test Plan is going to be prepared. This plan outlines the testing objectives, the scope of testing, the testing environment, the test cases, and the acceptance criteria ensuring that testing is carried out systematically based on the system requirements. The major objective of this phase is to validate that the integrated OJT placement decision-support platform works properly and effectively in real-world usage conditions.'),
('p', 'The scope of testing involves validation of: user authentication for students, login for instructors and administrators, role-based access control, student profile management, assessment creation, bulk question upload, submission of student assessments, automatic scoring, skill categories computation, rich competency profiles creation, detailed company-position descriptions creation, NLP preprocessing, recommendations generation, location matching, dashboard rendering, and report generation.')
],
89: [
('h', 'REFERENCES CONTINUED'),
('ref', '[31] A. Kara, F. S. Danis, G. K. Orman, S. N. Turhan, and O. A. Ozlu, "Job recommendation based on extracted skill embeddings," in Intelligent Systems and Applications, K. Arai, Ed., Lecture Notes in Networks and Systems, vol. 544. Springer, 2023, pp. 497-507. doi: 10.1007/978-3-031-16075-2_35. First online: Sep. 1, 2022.'),
('url', 'https://doi.org/10.1007/978-3-031-16075-2_35'),
('ref', '[32] P. Qi, Y. Zhang, Y. Zhang, J. Bolton, and C. D. Manning, "Stanza: A Python natural language processing toolkit for many human languages," in Proc. ACL System Demonstrations, 2020, pp. 101-108. doi: 10.18653/v1/2020.acl-demos.14.'),
('url', 'https://aclanthology.org/2020.acl-demos.14/'),
('ref', '[33] A. Gunawardana and G. Shani, "A survey of accuracy evaluation metrics of recommendation tasks," Journal of Machine Learning Research, vol. 10, pp. 2935-2962, 2009.'),
('url', 'https://jmlr.org/papers/v10/gunawardana09a.html'),
('note', 'Reference numbers [1]-[30] are preserved from the supplied manuscript. Burke remains [29]. The added sources support methodological choices within their stated scope; none prescribes the exact 60/25/15 coefficients or certifies a SkillBridge model-selection result.')
]
}

def make_table(kind):
    header = ['NLP\nconfiguration', 'Top-1', 'Hit\nRate@3', 'Macro\nprecision', 'Macro\nrecall', 'Macro\nF1', 'Reported\nbatch s']
    if kind == 'rich':
        values = [['spaCy small','93.00%','99.67%','0.9316','0.9302','0.9304','5.923'],
                  ['spaCy medium','93.00%','99.67%','0.9316','0.9302','0.9304','6.115'],
                  ['Stanza English','93.00%','99.67%','0.9316','0.9302','0.9304','154.567']]
    else:
        values = [['spaCy small','89.33%','100.00%','0.8970','0.8929','0.8936','6.092'],
                  ['spaCy medium','89.33%','100.00%','0.8970','0.8929','0.8936','6.114'],
                  ['Stanza English','89.33%','100.00%','0.8970','0.8929','0.8936','159.761']]
    rows = [[Paragraph(s.replace('\n','<br/>'), headcell if i == 0 else cell) for s in row]
            for i,row in enumerate([header]+values)]
    table = Table(rows,colWidths=[83,49,53,63,58,55,71])
    table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#EEEEEE')),
        ('GRID',(0,0),(-1,-1),.5,colors.HexColor('#D9D9D9')),('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),
        ('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]))
    return table, values, header

def render_page(number, blocks):
    buffer = BytesIO()
    c = canvas.Canvas(buffer,pagesize=(612,792))
    c.setTitle('SkillBridge research supported revision')
    y = 720
    for kind,text in blocks:
        if kind == 'table':
            flow,_,_ = make_table(text)
        else:
            style = heading if kind == 'h' else note if kind in ['note','url'] else body
            if kind == 'formula':
                style = ParagraphStyle('Formula',parent=heading,alignment=1,spaceAfter=14)
            elif kind == 'ref':
                style = ParagraphStyle('Ref',parent=body,alignment=0,firstLineIndent=0,leading=20,spaceAfter=8)
            elif kind == 'url':
                text = f'<link href="{text}" color="black">{text}</link>'
            flow = Paragraph(text,style)
        _,height = flow.wrap(432,y-69)
        if y-height < 69:
            raise ValueError(f'Page {number} overflow at {kind}: bottom {y-height:.1f}')
        flow.drawOn(c,108,y-height)
        y -= height + (12 if kind=='table' else getattr(flow,'spaceAfter',10))
    c.setFont('Arial',12)
    c.drawRightString(540,48,str(number-1))
    c.showPage();c.save();buffer.seek(0)
    return PdfReader(buffer).pages[0],y

def main():
    HERE.mkdir(exist_ok=True)
    src=PdfReader(SOURCE)
    assert len(src.pages)==88
    writer=PdfWriter()
    layout={}
    for number,page in enumerate(src.pages,1):
        if number in PAGES:
            replacement,bottom=render_page(number,PAGES[number]);writer.add_page(replacement);layout[number]=bottom
        else:
            writer.add_page(page)
    new,bottom=render_page(89,PAGES[89]);writer.add_page(new);layout[89]=bottom
    writer.add_metadata({'/Title':'SkillBridge manuscript with research evidence revisions',
                         '/Subject':'Focused revision of NLP methods, evaluation and weight rationale'})
    with OUT.open('wb') as f:writer.write(f)
    revised=PdfReader(OUT)
    assert len(revised.pages)==89
    for i in range(88):
        if i+1 not in PAGES:
            assert revised.pages[i].extract_text()==src.pages[i].extract_text(),f'Unexpected page change {i+1}'
    assert 'These coefficients were derived' not in '\n'.join(p.extract_text() for p in revised.pages)
    markdown=['# Editable replacement sections','',
              'Replacements applied to the supplied rev3 PDF. Physical PDF pages are listed first; printed page numbers are one less. Objectives, requirements and unrelated pages were preserved. Existing experiment values were retained with timing/selection qualifications. This is a research-evidence revision, not a completed model or weight sensitivity study.','']
    for number,blocks in PAGES.items():
        markdown += [f'## PDF page {number} printed page {number-1}','']
        for kind,text in blocks:
            if kind=='h':markdown += [f'### {text}','']
            elif kind=='table':
                _,values,header=make_table(text)
                markdown += ['| '+' | '.join(x.replace('\n',' ') for x in header)+' |',
                             '| '+' | '.join(['---']*len(header))+' |']
                markdown += ['| '+' | '.join(row)+' |' for row in values]+['']
            else:markdown += [text,'']
    (HERE/'EDITABLE_REPLACEMENTS.md').write_text('\n'.join(markdown),encoding='utf-8')
    (HERE/'REVISION_CHECK.json').write_text(json.dumps({'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'output_sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'source_pages':88,'output_pages':89,
        'replaced_pdf_pages':[55,70,71,72,73,74,75],'added_reference_page':89,
        'unchanged_pages_text_checked':81,'rendered_body_bottom_y':layout},indent=2),encoding='utf-8')
    print('Created',OUT)
    print('Body bottom coordinates',layout)

if __name__=='__main__':main()
