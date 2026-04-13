"""
EdRCF 6.0 | AI Origination Intelligence
FastAPI backend for Edmond de Rothschild Corporate Finance M&A platform.
"""

import sys
import os

# Ensure local imports work on Vercel (working dir may not be backend/)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, Optional
import time
import copy
import json
import httpx
from dotenv import load_dotenv

load_dotenv()

from demo_data import SIGNAL_CATALOG, DEFAULT_SCORING_WEIGHTS, SECTORS_HEAT
from pappers_loader import load_targets_from_pappers, load_cache, save_cache


# ==========================================================================
# Scoring Engine
# ==========================================================================

scoring_config = copy.deepcopy(DEFAULT_SCORING_WEIGHTS)


def calculate_score(company, weights=None):
    """Calculate score from active signals with dimension capping."""
    if weights is None:
        weights = scoring_config
    dimensions = {k: 0 for k in weights}
    signals_detail = []
    for sig_id in company["active_signals"]:
        sig = SIGNAL_CATALOG.get(sig_id)
        if sig:
            dimensions[sig["dimension"]] += sig["points"]
            signals_detail.append({**sig, "id": sig_id})

    scored = {}
    total = 0
    for dim, raw in dimensions.items():
        mx = weights[dim]["max"]
        capped = min(raw, mx)
        scored[dim] = {
            "score": capped,
            "raw": raw,
            "max": mx,
            "label": weights[dim]["label"],
        }
        total += capped

    if total >= 65:
        priority = "Action Prioritaire"
    elif total >= 45:
        priority = "Qualification"
    elif total >= 25:
        priority = "Monitoring"
    else:
        priority = "Veille Passive"

    return round(total, 1), priority, scored, signals_detail


def enrich_target(company):
    """Apply scoring and return enriched target dict."""
    score, priority, scored_dims, signals = calculate_score(company)
    return {
        **company,
        "globalScore": score,
        "priorityLevel": priority,
        "scoring_details": scored_dims,
        "topSignals": signals,
    }


PAPPERS_MCP_URL = os.getenv("PAPPERS_MCP_URL", "")

# Global list populated at startup
enriched_targets = []
# Keep raw targets (pre-enrichment) for re-scoring
raw_targets = []


def _load_targets_sync():
    """Load targets from cache (synchronous, safe for serverless cold start)."""
    global enriched_targets, raw_targets
    if enriched_targets:
        return  # Already loaded
    try:
        cached = load_cache()
        if cached:
            raw_targets = cached
            enriched_targets = [enrich_target(c) for c in cached]
            print(f"[EdRCF] Loaded {len(enriched_targets)} targets from cache")
        else:
            enriched_targets = []
            raw_targets = []
            print("[EdRCF] No cache found. Use /api/refresh-targets to load from Pappers")
    except Exception as e:
        print(f"[EdRCF] Cache load error: {e}")
        enriched_targets = []
        raw_targets = []


@asynccontextmanager
async def lifespan(app):
    global enriched_targets, raw_targets
    _load_targets_sync()

    # Try to fetch from Pappers in background if no cache
    if not enriched_targets and PAPPERS_MCP_URL:
        try:
            fetched = await load_targets_from_pappers(PAPPERS_MCP_URL, count=10)
            if fetched:
                save_cache(fetched)
                raw_targets = fetched
                enriched_targets = [enrich_target(c) for c in fetched]
                print(f"[EdRCF] Loaded {len(enriched_targets)} targets from Pappers MCP")
        except Exception as e:
            print(f"[EdRCF] Pappers fetch failed: {e}")

    yield


app = FastAPI(
    title="EdRCF 6.0 | AI Origination Intelligence",
    version="6.0.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure targets are loaded even if lifespan doesn't run (Vercel serverless)
_load_targets_sync()


# ==========================================================================
# Pappers MCP Client
# ==========================================================================


async def call_pappers_mcp(tool_name: str, arguments: dict):
    """Call a Pappers MCP tool via the streamable HTTP MCP server."""
    if not PAPPERS_MCP_URL:
        return None
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            # MCP streamable HTTP: POST with JSON-RPC
            resp = await client.post(
                PAPPERS_MCP_URL,
                headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream"},
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "tools/call",
                    "params": {"name": tool_name, "arguments": arguments},
                },
            )
            if resp.status_code == 200:
                content_type = resp.headers.get("content-type", "")
                if "text/event-stream" in content_type:
                    # Parse SSE response
                    for line in resp.text.split("\n"):
                        if line.startswith("data: "):
                            data = json.loads(line[6:])
                            if "result" in data:
                                return data["result"]
                    return None
                else:
                    data = resp.json()
                    if "result" in data:
                        return data["result"]
                    return data
            print(f"[Pappers MCP] HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print(f"[Pappers MCP] Error: {e}")
    return None


async def search_pappers(query: str = "", par_page: str = "10", **filters):
    """Search companies via Pappers MCP with structured filters. Max 10 results."""
    args = {
        "par_page": par_page,
        "entreprise_cessee": "false",
        "return_fields": ["siren", "nom_entreprise", "siege", "date_creation",
                          "code_naf", "libelle_code_naf", "effectif",
                          "forme_juridique", "capital", "chiffre_affaires", "resultat"],
    }
    # If query looks like a company name, use nom_entreprise filter
    if query and not any(k in filters for k in ["code_naf", "age_dirigeant_min"]):
        args["nom_entreprise"] = query
    # Merge explicit filters
    args.update(filters)
    result = await call_pappers_mcp("recherche-entreprises", args)
    if result:
        # Extract text content from MCP response
        if isinstance(result, dict) and "content" in result:
            for block in result["content"]:
                if block.get("type") == "text":
                    try:
                        return json.loads(block["text"])
                    except json.JSONDecodeError:
                        return {"raw": block["text"]}
        return result
    return {"results": [], "message": "Pappers MCP non disponible"}


async def get_pappers_company(siren: str):
    """Get company details via Pappers MCP."""
    result = await call_pappers_mcp("informations-entreprise", {
        "siren": siren,
        "return_fields": ["siren", "nom_entreprise", "siege", "representants",
                          "date_creation", "code_naf", "libelle_code_naf", "effectif",
                          "forme_juridique", "capital", "finances",
                          "beneficiaires_effectifs", "etablissements",
                          "scoring_financier", "scoring_non_financier"]
    })
    if result:
        if isinstance(result, dict) and "content" in result:
            for block in result["content"]:
                if block.get("type") == "text":
                    try:
                        return json.loads(block["text"])
                    except json.JSONDecodeError:
                        return {"raw": block["text"]}
        return result
    return None


async def get_pappers_dirigeants(siren: str):
    """Get company directors via Pappers MCP."""
    result = await call_pappers_mcp("recherche-dirigeants", {"siren": siren})
    if result:
        if isinstance(result, dict) and "content" in result:
            for block in result["content"]:
                if block.get("type") == "text":
                    try:
                        return json.loads(block["text"])
                    except json.JSONDecodeError:
                        return {"raw": block["text"]}
        return result
    return None


# ==========================================================================
# Copilot with DeepSeek AI
# ==========================================================================

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")


async def copilot_ai_query(query: str, context: str):
    if not DEEPSEEK_API_KEY:
        return None  # Fall back to rule-based
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "deepseek-chat",
                    "max_tokens": 1024,
                    "temperature": 0.3,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "Tu es le Copilot IA d'EdRCF 6.0, plateforme d'origination M&A "
                                "pour Edmond de Rothschild Corporate Finance. Reponds en francais, "
                                "de maniere concise et professionnelle. Utilise le markdown pour "
                                "formater tes reponses (gras, listes, tableaux).\n\n"
                                "Tu as acces a deux sources de donnees:\n"
                                "1. Base interne EdRCF: cibles pre-scorees avec signaux M&A\n"
                                "2. Pappers (open data): donnees legales/financieres de toutes les entreprises francaises\n\n"
                                "Quand le contexte contient des 'Donnees Pappers', analyse-les "
                                "en croisant avec les criteres EdRCF (age dirigeant, CA, secteur en consolidation, "
                                "structure holding, etc.) pour identifier les meilleures opportunites M&A.\n\n"
                                f"Contexte:\n{context}"
                            ),
                        },
                        {"role": "user", "content": query},
                    ],
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                return data["choices"][0]["message"]["content"]
            print(f"[DeepSeek] HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print(f"[DeepSeek] Error: {e}")
    return None


# ==========================================================================
# API Endpoints
# ==========================================================================


@app.get("/api/targets")
def get_targets(
    q: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    ebitda_range: Optional[str] = Query(None),
    min_score: Optional[float] = Query(None),
    structure: Optional[str] = Query(None),
    publication_status: Optional[str] = Query(None),
):
    results = enriched_targets
    if q:
        ql = q.lower()
        results = [
            t
            for t in results
            if ql in t["name"].lower()
            or ql in t["sector"].lower()
            or ql in t.get("sub_sector", "").lower()
            or ql in t.get("city", "").lower()
            or ql in t.get("siren", "")
        ]
    if sector:
        results = [t for t in results if t["sector"] == sector]
    if region:
        results = [t for t in results if t["region"] == region]
    if ebitda_range:
        results = [t for t in results if t["financials"]["ebitda_range"] == ebitda_range]
    if min_score is not None:
        results = [t for t in results if t["globalScore"] >= min_score]
    if structure:
        results = [t for t in results if t["structure"] == structure]
    if publication_status:
        results = [t for t in results if t["publication_status"] == publication_status]

    results = sorted(results, key=lambda x: x["globalScore"], reverse=True)
    return {
        "data": results,
        "total": len(results),
        "filters": {
            "sectors": sorted(set(t["sector"] for t in enriched_targets)),
            "regions": sorted(set(t["region"] for t in enriched_targets)),
            "structures": sorted(set(t["structure"] for t in enriched_targets)),
            "ebitda_ranges": ["< 3M", "3-10M", "10-30M", "> 30M"],
        },
    }


@app.get("/api/targets/search-pappers")
async def search_pappers_endpoint(q: str = Query(...)):
    """Search real companies via Pappers MCP and return enriched results."""
    pappers_data = await search_pappers(q)

    # If we got raw results, try to extract and format them
    if isinstance(pappers_data, dict) and "resultats" in pappers_data:
        companies = []
        for r in pappers_data["resultats"][:10]:
            company = {
                "siren": r.get("siren", ""),
                "name": r.get("nom_entreprise", r.get("denomination", "")),
                "siege": r.get("siege", {}),
                "dirigeants": r.get("representants", []),
                "date_creation": r.get("date_creation", ""),
                "code_naf": r.get("code_naf", ""),
                "libelle_naf": r.get("libelle_code_naf", ""),
                "effectif": r.get("effectif", ""),
                "forme_juridique": r.get("forme_juridique", ""),
                "capital": r.get("capital", ""),
            }
            companies.append(company)
        return {"data": companies, "total": pappers_data.get("total", 0), "source": "pappers-mcp"}

    # Return raw data if format is unexpected
    return {"data": pappers_data, "source": "pappers-mcp"}


@app.get("/api/pappers/search-edrcf")
async def search_pappers_edrcf(
    code_naf: Optional[str] = Query(None),
    age_dirigeant_min: Optional[str] = Query(None),
    chiffre_affaires_min: Optional[str] = Query(None),
    chiffre_affaires_max: Optional[str] = Query(None),
    departement: Optional[str] = Query(None),
    capital_min: Optional[str] = Query(None),
    par_page: str = Query("10"),
):
    """Search Pappers with EdRCF-specific M&A filters."""
    filters = {"par_page": par_page}
    if code_naf:
        filters["code_naf"] = code_naf
    if age_dirigeant_min:
        filters["age_dirigeant_min"] = age_dirigeant_min
    if chiffre_affaires_min:
        filters["chiffre_affaires_min"] = chiffre_affaires_min
    if chiffre_affaires_max:
        filters["chiffre_affaires_max"] = chiffre_affaires_max
    if departement:
        filters["departement"] = departement
    if capital_min:
        filters["capital_min"] = capital_min

    pappers_data = await search_pappers(**filters)

    if isinstance(pappers_data, dict) and "resultats" in pappers_data:
        companies = []
        for r in pappers_data["resultats"][:int(par_page)]:
            siege = r.get("siege", {}) or {}
            ca = r.get("chiffre_affaires")
            companies.append({
                "siren": r.get("siren", ""),
                "name": r.get("nom_entreprise", ""),
                "city": siege.get("ville", ""),
                "code_postal": siege.get("code_postal", ""),
                "date_creation": r.get("date_creation", ""),
                "code_naf": r.get("code_naf", ""),
                "libelle_naf": r.get("libelle_code_naf", ""),
                "effectif": r.get("effectif", ""),
                "forme_juridique": r.get("forme_juridique", ""),
                "capital": r.get("capital"),
                "chiffre_affaires": ca,
                "chiffre_affaires_fmt": f"{ca/1e6:.1f}M EUR" if ca and ca > 0 else "N/A",
                "resultat": r.get("resultat"),
            })
        return {"data": companies, "total": pappers_data.get("total", 0), "source": "pappers-mcp"}
    return {"data": pappers_data, "source": "pappers-mcp"}


@app.get("/api/pappers/company/{siren}")
async def get_pappers_company_endpoint(siren: str):
    """Get detailed company info from Pappers MCP."""
    data = await get_pappers_company(siren)
    if data:
        return {"data": data, "source": "pappers-mcp"}
    raise HTTPException(status_code=404, detail="Entreprise non trouvee via Pappers")


@app.get("/api/pappers/dirigeants/{siren}")
async def get_pappers_dirigeants_endpoint(siren: str):
    """Get company directors from Pappers MCP."""
    data = await get_pappers_dirigeants(siren)
    if data:
        return {"data": data, "source": "pappers-mcp"}
    raise HTTPException(status_code=404, detail="Dirigeants non trouves via Pappers")


@app.get("/api/targets/{target_id}")
def get_target(target_id: str):
    target = next((t for t in enriched_targets if t["id"] == target_id), None)
    if target:
        return {"data": target}
    raise HTTPException(status_code=404, detail="Target not found")


@app.get("/api/signals")
def get_signals(severity: Optional[str] = Query(None)):
    signals_feed = []
    for t in enriched_targets:
        for sig in t["topSignals"]:
            if severity and sig["severity"] != severity:
                continue
            signals_feed.append(
                {
                    "id": f"{t['id']}-{sig['id']}",
                    "type": sig["family"],
                    "title": f"{sig['label']} — {t['name']}",
                    "time": "Recent",
                    "source": sig["source"],
                    "source_url": sig["source_url"],
                    "severity": sig["severity"],
                    "location": f"{t['city']}, {t['region']}",
                    "tags": [sig["family"], t["sector"]],
                    "target_id": t["id"],
                    "target_name": t["name"],
                    "dimension": sig["dimension"],
                    "points": sig["points"],
                }
            )
    # Sort: high first, then medium, then low
    order = {"high": 0, "medium": 1, "low": 2}
    signals_feed.sort(key=lambda s: order.get(s["severity"], 3))
    return {"data": signals_feed, "total": len(signals_feed), "catalog": SIGNAL_CATALOG}


@app.get("/api/pipeline")
def get_pipeline():
    """5 M&A stages pipeline"""
    pipeline = [
        {"id": "origination", "title": "Origination", "color": "indigo", "cards": []},
        {"id": "qualification", "title": "Qualification", "color": "purple", "cards": []},
        {"id": "pitch", "title": "Pitch", "color": "amber", "cards": []},
        {"id": "execution", "title": "Execution", "color": "emerald", "cards": []},
        {"id": "closing", "title": "Closing", "color": "green", "cards": []},
    ]
    for t in enriched_targets:
        card = {
            "id": t["id"],
            "name": t["name"],
            "sector": t["sector"],
            "score": t["globalScore"],
            "priority": t["priorityLevel"],
            "tags": [t["analysis"]["type"]],
            "window": t["analysis"]["window"],
            "ebitda": t["financials"]["ebitda"],
        }
        if t["globalScore"] >= 65:
            pipeline[1]["cards"].append(card)  # Qualification (already scored high)
        elif t["globalScore"] >= 45:
            pipeline[0]["cards"].append(card)  # Origination

    # Add demo cards in later stages for visual effect
    pipeline[2]["cards"].append(
        {
            "id": "demo-pitch-1",
            "name": "Courtage Prestige Assurances",
            "sector": "Courtage d'assurance",
            "score": 82,
            "priority": "Action Prioritaire",
            "tags": ["Transmission / LBO"],
            "window": "3-6 mois",
            "ebitda": "5.9M EUR",
        }
    )
    pipeline[3]["cards"].append(
        {
            "id": "demo-exec-1",
            "name": "TechParts International",
            "sector": "Industrial Tech / TIC",
            "score": 78,
            "priority": "Action Prioritaire",
            "tags": ["Mandat signe"],
            "window": "En cours",
            "ebitda": "15.2M EUR",
        }
    )
    pipeline[4]["cards"].append(
        {
            "id": "demo-closing-1",
            "name": "LogiNord Express",
            "sector": "Logistique / Transport",
            "score": 91,
            "priority": "Closing",
            "tags": ["Offre ferme"],
            "window": "Closing Q2 2026",
            "ebitda": "9.8M EUR",
        }
    )

    return {"data": pipeline}


@app.post("/api/pipeline/move")
def move_pipeline_card(
    card_id: str = Query(...),
    from_stage: str = Query(...),
    to_stage: str = Query(...),
):
    return {
        "success": True,
        "message": f"Carte {card_id} deplacee de {from_stage} vers {to_stage}",
    }


@app.get("/api/scoring/config")
def get_scoring_config():
    return {"data": scoring_config}


@app.post("/api/scoring/config")
def update_scoring_config(config: Dict[str, Any]):
    global enriched_targets
    for key, val in config.items():
        if key in scoring_config:
            scoring_config[key].update(val)
    enriched_targets = [enrich_target(c) for c in raw_targets]
    return {
        "data": scoring_config,
        "message": "Ponderations mises a jour. Scores recalcules.",
    }


def build_target_from_search(idx, search_result, search_context=None):
    """Build an EdRCF target from Pappers search result, using search context for signal detection."""
    from pappers_loader import map_sector, map_region, map_structure, build_risks

    ctx = search_context or {}
    siege = search_result.get("siege", {}) or {}
    ca = search_result.get("chiffre_affaires", 0) or 0
    siren = search_result.get("siren", "")
    name = search_result.get("nom_entreprise", "")
    libelle_naf = search_result.get("libelle_code_naf", "")
    code_naf = search_result.get("code_naf", "")
    ville = siege.get("ville", "")
    cp = siege.get("code_postal", "")
    effectif = search_result.get("effectif", "N/A")
    date_creation = search_result.get("date_creation", "")
    forme_juridique = search_result.get("forme_juridique", "")

    sector = map_sector(code_naf, libelle_naf)
    region = map_region(cp)
    structure = map_structure(forme_juridique)

    # Format financials
    ca_fmt = f"{ca / 1e6:.1f}M EUR" if ca > 0 else "N/A"
    ebitda_est = ca * 0.15
    ebitda_fmt = f"{ebitda_est / 1e6:.1f}M EUR" if ca > 0 else "N/A"
    ebitda_margin = "15.0%" if ca > 0 else "N/A"

    from pappers_loader import compute_ebitda_range
    ebitda_range = compute_ebitda_range(ebitda_est)

    # Smart signal detection using search context
    signals = []
    age_min = int(ctx.get("age_dirigeant_min", 0) or 0)
    if age_min >= 60:
        signals.append("founder_60_no_successor")
        if age_min >= 65:
            signals.append("director_withdrawal")
    if age_min >= 55:
        signals.append("director_speaker")
    # Sector signals
    sector_data = SECTORS_HEAT.get(sector)
    if sector_data and sector_data.get("heat", 0) >= 60:
        signals.append("sector_consolidation")
    # Financial signals
    if ca > 10e6:
        signals.append("ca_growth_2years")
        signals.append("headcount_growth_20")
    elif ca > 3e6:
        signals.append("ca_growth_2years")
    # Holding / structure signals
    if "holding" in (libelle_naf or "").lower():
        signals.append("holding_creation")
    if ca > 5e6:
        signals.append("big4_audit")
    # Always add establishment if multi-site
    if effectif and "50" in str(effectif) or "100" in str(effectif) or "200" in str(effectif):
        signals.append("new_establishment")
    signals.append("press_regional")
    # Deduplicate and validate
    signals = list(dict.fromkeys(s for s in signals if s in SIGNAL_CATALOG)) or ["press_regional"]

    from pappers_loader import build_analysis as _build_analysis

    est_age = max(age_min, 62) if age_min >= 55 else 0
    dirigeants = [{"name": "Dirigeant principal", "role": "President", "age": est_age, "since": "N/A"}]
    analysis = _build_analysis(signals, sector, {}, dirigeants)
    risks = build_risks(signals)

    return {
        "id": f"edrcf-{idx:03d}",
        "siren": siren,
        "name": name,
        "sector": sector,
        "sub_sector": libelle_naf or "N/A",
        "region": region,
        "city": ville or "France",
        "code_naf": code_naf or "",
        "creation_date": date_creation,
        "structure": structure,
        "publication_status": "Publie",
        "dirigeants": dirigeants,
        "financials": {
            "revenue": ca_fmt,
            "revenue_growth": "N/A",
            "ebitda": ebitda_fmt,
            "ebitda_margin": ebitda_margin,
            "ebitda_range": ebitda_range,
            "effectif": effectif or "N/A",
            "last_published_year": 2024,
        },
        "active_signals": signals,
        "group": {"is_group": False, "parent": None, "subsidiaries": [], "consolidated_revenue": None},
        "relationship": {
            "strength": max(5, min(50, len(signals) * 8)),
            "path": "Identifie via Copilot Pappers",
            "common_connections": 0,
            "edr_banker": None,
        },
        "analysis": analysis,
        "activation": {
            "deciders": ["A identifier"],
            "approach": "Qualification via screening Pappers",
            "reason": f"Entreprise identifiee par le Copilot IA dans le secteur {sector}.",
        },
        "risks": risks,
    }


@app.get("/api/copilot/query")
async def copilot_query(q: str = Query(...)):
    global enriched_targets, raw_targets

    # Build compact context from local targets (top 5 only to save tokens)
    context_lines = []
    for t in enriched_targets[:5]:
        context_lines.append(
            f"- {t['name']} ({t['sector']}, {t['city']}): Score {t['globalScore']}, "
            f"{t['priorityLevel']}, {t['analysis']['type']}, {t['analysis']['window']}"
        )
    context = f"Cibles EdRCF ({len(enriched_targets)} total, top 5):\n" + "\n".join(context_lines)

    # --- Detect if user wants Pappers data and enrich context ---
    ql = q.lower()
    pappers_context = ""
    pappers_filters = {}
    targets_updated = False

    # Broad intent detection — trigger Pappers for any company/sector query
    wants_pappers = any(w in ql for w in [
        "pappers", "cherche", "recherche", "trouve", "identifier",
        "screening", "screener", "scan", "prospecter", "nouvelles cibles",
        "open data", "siren", "societe", "société", "entreprise",
        "pme", "eti", "groupe", "parle moi", "liste", "quelles",
        "montre", "affiche", "donne", "ca superieur", "chiffre",
        "salarie", "salarié", "effectif", "france",
    ])

    # Sector → NAF code mapping (broad)
    sector_naf_map = {
        "courtage": "66.22Z", "assurance": "66.22Z",
        "industri": "25,28,29", "mecanique": "25.62A", "usinage": "25.62A",
        "logistique": "49.41A,52", "transport": "49.41A,49.41B",
        "medtech": "32.50A", "medical": "32.50A", "sante": "32.50A,86",
        "pharma": "21", "clinique": "86.10Z",
        "conseil": "70.22Z", "consulting": "70.22Z",
        "btp": "41.20A,41.20B", "construction": "41.20A,41.20B", "batiment": "41.20A",
        "agroalimentaire": "10", "alimentaire": "10", "restaur": "56",
        "bar": "56.30Z", "hotel": "55.10Z", "hotellerie": "55.10Z",
        "energie": "35.11Z,43.21A", "solaire": "43.21A", "photovoltaique": "43.21A",
        "logiciel": "62.01Z", "saas": "62.01Z", "informatique": "62.01Z",
        "ia": "62.01Z", "intelligence artificielle": "62.01Z",
        "tech": "62.01Z", "numerique": "62.01Z", "digital": "62.01Z",
        "holding": "64.20Z", "immobilier": "68", "finance": "64",
        "luxe": "14.13Z", "mode": "14.13Z", "textile": "13",
        "automobile": "29.10Z", "aeronautique": "30.30Z",
        "environnement": "37,38,39", "recyclage": "38",
        "securite": "80.10Z", "nettoyage": "81.21Z",
        "education": "85", "formation": "85.59A",
        "telecom": "61", "communication": "73",
    }

    detected_naf = None
    for keyword, naf in sector_naf_map.items():
        if keyword in ql:
            detected_naf = naf
            wants_pappers = True
            break

    # Detect age filters
    if any(w in ql for w in ["60 ans", "65 ans", "senior", "succession", "retraite"]):
        pappers_filters["age_dirigeant_min"] = "60"
        wants_pappers = True
    if any(w in ql for w in ["fondateur", "dirigeant age"]):
        pappers_filters["age_dirigeant_min"] = "58"
        wants_pappers = True

    # Detect financial filters from natural language
    import re
    ca_match = re.search(r"(\d+)\s*(?:m€|m\b|millions?|meur)", ql)
    if ca_match:
        ca_val = int(ca_match.group(1)) * 1_000_000
        pappers_filters["chiffre_affaires_min"] = str(ca_val)
        wants_pappers = True

    eff_match = re.search(r"(\d+)\s*(?:salari|employ|effectif)", ql)
    if eff_match:
        pappers_filters["nombre_salaries_min"] = eff_match.group(1)
        wants_pappers = True

    if detected_naf:
        pappers_filters["code_naf"] = detected_naf

    # Default CA filter if none set
    if wants_pappers and "chiffre_affaires_min" not in pappers_filters:
        pappers_filters["chiffre_affaires_min"] = "3000000"

    # Force limit to 10 results
    pappers_filters["par_page"] = "10"

    if wants_pappers and PAPPERS_MCP_URL:
        try:
            pappers_data = await search_pappers(**pappers_filters)
            if isinstance(pappers_data, dict) and "resultats" in pappers_data:
                resultats = pappers_data["resultats"][:10]
                total = pappers_data.get("total", 0)
                pappers_lines = [f"\nPappers ({total} resultats, 10 affiches):"]
                for r in resultats:
                    nom = r.get("nom_entreprise", "?")
                    siren = r.get("siren", "?")
                    ville = (r.get("siege") or {}).get("ville", "?")
                    ca = r.get("chiffre_affaires")
                    ca_str = f"{ca/1e6:.1f}M" if ca and ca > 0 else "N/A"
                    eff = r.get("effectif", "?")
                    cap = r.get("capital", "?")
                    pappers_lines.append(
                        f"- {nom} ({siren}, {ville}) CA:{ca_str}, Eff:{eff}, Cap:{cap}"
                    )
                pappers_context = "\n".join(pappers_lines)

                # --- Replace targets with Pappers search results ---
                new_enriched = []
                new_raw = []
                seen_sirens = set()
                for idx, r in enumerate(resultats):
                    siren = r.get("siren", "")
                    if not siren or siren in seen_sirens:
                        continue
                    seen_sirens.add(siren)
                    new_target = build_target_from_search(idx + 1, r, pappers_filters)
                    new_raw.append(new_target)
                    new_enriched.append(enrich_target(new_target))

                if new_enriched:
                    new_enriched.sort(key=lambda x: x["globalScore"], reverse=True)
                    enriched_targets[:] = new_enriched[:10]
                    raw_targets[:] = new_raw[:10]
                    save_cache(raw_targets)
                    targets_updated = True
                    print(f"[Copilot] Replaced targets: {len(enriched_targets)} from Pappers ({total} total)")

        except Exception as e:
            print(f"[Copilot] Pappers enrichment error: {e}")

    full_context = context + pappers_context

    # Try DeepSeek AI with enriched context
    ai_response = await copilot_ai_query(q, full_context)
    if ai_response:
        source = "deepseek-ai+pappers" if pappers_context else "deepseek-ai"
        return {"response": ai_response, "source": source, "targets_updated": targets_updated}

    # Fallback: rule-based copilot
    time.sleep(0.5)
    ql = q.lower()

    # --- Smart matching on specific targets ---
    for t in enriched_targets:
        name_words = t["name"].lower().split()
        # Match on any significant word of the company name (skip short words)
        matched = any(
            word in ql
            for word in name_words
            if len(word) > 3 and word not in ("group", "groupe", "les", "des", "the")
        )
        if matched or t["name"].lower() in ql:
            signal_lines = "\n".join(
                [
                    f"  - {s['label']} ({s['source']}, +{s['points']}pts)"
                    for s in t["topSignals"][:6]
                ]
            )
            dirigeant_lines = "\n".join(
                [
                    f"  - {d['name']} — {d['role']}, {d['age']} ans (depuis {d['since']})"
                    for d in t["dirigeants"]
                ]
            )
            return {
                "response": (
                    f"**{t['name']}** ({t['sector']}, {t['city']})\n\n"
                    f"Score Global : **{t['globalScore']}/100** — **{t['priorityLevel']}**\n\n"
                    f"**These strategique :** {t['analysis']['type']} "
                    f"(fenetre {t['analysis']['window']})\n\n"
                    f"{t['analysis']['narrative']}\n\n"
                    f"**Dirigeants :**\n{dirigeant_lines}\n\n"
                    f"**Financiers :** CA {t['financials']['revenue']} "
                    f"({t['financials']['revenue_growth']}), "
                    f"EBITDA {t['financials']['ebitda']} "
                    f"(marge {t['financials']['ebitda_margin']}), "
                    f"{t['financials']['effectif']} salaries\n\n"
                    f"**Signaux actifs ({len(t['topSignals'])}) :**\n{signal_lines}\n\n"
                    f"**Activation :** {t['activation']['approach']}\n\n"
                    f"**Risque faux positif :** {t['risks']['falsePositive']}"
                ),
                "source": "rule-based",
                "targets_updated": targets_updated,
            }

    # --- Top / Best / Priority queries ---
    if any(w in ql for w in ["meilleur", "top", "priorit", "action", "best", "classement", "ranking"]):
        top = sorted(enriched_targets, key=lambda x: x["globalScore"], reverse=True)[:5]
        lines = ["**Top 5 cibles par score EDRCF :**\n"]
        for i, t in enumerate(top, 1):
            lines.append(
                f"{i}. **{t['name']}** — Score **{t['globalScore']}** ({t['priorityLevel']})\n"
                f"   {t['sector']} | {t['city']} | {t['analysis']['type']} | "
                f"Fenetre {t['analysis']['window']}"
            )
        return {"response": "\n".join(lines), "source": "rule-based", "targets_updated": targets_updated}

    # --- Sector / Industry analysis ---
    if any(w in ql for w in ["secteur", "sector", "industri", "consolid", "chaleur", "heat"]):
        # Check if asking about a specific sector
        specific_sector = None
        for sector_name in SECTORS_HEAT:
            if any(word in ql for word in sector_name.lower().split("/") if len(word.strip()) > 3):
                specific_sector = sector_name
                break
            if any(word.strip().lower() in ql for word in sector_name.lower().replace("/", " ").split() if len(word.strip()) > 3):
                specific_sector = sector_name
                break

        if specific_sector:
            data = SECTORS_HEAT[specific_sector]
            sector_targets = [t for t in enriched_targets if t["sector"] == specific_sector]
            lines = [
                f"**Analyse sectorielle : {specific_sector}**\n",
                f"Indice de chaleur : **{data['heat']}%** ({data['indicator']})\n",
                f"{data['detail']}\n",
                f"**{len(sector_targets)} cible(s) suivie(s) :**\n",
            ]
            for t in sorted(sector_targets, key=lambda x: x["globalScore"], reverse=True):
                lines.append(
                    f"  - **{t['name']}** (Score {t['globalScore']}) — "
                    f"{t['analysis']['type']}, fenetre {t['analysis']['window']}"
                )
            return {"response": "\n".join(lines), "source": "rule-based", "targets_updated": targets_updated}

        lines = ["**Analyse sectorielle EDRCF :**\n"]
        for sector, data in sorted(SECTORS_HEAT.items(), key=lambda x: x[1]["heat"], reverse=True):
            count = len([t for t in enriched_targets if t["sector"] == sector])
            lines.append(
                f"- **{sector}** — Chaleur **{data['heat']}%** ({data['indicator']})\n"
                f"  {data['detail']}\n"
                f"  {count} cible(s) suivie(s)"
            )
        return {"response": "\n".join(lines), "source": "rule-based", "targets_updated": targets_updated}

    # --- Founder / Succession / Age queries ---
    if any(w in ql for w in ["fondateur", "succession", "dirigeant", "age", "60", "65", "70", "senior", "retraite"]):
        founders = [
            t
            for t in enriched_targets
            if any(d.get("age", 0) >= 60 for d in t["dirigeants"])
        ]
        lines = [f"**{len(founders)} societes avec fondateur/dirigeant de 60 ans ou plus :**\n"]
        for t in sorted(
            founders,
            key=lambda x: max(d.get("age", 0) for d in x["dirigeants"]),
            reverse=True,
        ):
            d = max(t["dirigeants"], key=lambda x: x.get("age", 0))
            lines.append(
                f"- **{t['name']}** — {d['name']} ({d['age']} ans, {d['role']})\n"
                f"  Score {t['globalScore']} | {t['analysis']['type']} | "
                f"Fenetre {t['analysis']['window']}"
            )
        return {"response": "\n".join(lines), "source": "rule-based", "targets_updated": targets_updated}

    # --- Filter / Search help ---
    if any(w in ql for w in ["filtre", "filter", "region", "taille", "cherch", "recherch", "comment"]):
        regions = sorted(set(t["region"] for t in enriched_targets))
        return {
            "response": (
                "**Filtres disponibles dans l'Intelligence Vault :**\n\n"
                f"- **Secteur** : {len(SECTORS_HEAT)} secteurs couverts "
                f"({', '.join(list(SECTORS_HEAT.keys())[:4])}...)\n"
                f"- **Region** : {', '.join(regions)}\n"
                "- **Taille EBITDA** : < 3M EUR / 3-10M EUR / 10-30M EUR / > 30M EUR\n"
                "- **Score minimum** : Curseur 0-100\n"
                "- **Structure** : Familiale / PE-backed / Groupe cote\n"
                "- **Publication** : Publie / Ne publie pas\n\n"
                "Utilisez les filtres dans la page Intelligence Vault ou posez-moi "
                "une question specifique (ex: \"cibles familiales en Bretagne\")."
            ),
            "source": "rule-based",
            "targets_updated": targets_updated,
        }

    # --- Pipeline / Deal / Mandate status ---
    if any(w in ql for w in ["pipeline", "deal", "mandat", "funnel", "flux", "statut"]):
        stages = {
            "Action Prioritaire": 0,
            "Qualification": 0,
            "Monitoring": 0,
            "Veille Passive": 0,
        }
        for t in enriched_targets:
            stages[t["priorityLevel"]] = stages.get(t["priorityLevel"], 0) + 1
        total_score = sum(t["globalScore"] for t in enriched_targets)
        avg_score = round(total_score / len(enriched_targets), 1)
        return {
            "response": (
                f"**Etat du Pipeline EDRCF :**\n\n"
                f"Action Prioritaire : **{stages.get('Action Prioritaire', 0)}** cibles\n"
                f"Qualification : **{stages.get('Qualification', 0)}** cibles\n"
                f"Monitoring : **{stages.get('Monitoring', 0)}** cibles\n"
                f"Veille Passive : **{stages.get('Veille Passive', 0)}** cibles\n\n"
                f"**Total : {len(enriched_targets)} entites surveillees** "
                f"(score moyen : {avg_score})\n\n"
                f"1 mandat en execution (TechParts International), "
                f"1 en closing (LogiNord Express, Q2 2026).\n\n"
                f"**Prochaines actions recommandees :**\n"
                f"- Approcher Groupe Mercier Industrie via Pierre Legrand (banquier prive)\n"
                f"- Rencontrer Philippe Renaud (Courtage Prestige) au prochain evenement CSCA\n"
                f"- Coverage InfraVia Capital pour DataPulse Technologies"
            ),
            "source": "rule-based",
            "targets_updated": targets_updated,
        }

    # --- Signal-related queries ---
    if any(w in ql for w in ["signal", "alerte", "radar", "detection", "nouveau"]):
        high_signals = []
        for t in enriched_targets:
            for s in t["topSignals"]:
                if s["severity"] == "high":
                    high_signals.append((t, s))
        lines = [f"**{len(high_signals)} signaux de severite haute detectes :**\n"]
        for t, s in high_signals[:10]:
            lines.append(
                f"- **{s['label']}** — {t['name']} ({t['city']})\n"
                f"  Source: {s['source']} | +{s['points']}pts | "
                f"Dimension: {s['dimension']}"
            )
        lines.append(
            f"\n**Total signaux actifs : "
            f"{sum(len(t['topSignals']) for t in enriched_targets)}** "
            f"sur {len(enriched_targets)} cibles"
        )
        return {"response": "\n".join(lines), "source": "rule-based", "targets_updated": targets_updated}

    # --- LBO / PE-backed queries ---
    if any(w in ql for w in ["lbo", "pe-backed", "private equity", "fonds", "sponsor"]):
        pe_targets = [t for t in enriched_targets if t["structure"] == "PE-backed"]
        lines = [f"**{len(pe_targets)} cibles PE-backed suivies :**\n"]
        for t in sorted(pe_targets, key=lambda x: x["globalScore"], reverse=True):
            parent = t["group"].get("parent", "N/A")
            lines.append(
                f"- **{t['name']}** (Score {t['globalScore']})\n"
                f"  Actionnaire : {parent}\n"
                f"  {t['analysis']['type']} | Fenetre {t['analysis']['window']}"
            )
        return {"response": "\n".join(lines), "source": "rule-based", "targets_updated": targets_updated}

    # --- Familiale / Family queries ---
    if any(w in ql for w in ["familial", "famille", "family", "transmission"]):
        fam_targets = [t for t in enriched_targets if t["structure"] == "Familiale"]
        lines = [f"**{len(fam_targets)} cibles familiales suivies :**\n"]
        for t in sorted(fam_targets, key=lambda x: x["globalScore"], reverse=True):
            d = t["dirigeants"][0]
            lines.append(
                f"- **{t['name']}** (Score {t['globalScore']}) — {d['name']}, {d['age']} ans\n"
                f"  {t['sector']} | {t['city']} | {t['analysis']['type']}"
            )
        return {"response": "\n".join(lines), "source": "rule-based", "targets_updated": targets_updated}

    # --- Region-specific queries ---
    for t in enriched_targets:
        region_words = t["region"].lower().replace("-", " ").split()
        city_lower = t["city"].lower()
        if city_lower in ql or any(w in ql for w in region_words if len(w) > 3):
            matching = [
                x
                for x in enriched_targets
                if x["region"] == t["region"] or x["city"].lower() in ql
            ]
            if len(matching) > 1 or t["city"].lower() not in ql:
                lines = [
                    f"**Cibles en {t['region']} :**\n"
                ]
                for m in sorted(matching, key=lambda x: x["globalScore"], reverse=True):
                    lines.append(
                        f"- **{m['name']}** ({m['city']}) — Score {m['globalScore']}\n"
                        f"  {m['sector']} | {m['analysis']['type']}"
                    )
                return {"response": "\n".join(lines), "source": "rule-based", "targets_updated": targets_updated}

    # --- EBITDA / Financial queries ---
    if any(w in ql for w in ["ebitda", "chiffre", "revenue", "financ", "marge", "rentab"]):
        sorted_by_ebitda = sorted(
            enriched_targets,
            key=lambda x: float(
                x["financials"]["ebitda"].replace("M EUR", "").replace(",", ".")
            ),
            reverse=True,
        )
        lines = ["**Classement par EBITDA :**\n"]
        for t in sorted_by_ebitda[:8]:
            lines.append(
                f"- **{t['name']}** — EBITDA {t['financials']['ebitda']} "
                f"(marge {t['financials']['ebitda_margin']})\n"
                f"  CA {t['financials']['revenue']} ({t['financials']['revenue_growth']})"
            )
        return {"response": "\n".join(lines), "source": "rule-based", "targets_updated": targets_updated}

    # --- Scoring / Methodology queries ---
    if any(w in ql for w in ["score", "methodo", "ponder", "dimension", "calcul", "notation"]):
        lines = ["**Methodologie de scoring EDRCF 6.0 :**\n"]
        lines.append("Le score global (0-100) est calcule sur 5 dimensions :\n")
        for dim, cfg in scoring_config.items():
            dim_signals = [s for s in SIGNAL_CATALOG.values() if s["dimension"] == dim]
            lines.append(
                f"- **{cfg['label']}** (poids {cfg['weight']}%, max {cfg['max']} pts)\n"
                f"  {len(dim_signals)} signaux : "
                + ", ".join(s["label"][:30] for s in dim_signals[:3])
                + ("..." if len(dim_signals) > 3 else "")
            )
        lines.append(
            "\n**Niveaux de priorite :**\n"
            "- **Action Prioritaire** : Score >= 65\n"
            "- **Qualification** : Score 45-64\n"
            "- **Monitoring** : Score 25-44\n"
            "- **Veille Passive** : Score < 25"
        )
        return {"response": "\n".join(lines), "source": "rule-based", "targets_updated": targets_updated}

    # --- Relationship / Network queries ---
    if any(w in ql for w in ["relation", "reseau", "network", "connexion", "banker", "banquier", "approch"]):
        strong = [t for t in enriched_targets if t["relationship"]["strength"] >= 50]
        lines = [f"**{len(strong)} cibles avec relation forte (>= 50%) :**\n"]
        for t in sorted(strong, key=lambda x: x["relationship"]["strength"], reverse=True):
            lines.append(
                f"- **{t['name']}** — Force {t['relationship']['strength']}%\n"
                f"  {t['relationship']['path'][:80]}\n"
                f"  Banquier EDR : {t['relationship']['edr_banker'] or 'Non assigne'}"
            )
        return {"response": "\n".join(lines), "source": "rule-based", "targets_updated": targets_updated}

    # --- Greeting / Help ---
    if any(w in ql for w in ["bonjour", "hello", "salut", "aide", "help", "comment ca"]):
        return {
            "response": (
                f"Bonjour ! Je suis le Copilot IA d'EdRCF 6.0. "
                f"Je surveille actuellement **{len(enriched_targets)} entites** "
                f"a travers **{len(SECTORS_HEAT)} secteurs** en France.\n\n"
                "Voici ce que je peux analyser pour vous :\n\n"
                '- **"Top 5 cibles"** — Les meilleures opportunites\n'
                '- **"Fondateurs > 60 ans"** — Cibles avec dirigeant senior\n'
                '- **"Secteur [nom]"** — Analyse sectorielle\n'
                '- **"[Nom d\'entreprise]"** — Fiche detaillee\n'
                '- **"Pipeline"** — Etat du funnel M&A\n'
                '- **"Signaux"** — Alertes actives\n'
                '- **"LBO / PE"** — Cibles PE-backed\n'
                '- **"Familiales"** — Cibles familiales\n'
                '- **"Scoring"** — Methodologie de notation\n'
                '- **"Relations"** — Reseau et proximite\n'
                '- **"Filtres"** — Options de filtrage'
            ),
            "source": "rule-based",
            "targets_updated": targets_updated,
        }

    # --- Try Pappers search as last resort before default ---
    if len(ql.strip()) > 3 and PAPPERS_MCP_URL:
        try:
            pappers_result = await search_pappers(q)
            if isinstance(pappers_result, dict):
                resultats = pappers_result.get("resultats", [])
                if resultats:
                    lines = [f"**Recherche Pappers pour \"{q}\" — {len(resultats)} resultat(s) :**\n"]
                    for r in resultats[:5]:
                        nom = r.get("nom_entreprise", r.get("denomination", "N/A"))
                        siren = r.get("siren", "")
                        siege = r.get("siege", {})
                        ville = siege.get("ville", "")
                        code_naf = r.get("code_naf", "")
                        libelle_naf = r.get("libelle_code_naf", "")
                        dirigeants = r.get("representants", [])
                        date_crea = r.get("date_creation", "")

                        lines.append(f"**{nom}** (SIREN: {siren})")
                        if ville:
                            lines.append(f"  Siege: {ville}")
                        if libelle_naf:
                            lines.append(f"  Activite: {libelle_naf} ({code_naf})")
                        if date_crea:
                            lines.append(f"  Creation: {date_crea}")
                        if dirigeants:
                            for d in dirigeants[:2]:
                                nom_d = f"{d.get('prenom', '')} {d.get('nom', '')}".strip()
                                qualite = d.get("qualite", "")
                                lines.append(f"  Dirigeant: {nom_d} — {qualite}")
                        lines.append("")
                    lines.append("*Source: Pappers MCP — donnees open data*")
                    return {"response": "\n".join(lines), "source": "pappers-mcp", "targets_updated": targets_updated}
        except Exception as e:
            print(f"[Copilot] Pappers search error: {e}")

    # --- Default fallback ---
    return {
        "response": (
            f"Je surveille actuellement **{len(enriched_targets)} entites** "
            f"a travers **{len(SECTORS_HEAT)} secteurs** en France.\n\n"
            "Voici ce que je peux analyser pour vous :\n\n"
            '- **"Top 5 cibles"** — Les meilleures opportunites\n'
            '- **"Fondateurs > 60 ans"** — Cibles avec dirigeant senior\n'
            '- **"Secteur [nom]"** — Analyse sectorielle detaillee\n'
            '- **"[Nom d\'entreprise]"** — Fiche complete (ex: "Mercier", "DataPulse")\n'
            '- **"Pipeline"** — Etat du funnel M&A\n'
            '- **"Signaux"** — Alertes et detections actives\n'
            '- **"LBO"** — Cibles PE-backed\n'
            '- **"Familiales"** — Entreprises familiales\n'
            '- **"Recherche Pappers"** — Tapez un nom d\'entreprise pour chercher via Pappers\n'
            '- **"Scoring"** — Explication de la methodologie\n'
            '- **"EBITDA"** — Classement financier'
        ),
        "source": "rule-based",
        "targets_updated": targets_updated,
    }


@app.get("/api/graph")
def get_graph():
    """Network graph data with EDR team, targets, and advisors"""
    nodes = [
        {
            "id": "edr-1",
            "name": "Quentin Moreau",
            "type": "internal",
            "role": "Analyste Senior, EDR CF",
            "color": "#6366f1",
        },
        {
            "id": "edr-2",
            "name": "Manon Lefevre",
            "type": "internal",
            "role": "Directrice, EDR CF",
            "color": "#6366f1",
        },
        {
            "id": "edr-3",
            "name": "Pierre Legrand",
            "type": "internal",
            "role": "Banquier Prive, EDR",
            "color": "#6366f1",
        },
    ]
    links = []

    # Add target company nodes (top 8 by score)
    top_targets = sorted(enriched_targets, key=lambda x: x["globalScore"], reverse=True)[:8]
    for t in top_targets:
        main_dirigeant = t["dirigeants"][0] if t["dirigeants"] else {"name": t["name"], "role": "Dirigeant"}
        nodes.append(
            {
                "id": t["id"],
                "name": main_dirigeant["name"],
                "type": "target",
                "role": f"{main_dirigeant['role']}, {t['name']}",
                "color": "#10b981",
                "company": t["name"],
                "score": t["globalScore"],
            }
        )

        # Create relationship links based on edr_banker
        if t["relationship"]["edr_banker"]:
            banker_id = next(
                (
                    n["id"]
                    for n in nodes
                    if t["relationship"]["edr_banker"] in n["name"]
                ),
                "edr-1",
            )
            links.append(
                {
                    "source": banker_id,
                    "target": t["id"],
                    "label": t["relationship"]["path"][:50],
                    "value": max(1, t["relationship"]["strength"] // 25),
                }
            )
        elif t["relationship"]["strength"] > 20:
            links.append(
                {
                    "source": "edr-1",
                    "target": t["id"],
                    "label": "Reseau commun",
                    "value": 2,
                }
            )

    # Add advisor nodes
    advisors = [
        {
            "id": "adv-1",
            "name": "Jean Dupont",
            "type": "advisor",
            "role": "Partner, Rothschild & Co",
            "color": "#f59e0b",
        },
        {
            "id": "adv-2",
            "name": "Marie Leclerc",
            "type": "advisor",
            "role": "Associee, Darrois Villey",
            "color": "#f59e0b",
        },
        {
            "id": "adv-3",
            "name": "Paul Bernard",
            "type": "advisor",
            "role": "Partner, PwC Advisory",
            "color": "#f59e0b",
        },
        {
            "id": "adv-4",
            "name": "Helene Garnier",
            "type": "advisor",
            "role": "Directrice, InfraVia Capital",
            "color": "#f59e0b",
        },
        {
            "id": "adv-5",
            "name": "Nicolas Fabre",
            "type": "advisor",
            "role": "Partner, Eurazeo",
            "color": "#f59e0b",
        },
    ]
    nodes.extend(advisors)

    # Internal EDR team links (always valid)
    links.extend([
        {"source": "edr-2", "target": "adv-1", "label": "Co-mandats historiques", "value": 3},
        {"source": "edr-1", "target": "adv-3", "label": "Alumni network", "value": 2},
        {"source": "edr-1", "target": "adv-4", "label": "Coverage Sponsors", "value": 3},
        {"source": "edr-2", "target": "adv-5", "label": "Relation Sponsors", "value": 3},
        {"source": "edr-2", "target": "edr-3", "label": "Equipe EDR CF / Banque Privee", "value": 4},
        {"source": "edr-1", "target": "edr-2", "label": "Equipe origination", "value": 4},
    ])

    # Dynamic advisor-to-target links (based on actual current targets)
    target_ids = [t["id"] for t in top_targets]
    advisor_ids = [a["id"] for a in advisors]
    labels = ["Conseil M&A", "Audit en cours", "Conseil juridique", "Coverage sectorielle", "Actionnaire"]
    for i, tid in enumerate(target_ids[:min(5, len(advisor_ids))]):
        links.append({
            "source": advisor_ids[i % len(advisor_ids)],
            "target": tid,
            "label": labels[i % len(labels)],
            "value": max(2, 5 - i),
        })

    return {"data": {"nodes": nodes, "links": links}}


@app.get("/api/sectors")
def get_sectors():
    return {"data": SECTORS_HEAT}


@app.post("/api/refresh-targets")
async def refresh_targets():
    """Refresh targets from Pappers MCP."""
    global enriched_targets, raw_targets
    if not PAPPERS_MCP_URL:
        raise HTTPException(400, "Pappers MCP URL not configured")
    fetched = await load_targets_from_pappers(PAPPERS_MCP_URL, count=10)
    if fetched:
        save_cache(fetched)
        raw_targets = fetched
        enriched_targets = [enrich_target(c) for c in fetched]
        return {
            "message": f"{len(enriched_targets)} cibles chargees depuis Pappers",
            "total": len(enriched_targets),
        }
    raise HTTPException(500, "Echec du chargement Pappers")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
