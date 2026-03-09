import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertCircle } from 'lucide-react';
import api from '../lib/api';

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing'); // 'processing' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const code  = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state'); // provider name set in oauth-url

    if (error) {
      setStatus('error');
      setErrorMsg(searchParams.get('error_description') || 'Authorization was denied.');
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMsg('No authorization code received from the provider.');
      return;
    }

    // Restore context stored before redirect
    let pending = null;
    try {
      pending = JSON.parse(sessionStorage.getItem('pendingOAuth') || 'null');
    } catch { /* ignore */ }

    const provider    = state || pending?.provider;
    const accountId   = pending?.accountId || '';
    const redirectUri = pending?.redirectUri || `${window.location.origin}/integrations/callback`;

    if (!provider) {
      setStatus('error');
      setErrorMsg('Could not determine the OAuth provider. Please try again.');
      return;
    }

    api.post(`/integrations/${provider}/connect`, { code, redirectUri, accountId: accountId || undefined })
      .then(() => {
        sessionStorage.removeItem('pendingOAuth');
        setStatus('success');
        setTimeout(() => navigate('/integrations', { replace: true }), 1200);
      })
      .catch((err) => {
        setStatus('error');
        setErrorMsg(err?.response?.data?.error?.message || 'Failed to complete the connection. Please try again.');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4">
      {status === 'processing' && (
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-accent-blue border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-text-secondary text-sm">Completing connection…</p>
        </div>
      )}

      {status === 'success' && (
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-accent-green/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-6 h-6 text-accent-green" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">Connected!</h2>
          <p className="text-text-secondary text-sm">Redirecting to Integration Hub…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">Connection Failed</h2>
          <p className="text-text-secondary text-sm">{errorMsg}</p>
          <button
            onClick={() => navigate('/integrations', { replace: true })}
            className="btn-primary mt-2"
          >
            Back to Integrations
          </button>
        </div>
      )}
    </div>
  );
}
