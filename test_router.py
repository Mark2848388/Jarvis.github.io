import os, sys, tempfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "engine"))
from vektor.multi_ai.cost_guard import assert_free
from vektor.multi_ai.quota_manager import QuotaManager
from vektor.multi_ai.router import FreeRouter

assert assert_free("groq", "openai/gpt-oss-120b")
try:
    assert_free("groq", "some-paid-model")
    raise AssertionError("Paid/unknown model must be blocked")
except ValueError:
    pass
try:
    assert_free("unknown", "some-model")
    raise AssertionError("Unknown provider must be blocked")
except ValueError:
    pass

q = QuotaManager(os.path.join(tempfile.mkdtemp(), "q.db"), {"groq": 2})
assert q.available("groq")
q.record("groq", True)
assert q.available("groq")
q.record("groq", False)
assert not q.available("groq")
assert q.snapshot()["groq"]["errors_today"] == 1

r = FreeRouter(tempfile.mkdtemp())
r.providers = [
    {"name":"groq","key":"test","model":"openai/gpt-oss-120b","url":"mock","kind":"openai"},
    {"name":"openrouter","key":"test","model":"meta-llama/llama-3.3-70b-instruct:free","url":"mock","kind":"openai"},
]
calls=[]
def fake(p,messages,temp,max_tokens):
    calls.append(p["name"])
    if p["name"]=="groq": raise RuntimeError("rate limited")
    return "fallback works"
r._request=fake
assert r.chat([{"role":"user","content":"test"}]) == "fallback works"
assert calls == ["groq","openrouter"]
assert r.last_provider == "openrouter"
print("FREE_ONLY guard ✔")
print("quota manager ✔")
print("provider fallback ✔")
