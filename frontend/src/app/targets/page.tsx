"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  Search,
  Filter,
  ArrowUpDown,
  ChevronRight,
  Building,
  Download,
  SlidersHorizontal,
  X,
  Check,
  Globe,
  Shield,
  MapPin,
  BarChart3,
  Users,
  Layers,
  RotateCcw,
  Network,
} from "lucide-react";
import { useRouter } from "next/navigation";

import {
  Target as TargetData,
  FilterOptions,
  ScoringConfigEntry,
} from "@/types";

type SortKey = "name" | "sector" | "region" | "globalScore";

const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Action Prioritaire": { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  "Qualification":      { bg: "bg-indigo-500/10",  text: "text-indigo-400",  border: "border-indigo-500/20" },
  "Monitoring":         { bg: "bg-amber-500/10",   text: "text-amber-400",   border: "border-amber-500/20" },
  "Veille Passive":     { bg: "bg-gray-500/10",    text: "text-gray-400",    border: "border-gray-500/20" },
};

const STRUCTURE_COLORS: Record<string, string> = {
  "Familiale":    "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "PE-backed":    "bg-sky-500/10 text-sky-400 border-sky-500/20",
  "Groupe côté":  "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

function getScoreThresholdLabel(score: number) {
  if (score >= 65) return "Action";
  if (score >= 45) return "Qualification";
  if (score >= 25) return "Monitoring";
  return "Veille";
}

export default function TargetsPage() {
  const [targets, setTargets] = useState<TargetData[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [apiFilters, setApiFilters] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("globalScore");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedStructures, setSelectedStructures] = useState<string[]>([]);
  const [selectedEbitdaRanges, setSelectedEbitdaRanges] = useState<string[]>([]);
  const [selectedPubStatus, setSelectedPubStatus] = useState<string[]>([]);
  const [minScore, setMinScore] = useState(0);

  // Scoring weights panel
  const [showWeights, setShowWeights] = useState(false);
  const [scoringConfig, setScoringConfig] = useState<Record<string, ScoringConfigEntry>>({});
  const [localWeights, setLocalWeights] = useState<Record<string, number>>({});
  const [savingWeights, setSavingWeights] = useState(false);

  const router = useRouter();

  const fetchTargets = useCallback(() => {
    setLoading(true);
    fetch(`/api/targets`)
      .then((res) => res.json())
      .then((data) => {
        setTargets(data.data || []);
        setTotalCount(data.total || data.data?.length || 0);
        if (data.filters) setApiFilters(data.filters);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets]);

  // Re-fetch targets when copilot injects new ones from Pappers
  useEffect(() => {
    const handleTargetsUpdated = () => {
      fetchTargets();
    };
    window.addEventListener("targets-updated", handleTargetsUpdated);
    return () => window.removeEventListener("targets-updated", handleTargetsUpdated);
  }, [fetchTargets]);

  // Fetch scoring config
  useEffect(() => {
    fetch(`/api/scoring/config`)
      .then((res) => res.json())
      .then((data) => {
        const config = data.data || data;
        setScoringConfig(config);
        const w: Record<string, number> = {};
        Object.entries(config).forEach(([key, val]) => {
          w[key] = (val as ScoringConfigEntry).weight;
        });
        setLocalWeights(w);
      })
      .catch(() => {});
  }, []);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedSectors.length > 0) count++;
    if (selectedRegions.length > 0) count++;
    if (selectedStructures.length > 0) count++;
    if (selectedEbitdaRanges.length > 0) count++;
    if (selectedPubStatus.length > 0) count++;
    if (minScore > 0) count++;
    return count;
  }, [selectedSectors, selectedRegions, selectedStructures, selectedEbitdaRanges, selectedPubStatus, minScore]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  const resetFilters = () => {
    setSelectedSectors([]);
    setSelectedRegions([]);
    setSelectedStructures([]);
    setSelectedEbitdaRanges([]);
    setSelectedPubStatus([]);
    setMinScore(0);
  };

  const handleApplyWeights = async () => {
    setSavingWeights(true);
    const payload: Record<string, ScoringConfigEntry> = {};
    Object.entries(scoringConfig).forEach(([key, val]) => {
      payload[key] = { ...val, weight: localWeights[key] ?? val.weight };
    });
    try {
      await fetch(`/api/scoring/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setScoringConfig(payload);
      setShowWeights(false);
      fetchTargets();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingWeights(false);
    }
  };

  const resetWeights = () => {
    const w: Record<string, number> = {};
    Object.entries(scoringConfig).forEach(([key, val]) => {
      w[key] = val.weight;
    });
    setLocalWeights(w);
  };

  const filteredAndSortedTargets = useMemo(() => {
    return targets
      .filter((t) => {
        const q = search.toLowerCase();
        const matchSearch =
          !q ||
          t.name.toLowerCase().includes(q) ||
          t.sector.toLowerCase().includes(q) ||
          (t.sub_sector || "").toLowerCase().includes(q) ||
          (t.city || "").toLowerCase().includes(q) ||
          (t.siren || "").toLowerCase().includes(q);
        const matchSector = selectedSectors.length === 0 || selectedSectors.includes(t.sector);
        const matchRegion = selectedRegions.length === 0 || selectedRegions.includes(t.region);
        const matchStructure = selectedStructures.length === 0 || selectedStructures.includes(t.structure);
        const matchEbitda = selectedEbitdaRanges.length === 0 || selectedEbitdaRanges.includes(t.financials?.ebitda_range);
        const matchPub = selectedPubStatus.length === 0 || selectedPubStatus.includes(t.publication_status);
        const matchScore = t.globalScore >= minScore;
        return matchSearch && matchSector && matchRegion && matchStructure && matchEbitda && matchPub && matchScore;
      })
      .sort((a, b) => {
        let valA: string | number = a[sortKey] as string | number;
        let valB: string | number = b[sortKey] as string | number;
        if (typeof valA === "string" && typeof valB === "string") {
          return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortOrder === "asc" ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
      });
  }, [targets, search, sortKey, sortOrder, selectedSectors, selectedRegions, selectedStructures, selectedEbitdaRanges, selectedPubStatus, minScore]);

  const sectors = apiFilters?.sectors || Array.from(new Set(targets.map((t) => t.sector)));
  const regions = apiFilters?.regions || Array.from(new Set(targets.map((t) => t.region).filter(Boolean)));
  const structures = apiFilters?.structures || ["Familiale", "PE-backed", "Groupe côté"];
  const ebitdaRanges = apiFilters?.ebitda_ranges || ["< 3M", "3-10M", "10-30M", "> 30M"];

  return (
    <div className="flex flex-col gap-6 sm:gap-8 lg:gap-10 w-full max-w-7xl mx-auto py-4 h-[calc(100vh-8rem)] pb-20 lg:pb-0">

      {/* ── Filter Sidebar Overlay ───────────────────────────────── */}
      <AnimatePresence>
        {showFilters && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFilters(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100]"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 w-full sm:w-[28rem] bg-[#0a0a0a] border-l border-white/10 z-[101] p-6 sm:p-10 shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col"
            >
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Filtres Avancés</h2>
                <button
                  onClick={() => setShowFilters(false)}
                  className="p-3 rounded-2xl bg-white/5 text-gray-400 hover:text-white transition-all active:scale-95"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-10 flex-1 overflow-y-auto custom-scrollbar pr-2">
                {/* Sectors */}
                <div>
                  <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <Globe size={14} className="text-indigo-500" /> Secteurs
                  </h3>
                  <div className="flex flex-wrap gap-2.5">
                    {sectors.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSelectedSectors((curr) => (curr.includes(s) ? curr.filter((x) => x !== s) : [...curr, s]))}
                        className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border
                          ${selectedSectors.includes(s)
                            ? "bg-indigo-500 border-indigo-400 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                            : "bg-white/5 border-white/10 text-gray-500 hover:bg-white/10 hover:text-gray-300"
                          }
                        `}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Regions */}
                <div>
                  <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <MapPin size={14} className="text-indigo-500" /> Régions
                  </h3>
                  <div className="flex flex-wrap gap-2.5">
                    {regions.map((r) => (
                      <button
                        key={r}
                        onClick={() => setSelectedRegions((curr) => (curr.includes(r) ? curr.filter((x) => x !== r) : [...curr, r]))}
                        className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border
                          ${selectedRegions.includes(r)
                            ? "bg-indigo-500 border-indigo-400 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                            : "bg-white/5 border-white/10 text-gray-500 hover:bg-white/10 hover:text-gray-300"
                          }
                        `}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* EBITDA Range */}
                <div>
                  <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <BarChart3 size={14} className="text-indigo-500" /> Tranche EBITDA
                  </h3>
                  <div className="flex flex-wrap gap-2.5">
                    {ebitdaRanges.map((r) => (
                      <button
                        key={r}
                        onClick={() => setSelectedEbitdaRanges((curr) => (curr.includes(r) ? curr.filter((x) => x !== r) : [...curr, r]))}
                        className={`px-5 py-2.5 rounded-2xl text-[11px] font-black tracking-widest transition-all border
                          ${selectedEbitdaRanges.includes(r)
                            ? "bg-indigo-500 border-indigo-400 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                            : "bg-white/5 border-white/10 text-gray-500 hover:bg-white/10 hover:text-gray-300"
                          }
                        `}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Structure */}
                <div>
                  <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <Layers size={14} className="text-indigo-500" /> Structure
                  </h3>
                  <div className="flex flex-wrap gap-2.5">
                    {structures.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSelectedStructures((curr) => (curr.includes(s) ? curr.filter((x) => x !== s) : [...curr, s]))}
                        className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border
                          ${selectedStructures.includes(s)
                            ? "bg-indigo-500 border-indigo-400 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                            : "bg-white/5 border-white/10 text-gray-500 hover:bg-white/10 hover:text-gray-300"
                          }
                        `}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Publication Status */}
                <div>
                  <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <Shield size={14} className="text-indigo-500" /> Statut Publication
                  </h3>
                  <div className="flex flex-wrap gap-2.5">
                    {["Publie", "Ne publie pas"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setSelectedPubStatus((curr) => (curr.includes(s) ? curr.filter((x) => x !== s) : [...curr, s]))}
                        className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border
                          ${selectedPubStatus.includes(s)
                            ? "bg-indigo-500 border-indigo-400 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                            : "bg-white/5 border-white/10 text-gray-500 hover:bg-white/10 hover:text-gray-300"
                          }
                        `}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Score Minimum Slider */}
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                      <Shield size={14} className="text-indigo-500" /> Score Minimum
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-indigo-400">{minScore}</span>
                      <span className="text-[9px] font-black text-gray-600 uppercase">{getScoreThresholdLabel(minScore)}</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={minScore}
                    onChange={(e) => setMinScore(parseInt(e.target.value))}
                    className="w-full accent-indigo-500 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between mt-3 text-[8px] font-black text-gray-700 uppercase tracking-widest">
                    <span>Veille &lt;25</span>
                    <span>Monitoring 25-44</span>
                    <span>Qualif. 45-64</span>
                    <span>Action 65+</span>
                  </div>
                </div>
              </div>

              <div className="pt-10 border-t border-white/10 mt-auto">
                <button
                  onClick={resetFilters}
                  className="w-full py-4 rounded-3xl bg-white/5 border border-white/10 text-[11px] font-black uppercase text-gray-500 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 transition-all tracking-widest active:scale-95"
                >
                  Réinitialiser
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Scoring Weights Panel ────────────────────────────────── */}
      <AnimatePresence>
        {showWeights && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWeights(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100]"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 w-full sm:w-[28rem] bg-[#0a0a0a] border-l border-white/10 z-[101] p-6 sm:p-10 shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col"
            >
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Pondérations</h2>
                <button
                  onClick={() => setShowWeights(false)}
                  className="p-3 rounded-2xl bg-white/5 text-gray-400 hover:text-white transition-all active:scale-95"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-8 flex-1 overflow-y-auto custom-scrollbar pr-2">
                {Object.entries(scoringConfig).map(([key, dim]) => (
                  <div key={key}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-[11px] font-black text-white uppercase tracking-[0.15em]">{dim.label}</h3>
                      <span className="text-xl font-black text-indigo-400">{localWeights[key] ?? dim.weight}</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="40"
                      value={localWeights[key] ?? dim.weight}
                      onChange={(e) => setLocalWeights((prev) => ({ ...prev, [key]: parseInt(e.target.value) }))}
                      className="w-full accent-indigo-500 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between mt-2 text-[9px] font-black text-gray-700 uppercase tracking-widest">
                      <span>5</span>
                      <span>Max: {dim.max}</span>
                      <span>40</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-10 border-t border-white/10 mt-auto space-y-4">
                <button
                  onClick={handleApplyWeights}
                  disabled={savingWeights}
                  className="w-full py-4 rounded-3xl bg-indigo-600 border border-indigo-500 text-[11px] font-black uppercase text-white hover:bg-indigo-500 transition-all tracking-widest active:scale-95 shadow-2xl shadow-indigo-600/30 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {savingWeights ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  Appliquer
                </button>
                <button
                  onClick={resetWeights}
                  className="w-full py-4 rounded-3xl bg-white/5 border border-white/10 text-[11px] font-black uppercase text-gray-500 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 transition-all tracking-widest active:scale-95"
                >
                  Réinitialiser les défauts
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 shrink-0">
        <div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white mb-3 flex flex-wrap items-center gap-4 sm:gap-5">
            Intelligence Vault
            <div className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em]">
              {filteredAndSortedTargets.length} entités sur {totalCount}
            </div>
          </h1>
          <p className="text-gray-400 text-base md:text-lg font-medium max-w-2xl leading-relaxed">
            Répertoire universel des entités analysées. Calibré par le <span className="text-white">Scoring EDRCF Haute-Fidélité</span>.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className="relative group w-full lg:w-80">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors">
              <Search size={20} />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une entité..."
              className="w-full bg-white/[0.03] border border-white/10 rounded-[2rem] py-4 pl-14 pr-6 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-indigo-500/50 focus:bg-white/[0.05] transition-all backdrop-blur-md"
            />
          </div>
          <div className="flex gap-4 w-full sm:w-auto">
            <button
              onClick={() => setShowWeights(true)}
              className="flex-1 sm:flex-none px-6 py-4 rounded-[2rem] bg-white/[0.03] border border-white/10 text-white hover:bg-white/10 transition-all flex items-center justify-center gap-3 font-black text-[11px] uppercase tracking-widest"
            >
              <BarChart3 size={18} /> Pondérations
            </button>
            <button
              onClick={() => setShowFilters(true)}
              className={`flex-1 sm:flex-none px-6 py-4 rounded-[2rem] transition-all flex items-center justify-center gap-3 font-black text-[11px] uppercase tracking-widest relative
                ${activeFilterCount > 0
                  ? "bg-indigo-600 border border-indigo-500 text-white shadow-2xl shadow-indigo-600/30"
                  : "bg-white/[0.03] border border-white/10 text-white hover:bg-white/10"
                }
              `}
            >
              <SlidersHorizontal size={18} /> Filtres
              {activeFilterCount > 0 && (
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-indigo-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-[#0a0a0a] shadow-lg">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button className="flex-1 sm:flex-none px-6 py-4 rounded-[2rem] bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-3 font-black text-[11px] uppercase tracking-widest active:scale-95 shadow-2xl">
              <Download size={18} /> <span className="sm:hidden lg:inline">Export</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Table Area ───────────────────────────────────────────── */}
      <div className="flex-1 bg-black/40 border border-white/10 rounded-[2rem] sm:rounded-[3rem] overflow-hidden flex flex-col shadow-2xl backdrop-blur-3xl relative">
        {/* Table Header - Desktop Only */}
        <div className="hidden lg:grid grid-cols-12 gap-4 px-10 py-6 border-b border-white/10 bg-white/[0.02] text-[11px] font-black text-gray-500 uppercase tracking-[0.2em]">
          <div
            className="col-span-3 flex items-center gap-3 cursor-pointer hover:text-white transition-colors"
            onClick={() => handleSort("name")}
          >
            Entité {sortKey === "name" && <ArrowUpDown size={14} className="text-indigo-400" />}
          </div>
          <div
            className="col-span-2 flex items-center gap-3 cursor-pointer hover:text-white transition-colors"
            onClick={() => handleSort("sector")}
          >
            Secteur {sortKey === "sector" && <ArrowUpDown size={14} className="text-indigo-400" />}
          </div>
          <div
            className="col-span-2 flex items-center gap-3 cursor-pointer hover:text-white transition-colors"
            onClick={() => handleSort("region")}
          >
            Région {sortKey === "region" && <ArrowUpDown size={14} className="text-indigo-400" />}
          </div>
          <div className="col-span-1 flex items-center gap-3 text-gray-700">
            EBITDA
          </div>
          <div
            className="col-span-2 flex items-center gap-3 cursor-pointer hover:text-white transition-colors justify-end"
            onClick={() => handleSort("globalScore")}
          >
            Score {sortKey === "globalScore" && <ArrowUpDown size={14} className="text-indigo-400" />}
          </div>
          <div className="col-span-1 text-center">Statut</div>
          <div className="col-span-1 text-right">Fiche</div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="p-20 text-center text-gray-500 flex flex-col items-center justify-center h-full gap-8">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-indigo-500/10 rounded-full" />
                <div className="absolute inset-0 border-t-4 border-indigo-500 rounded-full animate-spin shadow-[0_0_20px_rgba(79,70,229,0.5)]" />
              </div>
              <span className="font-black uppercase tracking-[0.3em] text-[10px] text-white/50">Chargement des données EDRCF...</span>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-white/[0.03]">
              <AnimatePresence mode="popLayout">
                {filteredAndSortedTargets.map((target, idx) => {
                  const priority = PRIORITY_COLORS[target.priorityLevel] || PRIORITY_COLORS["Veille Passive"];
                  const structureClass = STRUCTURE_COLORS[target.structure] || "bg-white/5 text-gray-400 border-white/10";

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.03 }}
                      key={target.id}
                      onClick={() => router.push(`/targets/${target.id}`)}
                      className="flex flex-col lg:grid lg:grid-cols-12 gap-4 px-6 lg:px-10 py-5 lg:py-6 items-start lg:items-center hover:bg-white/[0.04] transition-all cursor-pointer group active:scale-[0.998] relative overflow-hidden"
                    >
                      {/* Entity */}
                      <div className="w-full lg:col-span-3 flex items-center gap-4">
                        <div className="w-11 h-11 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/30 transition-all shadow-xl shrink-0 relative">
                          <Building size={22} />
                          {target.group?.is_group && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center" title="Groupe">
                              <Network size={8} className="text-purple-400" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-black text-white text-sm lg:text-base group-hover:text-indigo-400 transition-colors tracking-tighter leading-tight mb-1 truncate">
                            {target.name}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${structureClass}`}>
                              {target.structure}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Sector */}
                      <div className="w-full lg:col-span-2 flex items-center justify-between lg:block">
                        <span className="lg:hidden text-[9px] font-black text-gray-600 uppercase tracking-widest">Secteur</span>
                        <span className="px-3 py-1 lg:py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase bg-indigo-500/5 text-indigo-400/80 border border-indigo-500/10 group-hover:border-indigo-500/30 transition-all">
                          {target.sector}
                        </span>
                      </div>

                      {/* Region */}
                      <div className="w-full lg:col-span-2 flex items-center justify-between lg:block">
                        <span className="lg:hidden text-[9px] font-black text-gray-600 uppercase tracking-widest">Région</span>
                        <span className="text-sm text-gray-300 font-bold tracking-tight">{target.region || "—"}</span>
                      </div>

                      {/* EBITDA */}
                      <div className="w-full lg:col-span-1 flex items-center justify-between lg:block">
                        <span className="lg:hidden text-[9px] font-black text-gray-600 uppercase tracking-widest">EBITDA</span>
                        <span className="text-sm text-gray-300 font-bold tracking-tight">{target.financials?.ebitda || "—"}</span>
                      </div>

                      {/* Score */}
                      <div className="w-full lg:col-span-2 flex items-center justify-between lg:justify-end lg:text-right">
                        <span className="lg:hidden text-[9px] font-black text-gray-600 uppercase tracking-widest">Score</span>
                        <div className="flex items-center gap-3 lg:flex-col lg:items-end lg:gap-0">
                          <span className="text-2xl lg:text-3xl font-black bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-800 leading-none tracking-tighter">
                            {target.globalScore}
                          </span>
                          <div className="hidden lg:block w-16 h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden p-[1px]">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${target.globalScore}%` }}
                              className="h-full bg-indigo-50 shadow-[0_0_10px_rgba(79,70,229,0.5)] rounded-full"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Priority badge */}
                      <div className="w-full lg:col-span-1 flex items-center justify-between lg:justify-center">
                        <span className="lg:hidden text-[9px] font-black text-gray-600 uppercase tracking-widest">Statut</span>
                        <span
                          className={`px-2 py-1 rounded-xl text-[8px] font-black uppercase tracking-widest border text-center ${priority.bg} ${priority.text} ${priority.border}`}
                        >
                          {target.priorityLevel === "Action Prioritaire" ? "Action" : target.priorityLevel === "Veille Passive" ? "Veille" : target.priorityLevel}
                        </span>
                      </div>

                      {/* Arrow */}
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 lg:relative lg:right-0 lg:top-0 lg:translate-y-0 lg:col-span-1 flex justify-end">
                        <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-xl lg:rounded-2xl bg-white/5 flex items-center justify-center text-gray-600 group-hover:text-white group-hover:bg-indigo-600 transition-all border border-white/5 group-hover:border-indigo-400 shadow-2xl active:scale-90">
                          <ChevronRight size={18} />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {filteredAndSortedTargets.length === 0 && !loading && (
                <div className="p-32 text-center flex flex-col items-center gap-8">
                  <div className="w-24 h-24 rounded-[2rem] bg-white/5 border border-white/10 flex items-center justify-center">
                    <Target size={48} className="text-gray-800" />
                  </div>
                  <div>
                    <p className="font-black text-2xl text-white mb-3 tracking-tighter">Aucun résultat</p>
                    <p className="text-gray-500 font-medium max-w-sm mx-auto">
                      Aucune entité stratégique ne correspond aux paramètres actuels. Élargissez vos filtres ou ajustez le seuil de score.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
