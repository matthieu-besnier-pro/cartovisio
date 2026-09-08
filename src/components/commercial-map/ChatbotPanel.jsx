import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';

export default function ChatbotPanel({ vendors, communeNames, onAction }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Bonjour ! Je peux modifier la carte pour vous. Exemples : « Ajoute la commune de Loudun à MIGAUD », « Change la couleur de DUPONT en bleu », « Montre seulement le secteur de MARTIN ».' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await base44.functions.invoke('mapChatbot', {
        message: text,
        vendors,
        communes: communeNames,
        history: messages.map(m => ({ role: m.role, content: m.content })),
      });
      const action = res?.data?.action || res?.action;
      const reply = action?.message || 'Action effectuée.';
      setMessages(m => [...m, { role: 'assistant', content: reply }]);
      if (action && action.action !== 'answer') onAction(action);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: 'Erreur : ' + (e.message || 'impossible de contacter l\'assistant') }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-5 z-[900] w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-transform hover:scale-105"
        style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
        title="Assistant IA"
      >
        {open ? <X className="w-5 h-5 text-white" /> : <MessageSquare className="w-5 h-5 text-white" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-[900] w-[340px] h-[440px] bg-slate-900/97 backdrop-blur-xl rounded-2xl border border-slate-700/60 shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/60 bg-slate-950/50 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-bold text-slate-100">Assistant carte</span>
            <span className="ml-auto text-[10px] text-slate-500 font-semibold">IA</span>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed',
                    m.role === 'user'
                      ? 'bg-violet-600 text-white rounded-br-sm'
                      : 'bg-slate-800 text-slate-200 rounded-bl-sm border border-slate-700/40'
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-slate-800 text-slate-400 px-3 py-2 rounded-2xl rounded-bl-sm border border-slate-700/40 text-xs flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-slate-600 border-t-violet-400 rounded-full animate-spin" />
                  Réflexion...
                </div>
              </div>
            )}
          </div>
          <div className="p-3 border-t border-slate-700/60 flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Demandez une modification..."
              className="flex-1 bg-slate-950/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            />
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white disabled:opacity-40 transition-colors"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}