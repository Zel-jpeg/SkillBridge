"""Curated, reviewable IT vocabulary. Aliases normalize text, never database rows."""
import re
from collections import Counter
from difflib import SequenceMatcher
from itertools import combinations

TAXONOMY_VERSION = 'it-taxonomy-v2'
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
}
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
ROLE_TAGS = {
    'backend developer': ['backend', 'server-side', 'REST API', 'Django', 'Flask', 'authentication', 'database integration', 'business logic', 'API endpoint'],
    'frontend developer': ['frontend', 'React components', 'JavaScript events', 'responsive layout', 'CSS styling', 'browser compatibility', 'UI development'],
    'database administrator': ['database administration', 'SQL optimization', 'schema design', 'backup', 'indexing', 'data validation', 'relational database'],
    'qa tester': ['quality assurance', 'test cases', 'bug reporting', 'regression testing', 'manual testing', 'test documentation', 'defect tracking'],
    'network administrator': ['network administration', 'routing', 'switching', 'subnetting', 'Cisco configuration', 'network monitoring', 'LAN troubleshooting'],
    'it support': ['technical support', 'helpdesk', 'hardware troubleshooting', 'software installation', 'device setup', 'ticket handling', 'user assistance'],
    'cloud engineer': ['cloud infrastructure', 'AWS', 'Azure', 'cloud deployment', 'serverless', 'cloud security', 'infrastructure as code'],
    'devops engineer': ['CI/CD', 'Docker', 'Kubernetes', 'GitHub Actions', 'deployment pipeline', 'release automation', 'observability'],
}
GENERIC_TAGS = {'skill', 'skills', 'tools', 'tool', 'technology', 'technical', 'it', 'computer',
                'development', 'management', 'general', 'basic', 'advanced', 'operating', 'systems',
                'version', 'control', 'cloud', 'devops', 'programming', 'database', 'networking'}


def key(value):
    return re.sub(r'[^a-z0-9+#]+', ' ', str(value or '').casefold()).strip()


def canonical_category(name):
    normalized = key(name)
    return ALIASES.get(normalized, normalized)


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
