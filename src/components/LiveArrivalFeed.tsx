'use client';

import type { GuestData } from './AddGuestModal';

export default function LiveArrivalFeed({ guests }: { guests: GuestData[] }) {
  // Filter for arrived guests and sort by arrivedAt desc
  const arrivals = guests
    .filter(g => g.status === 'arrived' && g.arrivedAt)
    .sort((a, b) => {
        const timeA = (a.arrivedAt as any)?.seconds || 0;
        const timeB = (b.arrivedAt as any)?.seconds || 0;
        return timeB - timeA;
    })
    .slice(0, 8);

  if (arrivals.length === 0) {
    return (
      <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 h-full flex flex-col items-center justify-center text-center">
        <div className="text-2xl mb-2 opacity-20">📡</div>
        <p className="text-xs text-gray-500 font-medium">Waiting for first arrival...</p>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.02] border border-white/5 backdrop-blur-3xl rounded-[2rem] p-6 h-full flex flex-col overflow-hidden shadow-2xl transition-all duration-500 hover:border-white/10">
      <div className="flex items-center justify-between mb-5 flex-shrink-0 px-1">
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shadow-[0_0_8px_white]" />
          Arrival Stream
        </h3>
        <span className="text-[9px] text-gray-600 font-mono font-bold">{arrivals.length} RECENT</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
        {arrivals.map((event, idx) => (
          <div key={event.id} className={`flex items-start gap-4 p-4 rounded-2xl border border-white/[0.03] bg-white/[0.01] transition-all duration-700 animate-in slide-in-from-right-4 ${idx === 0 ? 'border-white/10 bg-white/[0.04]' : ''}`}>
            <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-bold overflow-hidden
              ${event.category === 'VIP' ? 'bg-white text-black' : 'bg-white/5 text-gray-400'}`}>
              {event.portraitUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img 
                  src={event.portraitUrl} 
                  alt={event.firstName} 
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as any).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(event.firstName || 'G')}&background=333&color=fff`; }}
                />
              ) : (
                (event.firstName || event.name || '?').charAt(0)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate tracking-tight">{event.firstName} {event.lastName}</p>
              <div className="flex items-center gap-2 mt-1">
                 {event.category && event.category !== 'Standard' && (
                    <span className={`text-[8px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded border ${event.category === 'VIP' ? 'bg-white text-black border-transparent' : 'border-white/10 text-gray-400'}`}>
                      {event.category}
                    </span>
                 )}
                 <span className="text-[10px] text-gray-600 font-mono">
                    {(() => {
                        const t = event.arrivedAt;
                        if (!t) return 'Just now';
                        try {
                           const date = typeof t === 'object' && 'seconds' in (t as any) ? new Date((t as any).seconds * 1000) : new Date(t as any);
                           return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        } catch { return '—'; }
                    })()}
                 </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
