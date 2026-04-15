"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Send, X, Minimize2, Maximize2,
  Terminal, User, Activity, Target, Zap, TrendingUp,
  MessageSquare, Layers, Bot, Database
} from "lucide-react";
import { usePathname } from "next/navigation";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  source?: "claude-ai" | "rule-based";
}

/** Render simple markdown: **bold**, bullet lists, line breaks */
function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    // Bullet list items
    if (trimmed.startsWith("- ") || trimmed.startsWith("• ") || trimmed.startsWith("* ")) {
      const content = trimmed.slice(2);
      elements.push(
        <div key={i} className="flex gap-2 items-start ml-2 my-0.5">
          <span className="text-indigo-400 mt-0.5 shrink-0">&bull;</span>
          <span>{renderInline(content)}</span>
        </div>
      );
    } else if (trimmed.startsWith("# ")) {
      elements.push(
        <div key={i} className="font-black text-white text-sm uppercase tracking-widest mt-2 mb-1">
          {renderInline(trimmed.slice(2))}
        </div>
      );
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <div key={i} className="font-black text-gray-300 text-xs uppercase tracking-widest mt-2 mb-1">
          {renderInline(trimmed.slice(3))}
        </div>
      );
    } else if (trimmed === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <div key={i} className="my-0.5">{renderInline(trimmed)}</div>
      );
    }
  });

  return <>{elements}</>;
}

/** Render inline markdown: **bold** */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={match.index} className="font-black text-white">{match[1]}</span>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : text;
}

export default function GlobalCopilot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev);
    window.addEventListener("toggle-copilot", handleToggle);
    return () => window.removeEventListener("toggle-copilot", handleToggle);
  }, []);

  const handleSend = async (e?: React.FormEvent, directValue?: string) => {
    if (e) e.preventDefault();

    const query = directValue || input;
    if (!query.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: query,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch(`/api/copilot/query?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Connexion API echouee");
      const data = await res.json();

      // If copilot injected new targets, notify dashboard to refresh
      if (data.targets_updated) {
        window.dispatchEvent(new CustomEvent("targets-updated"));
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response || "Je n'ai pas pu traiter cette demande. Veuillez reessayer.",
        timestamp: Date.now(),
        source: data.source || undefined,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error(err);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "ERREUR DE CONNEXION: Impossible d'etablir le lien avec les processeurs EDRCF. Verifiez le statut du serveur.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Trigger */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-[5.5rem] right-4 sm:bottom-8 sm:right-8 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-[2rem] bg-indigo-600 text-white shadow-[0_20px_50px_rgba(79,70,229,0.4)] z-[50] flex items-center justify-center border border-white/20 group"
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} className="group-hover:rotate-12 transition-transform" />}
        {!isOpen && (
           <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#050505] animate-pulse" />
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`
              fixed z-[100] bg-[#0A0A0A]/95 lg:backdrop-blur-3xl border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden
              ${isMinimized
                ? "bottom-[5.5rem] sm:bottom-32 right-4 sm:right-8 w-72 sm:w-80 h-20 rounded-2xl sm:rounded-[3rem]"
                : "bottom-16 right-0 left-0 h-[calc(100vh-8rem)] sm:bottom-32 sm:right-8 sm:left-auto sm:h-[600px] lg:h-[650px] sm:w-[420px] lg:w-[450px] rounded-t-2xl sm:rounded-[3rem]"
              }
              transition-all duration-500 ease-in-out
            `}
          >
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Sparkles size={20} />
                </div>
                <div>
                   <h3 className="text-sm font-black text-white uppercase tracking-widest leading-none mb-1">EDRCF 6.0 Copilot</h3>
                   <div className="flex items-center gap-1.5 ">
                      <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[8px] font-black text-emerald-500/60 uppercase tracking-widest">Lien Neuronal Actif</span>
                   </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white transition-colors"
                >
                  {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Chat Area */}
            {!isMinimized && (
              <>
                <div
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 custom-scrollbar"
                >
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-40 text-center space-y-4 px-10">
                       <Target size={40} className="text-indigo-400 mb-2" />
                       <p className="text-xs font-black text-white uppercase tracking-[0.2em]">Protocole Intelligence EDRCF</p>
                       <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-relaxed">
                          Surveillance de 2 408 entites. Pret pour une analyse approfondie, un mapping sectoriel ou une recherche de cibles.
                       </p>
                    </div>
                  ) : (
                    messages.map((m) => (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={m.id}
                        className={`flex gap-4 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                      >
                        <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center border
                          ${m.role === "user"
                            ? "bg-white/5 border-white/10 text-gray-400"
                            : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"}
                        `}>
                          {m.role === "user" ? <User size={16} /> : <Sparkles size={16} />}
                        </div>
                        <div className={`max-w-[80%] rounded-2xl p-4 text-[13px] leading-relaxed
                          ${m.role === "user"
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/10 rounded-tr-none"
                            : "bg-white/[0.03] border border-white/10 text-gray-300 shadow-xl rounded-tl-none"}
                        `}>
                          {m.role === "assistant" ? renderMarkdown(m.content) : m.content}

                          <div className={`flex items-center gap-3 mt-2 ${m.role === "user" ? "justify-end" : "justify-between"}`}>
                            <div className={`text-[9px] opacity-40 font-bold uppercase tracking-widest`}>
                              {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            {m.role === "assistant" && m.source && (
                              <div className={`flex items-center gap-1 text-[8px] font-black uppercase tracking-widest rounded-md px-2 py-0.5 border
                                ${m.source === "claude-ai"
                                  ? "bg-purple-500/10 text-purple-400 border-purple-500/10"
                                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/10"}
                              `}>
                                {m.source === "claude-ai" ? (
                                  <><Bot size={9} /> Claude AI</>
                                ) : (
                                  <><Database size={9} /> Base EDRCF</>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                  {isLoading && (
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                         <Sparkles size={16} className="animate-spin" />
                      </div>
                      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 flex gap-1 items-center">
                         <div className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                         <div className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                         <div className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Suggestions Chips - Show when few messages, hidden on small mobile */}
                {messages.length < 3 && (
                   <div className="hidden sm:flex px-6 py-2 gap-2 overflow-x-auto scrollbar-hide">
                      {[
                        "Top 5 cibles",
                        "Fondateurs > 60 ans",
                        "Analyse sectorielle",
                        "Etat du pipeline",
                        "Filtres disponibles"
                      ].map(s => (
                        <button
                          key={s}
                          onClick={() => {
                            setInput(s);
                            handleSend(undefined, s);
                          }}
                          className="whitespace-nowrap px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase text-gray-400 hover:bg-white/10 hover:text-white transition-all active:scale-95"
                        >
                          {s}
                        </button>
                      ))}
                   </div>
                )}

                {/* Input Area */}
                <div className="p-4 sm:p-6 bg-white/[0.02] border-t border-white/10">
                  <form
                    onSubmit={handleSend}
                    className="relative"
                  >
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Posez votre question a l'intelligence EDRCF..."
                      rows={1}
                      className="w-full bg-white/[0.05] border border-white/10 rounded-2xl py-4 pl-4 pr-14 text-sm text-white placeholder-gray-600 outline-none focus:border-indigo-500/50 transition-all resize-none"
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || isLoading}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center transition-all
                        ${input.trim() && !isLoading ? "bg-indigo-600 text-white shadow-lg" : "bg-white/5 text-gray-600"}
                      `}
                    >
                      <Send size={18} />
                    </button>
                  </form>
                  <div className="mt-4 hidden sm:flex items-center justify-between">
                     <div className="flex items-center gap-2 text-[10px] text-gray-600 font-black uppercase tracking-widest">
                        <Terminal size={12} /> Contexte: Actif
                     </div>
                     <div className="flex items-center gap-2 text-[10px] text-gray-600 font-bold">
                        Entree pour envoyer
                     </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
