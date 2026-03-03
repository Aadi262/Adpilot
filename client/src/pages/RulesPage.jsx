import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  Plus,
  Trash2,
  Play,
  AlertCircle,
  X,
  CheckCircle,
} from 'lucide-react';
import api from '../lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TRIGGER_LABELS = {
  cpa_exceeds:            'CPA Exceeds',
  roas_below:             'ROAS Below',
  ctr_below:              'CTR Below',
  frequency_high:         'Frequency High',
  budget_pacing_anomaly:  'Budget Pacing Anomaly',
};

const ACTION_LABELS = {
  pause_campaign:     'Pause Campaign',
  reduce_budget_10:   'Reduce Budget 10%',
  reduce_budget_20:   'Reduce Budget 20%',
  increase_budget_10: 'Increase Budget 10%',
};

function formatTrigger(type) {
  return TRIGGER_LABELS[type] || type?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '—';
}

function formatAction(action) {
  return ACTION_LABELS[action] || action?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '—';
}

// ─── Status Toggle ────────────────────────────────────────────────────────────
function StatusToggle({ ruleId, isActive, onToggle }) {
  return (
    <button
      onClick={() => onToggle(ruleId, !isActive)}
      className={`relative inline-flex w-10 h-5.5 h-[22px] shrink-0 rounded-full transition-colors duration-200 focus:outline-none ${
        isActive ? 'bg-accent-green' : 'bg-bg-secondary border border-border'
      }`}
      title={isActive ? 'Active — click to disable' : 'Inactive — click to enable'}
    >
      <span
        className={`inline-block w-4 h-4 mt-[3px] rounded-full bg-white shadow transition-transform duration-200 ${
          isActive ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr>
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-5 py-3.5">
          <div className="skeleton h-4 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type = 'success', onDismiss }) {
  const cls = type === 'success'
    ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
    : 'bg-red-500/10 border-red-500/30 text-red-400';
  const Icon = type === 'success' ? CheckCircle : AlertCircle;
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 border rounded-xl px-4 py-3 shadow-xl ${cls}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onDismiss} className="ml-2 opacity-70 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Create Rule Modal ────────────────────────────────────────────────────────
function CreateRuleModal({ onClose, onCreated }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    triggerType:  'cpa_exceeds',
    triggerValue: '',
    action:       'pause_campaign',
    campaignId:   '',
  });

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/campaigns').then((r) => r.data.data.campaigns),
  });

  const mutation = useMutation({
    mutationFn: (data) => api.post('/rules', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      onCreated?.();
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      triggerType:  form.triggerType,
      triggerValue: parseFloat(form.triggerValue),
      action:       form.action,
    };
    if (form.campaignId) payload.campaignId = form.campaignId;
    mutation.mutate(payload);
  };

  const errMsg = mutation.error?.response?.data?.error?.message || mutation.error?.message;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">New Automation Rule</h2>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Trigger Type</label>
              <select
                className="input-field"
                value={form.triggerType}
                onChange={(e) => setForm({ ...form, triggerType: e.target.value })}
              >
                {Object.entries(TRIGGER_LABELS).map(([val, label]) => (
                  <option key={val} value={val} className="bg-bg-secondary">{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Trigger Value</label>
              <input
                type="number"
                className="input-field"
                placeholder="e.g. 50"
                min="0"
                step="any"
                value={form.triggerValue}
                onChange={(e) => setForm({ ...form, triggerValue: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Action</label>
            <select
              className="input-field"
              value={form.action}
              onChange={(e) => setForm({ ...form, action: e.target.value })}
            >
              {Object.entries(ACTION_LABELS).map(([val, label]) => (
                <option key={val} value={val} className="bg-bg-secondary">{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Campaign <span className="text-text-secondary opacity-60">(optional – leave blank for all)</span>
            </label>
            <select
              className="input-field"
              value={form.campaignId}
              onChange={(e) => setForm({ ...form, campaignId: e.target.value })}
            >
              <option value="" className="bg-bg-secondary">All Campaigns</option>
              {(campaigns || []).map((c) => (
                <option key={c.id} value={c.id} className="bg-bg-secondary">{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? 'Creating…' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RulesPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal]     = useState(false);
  const [toast, setToast]             = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };
  const { data: rules = [], isLoading, error } = useQuery({
    queryKey: ['rules'],
    queryFn: () => api.get('/rules').then((r) => r.data.data),
  });
  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => api.patch(`/rules/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rules'] }),
    onError: () => showToast('Failed to update rule.', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/rules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rules'] }),
    onError: () => showToast('Failed to delete rule.', 'error'),
  });

  const evaluateMutation = useMutation({
    mutationFn: () => api.post('/rules/evaluate'),
    onSuccess: () => showToast('Evaluation queued successfully.'),
    onError: () => showToast('Failed to queue evaluation.', 'error'),
  });

  const handleDelete = (id) => {
    if (window.confirm('Delete this rule? This cannot be undone.')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-purple/10 flex items-center justify-center">
            <Bot className="w-5 h-5 text-accent-purple" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Automation Rules</h1>
            <p className="text-sm text-text-secondary">Trigger automatic actions based on campaign metrics</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => evaluateMutation.mutate()}
            disabled={evaluateMutation.isPending}
            className="btn-secondary flex items-center gap-2"
          >
            <Play className={`w-4 h-4 ${evaluateMutation.isPending ? 'animate-pulse' : ''}`} />
            {evaluateMutation.isPending ? 'Queuing…' : 'Trigger Evaluation'}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Rule
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Failed to load rules. Please try again.
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-secondary/50">
                {['Trigger Type', 'Trigger Value', 'Action', 'Campaign', 'Status', 'Last Triggered', 'Delete'].map((h) => (
                  <th key={h} className="text-left text-text-secondary font-medium px-5 py-3.5 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
              ) : !rules?.length ? (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center">
                    <Bot className="w-10 h-10 mx-auto mb-3 text-text-secondary opacity-30" />
                    <p className="text-text-secondary text-sm font-medium">No rules configured</p>
                    <p className="text-text-secondary text-xs mt-1">Create your first rule to automate campaign management.</p>
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-bg-secondary/30 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-text-primary whitespace-nowrap">
                      {formatTrigger(rule.triggerType)}
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary">
                      {rule.triggerValue}
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary whitespace-nowrap">
                      {formatAction(rule.action)}
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary max-w-[160px] truncate">
                      {rule.campaign?.name || 'All'}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusToggle
                        ruleId={rule.id}
                        isActive={rule.isActive}
                        onToggle={(id, val) => toggleMutation.mutate({ id, isActive: val })}
                      />
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary whitespace-nowrap">
                      {rule.lastTriggeredAt
                        ? new Date(rule.lastTriggeredAt).toLocaleDateString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => handleDelete(rule.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 text-text-secondary hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        title="Delete rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <CreateRuleModal
          onClose={() => setShowModal(false)}
          onCreated={() => showToast('Rule created successfully.')}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
