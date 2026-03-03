import { useState } from 'react';
import { X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

const platforms = ['meta', 'google', 'both'];
const objectives = ['conversions', 'awareness', 'traffic', 'lead_generation', 'retargeting'];
const budgetTypes = ['daily', 'lifetime'];

export default function CreateCampaignModal({ onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    platform: 'meta',
    objective: 'conversions',
    budget: '',
    budgetType: 'daily',
  });

  const mutation = useMutation({
    mutationFn: (data) => api.post('/campaigns', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate({ ...form, budget: parseFloat(form.budget) });
  };

  const errMsg = mutation.error?.response?.data?.error?.message;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg bg-bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">New Campaign</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {errMsg && (
            <p className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3 py-2 text-sm">
              {errMsg}
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Campaign name</label>
            <input
              type="text"
              className="input-field"
              placeholder="Summer Sale 2024"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Platform</label>
              <select
                className="input-field"
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
              >
                {platforms.map((p) => (
                  <option key={p} value={p} className="bg-bg-secondary capitalize">
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Objective</label>
              <select
                className="input-field"
                value={form.objective}
                onChange={(e) => setForm({ ...form, objective: e.target.value })}
              >
                {objectives.map((o) => (
                  <option key={o} value={o} className="bg-bg-secondary">
                    {o.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Budget ($)</label>
              <input
                type="number"
                min="1"
                step="0.01"
                className="input-field"
                placeholder="100"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Budget type</label>
              <select
                className="input-field"
                value={form.budgetType}
                onChange={(e) => setForm({ ...form, budgetType: e.target.value })}
              >
                {budgetTypes.map((t) => (
                  <option key={t} value={t} className="bg-bg-secondary capitalize">
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? 'Creating…' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
