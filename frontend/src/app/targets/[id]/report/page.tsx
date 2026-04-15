"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FileText, Download, ArrowLeft, ShieldCheck, Zap, TrendingUp, Target as TargetIcon, Users, MapPin, Briefcase, Clock, Activity, Fingerprint, Crosshair, AlertTriangle, Network } from "lucide-react";
import { Target as TargetType } from "@/types";

export default function ReportPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const [target, setTarget] = useState<TargetType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentDate, setCurrentDate] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    setMounted(true);
    setCurrentDate(new Date().toLocaleDateString('en-US'));
    setCurrentTime(new Date().toLocaleTimeString());
  }, []);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/targets/${id}`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(json => {
        setTarget(json.data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#050505]">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !target) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] text-white">
        <div className="w-20 h-20 rounded-[2rem] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-6 shadow-2xl animate-pulse">
          <AlertTriangle size={40} className="text-rose-500" />
        </div>
        <h1 className="text-3xl font-black mb-3 tracking-tighter">Access Denied: Intel Vault Error</h1>
        <p className="text-gray-400 mb-8 max-w-sm text-center font-medium opacity-60">Unable to retrieve intelligence dossier for target {id}. Authentication token may have expired or node is unreachable.</p>
        <button onClick={() => router.push("/")} className="px-10 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-[11px] uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-2xl">
          Return to Command Center
        </button>
      </div>
    );
  }

  const handlePrint = () => {
    setIsExporting(true);
    setTimeout(() => {
      window.print();
      setIsExporting(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-8 pb-32 flex flex-col items-center">
      {/* Controls */}
      <div className="w-full max-w-4xl flex flex-col sm:flex-row justify-between items-center mb-12 print:hidden gap-6">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors font-black uppercase tracking-widest text-[10px]"
        >
          <ArrowLeft size={16} /> Back to Vault
        </button>
        <button 
          onClick={handlePrint}
          disabled={isExporting}
          className={`px-8 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-3 hover:bg-gray-200 transition-all shadow-2xl ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isExporting ? (
            <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
          ) : (
            <Download size={16} />
          )}
          {isExporting ? "Generating PDF..." : "Export Dossier (PDF)"}
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl bg-white text-black p-6 sm:p-10 md:p-20 shadow-none flex flex-col gap-8 sm:gap-12 print:rounded-none overflow-hidden"
      >
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start border-b-8 border-black pb-12 gap-8">
          <div>
            <div className="flex items-center gap-3 mb-6">
               <div className="w-12 h-12 bg-black flex items-center justify-center rounded-xl">
                  <Fingerprint size={28} className="text-white" />
               </div>
               <span className="font-black text-3xl tracking-tighter uppercase">EDRCF 6.0</span>
            </div>
            <h1 className="text-5xl font-black tracking-tighter mb-2 italic uppercase">Dossier : Origination</h1>
            <p className="text-gray-500 font-bold uppercase tracking-[0.3em] text-xs">Weak Signals Radar • {mounted ? currentDate : "Loading..."}</p>
          </div>
          <div className="text-left sm:text-right">
             <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Protocol Confidence</div>
             <div className="text-4xl font-black">{target.globalScore}</div>
             <div className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mt-1 italic">{target.priorityLevel}</div>
          </div>
        </div>

        {/* 01. Context & Financials */}
        <section>
           <h2 className="text-xs font-black uppercase tracking-[0.4em] text-gray-400 mb-8 flex items-center gap-4">
              <span className="w-1.5 h-6 bg-black rounded-full" /> 01. INTEL SNAPSHOT
           </h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-8">
                 <div>
                    <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Company Name</div>
                    <div className="text-3xl font-black uppercase tracking-tight italic">{target.name}</div>
                 </div>
                 <div className="grid grid-cols-2 gap-8">
                    <div>
                       <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Sector</div>
                       <div className="text-sm font-black uppercase">{target.sector}</div>
                    </div>
                    <div>
                       <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">M&A Window</div>
                       <div className="text-sm font-black uppercase italic">{target.analysis.window}</div>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-8 pt-4 border-t border-gray-100">
                    <div>
                       <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Annual Revenue</div>
                       <div className="text-sm font-black">{target?.financials?.revenue || "N/A"}</div>
                       <div className="text-[9px] font-bold text-emerald-600">{target?.financials?.revenue_growth || "0%"} Growth</div>
                    </div>
                    <div>
                       <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">EBITDA Performance</div>
                       <div className="text-sm font-black">{target?.financials?.ebitda || "N/A"}</div>
                       <div className="text-[9px] font-bold text-gray-500">{target?.financials?.ebitda_margin || "0%"} Margin</div>
                    </div>
                 </div>
              </div>
              <div className="p-8 bg-gray-50 rounded-[2rem] border border-gray-100">
                  <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-6 border-b border-gray-200 pb-2">Convergence Signal Cluster</div>
                  <div className="space-y-4">
                     {target.topSignals.map((s, i) => (
                       <div key={i} className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-black shrink-0 shadow-xl" />
                          <div className="flex flex-col">
                             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{s.family}</span>
                             <span className="text-[11px] font-black uppercase">{s.label}</span>
                          </div>
                       </div>
                     ))}
                  </div>
              </div>
           </div>
        </section>

        {/* 02. Analysis */}
        <section className="bg-black text-white p-6 sm:p-8 lg:p-12 rounded-[2rem] sm:rounded-[3rem] lg:rounded-[3.5rem] relative overflow-hidden shadow-2xl">
           <div className="absolute top-0 right-0 p-12 opacity-10">
              <Activity size={120} />
           </div>
           <h2 className="text-xs font-black uppercase tracking-[0.4em] text-gray-500 mb-8 relative z-10">02. STRATEGIC NARRATIVE</h2>
           <div className="space-y-8 relative z-10">
              <div>
                 <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2">Deal Type Identification</div>
                 <div className="text-2xl font-black italic">{target.analysis.type}</div>
              </div>
              <p className="text-xl font-bold leading-relaxed text-gray-200 border-l border-indigo-500/40 pl-8 italic">
                "{target.analysis.narrative}"
              </p>
           </div>
        </section>

        {/* 03. Entry Path */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
           <div>
              <h2 className="text-xs font-black uppercase tracking-[0.4em] text-gray-400 mb-8 flex items-center gap-3">
                 <Crosshair size={18} /> 03. ACTIVATION PROTOCOL
              </h2>
              <div className="space-y-8">
                 <div>
                    <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">Priority Deciders</div>
                    <div className="flex flex-wrap gap-2">
                       {target.activation.deciders.map((d, i) => (
                         <span key={i} className="px-3 py-1 bg-gray-100 rounded-lg text-[10px] font-black uppercase">{d}</span>
                       ))}
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-8">
                    <div>
                       <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 text-indigo-600">Proximity Strength</div>
                       <div className="text-lg font-black">{target?.relationship?.strength || 0}%</div>
                    </div>
                    <div>
                       <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 text-indigo-600">Entry Path</div>
                       <div className="text-xs font-bold leading-tight uppercase">{target?.relationship?.path || "Direct"}</div>
                    </div>
                 </div>
                 <div>
                    <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Engagement Angle</div>
                    <div className="text-sm font-bold leading-relaxed italic">"{target.activation.approach}"</div>
                 </div>
              </div>
           </div>
           
           <div className="p-10 border-4 border-rose-500/10 rounded-[3rem] bg-rose-50/20">
              <h2 className="text-xs font-black uppercase tracking-[0.4em] text-rose-500 mb-8 flex items-center gap-3">
                 <AlertTriangle size={18} /> VIGILANCE PROTOCOL
              </h2>
              <div className="space-y-8">
                 <div>
                    <div className="text-[9px] font-black text-rose-500/60 uppercase tracking-widest mb-2 uppercase">False Positive Probability</div>
                    <div className="text-3xl font-black text-rose-600 tracking-tighter">{target.risks.falsePositive}</div>
                 </div>
                 <div>
                    <div className="text-[9px] font-black text-rose-500/60 uppercase tracking-widest mb-2">Uncertainty Vectors</div>
                    <p className="text-xs font-bold leading-relaxed text-gray-600">
                       {target.risks.uncertainties}
                    </p>
                 </div>
              </div>
           </div>
        </section>

        {/* Footer */}
        <div className="mt-12 pt-12 border-t border-black flex flex-col sm:flex-row justify-between items-center gap-6 text-[8px] font-black text-gray-400 uppercase tracking-widest">
           <div className="flex gap-8">
              <span>EDRCF-ARCHIVE-V5</span>
              <span>CONFIDENTIALITY LEVEL: INTERNAL</span>
              <span>GEN-TIME: {mounted ? currentTime : "Sync..."}</span>
           </div>
           <div>PROPRIETARY ORIGINATION DATA • DO NOT DISTRIBUTE</div>
        </div>
      </motion.div>

      <style>{`
        @media print {
          html, body { background: white !important; margin: 0; padding: 0; }
          .min-h-screen { min-height: 0 !important; background: white !important; padding: 0 !important; }
          .max-w-4xl { max-width: 100% !important; margin: 0 !important; }
          .shadow-none { box-shadow: none !important; }
           div[class*="print:hidden"] { display: none !important; }
          .print\:hidden { display: none !important; }
          .print\:rounded-none { border-radius: 0 !important; }
          section { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
