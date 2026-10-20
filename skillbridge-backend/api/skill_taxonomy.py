"""Curated OJT vocabulary; suggestions require review and never update saved rows."""
import re
from collections import Counter
from difflib import SequenceMatcher
from itertools import combinations

TAXONOMY_VERSION = 'ojt-vocabulary-v3'
SKILL_TAGS = {
    'programming': ['Python', 'Java', 'JavaScript', 'OOP', 'algorithms', 'data structures', 'debugging', 'Git', 'problem solving', 'software logic'],
    'database management': ['SQL', 'PostgreSQL', 'MySQL', 'ERD', 'normalization', 'indexing', 'query optimization', 'database design', 'backup', 'data integrity'],
    'networking': ['TCP/IP', 'routing', 'switching', 'subnetting', 'LAN', 'WAN', 'Cisco', 'firewall', 'network troubleshooting', 'connectivity'],
    'web development': ['HTML', 'CSS', 'JavaScript', 'React', 'responsive design', 'web API', 'frontend', 'DOM', 'browser testing', 'UI development'],
    'cybersecurity': ['authentication', 'encryption', 'OWASP', 'firewall', 'access control', 'secure coding', 'vulnerability assessment', 'phishing', 'security policy'],
    'cloud': ['AWS', 'Azure', 'Google Cloud', 'cloud storage', 'virtual machines', 'hosting', 'serverless', 'containers', 'cloud deployment', 'cloud security'],
    'devops': ['CI/CD', 'Docker', 'Kubernetes', 'GitHub Actions', 'deployment pipeline', 'automation', 'monitoring', 'Linux server', 'environment variables'],
    'operating systems': ['Linux', 'Windows', 'Ubuntu', 'shell', 'command line', 'file system', 'processes', 'memory management', 'permissions', 'system administration'],
    'version control': ['Git', 'GitHub', 'GitLab', 'branches', 'commits', 'merge', 'pull request', 'repository', 'version history', 'collaboration'],
    'tools': ['VS Code', 'Postman', 'Figma', 'Jira', 'Trello', 'API testing', 'debugging tools', 'documentation', 'productivity tools'],
    'design': ['UI design', 'UX design', 'wireframing', 'prototyping', 'visual design', 'accessibility'],
    'data analytics': ['data analysis', 'statistics', 'Python', 'SQL', 'visualization', 'reporting'],
    'quality assurance': ['test cases', 'regression testing', 'bug reporting', 'test automation', 'manual testing', 'defect tracking', 'test documentation'],
    'technical support': ['helpdesk', 'hardware troubleshooting', 'software installation', 'device setup', 'ticket handling', 'user assistance'],
    'video editing': ['timeline editing', 'video trimming', 'transitions', 'audio synchronization', 'captions', 'color grading', 'frame rate', 'video export', 'codec', 'sequence assembly'],
    'image editing': ['cropping', 'color correction', 'retouching', 'layers', 'layer masks', 'selection tools', 'image resizing', 'image resolution', 'file formats', 'non-destructive editing'],
    'photography': ['exposure', 'aperture', 'shutter speed', 'ISO', 'focus', 'composition', 'lighting', 'white balance', 'camera setup', 'photo organization'],
    'videography': ['video capture', 'shot composition', 'camera movement', 'stabilization', 'video exposure', 'audio capture', 'lighting', 'shot list', 'footage organization'],
    'graphic design': ['typography', 'page layout', 'color theory', 'vector graphics', 'visual hierarchy', 'branding', 'print preparation', 'digital assets', 'alignment', 'design brief'],
    'multimedia production': ['storyboarding', 'media assets', 'video sequences', 'audio tracks', 'image preparation', 'production brief', 'file organization', 'media export'],
    'audio editing': ['waveform editing', 'noise reduction', 'audio levels', 'clip trimming', 'audio mixing', 'fade transitions', 'sample rate', 'audio export'],
    'animation': ['keyframes', 'storyboarding', '2D animation', 'motion graphics', 'animation timing', 'tweening', 'rendering', 'asset preparation'],
    'accounting': ['journal entries', 'general ledger', 'trial balance', 'bank reconciliation', 'invoice verification', 'expense classification', 'financial statements', 'supporting documents'],
    'bookkeeping': ['transaction records', 'debits and credits', 'cash receipts', 'cash disbursements', 'ledger entries', 'account reconciliation', 'source documents', 'record accuracy'],
    'spreadsheet skills': ['cell references', 'formulas', 'functions', 'sorting', 'filtering', 'data validation', 'pivot tables', 'charts', 'lookup functions', 'worksheet formatting'],
    'office productivity': ['word processing', 'spreadsheets', 'presentations', 'document formatting', 'file organization', 'email correspondence', 'tables', 'meeting notes'],
    'data entry': ['record encoding', 'data validation', 'spreadsheet entry', 'duplicate checking', 'form processing', 'data accuracy', 'record updates', 'confidentiality'],
    'records management': ['document indexing', 'filing', 'record retrieval', 'version tracking', 'retention schedules', 'access permissions', 'document registers', 'document scanning'],
    'inventory management': ['stock records', 'receiving records', 'issue records', 'stock counts', 'inventory reconciliation', 'reorder levels', 'asset registers', 'stock movements'],
    'business communication': ['email writing', 'proofreading', 'meeting minutes', 'report writing', 'customer correspondence', 'clear instructions', 'document review', 'professional communication'],
    'mobile development': ['mobile interfaces', 'application navigation', 'device testing', 'local storage', 'API integration', 'application debugging', 'responsive layouts', 'application lifecycle'],
    'system administration': ['user accounts', 'system configuration', 'patch management', 'system backups', 'log review', 'file permissions', 'service monitoring', 'access management'],
    'technical documentation': ['user guides', 'operating procedures', 'API documentation', 'document structure', 'version tracking', 'step verification', 'technical diagrams', 'release notes'],
    'social media management': ['content calendar', 'post scheduling', 'social copy', 'engagement metrics', 'media preparation', 'audience analytics', 'content review', 'community responses'],
    'computer hardware': ['CPU', 'RAM', 'motherboard', 'storage devices', 'peripherals', 'hardware diagnostics', 'component installation', 'device maintenance'],
}
# These original aliases also affect generated matching text. Keep that contract
# separate from broader authoring suggestions below.
ALIASES = {
    'database': 'database management', 'databases': 'database management', 'dbms': 'database management',
    'database administration': 'database management', 'cloud computing': 'cloud',
    'os': 'operating systems', 'operating system': 'operating systems',
    'version control systems': 'version control', 'git': 'version control',
    'development tools': 'tools', 'software tools': 'tools', 'developer tools': 'tools',
    'computer networking': 'networking', 'network administration': 'networking',
    'cyber security': 'cybersecurity', 'information security': 'cybersecurity',
    'software development': 'programming', 'computer programming': 'programming',
    'web dev': 'web development', 'dev ops': 'devops', 'qa': 'quality assurance',
    'software testing': 'quality assurance', 'it support': 'technical support',
}
SUGGESTION_CATEGORY_ALIASES = {
    'video production editing': 'video editing', 'film editing': 'video editing',
    'video post production': 'video editing', 'adobe premiere pro': 'video editing',
    'premiere pro': 'video editing', 'davinci resolve': 'video editing', 'capcut': 'video editing',
    'photo editing': 'image editing', 'photo retouching': 'image editing',
    'photo manipulation': 'image editing', 'image manipulation': 'image editing',
    'photoshop': 'image editing', 'adobe photoshop': 'image editing',
    'digital photography': 'photography', 'photo documentation': 'photography',
    'video capture': 'videography', 'video documentation': 'videography',
    'graphic designing': 'graphic design', 'graphic arts': 'graphic design', 'layout design': 'graphic design',
    'multimedia': 'multimedia production', 'multimedia editing': 'multimedia production',
    'sound editing': 'audio editing', 'audio production': 'audio editing',
    'motion graphics': 'animation', '2d animation': 'animation',
    'accounting fundamentals': 'accounting', 'financial accounting': 'accounting',
    'bookkeeping fundamentals': 'bookkeeping',
    'spreadsheet': 'spreadsheet skills', 'spreadsheets': 'spreadsheet skills',
    'spreadsheet applications': 'spreadsheet skills', 'microsoft excel': 'spreadsheet skills',
    'excel': 'spreadsheet skills', 'google sheets': 'spreadsheet skills',
    'office applications': 'office productivity', 'office tools': 'office productivity',
    'microsoft office': 'office productivity', 'computer literacy': 'office productivity',
    'data encoding': 'data entry', 'database encoding': 'data entry', 'record encoding': 'data entry',
    'document management': 'records management', 'records administration': 'records management',
    'inventory control': 'inventory management', 'asset management': 'inventory management',
    'professional communication': 'business communication', 'office communication': 'business communication',
    'mobile application development': 'mobile development', 'mobile app development': 'mobile development',
    'systems administration': 'system administration', 'technical writing': 'technical documentation',
    'social media': 'social media management', 'hardware': 'computer hardware',
    'computer maintenance': 'computer hardware', 'help desk': 'technical support',
    'helpdesk': 'technical support', 'network support': 'networking',
    'ui ux design': 'design', 'user interface design': 'design', 'user experience design': 'design',
}
ROLE_TAGS = {
    'backend developer': ['backend', 'server-side', 'REST API', 'Django', 'Flask', 'authentication', 'database integration', 'business logic', 'API endpoint'],
    'frontend developer': ['frontend', 'React components', 'JavaScript events', 'responsive layout', 'CSS styling', 'browser compatibility', 'UI development'],
    'database administrator': ['database administration', 'SQL optimization', 'schema design', 'backup', 'indexing', 'data validation', 'relational database'],
    'qa tester': ['quality assurance', 'test cases', 'bug reporting', 'regression testing', 'manual testing', 'test documentation', 'defect tracking'],
    'network administrator': ['network administration', 'routing', 'switching', 'subnetting', 'Cisco configuration', 'network monitoring', 'LAN troubleshooting'],
    'it support': ['technical support', 'helpdesk', 'hardware troubleshooting', 'software installation', 'device setup', 'ticket handling', 'user assistance'],
    'cloud engineer': ['cloud infrastructure', 'AWS', 'Azure', 'cloud deployment', 'serverless', 'cloud security', 'infrastructure as code'],
    'devops engineer': ['CI/CD', 'Docker', 'Kubernetes', 'GitHub Actions', 'deployment pipeline', 'release automation', 'observability'],
    'video editor': ['timeline editing', 'video trimming', 'transitions', 'audio synchronization', 'captions', 'color grading', 'frame rate', 'video export'],
    'photo editor': ['cropping', 'retouching', 'color correction', 'layers', 'layer masks', 'image resizing', 'image resolution', 'image export'],
    'photographer': ['camera setup', 'exposure', 'aperture', 'shutter speed', 'ISO', 'composition', 'lighting', 'photo organization'],
    'videographer': ['video capture', 'shot composition', 'camera movement', 'stabilization', 'video exposure', 'audio capture', 'shot list', 'footage organization'],
    'graphic designer': ['typography', 'page layout', 'vector graphics', 'color theory', 'visual hierarchy', 'design brief', 'print preparation', 'digital assets'],
    'multimedia assistant': ['media assets', 'storyboarding', 'image preparation', 'video sequences', 'audio tracks', 'production brief', 'file organization', 'media export'],
    'audio editor': ['waveform editing', 'noise reduction', 'audio levels', 'clip trimming', 'audio mixing', 'fade transitions', 'audio export'],
    'motion graphics designer': ['keyframes', 'animation timing', '2D animation', 'motion graphics', 'storyboarding', 'rendering', 'asset preparation'],
    'accounting assistant': ['journal entries', 'invoice verification', 'supporting documents', 'general ledger', 'bank reconciliation', 'expense classification', 'spreadsheet formulas', 'financial records'],
    'bookkeeping assistant': ['transaction records', 'debits and credits', 'cash receipts', 'cash disbursements', 'ledger entries', 'source documents', 'account reconciliation'],
    'data encoder': ['record encoding', 'data validation', 'spreadsheet entry', 'duplicate checking', 'form processing', 'data accuracy', 'record updates', 'confidentiality'],
    'records assistant': ['document indexing', 'filing', 'record retrieval', 'document registers', 'document scanning', 'version tracking', 'access permissions'],
    'office assistant': ['word processing', 'spreadsheets', 'document formatting', 'email correspondence', 'meeting notes', 'file organization', 'data entry'],
    'spreadsheet assistant': ['spreadsheet formulas', 'cell references', 'sorting', 'filtering', 'data validation', 'pivot tables', 'charts', 'lookup functions'],
    'inventory assistant': ['stock records', 'receiving records', 'issue records', 'stock counts', 'inventory reconciliation', 'asset registers', 'stock movements'],
    'social media assistant': ['content calendar', 'post scheduling', 'social copy', 'media preparation', 'content review', 'engagement metrics', 'audience analytics'],
    'data analyst': ['data cleaning', 'descriptive statistics', 'SQL queries', 'spreadsheet analysis', 'data visualization', 'charts', 'report preparation', 'data quality'],
    'web developer': ['HTML', 'CSS', 'JavaScript', 'web forms', 'responsive layout', 'browser testing', 'web accessibility', 'website maintenance'],
    'fullstack developer': ['web interfaces', 'REST API', 'database integration', 'application logic', 'authentication', 'integration testing', 'version control'],
    'mobile developer': ['mobile interfaces', 'application navigation', 'device testing', 'API integration', 'local storage', 'application debugging', 'application lifecycle'],
    'system administrator': ['user accounts', 'system configuration', 'patch management', 'system backups', 'log review', 'file permissions', 'service monitoring'],
    'technical writer': ['user guides', 'operating procedures', 'technical diagrams', 'document structure', 'step verification', 'version tracking', 'release notes'],
    'ux designer': ['wireframing', 'prototyping', 'user flows', 'usability observations', 'interface layout', 'accessibility', 'design documentation'],
    'software developer': ['application logic', 'debugging', 'data structures', 'unit testing', 'version control', 'code review', 'technical documentation'],
    'cybersecurity assistant': ['security checklists', 'access review', 'log review', 'security documentation', 'incident reporting', 'security policy', 'risk observations'],
}
# Phrase aliases are matched as whole words. General titles such as "editor",
# "assistant" or "encoder" alone deliberately have no invented specialization.
ROLE_ALIASES = {
    'backend developer': ['backend development', 'backend engineer', 'server side developer'],
    'frontend developer': ['frontend development', 'frontend engineer'],
    'database administrator': ['database administration', 'database management', 'database admin', 'database support', 'database assistant', 'database encoder administrator'],
    'qa tester': ['qa engineer', 'qa intern', 'software tester', 'software testing', 'test analyst'],
    'network administrator': ['network administration', 'network support', 'network technician', 'networking', 'network specialist', 'network engineer'],
    'it support': ['helpdesk', 'help desk', 'technical support', 'desktop support', 'computer technician', 'it technician'],
    'cloud engineer': ['cloud engineering', 'cloud operations', 'cloud support'],
    'devops engineer': ['devops engineering', 'devops intern'],
    'video editor': ['video editing', 'film editor', 'film editing', 'video post production', 'video photo editor', 'photo video editor', 'video and photo editor', 'photo and video editor'],
    'photo editor': ['photo editing', 'image editor', 'image editing', 'photo retoucher', 'photo retouching', 'photoshop editor', 'video photo editor', 'photo video editor', 'video and photo editor', 'photo and video editor'],
    'photographer': ['photography', 'photography assistant', 'photo documentation'],
    'videographer': ['videography', 'videography assistant', 'video documentation'],
    'graphic designer': ['graphic design', 'graphic artist', 'layout artist', 'layout designer'],
    'multimedia assistant': ['multimedia intern', 'multimedia editor', 'multimedia designer', 'multimedia production'],
    'audio editor': ['audio editing', 'sound editor', 'sound editing', 'audio production assistant'],
    'motion graphics designer': ['motion graphics artist', 'motion designer', 'animator', 'animation assistant', '2d animation'],
    'accounting assistant': ['accounting intern', 'accounting clerk', 'accounting support', 'accountant'],
    'bookkeeping assistant': ['bookkeeper', 'bookkeeping intern', 'bookkeeping clerk'],
    'data encoder': ['data entry', 'data entry clerk', 'data encoding', 'database encoder', 'database encoding', 'records encoder'],
    'records assistant': ['records clerk', 'records management', 'records officer', 'document controller', 'documentation clerk'],
    'office assistant': ['administrative assistant', 'administrative aide', 'office clerk', 'office administration'],
    'spreadsheet assistant': ['spreadsheet specialist', 'spreadsheet analyst', 'excel assistant', 'excel specialist'],
    'inventory assistant': ['inventory clerk', 'inventory management', 'inventory officer', 'stock clerk', 'asset management assistant'],
    'social media assistant': ['social media manager', 'social media coordinator', 'social media intern'],
    'data analyst': ['data analytics', 'data analysis', 'reporting analyst', 'business intelligence assistant'],
    'web developer': ['web development', 'website developer', 'website development'],
    'fullstack developer': ['full stack developer', 'full stack development', 'fullstack development', 'full stack engineer'],
    'mobile developer': ['mobile development', 'mobile application developer', 'mobile app developer', 'android developer', 'flutter developer'],
    'system administrator': ['systems administrator', 'system administration', 'systems administration', 'systems support'],
    'technical writer': ['technical writing', 'technical documentation', 'documentation specialist'],
    'ux designer': ['ux design', 'ui ux designer', 'ui ux design', 'user experience designer'],
    'software developer': ['software development', 'application developer', 'software engineer'],
    'cybersecurity assistant': ['cybersecurity intern', 'cyber security intern', 'security analyst', 'information security assistant'],
}
# Broad Tools proficiency does not confirm a company uses any particular product.
BROAD_POSITION_CATEGORIES = frozenset({'tools'})

GENERIC_TAGS = {'skill', 'skills', 'tools', 'tool', 'technology', 'technical', 'it', 'computer',
                'development', 'management', 'general', 'basic', 'advanced', 'operating', 'systems',
                'version', 'control', 'cloud', 'devops', 'programming', 'database', 'networking'}


def key(value):
    return re.sub(r'[^a-z0-9+#]+', ' ', str(value or '').casefold()).strip()


def canonical_category(name):
    normalized = key(name)
    return ALIASES.get(normalized, normalized)


def suggestion_category(name):
    """Broader authoring lookup; never used to rewrite generated matching text."""
    normalized = canonical_category(name)
    return SUGGESTION_CATEGORY_ALIASES.get(normalized, normalized)


def is_generic_tag(tag, category_name=''):
    return key(tag) in GENERIC_TAGS or (bool(category_name) and canonical_category(tag) == canonical_category(category_name))


def taxonomy_diagnostics(categories):
    """Heuristic suggestions for human review, never automatic merges/updates."""
    from .recommendation_nlp import normalize_tags
    categories = list(categories)
    warnings, tag_sets = [], {}
    for index, category in enumerate(categories):
        tags = normalize_tags(category.tags)
        tag_sets[index] = {key(t) for t in tags}
        codes = []
        if not tags:
            codes.append(('no_tags', 'No tags are saved.'))
        elif len(tags) < 4:
            codes.append(('few_tags', 'Fewer than four distinct tags are saved.'))
        if tags and all(is_generic_tag(t, category.name) for t in tags):
            codes.append(('generic_tags', 'Only generic or category-name tags are saved.'))
        for code, message in codes:
            warnings.append({'code': code, 'category_ids': [category.id], 'categories': [category.name],
                             'message': message, 'suggestion': 'Review Suggest/Refresh Tags and save only appropriate tags.'})
    for (i, a), (j, b) in combinations(enumerate(categories), 2):
        code = None
        if key(a.name) == key(b.name):
            code = 'duplicate_name'
        elif canonical_category(a.name) == canonical_category(b.name) or SequenceMatcher(None, key(a.name), key(b.name)).ratio() >= .88:
            code = 'near_duplicate'
        if code:
            warnings.append({'code': code, 'category_ids': [a.id, b.id], 'categories': [a.name, b.name],
                'message': 'Names may describe the same competency.',
                'suggestion': 'Consider a manual consolidation plan after reviewing assessment and position references. Nothing is merged automatically.'})
        shared = tag_sets[i] & tag_sets[j]
        union = tag_sets[i] | tag_sets[j]
        if len(shared) >= 3 and len(shared) / len(union) >= .6:
            warnings.append({'code': 'tag_overlap', 'category_ids': [a.id, b.id], 'categories': [a.name, b.name],
                'message': f'{len(shared)} shared tags; {len(shared) / len(union):.0%} Jaccard overlap.',
                'shared_tags': sorted(shared), 'suggestion': 'Review category boundaries and add distinguishing evidence where appropriate.'})
    counts = Counter(tag for tags in tag_sets.values() for tag in tags)
    return {'version': TAXONOMY_VERSION, 'category_count': len(categories), 'warnings': warnings,
            'common_tags': [{'tag': tag, 'category_count': count} for tag, count in counts.most_common() if count >= 2],
            'note': 'Heuristic warnings need human review. Aliases normalize generated text only; saved categories and tags remain unchanged.'}
