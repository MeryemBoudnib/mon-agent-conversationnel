# ia_service.py  — version combinée unique (avec persistance des recherches web)
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import os, uuid, math, csv, io, re, json
from collections import defaultdict, Counter
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# ==== Recherche externe ====
import requests
from bs4 import BeautifulSoup

load_dotenv()

# ---------- IA (optionnelle)
API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY") or ""
if API_KEY:
    genai.configure(api_key=API_KEY)
MODEL = genai.GenerativeModel("gemini-2.0-flash") if API_KEY else None

# ---------- DB (PostgreSQL)
PG_URL = (os.getenv("DATABASE_URL") or "").strip()
if not PG_URL:
    PG_HOST = os.getenv("PGHOST", "localhost")
    PG_PORT = os.getenv("PGPORT", "5432")
    PG_DB   = os.getenv("PGDATABASE", "chatbot_db")
    PG_USER = os.getenv("PGUSER", "postgres")
    PG_PASS = os.getenv("PGPASSWORD", "Anawa3ra1./")
    PG_URL  = f"postgresql+psycopg2://{PG_USER}:{PG_PASS}@{PG_HOST}:{PG_PORT}/{PG_DB}"
ENGINE = create_engine(PG_URL, pool_pre_ping=True)

# ---------- Flask
app = Flask(__name__)
CORS(app)  # autorise http://localhost:4200 etc.

# ---------- Mémoire docs (RAG)
DOCS: Dict[str, Dict[str, List[Dict[str, Any]]]] = defaultdict(lambda: defaultdict(list))

# ---------- Journal côté serveur des recherches web (persisté en RAM)
SEARCH_LOGS: Dict[str, List[Dict[str, Any]]] = defaultdict(list)  # clés: "conv::<id>" ou "<namespace>"

# PDF optionnel
try:
    from pypdf import PdfReader
    HAS_PDF = True
except Exception:
    HAS_PDF = False

# ---------- Mini-embedding (démo)
def embed(txt: str) -> List[float]:
    if not txt:
        return [0.0]
    s = [ord(c) for c in txt[:2048]]
    m = sum(s)/len(s)
    return [m/255.0]

def cosine(a: List[float], b: List[float]) -> float:
    if not a or not b:
        return 0.0
    num = sum(x*y for x,y in zip(a,b))
    da = math.sqrt(sum(x*x for x in a))
    db = math.sqrt(sum(y*y for y in b))
    return 0.0 if da==0 or db==0 else num/(da*db)

def _chunk(text: str, n=1600):
    for i in range(0, len(text), n):
        yield (i//n)+1, text[i:i+n]

# ---------- Scopes (conv + ns)
def _conv_and_ns():
    conv = ns = None
    ct = request.content_type or ""
    if request.method in ("POST","PUT","PATCH"):
        if "multipart/form-data" in ct:
            conv = request.form.get("conv"); ns = request.form.get("ns")
        elif "application/json" in ct or "text/json" in ct:
            j = request.get_json(silent=True) or {}
            conv = j.get("conversationId") or j.get("conv"); ns = j.get("ns")
    conv = conv or request.args.get("conv")
    ns = ns or request.args.get("ns") or request.headers.get("X-Doc-NS")
    conv = (str(conv).strip() if conv else None)
    ns = (ns or "guest").strip().lower()
    return conv, ns

def _scopes_for_read():
    conv, ns = _conv_and_ns()
    out = []
    if conv: out.append(f"conv::{conv}")
    if ns: out.append(ns)
    return list(dict.fromkeys([x for x in out if x]))

def _scopes_for_write():
    conv, ns = _conv_and_ns()
    out = []
    if conv: out.append(f"conv::{conv}")
    if ns: out.append(ns)
    out = list(dict.fromkeys([x for x in out if x]))
    return out or ["guest"]

# ---------- Helpers journal web ----------
def _log_scope_key() -> str:
    conv, ns = _conv_and_ns()
    if conv:
        return f"conv::{conv}"
    return (ns or "guest").strip().lower()

def _append_search(role: str, content: str, citations: Optional[List[Dict[str, Any]]] = None):
    item: Dict[str, Any] = {
        "ts": datetime.utcnow().isoformat() + "Z",
        "role": role,
        "content": content or ""
    }
    if citations:
        item["citations"] = citations
    SEARCH_LOGS[_log_scope_key()].append(item)

# ---------- Dates
def _parse_dt(s: Optional[str], default: datetime) -> datetime:
    if not s: return default
    s = s.strip()
    try:
        if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
            return datetime.fromisoformat(s)
        if s.endswith("Z"):
            return datetime.fromisoformat(s[:-1]).replace(tzinfo=None)
        if "T" in s:
            return datetime.fromisoformat(s)
        m = re.match(r"^(\d{2})/(\d{2})/(\d{4})$", s)
        if m:
            return datetime(int(m[3]), int(m[2]), int(m[1]))
        if s.isdigit():
            return datetime.fromtimestamp(int(s), tz=timezone.utc).replace(tzinfo=None)
    except Exception:
        pass
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return default

def _date_range_from_request() -> Tuple[datetime, datetime]:
    now = datetime.utcnow()
    default_from = now - timedelta(days=14)
    f = request.args.get("from"); t = request.args.get("to")
    if not f and request.is_json:
        b = request.get_json(silent=True) or {}
        f = b.get("from"); t = b.get("to")
    return (_parse_dt(f, default_from) if f else default_from,
            _parse_dt(t, now) if t else now)

# ---------- Détection schéma appli
def _detect_schema(conn) -> Dict[str, Any]:
    cols = conn.execute(text("""
        SELECT table_schema, table_name, column_name
        FROM information_schema.columns
        WHERE table_schema NOT IN ('pg_catalog','information_schema')
    """)).mappings().all()
    table_cols: Dict[str, set] = defaultdict(set)
    for r in cols:
        table_cols[r["table_name"]].add(r["column_name"])

    # users
    user_tables = [t for t in table_cols if "user" in t.lower()
                   and any(c.lower().startswith("created") for c in table_cols[t])]
    if "users" in table_cols and any(c.lower()=="created_at" for c in table_cols["users"]):
        user_tables = ["users"] + [t for t in user_tables if t!="users"]
    users_tbl = user_tables[0] if user_tables else None
    user_created = None
    if users_tbl:
        lc = {c.lower(): c for c in table_cols[users_tbl]}
        for cand in ["created_at","createdat","created_on","start_date","created"]:
            if cand in lc: user_created = lc[cand]; break
        if not user_created:
            for k in sorted(lc):
                if k.startswith("created"): user_created = lc[k]; break

    # messages (need conversation_id + created* + text-like col)
    def any_text_col(t: str) -> Optional[str]:
        cand = ["user_message","bot_reply","content","text","body","message","answer",
                "question","user_query","assistant_reply","payload"]
        exist = {c.lower(): c for c in table_cols.get(t, set())}
        for c in cand:
            if c in exist: return exist[c]
        return None

    msg_candidates = []
    for t in table_cols:
        lc = {c.lower() for c in table_cols[t]}
        if "conversation_id" in lc and any(c.startswith("created") for c in lc):
            txt = any_text_col(t)
            if txt: msg_candidates.append((t, txt))
    msg_candidates.sort(key=lambda x: (0 if "message" in x[0].lower() else 1, x[0]))
    messages_tbl = msg_candidates[0][0] if msg_candidates else None
    message_text_col = msg_candidates[0][1] if msg_candidates else None
    msg_created = None
    if messages_tbl:
        lc = {c.lower(): c for c in table_cols[messages_tbl]}
        for cand in ["created_at","createdat","timestamp","date","created_on"]:
            if cand in lc: msg_created = lc[cand]; break
        if not msg_created:
            for k in sorted(lc):
                if k.startswith("created"): msg_created = lc[k]; break

    # conversations (started/ended)
    conv_tables = [t for t in table_cols if any(c.lower() in ("started_at","start_date","startedat")
                                                for c in table_cols[t])]
    conversations_tbl = conv_tables[0] if conv_tables else None
    conv_started = conv_ended = None
    if conversations_tbl:
        lc = {c.lower(): c for c in table_cols[conversations_tbl]}
        for cand in ["started_at","start_date","startedat"]:
            if cand in lc: conv_started = lc[cand]; break
        for cand in ["ended_at","end_date","endedat"]:
            if cand in lc: conv_ended = lc[cand]; break

    return {
        "users_tbl": users_tbl,
        "user_created_col": user_created,
        "messages_tbl": messages_tbl,
        "message_text_col": message_text_col,
        "msg_created_col": msg_created,
        "conversations_tbl": conversations_tbl,
        "conv_started_col": conv_started,
        "conv_ended_col": conv_ended,
    }

with ENGINE.connect() as _c:
    SCHEMA_MAP = _detect_schema(_c)

def _safe_ident(name: str) -> str: return f'"{name}"'
def _require(key: str):
    v = SCHEMA_MAP.get(key)
    if not v: raise RuntimeError(f"Schéma manquant: {key}")
    return v

TEXT_TYPES = {"text", "character varying", "character", "varchar"}
CAND_TEXT_KEYS = ["user_message","bot_reply","content","text","message",
                  "prompt","answer","question","utterance","user_query","assistant_reply","payload"]

def _cols_with_types(conn, table: str):
    rows = conn.execute(text("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = :t
    """), {"t": table}).mappings().all()
    return [(r["column_name"], r["data_type"]) for r in rows]

def _forced_text_cols_from_env() -> List[str]:
    raw = (os.getenv("MSG_TEXT_COLS") or "").strip()
    return [c.strip() for c in raw.split(",") if c.strip()] if raw else []

def _build_text_expr(conn, table: str) -> str:
    forced = set(c.lower() for c in _forced_text_cols_from_env())
    cols = _cols_with_types(conn, table)
    parts = []
    # text/varchar
    for col, dtype in cols:
        dl = (dtype or "").lower()
        if dl in TEXT_TYPES:
            if forced and col.lower() not in forced: continue
            parts.append(_safe_ident(col))
    # json/jsonb
    for col, dtype in cols:
        dl = (dtype or "").lower()
        if "json" in dl:
            keys = CAND_TEXT_KEYS
            json_concat = " || ' ' || ".join([f"COALESCE({_safe_ident(col)}->>'{k}', '')" for k in keys])
            parts.append(f"({json_concat})")
    # fallback
    if not parts:
        existing = {c for c, _ in cols}
        for cand in CAND_TEXT_KEYS:
            if cand in existing:
                parts.append(_safe_ident(cand))
    if not parts:
        return "''"
    return "COALESCE((" + " || ' ' || ".join(parts) + "), '')"

def _stopwords_en_ar():
    STOP_EN = set("a an and are as at be but by for from has have i in is it its of on or our out so the to with you your".split())
    STOP_AR = set("و في من على مع عن إلى الى هذا هذه ذلك تلك ما ماذا لماذا ليس كانت كان يكون تكون نحن أن ان هو هي هم هن".split())
    return STOP_EN | STOP_AR

# ---------- Health / Env
@app.get("/health")
def health():
    total_docs = sum(len(v) for v in DOCS.values())
    return {"ok": True, "scopes": len(DOCS), "docs_total": total_docs,
            "ai_ready": bool(MODEL), "schema": SCHEMA_MAP}

@app.get("/envcheck")
def envcheck():
    return {
        "GOOGLE_API_KEY_set": bool(os.getenv("GOOGLE_API_KEY")),
        "GEMINI_API_KEY_set": bool(os.getenv("GEMINI_API_KEY")),
        "configured": bool(MODEL),
        "DATABASE_URL_set": bool(PG_URL),
        "db_dialect": "postgresql",
        "schema": SCHEMA_MAP
    }

# ---------- Docs / Ingest / Search
@app.get("/docs")
def list_docs():
    scopes = _scopes_for_read()
    seen=set(); out=[]
    for sc in scopes:
        for d,ch in DOCS.get(sc,{}).items():
            if (sc,d) in seen: continue
            seen.add((sc,d)); out.append({"name": d, "pages": len(ch), "scope": sc})
    return jsonify({"ok": True, "scopes": scopes, "count": len(out), "docs": out})

@app.post("/ingest")
def ingest():
    targets = _scopes_for_write()
    if request.content_type and "application/json" in request.content_type:
        data = request.get_json() or {}
        name = data.get("name") or f"doc_{uuid.uuid4().hex[:6]}"
        pages=[]
        for p in data.get("pages",[]):
            t = p.get("text","")
            pages.append({"page": int(p.get("page",1)), "text": t, "vec": embed(t)})
        for sc in targets:
            DOCS[sc][name].clear(); DOCS[sc][name].extend(pages)
        return jsonify({"ok": True, "scopes": targets, "doc": name, "pages": len(pages)})
    f = request.files.get("file")
    if not f: return jsonify({"error":"Aucun fichier"}),400
    filename=(f.filename or "").strip()
    name = filename or f"doc_{uuid.uuid4().hex[:6]}"
    lower = filename.lower()
    if lower.endswith(".pdf"):
        if not HAS_PDF: return jsonify({"error":"pypdf manquant (pip install pypdf)"}),500
        reader = PdfReader(f.stream); pages=[]
        for i,page in enumerate(reader.pages,1):
            t=(page.extract_text() or "").strip()
            pages.append({"page":i,"text":t,"vec":embed(t)})
        for sc in targets: DOCS[sc][name].clear(); DOCS[sc][name].extend(pages)
        return jsonify({"ok":True,"scopes":targets,"doc":name,"pages":len(pages)})
    if lower.endswith(".csv"):
        content=f.read().decode(errors="ignore")
        rows=list(csv.reader(io.StringIO(content)))
        header=rows[0] if rows else []
        text="\n".join([", ".join(r) for r in rows[:2000]])
        pages=[]
        for pageno,ch in _chunk(text): pages.append({"page":pageno,"text":ch,"vec":embed(ch)})
        for sc in targets: DOCS[sc][name].clear(); DOCS[sc][name].extend(pages)
        return jsonify({"ok":True,"scopes":targets,"doc":name,"pages":len(pages),"columns":header})
    text=f.read().decode(errors="ignore"); pages=[]
    for pageno,ch in _chunk(text): pages.append({"page":pageno,"text":ch,"vec":embed(ch)})
    for sc in targets: DOCS[sc][name].clear(); DOCS[sc][name].extend(pages)
    return jsonify({"ok":True,"scopes":targets,"doc":name,"pages":len(pages)})

@app.post("/search")
def search():
    data=request.get_json() or {}
    q=(data.get("q") or "").strip(); k=int(data.get("k") or 5); qv=embed(q)
    scopes=_scopes_for_read(); hits=[]
    for sc in scopes:
        for doc,chunks in DOCS.get(sc,{}).items():
            for ch in chunks:
                score=cosine(qv,ch["vec"])
                hits.append({"scope":sc,"doc":doc,"page":ch["page"],"excerpt":ch["text"][:800],"score":float(score)})
    hits.sort(key=lambda x:x["score"], reverse=True)
    return jsonify(hits[:k])

# ---------- Analytics REST (inchangé, gardé)
@app.get("/analytics")
def analytics():
    dt_from, dt_to = _date_range_from_request()
    with ENGINE.connect() as conn:
        users_total=0; daily=[]
        if SCHEMA_MAP.get("users_tbl") and SCHEMA_MAP.get("user_created_col"):
            ut, uc = SCHEMA_MAP["users_tbl"], SCHEMA_MAP["user_created_col"]
            users_total = conn.execute(text(f"""
                SELECT COUNT(*) FROM "{ut}"
                WHERE {_safe_ident(uc)} BETWEEN :f AND :t
            """), {"f":dt_from,"t":dt_to}).scalar() or 0
            daily_rows = conn.execute(text(f"""
                SELECT DATE({_safe_ident(uc)}) AS d, COUNT(*) AS c
                FROM "{ut}"
                WHERE {_safe_ident(uc)} BETWEEN :f AND :t
                GROUP BY DATE({_safe_ident(uc)}) ORDER BY d
            """), {"f":dt_from,"t":dt_to}).mappings().all()
            daily=[{"date":str(r["d"]), "count":int(r["c"])} for r in daily_rows]

        mt, mc = _require("messages_tbl"), _require("msg_created_col")
        active = conn.execute(text(f"""
            SELECT COUNT(DISTINCT {_safe_ident('conversation_id')})
            FROM "{mt}" m
            WHERE m.{_safe_ident(mc)} BETWEEN :f AND :t
        """), {"f":dt_from,"t":dt_to}).scalar() or 0

        ct, cs, ce = SCHEMA_MAP.get("conversations_tbl"), SCHEMA_MAP.get("conv_started_col"), SCHEMA_MAP.get("conv_ended_col")
        if ct and cs and ce:
            avg = conn.execute(text(f"""
                SELECT AVG(EXTRACT(EPOCH FROM ({_safe_ident(ce)} - {_safe_ident(cs)}))/60.0)
                FROM "{ct}"
                WHERE {_safe_ident(cs)} BETWEEN :f AND :t
                  AND {_safe_ident(ce)} IS NOT NULL
                  AND {_safe_ident(ce)} >= {_safe_ident(cs)}
            """), {"f":dt_from,"t":dt_to}).scalar() or 0.0
        else:
            avg = conn.execute(text(f"""
                WITH mm AS (
                  SELECT {_safe_ident('conversation_id')} AS cid,
                         MIN(m.{_safe_ident(mc)}) AS first_ts,
                         MAX(m.{_safe_ident(mc)}) AS last_ts
                  FROM "{mt}" m
                  WHERE m.{_safe_ident(mc)} BETWEEN :f AND :t
                  GROUP BY {_safe_ident('conversation_id')}
                )
                SELECT AVG(EXTRACT(EPOCH FROM (last_ts - first_ts))/60.0)
                FROM mm WHERE last_ts >= first_ts
            """), {"f":dt_from,"t":dt_to}).scalar() or 0.0

    return jsonify({
        "ok": True,
        "from": dt_from.isoformat(),
        "to": dt_to.isoformat(),
        "users": int(users_total),
        "activeConversations": int(active),
        "avgMinutes": round(float(avg or 0.0),3),
        "dailySignups": daily
    })

@app.get("/analytics/messages-per-day")
def analytics_messages_per_day():
    dt_from, dt_to = _date_range_from_request()
    mt, mc = _require("messages_tbl"), _require("msg_created_col")
    with ENGINE.connect() as conn:
        rows = conn.execute(text(f"""
            SELECT DATE(m.{_safe_ident(mc)}) AS date, COUNT(*)::int AS value
            FROM "{mt}" m
            WHERE m.{_safe_ident(mc)} BETWEEN :f AND :t
            GROUP BY DATE(m.{_safe_ident(mc)}) ORDER BY date
        """), {"f":dt_from,"t":dt_to}).mappings().all()
    return jsonify([{"date":str(r["date"]), "value":int(r["value"])} for r in rows])

@app.get("/analytics/avg-conv-duration")
def analytics_avg_conv_duration():
    dt_from, dt_to = _date_range_from_request()
    ct, cs, ce = SCHEMA_MAP.get("conversations_tbl"), SCHEMA_MAP.get("conv_started_col"), SCHEMA_MAP.get("conv_ended_col")
    if ct and cs and ce:
        with ENGINE.connect() as conn:
            val = conn.execute(text(f"""
                SELECT AVG(EXTRACT(EPOCH FROM ({_safe_ident(ce)} - {_safe_ident(cs)}))/60.0)
                FROM "{ct}"
                WHERE {_safe_ident(cs)} BETWEEN :f AND :t
                  AND {_safe_ident(ce)} IS NOT NULL
                  AND {_safe_ident(ce)} >= {_safe_ident(cs)}
            """), {"f":dt_from,"t":dt_to}).scalar() or 0.0
        return jsonify({"key":"avgMinutes","value":float(val)})
    mt, mc = _require("messages_tbl"), _require("msg_created_col")
    with ENGINE.connect() as conn:
        val = conn.execute(text(f"""
            WITH mm AS (
              SELECT {_safe_ident('conversation_id')} AS cid,
                     MIN(m.{_safe_ident(mc)}) AS first_ts,
                     MAX(m.{_safe_ident(mc)}) AS last_ts
              FROM "{mt}" m
              WHERE m.{_safe_ident(mc)} BETWEEN :f AND :t
              GROUP BY {_safe_ident('conversation_id')}
            )
            SELECT AVG(EXTRACT(EPOCH FROM (last_ts - first_ts))/60.0)
            FROM mm WHERE last_ts >= first_ts
        """), {"f":dt_from,"t":dt_to}).scalar() or 0.0
    return jsonify({"key":"avgMinutes","value":float(val)})

@app.get("/analytics/heatmap")
def analytics_heatmap():
    dt_from, dt_to = _date_range_from_request()
    mt, mc = _require("messages_tbl"), _require("msg_created_col")
    with ENGINE.connect() as conn:
        cells = conn.execute(text(f"""
            SELECT CAST(EXTRACT(DOW  FROM m.{_safe_ident(mc)}) AS INT) AS dow,
                   CAST(EXTRACT(HOUR FROM m.{_safe_ident(mc)}) AS INT) AS hour,
                   COUNT(*)::int AS count
            FROM "{mt}" m
            WHERE m.{_safe_ident(mc)} BETWEEN :f AND :t
            GROUP BY 1,2 ORDER BY 1,2
        """), {"f":dt_from,"t":dt_to}).mappings().all()
    return jsonify([{"dow":r["dow"],"hour":r["hour"],"count":r["count"]} for r in cells])

@app.get("/analytics/top-keywords")
def analytics_top_keywords():
    dt_from, dt_to = _date_range_from_request()
    limit = int(request.args.get("limit") or 20)
    mt, mc = _require("messages_tbl"), _require("msg_created_col")
    with ENGINE.connect() as conn:
        text_expr = _build_text_expr(conn, mt)
        rows = conn.execute(text(f"""
            SELECT {text_expr} AS content
            FROM "{mt}" m
            WHERE m.{_safe_ident(mc)} BETWEEN :f AND :t
        """), {"f": dt_from, "t": dt_to}).fetchmany(200000)
    word_re = re.compile(r"\w+", flags=re.UNICODE)
    STOP = _stopwords_en_ar()
    cnt = Counter()
    for (content,) in rows:
        for w in word_re.findall((content or "").lower()):
            if len(w) < 2 or w in STOP or w == "_": continue
            cnt[w] += 1
    top = cnt.most_common(limit)
    return jsonify([{"word": w, "count": c} for w, c in top])

@app.get("/analytics/signups-per-day")
def analytics_signups_per_day():
    dt_from, dt_to = _date_range_from_request()
    ut, uc = SCHEMA_MAP.get("users_tbl"), SCHEMA_MAP.get("user_created_col")
    if not (ut and uc): return jsonify([])
    with ENGINE.connect() as conn:
        rows = conn.execute(text(f"""
            SELECT DATE({_safe_ident(uc)}) AS date, COUNT(*)::int AS count
            FROM "{ut}"
            WHERE {_safe_ident(uc)} BETWEEN :f AND :t
            GROUP BY DATE({_safe_ident(uc)}) ORDER BY date
        """), {"f":dt_from,"t":dt_to}).mappings().all()
    return jsonify([{"date":str(r["date"]), "count":int(r["count"])} for r in rows])

@app.get("/analytics/debug/text-columns")
def analytics_debug_text_columns():
    dt_from, dt_to = _date_range_from_request()
    mt, mc = _require("messages_tbl"), _require("msg_created_col")
    limit = int(request.args.get("limit") or 5)
    with ENGINE.connect() as conn:
        cols = _cols_with_types(conn, mt)
        text_expr = _build_text_expr(conn, mt)
        non_empty = conn.execute(text(f"""
            SELECT COUNT(*) FROM "{mt}" m
            WHERE m.{_safe_ident(mc)} BETWEEN :f AND :t
              AND {text_expr} <> ''
        """), {"f": dt_from, "t": dt_to}).scalar() or 0
        samples = conn.execute(text(f"""
            SELECT {text_expr} AS content
            FROM "{mt}" m
            WHERE m.{_safe_ident(mc)} BETWEEN :f AND :t
              AND {text_expr} <> ''
            LIMIT :lim
        """), {"f": dt_from, "t": dt_to, "lim": limit}).fetchall()
    return jsonify({
        "table": mt,
        "created_col": mc,
        "columns": [{"name": c, "type": t} for c, t in cols],
        "nonEmptyRows": int(non_empty),
        "samples": [s[0][:160] for s in samples]
    })

# ---------- METRICS (latence) — inchangé
def _ensure_latency_table():
    with ENGINE.begin() as conn:
        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS bot_latency_metrics (
          ts_bucket   timestamptz PRIMARY KEY,
          p50_seconds numeric NOT NULL,
          p90_seconds numeric NOT NULL,
          avg_seconds numeric NOT NULL,
          samples     integer NOT NULL
        );"""))
_ensure_latency_table()

def _window_from_params(p):
    now = datetime.utcnow()
    f = p.get("from"); t = p.get("to")
    return (_parse_dt(f, now - timedelta(days=14)),
            _parse_dt(t, now))

@app.post("/metrics/latency-upsert")
def metrics_latency_upsert():
    data = request.get_json(silent=True)
    if data is None and request.data:
        try: data = json.loads(request.data.decode("utf-8"))
        except Exception: data = {}
    ts = data.get("ts_bucket")
    p50 = float(data.get("p50", data.get("p50_seconds", 0)))
    p90 = float(data.get("p90", data.get("p90_seconds", 0)))
    avg = float(data.get("avg", data.get("avg_seconds", 0)))
    samples = int(data.get("samples", 0))
    if not ts:
        return jsonify({"error":"ts_bucket manquant"}), 400
    ts_dt = _parse_dt(str(ts), datetime.utcnow().replace(minute=0, second=0, microsecond=0))
    with ENGINE.begin() as conn:
        conn.execute(text("""
            INSERT INTO bot_latency_metrics (ts_bucket, p50_seconds, p90_seconds, avg_seconds, samples)
            VALUES (:ts, :p50, :p90, :avg, :s)
            ON CONFLICT (ts_bucket) DO UPDATE SET
              p50_seconds = EXCLUDED.p50_seconds,
              p90_seconds = EXCLUDED.p90_seconds,
              avg_seconds = EXCLUDED.avg_seconds,
              samples     = EXCLUDED.samples
        """), {"ts": ts_dt, "p50": p50, "p90": p90, "avg": avg, "s": samples})
    return jsonify({"ok": True, "upserted": {"ts_bucket": ts_dt.isoformat()+"Z",
                                             "p50": p50, "p90": p90, "avg": avg, "samples": samples}})

@app.get("/metrics/latency-window")
def metrics_latency_window():
    dt_from, dt_to = _date_range_from_request()
    with ENGINE.connect() as conn:
        rows = conn.execute(text("""
            SELECT ts_bucket AT TIME ZONE 'UTC' AS ts,
                   p50_seconds AS p50,
                   p90_seconds AS p90,
                   avg_seconds AS avg,
                   samples
            FROM bot_latency_metrics
            WHERE ts_bucket BETWEEN :f AND :t
            ORDER BY ts_bucket
        """), {"f": dt_from, "t": dt_to}).mappings().all()
    series = [{"ts": r["ts"].isoformat()+"Z",
               "p50": float(r["p50"]),
               "p90": float(r["p90"]),
               "avg": float(r["avg"]),
               "samples": int(r["samples"])} for r in rows]
    return jsonify(series)

@app.get("/metrics/summary")
def metrics_summary():
    dt_from, dt_to = _date_range_from_request()
    slo = float(request.args.get("slo_p90") or 0.8)
    with ENGINE.connect() as conn:
        rows = conn.execute(text("""
            SELECT ts_bucket AT TIME ZONE 'UTC' AS ts,
                   p90_seconds AS p90
            FROM bot_latency_metrics
            WHERE ts_bucket BETWEEN :f AND :t
            ORDER BY ts_bucket
        """), {"f": dt_from, "t": dt_to}).mappings().all()
    p90s = [float(r["p90"]) for r in rows]
    ts   = [r["ts"] for r in rows]
    points = len(p90s)

    if points >= 2:
        xs = [(t - ts[0]).total_seconds()/3600.0 for t in ts]
        xbar = sum(xs)/points; ybar = sum(p90s)/points
        num = sum((x - xbar)*(y - ybar) for x,y in zip(xs, p90s))
        den = sum((x - xbar)**2 for x in xs) or 1.0
        slope = num/den
        direction = "hausse" if slope > 0 else ("baisse" if slope < 0 else "stable")
    else:
        slope = 0.0; direction = "stable"

    p90_min = min(p90s) if p90s else None
    p90_max = max(p90s) if p90s else None
    p90_med = (sorted(p90s)[points//2] if points else None)
    p90_avg = (sum(p90s)/points) if points else None
    min_ts = ts[p90s.index(p90_min)] if points else None
    max_ts = ts[p90s.index(p90_max)] if points else None

    baseline_p95 = None
    if points:
        s = sorted(p90s); k = max(0, int(0.95*points)-1); baseline_p95 = s[k]

    anomalies = 0
    if baseline_p95 is not None:
        anomalies = sum(1 for v in p90s if v > baseline_p95)

    used_llm = False
    summary_text = "Pas de données."
    if points:
        prompt = (
            "Rédige un court résumé SRE actionnable en français pour un tableau de latence P90.\n"
            f"Période: {dt_from.isoformat()} -> {dt_to.isoformat()}\n"
            f"Statistiques: min={p90_min}, max={p90_max} (à {max_ts}), médiane={p90_med}, moyenne={p90_avg}.\n"
            f"SLO_P90_cible={slo}. Tendance={direction} (pente={slope:.2f} s/heure). "
            f"Anomalies_vs_baseline_p95={anomalies}.\n"
            "Structure: *Pics*, *Tendance*, *Anomalies*, *Trafic*, *Conformité SLO*, **Conseils**."
        )
        if MODEL:
            try:
                resp = MODEL.generate_content(prompt)
                summary_text = (resp.text or "").strip(); used_llm = True
            except Exception:
                used_llm = False
                summary_text = f"Résumé IA indisponible. p90 min={p90_min}, max={p90_max}, moyenne={p90_avg}, tendance {direction}."
        else:
            summary_text = f"Résumé IA désactivé. p90 min={p90_min}, max={p90_max}, moyenne={p90_avg}, tendance {direction}."

    payload = {
        "period": {"from": dt_from.isoformat()+"Z", "to": dt_to.isoformat()+"Z"},
        "points": points,
        "slo_p90": slo,
        "trend": {"direction": direction, "slope_sec_per_hour": round(slope,2)},
        "p90": {
            "min": p90_min, "min_ts": min_ts.isoformat()+"Z" if min_ts else None,
            "max": p90_max, "max_ts": max_ts.isoformat()+"Z" if max_ts else None,
            "median": p90_med, "avg": p90_avg
        },
        "anomalies_vs_baseline_p95": anomalies,
        "corr_p90_traffic": None
    }
    return jsonify({"ok": True, "data": payload, "summary_text": summary_text, "used_llm": used_llm})

@app.get("/metrics/forecast-risk")
def metrics_forecast_risk():
    horizon_min = int(request.args.get("horizon_min") or 60)
    bucket_min  = int(request.args.get("bucket_min") or 5)
    alpha       = float(request.args.get("alpha") or 0.35)
    slo         = float(request.args.get("slo_p90") or 0.8)

    now = datetime.utcnow()
    dt_from = now - timedelta(hours=6)
    dt_to   = now

    with ENGINE.connect() as conn:
        rows = conn.execute(text("""
            SELECT ts_bucket AT TIME ZONE 'UTC' AS ts,
                   p90_seconds AS p90
            FROM bot_latency_metrics
            WHERE ts_bucket BETWEEN :f AND :t
            ORDER BY ts_bucket
        """), {"f": dt_from, "t": dt_to}).mappings().all()

    hist = [float(r["p90"]) for r in rows]
    if not hist:
        points=[]; t = now.replace(second=0, microsecond=0)
        for i in range(0, horizon_min, bucket_min):
            points.append({
                "ts": (t + timedelta(minutes=i)).isoformat()+"Z",
                "p90_pred": slo, "low": max(0.0, slo-0.2), "high": slo+0.2,
                "prob_exceed_slo": 0.5, "prob_exceed_baseline": None,
                "baseline_p95": None, "risk_level": "medium"
            })
        return jsonify({"ok": True, "bucket_min": bucket_min, "alpha": alpha,
                        "slo_p90": slo, "overall_max_prob": 0.5, "alert": False, "points": points})

    s = sorted(hist); k = max(0, int(0.95*len(s))-1); baseline_p95 = s[k]
    ema = hist[-1]
    sigma = max(0.05, abs(max(hist) - min(hist)) / 6.0)
    t0 = now.replace(second=0, microsecond=0)
    horizon_points = list(range(0, horizon_min, bucket_min))
    out=[]; maxprob = 0.0; alert = False
    for i in horizon_points:
        ema = alpha*ema + (1-alpha)*ema
        low = max(0.0, ema - sigma/2.0)
        high= ema + sigma/2.0

        def prob_exceed(thr: float) -> float:
            if thr is None: return None
            if high <= thr: return 0.0
            if low  >= thr: return 1.0
            return (high - thr) / max(1e-6, (high - low))

        p_slo = prob_exceed(slo)
        p_base= prob_exceed(baseline_p95)
        maxprob = max(maxprob, p_slo or 0.0)
        if (p_slo or 0.0) >= 0.8: alert = True

        out.append({
            "ts": (t0 + timedelta(minutes=i)).isoformat()+"Z",
            "p90_pred": round(ema, 3),
            "low": round(low, 3), "high": round(high, 3),
            "prob_exceed_slo": round(p_slo or 0.0, 3),
            "prob_exceed_baseline": round(p_base, 3) if p_base is not None else None,
            "baseline_p95": round(baseline_p95,3) if baseline_p95 is not None else None,
            "risk_level": "high" if (p_slo or 0.0) >= 0.8 else ("medium" if (p_slo or 0.0) >= 0.4 else "low")
        })

    return jsonify({"ok": True, "bucket_min": bucket_min, "alpha": alpha,
                    "slo_p90": slo, "overall_max_prob": round(maxprob,3),
                    "alert": alert, "points": out})

# ===== Utilitaire de recherche externe (SERP/API/HTML) =====
def _search_web(query: str, k: int = 5) -> List[Dict[str, str]]:
    provider = (os.getenv("SEARCH_PROVIDER") or "ddg").strip().lower()
    out: List[Dict[str, str]] = []
    try:
        # SerpAPI
        if provider == "serpapi" and os.getenv("SERPAPI_KEY"):
            r = requests.get("https://serpapi.com/search.json", params={
                "q": query, "engine": "google", "num": k, "hl": "fr", "api_key": os.getenv("SERPAPI_KEY")
            }, timeout=12)
            r.raise_for_status()
            data = r.json()
            for item in (data.get("organic_results") or [])[:k]:
                out.append({"title": item.get("title",""), "url": item.get("link",""), "snippet": item.get("snippet","")})
            return out
        # Bing V7
        if provider == "bing" and os.getenv("BING_V7_KEY"):
            r = requests.get("https://api.bing.microsoft.com/v7.0/search",
                             headers={"Ocp-Apim-Subscription-Key": os.getenv("BING_V7_KEY")},
                             params={"q": query, "count": k, "mkt": "fr-FR"}, timeout=12)
            r.raise_for_status()
            data = r.json()
            for item in (data.get("webPages", {}).get("value") or [])[:k]:
                out.append({"title": item.get("name",""), "url": item.get("url",""), "snippet": item.get("snippet","")})
            return out
        # Google CSE
        if provider == "google_cse" and os.getenv("GOOGLE_API_KEY") and os.getenv("GOOGLE_CSE_ID"):
            r = requests.get("https://www.googleapis.com/customsearch/v1", params={
                "key": os.getenv("GOOGLE_API_KEY"),
                "cx": os.getenv("GOOGLE_CSE_ID"),
                "q": query, "num": min(k,10), "hl": "fr"
            }, timeout=12)
            r.raise_for_status()
            data = r.json()
            for item in (data.get("items") or [])[:k]:
                out.append({"title": item.get("title",""), "url": item.get("link",""), "snippet": item.get("snippet","")})
            return out
        # Fallback DuckDuckGo HTML
        r = requests.post("https://html.duckduckgo.com/html/",
                          data={"q": query}, headers={"User-Agent": "Mozilla/5.0"}, timeout=12)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        for a in soup.select(".result__a")[:k]:
            title = a.get_text(strip=True)
            url = a.get("href") or ""
            sn_el = a.find_parent(class_="result__title")
            desc_el = sn_el.find_next_sibling(class_="result__snippet") if sn_el else None
            snippet = desc_el.get_text(" ", strip=True) if desc_el else ""
            out.append({"title": title, "url": url, "snippet": snippet})
    except Exception as e:
        print("search error:", e)
    return out

# ---------- MCP (UN SEUL handler)
@app.post("/mcp/execute")
def mcp_execute():
    try:
        data = request.get_json(silent=True)
        if data is None and request.data:
            try: data = json.loads(request.data.decode("utf-8"))
            except Exception: data = {}
        data = data or {}
        action = data.get("action")
        params = (data.get("parameters") or {}) if isinstance(data.get("parameters"), dict) else {}
        rid = data.get("id", uuid.uuid4().hex)

        app.logger.info(f"[MCP] action={action} params_keys={list((data.get('parameters') or {}).keys())}")

        def ok(payload):
            return jsonify({"version":"1.0","id":rid,"status":"success","data":payload})
        def err(msg, code=400):
            return jsonify({"version":"1.0","id":rid,"status":"error","error":msg}), code

        if not action:
            return err("Missing 'action' in body JSON.")

        # ---- GENERAL CHAT
        if action == "general_conversation":
            if not MODEL:
                return ok({"reply":"Le moteur IA n'est pas configuré (clé API manquante)."})
            msg = params.get("message","")
            resp = MODEL.generate_content(msg)
            return ok({"reply": (resp.text or "").strip()})

        # ---- DOCQA SEARCH
        if action == "docqa_search":
            scopes = _scopes_for_read()
            q = (params.get("q") or "").strip()
            k = int(params.get("k") or 5)
            qv = embed(q)
            hits=[]
            for sc in scopes:
                for doc, chunks in DOCS.get(sc, {}).items():
                    for ch in chunks:
                        score = cosine(qv, ch["vec"])
                        hits.append({"doc": doc, "page": ch["page"], "excerpt": ch["text"][:800], "score": float(score), "scope": sc})
            hits.sort(key=lambda x: x["score"], reverse=True)
            reply = "Aucune correspondance." if not hits else "\n".join(
                f"- {h['doc']} p.{h['page']} ({h['score']:.2f}): {h['excerpt'][:200]}…" for h in hits[:k]
            )
            return ok({"reply": reply, "citations": hits[:k]})

        # ===== Recherche externe =====
        if action in ("external_search", "web_search"):
            q = (params.get("query") or params.get("q") or "").strip()
            k = int(params.get("k") or 5)
            if not q:
                return err("Paramètre 'query' (ou 'q') manquant.")
            results = _search_web(q, k)
            # log: question utilisateur seulement
            _append_search("user", q, None)
            return ok({"results": results})

        if action in ("external_answer", "web_answer"):
            q = (params.get("query") or params.get("q") or "").strip()
            k = int(params.get("k") or 5)
            if not q:
                return err("Paramètre 'query' (ou 'q') manquant.")
            results = _search_web(q, k)
            if not MODEL:
                text_ans = "IA non configurée. Voici des sources potentielles :\n" + \
                           "\n".join([f"- {r['title']} — {r['url']}" for r in results])
                # log user + assistant
                _append_search("user", q, None)
                _append_search("assistant", text_ans, results)
                return ok({"reply": text_ans, "citations": results})
            ctx = "\n\n".join([f"[{i}] {r['title']} — {r['snippet']}\nURL:{r['url']}"
                               for i, r in enumerate(results, start=1)])
            prompt = (
                "Réponds en français de façon factuelle et concise en te basant STRICTEMENT "
                "sur les extraits fournis et en citant les sources au format [n].\n\n"
                f"Contexte:\n{ctx}\n\nQuestion: {q}\n"
                "Termine par une section 'Sources' listant [n] Titre — URL."
            )
            try:
                resp = MODEL.generate_content(prompt)
                out = (resp.text or "").strip()
            except Exception:
                out = "Erreur lors de la génération de la réponse."
            # log user + assistant
            _append_search("user", q, None)
            _append_search("assistant", out, results)
            return ok({"reply": out, "citations": results})

        # ---- DOCQA ANSWER (RAG)
        if action == "docqa_answer":
            if not MODEL:
                return ok({"reply":"Le moteur IA n'est pas configuré (clé API manquante)."})
            scopes = _scopes_for_read()
            q = (params.get("q") or "").strip()
            k = int(params.get("k") or 5)
            only_doc = params.get("doc")
            only_docs = params.get("docs") or []
            allow = set([only_doc] if only_doc else []) | set(only_docs)
            qv = embed(q)
            hits=[]
            for sc in scopes:
                for doc, chunks in DOCS.get(sc, {}).items():
                    if allow and doc not in allow: continue
                    for ch in chunks:
                        score = cosine(qv, ch["vec"])
                        hits.append({"doc": doc, "page": ch["page"], "excerpt": ch["text"][:1200], "score": float(score)})
            hits.sort(key=lambda x: x["score"], reverse=True)
            top = hits[:k]
            if not top:
                return ok({"reply":"NO_CONTEXT", "citations": []})
            ctx = "\n\n".join([f"[{h['doc']} p.{h['page']}] {h['excerpt']}" for h in top])
            prompt = (
                "Réponds strictement à partir du contexte.\n"
                "Si l'information manque dans le contexte, dis-le franchement.\n\n"
                f"Contexte:\n{ctx}\n\nQuestion: {q}\n"
                "Réponse en français, concise, avec références [doc p.page] si utile."
            )
            resp = MODEL.generate_content(prompt)
            out = (resp.text or "").strip()
            return ok({"reply": out, "citations": top})

        # ---- Analytics MCP (inchangé)
        if action == "analytics_messages_per_day":
            dt_from, dt_to = _window_from_params(params)
            mt, mc = _require("messages_tbl"), _require("msg_created_col")
            with ENGINE.connect() as conn:
                rows = conn.execute(text(f"""
                    SELECT DATE(m.{_safe_ident(mc)}) AS date, COUNT(*)::int AS value
                    FROM "{mt}" m
                    WHERE m.{_safe_ident(mc)} BETWEEN :f AND :t
                    GROUP BY DATE(m.{_safe_ident(mc)}) ORDER BY date
                """), {"f":dt_from,"t":dt_to}).mappings().all()
            return ok([{"date":str(r["date"]), "value":int(r["value"])} for r in rows])

        if action == "analytics_avg_conv_duration":
            dt_from, dt_to = _window_from_params(params)
            ct, cs, ce = SCHEMA_MAP.get("conversations_tbl"), SCHEMA_MAP.get("conv_started_col"), SCHEMA_MAP.get("conv_ended_col")
            if ct and cs and ce:
                with ENGINE.connect() as conn:
                    val = conn.execute(text(f"""
                        SELECT AVG(EXTRACT(EPOCH FROM ({_safe_ident(ce)} - {_safe_ident(cs)}))/60.0)
                        FROM "{ct}"
                        WHERE {_safe_ident(cs)} BETWEEN :f AND :t
                          AND {_safe_ident(ce)} IS NOT NULL
                          AND {_safe_ident(ce)} >= {_safe_ident(cs)}
                    """), {"f":dt_from,"t":dt_to}).scalar() or 0.0
            else:
                mt, mc = _require("messages_tbl"), _require("msg_created_col")
                with ENGINE.connect() as conn:
                    q = f"""
                        WITH mm AS (
                          SELECT { _safe_ident('conversation_id') } AS cid,
                                 MIN(m.{ _safe_ident(mc) }) AS first_ts,
                                 MAX(m.{ _safe_ident(mc) }) AS last_ts
                          FROM "{ mt }" m
                          WHERE m.{ _safe_ident(mc) } BETWEEN :f AND :t
                          GROUP BY { _safe_ident('conversation_id') }
                        )
                        SELECT AVG(EXTRACT(EPOCH FROM (last_ts - first_ts))/60.0)
                        FROM mm WHERE last_ts >= first_ts
                    """
                    val = conn.execute(text(q), {"f": dt_from, "t": dt_to}).scalar() or 0.0
            return ok({"key":"avgMinutes","value":float(val)})

        if action == "analytics_heatmap":
            dt_from, dt_to = _window_from_params(params)
            mt, mc = _require("messages_tbl"), _require("msg_created_col")
            with ENGINE.connect() as conn:
                cells = conn.execute(text(f"""
                    SELECT CAST(EXTRACT(DOW  FROM m.{_safe_ident(mc)}) AS INT) AS dow,
                           CAST(EXTRACT(HOUR FROM m.{_safe_ident(mc)}) AS INT) AS hour,
                           COUNT(*)::int AS count
                    FROM "{mt}" m
                    WHERE m.{_safe_ident(mc)} BETWEEN :f AND :t
                    GROUP BY 1,2 ORDER BY 1,2
                """), {"f":dt_from,"t":dt_to}).mappings().all()
            return ok([{"dow":r["dow"],"hour":r["hour"],"count":r["count"]} for r in cells])

        if action == "analytics_signups_per_day":
            dt_from, dt_to = _window_from_params(params)
            ut, uc = SCHEMA_MAP.get("users_tbl"), SCHEMA_MAP.get("user_created_col")
            if not (ut and uc): return ok([])
            with ENGINE.connect() as conn:
                rows = conn.execute(text(f"""
                    SELECT DATE({_safe_ident(uc)}) AS date, COUNT(*)::int AS count
                    FROM "{ut}"
                    WHERE {_safe_ident(uc)} BETWEEN :f AND :t
                    GROUP BY DATE({_safe_ident(uc)}) ORDER BY date
                """), {"f":dt_from,"t":dt_to}).mappings().all()
            return ok([{"date":str(r["date"]), "count":int(r["count"])} for r in rows])

        return err(f"Action inconnue: {action}", 400)

    except Exception as e:
        app.logger.exception("MCP execute failed")
        return jsonify({"version":"1.0","id":uuid.uuid4().hex,"status":"error","error":str(e)}),500

# ---------- Web log API (persistance des recherches web)
@app.get("/web-log")
def web_log_get():
    conv, ns = _conv_and_ns()
    key = f"conv::{conv}" if conv else (ns or "guest").strip().lower()
    return jsonify(SEARCH_LOGS.get(key, []))

@app.post("/web-log/migrate")
def web_log_migrate():
    data = request.get_json(silent=True) or {}
    to_conv = str(data.get("toConv") or "").strip()
    if not to_conv:
        return jsonify({"ok": False, "error": "toConv manquant"}), 400
    _, ns = _conv_and_ns()
    src = (ns or "guest").strip().lower()
    dst = f"conv::{to_conv}"
    if not SEARCH_LOGS.get(src):
        return jsonify({"ok": True, "migrated": 0})
    SEARCH_LOGS[dst].extend(SEARCH_LOGS[src])
    moved = len(SEARCH_LOGS[src])
    SEARCH_LOGS[src].clear()
    return jsonify({"ok": True, "migrated": moved, "to": dst})

@app.delete("/web-log")
def web_log_clear():
    conv, ns = _conv_and_ns()
    key = f"conv::{conv}" if conv else (ns or "guest").strip().lower()
    removed = len(SEARCH_LOGS.get(key, []))
    SEARCH_LOGS[key].clear()
    return jsonify({"ok": True, "cleared": removed})

# ---------- Run
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
