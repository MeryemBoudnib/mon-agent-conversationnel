# ia_service.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import os, uuid, math, csv, io
from collections import defaultdict
from typing import Dict, List, Any

# ---- ENV
from dotenv import load_dotenv
load_dotenv()

API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY") or ""
if API_KEY:
    genai.configure(api_key=API_KEY)
MODEL = genai.GenerativeModel("gemini-2.0-flash") if API_KEY else None

app = Flask(__name__)
CORS(app)

# Mémoire: DOCS[scope][docName] = [ {page:int, text:str, vec:[float,...]} ]
DOCS: Dict[str, Dict[str, List[Dict[str, Any]]]] = defaultdict(lambda: defaultdict(list))

# ---- PDF optionnel
try:
    from pypdf import PdfReader
    HAS_PDF = True
except Exception:
    HAS_PDF = False

# ---- Embedding jouet (démo)
def embed(txt: str) -> List[float]:
    if not txt:
        return [0.0]
    s = [ord(c) for c in txt[:2048]]
    mean = sum(s) / len(s)
    return [mean / 255.0]

def cosine(a: List[float], b: List[float]) -> float:
    if not a or not b:
        return 0.0
    num = sum(x * y for x, y in zip(a, b))
    da = math.sqrt(sum(x * x for x in a))
    db = math.sqrt(sum(y * y for y in b))
    return 0.0 if da == 0 or db == 0 else num / (da * db)

def _chunk(text: str, n: int = 1600):
    for i in range(0, len(text), n):
        yield (i // n) + 1, text[i : i + n]

# ------------------ SCOPE (existante, conservée) ------------------
def _scope() -> str:
    """
    Clé de stockage/lecture:
    - si 'conv' présent (multipart/json/query), on utilise 'conv::<id>' (principe: par conversation)
    - sinon on retombe sur le namespace (email) en lowercase, ou 'guest'
    """
    conv = None
    if request.method in ("POST", "PUT", "PATCH"):
        ct = request.content_type or ""
        if "multipart/form-data" in ct:
            conv = request.form.get("conv")
        elif "application/json" in ct:
            j = request.get_json(silent=True) or {}
            conv = j.get("conversationId") or j.get("conv")
    if not conv:
        conv = request.args.get("conv")

    if conv:
        return f"conv::{str(conv).strip()}"

    # fallback namespace
    ns = None
    if request.method in ("POST", "PUT", "PATCH"):
        ct = request.content_type or ""
        if "multipart/form-data" in ct:
            ns = request.form.get("ns")
        elif "application/json" in ct:
            j = request.get_json(silent=True) or {}
            ns = j.get("ns")
    if not ns:
        ns = request.args.get("ns") or request.headers.get("X-Doc-NS")
    ns = (ns or "guest").strip().lower()
    return ns or "guest"

# ------------------ NOUVEAU: utilitaires scopes unifiés ------------------
def _conv_and_ns():
    """Retourne (conv_id or None, ns) détectés dans form/json/query/headers."""
    conv = None
    ns = None
    ct = request.content_type or ""

    if request.method in ("POST", "PUT", "PATCH"):
        if "multipart/form-data" in ct:
            conv = request.form.get("conv")
            ns = request.form.get("ns")
        elif "application/json" in ct:
            j = request.get_json(silent=True) or {}
            conv = j.get("conversationId") or j.get("conv")
            ns = j.get("ns")

    conv = conv or request.args.get("conv")
    ns = ns or request.args.get("ns") or request.headers.get("X-Doc-NS")

    conv = (str(conv).strip() if conv else None)
    ns = (ns or "guest").strip().lower()
    return conv, ns

def _scopes_for_read():
    """Ordre: conv::<id> si présent, puis ns. Dédupliqué."""
    conv, ns = _conv_and_ns()
    scopes = []
    if conv:
        scopes.append(f"conv::{conv}")
    if ns:
        scopes.append(ns)
    # dédup en préservant l'ordre
    return list(dict.fromkeys([s for s in scopes if s]))

def _scopes_for_write():
    """Écriture: si conv ET ns => écrit dans les deux ; sinon => ns (guest par défaut)."""
    conv, ns = _conv_and_ns()
    scopes = []
    if conv:
        scopes.append(f"conv::{conv}")
    if ns:
        scopes.append(ns)
    scopes = list(dict.fromkeys([s for s in scopes if s]))
    return scopes or ["guest"]

# ------------------ HEALTH ------------------
@app.get("/health")
def health():
    total_docs = sum(len(v) for v in DOCS.values())
    return {"ok": True, "scopes": len(DOCS), "docs_total": total_docs, "ai_ready": bool(MODEL)}

@app.get("/envcheck")
def envcheck():
    return {
        "GOOGLE_API_KEY_set": bool(os.getenv("GOOGLE_API_KEY")),
        "GEMINI_API_KEY_set": bool(os.getenv("GEMINI_API_KEY")),
        "configured": bool(MODEL),
    }

# ------------------ DOCS LIST ------------------
@app.get("/docs")
def list_docs():
    scopes = _scopes_for_read()
    seen = set()
    out = []
    for sc in scopes:
        for d, chunks in DOCS.get(sc, {}).items():
            if (sc, d) in seen:
                continue
            seen.add((sc, d))
            out.append({"name": d, "pages": len(chunks), "scope": sc})
    return jsonify({"ok": True, "scopes": scopes, "count": len(out), "docs": out})

# ------------------ INGEST ------------------
@app.post("/ingest")
def ingest():
    targets = _scopes_for_write()
    print(f"[ingest] write_scopes={targets}")

    # JSON (pages déjà extraites)
    if request.content_type and "application/json" in request.content_type:
        data = request.get_json() or {}
        name = data.get("name") or f"doc_{uuid.uuid4().hex[:6]}"
        pages = []
        for p in data.get("pages", []):
            text = p.get("text", "")
            pages.append({"page": int(p.get("page", 1)), "text": text, "vec": embed(text)})
        for sc in targets:
            DOCS[sc][name].clear()
            DOCS[sc][name].extend(pages)
        return jsonify({"ok": True, "scopes": targets, "doc": name, "pages": len(pages)})

    # FICHIER
    f = request.files.get("file")
    if not f:
        return jsonify({"error": "Aucun fichier"}), 400

    filename = (f.filename or "").strip()
    name = filename or f"doc_{uuid.uuid4().hex[:6]}"
    lower = filename.lower()

    if lower.endswith(".pdf"):
        if not HAS_PDF:
            return jsonify({"error": "pypdf manquant (pip install pypdf)"}), 500
        reader = PdfReader(f.stream)
        pages = []
        for i, page in enumerate(reader.pages, start=1):
            text = (page.extract_text() or "").strip()
            pages.append({"page": i, "text": text, "vec": embed(text)})
        for sc in targets:
            DOCS[sc][name].clear()
            DOCS[sc][name].extend(pages)
        return jsonify({"ok": True, "scopes": targets, "doc": name, "pages": len(pages)})

    if lower.endswith(".csv"):
        content = f.read().decode(errors="ignore")
        sio = io.StringIO(content)
        r = csv.reader(sio)
        rows = list(r)
        header = rows[0] if rows else []
        text = "\n".join([", ".join(row) for row in rows[:2000]])
        pages = []
        for pageno, ch in _chunk(text):
            pages.append({"page": pageno, "text": ch, "vec": embed(ch)})
        for sc in targets:
            DOCS[sc][name].clear()
            DOCS[sc][name].extend(pages)
        return jsonify({"ok": True, "scopes": targets, "doc": name, "pages": len(pages), "columns": header})

    # TXT / autres
    text = f.read().decode(errors="ignore")
    pages = []
    for pageno, ch in _chunk(text):
        pages.append({"page": pageno, "text": ch, "vec": embed(ch)})
    for sc in targets:
        DOCS[sc][name].clear()
        DOCS[sc][name].extend(pages)
    return jsonify({"ok": True, "scopes": targets, "doc": name, "pages": len(pages)})

# ------------------ RECHERCHE SIMPLE ------------------
@app.post("/search")
def search():
    data = request.get_json() or {}
    q = (data.get("q") or "").strip()
    k = int(data.get("k") or 5)
    qv = embed(q)

    scopes = _scopes_for_read()
    hits = []
    for sc in scopes:
        for doc, chunks in DOCS.get(sc, {}).items():
            for ch in chunks:
                score = cosine(qv, ch["vec"])
                hits.append({"scope": sc, "doc": doc, "page": ch["page"], "excerpt": ch["text"][:800], "score": float(score)})
    hits.sort(key=lambda x: x["score"], reverse=True)
    return jsonify(hits[:k])

# ------------------ MCP / EXECUTE ------------------
@app.post("/mcp/execute")
def mcp_execute():
    try:
        data = request.get_json() or {}
        action = data.get("action")
        params = data.get("parameters", {}) or {}
        rid = data.get("id", uuid.uuid4().hex)

        def ai_not_configured():
            return jsonify({
                "version": "1.0", "id": rid, "status": "success",
                "data": {"reply": "Le moteur IA n'est pas configuré (clé API manquante). Définis GOOGLE_API_KEY (ou GEMINI_API_KEY) puis redémarre le service."}
            })

        # -------- GENERAL --------
        if action == "general_conversation":
            scope = _scope()  # inchangé
            print(f"[mcp] action=general_conversation scope={scope} doc={params.get('doc')} docs={params.get('docs')}")
            if not MODEL:
                return ai_not_configured()
            msg = params.get("message", "")
            resp = MODEL.generate_content(msg)
            return jsonify({"version": "1.0", "id": rid, "status": "success",
                            "data": {"reply": (resp.text or "").strip()}})

        # -------- DOCQA SEARCH (union conv+ns) --------
        if action == "docqa_search":
            scopes = _scopes_for_read()
            print(f"[mcp] action=docqa_search scopes={scopes}")
            q = (params.get("q") or "").strip()
            k = int(params.get("k") or 5)
            qv = embed(q)
            hits = []
            for sc in scopes:
                for doc, chunks in DOCS.get(sc, {}).items():
                    for ch in chunks:
                        score = cosine(qv, ch["vec"])
                        hits.append({"scope": sc, "doc": doc, "page": ch["page"], "excerpt": ch["text"][:800], "score": float(score)})
            hits.sort(key=lambda x: x["score"], reverse=True)
            reply = "Aucune correspondance." if not hits else "\n".join(
                f"- [{h['scope']}] {h['doc']} p.{h['page']} ({h['score']:.2f}): {h['excerpt'][:200]}…" for h in hits[:k]
            )
            return jsonify({"version": "1.0", "id": rid, "status": "success",
                            "data": {"reply": reply, "citations": hits[:k], "scopes": scopes}})

        # -------- DOCQA ANSWER (RAG union conv+ns) --------
        if action == "docqa_answer":
            scopes = _scopes_for_read()
            print(f"[mcp] action=docqa_answer scopes={scopes} doc={params.get('doc')} docs={params.get('docs')}")
            if not MODEL:
                return ai_not_configured()

            q = (params.get("q") or "").strip()
            k = int(params.get("k") or 5)

            only_doc = params.get("doc")
            only_docs = params.get("docs") or []
            allow = set([only_doc] if only_doc else []) | set(only_docs)

            qv = embed(q)
            hits = []
            for sc in scopes:
                for doc, chunks in DOCS.get(sc, {}).items():
                    if allow and doc not in allow:
                        continue
                    for ch in chunks:
                        score = cosine(qv, ch["vec"])
                        hits.append({"scope": sc, "doc": doc, "page": ch["page"], "excerpt": ch["text"][:1200], "score": float(score)})

            hits.sort(key=lambda x: x["score"], reverse=True)
            top = hits[:k]

            if not top:
                return jsonify({"version": "1.0", "id": rid, "status": "success",
                                "data": {"reply": "NO_CONTEXT", "citations": [], "scopes": scopes}})

            ctx = "\n\n".join([f"[{h['scope']}:{h['doc']} p.{h['page']}] {h['excerpt']}" for h in top])
            prompt = (
                "Réponds strictement à partir du contexte.\n"
                "Si l'information manque dans le contexte, dis-le franchement.\n\n"
                f"Contexte:\n{ctx}\n\nQuestion: {q}\n"
                "Réponse en français, concise, avec références [scope:doc p.page] si utile."
            )
            resp = MODEL.generate_content(prompt)
            out = (resp.text or "").strip()
            return jsonify({"version": "1.0", "id": rid, "status": "success",
                            "data": {"reply": out, "citations": top, "scopes": scopes}})

        # -------- UNKNOWN --------
        return jsonify({"version": "1.0", "id": rid, "status": "error",
                        "error": f"Action inconnue: {action}"}), 400

    except Exception as e:
        return jsonify({"version": "1.0", "id": uuid.uuid4().hex, "status": "error", "error": str(e)}), 500

# ------------------------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
