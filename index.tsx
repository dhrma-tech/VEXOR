import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Modality } from "@google/genai";
import Editor from "@monaco-editor/react";

const FLASH_MODEL = 'gemini-2.5-flash';
const PRO_MODEL = 'gemini-3-pro-preview';
const FLASH_LITE_MODEL = 'gemini-flash-lite-latest';
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/* --- SHARED COMPONENTS --- */

const MonacoEditor = ({ value, onChange, readOnly, onMount, onToggleBreakpoint, breakpoints = [], currentDebugLine }: { value: string, onChange?: (val: string) => void, readOnly?: boolean, onMount?: (editor: any, monaco: any) => void, onToggleBreakpoint?: (line: number) => void, breakpoints?: number[], currentDebugLine?: number | null }) => {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decorationsRef = useRef<any>([]);

  const handleEditorWillMount = (monaco: any) => {
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      allowJs: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      jsxFactory: 'React.createElement',
      reactNamespace: 'React',
    });
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Handle Breakpoint Click
    editor.onMouseDown((e: any) => {
        if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
            const lineNumber = e.target.position.lineNumber;
            if (onToggleBreakpoint) onToggleBreakpoint(lineNumber);
        }
    });

    if (onMount) onMount(editor, monaco);
  };

  // Update Decorations (Breakpoints & Debug Line)
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    const newDecorations: any[] = [];

    // Breakpoints
    breakpoints.forEach(line => {
        newDecorations.push({
            range: new monaco.Range(line, 1, line, 1),
            options: {
                isWholeLine: true,
                glyphMarginClassName: 'breakpoint',
                glyphMarginHoverMessage: { value: 'Breakpoint' }
            }
        });
    });

    // Current Debug Line
    if (currentDebugLine) {
        newDecorations.push({
            range: new monaco.Range(currentDebugLine, 1, currentDebugLine, 1),
            options: {
                isWholeLine: true,
                className: 'debug-line',
            }
        });
    }

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);

  }, [breakpoints, currentDebugLine]);

  return (
    <Editor
      height="100%"
      defaultLanguage="javascript"
      theme="vs-dark"
      value={value}
      onChange={(val) => onChange?.(val || '')}
      beforeMount={handleEditorWillMount}
      onMount={handleEditorDidMount}
      options={{ 
        readOnly, 
        minimap: { enabled: false }, 
        fontSize: 14,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        glyphMargin: true, // Enable margin for breakpoints
        padding: { top: 16, bottom: 16 }
      }}
    />
  );
};

const SpaceWarp = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    
    // Star properties
    const stars: {x: number, y: number, z: number, color: string}[] = [];
    const numStars = 1500;
    const centerX = w / 2;
    const centerY = h / 2;
    const colors = ['#ffffff', '#9D00FF', '#d8b4fe', '#4c1d95']; // White, Neon Violet, Light Purple, Dark Purple

    // Initialize stars
    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: Math.random() * w - centerX,
        y: Math.random() * h - centerY,
        z: Math.random() * w,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    let animationFrameId: number;

    const render = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; // Trail effect
      ctx.fillRect(0, 0, w, h);
      
      const cx = w/2;
      const cy = h/2;

      for (let i = 0; i < numStars; i++) {
        const star = stars[i];
        star.z -= 15; // Speed of warp

        if (star.z <= 0) {
          star.z = w;
          star.x = Math.random() * w - cx;
          star.y = Math.random() * h - cy;
        }

        const x = (star.x / star.z) * w + cx;
        const y = (star.y / star.z) * h + cy;
        const size = (1 - star.z / w) * 2.5;
        const opacity = (1 - star.z / w);

        if (x >= 0 && x <= w && y >= 0 && y <= h) {
            ctx.beginPath();
            ctx.fillStyle = star.color;
            ctx.globalAlpha = opacity;
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
      }
      animationFrameId = requestAnimationFrame(render);
    };
    
    render();

    const handleResize = () => {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none mix-blend-screen opacity-80" />;
};

/* --- VIEWS --- */

const Header = ({ currentView, setView }: { currentView: string, setView: (v: string) => void }) => (
  <nav className="sticky top-0 z-50 backdrop-blur-md bg-black/50 border-b border-white/10">
    <div className="container mx-auto px-6 py-4 flex justify-between items-center">
      <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('home')}>
        <div className="w-10 h-10 bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-xl flex items-center justify-center relative overflow-hidden transition-all group-hover:border-neon-violet/50 group-hover:shadow-[0_0_20px_-5px_rgba(157,0,255,0.4)]">
            <div className="absolute inset-0 bg-gradient-to-tr from-neon-violet/20 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
            <svg className="w-6 h-6 relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4l8 16 8-16" className="text-white drop-shadow-md"/>
                <path d="M4 4h16" className="text-neon-violet" strokeWidth="1.5" strokeOpacity="0.7"/>
            </svg>
        </div>
        <span className="text-xl font-bold tracking-tight group-hover:text-white transition-colors">Vexor<span className="text-neon-violet">.AI</span></span>
      </div>
      <div className="hidden md:flex items-center gap-8">
        <button onClick={() => setView('home')} className={`text-sm font-medium transition-colors ${currentView === 'home' ? 'text-white' : 'text-gray-400 hover:text-white'}`}>Home</button>
        <button onClick={() => setView('sparring')} className={`text-sm font-medium transition-colors ${currentView === 'sparring' ? 'text-white' : 'text-gray-400 hover:text-white'}`}>Code Sparring</button>
        <button onClick={() => setView('analyzer')} className={`text-sm font-medium transition-colors ${currentView === 'analyzer' ? 'text-white' : 'text-gray-400 hover:text-white'}`}>Architect</button>
      </div>
      <button onClick={() => setView('sparring')} className="px-5 py-2 bg-white text-black text-sm font-bold rounded-full hover:bg-gray-200 transition-colors">
        Get Started
      </button>
    </div>
  </nav>
);

const Hero = ({ setView }: { setView: (v: string) => void }) => (
  <div className="relative overflow-hidden pt-32 pb-40 min-h-[90vh] flex items-center justify-center">
    {/* Dynamic Background Animation */}
    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <SpaceWarp />
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-neon-violet/30 rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-blob"></div>
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-blue-600/30 rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-1/3 w-[500px] h-[500px] bg-purple-600/30 rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-blob animation-delay-4000"></div>
    </div>

    <div className="container mx-auto px-6 text-center relative z-10">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8 animate-fade-in-up backdrop-blur-md">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
        <span className="text-xs font-medium text-gray-300">v2.0 Now Live: AI Debugger</span>
      </div>
      <div className="h1-reveal-container mb-6">
        <h1 className="text-6xl md:text-8xl font-bold font-heading tracking-tight leading-tight drop-shadow-2xl">
          Code Smarter, <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">Not Harder.</span>
        </h1>
        <div className="h1-comet-streak"></div>
      </div>
      <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up" style={{animationDelay: '0.2s'}}>
        Your AI-powered sparring partner. Generate rigorous tests, refactor complex logic, debug execution flow, and get architectural wisdom in seconds.
      </p>
      <div className="flex flex-col md:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{animationDelay: '0.4s'}}>
        <button onClick={() => setView('sparring')} className="px-8 py-4 bg-neon-violet hover:bg-neon-violet/80 text-white font-bold rounded-full transition-all hover:scale-105 hover:shadow-[0_0_30px_-5px_rgba(157,0,255,0.5)] w-full md:w-auto">
          Start Sparring
        </button>
        <button onClick={() => setView('analyzer')} className="px-8 py-4 bg-transparent border border-gray-700 hover:border-white text-white font-bold rounded-full transition-all hover:bg-white/5 w-full md:w-auto">
          Architect Review
        </button>
      </div>
    </div>
  </div>
);

const Features = () => (
  <div className="py-24 bg-black relative">
    <div className="bg-grid absolute inset-0 opacity-20 pointer-events-none"></div>
    <div className="container mx-auto px-6 relative z-10">
      <div className="text-center mb-20">
        <h2 className="text-3xl md:text-5xl font-bold font-heading mb-6">Supercharge your workflow</h2>
        <p className="text-gray-400 max-w-2xl mx-auto">Vexor combines multiple AI personas to give you the exact feedback you need, exactly when you need it.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-8">
         <FeatureCard 
            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>}
            title="Automated Testing"
            desc="Generate comprehensive Jest test suites tailored to different testing philosophies, from 'Happy Path' to 'Hacker' mindset."
         />
         <FeatureCard 
            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>}
            title="Smart Refactoring"
            desc="Get instant architectural advice and cleaner code. Detect anti-patterns and optimize for performance and readability."
         />
         <FeatureCard 
            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>}
            title="AI Debugger"
            desc="Step through your code with an AI simulator. Inspect variable states and visualize execution flow without complex setup."
         />
      </div>
    </div>
  </div>
);

const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) => (
  <div className="glowing-card p-8 rounded-2xl hover:translate-y-[-5px] transition-transform duration-300">
    <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neon-violet mb-6">
      {icon}
    </div>
    <h3 className="text-xl font-bold mb-3">{title}</h3>
    <p className="text-gray-400 leading-relaxed">{desc}</p>
  </div>
);

const Testimonials = () => (
  <div className="py-24 border-t border-white/5">
    <div className="container mx-auto px-6">
        <h2 className="text-3xl font-bold font-heading text-center mb-16">Trusted by Developers</h2>
        <div className="grid md:grid-cols-2 gap-8">
            <div className="p-8 rounded-2xl bg-white/5 border border-white/5">
                <p className="text-lg text-gray-300 italic mb-6">"Vexor caught a race condition in my auth logic that three senior devs missed. The 'Hacker' personality is absolutely brutal in the best way possible."</p>
                <div className="flex items-center gap-4">