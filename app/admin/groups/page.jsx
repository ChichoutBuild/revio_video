'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export default function AdminGroupsPage() {
  const [groups, setGroups] = useState(null);
  const [orgUsers, setOrgUsers] = useState([]);
  const [members, setMembers] = useState({}); // groupId -> [user_id]
  const [newGroupName, setNewGroupName] = useState('');
  const [notLoggedIn, setNotLoggedIn] = useState(false);
  const [error, setError] = useState(null);

  async function loadAll() {
    if (!supabase) {
      setError('Client Supabase non configuré.');
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      setNotLoggedIn(true);
      return;
    }

    const { data: groupRows, error: groupsError } = await supabase
      .from('user_groups')
      .select('id, name, is_auto')
      .order('is_auto', { ascending: false })
      .order('name', { ascending: true });
    if (groupsError) {
      setError(groupsError.message);
      return;
    }
    setGroups(groupRows || []);

    const { data: userRows } = await supabase
      .from('users')
      .select('id, display_name, status')
      .order('display_name', { ascending: true });
    setOrgUsers(userRows || []);

    if (groupRows && groupRows.length) {
      const { data: memberRows } = await supabase
        .from('user_group_members')
        .select('group_id, user_id')
        .in('group_id', groupRows.map((g) => g.id));
      const grouped = {};
      (memberRows || []).forEach((m) => {
        grouped[m.group_id] = grouped[m.group_id] || [];
        grouped[m.group_id].push(m.user_id);
      });
      setMembers(grouped);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    const { data: sessionData } = await supabase.auth.getSession();
    // organization_id n'est pas dans le JWT — on le récupère via la ligne
    // "users" de l'utilisateur connecté.
    const { data: me } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', sessionData.session.user.id)
      .single();

    const { error: insertError } = await supabase
      .from('user_groups')
      .insert({ organization_id: me.organization_id, name: newGroupName.trim() });

    if (insertError) {
      alert(`Impossible de créer le groupe : ${insertError.message}`);
      return;
    }
    setNewGroupName('');
    await loadAll();
  }

  async function toggleMember(groupId, userId, isMember) {
    if (isMember) {
      const { error: delError } = await supabase
        .from('user_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);
      if (delError) {
        alert(`Impossible de retirer ce membre : ${delError.message}`);
        return;
      }
    } else {
      const { error: insError } = await supabase
        .from('user_group_members')
        .insert({ group_id: groupId, user_id: userId });
      if (insError) {
        alert(`Impossible d'ajouter ce membre : ${insError.message}`);
        return;
      }
    }
    await loadAll();
  }

  if (notLoggedIn) {
    return (
      <main style={{ maxWidth: 640, margin: '40px auto', padding: '0 16px' }}>
        <div className="card">
          <p>
            Tu n&apos;es pas connecté. Va sur <a href="/activate">/activate</a>.
          </p>
        </div>
      </main>
    );
  }
  if (error) {
    return (
      <main style={{ maxWidth: 640, margin: '40px auto', padding: '0 16px' }}>
        <p className="error">{error}</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 640, margin: '40px auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1>Catégories de vérificateurs</h1>
      <p className="muted">
        Crée des groupes (ex. « Audio », « Montage »...) et ajoute-y des utilisateurs existants. Le
        groupe <strong>Tout le monde</strong> est automatique : chaque nouvel utilisateur y est
        ajouté à sa création, sans intervention manuelle.
      </p>

      <div className="card">
        <label>Nouveau groupe</label>
        <div className="row">
          <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Audio" />
          <button onClick={handleCreateGroup} disabled={!newGroupName.trim()}>
            Créer
          </button>
        </div>
      </div>

      {!groups && <p className="muted">Chargement...</p>}

      {groups &&
        groups.map((g) => (
          <div className="card" key={g.id}>
            <p style={{ fontWeight: 600, marginTop: 0 }}>
              {g.name} {g.is_auto && <span className="muted">(automatique — non modifiable)</span>}
            </p>
            {orgUsers.map((u) => {
              const isMember = (members[g.id] || []).includes(u.id);
              return (
                <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  <input
                    type="checkbox"
                    checked={isMember}
                    disabled={g.is_auto}
                    onChange={() => toggleMember(g.id, u.id, isMember)}
                  />
                  {u.display_name} {u.status !== 'ACTIVE' && <span className="muted">({u.status})</span>}
                </label>
              );
            })}
            {orgUsers.length === 0 && <p className="muted">Aucun utilisateur dans l&apos;organisation.</p>}
          </div>
        ))}
    </main>
  );
}
