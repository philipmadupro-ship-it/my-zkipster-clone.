import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { type GuestData } from './AddGuestModal';
import { type CampaignData } from './AdminDashboard';
import RichTextEditor from './RichTextEditor';

interface Props {
  campaign: CampaignData;
  guests: GuestData[];
  onClose: () => void;
  onSent: (success: number, failed: number) => void;
}

export default function SendInvitationsModal({ campaign, guests, onClose, onSent }: Props) {
  const [subject, setSubject] = useState(campaign.name ? `Exclusive Invitation: ${campaign.name}` : 'Exclusive Invitation: Emanuel Ungaro FW26');
  const [customMessage, setCustomMessage] = useState(campaign.emailMessage || '');
  const [language, setLanguage] = useState<'en' | 'fr'>(campaign.language || 'en');
  const [logoVariant, setLogoVariant] = useState(campaign.logoVariant || 'black');
  const [emailImageUrl, setEmailImageUrl] = useState(campaign.emailImageUrl || '');
  
  const [target, setTarget] = useState<'all' | 'uninvited'>('uninvited');
  const [sending, setSending] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [view, setView] = useState<'edit' | 'preview'>('edit');

  const targetGuests = target === 'all' 
    ? guests 
    : guests.filter(g => g.status === 'pending' || g.status === 'invited');

  async function handleSend() {
    if (targetGuests.length === 0) {
      setError('No guests match the selected criteria.');
      return;
    }

    setSending(true);
    setError('');
    setSentCount(0);
    
    try {
      // 1. Sync branding settings to Firestore Campaign doc first
      const campRef = doc(db, 'campaigns', campaign.id);
      await updateDoc(campRef, {
        language,
        logoVariant,
        emailImageUrl,
        emailMessage: customMessage
      });

      // 2. Batch dispatch
      const BATCH_SIZE = 100;
      const guestIds = targetGuests.map(g => g.id);
      const chunks: string[][] = [];
      
      for (let i = 0; i < guestIds.length; i += BATCH_SIZE) {
        chunks.push(guestIds.slice(i, i + BATCH_SIZE));
      }
      
      setTotalBatches(chunks.length);
      let totalSuccess = 0;
      let totalFailed = 0;

      for (let i = 0; i < chunks.length; i++) {
        setCurrentBatch(i + 1);
        
        const res = await fetch('/api/send-bulk-invitation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId: campaign.id,
            guestIds: chunks[i],
            subject,
            customMessage,
            origin: window.location.origin,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Failed to dispatch batch ${i + 1}`);
        
        totalSuccess += data.count || 0;
        totalFailed += data.failed || 0;
        setSentCount(totalSuccess);
      }

      onSent(totalSuccess, totalFailed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSending(false);
      setCurrentBatch(0);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 text-left">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white rounded-sm shadow-2xl overflow-hidden animate-fade-up h-[90vh] flex flex-col mx-4 sm:mx-0">
        
        {/* Header */}
        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-luxury-off-white">
          <div>
            <h3 className="font-cormorant text-2xl text-luxury-dark uppercase tracking-widest leading-none">Couture Dispatch</h3>
            <p className="text-[10px] text-luxury-muted uppercase tracking-[0.2em] mt-2">Bulk Invitation Management</p>
          </div>
          <button onClick={onClose} className="text-luxury-muted hover:text-luxury-dark transition-colors text-xl font-light">✕</button>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-luxury-off-white border-b border-gray-100">
          <button
            onClick={() => setView('edit')}
            className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 ${
              view === 'edit' ? 'text-luxury-dark bg-white border-b-2 border-luxury-dark shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            1. Edit Narrative
          </button>
          <button
            onClick={() => setView('preview')}
            className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 ${
              view === 'preview' ? 'text-luxury-dark bg-white border-b-2 border-luxury-dark shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            2. High-Fidelity Preview
          </button>
        </div>

        <div className="p-10 space-y-10 max-h-[75vh] overflow-y-auto custom-scrollbar">
          
          {view === 'edit' ? (
            <div className="space-y-10">
              {/* Section 1: Audience & Identity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <label className="text-[10px] uppercase tracking-[0.3em] font-bold text-luxury-muted">Target Audience</label>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setTarget('uninvited')}
                      className={`py-3 px-4 rounded-sm border text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${
                        target === 'uninvited' 
                          ? 'bg-luxury-dark text-white border-luxury-dark shadow-lg' 
                          : 'bg-white text-luxury-muted border-gray-100 hover:border-gray-300'
                      }`}
                    >
                      Pending Only ({guests.filter(g => g.status === 'pending' || g.status === 'invited').length})
                    </button>
                    <button
                      onClick={() => setTarget('all')}
                      className={`py-3 px-4 rounded-sm border text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${
                        target === 'all' 
                          ? 'bg-luxury-dark text-white border-luxury-dark shadow-lg' 
                          : 'bg-white text-luxury-muted border-gray-100 hover:border-gray-300'
                      }`}
                    >
                      All Guests ({guests.length})
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] uppercase tracking-[0.3em] font-bold text-luxury-muted">Campaign Language</label>
                  <div className="flex gap-2">
                    {(['en', 'fr'] as const).map((l) => (
                      <button
                        key={l}
                        onClick={() => setLanguage(l)}
                        className={`flex-1 py-3 border rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${
                          language === l
                            ? 'bg-luxury-gold text-white border-luxury-gold shadow-md'
                            : 'bg-white text-luxury-muted border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        {l === 'en' ? 'English' : 'Français'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <hr className="border-gray-50" />

              {/* Section 2: Logo Selection */}
              <div className="space-y-4">
                <label className="text-[10px] uppercase tracking-[0.3em] font-bold text-luxury-muted block">Visual Branding (Logo Selection)</label>
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { id: 'black', label: 'Text Black', preview: 'EU' },
                    { id: 'white', label: 'Text White', preview: 'EU', bg: 'bg-black' },
                    { id: 'img-pink', label: 'Official Pink', src: '/email-logos/ungaro-pink.png' },
                    { id: 'img-black', label: 'Official Black', src: '/email-logos/ungaro-black.png' },
                    { id: 'img-white', label: 'Official White', src: '/email-logos/ungaro-white.png', bg: 'bg-black' }
                  ].map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() => setLogoVariant(variant.id as any)}
                      className={`relative aspect-square rounded-lg border-2 overflow-hidden transition-all duration-300 flex flex-col items-center justify-center gap-1 ${
                        variant.bg || 'bg-gray-50'
                      } ${
                        logoVariant === variant.id 
                          ? 'border-luxury-gold ring-4 ring-luxury-gold/10' 
                          : 'border-transparent hover:border-gray-200'
                      }`}
                    >
                      {variant.src ? (
                        <img src={variant.src} alt={variant.label} className="w-12 h-auto object-contain" />
                      ) : (
                        <span className={`text-xl font-serif font-bold ${variant.id === 'white' ? 'text-white' : 'text-black'}`}>{variant.preview}</span>
                      )}
                      <span className={`text-[7px] uppercase tracking-tighter ${variant.id.includes('white') ? 'text-gray-400' : 'text-gray-500'}`}>{variant.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 3: Subject & Narrative */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.3em] font-bold text-luxury-muted">Couture Subject Line</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="w-full bg-transparent border-b border-gray-100 py-3 text-sm text-luxury-dark outline-none focus:border-luxury-gold transition-all duration-500 font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.3em] font-bold text-luxury-muted">Personalized Narrative (Rich Text)</label>
                  <div className="border border-gray-100 rounded-sm overflow-hidden bg-gray-50/30">
                    <RichTextEditor
                      value={customMessage}
                      onChange={setCustomMessage}
                      placeholder="Draft your exquisite invitation message..."
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Decoration Image (Drag & Drop) */}
              <div className="space-y-4">
                <label className="text-[10px] uppercase tracking-[0.3em] font-bold text-luxury-muted">Decoration Image (Drag & Drop from Computer)</label>
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    // Native file drop from OS
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      const file = e.dataTransfer.files[0];
                      if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setEmailImageUrl(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                        return;
                      }
                    }
                    // URL text drop fallback
                    const text = e.dataTransfer.getData('text');
                    if (text && text.startsWith('http')) setEmailImageUrl(text);
                  }}
                  className={`border-2 border-dashed rounded-xl p-8 transition-all duration-500 flex flex-col items-center justify-center text-center gap-3 relative overflow-hidden cursor-pointer ${
                    isDragging 
                      ? 'border-luxury-gold bg-luxury-gold/5 scale-[1.02]' 
                      : emailImageUrl 
                        ? 'border-emerald-500/20 bg-emerald-500/5' 
                        : 'border-gray-100 hover:border-gray-300 bg-gray-50/50'
                  }`}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (ev) => {
                      const file = (ev.target as HTMLInputElement).files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setEmailImageUrl(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    };
                    input.click();
                  }}
                >
                  {emailImageUrl ? (
                    <>
                      <img src={emailImageUrl} alt="Decoration Preview" className="h-20 w-auto object-cover rounded shadow-sm mb-2" />
                      <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Image Mounted</p>
                      <button onClick={(e) => { e.stopPropagation(); setEmailImageUrl(''); }} className="text-[9px] text-gray-400 hover:text-red-500 underline uppercase tracking-tighter">Remove</button>
                    </>
                  ) : (
                    <>
                      <div className="text-3xl grayscale opacity-20">🖼️</div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Drop image file or click to browse</p>
                      <p className="text-[8px] text-gray-400 uppercase tracking-wider">PNG, JPG, WebP accepted</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* PREVIEW VIEW */
            <div className="bg-gray-50 p-6 sm:p-10 rounded-sm border border-gray-100 shadow-inner animate-in fade-in duration-500 overflow-x-hidden">
               <div className="max-w-[450px] mx-auto bg-white shadow-2xl border border-gray-100 overflow-hidden w-full">
                  {/* Real-time Email Header - Smart Logic */}
                  {(() => {
                    const isDark = logoVariant === 'white' || logoVariant === 'img-white';
                    const logoColor = isDark ? '#FFFFFF' : '#000000';
                    return (
                      <div className={`p-10 text-center ${isDark ? 'bg-black' : 'bg-white'}`}>
                         {logoVariant === 'black' || logoVariant === 'white' ? (
                            <span className={`text-2xl font-serif font-bold uppercase tracking-[0.3em] transition-all`} style={{ color: logoColor }}>
                               Emanuel Ungaro
                            </span>
                         ) : (
                            <img 
                              src={`/email-logos/ungaro-${logoVariant.replace('img-', '')}.png`} 
                              alt="Brand Logo" 
                              className="h-12 mx-auto object-contain" 
                            />
                         )}
                      </div>
                    );
                  })()}

                  <div className="border-t border-gray-50 p-10 text-center space-y-8">
                     <div className="space-y-2">
                       <p className="text-[10px] text-luxury-gold font-bold uppercase tracking-[0.4em]">
                         {language === 'fr' ? 'Invitation Exclusive' : 'Exclusive Invitation'}
                       </p>
                       <h1 className="text-3xl font-cormorant text-luxury-dark leading-tight italic">
                         {campaign.name}
                       </h1>
                     </div>

                     <div 
                        className="text-[13px] text-gray-600 leading-relaxed rich-text-preview text-left overflow-hidden"
                        dangerouslySetInnerHTML={{ __html: customMessage || (language === 'fr' ? 'Votre message personnel s\'affichera ici...' : 'Your personal message will appear here...') }}
                     />

                     <div className="pt-8 pb-10 border-t border-gray-50">
                        <div className="inline-block px-10 py-4 bg-luxury-dark text-white text-[10px] font-bold uppercase tracking-[0.3em] rounded-sm shadow-xl">
                          {language === 'fr' ? 'Confirmer Présence' : 'Confirm Attendance'}
                        </div>
                        <p className="text-[9px] text-gray-400 mt-6 uppercase tracking-widest italic">
                          {language === 'fr' ? 'RSVP personnel ci-joint' : 'Personal RSVP attached'}
                        </p>
                     </div>

                     {emailImageUrl && (
                       <div className="pt-8 border-t border-gray-50">
                         <img src={emailImageUrl} alt="Decoration" className="w-full h-auto grayscale opacity-90 transition-all duration-700 hover:grayscale-0 hover:opacity-100" />
                       </div>
                     )}
                  </div>
               </div>
               
               <div className="mt-8 text-center text-[10px] text-gray-400 font-medium uppercase tracking-widest flex items-center justify-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                 Production Mirror Protocol Active
               </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-[11px] font-medium rounded-sm uppercase tracking-wider">
              {error}
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="p-8 bg-white border-t border-gray-50">
          <button
            onClick={handleSend}
            disabled={sending || targetGuests.length === 0}
            className="w-full bg-luxury-dark hover:bg-black disabled:opacity-50 text-white font-bold py-5 rounded-sm transition-all duration-500 text-[12px] uppercase tracking-[0.4em] shadow-xl active:scale-95 flex items-center justify-center gap-3"
          >
            {sending ? (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Dispatching Wave {currentBatch} of {totalBatches}...</span>
                </div>
                <span className="text-[10px] opacity-60 font-normal lowercase tracking-widest">
                  ({sentCount} / {targetGuests.length} Delivered)
                </span>
              </div>
            ) : (
              `Send Invitations to ${targetGuests.length} Guests`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
