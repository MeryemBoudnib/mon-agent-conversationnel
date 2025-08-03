from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import json
import uuid

app = Flask(__name__)
CORS(app)

# === CONFIGURATION GEMINI ===
genai.configure(api_key="AIzaSyC7gWtjmBHL06SYjlPwPnT7-DxwmwfhpuQ")
conversation_model = genai.GenerativeModel('gemini-2.5-flash')  # Agent conversationnel
knowledge_model = genai.GenerativeModel('gemini-2.5-flash')     # Agent connaissance (DB ou infos)


# === ROUTE CLASSIQUE CHAT (Agent conversationnel) ===
@app.route('/api/ai/chat', methods=['POST'])
def handle_chat():
    try:
        data = request.get_json()
        history_from_spring = data.get('history', [])
        
        gemini_history = [
            {"role": "model" if msg['role'] == 'assistant' else 'user', "parts": [msg['content']]}
            for msg in history_from_spring
        ]
        
        history_for_start = gemini_history[:-1]
        current_message = gemini_history[-1]['parts'] if gemini_history else ["Bonjour"]

        chat = conversation_model.start_chat(history=history_for_start)
        response = chat.send_message(current_message)
        
        return jsonify({"reply": response.text})
    except Exception as e:
        print(f"Erreur dans /api/ai/chat: {e}")
        return jsonify({"error": str(e)}), 500


# === EXTRACTION D'INSTRUCTIONS (Orchestrateur) ===
@app.route('/api/ai/extract_instruction', methods=['POST'])
def handle_instruction_extraction():
    try:
        data = request.get_json()
        if not data or 'user_message' not in data:
            return jsonify({"error": "Requête invalide, 'user_message' manquant"}), 400
        
        user_message = data['user_message']

        prompt = f"""
        Analyse la requête de l'utilisateur et renvoie un JSON avec "action" et "parameters".
        Actions possibles :
        - "knowledge_query": Si la question concerne des données ou la base de connaissances.
        - "general_conversation": Pour une réponse conversationnelle normale.

        Réponds uniquement avec un objet JSON, sans autre texte.
        Requête : "{user_message}"
        JSON:
        """
        
        response = conversation_model.generate_content(prompt)
        json_response_text = response.text.strip().replace("`", "")
        if json_response_text.startswith("json"):
            json_response_text = json_response_text[4:].strip()

        print(f"Instruction extraite: {json_response_text}")
        
        instruction_data = json.loads(json_response_text)
        return jsonify(instruction_data)

    except Exception as e:
        print(f"Erreur extraction instruction: {e}")
        return jsonify({"action": "general_conversation", "parameters": {}}), 500


# === MCP : Communication entre agents ===
@app.route('/mcp/execute', methods=['POST'])
def mcp_execute():
    try:
        data = request.get_json()
        action = data.get("action")
        parameters = data.get("parameters", {})
        request_id = data.get("id", str(uuid.uuid4()))

        # Agent conversationnel
        if action == "general_conversation":
            message = parameters.get("message", "")
            chat = conversation_model.start_chat()
            response = chat.send_message(message)
            return jsonify({
                "version": "1.0",
                "id": request_id,
                "status": "success",
                "data": {"reply": response.text}
            })

        # Agent connaissance (simulateur base de données)
        elif action == "knowledge_query":
            query = parameters.get("query", "Donne-moi des informations.")
            response = knowledge_model.generate_content(f"Base de connaissance: {query}")
            return jsonify({
                "version": "1.0",
                "id": request_id,
                "status": "success",
                "data": {"reply": response.text}
            })

        else:
            return jsonify({
                "version": "1.0",
                "id": request_id,
                "status": "error",
                "error": f"Action non supportée: {action}"
            }), 400

    except Exception as e:
        print(f"Erreur MCP: {e}")
        return jsonify({
            "version": "1.0",
            "id": str(uuid.uuid4()),
            "status": "error",
            "error": str(e)
        }), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
