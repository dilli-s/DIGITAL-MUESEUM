import React, { useState } from 'react';
import { askMuseumAssistant } from '../services/api';
import { Bot, Send, User, AlertCircle, Loader } from 'lucide-react';
import { Link } from 'react-router-dom';

const Assistant = () => {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim() || isLoading) return;

    const currentQuestion = question.trim();
    setHistory(prev => [...prev, { role: 'user', content: currentQuestion }]);
    setQuestion('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await askMuseumAssistant(currentQuestion);
      setHistory(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: response.data.answer, 
          sources: response.data.sources 
        }
      ]);
    } catch (err) {
      console.error(err);
      setError("The museum assistant is temporarily unavailable.");
      // Remove the user's question from history if it failed, or just show error.
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 flex flex-col h-[calc(100vh-80px)]">
      <div className="flex items-center justify-center gap-3 mb-8">
        <Bot className="w-8 h-8 text-neutral-900" />
        <h1 className="text-3xl font-bold text-neutral-900">Museum Assistant</h1>
      </div>

      <div className="flex-1 bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {history.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-neutral-500">
              <Bot className="w-12 h-12 mb-4 text-neutral-300" />
              <p>Ask me about the museum, collections, artifacts, exhibitions, or learning content.</p>
            </div>
          ) : (
            history.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-neutral-100 text-neutral-600' : 'bg-neutral-900 text-white'}`}>
                    {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                  </div>
                  <div className={`p-4 rounded-2xl ${msg.role === 'user' ? 'bg-neutral-100 text-neutral-900 rounded-tr-none' : 'bg-neutral-50 border border-neutral-200 text-neutral-800 rounded-tl-none'}`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-neutral-200">
                        <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Sources:</p>
                        <div className="flex flex-wrap gap-2">
                          {msg.sources.map((s, i) => (
                            <Link 
                              key={i} 
                              to={s.type === 'object' ? `/objects/${s.id}` : s.type === 'learning' ? `/learning/${s.id}` : '#'}
                              className="text-xs px-2 py-1 bg-white border border-neutral-200 rounded text-neutral-700 hover:border-neutral-400 transition-colors"
                            >
                              {s.type.charAt(0).toUpperCase() + s.type.slice(1)}: {s.title}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex gap-3 max-w-[85%]">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-neutral-800 rounded-tl-none flex items-center gap-2">
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Finding museum information...</span>
                </div>
              </div>
            </div>
          )}
          
          {error && (
            <div className="flex justify-center my-4">
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 border border-red-200">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
                <button onClick={() => setError(null)} className="ml-2 font-bold underline">TRY AGAIN</button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-neutral-200 bg-neutral-50">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={isLoading}
              placeholder="Ask a question..."
              className="flex-1 px-4 py-3 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!question.trim() || isLoading}
              className="px-6 py-3 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-5 h-5" />
              <span className="hidden sm:inline font-bold">SEND</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Assistant;
