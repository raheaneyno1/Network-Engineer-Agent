import { GoogleGenAI, Chat, LiveServerMessage, Modality, Blob } from "@google/genai";
import { AgentMode, Message } from "../types";
import { SYSTEM_INSTRUCTIONS, VOICE_PRESETS } from "../constants";

let client: GoogleGenAI | null = null;
let chatSession: Chat | null = null;
let currentMode: AgentMode | null = null;

const getClient = (): GoogleGenAI => {
  if (!client) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API Key not found in process.env");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
};

// --- Text Chat (Legacy/Typing) ---

export const sendMessageToGemini = async (
  text: string,
  mode: AgentMode,
  history: Message[]
): Promise<string> => {
  const ai = getClient();

  if (!chatSession || currentMode !== mode) {
    currentMode = mode;
    chatSession = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: SYSTEM_INSTRUCTIONS[mode],
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    });
  }

  try {
    const response = await chatSession.sendMessage({ message: text });
    return response.text || "I processed that, but have no voice response.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Connection error. Please check your network connectivity.";
  }
};

// --- Live Voice API ---

export class VoiceManager {
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputNode: GainNode | null = null;
  private outputNode: GainNode | null = null;
  private sources: Set<AudioBufferSourceNode> = new Set();
  private nextStartTime: number = 0;
  private sessionPromise: Promise<any> | null = null;
  private stream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(
    private mode: AgentMode,
    private onTranscript: (text: string, isUser: boolean) => void,
    private onCloseCallback: () => void
  ) {}

  async connect() {
    const ai = getClient();
    
    // Initialize Audio Contexts
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    this.inputNode = this.inputAudioContext.createGain();
    this.outputNode = this.outputAudioContext.createGain();
    this.outputNode.connect(this.outputAudioContext.destination);

    // Get Mic Stream
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const config = {
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          console.log("Gemini Live Session Opened");
          this.startAudioInput();
        },
        onmessage: (message: LiveServerMessage) => {
          this.handleMessage(message);
        },
        onclose: () => {
          console.log("Gemini Live Session Closed");
          this.stop();
        },
        onerror: (e: any) => {
          console.error("Gemini Live Error", e);
          this.stop();
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_PRESETS[this.mode] } },
        },
        systemInstruction: SYSTEM_INSTRUCTIONS[this.mode],
        inputAudioTranscription: {}, // Enable user transcription (empty object, no model)
        outputAudioTranscription: {}, // Enable model transcription (empty object, no model)
      },
    };

    // @ts-ignore - 'live' property exists on the new SDK
    this.sessionPromise = ai.live.connect(config);
    await this.sessionPromise;
  }

  private startAudioInput() {
    if (!this.inputAudioContext || !this.stream) return;

    this.source = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    
    this.scriptProcessor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createBlob(inputData);
      
      // Use sessionPromise to prevent race conditions and stale closures
      this.sessionPromise?.then((session) => {
        session.sendRealtimeInput({ media: pcmBlob });
      }).catch(err => {
        console.error("Error sending audio input:", err);
      });
    };

    this.source.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.inputAudioContext.destination);
  }

  private async handleMessage(message: LiveServerMessage) {
    // Handle Transcription
    if (message.serverContent?.outputTranscription) {
       const text = message.serverContent.outputTranscription.text;
       if (text) this.onTranscript(text, false);
    } else if (message.serverContent?.inputTranscription) {
       const text = message.serverContent.inputTranscription.text;
       if (text) this.onTranscript(text, true);
    }

    if (message.serverContent?.turnComplete) {
        // Turn is complete
    }

    // Handle Audio Output
    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio && this.outputAudioContext && this.outputNode) {
      this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
      
      try {
        const audioBuffer = await decodeAudioData(
          decode(base64Audio),
          this.outputAudioContext,
          24000,
          1
        );
        
        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputNode);
        
        source.addEventListener('ended', () => {
          this.sources.delete(source);
        });

        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
        this.sources.add(source);
      } catch (err) {
        console.error("Audio decode error", err);
      }
    }

    // Handle Interruption
    if (message.serverContent?.interrupted) {
      this.sources.forEach(src => src.stop());
      this.sources.clear();
      this.nextStartTime = 0;
    }
  }

  disconnect() {
    // We don't explicitly close the session in the SDK generally, 
    // but we clean up local resources.
    this.stop();
  }

  private stop() {
    this.scriptProcessor?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach(t => t.stop());
    
    if (this.inputAudioContext && this.inputAudioContext.state !== 'closed') {
      this.inputAudioContext.close();
    }
    if (this.outputAudioContext && this.outputAudioContext.state !== 'closed') {
      this.outputAudioContext.close();
    }
    
    this.sources.forEach(s => s.stop());
    this.sources.clear();
    this.sessionPromise = null;
    this.onCloseCallback();
  }
}

// --- Audio Helpers ---

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}