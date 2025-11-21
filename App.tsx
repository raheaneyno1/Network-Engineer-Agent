import React, { useState, useEffect, useRef } from 'react';
import { AgentMode, Message } from './types';
import { AGENT_CONFIGS } from './constants';
import { sendMessageToGemini, VoiceManager } from './services/geminiService';
import { NetworkStatsChart } from './components/NetworkStatsChart';
import { VoiceVisualizer } from './components/VoiceVisualizer';
import { Mic, MicOff, Activity, Shield, Cpu, Send, Volume2, VolumeX } from 'lucide-react';

export default function App() {
  const [mode, setMode] = useState<AgentMode>(AgentMode.TRIAGE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  // Live Voice State
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Legacy Audio Toggle (Controls system sounds or alerts if we had them, keeps UI consistent)
  const [audioEnabled, setAudioEnabled] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const voiceManagerRef = useRef<VoiceManager | null>(null);
  const currentTranscripts = useRef<{user: string, model: string}>({ user: '', model: '' });

  const activeConfig = AGENT_CONFIGS[mode];

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cleanup voice on unmount
  useEffect(() => {
    return () => {
      if (voiceManagerRef.current) {
        voiceManagerRef.current.disconnect();
      }
    };
  }, []);

  // Handle Live Voice Toggle
  const toggleLiveSession = async () => {
    if (isLiveActive || isConnecting) {
      // Stop
      if (voiceManagerRef.current) {
        voiceManagerRef.current.disconnect();
        voiceManagerRef.current = null;
      }
      setIsLiveActive(false);
      setIsConnecting(false);
      // Add a system message indicating end of voice session
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: `[Voice Session Ended]`,
        timestamp: new Date()
      }]);
    } else {
      // Start
      setIsConnecting(true);
      const manager = new VoiceManager(
        mode,
        (text, isUser) => {
          // Handle Real-time transcription updates
          // For simplicity, we will bundle these into messages as they come in completely
          // OR we can update a "streaming" message state.
          // Given the Live API sends chunks, we'll simple append fully formed thoughts.
          // Note: The provided `geminiService` implementation calls this on transcription chunks.
          // For a cleaner chat, we might want to debounce or only show completed turns, 
          // but the API sends accumulated text. 
          
          // We will just append to the chat for every significant chunk for now, 
          // or better: update the last message if it matches the role.
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            const role = isUser ? 'user' : 'model';
            
            // Simple logic: if last message is same role and recent, append/update
            // However, to prevent jitter, we'll just log discrete chunks if they are new sentences
            // or just let the "Conversation" flow. 
            
            // Strategy: Just add new message bubble for this demo to visualize the stream.
            return [...prev, {
                id: Date.now().toString(),
                role: role as 'user' | 'model',
                text: text,
                timestamp: new Date()
            }];
          });
        },
        () => {
          // On Close
          setIsLiveActive(false);
          setIsConnecting(false);
        }
      );

      try {
        await manager.connect();
        voiceManagerRef.current = manager;
        setIsLiveActive(true);
        setIsConnecting(false);
      } catch (err) {
        console.error("Failed to connect live", err);
        setIsConnecting(false);
        alert("Could not connect to Gemini Live API. Check console and network.");
      }
    }
  };

  const handleTextSendMessage = async () => {
    if (!inputText.trim()) return;

    // If Live is active, we might want to stop it or send text via live. 
    // For now, we'll treat text chat as a separate channel or "Side channel"
    
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');

    // Call Gemini (Text Mode)
    const responseText = await sendMessageToGemini(inputText, mode, messages);

    const botMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: responseText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, botMessage]);
  };

  const handleModeChange = (newMode: AgentMode) => {
    if (isLiveActive) {
      // If voice is active, we need to reconnect to switch voices/persona
      if (voiceManagerRef.current) {
          voiceManagerRef.current.disconnect();
          voiceManagerRef.current = null;
          setIsLiveActive(false);
      }
      // Ideally we would auto-reconnect, but let's ask user to toggle again to be safe
    }
    
    setMode(newMode);
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'model',
        text: `Switching to ${AGENT_CONFIGS[newMode].role}. Voice channel reset.`,
        timestamp: new Date()
      }
    ]);
  };

  return (
    <div className="min-h-screen bg-netops-dark text-slate-200 font-sans overflow-hidden flex flex-col relative">
      <div className="scanline"></div>
      
      {/* Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-6 z-10">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${activeConfig.color} bg-opacity-20`}>
            <Activity className={`w-6 h-6 ${activeConfig.textColor}`} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">NetOps Omni-Agent</h1>
            <p className="text-xs text-slate-400 font-mono">LIVE LINK // V.3.1.0</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
            <button onClick={() => setAudioEnabled(!audioEnabled)} className="text-slate-400 hover:text-white transition">
                {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          <div className="h-8 w-px bg-slate-700"></div>
          <div className="flex space-x-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
            {Object.values(AgentMode).map((m) => {
              const config = AGENT_CONFIGS[m];
              const isActive = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => handleModeChange(m)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                    isActive 
                      ? `${config.color} text-white shadow-lg shadow-${config.color}/20` 
                      : 'text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {config.name}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden z-10 relative">
        
        {/* Left Panel: Diagnostics */}
        <div className="hidden lg:flex w-80 border-r border-slate-800 bg-slate-900/50 flex-col p-4 space-y-4">
          <div className="p-4 rounded-lg border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-slate-400">ACTIVE AGENT</span>
              <Shield className={`w-4 h-4 ${activeConfig.textColor}`} />
            </div>
            <div className="text-xl font-bold text-white mb-1">{activeConfig.name}</div>
            <div className={`text-xs ${activeConfig.textColor} font-medium mb-3`}>{activeConfig.role}</div>
            <p className="text-xs text-slate-400 leading-relaxed">{activeConfig.description}</p>
          </div>

          <NetworkStatsChart />

          <div className="flex-1 rounded-lg border border-slate-700 bg-slate-900/50 p-4 overflow-y-auto font-mono text-xs text-slate-400">
            <div className="mb-2 text-slate-500 uppercase tracking-wider">System Logs</div>
            <div className="space-y-1">
              <div className="flex"><span className="text-emerald-500 mr-2">[SYS]</span> System initialized</div>
              {isLiveActive && <div className="flex animate-pulse"><span className="text-red-500 mr-2">[LIVE]</span> Voice channel active ({AGENT_CONFIGS[mode].name})</div>}
              <div className="flex"><span className="text-blue-500 mr-2">[NET]</span> Gemini Live WebSocket Connected</div>
            </div>
          </div>
        </div>

        {/* Center Panel: Chat */}
        <div className="flex-1 flex flex-col relative bg-[#0b1221]">
           {/* Chat Area */}
           <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                  <Cpu className="w-16 h-16 text-slate-600 mb-4" />
                  <h2 className="text-xl font-medium text-slate-300">NetOps System Ready</h2>
                  <p className="text-slate-500 max-w-md mt-2">
                    Connect to Live Voice or type a command to begin.
                  </p>
                </div>
              )}
              
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl p-4 shadow-xl backdrop-blur-sm border ${
                      msg.role === 'user'
                        ? 'bg-slate-800 border-slate-700 text-slate-100 rounded-tr-none'
                        : `bg-slate-900/90 ${activeConfig.borderColor} border-opacity-30 text-slate-200 rounded-tl-none`
                    }`}
                  >
                    {msg.role === 'model' && (
                      <div className={`text-[10px] font-mono mb-1 opacity-70 ${activeConfig.textColor}`}>
                        {activeConfig.name.toUpperCase()} &bull; {activeConfig.role.split(' ')[0].toUpperCase()}
                      </div>
                    )}
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))}
              
              <div ref={messagesEndRef} />
           </div>

           {/* Input Area */}
           <div className="p-4 border-t border-slate-800 bg-slate-900/80 backdrop-blur">
             <div className="max-w-4xl mx-auto flex items-end space-x-4">
                
                <button
                  onClick={toggleLiveSession}
                  disabled={isConnecting}
                  className={`p-3 rounded-full transition-all duration-300 ${
                    isLiveActive 
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/50 animate-pulse' 
                      : isConnecting 
                        ? 'bg-yellow-500/50 text-white cursor-wait' 
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {isLiveActive ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>

                <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 flex flex-col overflow-hidden focus-within:border-blue-500/50 transition-colors">
                  <div className="flex-1">
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if(e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleTextSendMessage();
                        }
                      }}
                      placeholder={isLiveActive ? "Voice channel active (listening...)" : `Message ${activeConfig.name}...`}
                      className="w-full bg-transparent border-none text-slate-200 p-3 focus:ring-0 resize-none h-12 max-h-32 scrollbar-hide placeholder-slate-500"
                      disabled={isLiveActive}
                    />
                  </div>
                  {/* Visualizer inside input for integrated feel */}
                  <div className="h-8 bg-slate-900/30 border-t border-slate-700/50 flex items-center px-2">
                     <VoiceVisualizer isActive={isLiveActive} modeColor={activeConfig.color} />
                  </div>
                </div>

                <button
                  onClick={handleTextSendMessage}
                  disabled={!inputText.trim() || isLiveActive}
                  className={`p-3 rounded-full transition-all ${
                    inputText.trim() && !isLiveActive
                      ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20' 
                      : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-5 h-5" />
                </button>
             </div>
             <div className="text-center mt-2">
                <span className="text-[10px] text-slate-500 font-mono">
                   {isLiveActive ? 'GEMINI LIVE // CONNECTED' : 'READY // TEXT MODE'}
                </span>
             </div>
           </div>
        </div>
      </main>
    </div>
  );
}