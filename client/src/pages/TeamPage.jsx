import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Plus,
  Trash2,
  Mail,
  AlertCircle,
  X,
  Crown,
  Clock,
  CheckCircle,
} from 'lucide-react';
import api from '../lib/api';
import useAuthStore from '../store/authStore';

// ─── Role badge ───────────────────────────────────────────────────────────────
const ROLE_STYLES = {
  admin:   'bg-accent-purple/10 text-accent-purple border-accent-purple/20',
  manager: 'bg-accent-green/10 text-accent-green border-accent-green/20',
  member:  'bg-accent-blue/10 text-accent-blue border-accent-blue/20',
};

function RoleBadge({ role }) {
  const cls = ROLE_STYLES[role?.toLowerCase()] || ROLE_STYLES.member;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {role?.toLowerCase() === 'admin' && <Crown className="w-2.5 h-2.5" />}
      {(role || 'member').charAt(0).toUpperCase() + (role || 'member').slice(1)}
    </span>
  );
}

// ─── Avatar circle ────────────────────────────────────────────────────────────
function Avatar({ name, size = 'md' }) {
  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';
  const sizeClass = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center font-bold text-white shrink-0`}>
      {initials}
    </div>
  );
}

// ─── Plan badge ───────────────────────────────────────────────────────────────
const PLAN_STYLES = {
  pro:      'bg-accent-purple/10 text-accent-purple border-accent-purple/20',
  starter:  'bg-text-secondary/10 text-text-secondary border-text-secondary/20',
  business: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20',
  free:     'bg-text-secondary/10 text-text-secondary border-text-secondary/20',
};

function PlanBadge({ plan }) {
  const cls = PLAN_STYLES[(plan || 'free').toLowerCase()] || PLAN_STYLES.free;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {(plan || 'Free').charAt(0).toUpperCase() + (plan || 'Free').slice(1)}
    </span>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow({ cols = 4 }) {
  return (
    <tr>
      {[...Array(cols)].map((_, i) => (
        <td key={i} className="px-5 py-3.5">
          <div className="skeleton h-4 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────
function InviteModal({ onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ email: '', role: 'member' });

  const mutation = useMutation({
    mutationFn: (data) => api.post('/team/invites', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', 'invites'] });
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  const errMsg = mutation.error?.response?.data?.error?.message || mutation.error?.message;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">Invite Team Member</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {errMsg && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3 py-2 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Email address</label>
            <input
              type="email"
              className="input-field"
              placeholder="colleague@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Role</label>
            <select
              className="input-field"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="admin"   className="bg-bg-secondary">Admin</option>
              <option value="manager" className="bg-bg-secondary">Manager</option>
              <option value="member"  className="bg-bg-secondary">Member</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex items-center gap-2">
              <Mail className="w-4 h-4" />
              {mutation.isPending ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Role Change Dropdown ─────────────────────────────────────────────────────
function RoleDropdown({ memberId, currentRole }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, role }) => api.patch(`/team/members/${id}`, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team', 'members'] }),
  });

  return (
    <select
      value={currentRole}
      onChange={(e) => mutation.mutate({ id: memberId, role: e.target.value })}
      disabled={mutation.isPending}
      className="bg-transparent text-xs font-medium border border-border rounded-lg px-2 py-1 text-text-primary focus:outline-none focus:border-accent-blue disabled:opacity-50 transition-colors"
    >
      <option value="admin"   className="bg-bg-secondary">Admin</option>
      <option value="manager" className="bg-bg-secondary">Manager</option>
      <option value="member"  className="bg-bg-secondary">Member</option>
    </select>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [showInvite, setShowInvite] = useState(false);
  const [toast, setToast]           = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Team info — backend: success(res, { team: {...} }) → data.team
  const { data: teamInfo, isLoading: loadingTeam } = useQuery({
    queryKey: ['team'],
    queryFn: () => api.get('/team').then((r) => r.data.data.team),
  });

  // Members — backend: success(res, { members: [...] }) → data.members
  const { data: members, isLoading: loadingMembers } = useQuery({
    queryKey: ['team', 'members'],
    queryFn: () => api.get('/team/members').then((r) => r.data.data.members ?? []),
  });

  // Pending invites — backend: success(res, { invites: [...] }) → data.invites
  const { data: invites, isLoading: loadingInvites } = useQuery({
    queryKey: ['team', 'invites'],
    queryFn: () => api.get('/team/invites').then((r) => r.data.data.invites ?? []),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (id) => api.delete(`/team/members/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', 'members'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      showToast('Member removed.');
    },
    onError: () => showToast('Failed to remove member.', 'error'),
  });

  const revokeInviteMutation = useMutation({
    mutationFn: (id) => api.delete(`/team/invites/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', 'invites'] });
      showToast('Invite revoked.');
    },
    onError: () => showToast('Failed to revoke invite.', 'error'),
  });

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-accent-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Team Management</h1>
            <p className="text-sm text-text-secondary">Manage members and permissions</p>
          </div>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="btn-primary flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Invite Member
        </button>
      </div>

      {/* Team info card */}
      <div className="card">
        {loadingTeam ? (
          <div className="flex items-center gap-6">
            <div className="skeleton h-6 w-40 rounded" />
            <div className="skeleton h-6 w-16 rounded-full" />
            <div className="skeleton h-6 w-24 rounded" />
          </div>
        ) : teamInfo ? (
          <div className="flex flex-wrap items-center gap-4">
            <h2 className="text-base font-semibold text-text-primary">{teamInfo.name}</h2>
            <PlanBadge plan={teamInfo.plan} />
            <span className="flex items-center gap-1.5 text-sm text-text-secondary">
              <Users className="w-4 h-4" />
              {teamInfo.memberCount ?? members?.length ?? 0} member{(teamInfo.memberCount ?? 1) !== 1 ? 's' : ''}
            </span>
          </div>
        ) : null}
      </div>

      {/* Members section */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Members</h2>
          <span className="text-xs text-text-secondary">
            {!loadingMembers && members ? `${members.length} total` : ''}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-secondary/50">
                {['Member', 'Email', 'Role', 'Actions'].map((h) => (
                  <th key={h} className="text-left text-text-secondary font-medium px-5 py-3.5 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loadingMembers ? (
                [...Array(3)].map((_, i) => <SkeletonRow key={i} cols={4} />)
              ) : !members?.length ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-text-secondary text-sm">
                    No members found.
                  </td>
                </tr>
              ) : (
                members.map((member) => {
                  const isSelf = member.id === currentUser?.id || member.userId === currentUser?.id;
                  return (
                    <tr key={member.id} className="hover:bg-bg-secondary/30 transition-colors">
                      {/* Avatar + name */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={member.name} />
                          <span className="font-medium text-text-primary whitespace-nowrap">
                            {member.name}
                            {isSelf && <span className="ml-1.5 text-xs text-text-secondary">(you)</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary max-w-[200px] truncate">
                        {member.email}
                      </td>
                      <td className="px-5 py-3.5">
                        {isAdmin && !isSelf ? (
                          <RoleDropdown memberId={member.id} currentRole={member.role} />
                        ) : (
                          <RoleBadge role={member.role} />
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {isAdmin && !isSelf && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Remove ${member.name} from the team?`)) {
                                removeMemberMutation.mutate(member.id);
                              }
                            }}
                            disabled={removeMemberMutation.isPending}
                            className="p-1.5 text-text-secondary hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                            title="Remove member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending invites section */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Pending Invites</h2>
          <span className="text-xs text-text-secondary">
            {!loadingInvites && invites ? `${invites.length} pending` : ''}
          </span>
        </div>

        {loadingInvites ? (
          <div className="p-5 space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="skeleton h-14 rounded-lg" />
            ))}
          </div>
        ) : !invites?.length ? (
          <div className="px-5 py-10 text-center text-text-secondary text-sm">
            <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No pending invites.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {invites.map((invite) => (
              <div key={invite.id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-9 h-9 rounded-full bg-bg-secondary border border-border flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{invite.email}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <RoleBadge role={invite.role} />
                    {invite.expiresAt && (
                      <span className="flex items-center gap-1 text-xs text-text-secondary">
                        <Clock className="w-3 h-3" />
                        Expires {new Date(invite.expiresAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Revoke invite for ${invite.email}?`)) {
                        revokeInviteMutation.mutate(invite.id);
                      }
                    }}
                    disabled={revokeInviteMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-red-400 hover:bg-red-400/10 border border-border hover:border-red-500/30 rounded-lg transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 border rounded-xl px-4 py-3 shadow-xl ${
          toast.type === 'success'
            ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {toast.type === 'success'
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
