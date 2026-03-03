import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plug,
  RefreshCw,
  Unlink,
  Link,
  AlertCircle,
  CheckCircle,
  X,
  Clock,
} from 'lucide-react';
import api from '../lib/api';

// ─── Provider metadata ────────────────────────────────────────────────────────
const PROVIDERS = [
  {
    id: 'meta',
    name: 'Meta',
    description: 'Connect Facebook & Instagram ad accounts to sync campaigns and performance data.',
    icon: MetaIcon,
  },
  {
    id: 'google',
    name: 'Google Ads',
    description: 'Connect Google Ads to import campaigns, ad groups, and performance metrics.',
    icon: GoogleIcon,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Receive real-time alerts and automation notifications in your Slack workspace.',
    icon: SlackIcon,
  },
];

// ─── SVG Provider Icons ───────────────────────────────────────────────────────
function MetaIcon({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#1877F2" />
      <path
        d="M17.12 26V17.44H19.9l.42-3.24H17.12v-2.07c0-.94.26-1.57 1.61-1.57H20.4V7.63A21.46 21.46 0 0 0 17.88 7.5c-2.48 0-4.18 1.51-4.18 4.29v2.4H11v3.24h2.7V26h3.42z"
        fill="white"
      />
    </svg>
  );
}

function GoogleIcon({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="white" />
      <path d="M29.6 16.3c0-.9-.08-1.77-.22-2.6H16v4.92h7.63A6.52 6.52 0 0 1 20.74 22v3.3h4.36C27.6 23 29.6 19.94 29.6 16.3z" fill="#4285F4" />
      <path d="M16 29.6c3.81 0 7-1.26 9.34-3.4L20.98 22.9C19.74 23.76 18.09 24.3 16 24.3c-3.68 0-6.79-2.49-7.9-5.83H3.6v3.41A13.6 13.6 0 0 0 16 29.6z" fill="#34A853" />
      <path d="M8.1 18.47A8.21 8.21 0 0 1 7.67 16c0-.86.15-1.7.43-2.47V10.12H3.6A13.6 13.6 0 0 0 2.4 16c0 2.19.52 4.27 1.44 6.12l4.25-3.65z" fill="#FBBC05" />
      <path d="M16 7.7c2.07 0 3.93.71 5.39 2.11l4.04-4.04A13.55 13.55 0 0 0 16 2.4C9.79 2.4 4.5 6.29 2.6 11.72l4.5 3.48C8.21 11.19 11.32 7.7 16 7.7z" fill="#EA4335" />
    </svg>
  );
}

function SlackIcon({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#1A1E2E" />
      {/* Slack hash mark – simplified 4-block representation */}
      <rect x="6"  y="13" width="5" height="5" rx="2.5" fill="#E01E5A" />
      <rect x="6"  y="20" width="5" height="5" rx="2.5" fill="#E01E5A" opacity="0.7" />
      <rect x="13" y="6"  width="5" height="5" rx="2.5" fill="#ECB22E" />
      <rect x="20" y="6"  width="5" height="5" rx="2.5" fill="#ECB22E" opacity="0.7" />
      <rect x="21" y="13" width="5" height="5" rx="2.5" fill="#2EB67D" />
      <rect x="21" y="20" width="5" height="5" rx="2.5" fill="#2EB67D" opacity="0.7" />
      <rect x="13" y="21" width="5" height="5" rx="2.5" fill="#36C5F0" />
      <rect x="20" y="21" width="5" height="5" rx="2.5" fill="#36C5F0" opacity="0.7" />
    </svg>
  );
}

// ─── OAuth Connect Modal ──────────────────────────────────────────────────────
function ConnectModal({ provider, onClose }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');

  const mutation = useMutation({
    mutationFn: (data) => api.post(`/integrations/${provider.id}/connect`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate({ code: code.trim() });
  };

  const errMsg = mutation.error?.response?.data?.error?.message || mutation.error?.message;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <provider.icon size={28} />
            <h2 className="text-base font-semibold text-text-primary">Connect {provider.name}</h2>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-sm text-text-secondary">
            Enter the OAuth authorization code from {provider.name} to complete the connection.
          </p>

          {errMsg && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3 py-2 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Authorization Code
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="Paste code here…"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex items-center gap-2">
              <Link className="w-4 h-4" />
              {mutation.isPending ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Provider Card ────────────────────────────────────────────────────────────
function ProviderCard({ provider, integration }) {
  const queryClient = useQueryClient();
  const [showConnect, setShowConnect] = useState(false);

  const isConnected = integration?.connected || integration?.status === 'connected';

  const syncMutation = useMutation({
    mutationFn: () => api.post(`/integrations/${provider.id}/sync`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['integrations'] }),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.delete(`/integrations/${provider.id}/disconnect`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['integrations'] }),
  });

  const handleDisconnect = () => {
    if (window.confirm(`Disconnect ${provider.name}? This will stop all data syncing.`)) {
      disconnectMutation.mutate();
    }
  };

  return (
    <>
      <div className={`card flex flex-col gap-5 transition-colors ${isConnected ? 'border-accent-green/30' : ''}`}>
        {/* Top row: icon + status */}
        <div className="flex items-start justify-between gap-3">
          <provider.icon size={40} />
          {isConnected ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-accent-green/10 text-accent-green border border-accent-green/20">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-text-secondary/10 text-text-secondary border border-text-secondary/20">
              Not connected
            </span>
          )}
        </div>

        {/* Name + description */}
        <div>
          <h3 className="text-base font-semibold text-text-primary">{provider.name}</h3>
          <p className="text-sm text-text-secondary mt-1 leading-relaxed">{provider.description}</p>
        </div>

        {/* Connected details */}
        {isConnected && integration?.lastSyncAt && (
          <div className="flex items-center gap-2 text-xs text-text-secondary bg-bg-secondary rounded-lg px-3 py-2">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>
              Last synced{' '}
              {new Date(integration.lastSyncAt).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto">
          {isConnected ? (
            <>
              <button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="btn-secondary flex items-center gap-2 flex-1 justify-center"
              >
                <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                {syncMutation.isPending ? 'Syncing…' : 'Sync Data'}
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnectMutation.isPending}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium disabled:opacity-50"
                title="Disconnect"
              >
                <Unlink className="w-4 h-4" />
                {disconnectMutation.isPending ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowConnect(true)}
              className="btn-primary flex items-center gap-2 flex-1 justify-center"
            >
              <Link className="w-4 h-4" />
              Connect
            </button>
          )}
        </div>

        {syncMutation.isSuccess && (
          <p className="flex items-center gap-1.5 text-accent-green text-xs -mt-2">
            <CheckCircle className="w-3.5 h-3.5" />
            Sync completed successfully.
          </p>
        )}
        {syncMutation.error && (
          <p className="flex items-center gap-1.5 text-red-400 text-xs -mt-2">
            <AlertCircle className="w-3.5 h-3.5" />
            {syncMutation.error?.response?.data?.error?.message || 'Sync failed.'}
          </p>
        )}
      </div>

      {showConnect && (
        <ConnectModal provider={provider} onClose={() => setShowConnect(false)} />
      )}
    </>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonProviderCard() {
  return (
    <div className="card space-y-4">
      <div className="skeleton h-10 w-10 rounded-xl" />
      <div className="space-y-2">
        <div className="skeleton h-5 rounded w-1/3" />
        <div className="skeleton h-4 rounded w-full" />
        <div className="skeleton h-4 rounded w-3/4" />
      </div>
      <div className="skeleton h-9 rounded-lg" />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function IntegrationsPage() {
  const { data: integrations, isLoading, error } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api.get('/integrations').then((r) => r.data.data),
  });

  // Build a map: provider id -> { connected, ...integrationDetail }
  // Backend returns: { providers: [{provider, connected}], integrations: [...connected records] }
  const integrationMap = {};
  if (integrations?.providers) {
    integrations.providers.forEach(({ provider, connected }) => {
      const detail = integrations.integrations?.find((i) => i.provider === provider);
      integrationMap[provider] = { connected, ...(detail || {}) };
    });
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center">
          <Plug className="w-5 h-5 text-accent-blue" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Integration Hub</h1>
          <p className="text-sm text-text-secondary">Connect your ad platforms and tools</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Failed to load integrations. Please refresh.
        </div>
      )}

      {/* Provider grid */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading
          ? [...Array(3)].map((_, i) => <SkeletonProviderCard key={i} />)
          : PROVIDERS.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                integration={integrationMap[provider.id]}
              />
            ))}
      </div>
    </div>
  );
}
