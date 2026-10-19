"""Real daemon + adversarial push-only LSP process; no model or user configuration changes."""
import hashlib,json,os,shutil,socket,subprocess,tempfile,time,urllib.request
from pathlib import Path
root=Path(tempfile.mkdtemp(prefix="studio-lsp-push-"));bindir=root/"bin";bindir.mkdir()
binary=Path(os.environ["CODE_STUDIO_DAEMON_BIN"]).resolve()
fixture=root/"server.mjs"
fixture.write_text(r'''let buffer=Buffer.alloc(0);const send=x=>{let body=Buffer.from(JSON.stringify(x));process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);process.stdout.write(body);};
process.stdin.on("data",chunk=>{buffer=Buffer.concat([buffer,chunk]);while(true){const i=buffer.indexOf("\r\n\r\n");if(i<0)return;const n=Number(/Content-Length: (\d+)/i.exec(buffer.subarray(0,i).toString())[1]);if(buffer.length<i+4+n)return;const m=JSON.parse(buffer.subarray(i+4,i+4+n));buffer=buffer.subarray(i+4+n);if(m.method==="initialize")send({jsonrpc:"2.0",id:m.id,result:{capabilities:{textDocumentSync:1}}});if(m.method==="textDocument/didOpen"){const d=m.params.textDocument;const diag=(message,version)=>send({jsonrpc:"2.0",method:"textDocument/publishDiagnostics",params:{uri:d.uri,...(version===undefined?{}:{version}),diagnostics:[{range:{start:{line:0,character:0},end:{line:0,character:1}},message,code:String(process.pid)}]}});diag("WRONG-VERSION",99);setTimeout(()=>diag(d.text),40);setTimeout(()=>diag("LATE-OLD-"+d.text),500);}if(m.method==="textDocument/didChange")send({jsonrpc:"2.0",method:"textDocument/publishDiagnostics",params:{uri:m.params.textDocument.uri,diagnostics:[{message:"STALE-DIDCHANGE"}]}});}});
''',encoding="utf8")
node=shutil.which("node");assert node
launcher=bindir/("typescript-language-server.cmd" if os.name=="nt" else "typescript-language-server")
launcher.write_text(('@echo off\n"'+node+'" "'+str(fixture)+'" %*\n') if os.name=="nt" else ('#!/bin/sh\nexec "'+node+'" "'+str(fixture)+'" "$@"\n'),encoding="utf8")
if os.name!="nt":launcher.chmod(0o755)
(root/"tools_policy.yaml").write_text(json.dumps({"allowed_read_paths":[str(root)],"allowed_write_paths":[str(root)],"allowed_commands":["git","typescript-language-server"]}),encoding="utf8")
with socket.socket() as sock:sock.bind(("127.0.0.1",0));port=sock.getsockname()[1]
base=f"http://127.0.0.1:{port}"
def api(path,body=None,method=None):
 req=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers={"Content-Type":"application/json"},method=method)
 with urllib.request.urlopen(req,timeout=45) as response:return json.load(response)
report={"daemon_sha256":hashlib.sha256(binary.read_bytes()).hexdigest(),"cases":[],"model":"none: adversarial LSP protocol process"}
project=None
with open(root/"daemon.log","w",encoding="utf8") as log:
 process=subprocess.Popen([str(binary)],cwd=Path(os.environ.get("AKASHA_REPO_DIR","../Akasha")).resolve(),env=dict(os.environ,AKASHA_DATA_DIR=str(root),AKASHA_PORT=str(port),PATH=str(bindir)+os.pathsep+os.environ["PATH"]),stdout=log,stderr=log,creationflags=0x08000000 if os.name=="nt" else 0)
 try:
  for _ in range(90):
   try:api("/api/status");break
   except Exception:time.sleep(.5)
  project=api("/api/studio/projects",{"name":"Push freshness","tech_stack":"fichier texte","project_summary":"isolated push diagnostics"})["id"]
  workspace=root/"studio-projects"/project;(workspace/"sample.ts").write_text("old",encoding="utf8")
  endpoint=f"/api/studio/projects/{project}/lsp"
  first=api(endpoint+"/query",{"action":"diagnostics","path":"sample.ts","text":"old"})
  assert first["result"]["status"]=="ready",first
  assert first["result"]["diagnostics"][0]["message"]=="old",first
  assert not first["session_restarted_for_freshness"],first
  time.sleep(.6) # Let the previous process enqueue its delayed stale notification.
  second=api(endpoint+"/query",{"action":"diagnostics","path":"sample.ts","text":"new"})
  assert second["result"]["status"]=="ready",second
  assert second["result"]["diagnostics"][0]["message"]=="new",second
  assert second["session_restarted_for_freshness"],second
  assert first["result"]["diagnostics"][0]["code"]!=second["result"]["diagnostics"][0]["code"]
  third=api(endpoint+"/query",{"action":"diagnostics","path":"sample.ts","text":"new"})
  assert not third["session_restarted_for_freshness"],third
  assert third["result"]["diagnostics"]==second["result"]["diagnostics"],third
  report.update(status="passed",cases=[{"name":"initial versionless push and rejection of wrong version","result":first},{"name":"changed buffer uses isolated process, excludes old delayed diagnostics","result":second},{"name":"unchanged buffer reuses process","result":third}])
 finally:
  if project:
   try:api(f"/api/studio/projects/{project}/lsp/sessions",method="DELETE")
   except Exception:pass
  process.terminate();process.wait(timeout=20)
  (root/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
  print("EVIDENCE",root,flush=True)
assert report.get("status")=="passed",report
print("PASSED",len(report["cases"]),"push diagnostics process cases")
