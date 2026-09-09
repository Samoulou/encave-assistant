'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TeamExportsPanel } from './team-exports';

type Role = 'admin' | 'operator' | 'reader';
type Cave = { id: string; name: string; role: Role };
type Session = { identity: { id: string; name: string; email: string }; csrf: string; activeCave: Cave | null; caves: Cave[]; accessRevoked: boolean };
type Member = { id: string; name: string; email: string; role: Role; revokedAt: string | null; version: number };
type Invite = { id: string; email: string; role: Role; acceptedAt: string | null; revokedAt: string | null; expiresAt: string };
type Team = { caveId: string; members: Member[]; invitations: Invite[] };
type Pending = { kind: 'member'; member: Member } | { kind: 'invitation'; invitation: Invite } | { kind: 'switch'; caveId: string };
const labels: Record<Role, string> = { admin: 'Administrateur', operator: 'Opérateur', reader: 'Lecture' };
const messages: Record<string, string> = {
  invalid_email: 'Saisissez une adresse e-mail valide.', invalid_role: 'Choisissez un rôle proposé.',
  already_member: 'Cette personne est déjà membre de la cave.', invitation_pending: 'Une invitation est déjà en attente pour cette adresse.',
  last_administrator: 'Conservez au moins un administrateur actif dans cette cave.', member_changed: 'Ce membre a changé. Actualisez avant de recommencer.',
  cave_changed: 'La cave active a changé dans un autre onglet. Actualisez votre espace.', role_forbidden: 'Votre rôle ne permet pas cette action.',
  access_revoked: 'Votre accès à cette cave a été révoqué.', session_required: 'Votre session a expiré. Reconnectez-vous.',
};

export default function Workspace() {
  const [session, setSession] = useState<Session | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('reader');
  const [fieldError, setFieldError] = useState('');
  const [createdToken, setCreatedToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [hasInvitation, setHasInvitation] = useState(false);
  const generation = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const errorSummary = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const requestGeneration = ++generation.current;
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    setLoading(true); setTeam(null); setError(''); setSession(null);
    try {
      const response = await fetch('/api/session', { cache: 'no-store', signal: controller.signal });
      if (response.status === 401) { window.location.replace('/connexion?session=expiree'); return; }
      if (!response.ok) throw new Error('service_unavailable');
      const snapshot: Session = await response.json();
      if (requestGeneration !== generation.current) return;
      setSession(snapshot);
      if (snapshot.activeCave) {
        const members = await fetch('/api/team', { cache: 'no-store', headers: { 'x-encave-cave': snapshot.activeCave.id }, signal: controller.signal });
        if (!members.ok) { const failure = await members.json(); throw new Error(failure.error); }
        const nextTeam: Team = await members.json();
        if (requestGeneration !== generation.current) return;
        if (nextTeam.caveId !== snapshot.activeCave.id) throw new Error('cave_changed');
        setTeam(nextTeam);
      }
    } catch (failure) {
      if (!controller.signal.aborted && requestGeneration === generation.current) setError(messages[(failure as Error).message] ?? 'Votre espace est indisponible. Réessayez dans un instant.');
    } finally { if (requestGeneration === generation.current) setLoading(false); }
  }, []);

  useEffect(() => {
    void load(); setHasInvitation(Boolean(sessionStorage.getItem('encave.pendingInvitation')));
    const current = new BroadcastChannel('encave-context'); channel.current = current;
    const refresh = () => { setEmail(''); setCreatedToken(''); setFieldError(''); setPending(null); setStatus(''); void load(); };
    current.onmessage = refresh;
    const focusRefresh = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', focusRefresh);
    return () => { generation.current++; abort.current?.abort(); current.close(); document.removeEventListener('visibilitychange', focusRefresh); };
  }, [load]);

  useEffect(() => {
    if (pending && dialog.current && !dialog.current.open) dialog.current.showModal();
    else if (!pending && dialog.current?.open) { dialog.current.close(); opener.current?.focus(); }
  }, [pending]);

  async function command(path: string, body: object) {
    if (!session) throw new Error('session_required');
    const requestGeneration = generation.current;
    const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': session.csrf, 'x-encave-cave': session.activeCave?.id ?? '' }, body: JSON.stringify(body) });
    const result = await response.json();
    if (requestGeneration !== generation.current) throw new Error('cave_changed');
    if (!response.ok) throw new Error(result.error);
    return result;
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault(); setFieldError(''); setError(''); setStatus(''); setCreatedToken(''); setBusy(true);
    try {
      const result = await command('/api/invitations', { email, role });
      setCreatedToken(result.token); setEmail(''); setRole('reader');
      await load(); setStatus('Invitation créée. Copiez le lien puis transmettez-le à la personne invitée. Aucun e-mail n’a été envoyé.');
    } catch (failure) {
      const code = (failure as Error).message;
      setFieldError(messages[code] ?? 'L’invitation n’a pas pu être créée. Vos informations sont conservées.');
      requestAnimationFrame(() => errorSummary.current?.focus());
    } finally { setBusy(false); }
  }

  function ask(action: Pending, source: HTMLElement) { opener.current = source; setPending(action); setError(''); }
  async function switchCave(caveId: string) {
    setBusy(true); setTeam(null); setCreatedToken('');
    try { await command('/api/caves/switch', { caveId }); setEmail(''); setFieldError(''); setPending(null); channel.current?.postMessage('cave_changed'); await load(); }
    catch (failure) { setError(messages[(failure as Error).message] ?? 'Le changement de cave a échoué. Actualisez votre espace.'); }
    finally { setBusy(false); }
  }
  async function confirm() {
    if (!pending) return;
    if (pending.kind === 'switch') { await switchCave(pending.caveId); return; }
    setBusy(true); setError('');
    try {
      if (pending.kind === 'member') await command('/api/members/revoke', { identityId: pending.member.id, version: pending.member.version });
      else await command('/api/invitations/revoke', { id: pending.invitation.id });
      setPending(null); channel.current?.postMessage('membership_changed'); await load(); setStatus('L’accès a été révoqué pour cette cave.');
    } catch (failure) { setError(messages[(failure as Error).message] ?? 'La révocation a échoué. Aucun succès n’est confirmé.'); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true);
    try { await command('/api/auth/logout', {}); channel.current?.postMessage('logout'); window.location.assign('/connexion'); }
    catch { setError('La déconnexion n’a pas pu être confirmée. Réessayez.'); setBusy(false); }
  }

  const active = session?.activeCave;
  const liveMembers = team?.members.filter(member => !member.revokedAt) ?? [];
  const liveInvitations = team?.invitations.filter(invitation => !invitation.acceptedAt && !invitation.revokedAt) ?? [];
  return <div className="workspace-shell">
    <aside className="workspace-nav"><p className="brand">EnCave <span>Assistant</span></p><nav aria-label="Navigation principale"><a href="/demandes">Demandes</a><a href="/connexions">Connexions</a><a href="/espace" aria-current="page">Paramètres</a></nav><p className="nav-caption">Votre équipe, réunie autour de votre cave.</p></aside>
    <div className="workspace-content">
      <header className="workspace-header">
        <div><p className="eyebrow">Cave active</p><strong data-testid="active-cave">{active?.name ?? (loading ? 'Chargement de votre cave…' : 'Aucune cave active')}</strong>
          {session && (session.caves.length > 1 || (!active && session.caves.length > 0)) && <label className="cave-picker">Changer de cave<select aria-label="Changer de cave" value={active?.id ?? ''} disabled={busy || loading} onChange={event => {
            const caveId = event.target.value;
            if (email) ask({ kind: 'switch', caveId }, event.currentTarget); else void switchCave(caveId);
          }}><option value="" disabled>Choisir une cave</option>{session.caves.map(cave => <option key={cave.id} value={cave.id}>{cave.name}</option>)}</select></label>}
        </div>
        {session && <div className="account"><span>{session.identity.name}</span><button type="button" className="button secondary" disabled={busy} onClick={() => void logout()}>Se déconnecter</button></div>}
      </header>
      <main id="contenu" className="workspace-main" tabIndex={-1}>
        <p className="eyebrow">Paramètres / Équipe</p><h1>Les accès de votre équipe</h1><p className="muted">Chaque personne dispose des droits utiles à son travail dans la cave.</p>
        {hasInvitation && <div className="alert warning"><a href="/invitation">Examiner votre invitation</a></div>}
        {loading && <div className="loading-state" role="status">Chargement des accès de votre équipe…</div>}
        {error && !pending && <div className="alert error" role="alert"><p>{error}</p><button type="button" className="button secondary" onClick={() => void load()}>Actualiser l’espace</button><a className="button secondary" href="/connexion">Se reconnecter</a></div>}
        {status && <div className="alert success" role="status">{status}</div>}
        {createdToken && <button className="button secondary" type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(window.location.origin + '/invitation#' + createdToken); setStatus('Lien copié. Transmettez-le à la personne invitée ; il expire dans 48 heures.'); }
          catch { setStatus('La copie est indisponible. Autorisez le presse-papiers de ce site puis réessayez.'); }
        }}>Copier le lien d’invitation</button>}
        {!loading && session?.accessRevoked && <section className="empty-state"><h2>Votre accès à cette cave a été révoqué</h2><p>Contactez son administrateur. Vos autres caves autorisées restent disponibles dans le sélecteur.</p></section>}
        {!loading && session && !active && !session.accessRevoked && <section className="empty-state"><h2>Votre compte n’est lié à aucune cave</h2><p>Ouvrez l’invitation transmise par votre administrateur pour rejoindre son équipe.</p></section>}
        {!loading && active && team && <>
          <section className="team-panel" aria-labelledby="members-title"><div className="section-heading"><h2 id="members-title">Membres</h2><span className="count">{liveMembers.length} actifs</span></div>
            {active.role !== 'admin' && <div className="alert info">Votre accès est « {labels[active.role]} ». Un administrateur gère les invitations et les révocations.</div>}
            <ul className="member-list">{team.members.map(member => <li key={member.id} className="member-row"><div className="member-identity"><strong>{member.name}{member.id === session.identity.id ? ' (vous)' : ''}</strong><span className="muted">{member.email}</span></div><span className={'role-badge' + (member.revokedAt ? ' revoked' : '')}>{member.revokedAt ? 'Accès révoqué' : labels[member.role]}</span>
              {active.role === 'admin' && !member.revokedAt && <button type="button" className="button danger-quiet" aria-label={`Révoquer l’accès de ${member.name}`} onClick={event => ask({ kind: 'member', member }, event.currentTarget)} disabled={busy}>Révoquer</button>}</li>)}</ul>
          </section>
          {active.role === 'admin' && <section className="invite-panel" aria-labelledby="invite-title"><h2 id="invite-title">Inviter une personne</h2><p className="muted">Créez un lien valable 48 heures. La personne devra se connecter avec cette adresse pour l’accepter.</p>
            <form onSubmit={invite} noValidate>
              {fieldError && <div className="alert error" role="alert" tabIndex={-1} ref={errorSummary}><strong>Vérifiez l’invitation</strong><p><a href="#invite-email">{fieldError}</a></p></div>}
              <div className="form-grid"><div><label htmlFor="invite-email">Adresse e-mail</label><input id="invite-email" name="email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? 'invite-error' : 'invite-help'} disabled={busy}/><p id="invite-help" className="help">L’adresse liée à son compte professionnel.</p>{fieldError && <p id="invite-error" className="field-error">{fieldError}</p>}</div>
              <div><label htmlFor="invite-role">Rôle dans cette cave</label><select id="invite-role" value={role} onChange={event => setRole(event.target.value as Role)} disabled={busy}><option value="reader">Lecture</option><option value="operator">Opérateur</option><option value="admin">Administrateur</option></select><p className="help">L’administrateur peut gérer les accès de l’équipe.</p></div></div>
              <button className="button primary" type="submit" disabled={busy}>{busy ? 'Création en cours…' : 'Créer l’invitation'}</button>
            </form>
            <h3>Invitations en attente</h3>{liveInvitations.length === 0 ? <p className="muted">Aucune invitation en attente.</p> : <ul className="member-list">{liveInvitations.map(invitation => <li key={invitation.id} className="member-row"><div className="member-identity"><strong>{invitation.email}</strong><span className="muted">{labels[invitation.role]} · {Date.parse(invitation.expiresAt) < Date.now() ? 'Expirée' : 'En attente d’acceptation'}</span></div><button className="button danger-quiet" type="button" aria-label={`Révoquer l’invitation pour ${invitation.email}`} onClick={event => ask({ kind: 'invitation', invitation }, event.currentTarget)} disabled={busy}>Révoquer</button></li>)}</ul>}
          </section>}
          {active.role === 'admin' && <TeamExportsPanel key={`${active.id}:${session.identity.id}:${session.csrf}`} caveId={active.id} caveName={active.name} csrf={session.csrf} onAccessChanged={load}/>}
        </>}
      </main>
      <dialog ref={dialog} className="confirm-dialog" aria-labelledby="dialog-title" aria-busy={busy} onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const first = controls[0], last = controls.at(-1);
        if (!first || !last) { event.preventDefault(); return; }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }} onCancel={event => { if (busy) event.preventDefault(); else setPending(null); }}>
        {pending && <><p className="eyebrow">{active?.name}</p><h2 id="dialog-title">{pending.kind === 'switch' ? 'Changer de cave ?' : 'Révoquer cet accès ?'}</h2><p>{pending.kind === 'switch' ? 'Les informations de votre invitation non enregistrée seront effacées.' : pending.kind === 'member' ? `${pending.member.name} perdra l’accès à cette cave, y compris depuis une session déjà ouverte. Ses autres caves ne seront pas affectées.` : `Le lien d’invitation pour ${pending.invitation.email} ne pourra plus être accepté.`}</p>
          {error && <div className="alert error" role="alert">{error}</div>}<div className="dialog-actions"><button className="button secondary" type="button" autoFocus disabled={busy} onClick={() => setPending(null)}>Annuler</button><button className="button danger" type="button" disabled={busy} onClick={() => void confirm()}>{busy ? 'Traitement en cours…' : pending.kind === 'switch' ? 'Changer et effacer' : 'Confirmer la révocation'}</button></div></>}
      </dialog>
    </div>
  </div>;
}
