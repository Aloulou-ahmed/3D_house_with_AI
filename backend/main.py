# backend/main.py
# Serveur FastAPI - c'est le "chef d'orchestre" du backend
# Il reçoit les requêtes du frontend, appelle l'IA, et retourne le JSON 3D

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import requests

from llm import get_house_json
from parser import validate_and_enrich

# Création de l'application FastAPI
app = FastAPI(title="House AI 3D Generator")

# CORS : autorise le frontend (sur un autre port) à appeler ce backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En production, mets l'URL exacte du frontend
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modèle de données pour la requête
class HouseRequest(BaseModel):
    description: str  # "Je veux une maison avec 2 chambres, salon et cuisine"

# Modèle de données pour tester sans l'IA
class DirectJsonRequest(BaseModel):
    house_json: dict

@app.get("/")
def root():
    return {"message": "House AI 3D Generator API is running!"}

@app.get("/health")
def health():
    ollama_ok = False
    try:
        r = requests.get("http://127.0.0.1:11434/api/tags", timeout=2)
        ollama_ok = r.status_code == 200
    except Exception:
        ollama_ok = False

    return {
        "backend": True,
        "ollama": ollama_ok,
    }

@app.post("/generate")
async def generate_house(request: HouseRequest):
    """
    Route principale :
    1. Reçoit la description texte
    2. L'envoie à Ollama/llama3.2
    3. Parse et enrichit le JSON
    4. Retourne la structure 3D complète
    """
    if not request.description.strip():
        raise HTTPException(status_code=400, detail="Description vide")
    
    try:
        # Étape 1 : LLM génère le JSON brut
        print(f"[INFO] Description reçue: {request.description[:100]}")
        raw_json = get_house_json(request.description)
        print(f"[INFO] JSON brut de l'IA: {json.dumps(raw_json, indent=2)[:500]}")
        
        # Étape 2 : Validation et enrichissement
        enriched = validate_and_enrich(raw_json)
        print(f"[INFO] JSON enrichi avec {len(enriched['rooms'])} pièces")
        for room in enriched['rooms']:
            print(f"  - {room['name']}: {len(room.get('furniture', []))} meubles")
        
        # Retour structuré pour le frontend
        return {
            "house": enriched,
            "raw": raw_json
        }
        
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/parse-direct")
async def parse_direct(request: DirectJsonRequest):
    """
    Route de test : envoie directement un JSON sans passer par l'IA.
    Utile pour tester le rendu 3D indépendamment du LLM.
    """
    try:
        enriched = validate_and_enrich(request.house_json)
        return {"success": True, "house": enriched}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Lancement : python main.py
# OU : uvicorn main:app --host 127.0.0.1 --port 8000 --reload
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False)