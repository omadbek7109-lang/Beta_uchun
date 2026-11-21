import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  LuAward,
  LuBot,
  LuCalendarCheck,
  LuCheck,
  LuChevronRight,
  LuCoins,
  LuCrown,
  LuGift,
  LuListChecks,
  LuLock,
  LuSparkles,
  LuStar,
  LuSwords,
  LuTrophy,
  LuUserPlus,
  LuZap,
} from 'react-icons/lu';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Confetti } from '../components/Confetti.tsx';
import { ErrorState, Spinner } from '../components/States.tsx';
import { useToast } from '../components/Toast.tsx';
import { SignInPrompt } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import type { TKey } from '../i18n/uz.ts';
import { Link } from '../router.tsx';
import { backendConfigured } from '../services/config.ts';
import { DEFAULT_REWARDS, DEFAULT_RULES, MAX_LEVEL, type RewardView, type Track, type XpSource } from '../services/pass/core.ts';
import { addPassTest, resetPassSeason, type PassTestEvent } from '../services/pass/demo.ts';
import { buyElite, claimPass, equipTitle, getPass, passCheckin, type PassState } from '../services/pass/index.ts';
import { coins } from '../services/shop.ts';
import { haptic } from '../services/telegram.ts';

function useCountdown(to: number | undefined, t: (k: TKey, p?: Record<string, string | number>) => string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const left = to ? Math.max(0, to - now) : 0;
  const d = Math.floor(left / 86_400_000);
  const h = Math.floor((left % 86_400_000) / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  return d > 0 ? t('pass.dh', { d, h }) : t('pass.hm', { h, m });
}

const art = (p: string) => new URL(p, document.baseURI).href;
/** picture for an item reward (same artwork as the shop) */
function itemArt(slug: string): string | null {
  if (slug.startsWith('st-')) return art(`stones/${slug}.webp`);
  if (slug.startsWith('fx-')) return null;
  return art(`boards/${slug}-sm.webp`);
}

function RewardIcon({ r }: { r: RewardView }) {
  if (r.kind === 'coins')
    return (
      <span className="ps-rw-ico ps-coin" aria-hidden>
        <LuCoins />
      </span>
    );
  if (r.kind === 'title')
    return (
      <span className="ps-rw-ico ps-title-ico" aria-hidden>
        {r.level === MAX_LEVEL ? <LuCrown /> : <LuAward />}
      </span>
    );
  const src = itemArt(r.value);
  return src ? (
    <img className="ps-rw-img" src={src} alt="" loading="lazy" />
  ) : (
    <span className="ps-rw-ico ps-fx" aria-hidden>
      <LuSparkles />
    </span>
  );
}

function short(r: RewardView, lang: 'uz' | 'en') {
  if (r.kind === 'coins') return coins(Number(r.value));
  const l = lang === 'en' ? r.label_en : r.label_uz;
  return l.replace(/"/g, '').split(' ')[0];
}

export function Pass() {
  const { t, lang } = useI18n();
  const { signedIn } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<PassState | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [party, setParty] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);

  const load = useCallback(async () => {
    try {
      setData(await getPass());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    if (signedIn || !backendConfigured) void load();
  }, [signedIn, load]);
  const ends = useCountdown(data?.season.end, t);

  // open the track at the current level
  useLayoutEffect(() => {
    if (!data || scrolled.current || !track.current) return;
    const col = track.current.querySelector<HTMLElement>(`[data-lvl="${Math.max(1, data.level.level - 1)}"]`);
    if (col) track.current.scrollLeft = col.offsetLeft - 8;
    scrolled.current = true;
  }, [data]);

  const name = (r: RewardView) => (lang === 'en' ? r.label_en : r.label_uz);

  const claim = async (r: RewardView, silent = false) => {
    const res = await claimPass(r.level, r.track);
    if (!res.ok) {
      if (!silent) {
        haptic('error');
        toast('error', t(`pass.err.${res.error}` as TKey));
      }
      return false;
    }
    if (!silent) {
      haptic('win');
      if (res.item) toast('success', t('pass.gotItem', { name: name(r) }));
      else if (res.title) toast('success', t('pass.gotTitle', { name: name(r).replace(/ \+.*$/, '') }));
      else if (r.kind === 'item') toast('success', t('pass.gotOwned', { name: name(r), n: coins(res.coins) }));
      else toast('success', t('pass.got', { n: coins(res.coins) }));
      if (r.rarity === 'epic' || r.rarity === 'legendary' || r.rarity === 'mythic') setParty((p) => p + 1);
    }
    return true;
  };
  const claimOne = async (r: RewardView) => {
    if (busy) return;
    setBusy(`${r.track}:${r.level}`);
    await claim(r);
    setBusy(null);
    void load();
  };
  const claimAll = async () => {
    if (!data || busy) return;
    setBusy('all');
    let n = 0;
    for (const r of data.rewards.filter((x) => x.state === 'ready')) if (await claim(r, true)) n++;
    setBusy(null);
    haptic('win');
    toast('success', t('pass.gotAll', { n }));
    setParty((p) => p + 1);
    void load();
  };
  const checkin = async () => {
    if (busy) return;
    setBusy('checkin');
    try {
      await passCheckin();
      haptic('move');
    } finally {
      setBusy(null);
      void load();
    }
  };
  const elite = async (m: 'coins' | 'stars') => {
    if (busy) return;
    setBusy('elite');
    const r = await buyElite(m);
    setBusy(null);
    if (r.ok) {
      haptic('win');
      setParty((p) => p + 1);
      toast('success', t('pass.eliteOk', { pct: DEFAULT_RULES.eliteBoostPct }));
    } else {
      haptic('error');
      toast('error', t(`pass.err.${r.error}` as TKey));
    }
    void load();
  };

  if (backendConfigured && !signedIn) return <div className="page"><SignInPrompt text={t('ms.needAccount')} /></div>;
  if (failed) return <div className="page"><ErrorState onRetry={load} /></div>;
  if (!data) return <div className="page"><Spinner /></div>;

  const lv = data.level;
  const pct = lv.nextAt === null ? 100 : Math.round((lv.into / lv.step) * 100);
  const theme = lang === 'en' ? data.season.theme.name_en : data.season.theme.name_uz;
  const levels = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);
  const at = (level: number, tr: Track) => data.rewards.find((r) => r.level === level && r.track === tr)!;
  const titles = DEFAULT_REWARDS.filter((r) => r.kind === 'title' && data.titles.includes(r.value));

  const cell = (r: RewardView) => {
    const key = `${r.track}:${r.level}`;
    const ready = r.state === 'ready';
    return (
      <button
        type="button"
        className={`ps-rw ps-${r.track} ps-${r.state} ps-r-${r.rarity}`}
        onClick={() => (ready ? claimOne(r) : r.state === 'elite_locked' ? toast('info', t('pass.err.elite')) : r.state === 'locked' ? toast('info', `${name(r)} · ${t('pass.level', { n: r.level })}`) : undefined)}
        aria-label={`${t('pass.level', { n: r.level })}: ${name(r)}`}
        disabled={busy === key}
      >
        <RewardIcon r={r} />
        <span className="ps-rw-l">{short(r, lang)}</span>
        {r.state === 'claimed' && (
          <span className="ps-rw-badge ps-ok" aria-hidden>
            <LuCheck />
          </span>
        )}
        {(r.state === 'locked' || r.state === 'elite_locked') && (
          <span className="ps-rw-badge" aria-hidden>
            <LuLock />
          </span>
        )}
        {ready && <span className="ps-rw-claim">{t('pass.claim')}</span>}
      </button>
    );
  };

  const SRC: { s: XpSource; xp: number; icon: typeof LuStar; limit?: string }[] = [
    { s: 'live_game', xp: DEFAULT_RULES.liveGame, icon: LuSwords, limit: t('pass.limit.day', { n: DEFAULT_RULES.liveGamesPerDay }) },
    { s: 'live_win', xp: DEFAULT_RULES.liveWin, icon: LuTrophy },
    { s: 'bot_win', xp: DEFAULT_RULES.botWin, icon: LuBot, limit: t('pass.limit.day', { n: DEFAULT_RULES.botWinsPerDay }) },
    { s: 'checkin', xp: DEFAULT_RULES.checkin, icon: LuCalendarCheck },
    { s: 'mission', xp: DEFAULT_RULES.mission, icon: LuListChecks },
    { s: 'mission_bonus', xp: DEFAULT_RULES.missionBonus, icon: LuGift },
    { s: 'referral', xp: DEFAULT_RULES.referral, icon: LuUserPlus, limit: t('pass.limit.season', { n: DEFAULT_RULES.referralsPerSeason }) },
  ];

  return (
    <div className="page page-narrow ps-page" style={{ ['--ps-h' as string]: data.season.theme.hue }}>
      {party > 0 && <Confetti key={party} />}

      <section className="ps-hero">
        <div className="ps-hero-top">
          <div>
            <span className="ps-season">
              {t('pass.season', { n: data.season.n })} {data.test && <span className="badge badge-demo">BETA</span>}
            </span>
            <h1 className="ps-theme">{theme}</h1>
          </div>
          <span className="ps-ends" title={t('pass.newSeason')}>{t('pass.endsIn', { time: ends })}</span>
        </div>
        <div className="ps-lvl-row">
          <span className={`ps-lvl ${data.elite ? 'ps-lvl-elite' : ''}`}>
            {data.elite && <LuCrown className="ps-lvl-crown" aria-hidden />}
            <strong>{lv.level}</strong>
          </span>
          <div className="ps-lvl-main">
            <div className="ps-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <span style={{ width: `${pct}%` }} />
            </div>
            <span className="ps-xp">
              {lv.nextAt === null ? t('pass.max') : t('pass.xpTo', { xp: coins(data.xp), next: coins(lv.nextAt) })}
            </span>
          </div>
        </div>
        <div className="ps-today">
          <LuZap aria-hidden /> {t('pass.today', { n: data.today.today, cap: DEFAULT_RULES.dailyCap })}
          {data.today.capped && <span className="ps-capped"> · {t('pass.capped')}</span>}
          {data.elite && <span className="ps-boost">+{DEFAULT_RULES.eliteBoostPct}% XP</span>}
        </div>
      </section>

      <section className={`card ps-checkin ${data.checkedInToday ? 'ps-done' : 'ms-ready'}`}>
        <span className="ms-ico ms-ico-gold" aria-hidden>
          <LuCalendarCheck />
        </span>
        <div className="ms-main">
          <div className="ms-title">{t('pass.checkin')}</div>
          <span className="muted small">{t('pass.checkinSub', { n: DEFAULT_RULES.checkin })}</span>
        </div>
        {data.checkedInToday ? (
          <span className="ms-done">
            <LuCheck /> {t('pass.checkedIn')}
          </span>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={checkin} disabled={busy !== null}>
            {t('pass.checkinBtn', { n: DEFAULT_RULES.checkin })}
          </button>
        )}
      </section>

      <section className="card ps-track-card">
        <div className="ps-track-head">
          <h2>{t('pass.title')}</h2>
          {data.readyCount > 0 && (
            <button className="btn btn-primary btn-sm" onClick={claimAll} disabled={busy !== null}>
              <LuGift /> {t('pass.claimAll', { n: data.readyCount })}
            </button>
          )}
        </div>
        <div className="ps-track-wrap">
          <div className="ps-labels" aria-hidden>
            <span className="ps-label ps-label-free">{t('pass.free')}</span>
            <span className="ps-label-mid" />
            <span className="ps-label ps-label-elite">
              <LuCrown /> {t('pass.elite')}
            </span>
          </div>
          <div className="ps-track" ref={track}>
            {levels.map((l) => (
              <div key={l} className={`ps-col ${l <= lv.level ? 'ps-reached' : ''} ${l === lv.level ? 'ps-current' : ''}`} data-lvl={l}>
                {cell(at(l, 'free'))}
                <div className="ps-node">
                  <span className="ps-line" />
                  <span className="ps-dot">{l}</span>
                </div>
                {cell(at(l, 'elite'))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {!data.elite ? (
        <section className="ps-elite-card">
          <div className="ps-elite-top">
            <LuCrown className="ps-elite-crown" aria-hidden />
            <div>
              <div className="ps-elite-title">{t('pass.unlockElite')}</div>
              <div className="ps-elite-sub">{t('pass.elitePerks', { pct: DEFAULT_RULES.eliteBoostPct })}</div>
            </div>
          </div>
          <div className="ps-elite-btns">
            <button className="btn ps-buy ps-buy-coins" onClick={() => elite('coins')} disabled={busy !== null}>
              <LuCoins /> {t('pass.buyCoins', { n: coins(data.price.coins) })}
            </button>
            <button className="btn ps-buy ps-buy-stars" onClick={() => elite('stars')} disabled={busy !== null}>
              <LuStar /> {t('pass.buyStars', { n: data.price.stars })}
            </button>
          </div>
        </section>
      ) : (
        <section className="card ps-elite-on">
          <LuCrown aria-hidden /> {t('pass.eliteHas')} · +{DEFAULT_RULES.eliteBoostPct}% XP
        </section>
      )}

      <section className="card ps-how">
        <h2>{t('pass.howTitle')}</h2>
        <ul>
          {SRC.map(({ s, xp, icon: Icon, limit }) => {
            const today = data.today.todayLines.find((x) => x.source === s);
            return (
              <li key={s}>
                <span className="ps-how-ico" aria-hidden>
                  <Icon />
                </span>
                <span className="ps-how-l">
                  {t(`pass.src.${s}` as TKey)}
                  {limit && <span className="muted small"> · {limit}</span>}
                </span>
                {today && <span className="ps-how-today">{today.count}×</span>}
                <span className="ps-how-xp">+{xp}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {titles.length > 0 && (
        <section className="card ps-titles">
          <h2>{t('pass.titles')}</h2>
          <div className="ps-title-list">
            {titles.map((r) => {
              const on = data.equippedTitle === r.value;
              const label = (lang === 'en' ? r.label_en : r.label_uz).replace(/ \+.*$/, '').replace(/ (unvoni|title)$/, '');
              return (
                <button
                  key={r.value}
                  className={`ps-title-chip ps-r-${r.rarity} ${on ? 'ps-on' : ''}`}
                  onClick={async () => {
                    await equipTitle(on ? null : r.value);
                    void load();
                  }}
                >
                  {r.level === MAX_LEVEL ? <LuCrown /> : <LuAward />} {label}
                  <span className="ps-title-state">{on ? t('pass.equipped') : t('pass.equip')}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {data.test && <PassBeta onChange={load} />}
    </div>
  );
}

const TESTS: { e: PassTestEvent; key: TKey }[] = [
  { e: 'live_win', key: 'pass.t.liveWin' },
  { e: 'live_loss', key: 'pass.t.liveLoss' },
  { e: 'bot_win', key: 'pass.t.bot' },
  { e: 'referral', key: 'pass.t.referral' },
  { e: 'xp_day', key: 'pass.t.day' },
];
function PassBeta({ onChange }: { onChange: () => void }) {
  const { t } = useI18n();
  return (
    <section className="card ms-beta">
      <h2 className="ms-beta-title">{t('ms.betaTitle')}</h2>
      <p className="muted small">{t('pass.betaHint')}</p>
      <div className="ms-beta-grid">
        {TESTS.map(({ e, key }) => (
          <button
            key={e}
            className="btn btn-secondary btn-sm"
            onClick={() => {
              addPassTest(e);
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
          resetPassSeason();
          onChange();
        }}
      >
        {t('pass.t.reset')}
      </button>
    </section>
  );
}

/** Compact entry on Home: season level, rewards waiting. */
export function PassHomeCard() {
  const { t } = useI18n();
  const { signedIn } = useAuth();
  const [data, setData] = useState<PassState | null>(null);
  useEffect(() => {
    if (signedIn || !backendConfigured) getPass().then(setData, () => setData(null));
  }, [signedIn]);
  if (!data) return null;
  const lv = data.level;
  const pct = lv.nextAt === null ? 100 : Math.round((lv.into / lv.step) * 100);
  return (
    <Link to="/pass" className={`ps-home ${data.readyCount > 0 ? 'ps-home-ready' : ''}`} style={{ ['--ps-h' as string]: data.season.theme.hue }}>
      <span className={`ps-lvl ps-lvl-sm ${data.elite ? 'ps-lvl-elite' : ''}`}>
        <strong>{lv.level}</strong>
      </span>
      <span className="ps-home-main">
        <span className="ps-home-title">{t('pass.home', { lvl: lv.level })}</span>
        <span className="ps-bar ps-bar-sm" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </span>
        <span className="ps-home-sub">{data.readyCount > 0 ? t('pass.homeSub', { n: data.readyCount }) : t('pass.homeSub0')}</span>
      </span>
      {data.readyCount > 0 && <span className="ms-dot" aria-hidden />}
      <LuChevronRight className="ps-home-go" aria-hidden />
    </Link>
  );
}
