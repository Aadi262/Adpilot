import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Play, Pause, Trash2, Filter, X, AlertCircle, Download } from 'lucide-react';
import api from '../lib/api';
import Badge from '../components/ui/Badge';
import CreateCampaignModal from '../components/campaigns/CreateCampaignModal';
import { downloadMarkdownReport } from '../lib/exportReport';

function SkeletonRow() {
  return (
    <tr>
      {[...Array(6)].map((_, i) => (
        <td key={i} className="py-3 pr-4">
          <div className="skeleton h-5 rounded w-24" />
        </td>
      ))}
    </tr>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
      <div className="bg-bg-card border border-border rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-sm p-6">
        <h3 className="text-base font-semibold text-text-primary mb-2">{title}</h3>
        <p className="text-sm text-text-secondary mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="btn-secondary text-sm px-4">Cancel</button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState({ platform: '', status: '' });
  const [pendingDelete, setPendingDelete] = useState(null); // { id, name }

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.platform) params.append('platform', filters.platform);
      if (filters.status) params.append('status', filters.status);
      return api.get(`/campaigns?${params}`).then((r) => r.data.data.campaigns);
    },
  });

  const launchMutation = useMutation({
    mutationFn: (id) => api.post(`/campaigns/${id}/launch`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });

  const pauseMutation = useMutation({
    mutationFn: (id) => api.post(`/campaigns/${id}/pause`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/campaigns/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['campaigns'] }); setPendingDelete(null); },
  });

  const ActionButtons = ({ c }) => (
    <div className="flex items-center gap-1.5">
      {c.status !== 'active' && (
        <button
          onClick={() => launchMutation.mutate(c.id)}
          disabled={launchMutation.isPending}
          title="Launch"
          className="p-1.5 text-accent-green hover:bg-accent-green/10 rounded-lg transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
        </button>
      )}
      {c.status === 'active' && (
        <button
          onClick={() => pauseMutation.mutate(c.id)}
          disabled={pauseMutation.isPending}
          title="Pause"
          className="p-1.5 text-orange-400 hover:bg-orange-400/10 rounded-lg transition-colors"
        >
          <Pause className="w-3.5 h-3.5" />
        </button>
      )}
      <button
        onClick={() => setPendingDelete({ id: c.id, name: c.name })}
        title="Delete"
        className="p-1.5 text-text-secondary hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-bg-card border border-border rounded-lg px-3 py-2">
            <Filter className="w-4 h-4 text-text-secondary" />
            <select
              className="bg-transparent text-sm text-text-secondary focus:outline-none"
              value={filters.platform}
              onChange={(e) => setFilters({ ...filters, platform: e.target.value })}
            >
              <option value="">All Platforms</option>
              <option value="meta">Meta</option>
              <option value="google">Google</option>
              <option value="both">Both</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-bg-card border border-border rounded-lg px-3 py-2">
            <select
              className="bg-transparent text-sm text-text-secondary focus:outline-none"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {campaigns?.length > 0 && (
            <button
              onClick={() => downloadMarkdownReport('Campaigns Report', [
                {
                  title: 'Summary',
                  items: [
                    `Campaign count: ${campaigns.length}`,
                    `Platform filter: ${filters.platform || 'All platforms'}`,
                    `Status filter: ${filters.status || 'All statuses'}`,
                  ],
                },
                {
                  title: 'Campaign Inventory',
                  table: {
                    headers: ['Name', 'Platform', 'Status', 'Budget', 'Budget Type', 'Created'],
                    rows: campaigns.map((c) => [
                      c.name,
                      c.platform,
                      c.status,
                      Number(c.budget),
                      c.budgetType,
                      new Date(c.createdAt).toLocaleDateString(),
                    ]),
                  },
                },
              ], 'campaigns-report')}
              className="hidden sm:flex items-center gap-2 btn-secondary"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          )}
          {/* Desktop button — hidden on mobile (FAB used instead) */}
          <button
            onClick={() => setShowModal(true)}
            className="hidden sm:flex items-center gap-2 btn-primary"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        </div>
      </div>

      {/* ── Mobile card list (< sm) ─────────────────────────────────────── */}
      <div className="sm:hidden space-y-3">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="card space-y-3">
              <div className="skeleton h-5 rounded w-3/4" />
              <div className="skeleton h-4 rounded w-1/2" />
              <div className="grid grid-cols-2 gap-3">
                <div className="skeleton h-8 rounded" />
                <div className="skeleton h-8 rounded" />
              </div>
            </div>
          ))
        ) : (campaigns || []).length === 0 ? (
          <div className="card text-center py-10 text-text-secondary text-sm">
            <p className="text-base font-medium mb-1">No campaigns found</p>
            <p>Tap the + button to create your first campaign.</p>
          </div>
        ) : (
          (campaigns || []).map((c) => (
            <div key={c.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 mr-2">
                  <p className="font-semibold text-text-primary truncate">{c.name}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge status={c.platform} />
                    <Badge status={c.status} showDot />
                  </div>
                </div>
                <ActionButtons c={c} />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs border-t border-border pt-3">
                <div>
                  <p className="text-text-secondary">Budget</p>
                  <p className="text-text-primary font-medium mt-0.5">
                    ${Number(c.budget).toLocaleString()} <span className="opacity-60">/ {c.budgetType}</span>
                  </p>
                </div>
                <div>
                  <p className="text-text-secondary">Created</p>
                  <p className="text-text-primary mt-0.5">{new Date(c.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Desktop table (≥ sm) ───────────────────────────────────────── */}
      <div className="hidden sm:block card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-secondary/50">
                {['Name', 'Platform', 'Status', 'Budget', 'Created', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="text-left text-text-secondary font-medium px-5 py-3.5 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading
                ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                : (campaigns || []).map((c) => (
                    <tr key={c.id} className="hover:bg-bg-secondary/30 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-text-primary max-w-[200px] truncate">
                        {c.name}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge status={c.platform} />
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge status={c.status} showDot />
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary whitespace-nowrap">
                        ${Number(c.budget).toLocaleString()}{' '}
                        <span className="text-xs opacity-60">/ {c.budgetType}</span>
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary whitespace-nowrap">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <ActionButtons c={c} />
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>

          {!isLoading && (!campaigns || campaigns.length === 0) && (
            <div className="text-center py-16 text-text-secondary">
              <p className="text-lg font-medium mb-1">No campaigns found</p>
              <p className="text-sm">Create your first campaign to get started.</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile FAB */}
      <button
        onClick={() => setShowModal(true)}
        className="sm:hidden fixed bottom-6 right-6 w-14 h-14 rounded-full btn-primary shadow-2xl
                   flex items-center justify-center z-10"
      >
        <Plus className="w-6 h-6" />
      </button>

      {showModal && <CreateCampaignModal onClose={() => setShowModal(false)} />}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete campaign?"
          message={`"${pendingDelete.name}" will be permanently deleted. This cannot be undone.`}
          onConfirm={() => deleteMutation.mutate(pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
