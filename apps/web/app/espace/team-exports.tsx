'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

type Item = { id: string; caveId: string; state: 'pending' | 'ready' | 'refused' | 'failed' | 'expired'; error: string | null; createdAt: string; expiresAt: string };
const labels = { pending: 'Préparation en attente', ready: 'Prêt à télécharger', refused: 'Export refusé', failed: 'Préparation échouée', expired: 'Fichier expiré' };

export function TeamExportsPanel({ caveId, caveName, csrf, onAccessChanged }: { caveId: string; caveName: string; csrf: string; onAccessChanged: () => Promise<void> }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const mounted = useRef(false), abort = useRef<AbortController | null>(null), requestKey = useRef('');
  const generation = useRef(0);
  const check = useCallback(async (response: Response) => {
    if ([401, 403, 409].includes(response.status)) {
      if (mounted.current) { setItems([]); void onAccessChanged(); }
      throw new Error('Les accès ou la cave ont changé. Votre espace est actualisé.');
    }
    if (response.status === 410) throw new Error('Ce fichier a expiré. Préparez un nouvel export.');
    if (!response.ok) throw new Error('L’export est indisponible. Réessayez ; aucun nouveau fichier n’est confirmé.');
  }, [onAccessChanged]);
  const refresh = useCallback(async () => {
    const requestGeneration = ++generation.current;
    try {
      const response = await fetch('/api/team/exports', { cache: 'no-store', headers: { 'x-encave-cave': caveId }, signal: abort.current?.signal });
      await check(response); const body = await response.json();
      if (!mounted.current || requestGeneration !== generation.current) return;
      if (body.caveId !== caveId || body.exports.some((item: Item) => item.caveId !== caveId)) throw new Error('La cave de l’export ne correspond pas à votre espace.');
      setItems(body.exports); setError('');
    } catch (failure) { if (mounted.current && requestGeneration === generation.current && !abort.current?.signal.aborted) setError((failure as Error).message); }
    finally { if (mounted.current && requestGeneration === generation.current) setLoading(false); }
  }, [caveId, check]);
  useEffect(() => {
    mounted.current = true; abort.current = new AbortController(); void refresh();
    return () => { mounted.current = false; abort.current?.abort(); };
  }, [refresh]);
  useEffect(() => {
    if (!items.some(item => item.state === 'pending' || item.state === 'ready')) return;
    const timer = setInterval(() => { void refresh(); }, 1500); return () => clearInterval(timer);
  }, [items, refresh]);

  async function create() {
    generation.current++;
    setBusy(true); setError(''); if (!requestKey.current) requestKey.current = crypto.randomUUID();
    try {
      const response = await fetch('/api/team/exports', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf, 'x-encave-cave': caveId, 'idempotency-key': requestKey.current }, body: '{}', signal: abort.current?.signal });
      await check(response); const item: Item = await response.json(); if (!mounted.current) return;
      if (item.caveId !== caveId) throw new Error('La cave de l’export ne correspond pas à votre espace.');
      generation.current++; requestKey.current = ''; setItems(current => [item, ...current.filter(existing => existing.id !== item.id)].slice(0, 10));
    } catch (failure) { if (mounted.current && !abort.current?.signal.aborted) setError((failure as Error).message); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function download(item: Item) {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/team/exports/${item.id}/download`, { cache: 'no-store', headers: { 'x-encave-cave': caveId }, signal: abort.current?.signal });
      if (response.status === 410 && mounted.current) { generation.current++; setItems(current => current.map(existing => existing.id === item.id ? { ...existing, state: 'expired' } : existing)); }
      await check(response); const blob = await response.blob(); if (!mounted.current) return;
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `equipe-${item.id}.csv`; link.click(); URL.revokeObjectURL(url);
    } catch (failure) { if (mounted.current && !abort.current?.signal.aborted) setError((failure as Error).message); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <section className="team-panel export-panel" aria-labelledby="exports-title">
    <h2 id="exports-title">Exporter l’équipe</h2><p className="muted">La liste des membres de {caveName}, au format CSV. Chaque fichier reste disponible jusqu’à la date indiquée.</p>
    <button type="button" className="button secondary" onClick={() => void create()} disabled={busy || loading}>{busy ? 'Traitement de l’export…' : 'Préparer un export CSV'}</button>
    {loading && <p role="status">Chargement de vos exports…</p>}
    {error && <div className="alert error" role="alert"><p>{error}</p><button className="button secondary" type="button" onClick={() => void refresh()}>Actualiser les exports</button></div>}
    {!loading && !error && !items.length && <p className="muted">Aucun export pour cette cave.</p>}
    <ul className="export-list">{items.map(item => <li key={item.id} className="export-row" data-export-id={item.id}>
      <div><strong>{labels[item.state]}</strong><span className="muted">Demandé le {new Date(item.createdAt).toLocaleString('fr-CH', { timeZone: 'Europe/Zurich', dateStyle: 'short', timeStyle: 'short' })}</span><span className="muted">Disponible jusqu’au {new Date(item.expiresAt).toLocaleString('fr-CH', { timeZone: 'Europe/Zurich', dateStyle: 'short', timeStyle: 'short' })}</span></div>
      {item.state === 'pending' && <p role="status">Le serveur prépare votre fichier. Vous pouvez revenir plus tard.</p>}
      {item.state === 'ready' && <button className="button secondary" type="button" disabled={busy} onClick={() => void download(item)}>Télécharger le CSV</button>}
      {['refused', 'failed', 'expired'].includes(item.state) && <p>{item.error === 'access_changed' ? 'Cet export n’est plus accessible avec vos droits actuels.' : item.state === 'expired' || item.error === 'export_expired' ? 'La durée de disponibilité est dépassée. Préparez un nouvel export.' : 'Le fichier n’a pas pu être préparé. Contactez votre administrateur.'}</p>}
    </li>)}</ul>
  </section>;
}
