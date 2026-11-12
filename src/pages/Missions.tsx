import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LuCheck,
  LuChevronLeft,
  LuCoins,
  LuFlame,
  LuGift,
  LuPuzzle,
  LuSettings2,
  LuSwords,
  LuTarget,
  LuTrophy,
  LuUserPlus,
  LuBot,
} from 'react-icons/lu';
import { useAuth } from '../auth/AuthProvider.tsx';
import { ErrorState, Spinner } from '../components/States.tsx';
import { useToast } from '../components/Toast.tsx';
import { SignInPrompt } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import type { TKey } from '../i18n/uz.ts';
import { Link, useRoute } from '../router.tsx';
import { adminMe } from '../services/admin.ts';
import { backendConfigured } from '../services/config.ts';
import { maxDaily } from '../services/missions/core.ts';
import { addTestEvent, resetTestDay, type TestEvent } from '../services/missions/demo.ts';
import {
  BONUS_SLUG,
  claimMission,
  getMissionConfig,
  getMissions,
  saveMissionConfig,
  type MissionConfig,
  type MissionKind,
  type MissionsState,
} from '../services/missions/index.ts';
import { coins } from '../services/shop.ts';
import { haptic } from '../services/telegram.ts';

const ICON: Record<MissionKind, typeof LuTarget> = {
  puzzle_solve: LuPuzzle,
  referral_join: LuUserPlus,
  bot_win_medium: LuBot,
  rated_win_streak: LuFlame,
  rated_complete: LuSwords,
  rated_win: LuTrophy,
  match_complete: LuTarget,
};
/** where "Go" takes the player for each kind (null = the feature is not in the app yet) */
const GO: Record<MissionKind, { to: string; key: TKey } | null> = {
  puzzle_solve: null,
  referral_join: { to: '/referral', key: 'ms.invite' },
  bot_win_medium: { to: '/play', key: 'ms.go' },
  rated_win_streak: { to: '/play', key: 'ms.go' },
  rated_complete: { to: '/play', key: 'ms.go' },
  rated_win: { to: '/play', key: 'ms.go' },
  match_complete: { to: '/play', key: 'ms.go' },
};

function useCountdown(to: number | undefined, onZero: () => void) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = to ? Math.max(0, to - now) : 0;
  useEffect(() => {
    if (to && left === 0) onZero();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, left === 0]);
  const s = Math.floor(left / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function Missions() {
  const route = useRoute();
  if (route.segments[1] === 'admin') return <MissionsAdmin />;
  return <MissionsBoard />;
}

function useCanEdit() {
  const { mode, signedIn } = useAuth();
  const [can, setCan] = useState(!backendConfigured);
  useEffect(() => {
    if (backendConfigured && mode === 'live' && signedIn)
      adminMe().then((r) => setCan(r.perms.includes('tournaments.manage')), () => setCan(false));
  }, [mode, signedIn]);
  return can;
}

function MissionsBoard() {
  const { t, lang } = useI18n();
  const { signedIn } = useAuth();
  const { toast } = useToast();
  const canEdit = useCanEdit();
  const [data, setData] = useState<MissionsState | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getMissions());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    if (signedIn || !backendConfigured) void load();
  }, [signedIn, load]);
  const resetIn = useCountdown(data?.resetsAt, load);

  const claim = async (slug: string) => {
    if (busy) return;
    setBusy(slug);
    const r = await claimMission(slug);
    setBusy(null);
    if (r.ok) {
      haptic('win');
      toast('success', t('ms.got', { n: coins(r.amount) }));
    } else {
      haptic('error');
      toast('error', t(`ms.err.${r.error}` as TKey));
    }
    void load();
  };

  if (backendConfigured && !signedIn) return <div className="page"><SignInPrompt text={t('ms.needAccount')} /></div>;
  if (failed) return <div className="page"><ErrorState onRetry={load} /></div>;
  if (!data) return <div className="page"><Spinner /></div>;

  const done = data.missions.filter((m) => m.claimed).length;
  const pct = data.cap ? Math.min(100, Math.round((data.earned / data.cap) * 100)) : 0;
  const title = (m: { title_uz: string; title_en: string }) => (lang === 'en' ? m.title_en : m.title_uz);

  return (
    <div className="page page-narrow ms-page">
      <header className="page-head ms-head">
        <div>
          <h1>
            {t('ms.title')} {data.test && <span className="badge badge-demo">BETA</span>}
          </h1>
          <p>{t('ms.resetIn', { time: resetIn })}</p>
        </div>
        {canEdit && (
          <Link to="/missions/admin" className="btn btn-ghost btn-sm" aria-label={t('ms.admin')}>
            <LuSettings2 /> {t('ms.admin')}
          </Link>
        )}
      </header>

      <section className="card ms-summary" aria-label={t('ms.earned')}>
        <div className="ms-summary-top">
          <div>
            <span className="ms-summary-l">{t('ms.earned')}</span>
            <strong className="ms-summary-v">
              {coins(data.earned)} <span className="muted">/ {coins(data.cap)}</span>
            </strong>
          </div>
          <div className="ms-summary-side">
            <span className="ms-summary-l">{data.test ? t('ms.testBalance') : t('ms.balance')}</span>
            <strong>
              <LuCoins /> {coins(data.balance)}
            </strong>
          </div>
        </div>
        <div className="ms-bar" role="progressbar" aria-valuemin={0} aria-valuemax={data.cap} aria-valuenow={data.earned}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <span className="muted small">{t('ms.doneOf', { done, total: data.missions.length })}</span>
      </section>

      <ul className="ms-list">
        {data.missions.map((m) => {
          const Icon = ICON[m.kind];
          const go = GO[m.kind];
          const p = Math.round((m.progress / m.target) * 100);
          const state = m.claimed ? 'claimed' : m.claimable ? 'ready' : 'todo';
          return (
            <li key={m.slug} className={`card ms-item ms-${state}`}>
              <span className="ms-ico" aria-hidden>
                <Icon />
              </span>
              <div className="ms-main">
                <div className="ms-title">{title(m)}</div>
                <div className="ms-row">
                  <div className="ms-bar ms-bar-sm" aria-hidden>
                    <span style={{ width: `${p}%` }} />
                  </div>
                  <span className="ms-count">
                    {m.progress}/{m.target}
                  </span>
                </div>
                {m.kind === 'puzzle_solve' && !m.claimed && m.progress < m.target && <span className="muted small">{t('ms.puzzleSoon')}</span>}
              </div>
              <div className="ms-act">
                <span className="ms-reward">+{coins(m.reward)}</span>
                {state === 'claimed' ? (
                  <span className="ms-done">
                    <LuCheck /> {t('ms.claimed')}
                  </span>
                ) : state === 'ready' ? (
                  <button className="btn btn-primary btn-sm" disabled={busy !== null} onClick={() => claim(m.slug)}>
                    {busy === m.slug ? '…' : t('ms.claim')}
                  </button>
                ) : go ? (
                  <Link to={go.to} className="btn btn-secondary btn-sm">
                    {t(go.key)}
                  </Link>
                ) : (
                  <span className="ms-soon">{t('ms.soon')}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <section className={`card ms-bonus ${data.bonusClaimed ? 'ms-claimed' : data.bonusClaimable ? 'ms-ready' : ''}`}>
        <span className="ms-ico ms-ico-gold" aria-hidden>
          <LuGift />
        </span>
        <div className="ms-main">
          <div className="ms-title">{t('ms.bonusTitle')}</div>
          <span className="muted small">{data.bonusClaimed ? t('ms.bonusDone') : t('ms.bonusHint')}</span>
        </div>
        <div className="ms-act">
          <span className="ms-reward">+{coins(data.bonus)}</span>
          {data.bonusClaimed ? (
            <span className="ms-done">
              <LuCheck /> {t('ms.claimed')}
            </span>
          ) : (
            <button className="btn btn-primary btn-sm" disabled={!data.bonusClaimable || busy !== null} onClick={() => claim(BONUS_SLUG)}>
              {t('ms.claim')}
            </button>
          )}
        </div>
      </section>

      {data.test && <BetaPanel onChange={load} />}
    </div>
  );
}

const TEST_EVENTS: { e: TestEvent; key: TKey }[] = [
  { e: 'puzzle', key: 'ms.t.puzzle' },
  { e: 'referral', key: 'ms.t.referral' },
  { e: 'rated_win', key: 'ms.t.ratedWin' },
  { e: 'rated_loss', key: 'ms.t.ratedLoss' },
  { e: 'bot_medium_win', key: 'ms.t.bot' },
  { e: 'casual_game', key: 'ms.t.casual' },
];
function BetaPanel({ onChange }: { onChange: () => void }) {
  const { t } = useI18n();
  return (
    <section className="card ms-beta">
      <h2 className="ms-beta-title">{t('ms.betaTitle')}</h2>
      <p className="muted small">{t('ms.betaHint')}</p>
      <div className="ms-beta-grid">
        {TEST_EVENTS.map(({ e, key }) => (
          <button
            key={e}
            className="btn btn-secondary btn-sm"
            onClick={() => {
              addTestEvent(e);
              onChange();
            }}
          >
            {t(key)}
          </button>
        ))}
      </div>
      <button
        className="btn btn-ghost btn-sm btn-block"
        onClick={() => {
          resetTestDay();
          onChange();
        }}
      >
        {t('ms.t.reset')}
      </button>
    </section>
  );
}

/* ================================================================= admin */
function MissionsAdmin() {
  const { t } = useI18n();
  const { toast } = useToast();
  const canEdit = useCanEdit();
  const [cfg, setCfg] = useState<MissionConfig | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setCfg(await getMissionConfig());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    if (canEdit) void load();
  }, [canEdit, load]);
  const total = useMemo(() => (cfg ? maxDaily(cfg.defs, cfg.settings) : 0), [cfg]);

  if (!canEdit) return <div className="page"><ErrorState message={t('ms.adminOnly')} /></div>;
  if (failed) return <div className="page"><ErrorState onRetry={load} /></div>;
  if (!cfg) return <div className="page"><Spinner /></div>;

  const setDef = (slug: string, patch: Partial<MissionConfig['defs'][number]>) =>
    setCfg({ ...cfg, defs: cfg.defs.map((d) => (d.slug === slug ? { ...d, ...patch } : d)) });
  const setS = (patch: Partial<MissionConfig['settings']>) => setCfg({ ...cfg, settings: { ...cfg.settings, ...patch } });
  const int = (v: string) => (v === '' ? 0 : Math.trunc(Number(v)));
  const save = async () => {
    setSaving(true);
    const err = await saveMissionConfig(cfg);
    setSaving(false);
    if (err) toast('error', t(`ms.cfg.${err}` as TKey));
    else {
      toast('success', t('ms.saved'));
      void load();
    }
  };

  return (
    <div className="page page-narrow ms-page">
      <header className="page-head ms-head">
        <div>
          <Link to="/missions" className="ms-back">
            <LuChevronLeft /> {t('ms.title')}
          </Link>
          <h1>{t('ms.adminTitle')}</h1>
        </div>
      </header>

      <section className="card ms-cfg">
        <div className="ms-cfg-grid">
          <label>
            <span>{t('ms.bonus')}</span>
            <input className="input" inputMode="numeric" value={cfg.settings.bonus} onChange={(e) => setS({ bonus: int(e.target.value) })} />
          </label>
          <label>
            <span>{t('ms.cap')}</span>
            <input className="input" inputMode="numeric" value={cfg.settings.dailyCap} onChange={(e) => setS({ dailyCap: int(e.target.value) })} />
          </label>
          <label>
            <span>{t('ms.minMoves')}</span>
            <input className="input" inputMode="numeric" value={cfg.settings.minMoves} onChange={(e) => setS({ minMoves: int(e.target.value) })} />
          </label>
        </div>
        <p className={`ms-total ${total > cfg.settings.dailyCap ? 'ms-total-bad' : ''}`}>{t('ms.maxDaily', { n: total, cap: cfg.settings.dailyCap })}</p>
      </section>

      <ul className="ms-list">
        {cfg.defs.map((d) => {
          const Icon = ICON[d.kind];
          return (
            <li key={d.slug} className={`card ms-edit ${d.active ? '' : 'ms-off'}`}>
              <div className="ms-edit-head">
                <span className="ms-ico" aria-hidden>
                  <Icon />
                </span>
                <code className="ms-slug">{d.slug}</code>
                <label className="ms-switch">
                  <input type="checkbox" checked={d.active} onChange={(e) => setDef(d.slug, { active: e.target.checked })} />
                  <span>{t('ms.active')}</span>
                </label>
              </div>
              <label>
                <span>{t('ms.titleUz')}</span>
                <input className="input" value={d.title_uz} maxLength={120} onChange={(e) => setDef(d.slug, { title_uz: e.target.value })} />
              </label>
              <label>
                <span>{t('ms.titleEn')}</span>
                <input className="input" value={d.title_en} maxLength={120} onChange={(e) => setDef(d.slug, { title_en: e.target.value })} />
              </label>
              <div className="ms-cfg-grid">
                <label>
                  <span>{t('ms.target')}</span>
                  <input className="input" inputMode="numeric" value={d.target} onChange={(e) => setDef(d.slug, { target: int(e.target.value) })} />
                </label>
                <label>
                  <span>{t('ms.reward')}</span>
                  <input className="input" inputMode="numeric" value={d.reward} onChange={(e) => setDef(d.slug, { reward: int(e.target.value) })} />
                </label>
                <label>
                  <span>{t('ms.order')}</span>
                  <input className="input" inputMode="numeric" value={d.sort} onChange={(e) => setDef(d.slug, { sort: int(e.target.value) })} />
                </label>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="ms-savebar">
        <button className="btn btn-primary btn-block btn-lg" disabled={saving} onClick={save}>
          {saving ? '…' : t('ms.save')}
        </button>
      </div>
    </div>
  );
}

/** Compact entry on Home: today's progress, links to the missions page. */
export function MissionsHomeCard() {
  const { t } = useI18n();
  const { signedIn } = useAuth();
  const [data, setData] = useState<MissionsState | null>(null);
  useEffect(() => {
    if (signedIn || !backendConfigured) getMissions().then(setData, () => setData(null));
  }, [signedIn]);
  if (!data) return null;
  const done = data.missions.filter((m) => m.claimed).length;
  const ready = data.missions.some((m) => m.claimable) || data.bonusClaimable;
  return (
    <Link to="/missions" className={`card ms-home ${ready ? 'ms-ready' : ''}`}>
      <span className="ms-ico ms-ico-gold" aria-hidden>
        <LuTarget />
      </span>
      <span className="ms-main">
        <span className="ms-title">{t('ms.title')}</span>
        <span className="muted small">{t('ms.homeSub', { done, total: data.missions.length, earned: data.earned, cap: data.cap })}</span>
      </span>
      {ready && <span className="ms-dot" aria-hidden />}
    </Link>
  );
}
