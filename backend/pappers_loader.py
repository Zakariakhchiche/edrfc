"""
EdRCF 6.0 - Pappers MCP Loader
Fetches, enriches and caches real company data from Pappers MCP.
"""

import json
import os
import httpx
from datetime import datetime

from demo_data import SIGNAL_CATALOG, SECTORS_HEAT

# ============================================================================
# Cache management
# ============================================================================

CACHE_PATH = os.path.join(os.path.dirname(__file__), "targets_cache.json")


def save_cache(targets):
    """Save targets to JSON cache file."""
    try:
        with open(CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(targets, f, ensure_ascii=False, indent=2)
        print(f"[EdRCF] Cache saved: {len(targets)} targets -> {CACHE_PATH}")
    except Exception as e:
        print(f"[EdRCF] Cache save error: {e}")


def load_cache():
    """Load targets from JSON cache file. Returns None if no cache."""
    try:
        if os.path.exists(CACHE_PATH):
            with open(CACHE_PATH, "r", encoding="utf-8") as f:
                targets = json.load(f)
            if targets and isinstance(targets, list):
                print(f"[EdRCF] Cache loaded: {len(targets)} targets")
                return targets
    except Exception as e:
        print(f"[EdRCF] Cache load error: {e}")
    return None


# ============================================================================
# MCP call helper
# ============================================================================

async def call_pappers_mcp(mcp_url, tool_name, arguments):
    """Call a Pappers MCP tool via the streamable HTTP MCP server."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            mcp_url,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
            },
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {"name": tool_name, "arguments": arguments},
            },
        )
        content_type = resp.headers.get("content-type", "")
        if "text/event-stream" in content_type:
            for line in resp.text.split("\n"):
                if line.startswith("data: "):
                    data = json.loads(line[6:])
                    if "result" in data and "content" in data["result"]:
                        for block in data["result"]["content"]:
                            if block.get("type") == "text":
                                try:
                                    return json.loads(block["text"])
                                except (json.JSONDecodeError, TypeError):
                                    return {"raw": block["text"]}
            return None
        else:
            data = resp.json()
            if "result" in data and "content" in data["result"]:
                for block in data["result"]["content"]:
                    if block.get("type") == "text":
                        try:
                            return json.loads(block["text"])
                        except (json.JSONDecodeError, TypeError):
                            return {"raw": block["text"]}
            if "result" in data:
                return data["result"]
            return data


# ============================================================================
# Region mapping (code_postal prefix -> region)
# ============================================================================

REGION_MAP = {
    "75": "Ile-de-France", "77": "Ile-de-France", "78": "Ile-de-France",
    "91": "Ile-de-France", "92": "Ile-de-France", "93": "Ile-de-France",
    "94": "Ile-de-France", "95": "Ile-de-France",
    "69": "Auvergne-Rhone-Alpes", "01": "Auvergne-Rhone-Alpes",
    "38": "Auvergne-Rhone-Alpes", "73": "Auvergne-Rhone-Alpes",
    "74": "Auvergne-Rhone-Alpes", "42": "Auvergne-Rhone-Alpes",
    "63": "Auvergne-Rhone-Alpes", "26": "Auvergne-Rhone-Alpes",
    "07": "Auvergne-Rhone-Alpes",
    "33": "Nouvelle-Aquitaine", "64": "Nouvelle-Aquitaine",
    "40": "Nouvelle-Aquitaine", "47": "Nouvelle-Aquitaine",
    "24": "Nouvelle-Aquitaine", "87": "Nouvelle-Aquitaine",
    "31": "Occitanie", "34": "Occitanie", "30": "Occitanie",
    "11": "Occitanie", "66": "Occitanie", "81": "Occitanie",
    "13": "Provence-Alpes-Cote d'Azur", "83": "Provence-Alpes-Cote d'Azur",
    "06": "Provence-Alpes-Cote d'Azur", "84": "Provence-Alpes-Cote d'Azur",
    "35": "Bretagne", "56": "Bretagne", "22": "Bretagne", "29": "Bretagne",
    "59": "Hauts-de-France", "62": "Hauts-de-France",
    "80": "Hauts-de-France", "02": "Hauts-de-France",
    "67": "Grand Est", "68": "Grand Est", "57": "Grand Est",
    "54": "Grand Est", "88": "Grand Est", "51": "Grand Est",
    "44": "Pays de la Loire", "49": "Pays de la Loire",
    "72": "Pays de la Loire", "53": "Pays de la Loire",
    "85": "Pays de la Loire",
    "76": "Normandie", "27": "Normandie", "14": "Normandie",
    "50": "Normandie", "61": "Normandie",
}


def map_region(code_postal):
    """Map postal code to French region."""
    if not code_postal:
        return "France"
    prefix = str(code_postal)[:2]
    return REGION_MAP.get(prefix, "France")


# ============================================================================
# Sector mapping (NAF code prefix -> EdRCF sector)
# ============================================================================

def map_sector(code_naf, libelle_naf=""):
    """Map NAF code to EdRCF sector."""
    if not code_naf:
        return "Services B2B"
    naf = str(code_naf).replace(".", "")
    naf_dot = str(code_naf)

    # Exact or prefix matches
    if naf_dot.startswith("66.22") or naf.startswith("6622"):
        return "Courtage d'assurance"
    if any(naf.startswith(p) for p in ["25", "28", "29", "62"]):
        return "Industrial Tech / TIC"
    if any(naf.startswith(p) for p in ["49", "52"]):
        return "Logistique / Transport"
    if any(naf.startswith(p) for p in ["3250", "86"]):
        return "MedTech / Sante"
    if any(naf.startswith(p) for p in ["41", "43"]):
        return "BTP / Construction"
    if naf.startswith("70"):
        return "Services B2B"
    if any(naf.startswith(p) for p in ["10", "11"]):
        return "Agroalimentaire"
    if naf.startswith("35"):
        return "Energie / CleanTech"

    # Fallback: check libelle for keywords
    lib_lower = (libelle_naf or "").lower()
    if "courtage" in lib_lower or "assurance" in lib_lower:
        return "Courtage d'assurance"
    if any(w in lib_lower for w in ["transport", "logistique", "fret"]):
        return "Logistique / Transport"
    if any(w in lib_lower for w in ["medical", "sante", "pharma", "dispositif"]):
        return "MedTech / Sante"
    if any(w in lib_lower for w in ["construction", "batiment", "btp", "travaux"]):
        return "BTP / Construction"
    if any(w in lib_lower for w in ["energie", "solaire", "renouvelable", "electrique"]):
        return "Energie / CleanTech"
    if any(w in lib_lower for w in ["alimentaire", "agro", "boisson"]):
        return "Agroalimentaire"
    if any(w in lib_lower for w in ["conseil", "service", "gestion"]):
        return "Services B2B"
    if any(w in lib_lower for w in ["informatique", "logiciel", "numerique", "tech"]):
        return "Industrial Tech / TIC"

    return "Services B2B"


# ============================================================================
# Structure mapping (forme_juridique -> EdRCF structure)
# ============================================================================

def map_structure(forme_juridique):
    """Map forme_juridique to EdRCF structure type."""
    if not forme_juridique:
        return "Familiale"
    fj = forme_juridique.lower()
    if any(w in fj for w in ["sa a directoire", "sa a conseil", "societe anonyme"]):
        return "Groupe cote"
    if "sas" in fj or "sarl" in fj or "eurl" in fj or "sci" in fj:
        return "Familiale"
    return "Familiale"


# ============================================================================
# Signal detection
# ============================================================================

def detect_signals(company_info, search_had_age_filter=False):
    """Auto-detect EdRCF signals based on Pappers company data."""
    signals = []

    # --- Director age signals ---
    representants = company_info.get("representants", [])
    current_year = datetime.now().year

    for rep in representants:
        age = rep.get("age", 0)
        if not age:
            ddn = rep.get("date_de_naissance", "")
            if ddn:
                try:
                    birth_year = int(str(ddn)[:4])
                    age = current_year - birth_year
                except (ValueError, IndexError):
                    pass

        qualite = (rep.get("qualite", "") or "").lower()
        is_leader = any(w in qualite for w in [
            "president", "gerant", "directeur general", "pdg",
            "fondateur", "administrateur", "dirigeant"
        ])

        if age >= 60 and is_leader:
            if "founder_60_no_successor" not in signals:
                signals.append("founder_60_no_successor")
        if age >= 65:
            if "director_withdrawal" not in signals:
                signals.append("director_withdrawal")

        # --- Dirigeant multi-mandats ---
        autres_mandats = rep.get("autres_mandats", []) or rep.get("entreprises", []) or []
        if len(autres_mandats) >= 2 and "dirigeant_multi_mandats" not in signals:
            signals.append("dirigeant_multi_mandats")

    # --- Force founder signal if search had age filter ---
    if search_had_age_filter and "founder_60_no_successor" not in signals:
        signals.append("founder_60_no_successor")

    # --- Financial growth signal ---
    finances = company_info.get("finances", [])
    if isinstance(finances, list) and len(finances) >= 2:
        try:
            ca_values = []
            for f in finances[:3]:
                ca = f.get("chiffre_affaires")
                if ca and ca > 0:
                    ca_values.append(ca)
            if len(ca_values) >= 2 and ca_values[0] > ca_values[1]:
                growth = (ca_values[0] - ca_values[1]) / ca_values[1]
                if growth > 0.10:
                    signals.append("ca_growth_2years")
        except (TypeError, ValueError, ZeroDivisionError):
            pass

    # --- Multiple etablissements signal ---
    etablissements = company_info.get("etablissements", [])
    if isinstance(etablissements, list) and len(etablissements) > 1:
        signals.append("new_establishment")

    # --- Sector consolidation signal ---
    sector = map_sector(
        company_info.get("code_naf", ""),
        company_info.get("libelle_code_naf", "")
    )
    sector_data = SECTORS_HEAT.get(sector)
    if sector_data and sector_data.get("heat", 0) >= 70:
        signals.append("sector_consolidation")

    # --- Holding creation signal ---
    libelle = (company_info.get("libelle_code_naf", "") or "").lower()
    nom_co = (company_info.get("nom_entreprise", "") or "").lower()
    code_naf_co = company_info.get("code_naf", "") or ""
    if (
        "holding" in libelle
        or "holding" in nom_co
        or code_naf_co.startswith("64.2")
        or code_naf_co.startswith("64.3")
    ):
        signals.append("holding_creation")

    # --- Big4 audit signal (scoring_non_financier present = donnees riches disponibles) ---
    scoring_nfi = company_info.get("scoring_non_financier")
    if scoring_nfi:
        signals.append("big4_audit")

    # --- Score Pappers risque (scoring_non_financier, seul disponible via MCP) ---
    score_nfi = None
    if isinstance(scoring_nfi, dict):
        score_nfi = scoring_nfi.get("score")
    elif isinstance(scoring_nfi, (int, float)):
        score_nfi = scoring_nfi
    if score_nfi is not None:
        try:
            if float(score_nfi) >= 7:
                signals.append("score_pappers_risque")
        except (TypeError, ValueError):
            pass

    # --- Publications BODACC ---
    # Structure reelle Pappers : {type, date, description, administration, bodacc, numero_annonce}
    # "type" vaut : "Modification", "Immatriculation", "Vente", "Radiation", "Depot des comptes"...
    bodacc = company_info.get("publications_bodacc") or []
    if isinstance(bodacc, list):
        for pub in bodacc:
            type_pub = (pub.get("type") or "").lower()
            desc = (pub.get("description") or "").lower()
            admin = (pub.get("administration") or "").lower()
            combined = f"{type_pub} {desc} {admin}"
            if any(w in combined for w in ["vente", "cession"]):
                if "bodacc_cession" not in signals:
                    signals.append("bodacc_cession")
            if any(w in combined for w in ["capital", "augmentation", "reduction"]):
                if "bodacc_capital_change" not in signals:
                    signals.append("bodacc_capital_change")
            if any(w in combined for w in ["dissolution", "liquidation", "radiation"]):
                if "bodacc_dissolution" not in signals:
                    signals.append("bodacc_dissolution")
            if any(w in combined for w in ["transfert", "adresse du siege"]):
                if "hq_relocation" not in signals:
                    signals.append("hq_relocation")

    # --- Procédures collectives ---
    # Champs reels Pappers : procedure_collective_existe, procedure_collective_en_cours, procedures_collectives
    if (
        company_info.get("procedure_collective_en_cours")
        or company_info.get("procedure_collective_existe")
        or (isinstance(company_info.get("procedures_collectives"), list)
            and len(company_info["procedures_collectives"]) > 0)
    ):
        if "procedure_collective" not in signals:
            signals.append("procedure_collective")

    # --- Infogreffe actes (deposés dans les 12 derniers mois) ---
    infogreffe_actes = company_info.get("infogreffe_actes") or []
    for acte in infogreffe_actes:
        acte_type = (acte.get("type") or acte.get("libelle_type_acte") or "").lower()
        if any(w in acte_type for w in ["nomination", "gerant", "president", "directeur general", "pdg"]):
            if "infogreffe_nouveau_dirigeant" not in signals:
                signals.append("infogreffe_nouveau_dirigeant")
        if any(w in acte_type for w in ["capital", "augmentation", "reduction", "modification du capital"]):
            if "infogreffe_capital_change" not in signals:
                signals.append("infogreffe_capital_change")
        if any(w in acte_type for w in ["fusion", "absorption", "scission", "apport"]):
            if "infogreffe_fusion_absorption" not in signals:
                signals.append("infogreffe_fusion_absorption")
        if any(w in acte_type for w in ["transfert", "siege", "siege social"]):
            if "infogreffe_transfert_siege" not in signals:
                signals.append("infogreffe_transfert_siege")

    # --- Google News articles ---
    news_articles = company_info.get("news_articles") or []
    for article in news_articles:
        title = (article.get("title") or "").lower()
        if any(w in title for w in ["cession", "cede", "vend", "reprise", "acquis", "acquisition", "rachat"]):
            if "presse_cession" not in signals:
                signals.append("presse_cession")
        if any(w in title for w in ["liquidation", "redressement", "difficulte", "difficultes", "perte", "faillite"]):
            if "presse_difficultes" not in signals:
                signals.append("presse_difficultes")
        if any(w in title for w in ["levee de fonds", "leve", "levent", "investissement", "financement"]):
            if "presse_levee_fonds" not in signals:
                signals.append("presse_levee_fonds")
        if any(w in title for w in ["partenariat", "alliance", "accord", "joint", "rapprochement"]):
            if "presse_partenariat" not in signals:
                signals.append("presse_partenariat")

    # --- Fallback: press_regional if no signals detected ---
    if not signals:
        signals.append("press_regional")

    # Validate all signal IDs exist in SIGNAL_CATALOG
    validated = [s for s in signals if s in SIGNAL_CATALOG]
    if not validated:
        validated = ["press_regional"]

    return validated


# ============================================================================
# Build EdRCF target structure
# ============================================================================

def format_revenue(ca):
    """Format revenue as EUR string."""
    if not ca or ca <= 0:
        return "N/A"
    if ca >= 1_000_000:
        return f"{ca / 1_000_000:.1f}M EUR"
    if ca >= 1_000:
        return f"{ca / 1_000:.0f}K EUR"
    return f"{ca:.0f} EUR"


def compute_ebitda_range(ebitda_val):
    """Compute EBITDA range category."""
    if not ebitda_val or ebitda_val <= 0:
        return "< 3M"
    m = ebitda_val / 1_000_000
    if m < 3:
        return "< 3M"
    if m < 10:
        return "3-10M"
    if m < 30:
        return "10-30M"
    return "> 30M"


def build_analysis(signals, sector, _financials_data, dirigeants):
    """Generate analysis fields based on signals and company data."""
    has_founder_signal = "founder_60_no_successor" in signals or "director_withdrawal" in signals
    has_financial_signal = any(s in signals for s in ["ca_growth_2years", "new_establishment"])
    has_patrimoine_signal = any(s in signals for s in ["holding_creation", "big4_audit"])
    has_consolidation = "sector_consolidation" in signals

    # Determine transaction type
    if has_founder_signal and has_patrimoine_signal:
        tx_type = "Transmission / LBO"
    elif has_founder_signal:
        tx_type = "Cession / Consolidation"
    elif has_financial_signal and has_consolidation:
        tx_type = "Ouverture de Capital"
    elif len(signals) >= 3:
        tx_type = "Cession / Consolidation"
    else:
        tx_type = "Monitoring"

    # Determine window
    if len(signals) >= 4:
        window = "6-12 mois"
    elif len(signals) >= 2:
        window = "12-18 mois"
    else:
        window = "18+ mois"

    # Build narrative
    parts = []
    if has_founder_signal and dirigeants:
        oldest = max(dirigeants, key=lambda d: d.get("age", 0))
        parts.append(
            f"Le dirigeant {oldest.get('name', 'principal')} ({oldest.get('age', '?')} ans) "
            f"presente un profil de maturite avancee, suggerant une reflexion patrimoniale."
        )
    if has_patrimoine_signal:
        parts.append(
            "Des signaux patrimoniaux (structuration holding, audit Big 4) confirment "
            "une preparation de cession ou de reorganisation."
        )
    if has_financial_signal:
        parts.append(
            "La dynamique financiere positive (croissance CA, expansion) renforce "
            "l'attractivite de la cible pour les acquéreurs."
        )
    if has_consolidation:
        parts.append(
            f"Le secteur {sector} est en phase de consolidation active, "
            f"offrant un contexte favorable a une transaction."
        )
    if not parts:
        parts.append(
            "Cible identifiee via screening Pappers. Surveillance recommandee "
            "en attendant des signaux plus affirmes."
        )

    return {
        "type": tx_type,
        "window": window,
        "narrative": " ".join(parts),
    }


def build_risks(signals):
    """Generate risk assessment."""
    n = len(signals)
    if n >= 4:
        return {
            "falsePositive": "Faible (0.12)",
            "uncertainties": "Convergence de plusieurs signaux. Verifier la volonte reelle du dirigeant et le calendrier de cession.",
        }
    if n >= 2:
        return {
            "falsePositive": "Moyen (0.25)",
            "uncertainties": "Signaux partiels. La situation pourrait evoluer favorablement ou se stabiliser. Surveillance recommandee.",
        }
    return {
        "falsePositive": "Eleve (0.40)",
        "uncertainties": "Peu de signaux detectes. Risque de faux positif significatif. Veille passive recommandee.",
    }


def build_target(idx, company_info, search_info, search_had_age_filter=False):
    """Build a complete EdRCF target structure from Pappers company data."""
    siren = company_info.get("siren", "")
    nom = company_info.get("nom_entreprise", "")
    siege = company_info.get("siege", {}) or {}
    code_postal = siege.get("code_postal", "")
    ville = siege.get("ville", "")
    code_naf = company_info.get("code_naf", "")
    libelle_naf = company_info.get("libelle_code_naf", "")
    date_creation = company_info.get("date_creation", "")
    forme_juridique = company_info.get("forme_juridique", "")
    effectif = company_info.get("effectif", "")

    sector = map_sector(code_naf, libelle_naf)
    region = map_region(code_postal)
    structure = map_structure(forme_juridique)

    # --- Dirigeants ---
    representants = company_info.get("representants", [])
    current_year = datetime.now().year
    dirigeants = []
    for rep in representants[:5]:  # Limit to 5 directors
        prenom = rep.get("prenom", "")
        nom_d = rep.get("nom", "")
        qualite = rep.get("qualite", "")
        age = rep.get("age", 0)
        if not age:
            ddn = rep.get("date_de_naissance", "")
            if ddn:
                try:
                    birth_year = int(str(ddn)[:4])
                    age = current_year - birth_year
                except (ValueError, IndexError):
                    age = 0
        date_prise = rep.get("date_prise_de_poste", "")
        since = ""
        if date_prise:
            try:
                since = str(date_prise)[:4]
            except (ValueError, IndexError):
                since = ""
        full_name = f"{prenom} {nom_d}".strip()
        if full_name and qualite:
            dirigeants.append({
                "name": full_name,
                "role": qualite,
                "age": age,
                "since": since,
            })

    # --- Financials ---
    finances = company_info.get("finances", [])
    # Also use search_info CA if available
    search_ca = search_info.get("chiffre_affaires", 0) or 0

    ca = 0
    ca_prev = 0
    resultat = 0
    last_year = 0
    if isinstance(finances, list) and finances:
        for f in finances[:1]:
            ca = f.get("chiffre_affaires", 0) or 0
            resultat = f.get("resultat", 0) or 0
            annee = f.get("annee") or f.get("date_cloture_exercice", "")
            if annee:
                try:
                    last_year = int(str(annee)[:4])
                except (ValueError, IndexError):
                    last_year = current_year - 1
        if len(finances) >= 2:
            ca_prev = finances[1].get("chiffre_affaires", 0) or 0

    if not ca and search_ca:
        ca = search_ca

    # Calculate growth
    revenue_growth = "N/A"
    if ca and ca_prev and ca_prev > 0:
        growth_pct = ((ca - ca_prev) / ca_prev) * 100
        sign = "+" if growth_pct > 0 else ""
        revenue_growth = f"{sign}{growth_pct:.1f}%"

    # Estimate EBITDA at 15% margin
    ebitda_val = ca * 0.15 if ca else 0
    ebitda_margin = "15.0%"

    financials = {
        "revenue": format_revenue(ca),
        "revenue_growth": revenue_growth,
        "ebitda": format_revenue(ebitda_val),
        "ebitda_margin": ebitda_margin,
        "ebitda_range": compute_ebitda_range(ebitda_val),
        "effectif": effectif or "N/A",
        "last_published_year": last_year or current_year - 1,
    }

    # --- Signals ---
    active_signals = detect_signals(company_info, search_had_age_filter)

    # --- Analysis ---
    analysis = build_analysis(active_signals, sector, financials, dirigeants)

    # --- Activation ---
    deciders = []
    for d in dirigeants[:2]:
        deciders.append(f"{d['name']} ({d['role']})")
    if not deciders:
        deciders = [nom]

    activation = {
        "deciders": deciders,
        "approach": f"Approche via screening Pappers. Identifier un intermediaire local (expert-comptable, avocat) pour une introduction aupres de {deciders[0] if deciders else 'la direction'}.",
        "reason": f"Cible identifiee dans le secteur {sector} avec {len(active_signals)} signal(aux) EdRCF actif(s).",
    }

    # --- Relationship (default for Pappers-sourced targets) ---
    relationship = {
        "strength": max(5, min(50, len(active_signals) * 8)),
        "path": "Identifie via screening Pappers",
        "common_connections": 0,
        "edr_banker": None,
    }

    # --- Statut activite ---
    entreprise_cessee = company_info.get("entreprise_cessee", False)
    date_cessation = company_info.get("date_cessation", None)
    statut_activite = "Radie" if entreprise_cessee else "En activite"
    procedure_en_cours = company_info.get("procedure_collective_en_cours", False)

    # --- Group / Holding ---
    etablissements = company_info.get("etablissements", [])
    beneficiaires = company_info.get("beneficiaires_effectifs", [])
    nom_lower = (nom or "").lower()
    libelle_lower = (libelle_naf or "").lower()
    code_naf_str = code_naf or ""

    # Detecter si c'est une holding (NAF 64.2x / 64.3x ou nom)
    is_holding = (
        "holding" in nom_lower
        or "holding" in libelle_lower
        or code_naf_str.startswith("64.2")
        or code_naf_str.startswith("64.3")
    )

    # Societe mere via beneficiaires_effectifs (personne morale uniquement)
    parent_name = None
    for be in beneficiaires:
        be_type = (be.get("type", "") or "").lower()
        if "societe" in be_type or "morale" in be_type:
            parent_name = be.get("denomination") or be.get("nom")
            break

    # Etablissements secondaires
    subsidiaries = []
    if isinstance(etablissements, list):
        for etab in etablissements[1:6]:
            etab_siret = etab.get("siret", "")
            etab_ville = etab.get("ville", "")
            if etab_siret:
                subsidiaries.append({
                    "siret": etab_siret,
                    "city": etab_ville,
                })

    is_group = is_holding or (parent_name is not None) or (isinstance(etablissements, list) and len(etablissements) > 1)

    group = {
        "is_group": is_group,
        "is_holding": is_holding,
        "parent": parent_name,
        "subsidiaries": subsidiaries,
        "nb_etablissements": len(etablissements) if isinstance(etablissements, list) else 0,
        "procedure_collective_en_cours": procedure_en_cours,
        "consolidated_revenue": None,
    }

    # --- Risks ---
    risks = build_risks(active_signals)

    target_id = f"edrcf-{idx:03d}"

    return {
        "id": target_id,
        "siren": siren,
        "name": nom,
        "sector": sector,
        "sub_sector": libelle_naf or "N/A",
        "region": region,
        "city": ville or "France",
        "code_naf": code_naf or "",
        "creation_date": date_creation or "",
        "structure": structure,
        "statut_activite": statut_activite,
        "date_cessation": date_cessation,
        "publication_status": "Publie",
        "dirigeants": dirigeants if dirigeants else [{"name": nom, "role": "Dirigeant", "age": 0, "since": ""}],
        "financials": financials,
        "active_signals": active_signals,
        "group": group,
        "relationship": relationship,
        "analysis": analysis,
        "activation": activation,
        "risks": risks,
    }


# ============================================================================
# Main loader: search + enrich pipeline
# ============================================================================

SEARCH_PROFILES = [
    {
        "label": "Courtage assurance, dirigeant >58 ans, CA >3M",
        "filters": {
            "code_naf": "66.22Z",
            "age_dirigeant_min": "58",
            "chiffre_affaires_min": "3000000",
            "par_page": "3",
            "entreprise_cessee": "false",
            "return_fields": ["siren", "nom_entreprise", "siege", "date_creation",
                              "code_naf", "libelle_code_naf", "effectif",
                              "chiffre_affaires", "capital", "forme_juridique", "resultat"],
        },
        "has_age_filter": True,
    },
    {
        "label": "Transport/Logistique, dirigeant >58 ans, CA >5M",
        "filters": {
            "code_naf": "49.41A",
            "age_dirigeant_min": "58",
            "chiffre_affaires_min": "5000000",
            "par_page": "2",
            "entreprise_cessee": "false",
            "return_fields": ["siren", "nom_entreprise", "siege", "date_creation",
                              "code_naf", "libelle_code_naf", "effectif",
                              "chiffre_affaires", "capital", "forme_juridique", "resultat"],
        },
        "has_age_filter": True,
    },
    {
        "label": "BTP/Construction, dirigeant >60 ans, CA >5M",
        "filters": {
            "code_naf": "41.20A",
            "age_dirigeant_min": "60",
            "chiffre_affaires_min": "5000000",
            "par_page": "2",
            "entreprise_cessee": "false",
            "return_fields": ["siren", "nom_entreprise", "siege", "date_creation",
                              "code_naf", "libelle_code_naf", "effectif",
                              "chiffre_affaires", "capital", "forme_juridique", "resultat"],
        },
        "has_age_filter": True,
    },
    {
        "label": "Conseil management, CA >10M",
        "filters": {
            "code_naf": "70.22Z",
            "chiffre_affaires_min": "10000000",
            "par_page": "2",
            "entreprise_cessee": "false",
            "return_fields": ["siren", "nom_entreprise", "siege", "date_creation",
                              "code_naf", "libelle_code_naf", "effectif",
                              "chiffre_affaires", "capital", "forme_juridique", "resultat"],
        },
        "has_age_filter": False,
    },
    {
        "label": "MedTech, CA >2M",
        "filters": {
            "code_naf": "32.50A",
            "chiffre_affaires_min": "2000000",
            "par_page": "1",
            "entreprise_cessee": "false",
            "return_fields": ["siren", "nom_entreprise", "siege", "date_creation",
                              "code_naf", "libelle_code_naf", "effectif",
                              "chiffre_affaires", "capital", "forme_juridique", "resultat"],
        },
        "has_age_filter": False,
    },
]


async def load_targets_from_pappers(mcp_url, count=10):
    """
    Fetch real company targets from Pappers MCP.
    Pipeline: search -> deduplicate -> enrich with informations-entreprise -> build targets.
    """
    seen_sirens = set()
    raw_companies = []  # List of (search_result_item, search_profile)

    print(f"[EdRCF] Starting Pappers load pipeline (target: {count} companies)...")

    # Step 1: Run search queries
    for profile in SEARCH_PROFILES:
        if len(raw_companies) >= count:
            break

        print(f"[EdRCF] Searching: {profile['label']}...")
        try:
            result = await call_pappers_mcp(mcp_url, "recherche-entreprises", profile["filters"])
            if result and isinstance(result, dict):
                resultats = result.get("resultats", [])
                total = result.get("total", 0)
                print(f"[EdRCF]   -> {len(resultats)} results (total: {total})")

                for r in resultats:
                    siren = r.get("siren", "")
                    if siren and siren not in seen_sirens:
                        seen_sirens.add(siren)
                        raw_companies.append((r, profile))
                        if len(raw_companies) >= count:
                            break
            else:
                print(f"[EdRCF]   -> No results or unexpected format: {type(result)}")
        except Exception as e:
            print(f"[EdRCF]   -> Search error: {e}")

    print(f"[EdRCF] Collected {len(raw_companies)} unique companies. Enriching...")

    # Step 2: Enrich each company with full details
    targets = []
    for idx, (search_item, profile) in enumerate(raw_companies, start=1):
        siren = search_item.get("siren", "")
        nom = search_item.get("nom_entreprise", "N/A")
        print(f"[EdRCF] Enriching {idx}/{len(raw_companies)}: {nom} ({siren})...")

        try:
            company_info = await call_pappers_mcp(mcp_url, "informations-entreprise", {
                "siren": siren,
                "return_fields": [
                    "siren", "nom_entreprise", "siege", "representants",
                    "date_creation", "code_naf", "libelle_code_naf", "effectif",
                    "forme_juridique", "capital", "finances",
                    "beneficiaires_effectifs", "etablissements",
                    "entreprise_cessee", "date_cessation",
                    "procedure_collective_existe", "procedure_collective_en_cours",
                    "procedures_collectives", "publications_bodacc",
                    "scoring_non_financier",
                ],
            })

            if not company_info or not isinstance(company_info, dict):
                print(f"[EdRCF]   -> Skipped (no detail data)")
                continue

            # Handle case where company_info might be wrapped
            if "raw" in company_info:
                print(f"[EdRCF]   -> Skipped (raw response)")
                continue

            target = build_target(
                idx=idx,
                company_info=company_info,
                search_info=search_item,
                search_had_age_filter=profile.get("has_age_filter", False),
            )
            targets.append(target)
            print(f"[EdRCF]   -> OK: {target['name']} | {target['sector']} | {len(target['active_signals'])} signals")

        except Exception as e:
            print(f"[EdRCF]   -> Enrichment error for {siren}: {e}")

    print(f"[EdRCF] Pipeline complete: {len(targets)} targets built.")
    return targets
