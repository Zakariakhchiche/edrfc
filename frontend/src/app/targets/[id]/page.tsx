"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Target, ShieldCheck, Zap, TrendingUp, AlertCircle,
  Share2, ArrowRight, Radio, Fingerprint, Activity, Clock,
  Users, Briefcase, Crosshair, MapPin, Gauge, FileText, AlertTriangle, Network,
  ExternalLink, Building2, Calendar, Hash, User, Newspaper, ScrollText
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Target as TargetType } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

const DIMENSION_FR: Record<string, string> = {
  signaux_patrimoniaux: "Patrimoniaux",
  signaux_strategiques: "Strategiques",
  signaux_financiers: "Financiers",
  signaux_gouvernance: "Gouvernance",
  signaux_marche: "Marche",
};

const SEVERITY_FR: Record<string, string> = {
  high: "Haute",
  medium: "Moyenne",
  low: "Basse",
};

function getDimensionColor(pct: number): string {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 60) return "bg-indigo-500";
  if (pct >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

function getDimensionBg(pct: number): string {
  if (pct >= 80) return "text-emerald-400";
  if (pct >= 60) return "text-indigo-400";
  if (pct >= 40) return "text-amber-400";
  return "text-rose-400";
}

export default function TargetDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [targetData, setTargetData] = useState<TargetType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'info'} | null>(null);
  const [news, setNews] = useState<{title:string; link:string; date:string; source:string; signals:string[]}[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [actes, setActes] = useState<{type:string; date:string; description:string}[]>([]);
  const [actesLoading, setActesLoading] = useState(false);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleAction = (name: string, message: string) => {
    setProcessingAction(name);
    setTimeout(() => {
      setProcessingAction(null);
      setNotification({ message, type: 'success' });
    }, 1500);
  };

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    fetch(`/api/targets/${id}`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(json => {
        setTargetData(json.data);
        setLoading(false);
        // Fetch external enrichments after main data loads
        const siren = json.data?.siren;
        if (siren) {
          setNewsLoading(true);
          fetch(`/api/news/${siren}`)
            .then(r => r.json())
            .then(d => { setNews(d.data?.articles || []); setNewsLoading(false); })
            .catch(() => setNewsLoading(false));
          setActesLoading(true);
          fetch(`/api/infogreffe/${siren}`)
            .then(r => r.json())
            .then(d => { setActes(d.data?.actes || []); setActesLoading(false); })
            .catch(() => setActesLoading(false));
        }
      })
      .catch(err => {
        console.error(err);
        setError(true);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white">
        <div className="relative w-20 h-20 mb-8">
          <div className="absolute inset-0 border-4 border-indigo-500/10 rounded-full" />
          <div className="absolute inset-0 border-t-4 border-indigo-500 rounded-full animate-spin shadow-[0_0_30px_rgba(79,70,229,0.5)]" />
        </div>
        <span className="font-black uppercase tracking-[0.4em] text-[10px] text-indigo-400">Chargement du dossier {id || '...'}...</span>
      </div>
    );
  }

  if (error || !targetData) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-white">
          <div className="w-20 h-20 rounded-[2rem] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-6 shadow-2xl">
            <AlertCircle size={40} className="text-rose-500" />
          </div>
          <h1 className="text-3xl font-black mb-3 tracking-tighter">Erreur de Chargement</h1>
          <p className="text-gray-400 mb-8 max-w-sm text-center font-medium leading-relaxed">La cible {id} est actuellement inaccessible ou n&apos;existe pas dans la base.</p>
          <Link href="/" className="px-8 py-4 bg-indigo-600 text-white rounded-[2rem] hover:bg-indigo-500 transition-all font-black text-xs uppercase tracking-widest shadow-2xl shadow-indigo-600/30">
            Retour au Centre de Commande
          </Link>
        </div>
      );
  }

  const getPriorityColor = (level: string) => {
    if (level === "Action Prioritaire") return "text-rose-400 bg-rose-500/10 border-rose-500/20";
    if (level === "Qualification") return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    if (level === "Monitoring") return "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
    if (level === "Veille Passive") return "text-gray-400 bg-white/5 border-white/10";
    // Legacy English labels
    if (level === "Strong Opportunity") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (level === "Priority Target") return "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
    if (level === "Preparation Needed") return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-gray-400 bg-white/5 border-white/10";
  };

  const scoringDimensions = targetData.scoring_details ? Object.entries(targetData.scoring_details) : [];

  return (
    <div className="flex flex-col gap-12 w-full max-w-7xl mx-auto pb-32 pt-6 px-4 relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-10 left-1/2 z-[200] px-6 py-3 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest shadow-2xl flex items-center gap-3 border border-indigo-400 backdrop-blur-xl"
          >
            <ShieldCheck size={16} /> {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 sm:gap-6 border-b border-white/5 pb-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <button onClick={() => router.push('/targets')} className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all backdrop-blur-xl group shrink-0">
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-4 mb-3">
              <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white truncate max-w-full uppercase italic">{targetData.name}</h1>
              <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border ${getPriorityColor(targetData.priorityLevel)}`}>
                {targetData.priorityLevel}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
               <div className="flex items-center gap-2.5 px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest w-fit">
                  {targetData.sector} &bull; EDRCF 6.0
               </div>
               <p className="text-gray-500 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em]">
                  ID: <span className="text-gray-300">{targetData.id.toUpperCase()}</span> &bull; Fenetre: <span className="text-white">{targetData.analysis?.window ?? "N/A"}</span>
               </p>
            </div>
          </div>
        </div>

        <div className="flex gap-4 w-full lg:w-auto">
          <button
            onClick={() => handleAction('share', 'Lien du dossier copie')}
            className="flex-1 lg:flex-none w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center shadow-xl"
          >
            <Share2 size={24} />
          </button>
          <button
            disabled={processingAction === 'fetch'}
            onClick={() => handleAction('fetch', 'Radar synchronise')}
            className="flex-[4] lg:flex-none flex items-center justify-center gap-3 px-10 py-4 rounded-2xl bg-indigo-600 text-white font-black text-xs uppercase tracking-widest shadow-2xl shadow-indigo-600/40 hover:bg-indigo-500 transition-all active:scale-95 disabled:opacity-50"
          >
            {processingAction === 'fetch' ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Activity size={20} />
            )}
            {processingAction === 'fetch' ? 'Analyse...' : 'Actualiser'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

        {/* Left Column - Origination Card */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          {/* Score + Financials Card */}
          <div className="p-10 rounded-[3rem] bg-black/40 border border-indigo-500/20 relative overflow-hidden group shadow-2xl backdrop-blur-3xl">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 via-transparent to-transparent opacity-50" />

            <div className="relative z-10">
              <div className="flex justify-between items-center mb-12">
                <div className="p-4 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Fingerprint size={32} />
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400/80 mb-1">Integrite des Donnees</div>
                  <div className="text-xs font-black text-white flex items-center gap-2 justify-end">
                    <ShieldCheck size={14} className="text-emerald-500" /> SECURISE
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center mb-12">
                <div className="relative">
                  <div className="flex flex-col items-center">
                    <span className="text-7xl font-black text-white leading-none tracking-tighter mb-2">{targetData.globalScore}</span>
                    <span className="text-[10px] font-black text-indigo-400/60 uppercase tracking-[0.4em]">Score Global</span>
                  </div>
                </div>

                {/* Scoring Dimensions Bar Chart */}
                {scoringDimensions.length > 0 && (
                  <div className="mt-10 w-full space-y-4">
                    <div className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] text-center mb-2">Scoring par Dimension</div>
                    {scoringDimensions.map(([key, dim]) => {
                      const pct = dim.max > 0 ? Math.round((dim.score / dim.max) * 100) : 0;
                      return (
                        <div key={key} className="group/dim">
                          <div className="flex justify-between items-center text-[10px] mb-1.5">
                            <span className="font-black text-gray-400 uppercase tracking-widest truncate mr-2">
                              {dim.label || DIMENSION_FR[key] || key}
                            </span>
                            <span className={`font-black ${getDimensionBg(pct)}`}>
                              {dim.score}/{dim.max}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className={`h-full rounded-full ${getDimensionColor(pct)}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Financial Quick View */}
                <div className="mt-10 w-full grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
                    <div className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-1">Chiffre d&apos;Affaires</div>
                    <div className="text-sm font-black text-gray-200">{targetData?.financials?.revenue || "N/A"}</div>
                    <div className="text-[8px] font-bold text-emerald-500">{targetData?.financials?.revenue_growth || "0%"}</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
                    <div className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-1">EBITDA</div>
                    <div className="text-sm font-black text-gray-200">{targetData?.financials?.ebitda || "N/A"}</div>
                    <div className="text-[8px] font-bold text-gray-500">{targetData?.financials?.ebitda_margin || "0%"} Marge</div>
                  </div>
                </div>

                <div className="mt-8 flex flex-col items-center w-full">
                   <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4">Statut Prioritaire</span>
                   <div className="w-full text-center text-lg font-black text-white px-6 py-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 italic">
                      {targetData?.priorityLevel}
                   </div>
                </div>
              </div>

              {/* Relationship Section */}
              <div className="space-y-6 mt-8 border-t border-white/[0.05] pt-8">
                   <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                         <Network size={16} />
                      </div>
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">Proximite Reseau</span>
                   </div>
                   <div className="space-y-4">
                     <div className="flex justify-between items-center text-[10px]">
                        <span className="text-gray-500 font-bold uppercase">Force du Lien</span>
                        <span className="text-emerald-400 font-black">{targetData?.relationship?.strength || 0}%</span>
                     </div>
                     <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${targetData?.relationship?.strength || 0}%` }}
                          className="h-full bg-emerald-500"
                        />
                     </div>
                     <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                        <div className="text-[8px] font-bold text-gray-600 uppercase">Lien Principal</div>
                        <div className="text-[11px] font-black text-gray-300">{targetData?.relationship?.path || "Contact Direct"}</div>
                     </div>
                   </div>
              </div>
            </div>
          </div>

          {/* Company Identity */}
          <div className="p-8 rounded-[2.5rem] bg-black/40 border border-white/10 shadow-2xl backdrop-blur-xl">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-8">
              <Building2 size={16} className="text-indigo-400" /> Identite Societe
            </h3>
            <div className="space-y-4">
              {[
                { label: "SIREN", value: targetData.siren, icon: <Hash size={14} /> },
                { label: "Code NAF", value: targetData.code_naf, icon: <Briefcase size={14} /> },
                { label: "Date de creation", value: targetData.creation_date, icon: <Calendar size={14} /> },
                { label: "Ville", value: targetData.city, icon: <MapPin size={14} /> },
                { label: "Region", value: targetData.region, icon: <MapPin size={14} /> },
                { label: "Structure", value: targetData.structure, icon: <Building2 size={14} /> },
              ].map((item) => (
                item.value ? (
                  <div key={item.label} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                      <span className="text-indigo-400/50">{item.icon}</span> {item.label}
                    </div>
                    <span className="text-[11px] font-black text-gray-300">{item.value}</span>
                  </div>
                ) : null
              ))}
            </div>
          </div>

          {/* Dirigeants Section */}
          {targetData.dirigeants && targetData.dirigeants.length > 0 && (
            <div className="p-8 rounded-[2.5rem] bg-black/40 border border-white/10 shadow-2xl backdrop-blur-xl">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-8">
                <Users size={16} className="text-indigo-400" /> Dirigeants
              </h3>
              <div className="space-y-4">
                {targetData.dirigeants.map((dirigeant, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-indigo-500/20 transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                          <User size={18} />
                        </div>
                        <div>
                          <div className="text-sm font-black text-white tracking-tight">{dirigeant.name}</div>
                          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{dirigeant.role}</div>
                        </div>
                      </div>
                      {dirigeant.age > 0 && (
                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border
                          ${dirigeant.age >= 65 ? 'bg-rose-500/20 text-rose-400 border-rose-500/20' :
                            dirigeant.age >= 60 ? 'bg-amber-500/20 text-amber-400 border-amber-500/20' :
                            'bg-white/5 text-gray-400 border-white/10'}
                        `}>
                          {dirigeant.age} ans
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      {dirigeant.since && (
                        <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">
                          En poste depuis {dirigeant.since}
                        </span>
                      )}
                      {dirigeant.ex_pe && (
                        <span className="text-[9px] font-black text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/10 uppercase">
                          Ex-PE
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Group Section */}
          {targetData.group?.is_group && (
            <div className="p-8 rounded-[2.5rem] bg-black/40 border border-white/10 shadow-2xl backdrop-blur-xl">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-8">
                <Network size={16} className="text-indigo-400" /> Structure du Groupe
              </h3>
              <div className="space-y-4">
                {targetData.group.parent && (
                  <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                    <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Maison Mere</div>
                    <div className="text-sm font-black text-white">{targetData.group.parent}</div>
                  </div>
                )}
                {targetData.group.consolidated_revenue && (
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                    <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">CA Consolide</div>
                    <div className="text-sm font-black text-emerald-400">{targetData.group.consolidated_revenue}</div>
                  </div>
                )}
                {targetData.group.subsidiaries && targetData.group.subsidiaries.length > 0 && (
                  <div>
                    <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Filiales ({targetData.group.subsidiaries.length})</div>
                    <div className="space-y-2">
                      {targetData.group.subsidiaries.map((sub, i) => (
                        <div key={i} className="px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] font-bold text-gray-400 hover:text-white hover:border-indigo-500/20 transition-all">
                          {sub}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Deep Dive */}
        <div className="lg:col-span-8 flex flex-col gap-10">
           {/* Strategic Thesis */}
           <section className="p-12 rounded-[4rem] bg-white/[0.02] border border-white/10 relative overflow-hidden group hover:border-indigo-500/30 transition-all">
              <div className="absolute top-0 right-10 bottom-0 w-1/3 bg-gradient-to-l from-indigo-600/5 to-transparent skew-x-12" />
              <h2 className="text-xs font-black uppercase tracking-[0.4em] text-gray-500 mb-10 flex items-center gap-4">
                 <span className="w-10 h-px bg-white/10" /> 01. These Strategique
              </h2>
              <div className="space-y-12 relative z-10">
                 <div>
                    <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-4">Angle Technique Probable</div>
                    <div className="text-4xl font-black text-white tracking-tighter uppercase italic leading-tight">{targetData.analysis?.type ?? "—"}</div>
                 </div>
                 <p className="text-xl font-medium leading-relaxed text-gray-300 border-l border-indigo-500/30 pl-8">
                   &laquo;{targetData.analysis?.narrative ?? "Analyse en cours."}&raquo;
                 </p>
              </div>
           </section>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Conviction Indicators / Signals */}
              <section className="p-12 rounded-[4rem] bg-white/[0.02] border border-white/10">
                 <h2 className="text-xs font-black uppercase tracking-[0.4em] text-gray-500 mb-10 flex items-center gap-4">
                    <Radio size={16} /> 02. Indicateurs de Conviction
                 </h2>
                 <div className="space-y-4">
                    {(targetData.topSignals ?? []).map((signal, i) => (
                      <div key={i} className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-indigo-500/20 transition-all group/signal">
                         <div className="flex items-center justify-between mb-2">
                           <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest group-hover/signal:text-indigo-400 transition-colors">
                             {signal.family}
                           </span>
                           <div className="flex items-center gap-2">
                             {signal.severity && (
                               <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border
                                 ${signal.severity === 'high' ? 'bg-rose-500/20 text-rose-400 border-rose-500/20' :
                                   signal.severity === 'medium' ? 'bg-amber-500/20 text-amber-400 border-amber-500/20' :
                                   'bg-white/10 text-gray-400 border-white/10'}
                               `}>
                                 {SEVERITY_FR[signal.severity] || signal.severity}
                               </span>
                             )}
                             {signal.points !== undefined && (
                               <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/10">
                                 +{signal.points} pts
                               </span>
                             )}
                           </div>
                         </div>
                         <div className="text-sm font-bold text-gray-200 uppercase tracking-tight mb-2">{signal.label}</div>
                         <div className="flex items-center gap-3">
                           {signal.dimension && (
                             <span className="text-[8px] font-bold text-purple-400 uppercase tracking-widest">
                               {DIMENSION_FR[signal.dimension] || signal.dimension}
                             </span>
                           )}
                           {signal.source_url ? (
                             <a
                               href={signal.source_url}
                               target="_blank"
                               rel="noopener noreferrer"
                               className="text-[8px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors flex items-center gap-1"
                             >
                               <ExternalLink size={10} /> {signal.source}
                             </a>
                           ) : (
                             <span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">{signal.source}</span>
                           )}
                         </div>
                      </div>
                    ))}
                 </div>
              </section>

              {/* Strategic Activation */}
              <section className="p-12 rounded-[4rem] bg-indigo-600 text-white shadow-2xl relative overflow-hidden group">
                 <div className="absolute -top-10 -right-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
                    <Crosshair size={120} />
                 </div>
                 <h4 className="text-xs font-black uppercase tracking-widest mb-10 flex items-center gap-3">
                   <Crosshair size={18} /> 03. Activation Strategique
                 </h4>
                 <div className="space-y-8 relative z-10">
                    <div>
                       <div className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-2 opacity-60">Angle d&apos;Approche</div>
                       <div className="text-sm font-bold leading-relaxed">{targetData.activation?.approach ?? "À définir"}</div>
                    </div>
                    <div>
                       <div className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-2 opacity-60">Decideurs Cles</div>
                       <div className="flex flex-wrap gap-2">
                          {(targetData.activation?.deciders ?? []).map((d, i) => (
                            <span key={i} className="px-3 py-1 bg-black/20 rounded-xl text-[10px] font-black uppercase">{d}</span>
                          ))}
                       </div>
                    </div>
                    <div>
                        <div className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-2 opacity-60">Motif Objectif</div>
                        <div className="text-sm font-bold leading-relaxed">{targetData.activation?.reason ?? "À qualifier"}</div>
                    </div>
                 </div>
              </section>
           </div>

           {/* Google News Section */}
           <section className="p-10 rounded-[3rem] bg-white/[0.02] border border-white/10 space-y-6">
              <h2 className="text-xs font-black uppercase tracking-[0.4em] text-gray-500 flex items-center gap-4">
                 <span className="w-10 h-px bg-white/10" />
                 <Newspaper size={16} className="text-indigo-400" /> Veille Presse
              </h2>
              {newsLoading ? (
                <div className="flex items-center gap-3 text-gray-600 text-[10px] font-black uppercase tracking-widest">
                  <div className="w-4 h-4 border-2 border-gray-700 border-t-indigo-500 rounded-full animate-spin" />
                  Chargement articles...
                </div>
              ) : news.length === 0 ? (
                <p className="text-gray-600 text-xs font-medium">Aucun article récent trouvé pour cette entreprise.</p>
              ) : (
                <div className="space-y-3">
                  {news.map((article, i) => (
                    <a
                      key={i}
                      href={article.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-indigo-500/20 transition-all group"
                    >
                      <ExternalLink size={14} className="text-indigo-400 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors leading-snug line-clamp-2">{article.title}</p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{article.source}</span>
                          <span className="text-[9px] text-gray-700">{article.date?.split(',')[0]}</span>
                          {article.signals?.map(sig => (
                            <span key={sig} className="px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-[8px] font-black text-rose-400 uppercase tracking-widest">
                              Signal M&A
                            </span>
                          ))}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
           </section>

           {/* Infogreffe Actes Section */}
           <section className="p-10 rounded-[3rem] bg-white/[0.02] border border-white/10 space-y-6">
              <h2 className="text-xs font-black uppercase tracking-[0.4em] text-gray-500 flex items-center gap-4">
                 <span className="w-10 h-px bg-white/10" />
                 <ScrollText size={16} className="text-amber-400" /> Actes RCS — Infogreffe
              </h2>
              {actesLoading ? (
                <div className="flex items-center gap-3 text-gray-600 text-[10px] font-black uppercase tracking-widest">
                  <div className="w-4 h-4 border-2 border-gray-700 border-t-amber-500 rounded-full animate-spin" />
                  Chargement actes...
                </div>
              ) : actes.length === 0 ? (
                <p className="text-gray-600 text-xs font-medium">Aucun acte récent disponible en open data pour cette société.</p>
              ) : (
                <div className="space-y-3">
                  {actes.map((acte, i) => (
                    <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-amber-500/20 transition-all">
                      <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-2" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-gray-200 uppercase tracking-tight">{acte.type}</p>
                        {acte.description && (
                          <p className="text-xs text-gray-500 mt-1 leading-snug line-clamp-2">{acte.description}</p>
                        )}
                        {acte.date && (
                          <span className="text-[9px] font-black text-amber-500/60 uppercase tracking-widest mt-2 block">{acte.date}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
           </section>

           {/* Bottom Bar */}
           <div className="mt-10 pt-10 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-8">
              <div className="flex items-center gap-10">
                 <div>
                    <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">Protocole de Vigilance</div>
                    <div className="flex items-center gap-3 px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-[10px] font-black uppercase">
                       <AlertTriangle size={14} /> {targetData.risks?.falsePositive ?? "N/A"} FPR
                    </div>
                 </div>
              </div>
              <button
                onClick={() => router.push(`/targets/${id}/report`)}
                className="w-full sm:w-auto px-10 py-5 bg-white text-black rounded-[2rem] font-black uppercase tracking-widest text-[11px] hover:bg-indigo-500 hover:text-white transition-all shadow-2xl active:scale-95 group flex items-center justify-center gap-3"
              >
                <FileText size={18} /> Generer le Dossier d&apos;Origination
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
