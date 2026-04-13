"""
EdRCF 6.0 - Demo Data Module
Signal catalog, scoring weights, and sector heat data for the EdRCF platform.
Company data is now loaded from Pappers MCP (see pappers_loader.py).
"""

# ============================================================================
# SIGNAL CATALOG - 18 signals across 5 dimensions
# ============================================================================

SIGNAL_CATALOG = {
    # --- HIGH severity (5 signals) ---
    "holding_creation": {
        "label": "Creation de holding patrimoniale",
        "source": "Pappers / BODACC",
        "source_url": "https://www.pappers.fr",
        "dimension": "signaux_patrimoniaux",
        "points": 20,
        "severity": "high",
        "family": "Patrimoine & Transmission",
    },
    "daf_pe_recruitment": {
        "label": "Recrutement DAF ex-PE / Big 4",
        "source": "LinkedIn",
        "source_url": "https://www.linkedin.com",
        "dimension": "rh_gouvernance",
        "points": 18,
        "severity": "high",
        "family": "RH & Gouvernance",
    },
    "founder_60_no_successor": {
        "label": "Fondateur > 60 ans sans successeur identifie",
        "source": "Pappers + LinkedIn",
        "source_url": "https://www.pappers.fr",
        "dimension": "maturite_dirigeant",
        "points": 15,
        "severity": "high",
        "family": "Maturite Dirigeant",
    },
    "share_sale_by_director": {
        "label": "Cession de parts par un dirigeant",
        "source": "BODACC",
        "source_url": "https://www.bodacc.fr",
        "dimension": "signaux_patrimoniaux",
        "points": 18,
        "severity": "high",
        "family": "Patrimoine & Transmission",
    },
    "director_withdrawal": {
        "label": "Retrait progressif du dirigeant fondateur",
        "source": "Presse / LinkedIn",
        "source_url": "https://www.linkedin.com",
        "dimension": "maturite_dirigeant",
        "points": 20,
        "severity": "high",
        "family": "Maturite Dirigeant",
    },

    # --- MEDIUM severity (7 signals) ---
    "lbo_4_years": {
        "label": "LBO en cours depuis > 4 ans",
        "source": "CFNews",
        "source_url": "https://www.cfnews.net",
        "dimension": "dynamique_financiere",
        "points": 12,
        "severity": "medium",
        "family": "Dynamique Financiere",
    },
    "headcount_growth_20": {
        "label": "Croissance effectifs > 20% sur 2 ans",
        "source": "LinkedIn",
        "source_url": "https://www.linkedin.com",
        "dimension": "dynamique_financiere",
        "points": 10,
        "severity": "medium",
        "family": "Dynamique Financiere",
    },
    "cofounder_departure": {
        "label": "Depart d'un co-fondateur / directeur cle",
        "source": "LinkedIn",
        "source_url": "https://www.linkedin.com",
        "dimension": "rh_gouvernance",
        "points": 10,
        "severity": "medium",
        "family": "RH & Gouvernance",
    },
    "big4_audit": {
        "label": "Nomination d'un Big 4 en audit",
        "source": "Presse",
        "source_url": "https://www.lesechos.fr",
        "dimension": "signaux_patrimoniaux",
        "points": 12,
        "severity": "medium",
        "family": "Patrimoine & Transmission",
    },
    "ca_growth_2years": {
        "label": "Croissance CA > 15% sur 2 exercices",
        "source": "Pappers",
        "source_url": "https://www.pappers.fr",
        "dimension": "dynamique_financiere",
        "points": 8,
        "severity": "medium",
        "family": "Dynamique Financiere",
    },
    "new_establishment": {
        "label": "Ouverture d'un nouvel etablissement",
        "source": "Pappers",
        "source_url": "https://www.pappers.fr",
        "dimension": "dynamique_financiere",
        "points": 6,
        "severity": "medium",
        "family": "Dynamique Financiere",
    },
    "bpifrance_aid": {
        "label": "Aide BPI France / subvention innovation",
        "source": "BPI",
        "source_url": "https://www.bpifrance.fr",
        "dimension": "dynamique_financiere",
        "points": 5,
        "severity": "medium",
        "family": "Dynamique Financiere",
    },

    # --- LOW severity (6 signals) ---
    "sector_consolidation": {
        "label": "Consolidation sectorielle active",
        "source": "Config",
        "source_url": "https://www.cfnews.net",
        "dimension": "consolidation_sectorielle",
        "points": 8,
        "severity": "low",
        "family": "Consolidation Sectorielle",
    },
    "press_regional": {
        "label": "Couverture presse regionale / interview dirigeant",
        "source": "Google News",
        "source_url": "https://news.google.com",
        "dimension": "consolidation_sectorielle",
        "points": 5,
        "severity": "low",
        "family": "Consolidation Sectorielle",
    },
    "ma_event": {
        "label": "Transaction M&A dans le secteur",
        "source": "CFNews",
        "source_url": "https://www.cfnews.net",
        "dimension": "consolidation_sectorielle",
        "points": 5,
        "severity": "low",
        "family": "Consolidation Sectorielle",
    },
    "director_speaker": {
        "label": "Dirigeant intervenant / jury / conferences",
        "source": "Google News",
        "source_url": "https://news.google.com",
        "dimension": "maturite_dirigeant",
        "points": 4,
        "severity": "low",
        "family": "Maturite Dirigeant",
    },
    "auditor_change": {
        "label": "Changement de commissaire aux comptes",
        "source": "Pappers",
        "source_url": "https://www.pappers.fr",
        "dimension": "signaux_patrimoniaux",
        "points": 5,
        "severity": "low",
        "family": "Patrimoine & Transmission",
    },
    "hq_relocation": {
        "label": "Demenagement du siege social",
        "source": "BODACC",
        "source_url": "https://www.bodacc.fr",
        "dimension": "signaux_patrimoniaux",
        "points": 3,
        "severity": "low",
        "family": "Patrimoine & Transmission",
    },

    # --- Signaux BODACC (HIGH) ---
    "bodacc_cession": {
        "label": "Publication BODACC : cession de fonds / parts",
        "source": "BODACC",
        "source_url": "https://www.bodacc.fr",
        "dimension": "signaux_patrimoniaux",
        "points": 22,
        "severity": "high",
        "family": "Patrimoine & Transmission",
    },
    "bodacc_capital_change": {
        "label": "Publication BODACC : modification de capital",
        "source": "BODACC",
        "source_url": "https://www.bodacc.fr",
        "dimension": "signaux_patrimoniaux",
        "points": 15,
        "severity": "high",
        "family": "Patrimoine & Transmission",
    },
    "bodacc_dissolution": {
        "label": "Publication BODACC : dissolution / liquidation",
        "source": "BODACC",
        "source_url": "https://www.bodacc.fr",
        "dimension": "maturite_dirigeant",
        "points": 18,
        "severity": "high",
        "family": "Maturite Dirigeant",
    },

    # --- Procédures collectives (HIGH) ---
    "procedure_collective": {
        "label": "Procedure collective en cours (redressement / liquidation)",
        "source": "Pappers / BODACC",
        "source_url": "https://www.pappers.fr",
        "dimension": "signaux_patrimoniaux",
        "points": 20,
        "severity": "high",
        "family": "Patrimoine & Transmission",
    },

    # --- Score Pappers défaillance (MEDIUM) ---
    "score_pappers_risque": {
        "label": "Score de risque Pappers eleve (defaillance probable)",
        "source": "Pappers",
        "source_url": "https://www.pappers.fr",
        "dimension": "dynamique_financiere",
        "points": 10,
        "severity": "medium",
        "family": "Dynamique Financiere",
    },

    # --- Dirigeant multi-mandats (MEDIUM) ---
    "dirigeant_multi_mandats": {
        "label": "Dirigeant avec mandats dans plusieurs societes",
        "source": "Pappers",
        "source_url": "https://www.pappers.fr",
        "dimension": "maturite_dirigeant",
        "points": 8,
        "severity": "medium",
        "family": "Maturite Dirigeant",
    },

    # =========================================================================
    # --- Infogreffe signals (actes RCS deposés) ---
    # =========================================================================
    "infogreffe_nouveau_dirigeant": {
        "label": "Nomination d'un nouveau dirigeant (acte Infogreffe)",
        "source": "Infogreffe",
        "source_url": "https://www.infogreffe.fr",
        "dimension": "maturite_dirigeant",
        "points": 18,
        "severity": "high",
        "family": "Maturite Dirigeant",
    },
    "infogreffe_capital_change": {
        "label": "Modification de capital deposée (Infogreffe)",
        "source": "Infogreffe",
        "source_url": "https://www.infogreffe.fr",
        "dimension": "signaux_patrimoniaux",
        "points": 15,
        "severity": "high",
        "family": "Patrimoine & Transmission",
    },
    "infogreffe_fusion_absorption": {
        "label": "Acte de fusion / absorption depose (Infogreffe)",
        "source": "Infogreffe",
        "source_url": "https://www.infogreffe.fr",
        "dimension": "consolidation_sectorielle",
        "points": 22,
        "severity": "high",
        "family": "Consolidation Sectorielle",
    },
    "infogreffe_transfert_siege": {
        "label": "Transfert de siege social (Infogreffe)",
        "source": "Infogreffe",
        "source_url": "https://www.infogreffe.fr",
        "dimension": "signaux_patrimoniaux",
        "points": 8,
        "severity": "medium",
        "family": "Patrimoine & Transmission",
    },

    # =========================================================================
    # --- Presse / Google News signals ---
    # =========================================================================
    "presse_cession": {
        "label": "Article presse : cession / reprise / vente detectee",
        "source": "Google News",
        "source_url": "https://news.google.com",
        "dimension": "signaux_patrimoniaux",
        "points": 20,
        "severity": "high",
        "family": "Patrimoine & Transmission",
    },
    "presse_difficultes": {
        "label": "Article presse : difficultes / redressement judiciaire",
        "source": "Google News",
        "source_url": "https://news.google.com",
        "dimension": "dynamique_financiere",
        "points": 15,
        "severity": "high",
        "family": "Dynamique Financiere",
    },
    "presse_levee_fonds": {
        "label": "Article presse : levee de fonds / investissement",
        "source": "Google News",
        "source_url": "https://news.google.com",
        "dimension": "dynamique_financiere",
        "points": 12,
        "severity": "medium",
        "family": "Dynamique Financiere",
    },
    "presse_partenariat": {
        "label": "Article presse : partenariat / alliance strategique",
        "source": "Google News",
        "source_url": "https://news.google.com",
        "dimension": "consolidation_sectorielle",
        "points": 8,
        "severity": "medium",
        "family": "Consolidation Sectorielle",
    },
}


# ============================================================================
# DEFAULT SCORING WEIGHTS - 5 dimensions
# ============================================================================

DEFAULT_SCORING_WEIGHTS = {
    "maturite_dirigeant": {
        "label": "Maturite du dirigeant",
        "weight": 25,
        "max": 30,
    },
    "signaux_patrimoniaux": {
        "label": "Signaux patrimoniaux",
        "weight": 25,
        "max": 30,
    },
    "dynamique_financiere": {
        "label": "Dynamique financiere",
        "weight": 20,
        "max": 25,
    },
    "rh_gouvernance": {
        "label": "RH & Gouvernance",
        "weight": 20,
        "max": 25,
    },
    "consolidation_sectorielle": {
        "label": "Consolidation sectorielle",
        "weight": 10,
        "max": 15,
    },
}


# ============================================================================
# SECTORS HEAT - 8 sectors with volatility data
# ============================================================================

SECTORS_HEAT = {
    "Industrial Tech / TIC": {
        "heat": 82,
        "indicator": "Tres actif",
        "detail": "Forte consolidation tirée par la transition numérique industrielle. Multiples élevés (10-14x EBITDA). Acquéreurs stratégiques et PE très actifs.",
    },
    "Courtage d'assurance": {
        "heat": 91,
        "indicator": "Surchauffe",
        "detail": "Vague de build-up sans précédent. Les courtiers grossistes et réseaux >5M€ EBITDA sont très recherchés. Multiples en hausse (12-16x).",
    },
    "Services B2B": {
        "heat": 68,
        "indicator": "Actif",
        "detail": "Marché porteur pour les services à forte récurrence (facility, IT services, conseil). Intérêt marqué des fonds mid-cap.",
    },
    "MedTech / Sante": {
        "heat": 75,
        "indicator": "Actif",
        "detail": "Sous-segments porteurs : dispositifs médicaux, e-santé, EHPAD premium. Consolidation accélérée post-COVID.",
    },
    "Logistique / Transport": {
        "heat": 58,
        "indicator": "Modere",
        "detail": "Consolidation régionale en cours. Les acteurs spécialisés (froid, dernier km, pharma) tirent les multiples à la hausse.",
    },
    "Agroalimentaire": {
        "heat": 52,
        "indicator": "Modere",
        "detail": "Segment fragmenté avec opportunités de roll-up. Les marques terroir et bio attirent les investisseurs. Multiples 6-9x EBITDA.",
    },
    "Energie / CleanTech": {
        "heat": 87,
        "indicator": "Tres actif",
        "detail": "Transition énergétique et REPowerEU dopent le secteur. Forte demande pour les acteurs d'efficacité énergétique et EnR.",
    },
    "BTP / Construction": {
        "heat": 45,
        "indicator": "Stable",
        "detail": "Marché cyclique mais la rénovation énergétique soutient l'activité. Opportunités sur les spécialistes (CVC, isolation, smart building).",
    },
}


# ============================================================================
# COMPANIES - removed, now loaded from Pappers MCP (see pappers_loader.py)
# ============================================================================
