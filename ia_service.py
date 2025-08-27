from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import json, uuid, os
from collections import defaultdict
from typing import List, Dict, Any
import math
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)
CORS(app)

# === GEMINI CONFIG (clé via ENV) ===
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if not GEMINI_API_KEY:
    print("⚠️  GEMINI_API_KEY manquante dans les variables d'environnement")
genai.configure(api_key=GEMINI_API_KEY)
conversation_model = genai.GenerativeModel('gemini-2.5-flash')
knowledge_model = genai.GenerativeModel('gemini-2.5-flash')

# === DocQA: stockage en mémoire (simple & suffisant pour PFE démo) ===
# Structure: { doc_name: [{"page":int, "text":str, "vec":[float,...]}] }
DOCS: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

def embed(text: str) -> List[float]:
    # petit embedd simplifié (fallback si tu n’as pas d’embeddings locaux)
    # On calcule une vectorisation "pauvre" mais déterministe (moyenne ascii normalisée)
    if not text:
        return [0.0]
    s = [ord(c) for c in text[:2048]]
    mean = sum(s) / len(s)
    return [mean / 255.0]

def cosine(a: List[float], b: List[float]) -> float:
    if not a or not b:
        return 0.0
    num = sum(x*y for x,y in zip(a,b))
    da = math.sqrt(sum(x*x for x in a))
    db = math.sqrt(sum(y*y for y in b))
    return 0.0 if da==0 or db==0 else num/(da*db)

@app.get("/health")
def health():
    return {"ok": True, "docs": len(DOCS)}

# === Ingestion PDF "simulée" (tu peux brancher un vrai parseur PDF plus tard) ===
# Ici on accepte du texte brut ou pseudo-PDF via champ 'text' si besoin.
@app.post("/ingest")
def ingest():
    """
    Deux modes:
    - multipart/form-data avec 'file' (PDF non traité finement ici, démo simple)
    - application/json avec {"name":"Doc1","pages":[{"page":1,"text":"..."}, ...]}
    """
    if request.content_type and "application/json" in request.content_type:
        data = request.get_json() or {}
        name = data.get("name") or f"doc_{uuid.uuid4().hex[:6]}"
        pages = data.get("pages", [])
        DOCS[name].clear()
        for p in pages:
            text = p.get("text","")
            DOCS[name].append({"page": p.get("page",1), "text": text, "vec": embed(text)})
        return jsonify({"ok": True, "doc": name, "pages": len(DOCS[name])})

    f = request.files.get("file")
    if not f:
        return jsonify({"error": "Aucun fichier reçu"}), 400
    name = f.filename or f"doc_{uuid.uuid4().hex[:6]}"
    text = f.read().decode(errors="ignore")
    # Découpage grossier en "pages" par blocs de 1200 caractères
    DOCS[name].clear()
    chunk = 1200
    for i in range(0, len(text), chunk):
        page_text = text[i:i+chunk]
        DOCS[name].append({"page": (i//chunk)+1, "text": page_text, "vec": embed(page_text)})
    return jsonify({"ok": True, "doc": name, "pages": len(DOCS[name])})

class SearchQ:
    def __init__(self, q: str, k: int = 5):
        self.q = q
        self.k = max(1, min(10, int(k or 5)))

@app.post("/search")
def search():
    data = request.get_json() or {}
    q = data.get("q","").strip()
    k = int(data.get("k", 5))
    s = SearchQ(q, k)
    qv = embed(s.q)
    hits = []
    for doc, chunks in DOCS.items():
        for ch in chunks:
            score = cosine(qv, ch["vec"])
            hits.append({
                "doc": doc,
                "page": ch["page"],
                "excerpt": ch["text"][:500],
                "score": float(score)
            })
    hits.sort(key=lambda x: x["score"], reverse=True)
    return jsonify(hits[:s.k])

# === ROUTE CLASSIQUE CHAT (Agent conversationnel) ===
@app.post('/api/ai/chat')
def handle_chat():
    try:
        data = request.get_json() or {}
        history_from_spring = data.get('history', [])
        gemini_history = [
            {"role": "model" if msg.get('role') == 'assistant' else 'user', "parts": [msg.get('content','')]}
            for msg in history_from_spring
        ]
        history_for_start = gemini_history[:-1]
        current_message = gemini_history[-1]['parts'] if gemini_history else ["Bonjour"]
        chat = conversation_model.start_chat(history=history_for_start)
        response = chat.send_message(current_message)
        return jsonify({"reply": response.text})
    except Exception as e:
        print(f"Erreur /api/ai/chat: {e}")
        return jsonify({"error": str(e)}), 500

# === EXTRACTION D'INSTRUCTIONS (facultatif) ===
@app.post('/api/ai/extract_instruction')
def handle_instruction_extraction():
    try:
        data = request.get_json() or {}
        user_message = data.get('user_message')
        if not user_message:
            return jsonify({"error": "user_message manquant"}), 400
        prompt = f"""
        Analyse la requête et renvoie un JSON {{ "action": "...", "parameters": {{...}} }}.
        Actions: "knowledge_query", "general_conversation", "docqa_search".
        Requête: "{user_message}"
        JSON:
        """
        response = conversation_model.generate_content(prompt)
        txt = (response.text or "").strip().replace("`","")
        if txt.lower().startswith("json"):
            txt = txt[4:].strip()
        return jsonify(json.loads(txt))
    except Exception as e:
        print(f"Erreur extraction instruction: {e}")
        return jsonify({"action":"general_conversation","parameters":{}}), 200

# === MCP : Communication entre agents ===
@app.post('/mcp/execute')
def mcp_execute():
    try:
        data = request.get_json() or {}
        action = data.get("action")
        parameters = data.get("parameters", {})
        request_id = data.get("id", str(uuid.uuid4()))

        if action == "general_conversation":
            message = parameters.get("message","")
            chat = conversation_model.start_chat()
            response = chat.send_message(message)
            return jsonify({"version":"1.0","id":request_id,"status":"success","data":{"reply": response.text}})

        elif action == "knowledge_query":
            query = parameters.get("query","Donne-moi des informations.")
            response = knowledge_model.generate_content(f"Base de connaissance: {query}")
            return jsonify({"version":"1.0","id":request_id,"status":"success","data":{"reply": response.text}})

        elif action == "docqa_search":
            q = parameters.get("q","").strip()
            k = int(parameters.get("k",5))
            # Réutilise la logique /search
            qv = embed(q)
            hits = []
            for doc, chunks in DOCS.items():
                for ch in chunks:
                    score = cosine(qv, ch["vec"])
                    hits.append({
                        "doc": doc,
                        "page": ch["page"],
                        "excerpt": ch["text"][:500],
                        "score": float(score)
                    })
            hits.sort(key=lambda x: x["score"], reverse=True)
            best = hits[:k]
            # Formate une réponse textuelle + citations
            if not best:
                reply = "Aucune correspondance trouvée dans les documents ingérés."
            else:
                lines = []
                for h in best:
                    lines.append(f"- {h['doc']} (p.{h['page']}, score {h['score']:.2f}) : {h['excerpt']}")
                reply = "Résultats DocQA:\n" + "\n".join(lines)
            return jsonify({"version":"1.0","id":request_id,"status":"success",
                            "data":{"reply": reply, "citations": best}})

        else:
            return jsonify({"version":"1.0","id":request_id,"status":"error",
                            "error": f"Action non supportée: {action}"}), 400

    except Exception as e:
        print(f"Erreur MCP: {e}")
        return jsonify({"version":"1.0","id":str(uuid.uuid4()),"status":"error","error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
