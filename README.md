# 🤖 Plateforme d'Interopérabilité d'Agents IA (MCP)


Ce projet implémente une **plateforme d'orchestration d'agents d'Intelligence Artificielle** basée sur le standard **MCP (Model Context Protocol)**. Elle permet d'unifier l'accès à différentes capacités d'IA (Chat, RAG, Analyse) via une architecture microservices sécurisée et scalable.

---

## 🚀 Fonctionnalités Clés

*   **Agent Conversationnel Intelligent :** Utilisation de l'API **Gemini** pour des réponses en langage naturel.
*   **RAG (Retrieval-Augmented Generation) :** Ingestion de documents PDF/CSV, indexation vectorielle et réponses sourcées contextuelles.
*   **Web Search Integration :** Capacité de recherche sur le web (DuckDuckGo/Bing) avec citations des sources.
*   **Dashboard de Supervision :** Suivi temps réel des KPIs (Latence p95, Tokens, Nombre de conversations) pour l'équipe SRE.
*   **Sécurité Avancée :** Authentification **JWT** Stateless et gestion des rôles (RBAC - User/Admin).

## 🛠️ Stack Technique

Le projet repose sur une architecture **Microservices** robuste :

### 🧠 AI Orchestrator (Python)
*   **Langage :** Python 3.10+
*   **Framework :** Flask
*   **IA & Logic :** LangChain, LangGraph, Model Context Protocol (MCP)
*   **LLM :** Google Gemini API
*   **Vector Search :** FAISS / pgvector

### 🛡️ Backend Core (Java)
*   **Framework :** Spring Boot 3
*   **Sécurité :** Spring Security (JWT, OAuth2 flows)
*   **Base de données :** PostgreSQL

### 💻 Frontend (Web)
*   **Framework :** Angular 17+
*   **UI Components :** Angular Material
*   **Features :** Streaming de réponse (Tokens), Mode Dark/Light, Upload de fichiers.

---

## 🏗️ Architecture

Le système est conçu pour découpler l'interface utilisateur des moteurs d'IA sous-jacents, garantissant une évolutivité maximale.

*   **Frontend :** Gère l'interface chat et le tableau de bord administrateur.
*   **API Gateway / Backend :** Gère les utilisateurs, l'historique des conversations et la sécurité.
*   **Service IA (Agent) :** Exécute les workflows RAG et communique avec les LLMs.

---

## 📸 Aperçu (Screenshots)

### Interface de Chat (RAG & Sources)
*L'agent est capable d'analyser un PDF et de citer ses sources.*
<img width="1056" height="493" alt="image" src="https://github.com/user-attachments/assets/40966c3a-b1c2-4ec1-aaa0-72515695f479" />

<img width="1067" height="288" alt="image" src="https://github.com/user-attachments/assets/b02ae505-8f64-485d-a912-6262f899cf4f" />
<img width="487" height="481" alt="image" src="https://github.com/user-attachments/assets/cea6892d-d6f2-4f9b-a1fc-365f55ad0c5f" />
<img width="1055" height="501" alt="image" src="https://github.com/user-attachments/assets/7e3cb35e-817b-4c2c-8c18-e14ec2a9343f" />


### Dashboard Administrateur
*Vue globale des métriques de performance et d'usage.*
<img width="1067" height="253" alt="image" src="https://github.com/user-attachments/assets/b8f86fcd-fdcf-4110-af0e-78e457a0fbf6" />
<img width="1072" height="288" alt="image" src="https://github.com/user-attachments/assets/b3a91115-3ef6-4b09-bdfe-a44e0740782b" />
<img width="1062" height="313" alt="image" src="https://github.com/user-attachments/assets/705504e4-785f-4e79-bb8b-577ec5114ec0" />
<img width="1061" height="330" alt="image" src="https://github.com/user-attachments/assets/06f83790-1ae8-43e1-a4cd-a6f00851fc15" />
<img width="1056" height="499" alt="image" src="https://github.com/user-attachments/assets/cba70eec-5187-4b26-9873-673deb4d29b3" />
<img width="1056" height="499" alt="image" src="https://github.com/user-attachments/assets/8d7646fe-2ca8-4f63-8353-f1aea7f929b6" />

---

## 🔧 Installation & Démarrage

### Prérequis
*   Docker & Docker Compose
*   Node.js 18+
*   Java 21 (JDK)
*   Python 3.10+
### 
### 1. Backend (Spring Boot)
cd backend
./mvnw spring-boot:run

2. Service IA (Python)
cd ia_service
pip install -r requirements.txt
python ia_service.py

3. Frontend (Angular)
cd chatbot-ui
npm install
npm start

👤 Auteur
Meryem Boudnib - Ingénieure d'État en Informatique
