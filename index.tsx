import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import Editor, { useMonaco } from "@monaco-editor/react";

/* --- CONFIGURATION & CONSTANTS --- */
const MODELS = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Fast and versatile' },
    { id: 'gemini-2.5-flash-lite-preview', name: 'Gemini 2.5 Flash-Lite', desc: 'Cost effective' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro', desc: 'Complex reasoning' },
];

const PERSONALITIES = [
    { id: 'engineer', name: 'Engineer', system: 'You are a pragmatic Senior Software Engineer. Focus on clean, efficient, and maintainable code.' },
    { id: 'reviewer', name: 'Reviewer', system: 'You are a strict Code Reviewer. Focus on best practices, potential bugs, security issues, and performance.' },
    { id: 'hacker', name: 'Hacker', system: 'You are a Security Researcher. Look for vulnerabilities and suggest exploits or patches.' },
    { id: 'poet', name: 'Poet', system: 'You are a Code Poet. Write elegant, readable code and explain it using metaphors and rhymes where appropriate.' },
];

/* --- API INITIALIZATION HELPER --- */
// We wrap this to allow dynamic key setting for hosted demos
let ai: GoogleGenAI | null = null;

const getAI = () => {
    if (ai) return ai;
    // Check environment or local storage
    const key = process.env.API_KEY || localStorage.getItem('vexor_api_key');
    if (key) {
        try {
            ai = new GoogleGenAI({ apiKey: key });
        } catch (e) {
            console.error("Invalid API Key initialization");
        }
    }
    return ai;
};

/* --- TYPES --- */
type Message = {
    role: 'user' | 'model';
    text: string;
    error?: boolean;
};

type RunSettings = {
    model: string;
    temperature: number;
    topP: number;
    topK: number;
    maxOutputTokens: number;
    systemInstruction: string;
};

type ProjectData = {
    sparring: {
        code: string;
        output: string;
        personalityId: string;
    };
    studio: {
        messages: Message[];
        input: string;
        settings: RunSettings;
    };
    architect: {
        input: string;
        result: any;
    };
};

type Project = {
    id: string;
    name: string;
    lastModified: number;
    data: ProjectData;
};

type ViewMode = 'home' | 'sparring' | 'studio' | 'architect';

/* --- DEFAULTS --- */
const DEFAULT_SETTINGS: RunSettings = {
    model: 'gemini-2.5-flash', temperature: 1.0, topP: 0.95, topK: 64, maxOutputTokens: 8192, systemInstruction: ''
};

const DEFAULT_PROJECT_DATA: ProjectData = {
    sparring: { code: '// Start coding...', output: '', personalityId: 'engineer' },
    studio: { messages: [], input: '', settings: DEFAULT_SETTINGS },
    architect: { input: '', result: null }
};

/* --- ICONS --- */
const Icon = ({ name, className = "w-5 h-5" }: { name: string, className?: string }) => {
    const icons: Record<string, React.ReactNode> = {
        home: <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
        plus: <path d="M12 4v16m8-8H4" />,
        chat: <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />,
        save: <path d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />,
        settings: <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />,
        play: <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />,
        code: <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />,
        image: <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />,
        trash: <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />,
        chevronDown: <path d="M19 9l-7 7-7-7" />,
        info: <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
        mic: <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />,
        copy: <path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />,
        architect: <path d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />,
        eye: <><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>,
        file: <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
        folder: <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />,
        zap: <path d="M13 10V3L4 14h7v7l9-11h-7z" />,
        arrowRight: <path d="M14 5l7 7m0 0l-7 7m7-7H3" />,
        swords: <path d="M14.5 17.5L3 6V3h3l11.5 11.5m-5 0L21 21v-3l-2.5-2.5m-9-9L6 3H3v3l3.5 3.5" />, 
        playCircle: <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />,
        clock: <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
        key: <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11.5 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    };

    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
            {icons[name] || icons.chat}
        </svg>
    );
};

/* --- COMPONENTS --- */

const ApiKeyModal = ({ isOpen, onSave }: { isOpen: boolean, onSave: (key: string) => void }) => {
    const [key, setKey] = useState('');
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-[#1e1e1e] border border-[#333] p-8 rounded-2xl w-[500px] shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-500">
                        <Icon name="key" className="w-5 h-5" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Enter Gemini API Key</h2>
                </div>
                <p className="text-gray-400 mb-6 text-sm leading-relaxed">
                    To use Vexor.AI, you need a Google Gemini API Key. Your key is stored locally in your browser and never sent to our servers.
                </p>
                <input 
                    type="password" 
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="Paste your API Key here (starts with AIza...)"
                    className="w-full bg-[#131314] border border-[#333] p-4 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono text-sm mb-6"
                />
                <div className="flex justify-end gap-4">
                    <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noreferrer"
                        className="px-4 py-3 text-blue-400 hover:text-blue-300 text-sm font-medium flex items-center"
                    >
                        Get a Key &rarr;
                    </a>
                    <button 
                        onClick={() => onSave(key)} 
                        disabled={!key}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors"
                    >
                        Save & Continue
                    </button>
                </div>
            </div>
        </div>
    );
};

const FileTreeNode = ({ name, content }: { name: string, content: any }) => {
    const [isOpen, setIsOpen] = useState(true);
    const isFolder = typeof content === 'object';

    return (
        <div className="ml-4">
            <div 
                className="flex items-center gap-2 py-1 cursor-pointer hover:text-blue-400 transition-colors select-none"
                onClick={() => isFolder && setIsOpen(!isOpen)}
            >
                <Icon name={isFolder ? "folder" : "file"} className={`w-4 h-4 ${isFolder ? 'text-yellow-500' : 'text-blue-400'}`} />
                <span className="text-sm text-gray-300">{name}</span>
            </div>
            {isFolder && isOpen && (
                <div className="border-l border-gray-700 ml-2">
                    {Object.entries(content).map(([key, val]) => (
                        <FileTreeNode key={key} name={key} content={val} />
                    ))}
                </div>
            )}
        </div>
    );
};

const ScrollyTelling = () => {
    const [activeStep, setActiveStep] = useState(0);
    const steps = [
        {
            id: 'concept',
            title: 'The Spark',
            desc: "It starts with an idea. You don't need a full spec, just a thought. Vexor's Architect mode turns your rough concept into a structured blueprint, tech stack, and database schema in seconds.",
            visual: (
                <div className="bg-[#1a1a1a] p-6 rounded-xl border border-green-500/30 shadow-2xl shadow-green-900/20 w-full max-w-md">
                    <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-3">
                        <div className="w-8 h-8 rounded bg-green-500/20 flex items-center justify-center text-green-400">
                            <Icon name="architect" className="w-5 h-5" />
                        </div>
                        <div className="text-green-400 font-mono text-sm">Architect Mode</div>
                    </div>
                    <div className="space-y-2">
                        <div className="h-2 w-3/4 bg-gray-700 rounded animate-pulse"></div>
                        <div className="h-2 w-1/2 bg-gray-700 rounded animate-pulse"></div>
                        <div className="mt-4 p-3 bg-black/30 rounded border border-gray-700">
                            <div className="text-xs text-gray-400 font-mono">Generating Stack...</div>
                            <div className="mt-2 flex gap-2">
                                <span className="px-2 py-1 bg-blue-900/30 text-blue-400 text-xs rounded">React</span>
                                <span className="px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded">Node</span>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'code',
            title: 'The Build',
            desc: "Writing code is a battle. Vexor is your sparring partner. Switch personalities—ask 'The Hacker' to find vulnerabilities or 'The Reviewer' to optimize your logic. It's not just autocomplete; it's collaborative intelligence.",
            visual: (
                <div className="bg-[#1a1a1a] p-6 rounded-xl border border-blue-500/30 shadow-2xl shadow-blue-900/20 w-full max-w-md">
                     <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-3">
                        <div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center text-blue-400">
                            <Icon name="swords" className="w-5 h-5" />
                        </div>
                        <div className="text-blue-400 font-mono text-sm">Sparring Mode</div>
                    </div>
                    <div className="font-mono text-xs text-gray-300 space-y-1">
                        <div className="text-purple-400">function <span className="text-blue-300">optimize</span>() {'{'}</div>
                        <div className="pl-4 text-gray-500">// analyzing complexity...</div>
                        <div className="pl-4 text-green-400">return "O(n log n)";</div>
                        <div className="text-purple-400">{'}'}</div>
                    </div>
                    <div className="mt-4 flex gap-2">
                        <div className="text-[10px] bg-red-900/30 text-red-400 px-2 py-1 rounded border border-red-900/50">Bug Detected</div>
                         <div className="text-[10px] bg-blue-900/30 text-blue-400 px-2 py-1 rounded border border-blue-900/50">Refactored</div>
                    </div>
                </div>
            )
        },
        {
            id: 'refine',
            title: 'The Mastery',
            desc: "Refine your prompts and models in the Studio. Adjust temperature, tokens, and system instructions to create the perfect AI behavior for your specific needs.",
            visual: (
                <div className="bg-[#1a1a1a] p-6 rounded-xl border border-purple-500/30 shadow-2xl shadow-purple-900/20 w-full max-w-md">
                     <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-3">
                        <div className="w-8 h-8 rounded bg-purple-500/20 flex items-center justify-center text-purple-400">
                            <Icon name="zap" className="w-5 h-5" />
                        </div>
                        <div className="text-purple-400 font-mono text-sm">Studio Mode</div>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Temperature</span>
                            <div className="w-20 h-1 bg-gray-700 rounded overflow-hidden">
                                <div className="h-full bg-purple-500 w-[70%]"></div>
                            </div>
                        </div>
                         <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Top K</span>
                             <div className="w-20 h-1 bg-gray-700 rounded overflow-hidden">
                                <div className="h-full bg-purple-500 w-[40%]"></div>
                            </div>
                        </div>
                        <div className="p-2 bg-black/50 rounded text-[10px] text-gray-400 font-mono border border-gray-800">
                            "System: You are a helpful assistant..."
                        </div>
                    </div>
                </div>
            )
        }
    ];

    useEffect(() => {
        const handleScroll = () => {
            const scrollPosition = window.scrollY + window.innerHeight / 3;
            
            // Find which step section is currently in view
            steps.forEach((step, index) => {
                const element = document.getElementById(`step-${index}`);
                if (element) {
                    const { offsetTop, offsetHeight } = element;
                    if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
                        setActiveStep(index);
                    }
                }
            });
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <section className="py-20 bg-[#0a0a0a] relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row">
                {/* Left Side: Scrolling Text */}
                <div className="md:w-1/2 py-10">
                    {steps.map((step, index) => (
                        <div 
                            key={index} 
                            id={`step-${index}`} 
                            className={`min-h-screen flex flex-col justify-center p-6 transition-opacity duration-500 ${activeStep === index ? 'opacity-100' : 'opacity-30'}`}
                        >
                            <h3 className="text-4xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-500">
                                {step.title}
                            </h3>
                            <p className="text-xl text-gray-400 leading-relaxed">
                                {step.desc}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Right Side: Sticky Visuals */}
                <div className="hidden md:block md:w-1/2 sticky top-0 h-screen">
                    <div className="h-full flex items-center justify-center relative">
                        {/* Background Glow */}
                        <div className={`absolute w-[300px] h-[300px] blur-[100px] rounded-full transition-colors duration-700 opacity-20 
                            ${activeStep === 0 ? 'bg-green-500' : activeStep === 1 ? 'bg-blue-500' : 'bg-purple-500'}`} 
                        />
                        
                        {/* Cards with Transition */}
                        <div className="relative z-10 transform transition-all duration-700 ease-out">
                             {steps.map((step, index) => (
                                <div 
                                    key={index} 
                                    className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-700 transform ${
                                        activeStep === index 
                                            ? 'opacity-100 scale-100 translate-y-0' 
                                            : activeStep > index 
                                                ? 'opacity-0 scale-90 -translate-y-10' 
                                                : 'opacity-0 scale-110 translate-y-10'
                                    }`}
                                >
                                    {step.visual}
                                </div>
                             ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

/* --- VIEWS --- */

// 0. DASHBOARD HOME (Overview)
const DashboardHome = ({ onViewChange, projects, onSelectProject, onCreateProject }: { onViewChange: (view: ViewMode) => void, projects: Project[], onSelectProject: (id: string) => void, onCreateProject: () => void }) => {
    return (
        <div className="flex-1 bg-[#131314] overflow-y-auto p-8 text-gray-200">
            <div className="max-w-5xl mx-auto space-y-12">
                {/* Welcome Section */}
                <div className="flex justify-between items-end">
                    <div className="space-y-2">
                        <h1 className="text-3xl font-light text-white">
                            Welcome to <span className="font-bold text-blue-500">Vexor.AI</span>
                        </h1>
                        <p className="text-gray-400">Select a tool to begin your development session.</p>
                    </div>
                    <button onClick={onCreateProject} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                        <Icon name="plus" className="w-4 h-4" /> New Project
                    </button>
                </div>

                {/* Recent Projects Section */}
                {projects.length > 0 && (
                    <div>
                        <h4 className="text-sm font-bold text-gray-500 uppercase mb-4 tracking-wider">Recent Projects</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {projects.sort((a,b) => b.lastModified - a.lastModified).slice(0, 3).map(p => (
                                <div 
                                    key={p.id}
                                    onClick={() => onSelectProject(p.id)}
                                    className="bg-[#1e1e1e] border border-[#333] rounded-lg p-4 cursor-pointer hover:border-blue-500/30 transition-all group"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="w-10 h-10 rounded bg-gray-800 flex items-center justify-center text-gray-400 group-hover:text-white group-hover:bg-gray-700 transition-colors">
                                            <Icon name="folder" />
                                        </div>
                                        <span className="text-xs text-gray-500">{new Date(p.lastModified).toLocaleDateString()}</span>
                                    </div>
                                    <h3 className="font-medium text-white group-hover:text-blue-400 transition-colors">{p.name}</h3>
                                    <p className="text-xs text-gray-500 mt-1">Last edited just now</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tools Grid */}
                <div>
                    <h4 className="text-sm font-bold text-gray-500 uppercase mb-4 tracking-wider">Tools</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div 
                            onClick={() => onViewChange('sparring')}
                            className="group relative bg-[#1e1e1e] border border-[#333] rounded-xl p-6 cursor-pointer hover:border-blue-500/50 hover:bg-[#252526] transition-all duration-300"
                        >
                            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-900/30 to-blue-600/10 flex items-center justify-center mb-4 text-blue-400 group-hover:scale-110 transition-transform">
                                <Icon name="swords" className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">Code Sparring</h3>
                            <p className="text-sm text-gray-500">Interactive code review, refactoring, and unit test generation with multiple AI personalities.</p>
                            <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400">
                                <Icon name="arrowRight" />
                            </div>
                        </div>

                        <div 
                            onClick={() => onViewChange('studio')}
                            className="group relative bg-[#1e1e1e] border border-[#333] rounded-xl p-6 cursor-pointer hover:border-purple-500/50 hover:bg-[#252526] transition-all duration-300"
                        >
                            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-900/30 to-purple-600/10 flex items-center justify-center mb-4 text-purple-400 group-hover:scale-110 transition-transform">
                                <Icon name="zap" className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">Studio IDE</h3>
                            <p className="text-sm text-gray-500">Advanced prompt engineering environment with model configuration and history.</p>
                            <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity text-purple-400">
                                <Icon name="arrowRight" />
                            </div>
                        </div>

                        <div 
                            onClick={() => onViewChange('architect')}
                            className="group relative bg-[#1e1e1e] border border-[#333] rounded-xl p-6 cursor-pointer hover:border-green-500/50 hover:bg-[#252526] transition-all duration-300"
                        >
                            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-900/30 to-green-600/10 flex items-center justify-center mb-4 text-green-400 group-hover:scale-110 transition-transform">
                                <Icon name="architect" className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">Architect</h3>
                            <p className="text-sm text-gray-500">Design complex systems, generate tech stacks, and visualize project structures.</p>
                            <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity text-green-400">
                                <Icon name="arrowRight" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// 1. SPARRING VIEW (Code Focused)
const SparringView = ({ data, onUpdate }: { data: ProjectData['sparring'], onUpdate: (d: ProjectData['sparring']) => void }) => {
    const [code, setCode] = useState(data.code);
    const [output, setOutput] = useState(data.output);
    const [loading, setLoading] = useState(false);
    const [personality, setPersonality] = useState(PERSONALITIES.find(p => p.id === data.personalityId) || PERSONALITIES[0]);

    // Sync local state when props change (e.g. project switch)
    useEffect(() => {
        setCode(data.code);
        setOutput(data.output);
        setPersonality(PERSONALITIES.find(p => p.id === data.personalityId) || PERSONALITIES[0]);
    }, [data]);

    // Debounced save
    useEffect(() => {
        const timer = setTimeout(() => {
            if (code !== data.code || output !== data.output || personality.id !== data.personalityId) {
                onUpdate({ code, output, personalityId: personality.id });
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [code, output, personality, onUpdate, data]);

    const handleAction = async (action: 'refactor' | 'review' | 'test' | 'explain') => {
        setLoading(true);
        const ai = getAI();
        if (!ai) {
            setOutput("Error: API Key missing. Please reload to enter key.");
            setLoading(false);
            return;
        }
        try {
            let prompt = "";
            const persona = personality.system;

            if (action === 'refactor') prompt = `${persona}\nRefactor this code for better performance and readability:\n${code}`;
            if (action === 'review') prompt = `${persona}\nReview this code. List potential bugs, improvements, and security risks:\n${code}`;
            if (action === 'test') prompt = `${persona}\nGenerate comprehensive unit tests for this code using a modern testing framework:\n${code}`;
            if (action === 'explain') prompt = `${persona}\nExplain this code step-by-step in simple terms:\n${code}`;

            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            const text = result.text || 'No response generated.';
            setOutput(text);
        } catch (e: any) {
            setOutput(`Error: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex h-full bg-[#131314] overflow-hidden">
            {/* Editor Panel */}
            <div className="w-1/2 flex flex-col border-r border-[#333]">
                <div className="h-14 border-b border-[#333] flex justify-between items-center px-4 bg-[#1e1e1e]">
                    <div className="flex items-center gap-2">
                        <Icon name="code" className="text-blue-400" />
                        <span className="font-medium text-gray-200">Code Input</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <select 
                            value={personality.id}
                            onChange={(e) => setPersonality(PERSONALITIES.find(p => p.id === e.target.value) || PERSONALITIES[0])}
                            className="bg-[#2b2d31] text-xs text-gray-300 border border-[#444] rounded px-2 py-1 focus:outline-none"
                        >
                            {PERSONALITIES.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="flex-1 relative">
                    <Editor 
                        height="100%" 
                        defaultLanguage="javascript" 
                        theme="vs-dark" 
                        value={code}
                        onChange={(val) => setCode(val || '')}
                        options={{ minimap: { enabled: false }, fontSize: 14 }}
                    />
                </div>
                <div className="h-16 border-t border-[#333] bg-[#1e1e1e] flex items-center justify-around px-4 gap-2">
                    {[
                        { id: 'refactor', label: 'Refactor', icon: 'zap' },
                        { id: 'review', label: 'Review', icon: 'eye' },
                        { id: 'test', label: 'Gen Tests', icon: 'code' },
                        { id: 'explain', label: 'Explain', icon: 'chat' }
                    ].map((action: any) => (
                        <button 
                            key={action.id}
                            onClick={() => handleAction(action.id)}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-[#2b2d31] hover:bg-[#35373c] text-gray-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icon name={action.icon} className="w-4 h-4" />}
                            {action.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Output Panel */}
            <div className="w-1/2 flex flex-col bg-[#0d0d0d]">
                <div className="h-14 border-b border-[#333] flex justify-between items-center px-4 bg-[#1e1e1e]">
                     <span className="font-medium text-gray-200">Vexor Feedback</span>
                     <button onClick={() => navigator.clipboard.writeText(output)} className="text-gray-400 hover:text-white" title="Copy">
                        <Icon name="copy" />
                     </button>
                </div>
                <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
                            <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                            <p className="animate-pulse text-sm">{personality.name} is thinking...</p>
                        </div>
                    ) : output ? (
                         <pre className="whitespace-pre-wrap text-sm text-gray-300 font-mono">{output}</pre>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-600">
                            <Icon name="swords" className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-sm">Ready to spar. Run an action to see results.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// 2. ARCHITECT VIEW (System Design)
const ArchitectView = ({ data, onUpdate }: { data: ProjectData['architect'], onUpdate: (d: ProjectData['architect']) => void }) => {
    const [input, setInput] = useState(data.input);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(data.result);

    // Sync local state
    useEffect(() => {
        setInput(data.input);
        setResult(data.result);
    }, [data]);

    // Debounced save
    useEffect(() => {
        const timer = setTimeout(() => {
             if (input !== data.input || result !== data.result) {
                onUpdate({ input, result });
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [input, result, onUpdate, data]);

    const generateArchitecture = async () => {
        if (!input.trim()) return;
        setLoading(true);
        const ai = getAI();
        if (!ai) {
            alert("API Key missing.");
            setLoading(false);
            return;
        }
        try {
            const prompt = `You are a Senior Software Architect.
            Based on the user's idea: "${input}", generate a comprehensive architecture.
            
            Return strictly a JSON object with this structure:
            {
                "projectName": "Name",
                "tagline": "Short description",
                "stack": [
                    {"category": "Frontend", "tech": "React", "reason": "Why..."},
                    {"category": "Backend", "tech": "Node", "reason": "Why..."},
                    {"category": "Database", "tech": "Postgres", "reason": "Why..."}
                ],
                "structure": { "src": { "app.ts": "file" } },
                "features": ["feature1", "feature2"]
            }`;

            const res = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json'
                }
            });
            const text = res.text || '';
            if(text) setResult(JSON.parse(text));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-[#131314] overflow-hidden">
            <div className="h-14 border-b border-[#333] flex items-center px-6 bg-[#1e1e1e]">
                <h1 className="font-medium text-gray-200">System Architect</h1>
            </div>
            <div className="flex-1 flex overflow-hidden">
                <div className="w-1/3 border-r border-[#333] p-6 flex flex-col bg-[#131314]">
                    <textarea 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Describe your app idea (e.g., 'Uber for dog walkers')..."
                        className="flex-1 bg-[#1e1e1e] border border-[#333] rounded-lg p-4 text-gray-200 resize-none focus:outline-none focus:border-blue-500 transition-colors mb-4"
                    />
                    <button 
                        onClick={generateArchitecture}
                        disabled={loading || !input}
                        className={`w-full py-3 rounded-lg font-medium transition-all ${loading ? 'bg-gray-700' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                    >
                        {loading ? 'Blueprint Generating...' : 'Generate Blueprint'}
                    </button>
                </div>
                <div className="flex-1 bg-[#0d0d0d] overflow-y-auto custom-scrollbar p-8">
                    {result ? (
                        <div className="max-w-4xl mx-auto space-y-8">
                             <div className="text-center">
                                <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">{result.projectName}</h2>
                                <p className="text-gray-400 mt-2">{result.tagline}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {result.stack.map((s: any, i: number) => (
                                    <div key={i} className="bg-[#1e1e1e] p-4 rounded border border-[#333]">
                                        <div className="text-xs text-blue-400 font-bold">{s.category}</div>
                                        <div className="text-lg font-medium text-gray-200">{s.tech}</div>
                                        <div className="text-xs text-gray-500 mt-1">{s.reason}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="bg-[#1e1e1e] p-6 rounded border border-[#333]">
                                <h3 className="text-sm font-bold text-gray-500 uppercase mb-4">File Structure</h3>
                                <FileTreeNode name={result.projectName} content={result.structure} />
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-500 flex-col">
                            <Icon name="architect" className="w-12 h-12 mb-4 opacity-20" />
                            <p>Define your idea to generate a tech stack and structure.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// 3. STUDIO VIEW (Chat / IDE)
const StudioView = ({ data, onUpdate }: { data: ProjectData['studio'], onUpdate: (d: ProjectData['studio']) => void }) => {
    const [messages, setMessages] = useState<Message[]>(data.messages);
    const [input, setInput] = useState(data.input);
    const [settings, setSettings] = useState<RunSettings>(data.settings);
    const [loading, setLoading] = useState(false);

    // Sync local state
    useEffect(() => {
        setMessages(data.messages);
        setInput(data.input);
        setSettings(data.settings);
    }, [data]);

    // Debounced save
    useEffect(() => {
        const timer = setTimeout(() => {
            if (input !== data.input || messages !== data.messages || settings !== data.settings) {
                onUpdate({ messages, input, settings });
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [messages, input, settings, onUpdate, data]);

    const handleRun = async () => {
        if (!input.trim() && messages.length === 0) return;
        const newMsgs = [...messages];
        if (input) newMsgs.push({ role: 'user', text: input });
        setMessages(newMsgs);
        setInput('');
        setLoading(true);
        
        const ai = getAI();
        if (!ai) {
            setMessages([...newMsgs, { role: 'model', text: 'API Key Missing. Please reload.', error: true }]);
            setLoading(false);
            return;
        }

        try {
            const chat = ai.chats.create({
                model: settings.model,
                config: { temperature: settings.temperature, systemInstruction: settings.systemInstruction },
                history: messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }))
            });
            const result = await chat.sendMessage({ message: input });
            const updatedMsgs = [...newMsgs, { role: 'model', text: result.text || '' } as Message];
            setMessages(updatedMsgs);
            // Immediate update for chat flow
            onUpdate({ messages: updatedMsgs, input: '', settings });
        } catch (e) {
            setMessages([...newMsgs, { role: 'model', text: 'Error.', error: true }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-full">
            <div className="flex-1 flex flex-col bg-[#131314] min-w-0">
                <div className="h-14 border-b border-[#333] flex justify-between items-center px-6 bg-[#1e1e1e]">
                    <h1 className="font-medium text-gray-200">Studio IDE</h1>
                    <button onClick={handleRun} disabled={loading} className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-sm font-medium">
                        {loading ? 'Running...' : <> <Icon name="play" className="w-4 h-4" /> Run </>}
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
                     <div className="mb-4">
                        <label className="text-xs font-bold text-gray-500 uppercase">System Instructions</label>
                        <textarea 
                            value={settings.systemInstruction}
                            onChange={e => setSettings({...settings, systemInstruction: e.target.value})}
                            placeholder="Define model behavior..."
                            className="w-full mt-2 bg-[#1e1e1e] border border-[#333] rounded p-3 text-sm text-gray-300 focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                    {messages.map((m, i) => (
                        <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-3 rounded-lg text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-[#2b2d31] text-white' : 'text-gray-300'}`}>
                                {m.text}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-6 pt-0">
                    <div className="bg-[#1e1e1e] border border-[#333] rounded-xl flex items-center p-2">
                        <textarea 
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && handleRun()}
                            placeholder="Type a prompt..."
                            className="flex-1 bg-transparent text-gray-200 p-2 focus:outline-none resize-none text-sm"
                            rows={1}
                        />
                    </div>
                </div>
            </div>
            {/* Right Settings Panel */}
            <div className="w-[280px] bg-[#1e1e1e] border-l border-[#333] p-4 flex flex-col gap-6 overflow-y-auto">
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Model</label>
                    <select 
                        value={settings.model}
                        onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                        className="w-full mt-2 bg-[#2b2d31] border border-[#444] rounded p-2 text-sm text-gray-200"
                    >
                        {MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Temperature: {settings.temperature}</label>
                    <input type="range" min="0" max="2" step="0.1" value={settings.temperature} onChange={e => setSettings({...settings, temperature: parseFloat(e.target.value)})} className="w-full mt-2 h-1 bg-[#444] rounded-lg appearance-none cursor-pointer accent-blue-500"/>
                </div>
            </div>
        </div>
    );
};

/* --- DASHBOARD LAYOUT --- */
const Dashboard = ({ onBack }: { onBack: () => void }) => {
    const [view, setView] = useState<ViewMode>('home');
    const [projects, setProjects] = useState<Project[]>([]);
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
    const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');

    // Load Projects on Mount
    useEffect(() => {
        const saved = localStorage.getItem('vexor_projects');
        if (saved) {
            const parsed = JSON.parse(saved);
            setProjects(parsed);
            // Default to most recently modified
            if (parsed.length > 0) {
                const mostRecent = parsed.sort((a: Project, b: Project) => b.lastModified - a.lastModified)[0];
                setCurrentProjectId(mostRecent.id);
            }
        }
    }, []);

    // Persist Projects whenever they change
    useEffect(() => {
        if (projects.length > 0) {
            localStorage.setItem('vexor_projects', JSON.stringify(projects));
        }
    }, [projects]);

    const handleCreateProject = () => {
        if (!newProjectName.trim()) return;
        const newProject: Project = {
            id: Date.now().toString(),
            name: newProjectName,
            lastModified: Date.now(),
            data: JSON.parse(JSON.stringify(DEFAULT_PROJECT_DATA)) // Deep copy default state
        };
        const updated = [...projects, newProject];
        setProjects(updated);
        setCurrentProjectId(newProject.id);
        setIsNewProjectModalOpen(false);
        setNewProjectName('');
        setView('sparring'); // Go straight to coding
    };

    const updateCurrentProject = (section: keyof ProjectData, data: any) => {
        if (!currentProjectId) return;
        setProjects(prev => prev.map(p => {
            if (p.id === currentProjectId) {
                return {
                    ...p,
                    lastModified: Date.now(),
                    data: {
                        ...p.data,
                        [section]: data
                    }
                };
            }
            return p;
        }));
    };

    const currentProject = projects.find(p => p.id === currentProjectId);
    const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);

    return (
        <div className="flex h-screen bg-[#131314] text-[#e3e3e3] font-sans">
            {/* Sidebar */}
            <div className="w-[60px] lg:w-[240px] bg-[#1e1e1e] border-r border-[#333] flex flex-col flex-shrink-0 transition-all duration-300 relative z-20">
                {/* Header & Project Selector */}
                <div className="h-16 flex items-center px-6 border-b border-[#333]">
                    <div 
                        className="flex items-center gap-3 cursor-pointer w-full hover:opacity-80 transition-opacity"
                        onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
                    >
                         <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/30">
                            <span className="font-bold text-white text-sm">V</span>
                        </div>
                        <div className="hidden lg:block overflow-hidden">
                            <div className="font-bold text-white text-sm truncate">
                                {currentProject ? currentProject.name : 'Vexor.AI'}
                            </div>
                            <div className="text-[10px] text-gray-500 flex items-center gap-1">
                                {currentProject ? 'Switch Project' : 'Select Project'} <Icon name="chevronDown" className="w-3 h-3" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Project Dropdown Menu */}
                {isProjectMenuOpen && (
                    <div className="absolute top-16 left-0 w-64 bg-[#252526] border border-[#444] shadow-xl z-50 rounded-br-xl p-2">
                        <button 
                            onClick={() => { setIsNewProjectModalOpen(true); setIsProjectMenuOpen(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-blue-400 hover:bg-[#2b2d31] rounded text-sm font-medium"
                        >
                            <Icon name="plus" className="w-4 h-4" /> New Project
                        </button>
                        <div className="h-px bg-[#333] my-2"></div>
                        <div className="max-h-48 overflow-y-auto custom-scrollbar">
                            {projects.sort((a,b) => b.lastModified - a.lastModified).map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => { setCurrentProjectId(p.id); setIsProjectMenuOpen(false); }}
                                    className={`w-full text-left px-3 py-2 text-sm rounded truncate ${currentProjectId === p.id ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-[#2b2d31] hover:text-gray-200'}`}
                                >
                                    {p.name}
                                </button>
                            ))}
                            {projects.length === 0 && <div className="px-3 py-2 text-xs text-gray-500">No projects yet.</div>}
                        </div>
                    </div>
                )}

                <div className="flex-1 py-6 space-y-1">
                    <div className="px-4 mb-2 hidden lg:block text-xs font-bold text-gray-500 uppercase tracking-wider">Platform</div>
                    {[
                        { id: 'home', label: 'Overview', icon: 'home' },
                        { id: 'sparring', label: 'Code Sparring', icon: 'swords' },
                        { id: 'studio', label: 'AI Studio', icon: 'zap' },
                        { id: 'architect', label: 'Architect', icon: 'architect' }
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setView(item.id as ViewMode)}
                            className={`w-full flex items-center px-4 py-3 transition-all relative group ${view === item.id ? 'bg-[#2b2d31] text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-[#252526]'}`}
                        >
                            <div className={`absolute left-0 top-0 bottom-0 w-1 bg-blue-500 transition-all duration-300 ${view === item.id ? 'opacity-100' : 'opacity-0'}`}></div>
                            <Icon name={item.icon} className={`w-5 h-5 lg:mr-3 ${view === item.id ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300'}`} />
                            <span className="hidden lg:block text-sm font-medium">{item.label}</span>
                        </button>
                    ))}
                </div>

                <div className="p-4 border-t border-[#333]">
                    <button onClick={onBack} className="flex items-center justify-center lg:justify-start gap-3 text-gray-500 hover:text-white transition-colors w-full px-4 py-2 rounded hover:bg-[#2b2d31]">
                        <Icon name="arrowRight" className="w-4 h-4 rotate-180" />
                        <span className="hidden lg:block text-sm font-medium">Exit Vexor</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-w-0 relative flex flex-col">
                {/* New Project Modal */}
                {isNewProjectModalOpen && (
                    <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center">
                        <div className="bg-[#1e1e1e] border border-[#333] p-6 rounded-xl w-96 shadow-2xl">
                            <h2 className="text-xl font-bold text-white mb-4">Create New Project</h2>
                            <input 
                                autoFocus
                                type="text" 
                                placeholder="Project Name (e.g. Crypto Dashboard)" 
                                value={newProjectName}
                                onChange={e => setNewProjectName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
                                className="w-full bg-[#131314] border border-[#333] p-3 rounded text-gray-200 focus:outline-none focus:border-blue-500 mb-6"
                            />
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setIsNewProjectModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                                <button onClick={handleCreateProject} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium">Create</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* View Routing */}
                {view === 'home' && (
                    <DashboardHome 
                        onViewChange={setView} 
                        projects={projects} 
                        onSelectProject={id => { setCurrentProjectId(id); setView('sparring'); }}
                        onCreateProject={() => setIsNewProjectModalOpen(true)} 
                    />
                )}

                {/* Ensure active project exists for tools */}
                {!currentProject && view !== 'home' ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <p className="mb-4">No project selected.</p>
                        <button onClick={() => setIsNewProjectModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded">Create Project</button>
                    </div>
                ) : (
                    <>
                        {view === 'sparring' && currentProject && (
                            <SparringView 
                                key={currentProject.id} // Force remount on project switch
                                data={currentProject.data.sparring} 
                                onUpdate={(d) => updateCurrentProject('sparring', d)} 
                            />
                        )}
                        {view === 'studio' && currentProject && (
                            <StudioView 
                                key={currentProject.id}
                                data={currentProject.data.studio} 
                                onUpdate={(d) => updateCurrentProject('studio', d)} 
                            />
                        )}
                        {view === 'architect' && currentProject && (
                            <ArchitectView 
                                key={currentProject.id}
                                data={currentProject.data.architect} 
                                onUpdate={(d) => updateCurrentProject('architect', d)} 
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

/* --- LANDING PAGE --- */
const LandingPage = ({ onLaunch }: { onLaunch: () => void }) => {
    return (
        <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden font-sans">
            <header className="fixed top-0 w-full z-50 border-b border-white/10 bg-[#050505]/80 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                         <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                            <span className="font-bold text-white text-sm">V</span>
                        </div>
                        <span className="text-xl font-bold tracking-tight">Vexor.AI</span>
                    </div>
                    <button onClick={onLaunch} className="px-6 py-2 bg-white text-black rounded-full font-medium hover:bg-gray-200 transition-colors text-sm">
                        Launch Dashboard
                    </button>
                </div>
            </header>

            <main className="pt-32 pb-20">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="max-w-4xl mx-auto text-center space-y-8 relative">
                        {/* Glow Effects */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none"></div>
                        
                        <h1 className="relative text-5xl md:text-7xl font-bold tracking-tight leading-tight">
                            Your AI-Powered <br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Code Sparring Partner</span>
                        </h1>
                        <p className="relative text-xl text-gray-400 max-w-2xl mx-auto">
                            Vexor isn't just an editor. It's an intelligent development environment featuring a System Architect, a Prompt Studio, and a personality-driven Code Reviewer.
                        </p>
                        <div className="relative pt-8 flex justify-center gap-4">
                            <button onClick={onLaunch} className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-medium text-lg transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2">
                                <Icon name="swords" className="w-5 h-5" />
                                Start Sparring
                            </button>
                            <button className="px-8 py-4 bg-transparent border border-white/20 text-white rounded-full font-medium text-lg transition-all hover:bg-white/10 flex items-center gap-2 backdrop-blur-sm">
                                <Icon name="playCircle" className="w-5 h-5" />
                                Watch Demo
                            </button>
                        </div>
                    </div>
                </div>

                {/* ScrollyTelling Section */}
                <ScrollyTelling />

                <div className="max-w-6xl mx-auto mt-20 px-6 grid md:grid-cols-3 gap-8">
                    {[
                        { title: "Code Sparring", desc: "Paste code and get instant reviews from different personalities like 'The Hacker' or 'The Professor'.", icon: "swords" },
                        { title: "Studio IDE", desc: "A full-featured Prompt Engineering environment mirroring Google AI Studio for testing models.", icon: "zap" },
                        { title: "System Architect", desc: "Turn a simple sentence into a full tech stack, folder structure, and database schema.", icon: "architect" }
                    ].map((feat, i) => (
                        <div key={i} className="p-8 rounded-2xl bg-[#111] border border-[#333] hover:border-blue-500/50 transition-colors group">
                            <div className="w-12 h-12 rounded-xl bg-blue-900/10 text-blue-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Icon name={feat.icon} className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-gray-200">{feat.title}</h3>
                            <p className="text-gray-500">{feat.desc}</p>
                        </div>
                    ))}
                </div>
            </main>
             <footer className="bg-[#050505] border-t border-white/10 py-12 mt-20">
                <div className="max-w-7xl mx-auto px-6 text-center text-gray-500 text-sm">
                    <div className="flex items-center justify-center gap-2 mb-4 opacity-50">
                         <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                            <span className="font-bold text-white text-xs">V</span>
                        </div>
                        <span className="font-bold text-lg tracking-tight text-white">Vexor.AI</span>
                    </div>
                    <p>© 2024 Vexor.AI. Powered by Google Gemini 2.5.</p>
                </div>
            </footer>
        </div>
    );
};

const App = () => {
    const [screen, setScreen] = useState<'landing' | 'dashboard'>('landing');
    const [apiKey, setApiKey] = useState<string>(() => process.env.API_KEY || localStorage.getItem('vexor_api_key') || '');
    const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);

    useEffect(() => {
        if (!apiKey) setIsKeyModalOpen(true);
    }, [apiKey]);

    const handleSaveKey = (key: string) => {
        localStorage.setItem('vexor_api_key', key);
        setApiKey(key);
        setIsKeyModalOpen(false);
        // Force reload to initialize AI with new key
        window.location.reload();
    };

    return (
        <>
            <ApiKeyModal isOpen={isKeyModalOpen} onSave={handleSaveKey} />
            {screen === 'landing' ? <LandingPage onLaunch={() => setScreen('dashboard')} /> : <Dashboard onBack={() => setScreen('landing')} />}
        </>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);