import sys, os, json, tempfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "engine"))
os.environ["VEKTOR_LIB_DIR"] = os.path.join(os.path.dirname(__file__), "..")
from vektor import Engine, core

class FakeCloud:
    def chat(self, m, t, n): return "ответ[" + m[0]["content"][-40:].replace("\n", " ") + "]"
    def configure(self, *a): pass

d = tempfile.mkdtemp(); e = Engine(d, cloud=FakeCloud())
H = lambda m, **a: json.loads(e.handle(json.dumps({"m": m, "a": a}, ensure_ascii=False)))
p = H("ping"); assert p["ok"] and p["r"]["native"], p; print("core:", p["r"]["core"], "| plugins:", p["r"]["plugins"])
H("mem.add", text="Мой кот зовут Барсик, он рыжий"); H("mem.add", text="Я работаю на Python и Kotlin"); H("mem.add", text="Пароль от wifi лежит в сейфе")
r = H("mem.search", q="как зовут кота")["r"]; assert "Барсик" in r[0]["text"], r; print("поиск ✔", r[0])
r = H("mem.search", q="Привет КОТ")["r"]; assert r and "Барсик" in r[0]["text"]; print("регистр кириллицы ✔")
assert H("chat", text="запомни: люблю чай")["r"]["memory"]
chat_result = H("chat", text="какой язык я использую? Python", mode="code")["r"]
assert "ответ" in chat_result["reply"] and chat_result["elapsed_ms"] >= 0
assert chat_result["activity"] == "Пишу и проверяю код"
print("chat+режимы+метаданные времени ✔")
assert H("tool", name="calc", args={"expr": "2+3*4"})["r"] == 14
assert not H("tool", name="calc", args={"expr": "__import__('os')"})["ok"]
assert 1 <= H("tool", name="dice", args={"sides": 6})["r"] <= 6; print("инструменты+плагин ✔")
c = core.chunk("Первое предложение. Второе предложение! " * 30, 120); assert len(c) > 3 and all(len(x.encode()) <= 120 for x in c); print("chunk ✔", len(c))
a = H("ws.propose", file="note.txt", text="v1\n")["r"]; assert H("ws.apply", id=a["id"])["ok"]
b = H("ws.propose", file="note.txt", text="v2\n")["r"]; assert "+v2" in b["diff"]; assert H("ws.apply", id=b["id"])["ok"]
assert open(os.path.join(d, "workspace", "note.txt")).read() == "v2\n"
H("ws.rollback"); assert open(os.path.join(d, "workspace", "note.txt")).read() == "v1\n"
H("ws.rollback"); assert not os.path.exists(os.path.join(d, "workspace", "note.txt")); print("правка→подтверждение→откат ✔")
assert not H("ws.propose", file="../evil.txt", text="x")["ok"]; print("защита путей ✔")
import time; t = time.time()
for i in range(20000): core.index_put(1000 + i, "документ номер %d про тему %d" % (i, i % 97))
core.index_search("тема 42", 5); print("20k записей, поиск: %.1f мс (native=%s)" % ((time.time() - t) * 1000, core.native()))
print("ВСЕ ТЕСТЫ ПРОЙДЕНЫ")
