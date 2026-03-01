import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, AlertCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';
import useAuthStore from '../store/authStore';

export default function RegisterPage() {
  const navigate  = useNavigate();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', password: '', teamName: '' });

  const registerMutation = useMutation({
    mutationFn: (data) => api.post('/auth/register', data),
    onSuccess: (res) => {
      const { user, accessToken, team } = res.data.data;
      // Auto-login — ProtectedRoute sees onboardingCompleted=false → redirects to /onboarding
      setAuth(user, accessToken, team ?? null);
      navigate('/onboarding');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    registerMutation.mutate(form);
  };

  const errMsg = registerMutation.error?.response?.data?.error?.message;

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 right-1/3 w-[500px] h-[400px] bg-accent-purple/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-text-primary">AdPilot</span>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold text-text-primary mb-1">Create your account</h2>
          <p className="text-text-secondary text-sm mb-6">Start your free trial — no credit card needed</p>

          {errMsg && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 mb-4 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Full name</label>
              <input
                type="text"
                className="input-field"
                placeholder="Jane Smith"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Email address</label>
              <input
                type="email"
                className="input-field"
                placeholder="you@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Team / Company name</label>
              <input
                type="text"
                className="input-field"
                placeholder="Acme Inc."
                value={form.teamName}
                onChange={(e) => setForm({ ...form, teamName: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="Min 8 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={8}
              />
            </div>

            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="btn-primary w-full mt-2"
            >
              {registerMutation.isPending ? 'Creating account…' : 'Create account →'}
            </button>
          </form>

          <p className="text-center text-text-secondary text-sm mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-accent-blue hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
