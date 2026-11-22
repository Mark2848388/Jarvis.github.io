import json, os, tempfile
from unittest.mock import patch
from vektor.autopilot import Autopilot

class FakeCloud:
    def chat(self,*args,**kwargs):
        return json.dumps({'name':'Demo Project','summary':'Demo app','run':'Open index.html','files':[{'path':'index.html','content':'<!doctype html><html><body>OK</body></html>'},{'path':'main.py','content':'print("ok")'}]})
class E: cloud=FakeCloud()
with tempfile.TemporaryDirectory() as d:
    ap=Autopilot(E(),d)
    with patch('vektor.autopilot.web_research.search',return_value={'results':[{'title':'Example','url':'https://example.com'}]}), patch('vektor.autopilot.web_research.open_page',return_value={'url':'https://example.com','text':'Example source'}):
        r=ap.run('create a demo',True)
    assert len(r['files'])==3 and 'RESEARCH.md' in r['files'] and r['research_count']==1 and os.path.isfile(r['zip_path'])
    assert any(x['status']=='ok' for x in r['checks'])
print('AUTOPILOT generation + research + checks + ZIP ✔')
