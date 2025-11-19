
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type, GenerateContentResponse, Modality } from "@google/genai";
import Editor, { useMonaco } from "@monaco-editor/react";

/* --- CONFIGURATION & CONSTANTS --- */
const MODELS = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Fast and versatile', tags: ['Fast', 'Vision'] },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', desc: 'Ultra-fast low latency', tags: ['Fastest', 'Vision'] },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro', desc: 'Reasoning & Thinking', tags: ['Thinking', 'Vision', 'Complex'] },
];

const PERSONALITIES = [
    { id: 'engineer', name: 'Engineer', system: 'You are a pragmatic Senior Software Engineer. Focus on clean, efficient, and maintainable code.' },
    { id: 'reviewer', name: 'Reviewer', system: 'You are a strict Code Reviewer. Focus on best practices, potential bugs, security issues, and performance.' },
    { id: 'hacker', name: 'Hacker', system: 'You are a Security Researcher. Look for vulnerabilities and suggest exploits or patches.' },
    { id: 'poet', name: 'Poet', system: 'You are a Code Poet. Write elegant, readable code and explain it using metaphors and rhymes where appropriate.' },
];

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

/* --- TYPES --- */
type Message = {
    role: 'user' | 'model';
    text: string;
    images?: string[]; // Base64 strings
    error?: boolean;
    hasCode?: boolean;
};

type RunSettings = {
    model: string;
    temperature: number;
    topP: number;
    topK: number;
    maxOutputTokens: number;
    systemInstruction: string;
};

type Product = {
    id: string;
    title: string;
    price: string;
    description: string;
    images: string[]; // Base64
};

type CommerceData = {
    store: {
        name: string;
        slug: string;
        bio: string;
        email: string;
        twitter: string;
        instagram: string;
    };
    products: Product[];
    chatHistory: Message[];
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
        currentCode?: string; 
    };
    architect: {
        input: string;
        result: any;
    };
    commerce: CommerceData;
};

type Folder = {
    id: string;
    name: string;
    isOpen: boolean;
};

type Project = {
    id: string;
    name: string;
    folderId?: string;
    lastModified: number;
    data: ProjectData;
};

type ViewMode = 'home' | 'sparring' | 'studio' | 'architect' | 'about' | 'commerce';

/* --- DEFAULTS --- */
const DEFAULT_SETTINGS: RunSettings = {
    model: 'gemini-2.5-flash', 
    temperature: 0.7, 
    topP: 0.95, 
    topK: 64, 
    maxOutputTokens: 8192, 
    systemInstruction: `You are an expert Frontend Engineer and UI/UX Designer. 
Your goal is to generate production-ready, responsive, and beautiful websites.
- ALWAYS return the full code in a single HTML file (including <style> and <script> tags).
- Use Tailwind CSS via CDN for styling.
- Use Google Fonts (Inter or Roboto).
- Focus on modern design principles, clean layouts, and interactivity.
- If the user asks for a specific component, build it within a demo page.`
};

const DEFAULT_COMMERCE_DATA: CommerceData = {
    store: {
        name: 'My Awesome Store',
        slug: 'my-awesome-store',
        bio: 'Handcrafted goods for the modern soul.',
        email: '',
        twitter: '',
        instagram: ''
    },
    products: [],
    chatHistory: [{ role: 'model', text: 'Hello! I am your Commerce Assistant. How can I help you manage your store today?' }]
};

const DEFAULT_PROJECT_DATA: ProjectData = {
    sparring: { code: '// Start coding...', output: '', personalityId: 'engineer' },
    studio: { messages: [], input: '', settings: DEFAULT_SETTINGS, currentCode: '' },
    architect: { input: '', result: null },
    commerce: DEFAULT_COMMERCE_DATA
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
        codeSlash: <path d="M16 18L22 12L16 6M8 6L2 12L8 18" />,
        image: <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />,
        trash: <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />,
        chevronDown: <path d="M19 9l-7 7-7-7" />,
        chevronRight: <path d="M9 5l7 7-7 7" />,
        info: <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
        mic: <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />,
        copy: <path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />,
        architect: <path d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />,
        eye: <><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>,
        file: <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
        folder: <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />,
        folderOpen: <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />,
        folderPlus: <><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /><path d="M12 11h4m-2-2v4" /></>,
        zap: <path d="M13 10V3L4 14h7v7l9-11h-7z" />,
        arrowRight: <path d="M14 5l7 7m0 0l-7 7m7-7H3" />,
        arrowBack: <path d="M19 12H5M12 19l-7-7 7-7" />,
        swords: <path d="M14.5 17.5L3 6V3h3l11.5 11.5m-5 0L21 21v-3l-2.5-2.5m-9-9L6 3H3v3l3.5 3.5" />, 
        playCircle: <><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></>,
        clock: <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
        dots: <path d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />,
        close: <path d="M6 18L18 6M6 6l12 12" />,
        paperclip: <path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />,
        brain: <path d="M12 9a3 3 0 100 6 3 3 0 000-6z" strokeWidth="2" />,
        sparkles: <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />,
        terminal: <path d="M4 17l6-6-6-6M12 19h8" />,
        cart: <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />,
        store: <path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1zM2 6h12M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2h-1" />,
        upload: <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />,
        social: <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    };

    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
            {icons[name] || icons.chat}
        </svg>
    );
};

/* --- SUB-COMPONENTS --- */

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

/* --- VIEWS --- */

// 0. DASHBOARD HOME (Standard Vertical)
const DashboardHome = ({ onViewChange, projects, folders, onSelectProject, onCreateProject }: { onViewChange: (view: ViewMode) => void, projects: Project[], folders: Folder[], onSelectProject: (id: string) => void, onCreateProject: () => void }) => {
    const getFolderName = (id?: string) => {
        if (!id) return '';
        return folders.find(f => f.id === id)?.name || '';
    }

    // Standard Vertical Scrolling layout
    return (
        <div className="h-full w-full overflow-y-auto bg-[#0a0a0a] text-white custom-scrollbar scroll-smooth">
            
            {/* 1. HERO SECTION */}
            <section className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden px-4 border-b border-[#333]">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-blue-900/10 via-[#0a0a0a] to-[#0a0a0a] z-0 pointer-events-none" />
                
                {/* Animated Blobs */}
                <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-float-slow pointer-events-none"></div>
                <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float-delayed pointer-events-none"></div>

                <div className="z-10 text-center space-y-6 max-w-4xl relative">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/20 border border-blue-500/30 text-blue-400 text-xs font-medium mb-4 animate-fade-in-up">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                        v2.5 Now Available
                    </div>
                    <h1 className="text-6xl md:text-8xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-600 mb-4 animate-float">
                        VEXOR<span className="text-blue-600">.AI</span>
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-400 font-light max-w-2xl mx-auto leading-relaxed">
                        The integrated development environment for the <span className="text-white font-medium">AI-native generation</span>.
                    </p>
                    <div className="flex items-center justify-center gap-4 pt-8">
                        <button onClick={onCreateProject} className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-lg transition-all shadow-lg shadow-blue-900/30 flex items-center gap-3 hover:scale-105">
                            <Icon name="plus" className="w-6 h-6" />
                            Start Building
                        </button>
                    </div>
                </div>
                <div className="absolute bottom-12 animate-bounce text-gray-500">
                    <Icon name="chevronDown" className="w-8 h-8" />
                </div>
            </section>

            {/* 2. STUDIO FEATURE */}
            <section className="w-full py-32 flex flex-col md:flex-row items-center relative overflow-hidden bg-[#0f0f10] border-b border-[#333]">
                <div className="flex-1 h-full flex flex-col justify-center px-12 md:px-24 z-10 space-y-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-900/50 to-purple-600/20 flex items-center justify-center text-purple-400 mb-4 animate-float-fast">
                         <Icon name="zap" className="w-8 h-8" />
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold text-white">Studio IDE</h2>
                    <p className="text-lg text-gray-400 max-w-md leading-relaxed">
                        Generate production-ready websites in seconds. A professional 3-pane environment with instant preview, code editing, and advanced model controls.
                    </p>
                    <button onClick={() => onViewChange('studio')} className="w-fit px-6 py-3 border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 rounded-lg transition-all flex items-center gap-2">
                        Open Studio <Icon name="arrowRight" className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 h-full relative flex items-center justify-center md:border-l border-[#333] mt-12 md:mt-0">
                    {/* Abstract representation of the IDE */}
                    <div className="w-3/4 aspect-video bg-[#1e1e1e] rounded-xl border border-[#333] shadow-2xl flex flex-col overflow-hidden relative transform rotate-3 hover:rotate-0 transition-transform duration-500 animate-float">
                         <div className="h-8 bg-[#252526] border-b border-[#333] flex items-center px-3 gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                         </div>
                         <div className="flex-1 flex">
                            <div className="w-1/3 border-r border-[#333] p-4 space-y-2">
                                <div className="h-2 w-3/4 bg-gray-700 rounded"></div>
                                <div className="h-2 w-1/2 bg-gray-800 rounded"></div>
                                <div className="h-2 w-full bg-gray-800 rounded"></div>
                            </div>
                            <div className="flex-1 bg-[#1e1e1e] p-4 flex items-center justify-center">
                                <div className="text-gray-600 font-mono text-xs">Preview Mode</div>
                            </div>
                         </div>
                    </div>
                </div>
            </section>

            {/* 3. SMART COMMERCE FEATURE */}
            <section className="w-full py-32 flex flex-col md:flex-row-reverse items-center relative overflow-hidden bg-[#0a0a0a] border-b border-[#333]">
                <div className="flex-1 h-full flex flex-col justify-center px-12 md:px-24 z-10 space-y-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-900/50 to-orange-600/20 flex items-center justify-center text-orange-400 mb-4 animate-float-fast">
                         <Icon name="cart" className="w-8 h-8" />
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold text-white">Smart Commerce</h2>
                    <p className="text-lg text-gray-400 max-w-md leading-relaxed">
                        Empower your business with AI. Manage products, generate professional photography instantly, and deploy your storefront with a few clicks.
                    </p>
                    <button onClick={() => onViewChange('commerce')} className="w-fit px-6 py-3 border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 rounded-lg transition-all flex items-center gap-2">
                        Enter Commerce <Icon name="arrowRight" className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 h-full relative flex items-center justify-center md:border-r border-[#333] mt-12 md:mt-0">
                     <div className="w-2/3 bg-[#1e1e1e] p-6 rounded-lg border border-[#333] shadow-2xl flex flex-col gap-4 transform -rotate-2 hover:rotate-0 transition-transform duration-500 animate-float-delayed">
                        <div className="flex items-center gap-4 mb-2">
                             <div className="w-16 h-16 bg-gray-700 rounded-lg animate-pulse"></div>
                             <div className="flex-1 space-y-2">
                                 <div className="h-4 w-3/4 bg-gray-600 rounded"></div>
                                 <div className="h-3 w-1/2 bg-gray-700 rounded"></div>
                             </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="h-20 bg-gray-800 rounded-lg border border-gray-700"></div>
                            <div className="h-20 bg-gray-800 rounded-lg border border-gray-700"></div>
                            <div className="h-20 bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-center text-gray-500 text-xs">+ AI Photo</div>
                        </div>
                     </div>
                </div>
            </section>

            {/* 4. SPARRING FEATURE */}
            <section className="w-full py-32 flex flex-col md:flex-row items-center relative overflow-hidden bg-[#0f0f10] border-b border-[#333]">
                <div className="flex-1 h-full flex flex-col justify-center px-12 md:px-24 z-10 space-y-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-900/50 to-blue-600/20 flex items-center justify-center text-blue-400 mb-4 animate-float-fast">
                         <Icon name="swords" className="w-8 h-8" />
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold text-white">Code Sparring</h2>
                    <p className="text-lg text-gray-400 max-w-md leading-relaxed">
                        Challenge your code against AI personas. Refactor, review, and generate unit tests with the guidance of a Senior Engineer or Security Researcher.
                    </p>
                    <button onClick={() => onViewChange('sparring')} className="w-fit px-6 py-3 border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all flex items-center gap-2">
                        Start Sparring <Icon name="arrowRight" className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 h-full relative flex items-center justify-center md:border-l border-[#333] mt-12 md:mt-0">
                     <div className="grid grid-cols-2 gap-4 opacity-50">
                        <div className="p-6 bg-[#1e1e1e] rounded-xl border border-[#333] flex flex-col items-center gap-2 animate-float">
                            <Icon name="zap" className="w-8 h-8 text-yellow-500" />
                            <span className="text-xs text-gray-400">Refactor</span>
                        </div>
                        <div className="p-6 bg-[#1e1e1e] rounded-xl border border-[#333] flex flex-col items-center gap-2 animate-float-delayed">
                            <Icon name="eye" className="w-8 h-8 text-blue-500" />
                            <span className="text-xs text-gray-400">Review</span>
                        </div>
                        <div className="p-6 bg-[#1e1e1e] rounded-xl border border-[#333] flex flex-col items-center gap-2 animate-float-delayed">
                            <Icon name="code" className="w-8 h-8 text-green-500" />
                            <span className="text-xs text-gray-400">Test</span>
                        </div>
                        <div className="p-6 bg-[#1e1e1e] rounded-xl border border-[#333] flex flex-col items-center gap-2 animate-float">
                            <Icon name="brain" className="w-8 h-8 text-purple-500" />
                            <span className="text-xs text-gray-400">Explain</span>
                        </div>
                     </div>
                </div>
            </section>

            {/* 5. ARCHITECT FEATURE */}
            <section className="w-full py-32 flex flex-col md:flex-row-reverse items-center relative overflow-hidden bg-[#0a0a0a] border-b border-[#333]">
                <div className="flex-1 h-full flex flex-col justify-center px-12 md:px-24 z-10 space-y-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-900/50 to-green-600/20 flex items-center justify-center text-green-400 mb-4 animate-float-fast">
                         <Icon name="architect" className="w-8 h-8" />
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold text-white">System Architect</h2>
                    <p className="text-lg text-gray-400 max-w-md leading-relaxed">
                        Turn abstract ideas into concrete technical specifications. Generate file structures, technology stacks, and architectural blueprints instantly.
                    </p>
                    <button onClick={() => onViewChange('architect')} className="w-fit px-6 py-3 border border-green-500/30 text-green-400 hover:bg-green-500/10 rounded-lg transition-all flex items-center gap-2">
                        Design System <Icon name="arrowRight" className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 h-full relative flex items-center justify-center md:border-r border-[#333] mt-12 md:mt-0">
                     <div className="w-2/3 bg-[#1e1e1e] p-6 rounded-lg border border-[#333] font-mono text-xs text-gray-400 animate-float">
                        <div className="text-blue-400 mb-2">Structure</div>
                        <div className="pl-4 border-l border-gray-700 space-y-1">
                            <div>src/</div>
                            <div className="pl-4 text-gray-500">components/</div>
                            <div className="pl-4 text-gray-500">hooks/</div>
                            <div className="pl-4 text-gray-500">utils/</div>
                            <div>package.json</div>
                            <div>tsconfig.json</div>
                        </div>
                     </div>
                </div>
            </section>

             {/* 6. PROJECTS LIST */}
             <section className="w-full min-h-screen bg-[#0a0a0a] p-12 md:p-24 flex flex-col">
                <div className="max-w-6xl mx-auto w-full h-full flex flex-col">
                    <div className="flex justify-between items-end mb-8">
                        <h2 className="text-3xl font-light text-white">Your <span className="font-bold">Workspace</span></h2>
                        <button onClick={onCreateProject} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                            <Icon name="plus" className="w-4 h-4" /> New Project
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 content-start pb-12">
                        {projects.length === 0 ? (
                            <div className="col-span-full flex flex-col items-center justify-center h-64 text-gray-500 border border-dashed border-[#333] rounded-xl">
                                <Icon name="folder" className="w-12 h-12 mb-4 opacity-20" />
                                <p>No projects yet. Start building something amazing.</p>
                            </div>
                        ) : (
                            projects.sort((a,b) => b.lastModified - a.lastModified).map(p => (
                                <div 
                                    key={p.id}
                                    onClick={() => onSelectProject(p.id)}
                                    className="group bg-[#1e1e1e] border border-[#333] rounded-xl p-6 cursor-pointer hover:border-blue-500/30 hover:bg-[#252526] transition-all relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Icon name="arrowRight" className="text-blue-400 w-5 h-5" />
                                    </div>
                                    <div className="w-12 h-12 rounded-lg bg-[#131314] flex items-center justify-center text-gray-400 mb-4 group-hover:text-white transition-colors">
                                        <Icon name="code" />
                                    </div>
                                    <h3 className="text-lg font-medium text-white mb-2 truncate">{p.name}</h3>
                                    <p className="text-xs text-gray-500">Last edited {new Date(p.lastModified).toLocaleDateString()}</p>
                                    <div className="mt-4 flex gap-2">
                                        <span className="text-[10px] px-2 py-1 rounded bg-[#131314] text-gray-400 border border-[#333]">
                                            {p.folderId ? getFolderName(p.folderId) : 'General'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </section>

        </div>
    );
};

// 1. SPARRING VIEW (Code Focused)
const SparringView = ({ data, onUpdate }: { data: ProjectData['sparring'], onUpdate: (d: ProjectData['sparring']) => void }) => {
