import { useState, useEffect } from 'react';
import { FileCode, Trash2, TerminalSquare, Bug, CheckSquare, SearchX, Menu, X, Terminal, ChevronRight, Send, Zap } from 'lucide-react';
import { explainError, parseResponse, generatePrompts, sendFollowUpChat } from './api';
import { generateCacheKey, getCachedResult, setCachedResult } from './cache';

const LANGUAGES = ['Auto-detect', 'C', 'C++', 'Python', 'JavaScript'];

function App() {
  const [history, setHistory] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [language, setLanguage] = useState('Auto-detect');
  const [explanationStyle, setExplanationStyle] = useState('English');
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [apiError, setApiError] = useState(null);
  const [result, setResult] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCachedResult, setIsCachedResult] = useState(false);
  
  // Follow-up Chat State
  const [followUpMessages, setFollowUpMessages] = useState([]);
  const [followUpInput, setFollowUpInput] = useState('');
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
  const [rawInitialResponse, setRawInitialResponse] = useState('');

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    const savedHistory = localStorage.getItem('errorHistory');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const saveHistory = (newHistory) => {
    setHistory(newHistory);
    localStorage.setItem('errorHistory', JSON.stringify(newHistory));
  };

  const handleExplain = async () => {
    if (!errorMessage.trim()) return;

    setApiError(null);
    setResult(null);

    setFollowUpMessages([]);
    setRawInitialResponse('');

    const cacheKey = generateCacheKey(errorMessage, codeSnippet, language, explanationStyle);
    const cachedData = getCachedResult(cacheKey);

    if (cachedData) {
      setResult(cachedData.parsedResult);
      setRawInitialResponse(cachedData.rawResponse);
      setIsCachedResult(true);
      
      const newEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString(),
        errorMessage: errorMessage.substring(0, 40) + (errorMessage.length > 40 ? '...' : ''),
        fullErrorMessage: errorMessage,
        codeSnippet,
        language,
        result: cachedData.parsedResult,
        rawInitialResponse: cachedData.rawResponse
      };
      saveHistory([newEntry, ...history].slice(0, 50));
      return;
    }

    setIsLoading(true);
    setIsCachedResult(false);

    try {
      const responseText = await explainError(errorMessage, codeSnippet, language, explanationStyle);
      const parsed = parseResponse(responseText);
      
      setCachedResult(cacheKey, parsed, responseText);
      
      setResult(parsed);
      setRawInitialResponse(responseText);

      const newEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString(),
        errorMessage: errorMessage.substring(0, 40) + (errorMessage.length > 40 ? '...' : ''),
        fullErrorMessage: errorMessage,
        codeSnippet,
        language,
        result: parsed,
        rawInitialResponse: responseText
      };

      saveHistory([newEntry, ...history].slice(0, 50));
    } catch (err) {
      setApiError(err.message);
    } finally {
      setIsLoading(false);
      setCooldown(5);
    }
  };

  const loadHistoryItem = (item) => {
    setErrorMessage(item.fullErrorMessage || item.errorMessage);
    setCodeSnippet(item.codeSnippet || '');
    setLanguage(item.language || 'Auto-detect');
    setResult(item.result);
    setApiError(null);
    setFollowUpMessages([]);
    setRawInitialResponse(item.rawInitialResponse || '');
    setIsCachedResult(false);
  };

  const clearHistory = () => {
    saveHistory([]);
  };

  const handleFollowUpSubmit = async (e) => {
    e.preventDefault();
    if (!followUpInput.trim() || isFollowUpLoading) return;

    const userMessage = followUpInput.trim();
    setFollowUpInput('');
    setFollowUpMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsFollowUpLoading(true);

    try {
      const { systemPrompt, userPrompt } = generatePrompts(errorMessage, codeSnippet, language, explanationStyle);
      
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
        { role: 'assistant', content: rawInitialResponse },
        ...followUpMessages,
        { role: 'user', content: userMessage }
      ];

      const responseText = await sendFollowUpChat(messages);
      
      setFollowUpMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
    } catch (err) {
      setFollowUpMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setIsFollowUpLoading(false);
    }
  };

  const MarkdownContent = ({ text }) => {
    if (!text) return null;
    return (
      <div className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-[#c9d1d9]">
        {text}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-[#0d1117] text-[#c9d1d9] font-mono">
      {/* Header */}
      <header className="px-4 py-2 border-b border-[#30363d] flex items-center justify-between shrink-0 bg-[#010409]">
        <div className="flex items-center gap-3">
          <button 
            className="text-[#8b949e] hover:text-[#c9d1d9] transition-colors md:hidden" 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Menu size={18} />
          </button>
          <div className="flex flex-col">
            <h1 className="text-sm font-semibold flex items-center gap-2 text-[#c9d1d9]">
              <TerminalSquare size={16} className="text-[#3fb950]" />
              explain-my-error ~/
            </h1>
            <span className="text-[10px] text-[#8b949e] hidden md:block mt-0.5">
              Paste your error, get a plain-English fix — no more Googling stack traces.
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar Overlay (Mobile) */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar (File Tree Style) */}
        <div className={`
          absolute inset-y-0 left-0 z-50 w-64 border-r border-[#30363d] bg-[#0d1117] flex flex-col shrink-0 overflow-y-auto
          transform transition-transform duration-200 ease-in-out md:relative md:transform-none
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 hidden md:flex'}
        `}>
          <div className="px-3 py-2 text-xs font-semibold text-[#8b949e] uppercase tracking-wider flex justify-between items-center bg-[#0d1117]">
            <span>EXPLORER</span>
            <div className="flex items-center gap-2">
              {history.length > 0 && (
                <button onClick={clearHistory} className="hover:text-[#f85149]" title="Clear History">
                  <Trash2 size={14} />
                </button>
              )}
              <button className="md:hidden hover:text-[#c9d1d9]" onClick={() => setIsSidebarOpen(false)}>
                <X size={14} />
              </button>
            </div>
          </div>
          
          <div className="flex-1 px-1">
            {history.length === 0 ? (
              <div className="px-6 py-4 text-[#8b949e] text-[13px]">
                No history found.
              </div>
            ) : (
              history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    loadHistoryItem(item);
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  className="w-full text-left px-2 py-1 flex items-start gap-1.5 hover:bg-[#21262d] rounded-sm transition-colors text-[13px]"
                >
                  <FileCode size={14} className="shrink-0 text-[#8b949e] mt-0.5" />
                  <div className="truncate w-full">
                    <span className="text-[#c9d1d9]">{item.errorMessage}</span>
                    <span className="text-[#8b949e] text-[11px] ml-2 block truncate">{item.timestamp}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main Content (Split Pane) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden w-full">
          
          {/* LEFT PANE: Input */}
          <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r border-[#30363d] overflow-y-auto">
            {/* Language Tabs & Toggle */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#30363d] bg-[#010409]">
              <div className="flex overflow-x-auto">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`px-4 py-2 text-[13px] border-b-2 whitespace-nowrap transition-colors ${
                      language === lang 
                        ? 'border-[#3fb950] text-[#c9d1d9] bg-[#0d1117]' 
                        : 'border-transparent text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 px-4 py-2 md:py-0 border-t md:border-t-0 border-[#30363d] shrink-0">
                <span className="text-[13px] text-[#8b949e] whitespace-nowrap">Explanation Style:</span>
                <div className="flex items-center bg-[#0d1117] rounded border border-[#30363d] overflow-hidden text-[12px]">
                  <button
                    onClick={() => setExplanationStyle('English')}
                    className={`px-3 py-1 ${explanationStyle === 'English' ? 'bg-[#21262d] text-[#c9d1d9]' : 'text-[#8b949e] hover:bg-[#21262d]/50'}`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => setExplanationStyle('Hinglish')}
                    className={`px-3 py-1 border-l border-[#30363d] ${explanationStyle === 'Hinglish' ? 'bg-[#21262d] text-[#c9d1d9]' : 'text-[#8b949e] hover:bg-[#21262d]/50'}`}
                  >
                    Hinglish
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 flex-1 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] text-[#8b949e] flex items-center gap-1.5">
                  <ChevronRight size={14} /> error.log
                </label>
                <textarea
                  className="terminal-input h-40 md:h-64 resize-none text-[13px]"
                  placeholder="Paste your error message here..."
                  value={errorMessage}
                  onChange={(e) => setErrorMessage(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] text-[#8b949e] flex items-center gap-1.5">
                  <ChevronRight size={14} /> snippet.js
                </label>
                <textarea
                  className="terminal-input h-32 md:h-48 resize-none text-[13px]"
                  placeholder="Paste your code (optional)..."
                  value={codeSnippet}
                  onChange={(e) => setCodeSnippet(e.target.value)}
                />
              </div>
            </div>

            <div className="p-4 border-t border-[#30363d] bg-[#010409] flex justify-end">
              <button
                onClick={handleExplain}
                disabled={isLoading || !errorMessage.trim() || cooldown > 0}
                className="btn-terminal flex items-center justify-center gap-2 text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-3 bg-[#3fb950] animate-pulse"></div>
                    Executing...
                  </div>
                ) : cooldown > 0 ? (
                  <>
                    <Terminal size={14} /> Please wait ({cooldown}s)
                  </>
                ) : (
                  <>
                    <Terminal size={14} /> Run Analysis
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT PANE: Output */}
          <div className="flex-1 flex flex-col overflow-y-auto bg-[#010409]">
            <div className="border-b border-[#30363d] bg-[#0d1117] px-4 py-2 text-[13px] text-[#c9d1d9] flex items-center justify-between border-l-2 border-l-[#3fb950]">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-[#8b949e]" /> Output
              </div>
              {isCachedResult && (
                <div className="flex items-center gap-1.5 text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border border-yellow-500/20">
                  <Zap size={12} className="fill-yellow-500" /> Cached result
                </div>
              )}
            </div>

            <div className="p-4 space-y-6">
              {!result && !apiError && !isLoading && (
                <div className="text-[#8b949e] text-[13px] flex items-center gap-2">
                  <span className="text-[#3fb950]">~</span> Waiting for input...
                </div>
              )}

              {isLoading && (
                <div className="text-[#c9d1d9] text-[13px] flex items-center gap-2">
                  <span className="text-[#3fb950]">&gt;</span> Analyzing stack trace...
                  <div className="dot-flashing ml-4"></div>
                </div>
              )}

              {apiError && (
                <div className="border border-[#f85149]/50 bg-[#f85149]/10 p-3 rounded-sm">
                  <div className="text-[#f85149] font-semibold text-[13px] flex items-center gap-2 mb-1">
                    <Bug size={14} /> Exception Thrown
                  </div>
                  <div className="text-red-300 text-[13px]">{apiError}</div>
                </div>
              )}

              {result && (
                <div className="space-y-6">
                  {/* What Went Wrong */}
                  <div className="border-l-2 border-[#f85149] pl-3">
                    <div className="text-[#f85149] font-semibold text-[13px] flex items-center gap-2 mb-2 uppercase tracking-wide">
                      <SearchX size={14} /> What Went Wrong
                    </div>
                    <MarkdownContent text={result.whatWentWrong} />
                  </div>

                  {/* Why This Happens */}
                  <div className="border-l-2 border-[#d29922] pl-3">
                    <div className="text-[#d29922] font-semibold text-[13px] flex items-center gap-2 mb-2 uppercase tracking-wide">
                      <Bug size={14} /> Why This Happens
                    </div>
                    <MarkdownContent text={result.whyThisHappens} />
                  </div>

                  {/* How to Fix It */}
                  <div className="border-l-2 border-[#3fb950] pl-3">
                    <div className="text-[#3fb950] font-semibold text-[13px] flex items-center gap-2 mb-2 uppercase tracking-wide">
                      <CheckSquare size={14} /> How to Fix It
                    </div>
                    <MarkdownContent text={result.howToFixIt} />
                  </div>
                </div>
              )}

              {result && (
                <div className="mt-8 pt-6 border-t border-[#30363d] space-y-4">
                  <div className="text-[13px] text-[#8b949e] flex items-center gap-2">
                    <Terminal size={14} /> Follow-up Chat
                  </div>
                  
                  {/* Chat Messages */}
                  <div className="space-y-4">
                    {followUpMessages.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-md p-3 text-[13px] ${
                          msg.role === 'user' 
                            ? 'bg-[#21262d] border border-[#30363d] text-[#c9d1d9]' 
                            : 'bg-[#0d1117] border-l-2 border-[#3fb950] text-[#c9d1d9]'
                        }`}>
                          {msg.role === 'user' ? (
                            <div className="whitespace-pre-wrap font-mono">{msg.content}</div>
                          ) : (
                            <MarkdownContent text={msg.content} />
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {isFollowUpLoading && (
                      <div className="flex justify-start">
                        <div className="max-w-[85%] rounded-md p-3 text-[13px] bg-[#0d1117] border-l-2 border-[#3fb950] text-[#c9d1d9] flex items-center gap-2">
                          <span className="text-[#3fb950]">&gt;</span> Generating response...
                          <div className="dot-flashing ml-4"></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Chat Input */}
                  <form onSubmit={handleFollowUpSubmit} className="relative mt-4">
                    <input
                      type="text"
                      value={followUpInput}
                      onChange={(e) => setFollowUpInput(e.target.value)}
                      placeholder="Ask a follow-up question about this error..."
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded-md py-2.5 pl-3 pr-10 text-[13px] font-mono text-[#c9d1d9] placeholder-[#8b949e] focus:outline-none focus:border-[#3fb950] focus:ring-1 focus:ring-[#3fb950] transition-colors"
                      disabled={isFollowUpLoading}
                    />
                    <button
                      type="submit"
                      disabled={!followUpInput.trim() || isFollowUpLoading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8b949e] hover:text-[#3fb950] disabled:opacity-50 disabled:hover:text-[#8b949e] p-1 transition-colors"
                    >
                      <Send size={16} />
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}

export default App;
