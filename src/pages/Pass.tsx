import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuBot, LuCalendarCheck, LuCheck, LuChevronRight, LuCrown, LuGift, LuListChecks, LuLock, LuShield, LuSwords, LuTrophy, LuUserPlus, LuZap } from 'react-icons/lu';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Avatar } from '../components/Avatar.tsx';
import { Confetti } from '../components/Confetti.tsx';
import { BadgeArt, EmojiArt, PassFrame, ProfileBg, RewardArt, TitleTag } from '../components/PassArt.tsx';
import { ErrorState, Spinner } from '../components/States.tsx';
import { useToast } from '../components/Toast.tsx';
import { SignInPrompt } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';
import type { TKey } from '../i18n/uz.ts';
import { Link } from '../router.tsx';
import { backendConfigured } from '../services/config.ts';
import { DEFAULT_REWARDS, DEFAULT_RULES, MAX_LEVEL, type CosmeticKind, type RewardView, type Track, type XpSource } from '../services/pass/core.ts';
import { addPassTest, resetPassSeason, type PassTestEvent } from '../services/pass/demo.ts';
import { buyElite, claimPass, equipCosmetic, getPass, passCheckin, type PassState } from '../services/pass/index.ts';
import { coins } from '../services/shop.ts';
import { haptic } from '../services/telegram.ts';

const som = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

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

export function Pass() {
  const { t, lang } = useI18n();
  const { signedIn, me } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<PassState | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [party, setParty] = useState(0);
  const [tab, setTab] = useState<CosmeticKind>('emoji');
  const [reveal, setReveal] = useState<Reveal | null>(null);
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

  useLayoutEffect(() => {
    if (!data || scrolled.current || !track.current) return;
    const col = track.current.querySelector<HTMLElement>(`[data-lvl="${Math.max(1, data.level.level - 1)}"]`);
    if (col) track.current.scrollLeft = col.offsetLeft - 8;
    scrolled.current = true;
  }, [data]);

  const name = (r: { label_uz: string; label_en: string }) => (lang === 'en' ? r.label_en : r.label_uz);

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
      const sub =
        r.kind === 'item' && !res.item
          ? t('pass.gotOwned', { name: name(r), n: coins(res.coins) })
          : r.kind === 'xp_boost'
            ? t('pass.gotBoost', { n: res.boost, d: r.days ?? 1 })
            : r.kind === 'coins' || r.kind === 'box'
              ? null
              : t('pass.revealWear');
      setReveal({ items: [r], coins: res.coins, sub });
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
    const got = data.rewards.filter((x) => x.state === 'ready');
    setReveal({ items: got.slice(0, n), coins: 0, sub: t('pass.gotAll', { n }) });
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
  const premium = async () => {
    if (busy) return;
    setBusy('elite');
    const r = await buyElite();
    setBusy(null);
    if (r.ok) {
      haptic('win');
      setParty((p) => p + 1);
      toast('success', r.test ? t('pass.premiumTest') : t('pass.premiumOk'));
    } else if (r.error === 'pay_flect') {
      window.open('https://t.me/Flect_starsBot?startapp=dameo_pass', '_blank');
    } else {
      haptic('error');
      toast('error', t(`pass.err.${r.error}` as TKey));
    }
    void load();
  };
  const wear = async (kind: CosmeticKind, id: string | null) => {
    await equipCosmetic(kind, id);
    haptic('move');
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

  const cell = (r: RewardView) => {
    const key = `${r.track}:${r.level}`;
    const ready = r.state === 'ready';
    return (
      <button
        type="button"
        className={`ps-rw ps-${r.track} ps-${r.state} ps-r-${r.rarity}`}
        onClick={() => (ready ? claimOne(r) : toast('info', `${t('pass.level', { n: r.level })} · ${name(r)}${r.state === 'elite_locked' ? ` · ${t('pass.premium')}` : ''}`))}
        aria-label={`${t('pass.level', { n: r.level })}: ${name(r)}`}
        disabled={busy === key}
      >
        <RewardArt r={r} />
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

  const showcase = (tr: Track) => (
    <div className={`ps-show ps-show-${tr}`}>
      <div className="ps-show-head">
        {tr === 'free' ? <LuShield className="ps-show-ico" aria-hidden /> : <LuCrown className="ps-show-ico" aria-hidden />}
        <div>
          <h2>{tr === 'free' ? t('pass.freePass') : t('pass.premiumPass')}</h2>
          <span>{tr === 'free' ? t('pass.freeSub') : t('pass.premiumSub', { som: som(data.price.som) })}</span>
        </div>
      </div>
      <div className="ps-show-grid">
        {data.rewards
          .filter((r) => r.track === tr)
          .map((r) => (
            <div key={r.level} className={`ps-card ps-r-${r.rarity} ps-card-${r.state}`}>
              <span className="ps-card-lv">Lv.{r.level}</span>
              <RewardArt r={r} />
              <span className="ps-card-l">{name(r)}</span>
              {r.state === 'claimed' && <LuCheck className="ps-card-ok" aria-hidden />}
            </div>
          ))}
      </div>
    </div>
  );

  const KINDS: { k: CosmeticKind; key: TKey }[] = [
    { k: 'emoji', key: 'pass.k.emoji' },
    { k: 'frame', key: 'pass.k.frame' },
    { k: 'background', key: 'pass.k.background' },
    { k: 'badge', key: 'pass.k.badge' },
    { k: 'title', key: 'pass.k.title' },
  ];
  const mine = data.owned.filter((o) => o.kind === tab);
  const rewardOf = (kind: CosmeticKind, id: string) => DEFAULT_REWARDS.find((r) => r.kind === kind && r.value === id);
  const w = data.equipped;

  const SRC: { s: XpSource; xp: number; icon: typeof LuZap; limit?: string }[] = [
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
      {reveal && <RewardReveal reveal={reveal} onClose={() => setReveal(null)} />}

      <section className="ps-hero">
        <div className="ps-hero-top">
          <div>
            <span className="ps-season">
              Season {String(data.season.n).padStart(2, '0')} {data.test && <span className="badge badge-demo">BETA</span>}
            </span>
            <h1 className="ps-theme">{theme}</h1>
          </div>
          <span className="ps-ends" title={t('pass.newSeason')}>
            {t('pass.endsIn', { time: ends })}
          </span>
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
            <span className="ps-xp">{lv.nextAt === null ? t('pass.max') : t('pass.xpTo', { xp: coins(data.xp), next: coins(lv.nextAt) })}</span>
          </div>
        </div>
        <div className="ps-today">
          <LuZap aria-hidden /> {t('pass.today', { n: data.today.today, cap: DEFAULT_RULES.dailyCap })}
          {data.today.capped && <span className="ps-capped"> · {t('pass.capped')}</span>}
          {data.boostToday > 0 && <span className="ps-boost">XP +{data.boostToday}%</span>}
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
          <h2>DAMEO Pass</h2>
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
              <LuCrown /> {t('pass.premium')}
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
              <div className="ps-elite-title">PREMIUM PASS</div>
              <div className="ps-elite-sub">{t('pass.premiumPerks')}</div>
            </div>
          </div>
          <button className="btn ps-buy ps-buy-coins" onClick={premium} disabled={busy !== null}>
            <LuCrown /> {t('pass.buySom', { n: som(data.price.som) })}
          </button>
          {data.test && <span className="ps-elite-note">{t('pass.premiumBetaNote')}</span>}
        </section>
      ) : (
        <section className="card ps-elite-on">
          <LuCrown aria-hidden /> {t('pass.premiumHas')}
        </section>
      )}

      <section className="card ps-coll">
        <h2>{t('pass.myStyle')}</h2>
        <div className={`ps-preview ${w.background ? 'has-pbg' : ''}`}>
          <ProfileBg id={w.background} />
          <PassFrame id={w.frame} size={64}>
            <Avatar name={me?.username ?? 'DAMEO'} seed={me?.avatar} size={64} userId={me?.id} />
          </PassFrame>
          <div className="ps-preview-id">
            <strong>
              {me?.username ?? 'DAMEO'} {w.emoji && <EmojiArt id={w.emoji} size={20} className="pa-name-emoji" />}
            </strong>
            <span className="ps-preview-tags">
              {w.title && <TitleTag id={w.title} lang={lang} />}
              {w.badge && <BadgeArt id={w.badge} size={26} />}
            </span>
          </div>
        </div>
        <div className="seg ps-kinds" role="tablist">
          {KINDS.map(({ k, key }) => (
            <button key={k} role="tab" aria-selected={tab === k} className={`seg-btn ${tab === k ? 'seg-on' : ''}`} onClick={() => setTab(k)}>
              {t(key)}
            </button>
          ))}
        </div>
        {mine.length === 0 ? (
          <p className="muted small">{t('pass.emptyKind')}</p>
        ) : (
          <div className="ps-own">
            {mine.map((o) => {
              const r = rewardOf(o.kind, o.id);
              if (!r) return null;
              const on = w[o.kind] === o.id;
              const left = o.until ? Math.max(0, Math.ceil((o.until - Date.now()) / 86_400_000)) : null;
              return (
                <button key={o.id} className={`ps-own-item ps-r-${r.rarity} ${on ? 'ps-on' : ''}`} onClick={() => wear(o.kind, on ? null : o.id)}>
                  <RewardArt r={r} />
                  <span className="ps-own-l">{name(r).replace(/ \(.*\)$/, '')}</span>
                  <span className="ps-own-s">{on ? t('pass.equipped') : t('pass.equip')}</span>
                  {left !== null && <span className="ps-own-days">{t('pass.daysLeft', { n: left })}</span>}
                </button>
              );
            })}
          </div>
        )}
        <Link to="/profile" className="ps-to-profile">
          {t('pass.seeProfile')} <LuChevronRight />
        </Link>
      </section>

      {showcase('free')}
      {showcase('elite')}

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

      {data.test && <PassBeta onChange={load} />}
    </div>
  );
}

interface Reveal {
  items: RewardView[];
  coins: number;
  sub: string | null;
}
const RARITY_KEY: Record<string, TKey> = {
  common: 'pass.r.common',
  rare: 'pass.r.rare',
  epic: 'pass.r.epic',
  legendary: 'pass.r.legendary',
  mythic: 'pass.r.mythic',
};
/** Full-screen reward reveal: flash, rotating rays, lightning for Premium, confetti, the reward popping in. */
function RewardReveal({ reveal, onClose }: { reveal: Reveal; onClose: () => void }) {
  const { t, lang } = useI18n();
  const one = reveal.items.length === 1 ? reveal.items[0] : null;
  const prem = reveal.items.some((r) => r.track === 'elite');
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!one || !reveal.coins) return;
    let n = 0;
    const step = Math.max(1, Math.round(reveal.coins / 30));
    const id = setInterval(() => {
      n = Math.min(reveal.coins, n + step);
      setShown(n);
      if (n >= reveal.coins) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
  }, [one, reveal.coins]);
  const bits = useMemo(
    () =>
      Array.from({ length: prem ? 46 : 28 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        dur: 1.8 + Math.random() * 1.4,
        color: prem ? ['#fde68a', '#f59e0b', '#fff7d1', '#c084fc'][i % 4] : ['#c4b5fd', '#a855f7', '#fde68a', '#22d3ee'][i % 4],
      })),
    [prem],
  );
  const name = (r: RewardView) => (lang === 'en' ? r.label_en : r.label_uz);
  return createPortal(
    <div className={`pr-veil ${prem ? 'pr-prem' : ''}`} role="dialog" aria-modal="true" onClick={onClose}>
      <span className="pr-flash" />
      <span className="pr-rays" />
      {prem && (
        <svg className="pr-bolts" viewBox="0 0 400 800" preserveAspectRatio="none" aria-hidden>
          <path d="M40 60l40 70-24 6 50 90-20 8 40 80" fill="none" stroke="#fde68a" strokeWidth="3" strokeLinejoin="round" />
          <path d="M360 90l-36 64 22 8-46 84 20 6-36 78" fill="none" stroke="#fde68a" strokeWidth="3" strokeLinejoin="round" />
          <path d="M60 760l30-70-22-6 42-80-18-8 34-70" fill="none" stroke="#fef3c7" strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M340 740l-34-66 22-8-40-76 20-6-30-64" fill="none" stroke="#fef3c7" strokeWidth="2.4" strokeLinejoin="round" />
        </svg>
      )}
      <span className="pr-confetti" aria-hidden>
        {bits.map((b, i) => (
          <i key={i} style={{ left: `${b.left}%`, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, background: b.color }} />
        ))}
      </span>
      {one ? (
        <div className={`pr-card pr-r-${one.rarity} ${prem ? 'pr-prem-c' : ''}`} onClick={(e) => e.stopPropagation()}>
          <span className="pr-lv">
            {one.track === 'elite' ? 'PREMIUM PASS' : 'FREE PASS'} · LV.{one.level}
          </span>
          <span className="pr-rarity">{t(RARITY_KEY[one.rarity])}</span>
          <div className="pr-stage">
            <RewardArt r={one} big />
          </div>
          <div className="pr-name">{name(one)}</div>
          {reveal.coins > 0 && <div className="pr-coins">+{coins(shown)} coin</div>}
          {reveal.sub && <div className="pr-sub">{reveal.sub}</div>}
          <button className="pr-btn" onClick={onClose}>
            {t('pass.revealOk')}
          </button>
        </div>
      ) : (
        <div className="pr-card" onClick={(e) => e.stopPropagation()}>
          <span className="pr-rarity">{reveal.sub}</span>
          <div className="pr-grid">
            {reveal.items.map((r, i) => (
              <div key={`${r.track}${r.level}`} className={`ps-card ps-r-${r.rarity}`} style={{ animationDelay: `${i * 0.06}s` }}>
                <span className="ps-card-lv">Lv.{r.level}</span>
                <RewardArt r={r} />
                <span className="ps-card-l">{name(r)}</span>
              </div>
            ))}
          </div>
          <button className="pr-btn" onClick={onClose}>
            {t('pass.revealOk')}
          </button>
        </div>
      )}
    </div>,
    document.body,
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
