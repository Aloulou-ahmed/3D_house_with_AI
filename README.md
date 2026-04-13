# 3D House Generator

Guide rapide pour lancer le projet en local (backend FastAPI + frontend React/Vite).

## 1) Prerequis

- Windows + PowerShell
- Python 3.10+
- Node.js + npm
- Ollama installe

Verification rapide:

~~~powershell
python --version
npm --version
ollama --version
~~~

## 2) Installation (premiere fois)

Depuis la racine du projet:

~~~powershell
.\setup.bat
~~~

## 3) Lancement rapide (recommande)

1. Demarrer Ollama:

~~~powershell
ollama serve
~~~

2. Dans un autre terminal, depuis la racine:

~~~powershell
.\run_dev.bat
~~~

Cela lance:
- Backend FastAPI sur http://127.0.0.1:8000
- Frontend React sur http://localhost:5173

## 4) Lancement manuel (2 terminaux)

### Terminal 1 - Backend

Depuis la racine du projet:

~~~powershell
.\venv\Scripts\Activate.ps1
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
~~~

### Terminal 2 - Frontend React

~~~powershell
cd .\frontend-react
npm run dev
~~~

## 5) Verification

- Frontend: http://localhost:5173
- Sante backend: http://127.0.0.1:8000/health

Si tout va bien:
- Le frontend s ouvre et permet la generation 3D
- Le endpoint /health retourne un statut OK

## 6) Ollama et modele

Si Ollama est demarre mais qu aucun modele n est disponible:

~~~powershell
ollama pull llama3.2:latest
~~~

Ensuite relancer la generation depuis l interface web.

## 7) Scripts utiles

- .\run_backend.bat : lance uniquement le backend
- .\run_frontend.bat : lance uniquement le frontend-react
- .\run_dev.bat : lance backend + frontend

## 8) Depannage rapide

### Port 8000 deja utilise

~~~powershell
netstat -ano | findstr :8000
~~~

### Port 5173 deja utilise

~~~powershell
netstat -ano | findstr :5173
~~~

### Backend hors ligne

- Verifier que le terminal backend affiche Application startup complete
- Verifier l environnement virtuel active

### Frontend ne demarre pas

Dans frontend-react:

~~~powershell
npm install
npm run dev
~~~

## 9) Structure minimale

- backend : API FastAPI
- frontend-react : UI React + Three.js
- frontend : ancienne version statique
# 3D_house_with_AI
