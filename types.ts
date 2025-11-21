export enum AgentMode {
  TRIAGE = 'TRIAGE',
  ANALYST = 'ANALYST',
  ARCHITECT = 'ARCHITECT'
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface NetworkStats {
  time: string;
  latency: number;
  throughput: number;
  packetLoss: number;
}

export interface AgentConfig {
  name: string;
  role: string;
  color: string;
  borderColor: string;
  textColor: string;
  description: string;
}
