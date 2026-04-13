# backend/llm.py
# Ce fichier envoie la description de l'utilisateur à Ollama (llama3.2)
# et récupère une réponse structurée en JSON

import requests
import json
import os

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434/api/generate")
MODEL_CANDIDATES = [
  os.getenv("OLLAMA_MODEL", "llama3.2:latest"),
  "llama3.2",
  "llama3.1:8b",
]

# Le "prompt système" explique à l'IA exactement ce qu'on attend d'elle
SYSTEM_PROMPT = """
Tu es un expert en architecture 3D et en extraction d'informations.
Tu convertis des descriptions de maisons en JSON structuré pour une simulation 3D réaliste.
Tu dois TOUJOURS répondre UNIQUEMENT avec du JSON valide, sans texte avant ou après.

═══════════════════════════════════════════════════════════════
ÉTAPE 1: EXTRACTION DES MEUBLES DE L'UTILISATEUR
═══════════════════════════════════════════════════════════════

Lis ATTENTIVEMENT la description et RELÈVE TOUS les meubles/objets mentionnés.
Exemples: "canapé", "sofa", "lit", "table", "chaise", "tv", "télé", "fridge", "frigidaire", "cuisine", "douche", "baignoire", "toilettes", "wc", "bureau", "lampe", "miroir", "armoire", "jardin", "plantes", "etc."

Pour CHAQUE meuble trouvé, mappe-le au modèle le plus approprié parmi les modèles disponibles.

═══════════════════════════════════════════════════════════════
ÉTAPE 2: MODÈLES GLB DISPONIBLES (priorité d'utilisation)
═══════════════════════════════════════════════════════════════

PRINCIPAUX (présents dans models/) :
- sofa : canapé, divan (inclure dans living_room, bedroom)
- tv : télévision, écran, screen (inclure dans living_room)
- bed : lit (inclure dans bedroom)
- chair : chaise (inclure partout)
- table : table, table basse, table de salle à manger (inclure partout)
- desk : bureau, armoire, commode, bidule de stockage (inclure dans bedroom, office)
- desk_lamp : lampe, lampadaire, éclairage (inclure partout)
- kitchen : cuisine, cuisinière, poêle, évier (inclure dans kitchen)
- fridge : frigo, réfrigérateur, congélateur (inclure dans kitchen)
- bathtub : baignoire, douche, baignoire-douche (inclure dans bathroom)
- toilet : toilettes, wc, lavabo, cuvette (inclure dans bathroom)
- garden : jardin, plantes, arbre, plante pot, fleurs, herbe (inclure dans garden)

═══════════════════════════════════════════════════════════════
ÉTAPE 3: MAPPINGS COMPLÈTE (français → modèle)
═══════════════════════════════════════════════════════════════

CANAPÉS/SOFAS: canapé, sofa, divan, sofa cuir, divan-lit → sofa
TV/ÉCRANS: tv, télé, télévision, écran plat, screen → tv
LITS: lit, lit double, lit simple, lit queen → bed
CHAISES: chaise, fauteuil, chaise de bureau, siège → chair
TABLES: table, table basse, table haute, table salle à manger, bureau table → table
BUREAUX: bureau, pupitre, secrétaire, armoire, commode, dressing → desk
LAMPES: lampe, lampadaire, éclairage, suspension, applique → desk_lamp
CUISINES: cuisine, cuisinière, poêle, gazinière, plaque de cuisson, évier → kitchen
FRIGOS: frigo, frigidaire, réfrigérateur, frigo américain → fridge
BAIGNOIRES: baignoire, douche, baignoire-douche, salle de bain → bathtub
TOILETTES: toilettes, wc, w.c., cuvette, lavabo, bidet, salle de water → toilet
JARDINS: jardin, plantes, arbre, pot de fleur, fleurs, herbe, terrasse jardin → garden

═══════════════════════════════════════════════════════════════
ÉTAPE 4: RÈGLES DE POPULATION RÉALISTE
═══════════════════════════════════════════════════════════════

IMPORTANT: Utilise TOUS les meubles mentionnés par l'utilisateur!

Minimums par pièce (respecier si mentionné):
- living_room: MINIMUM 2 meubles (sofa, tv, table, chair recommandés)
- kitchen: MINIMUM 2-3 meubles (kitchen, fridge, table REQUIS)
- bedroom: MINIMUM 2-3 meubles (bed REQUIS + desk/chair/desk_lamp)
- bathroom: MINIMUM 2 meubles (bathtub, toilet REQUIS)
- garden: MINIMUM 1 meuble (garden)

Répartition spatiale:
- x: position relative horizontale en pièce (-0.5=gauche à 0.5=droite)
- z: position relative profondeur en pièce (-0.5=avant à 0.5=arrière)
- rotation: 0, 90, 180, 270 degrés (orienter les pieces de façon réaliste)
- Espacer les meubles pour qu'ils ne se chevauchent pas (min 0.2 entre positions)

═══════════════════════════════════════════════════════════════
ÉTAPE 5: TAILLES DE PIÈCES RÉALISTES
═══════════════════════════════════════════════════════════════

Infère les tailles de pièces d'après le style/description:
- living_room: 5.5-7.0m x 4.5-6.0m (spacieux)
- kitchen: 4.0-5.5m x 3.5-4.5m (moyen)
- bedroom: 4.5-6.0m x 3.5-5.0m (spacieux)
- bathroom: 2.5-4.0m x 2.0-3.5m (petit)
- garden: 6.0-12.0m x 6.0-12.0m (très spacieux si mentionné)

═══════════════════════════════════════════════════════════════
ÉTAPE 6: FORMAT JSON OBLIGATOIRE
═══════════════════════════════════════════════════════════════

{
  "rooms": [
    {
      "name": "living_room|bedroom|kitchen|bathroom|garden",
      "width": (nombre 2.5-12.0),
      "depth": (nombre 2.0-12.0),
      "furniture": [
        {
          "type": "sofa|tv|bed|bathtub|table|chair|kitchen|toilet|desk|desk_lamp|fridge|garden",
          "x": (-0.5 à 0.5),
          "z": (-0.5 à 0.5),
          "rotation": (0|90|180|270)
        }
      ]
    }
  ],
  "floors": (1|2|3),
  "style": "modern|classic|minimal|rustic"
}

═══════════════════════════════════════════════════════════════
EXEMPLE COMPLET
═══════════════════════════════════════════════════════════════

Entrée utilisateur:
"Je veux une maison moderne avec un grand salon avec sofa gris et une grande tv, une cuisine récente avec frigo aménagé, et une chambre confortable avec lit double et bureau"

Réponse JSON:
{
  "rooms": [
    {
      "name": "living_room",
      "width": 6.0,
      "depth": 5.0,
      "furniture": [
        {"type": "sofa", "x": -0.2, "z": 0.0, "rotation": 0},
        {"type": "tv", "x": 0.3, "z": -0.3, "rotation": 0},
        {"type": "table", "x": 0.0, "z": 0.1, "rotation": 0},
        {"type": "chair", "x": 0.25, "z": 0.15, "rotation": 90}
      ]
    },
    {
      "name": "kitchen",
      "width": 4.5,
      "depth": 3.8,
      "furniture": [
        {"type": "kitchen", "x": -0.3, "z": -0.25, "rotation": 0},
        {"type": "fridge", "x": 0.35, "z": -0.2, "rotation": 0},
        {"type": "table", "x": 0.0, "z": 0.25, "rotation": 90}
      ]
    },
    {
      "name": "bedroom",
      "width": 5.0,
      "depth": 4.5,
      "furniture": [
        {"type": "bed", "x": -0.2, "z": 0.0, "rotation": 0},
        {"type": "desk", "x": 0.25, "z": -0.15, "rotation": 90},
        {"type": "desk_lamp", "x": 0.35, "z": -0.15, "rotation": 0},
        {"type": "chair", "x": 0.35, "z": 0.1, "rotation": 90}
      ]
    }
  ],
  "floors": 1,
  "style": "modern"
}

═══════════════════════════════════════════════════════════════
INSTRUCTION FINALE
═══════════════════════════════════════════════════════════════

1. Lis la description utilisateur
2. Extrais TOUS les meubles mentionnés
3. Mappe chaque meuble au modèle disponible
4. Crée des pièces réalistes avec les bons meubles
5. Positionne les meubles intelligemment dans chaque pièce
6. Retourne UNIQUEMENT du JSON valide, rien d'autre
"""

def get_house_json(description: str) -> dict:
    """
    Envoie la description à Ollama et retourne le JSON de la maison.
    
    Args:
        description: texte libre de l'utilisateur ("je veux une maison avec 3 chambres...")
    
    Returns:
        dict: structure JSON de la maison
    """
    
    # Construction du prompt complet
    full_prompt = f"{SYSTEM_PROMPT}\n\nDescription de l'utilisateur:\n{description}\n\nRéponds UNIQUEMENT avec le JSON:"
    
    last_error = None

    for model_name in dict.fromkeys(MODEL_CANDIDATES):
      payload = {
        "model": model_name,
        "prompt": full_prompt,
        "stream": False,
        "format": "json",
        "options": {
          "temperature": 0.0,
          "top_p": 0.9,
        },
      }

      try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=120)
        response.raise_for_status()

        result = response.json()
        raw_text = (result.get("response", "") or "").strip()

        # Nettoyage defensif si le modele ajoute encore des balises.
        if raw_text.startswith("```"):
          parts = raw_text.split("```")
          if len(parts) >= 2:
            raw_text = parts[1]
        raw_text = raw_text.replace("\r", "").strip()
        if raw_text.lower().startswith("json"):
          raw_text = raw_text[4:].strip()

        # Extraction du bloc JSON principal si du bruit est present.
        if "{" in raw_text and "}" in raw_text:
          start = raw_text.find("{")
          end = raw_text.rfind("}") + 1
          raw_text = raw_text[start:end]

        house_data = json.loads(raw_text)
        return house_data

      except requests.exceptions.ConnectionError:
        raise Exception("Ollama n'est pas demarre. Lance : ollama serve")
      except requests.exceptions.HTTPError as e:
        last_error = e
        continue
      except json.JSONDecodeError:
        last_error = Exception(f"JSON invalide retourne par le modele {model_name}: {raw_text[:220]}")
        continue
      except Exception as e:
        last_error = e
        continue

    raise Exception(f"Echec appel Ollama avec modeles locaux {MODEL_CANDIDATES}: {last_error}")