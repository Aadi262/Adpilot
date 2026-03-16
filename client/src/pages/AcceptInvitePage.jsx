import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import AdpilotLogo from '../components/ui/AdpilotLogo';

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const { setAuth }    = useAuthStore();
  const token          = searchParams.get('token');

  const [form, setForm]             = useState({ name: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPwd]  = useState(false);
  const [fieldError, setFieldError] = useState(null);

  // Redirect if no token present
  useEffect(() => {
    if (!token) navigate('/login', { replace: true });
  }, [token, navigate]);

  const mutation = useMutation({
    mutationFn: (data) =>
      api.post('/team/invites/accept', { token, name: data.name, password: data.password }),
    onSuccess: (res) => {
      // acceptInvite returns { message, email } — use that email to auto-login
      const email = res.data.data?.email;
      return api
        .post('/auth/login', { email, password: form.password })
        .then((loginRes) => {
          const { user, accessToken, team } = loginRes.data.data;
          setAuth(user, accessToken, team || null);
          navigate('/dashboard', { replace: true });
        })
        .catch(() => {
          // Auto-login failed — redirect to login page with a success message
          navigate('/login?invited=1', { replace: true });
        });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setFieldError(null);

    if (!form.name.trim()) {
      setFieldError('Full name is required.');
      return;
    }
    if (form.password.length < 8) {
      setFieldError('Password must be at least 8 characters.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setFieldError('Passwords do not match.');
      return;
    }

    mutation.mutate(form);
  };

  const apiError = mutation.error?.response?.data?.error?.message;

  if (!token) return null;

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-accent-blue/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[300px] bg-accent-purple/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <AdpilotLogo variant="wordmark" size={40} />
        </div>

        <div className="card">
          {mutation.isSuccess ? (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-accent-green mx-auto mb-4" />
              <h2 className="text-lg font-bold text-text-primary mb-2">Account created!</h2>
              <p className="text-text-secondary text-sm">Redirecting you to the dashboard…</p>
              <Loader className="w-5 h-5 text-accent-blue mx-auto mt-4 animate-spin" />
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-text-primary mb-1">Accept your invitation</h2>
              <p className="text-text-secondary text-sm mb-6">
                Create your account to join the team.
              </p>

              {(fieldError || apiError) && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 mb-4 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {fieldError || apiError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    Full name
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Jane Smith"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="input-field pr-10"
                      placeholder="Min. 8 characters"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    Confirm password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input-field"
                    placeholder="Repeat password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="btn-primary w-full mt-2"
                >
                  {mutation.isPending ? 'Creating account…' : 'Create account & join team'}
                </button>
              </form>

              <p className="text-center text-text-secondary text-sm mt-5">
                Already have an account?{' '}
                <Link to="/login" className="text-accent-blue hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
