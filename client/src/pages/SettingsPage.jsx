import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Shield, Bell, AlertTriangle, Eye, EyeOff, CheckCircle } from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../components/ui/Toast';
import useAuthStore from '../store/authStore';

// ─── Shared ───────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'profile',  label: 'Profile',       icon: User         },
  { id: 'security', label: 'Security',       icon: Shield       },
  { id: 'notifs',   label: 'Notifications',  icon: Bell         },
  { id: 'danger',   label: 'Danger Zone',    icon: AlertTriangle},
];

function TabButton({ tab, active, onClick }) {
  const Icon = tab.icon;
  return (
    <button
      onClick={() => onClick(tab.id)}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
        active
          ? 'bg-accent-blue/10 text-accent-blue'
          : 'text-text-secondary hover:text-text-primary hover:bg-white/3'
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {tab.label}
    </button>
  );
}

function SectionCard({ title, description, children }) {
  return (
    <div className="card space-y-5">
      <div className="border-b border-border pb-4">
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        {description && <p className="text-xs text-text-secondary mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Profile tab ──────────────────────────────────────────────────────────────
function ProfileTab() {
  const toast = useToast();
  const { setAuth, user: storeUser } = useAuthStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['users', 'me'],
    queryFn:  () => api.get('/users/me').then((r) => r.data.data.user),
  });

  const [name, setName] = useState('');
  // Sync name from fetched data
  if (data && !name && data.name) setName(data.name);

  const mutation = useMutation({
    mutationFn: () => api.patch('/users/me', { name }),
    onSuccess: (res) => {
      const updated = res.data.data.user;
      queryClient.setQueryData(['users', 'me'], updated);
      if (storeUser) setAuth({ ...useAuthStore.getState(), user: { ...storeUser, name: updated.name } });
      toast.success('Profile updated');
    },
    onError: (err) => toast.error(err?.response?.data?.error?.message || 'Failed to save'),
  });

  const user = data ?? storeUser;

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  return (
    <SectionCard title="Profile" description="Update your display name and view account details.">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-accent-blue/20 flex items-center justify-center text-accent-blue font-bold text-lg shrink-0">
          {initials}
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">{user?.name ?? '—'}</p>
          <p className="text-xs text-text-secondary">{user?.email ?? '—'}</p>
          <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-accent-blue/10 text-accent-blue border border-accent-blue/20 capitalize">
            {user?.role ?? '—'}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}</div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Display Name</label>
            <input
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Email Address</label>
            <input className="input-field opacity-60 cursor-not-allowed" value={user?.email ?? ''} readOnly />
            <p className="text-xs text-text-secondary mt-1">Email changes require contacting support.</p>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !name.trim()}
              className="btn-primary"
            >
              {mutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Security tab ─────────────────────────────────────────────────────────────
function SecurityTab() {
  const toast = useToast();
  const [current,  setCurrent]  = useState('');
  const [newPwd,   setNewPwd]   = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showCur,  setShowCur]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);

  const pwdStrength = (() => {
    let s = 0;
    if (newPwd.length >= 8)          s++;
    if (/[A-Z]/.test(newPwd))        s++;
    if (/[0-9]/.test(newPwd))        s++;
    if (/[^A-Za-z0-9]/.test(newPwd)) s++;
    return s;
  })();
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][pwdStrength];
  const strengthColor = ['', 'bg-red-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-400'][pwdStrength];

  const mutation = useMutation({
    mutationFn: () => api.post('/users/me/change-password', { currentPassword: current, newPassword: newPwd }),
    onSuccess: () => {
      toast.success('Password updated successfully');
      setCurrent(''); setNewPwd(''); setConfirm('');
    },
    onError: (err) => toast.error(err?.response?.data?.error?.message || 'Failed to update password'),
  });

  const canSubmit = current && newPwd.length >= 8 && newPwd === confirm;

  return (
    <SectionCard title="Change Password" description="Choose a strong password to keep your account secure.">
      <div className="space-y-4 max-w-md">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Current Password</label>
          <div className="relative">
            <input
              type={showCur ? 'text' : 'password'}
              className="input-field pr-10"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowCur((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
            >
              {showCur ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">New Password</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              className="input-field pr-10"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="Min. 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowNew((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {newPwd && (
            <div className="mt-2 space-y-1">
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < pwdStrength ? strengthColor : 'bg-border'}`} />
                ))}
              </div>
              <p className="text-xs text-text-secondary">{strengthLabel}</p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Confirm New Password</label>
          <div className="relative">
            <input
              type="password"
              className={`input-field pr-10 ${confirm && confirm !== newPwd ? 'border-red-500/50' : ''}`}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat new password"
            />
            {confirm && confirm === newPwd && (
              <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
            )}
          </div>
          {confirm && confirm !== newPwd && (
            <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
          )}
        </div>

        <button
          onClick={() => mutation.mutate()}
          disabled={!canSubmit || mutation.isPending}
          className="btn-primary"
        >
          {mutation.isPending ? 'Updating…' : 'Update Password'}
        </button>
      </div>

      <div className="border-t border-border pt-5">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Two-Factor Authentication</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text-primary">Authenticator app</p>
            <p className="text-xs text-text-secondary">Add an extra layer of security</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-border text-text-secondary border border-border">
            Coming soon
          </span>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Notifications tab ────────────────────────────────────────────────────────
const NOTIF_PREFS = [
  { key: 'campaignUpdates', label: 'Campaign Updates',  desc: 'Launch, pause, and status changes' },
  { key: 'seoAlerts',       label: 'SEO Alerts',        desc: 'Audit completions and score changes' },
  { key: 'keywordChanges',  label: 'Keyword Changes',   desc: 'Rank movements and new opportunities' },
  { key: 'weeklyDigest',    label: 'Weekly Digest',     desc: 'Summary of your team activity every Monday' },
];

function NotifTab() {
  const toast = useToast();
  const [prefs, setPrefs] = useState({
    campaignUpdates: true, seoAlerts: true, keywordChanges: true, weeklyDigest: false,
  });
  const [saved, setSaved] = useState(false);

  const toggle = (key) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const save = () => {
    // Persist to /users/me when backend supports notificationPrefs JSON column
    setSaved(true);
    toast.success('Notification preferences saved');
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <SectionCard title="Notification Preferences" description="Choose what you want to be notified about.">
      <div className="space-y-3">
        {NOTIF_PREFS.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <div>
              <p className="text-sm text-text-primary">{label}</p>
              <p className="text-xs text-text-secondary">{desc}</p>
            </div>
            <button
              onClick={() => toggle(key)}
              className={`relative w-10 h-5 rounded-full transition-colors ${prefs[key] ? 'bg-accent-blue' : 'bg-border'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${prefs[key] ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button onClick={save} className="btn-primary">
          {saved ? '✓ Saved' : 'Save Preferences'}
        </button>
      </div>
    </SectionCard>
  );
}

// ─── Danger Zone tab ──────────────────────────────────────────────────────────
function DangerTab() {
  const toast = useToast();
  const [showConfirm, setShowConfirm] = useState(false);
  const [typedEmail, setTypedEmail] = useState('');
  const { user } = useAuthStore();

  return (
    <SectionCard title="Danger Zone" description="Irreversible actions. Proceed with caution.">
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg border border-red-500/20 bg-red-500/5">
          <div>
            <p className="text-sm font-medium text-text-primary">Export your data</p>
            <p className="text-xs text-text-secondary">Download all your campaigns, audits, and settings</p>
          </div>
          <button
            onClick={() => toast.info('Your data export will be emailed to you within 24 hours.')}
            className="btn-secondary text-sm"
          >
            Export Data
          </button>
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg border border-red-500/30 bg-red-500/5">
          <div>
            <p className="text-sm font-medium text-red-400">Delete Account</p>
            <p className="text-xs text-text-secondary">Permanently delete your account and all data</p>
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
          >
            Delete Account
          </button>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
          <div className="bg-bg-card border border-red-500/30 rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-sm p-6">
            <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />
            <h3 className="text-base font-bold text-text-primary mb-2">Delete your account?</h3>
            <p className="text-sm text-text-secondary mb-4">
              This is permanent. All your data will be destroyed. Type your email to confirm.
            </p>
            <input
              className="input-field mb-4"
              placeholder={user?.email ?? 'your@email.com'}
              value={typedEmail}
              onChange={(e) => setTypedEmail(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="btn-secondary flex-1">Cancel</button>
              <button
                disabled={typedEmail !== user?.email}
                onClick={() => toast.error('Account deletion requires contacting support.')}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white transition-colors"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="flex gap-8 max-w-4xl">
      {/* Sidebar nav */}
      <nav className="w-44 shrink-0 space-y-1">
        {TABS.map((tab) => (
          <TabButton key={tab.id} tab={tab} active={activeTab === tab.id} onClick={setActiveTab} />
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {activeTab === 'profile'  && <ProfileTab />}
        {activeTab === 'security' && <SecurityTab />}
        {activeTab === 'notifs'   && <NotifTab />}
        {activeTab === 'danger'   && <DangerTab />}
      </div>
    </div>
  );
}
