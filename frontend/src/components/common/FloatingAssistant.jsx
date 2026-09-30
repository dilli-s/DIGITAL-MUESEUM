import React, { useState, useRef, useEffect } from 'react';
import { askMuseumAssistant } from '../../services/api';
import { Bot, Send, User, X, AlertCircle, Loader, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const QUICK_PROMPTS = [
  "🏺 What are the most famous artifacts?",
  "🏛️ Which museum has classical statues?",
  "🗺️ How does the virtual tour work?",
  "📖 Tell me about Renaissance art",
];

const FloatingAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState([
    {
      role: 'assistant',
      content: 'Greetings, explorer! I am your Digital Museum AI Curator. How may I assist your cultural journey today?',
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [history, isOpen, isLoading]);

  const handleSend = async (textToSend) => {
    const text = (textToSend || question).trim();
    if (!text || isLoading) return;

    setHistory(prev => [...prev, { role: 'user', content: text }]);
    setQuestion('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await askMuseumAssistant(text);
      setHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          content: response.data.answer || "I found information from the museum archives for your query.",
          sources: response.data.sources || [],
        }
      ]);
    } catch (err) {
      console.error(err);
      setError("The museum curator is temporarily unavailable.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleSend();
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end pointer-events-auto">
      
      {/* Expanded Chat Dialog */}
      {isOpen && (
        <div className="mb-3 w-[92vw] sm:w-[380px] h-[500px] max-h-[80vh] flex flex-col rounded-2xl overflow-hidden bg-[#fbf7ee] border border-[#d8c8b0] shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-300 text-[#241a10]">
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-[#ede4d4] border-b border-[#d8c8b0]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#8f6826] flex items-center justify-center text-[#fff8ea] shadow">
                <Bot className="w-4 h-4 text-[#fff8ea]" />
              </div>
              <div className="flex flex-col">
                <span className="font-['Cinzel'] font-bold text-xs text-[#241a10] tracking-wide">
                  DIGITAL MUSEUM AI CURATOR
                </span>
                <span className="text-[10px] text-[#8f6826] flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2e7d32] animate-pulse" />
                  Online Assistant
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-[#6e5842] hover:text-[#241a10] hover:bg-[#dfd3bf] rounded-full transition-colors"
              title="Close Assistant"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
            {history.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-2 max-w-[88%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
                    msg.role === 'user' 
                      ? 'bg-[#8f6826] text-[#fff8ea]' 
                      : 'bg-[#ede3d1] text-[#8f6826] border border-[#d8c8b0]'
                  }`}>
                    {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                  </div>

                  <div className={`p-3 rounded-2xl leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-[#8f6826] text-[#fff8ea] rounded-tr-none shadow-xs' 
                      : 'bg-[#fdfbf7] text-[#241a10] border border-[#d8c8b0] rounded-tl-none shadow-xs'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {/* Sources Badge */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-[#e5d8c3]">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#8f6826] mb-1">
                          Related Archives:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.sources.map((s, i) => (
                            <Link 
                              key={i} 
                              to={s.type === 'object' ? `/objects/${s.id}` : s.type === 'learning' ? `/learning/${s.id}` : '#'}
                              className="text-[10px] px-2 py-0.5 bg-[#ede4d4] border border-[#d8c8b0] rounded-md text-[#8f6826] font-semibold hover:border-[#8f6826] inline-flex items-center gap-1 transition-colors"
                            >
                              <span>{s.title || 'View Exhibit'}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-2 max-w-[85%]">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#ede3d1] text-[#8f6826] flex items-center justify-center border border-[#d8c8b0]">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="p-3 rounded-2xl bg-[#fdfbf7] border border-[#d8c8b0] text-[#6e5842] rounded-tl-none flex items-center gap-2">
                    <Loader className="w-3.5 h-3.5 animate-spin text-[#8f6826]" />
                    <span>Searching museum archives...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Quick Prompts on initial conversation */}
            {history.length <= 1 && (
              <div className="pt-2">
                <p className="text-[10px] font-bold tracking-wider uppercase text-[#7a644e] mb-2">
                  Suggested Inquiries:
                </p>
                <div className="flex flex-col gap-1.5">
                  {QUICK_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(prompt)}
                      className="text-left text-[11px] p-2 rounded-lg bg-[#fdfbf7] hover:bg-[#ede3d1] border border-[#d8c8b0] hover:border-[#8f6826] text-[#4a3928] hover:text-[#241a10] transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="p-3 bg-[#ede4d4] border-t border-[#d8c8b0]">
            <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={isLoading}
                placeholder="Ask about artifacts, history, exhibits..."
                className="flex-1 px-3.5 py-2.5 rounded-full bg-[#fdfbf7] border border-[#d8c8b0] text-[#241a10] text-xs placeholder-[#9c8a76] focus:outline-none focus:border-[#8f6826] transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!question.trim() || isLoading}
                className="w-9 h-9 rounded-full bg-[#8f6826] hover:bg-[#a87d32] text-[#fff8ea] flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow flex-shrink-0"
                title="Send Question"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

        </div>
      )}

      {/* Floating Trigger Button (Bottom Right) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-[#8f6826] via-[#a87d32] to-[#8f6826] hover:from-[#a87d32] hover:to-[#be9141] text-[#fff8ea] shadow-2xl border border-[#dfb758]/60 transition-all duration-300 hover:scale-105 active:scale-95"
        title="Open Museum AI Assistant"
      >
        <div className="relative">
          <Bot className="w-5 h-5 text-[#ffe6a4]" />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#2e7d32] ring-2 ring-[#f4ede1]" />
        </div>
        <span className="font-['Cinzel'] font-bold text-xs tracking-wider uppercase pr-1 hidden sm:inline">
          {isOpen ? 'Close Guide' : 'AI Assistant'}
        </span>
      </button>

    </div>
  );
};

export default FloatingAssistant;
