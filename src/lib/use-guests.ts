'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { authedFetch } from '@/lib/api-client';
import type { GuestRecord } from '@/lib/guest-list';

async function readJson(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

/**
 * Keeps a campaign's guest list fresh by polling while the tab is visible.
 *
 * Changes made on this screen (a check-in) go through `updateGuests`, which also
 * discards any refresh that was already on its way: otherwise a slow response
 * carrying the old state would flip the row back for a moment. Callers follow
 * up with `refresh()` to confirm with the server.
 */
export function useGuests<T extends GuestRecord = GuestRecord>(
  campaignId: string | null | undefined,
  enabled: boolean,
  intervalMs = 4000,
) {
  const [guests, setGuests] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);
  const version = useRef(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const updateGuests = useCallback((fn: (prev: T[]) => T[]) => {
    version.current += 1;
    setGuests(fn);
  }, []);

  // Clear the previous campaign's guests the moment another one is opened.
  useEffect(() => {
    version.current += 1;
    setGuests([]);
    setLoaded(false);
  }, [campaignId]);

  useEffect(() => {
    if (!enabled || !campaignId) return;
    let cancelled = false;

    async function load() {
      const startedAt = version.current;
      try {
        const body = await readJson(await authedFetch(`/api/guests?campaignId=${encodeURIComponent(campaignId as string)}`));
        if (cancelled || version.current !== startedAt) return; // stale: something changed meanwhile
        setGuests(body.guests as T[]);
        setLoaded(true);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(`Could not load guests: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    load();
    const timer = setInterval(onVisible, intervalMs);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, campaignId, intervalMs, tick]);

  return { guests, updateGuests, error, loaded, refresh };
}

export interface CampaignSummary {
  id: string;
  name: string;
  eventDate?: string;
  eventVenue?: string;
  [key: string]: unknown;
}

/** The campaign list, refreshed every so often. */
export function useCampaigns(enabled: boolean, intervalMs = 15000) {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function load() {
      try {
        const body = await readJson(await authedFetch('/api/campaigns'));
        if (cancelled) return;
        setCampaigns(body.campaigns as CampaignSummary[]);
        setLoaded(true);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(`Could not load campaigns: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    load();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, intervalMs);
    return () => { cancelled = true; clearInterval(timer); };
  }, [enabled, intervalMs]);

  return { campaigns, error, loaded };
}
