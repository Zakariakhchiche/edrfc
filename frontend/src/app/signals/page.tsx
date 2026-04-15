"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Bell, Filter, Search, ShieldAlert, ArrowUpRight, Clock, MapPin, Zap, TrendingUp, Globe, AlertCircle, Radio, ExternalLink, ChevronDown, ChevronUp, Hash } from "lucide-react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// --- Types ---
interface Signal {
  id: string;
  type: string;
  title: string;
  time: string;
  source: string;
  source_url?: string;
  severity: "high" | "medium" | "low";
  location: string;
  tags: string[];
  target_id?: string;
  target_name?: string;
  dimension?: string;
  points?: number;
}

interface SignalCatalogEntry {
  id: string;
  label: string;
  dimension: string;
  description: string;
  points: number;
}

const SEVERITY_FR: Record<string, string> = {
  high: "Haute",
  medium: "Moyenne",
  low: "Basse",
};

const DIMENSION_FR: Record<string, string> = {
  signaux_patrimoniaux: "Patrimoniaux",
  signaux_strategiques: "Strategiques",
  signaux_financiers: "Financiers",
  signaux_gouvernance: "Gouvernance",
  signaux_marche: "Marche",
};

export default function SignalsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [catalog, setCatalog] = useState<Record<string, SignalCatalogEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [catalogOpen, setCatalogOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/signals`)
      .then(res => res.json())
      .then(json => {
        setSignals(json.data || []);
        if (json.catalog) setCatalog(json.catalog);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch signals:", err);
        setLoading(false);
      });
  }, []);

  const severityCounts = useMemo(() => {
    const counts = { all: signals.length, high: 0, medium: 0, low: 0 };
    signals.forEach(s => {
      if (s.severity === "high") counts.high++;
      else if (s.severity === "medium") counts.medium++;
      else if (s.severity === "low") counts.low++;
    });
    return counts;
  }, [signals]);

  const dimensionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    signals.forEach(s => {
      const dim = s.dimension || s.type || "Autre";
      counts[dim] = (counts[dim] || 0) + 1;
    });
    return counts;
  }, [signals]);

  const sectorHeat = useMemo(() => {
    const sectors: Record<string, { count: number; totalPoints: number }> = {};
    signals.forEach(s => {
      const sectorTag = s.tags?.find(t => t !== s.type) || "Autre";
      if (!sectors[sectorTag]) sectors[sectorTag] = { count: 0, totalPoints: 0 };
      sectors[sectorTag].count++;
      sectors[sectorTag].totalPoints += s.points || 0;
    });
    return Object.entries(sectors)
      .map(([name, data]) => ({ name, count: data.count, avgPoints: data.totalPoints / data.count }))
      .sort((a, b) => b.avgPoints - a.avgPoints)
      .slice(0, 5);
  }, [signals]);

  const maxSectorPoints = useMemo(() => {
    return Math.max(...sectorHeat.map(s => s.avgPoints), 1);
  }, [sectorHeat]);

  const filteredSignals = useMemo(() => {
    return signals.filter(s => {
      const matchSearch = s.title.toLowerCase().includes(search.toLowerCase()) ||
                          s.type.toLowerCase().includes(search.toLowerCase()) ||
                          (s.target_name || "").toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === "All" || s.severity === filter.toLowerCase();
      return matchSearch && matchFilter;
    });
  }, [search, filter, signals]);

  const catalogEntries = useMemo(() => {
    const entries: SignalCatalogEntry[] = [];
    Object.entries(catalog).forEach(([dim, items]) => {
      if (Array.isArray(items)) {
        items.forEach(item => entries.push({ ...item, dimension: dim }));
      }
    });
    return entries;
  }, [catalog]);

  return (
    <div className="flex flex-col gap-6 sm:gap-8 w-full max-w-7xl mx-auto py-4 h-[calc(100vh-8rem)] pb-20 lg:pb-0">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 shrink-0">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white flex items-center gap-4">
              Signaux de Marche
            </h1>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em]">
               <Radio size={12} className="animate-pulse" /> Flux Temps Reel
            </div>
          </div>
          <p className="text-gray-400 text-sm font-medium">
            Detection d&apos;anomalies et declencheurs strategiques calibres par EDRCF 6.0.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative group w-full sm:w-80">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors">
               <Search size={18} />
            </span>
            <input
               type="text"
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               placeholder="Rechercher un signal, une cible..."
               className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-indigo-500/50 focus:bg-white/[0.05] transition-all"
            />
          </div>
          <button className="px-5 py-3 rounded-2xl bg-white/[0.03] border border-white/10 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2">
            <AlertCircle size={16} /> <span className="sm:hidden lg:inline">Alertes</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">

        {/* Main Feed */}
        <div className="lg:col-span-8 bg-black/40 border border-white/10 rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl backdrop-blur-xl">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02] flex-wrap gap-2">
             <div className="flex gap-2 flex-wrap">
                {[
                  { key: "All", label: "Tous", count: severityCounts.all },
                  { key: "High", label: "Haute", count: severityCounts.high },
                  { key: "Medium", label: "Moyenne", count: severityCounts.medium },
                  { key: "Low", label: "Basse", count: severityCounts.low },
                ].map((lvl) => (
                  <button
                    key={lvl.key}
                    onClick={() => setFilter(lvl.key)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2
                      ${filter === lvl.key
                        ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                        : "bg-white/5 border-transparent text-gray-500 hover:bg-white/10 hover:text-gray-300"
                      }
                    `}
                  >
                    {lvl.label}
                    <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${filter === lvl.key ? "bg-indigo-500/20 text-indigo-300" : "bg-white/10 text-gray-600"}`}>
                      {lvl.count}
                    </span>
                  </button>
                ))}
             </div>
             <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
                {signals.length} signaux detectes
             </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            <AnimatePresence mode="popLayout">
              {filteredSignals.map((signal) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  key={signal.id}
                  className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/10 hover:border-indigo-500/30 transition-all group flex gap-6 items-start relative overflow-hidden active:scale-[0.99]"
                >
                  <div className={`absolute top-0 left-0 w-1 h-full
                    ${signal.severity === 'high' ? 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]' : ''}
                    ${signal.severity === 'medium' ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : ''}
                    ${signal.severity === 'low' ? 'bg-gray-600' : ''}
                  `} />

                  <div className="flex-shrink-0">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all
                      ${signal.severity === 'high' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 group-hover:bg-rose-600 group-hover:text-white' : ''}
                      ${signal.severity === 'medium' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 group-hover:bg-amber-600 group-hover:text-white' : ''}
                      ${signal.severity === 'low' ? 'bg-white/5 border-white/5 text-gray-500' : ''}
                    `}>
                      <Bell size={22} />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <span className={`text-[9px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-lg
                        ${signal.severity === 'high' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/20' : ''}
                        ${signal.severity === 'medium' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' : ''}
                        ${signal.severity === 'low' ? 'bg-white/10 text-gray-400 border border-white/10' : ''}
                      `}>
                        {SEVERITY_FR[signal.severity] || signal.severity}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/10">
                        {signal.type}
                      </span>
                      {signal.points !== undefined && (
                        <span className="text-[9px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">
                          +{signal.points} pts
                        </span>
                      )}
                      <span className="text-[10px] font-black text-gray-600 flex items-center gap-1.5 uppercase tracking-[0.15em]">
                        <Clock size={11} /> {signal.time}
                      </span>
                    </div>

                    <h3 className="text-lg md:text-xl font-black text-white mb-3 group-hover:text-indigo-400 transition-colors tracking-tight leading-tight">
                      {signal.title}
                    </h3>

                    {/* Target + Dimension row */}
                    {(signal.target_name || signal.dimension) && (
                      <div className="flex items-center gap-4 mb-3 flex-wrap">
                        {signal.target_name && signal.target_id && (
                          <Link
                            href={`/targets/${signal.target_id}`}
                            className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors flex items-center gap-1.5 bg-indigo-500/5 px-3 py-1.5 rounded-xl border border-indigo-500/10"
                          >
                            <Activity size={12} /> {signal.target_name}
                          </Link>
                        )}
                        {signal.dimension && (
                          <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest bg-purple-500/5 px-3 py-1.5 rounded-xl border border-purple-500/10">
                            {DIMENSION_FR[signal.dimension] || signal.dimension}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                        <Globe size={14} className="opacity-50" /> {signal.location}
                      </div>
                      {signal.source_url ? (
                        <a
                          href={signal.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/5 px-3 py-1.5 rounded-xl border border-indigo-500/10 hover:bg-indigo-500/10 hover:text-indigo-300 transition-all"
                        >
                          <ExternalLink size={12} /> {signal.source}
                        </a>
                      ) : (
                        <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                          <ShieldAlert size={14} className="opacity-50 text-indigo-500" /> {signal.source}
                        </div>
                      )}
                      <div className="flex gap-2 ml-auto">
                        {signal.tags?.map(tag => (
                          <span key={tag} className="text-[9px] font-black text-gray-500 bg-indigo-500/5 px-2 py-1 rounded-md border border-indigo-500/10 uppercase tracking-widest">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center self-center">
                    {signal.target_id ? (
                      <Link
                        href={`/targets/${signal.target_id}`}
                        className="w-12 h-12 rounded-2xl bg-white/5 group-hover:bg-indigo-600 text-gray-600 group-hover:text-white flex items-center justify-center transition-all border border-white/10 group-hover:border-indigo-400 shadow-xl active:scale-90"
                      >
                        <ArrowUpRight size={24} />
                      </Link>
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-white/5 text-gray-700 flex items-center justify-center border border-white/10">
                        <ArrowUpRight size={24} />
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredSignals.length === 0 && !loading && (
              <div className="p-20 text-center flex flex-col items-center gap-6">
                 <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center border border-white/10">
                    <ShieldAlert size={40} className="text-gray-700" />
                 </div>
                 <div>
                   <h2 className="text-white font-black text-2xl mb-2 tracking-tighter">Aucun Signal Detecte</h2>
                   <p className="text-gray-500 max-w-sm mx-auto font-medium">Aucun signal ne correspond a vos filtres actuels. Modifiez vos criteres de recherche.</p>
                 </div>
              </div>
            )}

            {loading && (
              <div className="p-20 text-center flex flex-col items-center gap-6">
                 <div className="relative w-16 h-16">
                   <div className="absolute inset-0 border-4 border-indigo-500/10 rounded-full" />
                   <div className="absolute inset-0 border-t-4 border-indigo-500 rounded-full animate-spin" />
                 </div>
                 <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Chargement des signaux...</span>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Analytics */}
        <div className="lg:col-span-4 flex flex-col gap-8 overflow-y-auto custom-scrollbar">
          {/* Sector Heat */}
          <div className="p-8 rounded-[2.5rem] bg-black/40 border border-white/10 shadow-2xl backdrop-blur-xl flex-1 flex flex-col">
            <h3 className="text-[10px] font-black text-gray-500 mb-8 uppercase tracking-[0.2em] flex items-center gap-2">
               <Globe size={16} className="text-indigo-400" /> Chaleur Sectorielle
            </h3>
            <div className="space-y-6 flex-1">
               {sectorHeat.length > 0 ? sectorHeat.map((zone) => {
                 const pct = Math.round((zone.avgPoints / maxSectorPoints) * 100);
                 const trend = pct >= 80 ? "Critique" : pct >= 50 ? "Eleve" : pct >= 30 ? "Moyen" : "Faible";
                 const color = pct >= 80 ? "bg-rose-500" : pct >= 50 ? "bg-amber-500" : pct >= 30 ? "bg-indigo-500" : "bg-gray-600";
                 return (
                   <div key={zone.name} className="group cursor-default">
                      <div className="flex justify-between text-[11px] font-black text-gray-400 mb-3 group-hover:text-white transition-colors uppercase tracking-widest">
                        <span className="truncate mr-2">{zone.name}</span>
                        <span className="text-indigo-400 shrink-0">{trend} ({zone.count})</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          className={`h-full ${color} shadow-[0_0_10px_rgba(0,0,0,0.5)]`}
                        />
                      </div>
                   </div>
                 );
               }) : (
                 <div className="text-[10px] text-gray-600 font-black uppercase tracking-widest text-center py-4">Chargement...</div>
               )}
            </div>
          </div>

          {/* Distribution par Dimension */}
          <div className="p-8 rounded-[2.5rem] bg-black/40 border border-white/10 shadow-2xl backdrop-blur-xl">
             <div className="flex items-center justify-between mb-8">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                  <TrendingUp size={16} className="text-indigo-400" /> Distribution par Dimension
                </h3>
                <Zap size={16} className="text-indigo-500 animate-pulse" />
             </div>

             <div className="space-y-4">
                {Object.entries(dimensionCounts).length > 0 ? (
                  Object.entries(dimensionCounts).sort((a, b) => b[1] - a[1]).map(([dim, count]) => (
                    <div key={dim} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-indigo-500/20 transition-all group">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-white transition-colors">
                        {DIMENSION_FR[dim] || dim}
                      </span>
                      <span className="px-3 py-1 rounded-xl bg-indigo-500/10 text-indigo-400 text-[10px] font-black border border-indigo-500/10">
                        {count}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-gray-600 font-black uppercase tracking-widest text-center py-4">Chargement...</div>
                )}
             </div>
          </div>

          {/* Signal Catalog */}
          <div className="p-8 rounded-[2.5rem] bg-black/40 border border-white/10 shadow-2xl backdrop-blur-xl">
            <button
              onClick={() => setCatalogOpen(!catalogOpen)}
              className="w-full flex items-center justify-between"
            >
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <Hash size={16} className="text-indigo-400" /> Catalogue des Signaux ({catalogEntries.length || 18})
              </h3>
              {catalogOpen ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
            </button>

            <AnimatePresence>
              {catalogOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 mt-6 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                    {catalogEntries.length > 0 ? catalogEntries.map((entry, i) => (
                      <div key={entry.id || i} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-indigo-500/20 transition-all">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                            {DIMENSION_FR[entry.dimension] || entry.dimension}
                          </span>
                          <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                            +{entry.points} pts
                          </span>
                        </div>
                        <div className="text-[11px] font-bold text-gray-300 leading-relaxed">
                          {entry.label}
                        </div>
                        {entry.description && (
                          <div className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                            {entry.description}
                          </div>
                        )}
                      </div>
                    )) : (
                      // Fallback if no catalog from API
                      <div className="text-[10px] text-gray-600 font-black uppercase tracking-widest text-center py-4">
                        18 types de signaux disponibles. Catalogue en cours de chargement...
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button className="w-full py-4 rounded-3xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 active:scale-95">
             Telecharger le Rapport d&apos;Intelligence
          </button>
        </div>

      </div>
    </div>
  );
}
