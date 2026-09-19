import { useEffect } from 'react';
import { refreshAccount } from '../../api/auth';
import { useAppStore } from '../../stores/app-store';

const refreshLeadMs = 5 * 60 * 1000;

export function AuthSessionRefresher() {
  const { account, accountExpiresAt, setAccountSession, clearAccountSession } = useAppStore();

  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const session = await refreshAccount();
        if (!cancelled) setAccountSession(session.user, session.token, session.expiresAt);
      } catch {
        if (!cancelled) clearAccountSession();
      }
    };
    const expiresAt = Date.parse(accountExpiresAt);
    const delay = Number.isNaN(expiresAt) ? 0 : Math.max(0, expiresAt - Date.now() - refreshLeadMs);
    const timer = window.setTimeout(() => void refresh(), delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [account, accountExpiresAt, clearAccountSession, setAccountSession]);

  return null;
}
