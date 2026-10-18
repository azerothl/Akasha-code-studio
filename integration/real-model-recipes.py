"""Real configured Ollama models against an isolated daemon. Requires Python + PyYAML.
No provider fallback, deterministic fixture, or user configuration mutation.
Use --repeat 3 for each single-write and multi-tool recipe. All attempts are retained.
"""
import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import yaml
from uuid import uuid4
import hashlib
import sqlite3

parser = argparse.ArgumentParser()
parser.add_argument('--models', nargs='+', default=['lfm2:24b', 'qwen2.5-coder:14b', 'devstral:latest'])
parser.add_argument('--repeat', type=int, default=3)
parser.add_argument('--openai-context', type=int, help='Create and delete a temporary Ollama model alias with this num_ctx for the OpenAI transport')
args = parser.parse_args()
assert args.repeat > 0
repo = Path(os.environ.get('AKASHA_REPO_DIR', '../Akasha')).resolve()
binary = Path(os.environ['CODE_STUDIO_DAEMON_BIN']).resolve()
original = yaml.safe_load((Path.home() / 'akasha/llm_router.yaml').read_text(encoding='utf-8'))
ollama = original['providers']['ollama']['base_url'].rstrip('/')
evidence = Path(tempfile.mkdtemp(prefix='studio-model-recipes-'))
report = {'models': [], 'cases': [], 'provider_fallback': False, 'data': str(evidence), 'daemon_sha256': hashlib.sha256(binary.read_bytes()).hexdigest()}
def save():
    (evidence / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('EVIDENCE', evidence, flush=True)

for model in args.models:
    data = evidence / model.replace(':', '-')
    data.mkdir()
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
    base = f'http://127.0.0.1:{port}'
    provider = 'openai' if model.startswith('devstral') else 'ollama'
    actual_model=model
    def ollama_api(path,body,method='POST'):
        req=urllib.request.Request(ollama+path,data=json.dumps(body).encode(),headers={'Content-Type':'application/json'},method=method)
        with urllib.request.urlopen(req,timeout=90) as response:
            raw=response.read();return json.loads(raw) if raw else {}
    if provider=='openai' and args.openai_context:
        actual_model='studio-validation-'+uuid4().hex[:12]
        ollama_api('/api/create',{'model':actual_model,'from':model,'parameters':{'num_ctx':args.openai_context},'stream':False})
    route = {'primary': {'provider': provider, 'model': actual_model, 'config': {'max_tokens': 4096, 'temperature': 0.1, 'thinking_level': 'off', 'num_ctx': 32768}}, 'fallback': []}
    providers = {'ollama': {'base_url': ollama}, 'openai': {'base_url': ollama + '/v1', 'api_key_ref': 'ollama-local-not-secret'}}
    (data / 'llm_router.yaml').write_text(json.dumps({'global': {'enable_fallback': False, 'default_timeout_secs': 90, 'default_max_retries': 0}, 'providers': providers, 'task_types': {k: route for k in ['conversation', 'code_generation', 'system', 'utility', 'orchestrator', 'system_diagnostic']}}), encoding='utf-8')
    (data / 'tools_policy.yaml').write_text(json.dumps({'allowed_read_paths': [str(data)], 'allowed_write_paths': [str(data)], 'allowed_commands': ['git'], 'run_command_default_cwd_workspace': True}), encoding='utf-8')
    (data / 'permissions_mode.json').write_text('{"mode":"allow_all"}', encoding='utf-8')
    env = dict(os.environ, AKASHA_DATA_DIR=str(data), AKASHA_PORT=str(port), OPENAI_API_KEY='ollama-local-not-secret', OLLAMA_HOST=ollama, AKASHA_MAX_TOOL_ROUNDS='12', AKASHA_STUDIO_VERIFY_MAX_PASSES='1', AKASHA_STUDIO_VERIFY_AUTOFIX_LLM_ROUNDS='0', AKASHA_STUDIO_VERIFY_EXPLAIN_FAILURE='0')
    def api(path, body=None, method=None):
        req = urllib.request.Request(base+path, data=json.dumps(body).encode() if body is not None else None, headers={'Content-Type':'application/json'}, method=method)
        with urllib.request.urlopen(req, timeout=20) as res:
            raw=res.read();return json.loads(raw) if raw else {}
    with open(data / 'daemon.log', 'w', encoding='utf-8') as log:
        process = subprocess.Popen([str(binary)], cwd=repo, env=env, stdout=log, stderr=log, creationflags=0x08000000 if os.name=='nt' else 0)
        try:
            until=time.monotonic()+45
            while True:
                try: api('/api/status'); break
                except Exception:
                    if time.monotonic()>until:raise
                    time.sleep(.2)
            report['models'].append({'model':model,'actual_model':actual_model,'provider':provider,'temperature':0.1,'max_tokens':4096,'num_ctx':32768 if provider=='ollama' else (args.openai_context or 'provider default')})
            for iteration in range(args.repeat):
                for kind in ['single-write', 'multi-tool']:
                    case={'model':model,'provider':provider,'recipe':kind,'iteration':iteration+1}
                    project=None;task_id=None
                    try:
                        project=api('/api/studio/projects', {'name':f'Recipe {kind} {iteration+1}','tech_stack':'fichier texte','project_summary':'Recette réelle isolée.'})['id']
                        message=('Crée uniquement le fichier RECIPE_OK.md à la racine du projet. Son contenu doit être exactement la ligne recipe-ok. Utilise write_file ou write_code, puis arrête-toi.' if kind=='single-write' else 'Crée FIRST.md avec exactement alpha. Puis lis FIRST.md avec read_file pour vérifier son contenu. Ensuite crée SECOND.md avec exactement beta. Termine après ces trois opérations, sans autre modification.')
                        task_id=api('/api/message',{'session_id':f'real-recipe-{project}','studio_project_id':project,'studio_assigned_agent':'studio_scaffold','studio_delegate_single_level':True,'message':message})['task_id']
                        case.update(project=project,task_id=task_id)
                        until=time.monotonic()+180
                        while True:
                            task=api('/api/tasks/'+task_id)
                            if task['status'] in ['completed','failed','cancelled','paused','interrupted','waiting_user_input']:break
                            try:
                                question=api(f'/api/tasks/{task_id}/human-input')
                                case['pending_question']=question
                                break
                            except urllib.error.HTTPError as error:
                                if error.code!=404:raise
                            if time.monotonic()>until:raise AssertionError('Task deadline exceeded')
                            time.sleep(.5)
                        case.update(status=task['status'],outcome=task.get('outcome'),model_used=task.get('last_turn_model_used'),failure=task.get('failure_detail'),reply=(task.get('progress') or [{}])[-1].get('message'))
                        with sqlite3.connect(data/'akasha.db') as database:
                            saved=database.execute('SELECT body FROM studio_checkpoints WHERE task=?',(task_id,)).fetchone()
                            if saved:
                                case['model_turns']=[m for m in json.loads(saved[0]).get('conversation',[]) if m['role'] in ['assistant','tool']]
                        ledger=api(f'/api/tasks/{task_id}/recovery')['ledger']['operations']
                        case['operations']=ledger
                        case['diff']=api(f'/api/tasks/{task_id}/studio-diff')
                        files={'RECIPE_OK.md':'recipe-ok'} if kind=='single-write' else {'FIRST.md':'alpha','SECOND.md':'beta'}
                        contents={}
                        for path in files:
                            try:contents[path]=api(f'/api/studio/projects/{project}/raw?path={path}')['content']
                            except urllib.error.HTTPError as error:
                                if error.code!=404:raise
                                contents[path]=None
                        case['verified_files']=contents
                        assert task['status']=='completed',(task['status'],case.get('failure'))
                        assert task.get('outcome',{}).get('result')=='succeeded',case['outcome']
                        assert task.get('outcome',{}).get('termination_reason')=='success',case['outcome']
                        for path,expected in files.items():assert isinstance(contents[path],str) and contents[path].replace('\r\n','\n') in [expected,expected+'\n'],(path,contents[path])
                        writes=[o for o in ledger if o['tool'] in ['write_file','write_code'] and o['state']=='completed' and o.get('result',{}).get('success')]
                        # Retries may read, but must not repeat successful writes.
                        assert len(writes)==len(files),(len(writes),ledger)
                        if kind=='multi-tool':
                            ordered=sorted([o for o in ledger if o.get('result',{}).get('success')],key=lambda o:o['updated_at'])
                            first=next(i for i,o in enumerate(ordered) if o['tool'] in ['write_file','write_code'] and 'FIRST.md]' in o['result'].get('output',''))
                            second=next(i for i,o in enumerate(ordered) if o['tool'] in ['write_file','write_code'] and 'SECOND.md]' in o['result'].get('output',''))
                            assert any(first<i<second and o['tool']=='read_file' and 'alpha' in o['result'].get('output','') for i,o in enumerate(ordered)),ordered
                        assert {f['path'] for f in case['diff']['files']}==set(files),case['diff']
                        case['validation']='passed'
                    except Exception as error:
                        case['validation']='failed';case['error']=str(error)
                    finally:
                        report['cases'].append(case);save()
                        print(case['validation'].upper(),model,kind,iteration+1,case.get('status'),case.get('error','')[:500],flush=True)
                        if task_id:
                            try:api(f'/api/tasks/{task_id}/cancel',{},'POST')
                            except Exception:pass
                        if project:
                            try:api(f'/api/studio/projects/{project}?force=1',method='DELETE')
                            except Exception:pass
        finally:
            process.terminate()
            try:process.wait(timeout=10)
            except subprocess.TimeoutExpired:process.kill();process.wait()
            if actual_model!=model:
                ollama_api('/api/delete',{'model':actual_model},'DELETE')
                report['models'][-1]['temporary_alias_deleted']=True
save()
raise SystemExit(0 if all(c['validation']=='passed' for c in report['cases']) else 1)
