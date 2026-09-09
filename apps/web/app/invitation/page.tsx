'use client';

import { useEffect, useState } from 'react';

const roleLabels: Record<string, string> = { admin: 'Administrateur', operator: 'Opérateur', reader: 'Lecture' };
export default function InvitationPage() {
  const [token, setToken] = useState('');
  const [csrf, setCsrf] = useState('');
  const [preview, setPreview] = useState<{ name: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [login, setLogin] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  useEffect(() => {
    const incoming = window.location.hash.slice(1);
    if (/^[A-Za-z0-9_-]{43}$/.test(incoming)) sessionStorage.setItem('encave.pendingInvitation', incoming);
    history.replaceState(null, '', '/invitation');
    const saved = sessionStorage.getItem('encave.pendingInvitation') ?? '';
    setToken(saved);
    const abort = new AbortController();
    void (async () => {
      try {
        if (!saved) throw new Error('invalid');
        const response = await fetch('/api/session', { cache: 'no-store', signal: abort.signal });
        if (response.status === 401) { setLogin(true); return; }
        if (!response.ok) throw new Error('unavailable');
        const session = await response.json(); setCsrf(session.csrf);
        const result = await fetch('/api/invitations/preview', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': session.csrf }, body: JSON.stringify({ token: saved }), signal: abort.signal });
        if (!result.ok) throw new Error('invalid');
        setPreview(await result.json());
      } catch { if (!abort.signal.aborted) setError('Cette invitation est indisponible pour ce compte. Vérifiez votre adresse ou demandez un nouveau lien à l’administrateur.'); }
      finally { if (!abort.signal.aborted) setLoading(false); }
    })();
    return () => abort.abort();
  }, []);

  async function accept() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/invitations/accept', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify({ token }) });
      if (!response.ok) throw new Error();
      sessionStorage.removeItem('encave.pendingInvitation'); setToken(''); setSuccess(true);
      const channel = new BroadcastChannel('encave-context'); channel.postMessage('membership_changed'); channel.close();
    } catch { setError('L’invitation n’a pas pu être acceptée. Elle peut avoir expiré ou avoir été révoquée.'); }
    finally { setLoading(false); }
  }
  return <main id="contenu" className="login-page" tabIndex={-1}><p className="brand">EnCave <span>Assistant</span></p><section className="login-card" aria-labelledby="invitation-title"><p className="eyebrow">Invitation à rejoindre une cave</p><h1 id="invitation-title">{success ? 'Vous faites partie de l’équipe' : 'Rejoindre votre équipe'}</h1>
    {loading && <p role="status">Vérification de l’invitation…</p>}
    {error && <div className="alert error" role="alert">{error}</div>}
    {login && <><p>Connectez-vous avec l’adresse à laquelle votre administrateur a destiné cette invitation.</p><a className="button primary" href="/api/auth/start">Se connecter</a></>}
    {preview && !success && <><h2>{preview.name}</h2><dl className="invitation-details"><dt>Votre compte</dt><dd>{preview.email}</dd><dt>Votre rôle</dt><dd>{roleLabels[preview.role]}</dd></dl><p>En acceptant, vous rejoignez cette cave avec les droits indiqués.</p><button className="button primary" type="button" onClick={() => void accept()} disabled={loading}>Accepter l’invitation</button></>}
    {success && <div role="status"><p>Votre accès à {preview?.name} est enregistré.</p><a className="button primary" href="/espace">Ouvrir mon espace</a></div>}
    {!login && !success && !loading && <a className="button secondary" href="/espace">Retour à mon espace</a>}
  </section></main>;
}
