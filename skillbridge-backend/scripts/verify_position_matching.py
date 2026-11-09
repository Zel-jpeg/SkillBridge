"""Six fictional learners. Real backend grading in disposable in-memory SQLite.

Checks integrated position-specific scoring against an independent reconstruction. Never reads .env,
connects to the configured project, or alters application code.
"""
import copy
import hashlib
import importlib.metadata
import json
import os
import random
import sys
import argparse
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
BACKEND=ROOT/'skillbridge-backend'
parser=argparse.ArgumentParser(description='Verify position-specific matching on six fictional students using disposable in-memory SQLite.')
parser.add_argument('--output-dir', type=Path, default=ROOT/'work/position-specific-nlp-integrated')
args=parser.parse_args()
args.output_dir.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(BACKEND))
os.environ['PYTHON_DOTENV_DISABLED']='1'
os.environ['DJANGO_SETTINGS_MODULE']='core.test_settings'
os.environ['DEBUG']='True'
os.environ['SECRET_KEY']='synthetic-six-student-offline-test-key-2026'
import django
django.setup()
import numpy as np
from django.conf import settings
from django.core.management import call_command
from django.db import connection, transaction
from django.urls import reverse
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from api.models import (Institute,Program,CompetencyFramework,SkillCategory,User,
    InstructorAssignment,Batch,BatchEnrollment,Assessment,Question,AnswerChoice,
    StudentResponse,ResponseAnswer,SkillScore,CombinedCategoryScore,
    CombinedCompetencyProfile,Company,Position,PositionRequirement,Recommendation,
    RecommendationConfiguration)
from api.scoring import score_submission,validate_submission_answers
from api.combined_competency import recalculate_combined
from api.recommendation_freshness import load_scoped_catalog
from api.recommendation_nlp import build_student_profile,preprocess_texts,assessed_scores
from api.recommendation_policy import pooled_evidence,position_requirements,describe,numerical_key

assert settings.DATABASES['default']['ENGINE']=='django.db.backends.sqlite3'
assert settings.DATABASES['default']['NAME']==':memory:'
# APIClient outside Django's test runner needs its synthetic host allowed here.
# This affects this disposable process only, not application settings.py.
settings.ALLOWED_HOSTS=[*settings.ALLOWED_HOSTS,'testserver']
call_command('migrate',verbosity=0,interactive=False)
catalog_path=BACKEND/'api/data/position_matching_synthetic_v1.json'
catalog=json.loads(catalog_path.read_text())
rng=random.Random(20261109)
REPORT={'scope':'Integrated position-specific scoring verified on six fictional students; source-informed catalog; no configured database.',
    'database':'Disposable SQLite :memory:', 'sources':catalog['sources'],
    'source_distinction':catalog['notes'], 'checks':[], 'students':[],
    'current_policy':'Full-profile baseline reconstructed with unchanged numerical policy; integrated application uses position-relevant matching.',
    'integrated_method':'Required-category student text transformed in one common TF-IDF space; zero positive-evidence guard.',
    'limits':['Student answer patterns, numerical role minima and expected roles were fixed before model execution.',
        'Source duties were adapted to supervised fictional intern roles; no real employer vacancy or partnership is asserted.',
        'This is direct backend grading/combination and API result-read testing, not browser/admin-authoring, realtime or deployment testing.',
        'Six designed cases cannot establish real-world or independent expert accuracy.']}

def check(name,passed,detail=None):
    REPORT['checks'].append({'name':name,'passed':bool(passed),'detail':detail})
    if not passed:
        print('CHECK FAILED: '+name,flush=True)

def snapshot(student,batch):
    evidence={'answers':list(ResponseAnswer.objects.filter(response__student=student).order_by('id').values()),
        'scores':list(SkillScore.objects.filter(student=student).order_by('id').values()),
        'combined':list(CombinedCategoryScore.objects.filter(student=student,batch=batch).order_by('id').values()),
        'profiles':list(CombinedCompetencyProfile.objects.filter(student=student,batch=batch).values()),
        'recommendations':list(Recommendation.objects.filter(student=student,batch=batch).order_by('id').values())}
    return hashlib.sha256(json.dumps(evidence,sort_keys=True,default=str).encode()).hexdigest()

def compare(student,batch,profile):
    before=snapshot(student,batch)
    bundle=load_scoped_catalog(batch)
    scores=list(CombinedCategoryScore.objects.filter(student=student,batch=batch).select_related('skill_category'))
    processed,model,fallback=preprocess_texts([profile.competency_profile_text]+bundle.position_texts,
        'spacy_md',allow_fallback=False)
    check(student.name+': spaCy Medium used without fallback',model=='spacy_md' and fallback is None)
    v=TfidfVectorizer(ngram_range=(1,3),min_df=1,sublinear_tf=True)
    matrix=v.fit_transform(processed)
    full_scores=cosine_similarity(matrix[:1],matrix[1:])[0]*100
    pooled,totals,names,mapping=pooled_evidence(scores,bundle.categories,exact_categories=True)
    saved={r.position_id:r for r in Recommendation.objects.filter(student=student,batch=batch,is_current=True)}
    current_rows=[]
    proposed_rows=[]
    comparison=[]
    for i,pos in enumerate(bundle.positions):
        rec=saved[pos.id]
        targets=position_requirements(pos,mapping)
        relevant=[s for s in assessed_scores(scores) if s.skill_category_id in targets]
        filtered=build_student_profile(relevant)
        prepared,_,_=preprocess_texts([filtered],'spacy_md',allow_fallback=False)
        value=float(cosine_similarity(v.transform(prepared),matrix[i+1:i+2])[0][0])*100 if any(s.percentage>0 for s in relevant) else 0
        check(student.name+': integrated score equals independently transformed relevant text '+pos.title,round(value,2)==rec.nlp_score_component)
        check(student.name+': integrated input provenance '+pos.title,rec.assessment_details['nlp_evidence']['student_profile_scope']=='position_required_categories' and rec.assessment_details['nlp_evidence']['uses_common_tfidf_space'])
        details=describe(pooled,totals,names,targets)
        baseline=copy.deepcopy(details)
        baseline['support']=(25*round(float(full_scores[i]),2)+15*rec.location_score_component)/40
        alternative=copy.deepcopy(details)
        alternative['support']=(25*round(value,2)+15*rec.location_score_component)/40
        current_rows.append((pos.id,baseline))
        proposed_rows.append((pos.id,alternative))
        check(student.name+': no foreign-program candidate '+pos.title,
            pos.management_program_id==batch.program_id and all(r.skill_category.framework_id==batch.framework_id for r in pos.requirements.all()))
        comparison.append({'position_id':pos.id,'position':pos.title,'partner':pos.company.name,
            'current_rank':rec.assessment_rank,'coverage':round(details['coverage'],4),
            'demand_alignment':round(details['strength'],4),'current_nlp':round(float(full_scores[i]),2),'integrated_nlp':rec.nlp_score_component,
            'proposed_nlp':round(value,2),'full_student_words':len(profile.competency_profile_text.split()),
            'filtered_student_words':len(filtered.split()),'position_words':len(bundle.position_texts[i].split()),
            'requirements':[{'category':names[k],'minimum':targets[k],'student_score':pooled.get(k)} for k in sorted(targets)]})
    current_order=[key for key,d in sorted(current_rows,key=lambda row:numerical_key(row[1],row[0]))]
    proposed_order=[key for key,d in sorted(proposed_rows,key=lambda row:numerical_key(row[1],row[0]))]
    for r in comparison:
        r['proposed_rank']=proposed_order.index(r['position_id'])+1
    check(student.name+': offline comparison did not mutate any saved evidence',snapshot(student,batch)==before)
    check(student.name+': saved integrated ordering reproduced',proposed_order==[r.position_id for r in sorted(saved.values(),key=lambda r:r.assessment_rank)])
    return sorted(comparison,key=lambda r:r['current_rank']),current_order,proposed_order

institutes={code:Institute.objects.create(code=code,name=name) for code,name in [
    ('IC','Institute of Computing'),('IBPA','Institute of Business and Public Affairs')]}
program_names={'BSIT':'Bachelor of Science in Information Technology','BSIS':'Bachelor of Science in Information Systems',
    'BSSW':'Bachelor of Science in Social Work','BSTM':'Bachelor of Science in Tourism Management'}
RecommendationConfiguration.objects.update_or_create(pk=1,defaults={'active_model':'spacy_md'})
contexts={}
all_students=[]
for group in catalog['groups']:
    staff=User.objects.create_user(group['key'].replace(' ','').lower()+'-staff@example.invalid',
        name='Synthetic '+group['key']+' coordinator',role='instructor',is_approved=True)
    for code in group['programs']:
        program=Program.objects.create(institute=institutes[group['institute']],code=code,name=program_names[code])
        InstructorAssignment.objects.create(instructor=staff,program=program)
        framework=CompetencyFramework.objects.create(program=program,version=1,name='Synthetic source-informed skills')
        batch=Batch.objects.create(institute=program.institute,program=program,framework=framework,
            instructor=staff,name='Synthetic '+code+' cohort')
        cats=[];assessments=[];question_keys={}
        for ci,c in enumerate(group['categories']):
            cat=SkillCategory.objects.create(framework=framework,name=c['name'],description=c['description'],tags=c['tags'])
            cats.append(cat)
            assessment=Assessment.objects.create(batch=batch,framework=framework,created_by=staff,
                title=c['name'],duration_minutes=20,is_required=True,include_in_competency=True)
            assessments.append(assessment)
            keys=[]
            for qi,item in enumerate(c['questions']):
                q=Question.objects.create(assessment=assessment,skill_category=cat,question_text=item['prompt'],
                    question_type=item['type'],question_order=qi)
                options=[(item['answer'],True)]+[(option,False) for option in item['distractors']]
                rng.shuffle(options)
                choices=[AnswerChoice.objects.create(question=q,choice_text=text,is_correct=correct) for text,correct in options]
                keys.append((q,next(c for c in choices if c.is_correct),[c for c in choices if not c.is_correct]))
            question_keys[assessment.pk]=keys
        roles=[]
        for ri,r in enumerate(group['roles']):
            partner=Company.objects.create(name=f'Synthetic {code} host {ri+1}',management_program=program)
            pos=Position.objects.create(company=partner,title=r['title'],description=r['description'],tags=r['tags'],
                slots_available=3,management_program=program,created_by=staff,eligibility_configured_at=timezone.now())
            pos.eligible_programs.add(program)
            for category_index,minimum in r['requirements'].items():
                PositionRequirement.objects.create(position=pos,skill_category=cats[int(category_index)],required_percentage=minimum)
            roles.append(pos)
        contexts[code]=(program,batch,cats,assessments,question_keys,roles)
    for case in group['students']:
        program,batch,cats,assessments,question_keys,roles=contexts[case['program']]
        student=User.objects.create_user(case['label'].lower()+'@example.invalid',name=case['label'],role='student',
            program=program,course=program.code,is_approved=True)
        BatchEnrollment.objects.create(student=student,batch=batch,profile_review_required=False,profile_confirmed_at=timezone.now())
        for ci,assessment in enumerate(assessments):
            response=StudentResponse.objects.create(student=student,assessment=assessment,status='in_progress',started_at=timezone.now())
            correct_indices=set(rng.sample(range(5),case['correct_counts'][ci]))
            payload=[]
            for qi,(q,correct,wrong) in enumerate(question_keys[assessment.pk]):
                intended_correct=qi in correct_indices
                if q.question_type=='identification':
                    payload.append({'question_id':q.pk,'text_answer':(' '+correct.choice_text.upper()+' ') if intended_correct else 'synthetic incorrect answer'})
                else:
                    payload.append({'question_id':q.pk,'selected_choice_id':(correct if intended_correct else wrong[0]).pk})
            with transaction.atomic():
                score_submission(response,payload,cats)
                response.status='submitted';response.submitted_at=timezone.now()
                response.save(update_fields=['status','submitted_at'])
            saved=SkillScore.objects.get(student=student,assessment=assessment,skill_category=cats[ci])
            check(case['label']+': actual grading '+cats[ci].name,
                (saved.raw_score,saved.max_score,saved.percentage)==(case['correct_counts'][ci],5,case['correct_counts'][ci]*20))
        profile,progress,recs=recalculate_combined(student,batch)
        check(case['label']+': all six required assessments complete',progress['completed_required_count']==6 and progress['all_required_completed'])
        check(case['label']+': current profile finalized with four scoped candidates',profile.is_finalized and len(recs)==4)
        comparisons,current_order,proposed_order=compare(student,batch,profile)
        expected=roles[case['expected_role']].pk
        check(case['label']+': current expected role first',current_order[0]==expected)
        check(case['label']+': proposed expected role first',proposed_order[0]==expected)
        api=APIClient();api.force_authenticate(student)
        response=api.get(reverse('student_combined_results'))
        check(case['label']+': authenticated combined result GET succeeds',response.status_code==200,
            {'status_code':response.status_code})
        if response.status_code==200:
            api_recs=response.data.get('recommendations',[])
            check(case['label']+': API exposes exactly four own-program positions',
                len(api_recs)==4 and all(r['position_id'] in {p.pk for p in roles} for r in api_recs))
        REPORT['students'].append({'student':case['label'],'group':group['key'],'program':program.code,
            'category_results':[{'category':c.name,'correct':n,'maximum':5,'percent':20*n}
                for c,n in zip(cats,case['correct_counts'])],
            'expected_position':roles[case['expected_role']].title,
            'current_expected_rank':current_order.index(expected)+1,'proposed_expected_rank':proposed_order.index(expected)+1,
            'recommendations':comparisons,'full_profile_words':len(profile.competency_profile_text.split()),
            'current_order':[next(p.title for p in roles if p.pk==identity) for identity in current_order],
            'proposed_order':[next(p.title for p in roles if p.pk==identity) for identity in proposed_order]})
        all_students.append((student,batch,assessments))
        print('Completed '+case['label'],flush=True)

# The same IC coordinator is assigned to both programs, while their exact IDs remain separate.
ic_staff=User.objects.get(email='ic-staff@example.invalid')
check('One IC coordinator assigned to BSIT and BSIS',set(InstructorAssignment.objects.filter(instructor=ic_staff).values_list('program__code',flat=True))=={'BSIT','BSIS'})
for index,(student,batch,assessments) in enumerate(all_students):
    foreign=next(context for code,context in contexts.items() if code!=batch.program.code)
    foreign_q=Question.objects.filter(assessment=foreign[3][0]).first()
    caught=False
    try:
        validate_submission_answers([{'question_id':foreign_q.pk,'text_answer':''}],list(assessments[0].questions.prefetch_related('choices')))
    except ValidationError:
        caught=True
    check(student.name+': foreign-program question rejected by actual validator',caught)

REPORT['counts']={'students':User.objects.filter(role='student').count(),'institutes':Institute.objects.count(),
    'programs':Program.objects.count(),'batches':Batch.objects.count(),'assessments':Assessment.objects.count(),
    'questions':Question.objects.count(),'submitted_assessments':StudentResponse.objects.filter(status='submitted').count(),
    'saved_answers':ResponseAnswer.objects.count(),'category_scores':SkillScore.objects.count(),
    'combined_categories':CombinedCategoryScore.objects.count(),'positions':Position.objects.count(),
    'saved_current_recommendations':Recommendation.objects.filter(is_current=True).count()}
REPORT['metrics']={'cases':6,'candidate_count_per_program':4,
    'current_top1_hits':sum(s['current_expected_rank']==1 for s in REPORT['students']),
    'proposed_top1_hits':sum(s['proposed_expected_rank']==1 for s in REPORT['students']),
    'current_top3_hits':sum(s['current_expected_rank']<=3 for s in REPORT['students']),
    'proposed_top3_hits':sum(s['proposed_expected_rank']<=3 for s in REPORT['students']),
    'note':'Descriptive hits on six predesigned examples only; not independent accuracy.'}
REPORT['check_count']=len(REPORT['checks'])
REPORT['failed_checks']=[row for row in REPORT['checks'] if not row['passed']]
REPORT['versions']={key:importlib.metadata.version(key) for key in ['Django','spacy','en-core-web-md','scikit-learn']}
REPORT['harness_setup']='APIClient host testserver is allowed only in this disposable process; no application configuration is edited.'
REPORT['sha256']={'catalog':hashlib.sha256(catalog_path.read_bytes()).hexdigest(),
    'script':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
(args.output_dir/'report.json').write_text(json.dumps(REPORT,indent=2),encoding='utf-8')
print(json.dumps({'counts':REPORT['counts'],'metrics':REPORT['metrics'],'checks':REPORT['check_count'],
    'failures':REPORT['failed_checks']},indent=2),flush=True)
connection.close()
if REPORT['failed_checks']:
    raise SystemExit(1)
