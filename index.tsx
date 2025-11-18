import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
import Editor from "@monaco-editor/react";

// --- ICONS ---
const Icon = ({ name, className = "w-5 h-5" }: { name: string, className?: string }) => {
    const icons: any = {
        logo: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
        home: <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
        code: <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />,
        zap: <path d="M13 10V3L4 14h7v7l9-11h-7z" />,
        architect: <path d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />,
        play: <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />,
        settings: <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />,
        trash: <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />,
        plus: <path d="M12 4v16m8-8H4" />,
        chevronRight: <path d="M9 5l7 7-7 7" />,
        key: <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11.5 15.75l-2.5 2.5-2.5-2.5-1.5 1.5-1.25-1.25a2 2 0 01-.75-1.5v-1a2 2 0 011-1h1l2.5 2.5 1.75-1.75a6 6 0 010-8.485z" />,
        check: <path d="M5 13l4 4L19 7" />,
        eye: <><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
    };
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
            {icons[name] || icons.home}
        </svg>
    );
};

// --- COMPONENTS ---

// 1. API Key Modal
const ApiKeyModal = ({ onSave }: { onSave: (key: string) => void }) => {
    const [val, setVal] = useState('');
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
            <div className="bg-[#121212] border border-gray-800 p-8 rounded-2xl max-w-md w-full shadow-2xl">
                <div className="flex items-center justify-center w-12 h-12 bg-blue-500/10 rounded-full text-blue-400 mb-6 mx-auto">
                    <Icon name="key" className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-center text-white mb-2">Enter Gemini API Key</h2>
                <p className="text-center text-gray-400 mb-6 text-sm">
                    Vexor runs entirely in your browser. Your key is stored locally and never sent to our servers.
                </p>
                <input 
                    type="password" 
                    className="w-full bg-[#0a0a0a] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none mb-4"
                    placeholder="AIzaSy..."
                    value={val}
                    onChange={e => setVal(e.target.value)}
                />
                <button 
                    onClick={() => val.trim() && onSave(val.trim())}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-lg transition-colors"
                >
                    Start Developing
                </button>
                <div className="mt-4 text-center">
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-xs text-blue-400 hover:underline">
                        Get a free API key here &rarr;
                    </a>
                </div>
            </div>
        </div>
    );
};

// 2. Sparring (Code Editor)
const Sparring = ({ apiKey }: { apiKey: string }) => {
    const [code, setCode] = useState('// Write your code here...');
    const [output, setOutput] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRun = async (action: string) => {
        setLoading(true);
        try {
            const ai = new GoogleGenAI({ apiKey });
            const prompt = action === 'review' 
                ? `Review this code for bugs and security issues:\n${code}`
                : `Refactor this code for better performance:\n${code}`;
            
            const res = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt
            });
            setOutput(res.text || 'No response.');
        } catch (e: any) {
            setOutput(`Error: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-full">
            <div className="w-1/2 border-r border-border flex flex-col">
                <div className="h-12 border-b border-border bg-surface flex items-center justify-between px-4">
                    <span className="text-sm font-medium text-gray-300">Editor</span>
                    <div className="flex gap-2">
                        <button onClick={() => handleRun('review')} disabled={loading} className="text-xs bg-blue-600/20 text-blue-400 px-3 py-1 rounded hover:bg-blue-600/30">Review</button>
                        <button onClick={() => handleRun('refactor')} disabled={loading} className="text-xs bg-purple-600/20 text-purple-400 px-3 py-1 rounded hover:bg-purple-600/30">Refactor</button>
                    </div>
                </div>
                <Editor 
                    height="100%" 
                    defaultLanguage="javascript" 
                    theme="vs-dark" 
                    value={code}
                    onChange={v => setCode(v || '')}
                    options={{ minimap: { enabled: false }, fontSize: 14, padding: { top: 16 } }}
                />
            </div>
            <div className="w-1/2 bg-[#0a0a0a] p-4 overflow-auto font-mono text-sm text-gray-300">
                {loading ? (
                    <div className="flex items-center gap-2 text-blue-400">
                        <span className="animate-spin">⟳</span> Thinking...
                    </div>
                ) : (
                    <pre className="whitespace-pre-wrap">{output || 'AI output will appear here...'}</pre>
                )}
            </div>
        </div>
    );
};

// 3. Architect (System Design)
const Architect = ({ apiKey }: { apiKey: string }) => {
    const [input, setInput] = useState('');
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const generate = async () => {
        if (!input) return;
        setLoading(true);
        try {
            const ai = new GoogleGenAI({ apiKey });
            const res = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Generate a tech stack and system design for: "${input}". Return a JSON object with fields: projectName, stack (array of objects with category, tech, reason), and features (array of strings).`,
                config: { responseMimeType: 'application/json' }
            });
            setResult(JSON.parse(res.text));
        } catch (e) {
            alert('Error generating blueprint');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-full">
            <div className="w-1/3 border-r border-border p-6 flex flex-col bg-surface">
                <h2 className="text-lg font-bold mb-4">System Architect</h2>
                <textarea 
                    className="flex-1 bg-background border border-border rounded-lg p-4 mb-4 resize-none focus:outline-none focus:border-blue-500"
                    placeholder="Describe your app idea..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                />
                <button 
                    onClick={generate}
                    disabled={loading}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium"
                >
                    {loading ? 'Designing...' : 'Generate Blueprint'}
                </button>
            </div>
            <div className="flex-1 p-8 overflow-auto bg-background">
                {result ? (
                    <div className="max-w-3xl mx-auto space-y-8">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">{result.projectName}</h1>
                            <div className="h-1 w-20 bg-blue-500 rounded"></div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            {result.stack?.map((s: any, i: number) => (
                                <div key={i} className="bg-surface border border-border p-4 rounded-lg">
                                    <div className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-1">{s.category}</div>
                                    <div className="text-lg font-medium text-white mb-1">{s.tech}</div>
                                    <div className="text-xs text-gray-500">{s.reason}</div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-surface border border-border rounded-lg p-6">
                            <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Key Features</h3>
                            <ul className="space-y-2">
                                {result.features?.map((f: string, i: number) => (
                                    <li key={i} className="flex items-center gap-2 text-gray-300">
                                        <Icon name="check" className="w-4 h-4 text-green-500" /> {f}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                        <Icon name="architect" className="w-16 h-16 opacity-20 mb-4" />
                        <p>Enter an idea to generate a system design.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// 4. Studio (Chat)
const Studio = ({ apiKey }: { apiKey: string }) => {
    const [msgs, setMsgs] = useState<{role: string, text: string}[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    const send = async () => {
        if (!input) return;
        const newMsgs = [...msgs, { role: 'user', text: input }];
        setMsgs(newMsgs);
        setInput('');
        setLoading(true);
        
        try {
            const ai = new GoogleGenAI({ apiKey });
            const chat = ai.chats.create({ model: 'gemini-2.5-flash', history: msgs.map(m => ({ role: m.role, parts: [{ text: m.text }] })) });
            const res = await chat.sendMessage({ message: input });
            setMsgs([...newMsgs, { role: 'model', text: res.text }]);
        } catch (e) {
            setMsgs([...newMsgs, { role: 'model', text: 'Error generating response.' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto">
            <div className="flex-1 overflow-auto p-6 space-y-6">
                {msgs.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-4 rounded-xl text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-surface border border-border text-gray-300'}`}>
                            {m.text}
                        </div>
                    </div>
                ))}
                {loading && <div className="text-gray-500 text-xs animate-pulse">AI is typing...</div>}
            </div>
            <div className="p-4 border-t border-border bg-surface">
                <div className="flex gap-2">
                    <input 
                        className="flex-1 bg-background border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                        placeholder="Type a message..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && send()}
                    />
                    <button onClick={send} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500">
                        <Icon name="zap" className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

// 5. App Shell
const App = () => {
    const [apiKey, setApiKey] = useState(localStorage.getItem('vexor_api_key') || '');
    const [view, setView] = useState('home');

    const handleKeySave = (key: string) => {
        localStorage.setItem('vexor_api_key', key);
        setApiKey(key);
    };

    if (!apiKey) return <ApiKeyModal onSave={handleKeySave} />;

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-background text-gray-200 font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-surface border-r border-border flex flex-col flex-shrink-0">
                <div className="h-16 flex items-center px-6 border-b border-border gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white">V</div>
                    <span className="font-bold tracking-tight">Vexor.AI</span>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {[
                        { id: 'home', label: 'Overview', icon: 'home' },
                        { id: 'sparring', label: 'Code Sparring', icon: 'code' },
                        { id: 'studio', label: 'Studio Chat', icon: 'zap' },
                        { id: 'architect', label: 'Architect', icon: 'architect' },
                    ].map(item => (
                        <button 
                            key={item.id}
                            onClick={() => setView(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${view === item.id ? 'bg-blue-600/10 text-blue-400' : 'text-gray-500 hover:text-gray-200 hover:bg-[#1a1a1a]'}`}
                        >
                            <Icon name={item.icon} />
                            {item.label}
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t border-border">
                    <div className="text-xs text-gray-600 text-center">v2.0.0 &bull; Firebase Native</div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-hidden relative">
                {view === 'home' && (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                        <div className="w-24 h-24 bg-blue-600/10 rounded-full flex items-center justify-center mb-8">
                            <Icon name="zap" className="w-12 h-12 text-blue-500" />
                        </div>
                        <h1 className="text-4xl font-bold text-white mb-4">Welcome to Vexor</h1>
                        <p className="text-gray-400 max-w-md mb-8">
                            Your intelligent development companion. Select a tool from the sidebar to begin sparring with code, designing systems, or exploring models.
                        </p>
                        <div className="flex gap-4">
                            <button onClick={() => setView('sparring')} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium">Start Coding</button>
                            <button onClick={() => setView('architect')} className="px-6 py-3 bg-surface border border-border hover:border-gray-600 rounded-lg font-medium">Design System</button>
                        </div>
                    </div>
                )}
                {view === 'sparring' && <Sparring apiKey={apiKey} />}
                {view === 'architect' && <Architect apiKey={apiKey} />}
                {view === 'studio' && <Studio apiKey={apiKey} />}
            </main>
        </div>
    );
};

// Mount the app
const root = createRoot(document.getElementById('root')!);
root.render(<App />);