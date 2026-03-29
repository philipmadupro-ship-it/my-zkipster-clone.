'use client';

import type { GuestData } from './AddGuestModal';

export default function ArrivalAnalytics({ guests }: { guests: GuestData[] }) {
  const total = guests.length;
  const confirmed = guests.filter(g => g.status === 'confirmed' || g.status === 'accepted').length;
  const arrived = guests.filter(g => g.status === 'arrived').length;
  
  const confirmedRate = total > 0 ? (confirmed / total) * 100 : 0;
  const turnoutRate = confirmed > 0 ? (arrived / confirmed) * 100 : 0;
  const totalTurnout = total > 0 ? (arrived / total) * 100 : 0;

  return (
    <div className="bg-white/[0.02] border border-white/5 backdrop-blur-3xl rounded-[2.5rem] p-10 space-y-8 shadow-2xl transition-all duration-700 hover:border-white/10">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em]">Analytics Intelligence</h3>
        <div className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-full">
           <span className="text-[9px] font-bold text-white uppercase tracking-widest">Real-time Stream</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-12">
        {/* Turnout Progress */}
        <div className="space-y-4">
          <div className="flex justify-between items-baseline">
            <p className="text-[10px] text-gray-600 uppercase font-bold tracking-widest">Total Turnout</p>
            <p className="text-3xl font-display font-bold text-white tracking-tighter">{Math.round(totalTurnout)}%</p>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white shadow-[0_0_15px_white] transition-all duration-1000" 
              style={{ width: `${totalTurnout}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-700 italic tracking-tight">{arrived} of {total} guests arrived</p>
        </div>

        {/* Confirmation Rate */}
        <div className="space-y-4 border-l border-white/5 pl-12">
          <div className="flex justify-between items-baseline">
            <p className="text-[10px] text-gray-600 uppercase font-bold tracking-widest">RSVP Yield</p>
            <p className="text-3xl font-display font-bold text-white tracking-tighter">{Math.round(confirmedRate)}%</p>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white/40 transition-all duration-1000" 
              style={{ width: `${confirmedRate}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-700 italic tracking-tight">{confirmed} guests confirmed attendance</p>
        </div>

        {/* Efficiency / Yield */}
        <div className="space-y-4 border-l border-white/5 pl-12">
          <div className="flex justify-between items-baseline">
            <p className="text-[10px] text-gray-600 uppercase font-bold tracking-widest">Attrition Efficiency</p>
            <p className="text-3xl font-display font-bold text-white tracking-tighter">{Math.round(turnoutRate)}%</p>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white/70 transition-all duration-1000" 
              style={{ width: `${turnoutRate}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-700 italic tracking-tight">Net arrival vs confirmed RSVPs</p>
        </div>
      </div>
    </div>
  );
}
