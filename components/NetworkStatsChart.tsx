import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { NetworkStats } from '../types';

const generateMockData = (): NetworkStats[] => {
  const data: NetworkStats[] = [];
  const now = new Date();
  for (let i = 0; i < 20; i++) {
    data.push({
      time: new Date(now.getTime() - (20 - i) * 1000).toLocaleTimeString(),
      latency: Math.floor(Math.random() * 50) + 10,
      throughput: Math.floor(Math.random() * 500) + 100,
      packetLoss: Math.random() > 0.9 ? Math.floor(Math.random() * 5) : 0,
    });
  }
  return data;
};

export const NetworkStatsChart: React.FC = () => {
  const [data, setData] = useState<NetworkStats[]>(generateMockData());

  useEffect(() => {
    const interval = setInterval(() => {
      setData(prev => {
        const newPoint = {
          time: new Date().toLocaleTimeString(),
          latency: Math.floor(Math.random() * 40) + 20,
          throughput: Math.floor(Math.random() * 800) + 200,
          packetLoss: Math.random() > 0.95 ? Math.floor(Math.random() * 2) : 0,
        };
        return [...prev.slice(1), newPoint];
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full w-full flex flex-col space-y-4 p-4 bg-netops-panel/50 rounded-lg border border-slate-700">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest">Live Telemetry</h3>
        <div className="flex space-x-2">
           <div className="flex items-center space-x-1"><span className="w-2 h-2 bg-blue-400 rounded-full"></span><span className="text-[10px] text-slate-400">Latency</span></div>
           <div className="flex items-center space-x-1"><span className="w-2 h-2 bg-emerald-400 rounded-full"></span><span className="text-[10px] text-slate-400">Throughput</span></div>
        </div>
      </div>
      
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorThroughput" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="time" hide />
            <YAxis hide domain={[0, 1000]} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px', fontFamily: 'monospace' }}
              itemStyle={{ color: '#e2e8f0' }}
            />
            <Area type="monotone" dataKey="throughput" stroke="#10b981" fillOpacity={1} fill="url(#colorThroughput)" strokeWidth={2} />
            <Area type="monotone" dataKey="latency" stroke="#3b82f6" fillOpacity={1} fill="url(#colorLatency)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
            <div className="text-[10px] text-slate-400 uppercase">Avg Latency</div>
            <div className="text-lg font-mono text-blue-400">{Math.round(data[data.length-1].latency)}ms</div>
        </div>
        <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
            <div className="text-[10px] text-slate-400 uppercase">Throughput</div>
            <div className="text-lg font-mono text-emerald-400">{Math.round(data[data.length-1].throughput)}Mb</div>
        </div>
        <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
            <div className="text-[10px] text-slate-400 uppercase">Errors</div>
            <div className={`text-lg font-mono ${data[data.length-1].packetLoss > 0 ? 'text-red-500 animate-pulse' : 'text-slate-500'}`}>
                {data[data.length-1].packetLoss}
            </div>
        </div>
      </div>
    </div>
  );
};
