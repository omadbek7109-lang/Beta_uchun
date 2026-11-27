/**
 * BETA — "Qishki shahar" page (Winter Town): the shared town, the five stages with their goals, the player's share,
 * how snow is earned, the stage rewards (taken with "Olish") and the top builders. Data: services/winterTown.ts.
 */
import { useEffect, useMemo, useState } from 'react';
import { LuCheck, LuLock, LuGift, LuTrophy, LuHandshake, LuX, LuUsers } from 'react-icons/lu';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Avatar } from '../components/Avatar.tsx';
import { useToast } from '../components/Toast.tsx';
import { useI18n } from '../i18n/index.tsx';
import type { TKey } from '../i18n/uz.ts';
import { DEMO_PLAYERS } from '../services/demoData.ts';
import { haptic } from '../services/telegram.ts';
import {
  SNOW_PER,
  TOWN_EVENT,
  TOWN_STAGES,
  claimTownStage,
  communitySnow,
  currentStage,
  mySnow,
  participants,
  roadProgress,
  stageOpen,
  topBuilders,
  townClaimed,
} from '../services/winterTown.ts';

const townArt = () => new URL('boards/ny-town.webp', document.baseURI).href;

export function Town() {
  const { t, num } = useI18n();
  const { me, matches } = useAuth();
  const { toast } = useToast();
  const [claimed, setClaimed] = useState<number[]>(() => townClaimed());
  useEffect(() => {
    const on = () => setClaimed(townClaimed());
    window.addEventListener(TOWN_EVENT, on);
    return () => window.removeEventListener(TOWN_EVENT, on);
  }, []);

  const mine = useMemo(() => mySnow(matches), [matches]);
  const total = communitySnow(mine);
  const people = participants(total);
  const next = currentStage(total);
  const prog = roadProgress(total);
  const { top, myPlace } = useMemo(() => topBuilders(DEMO_PLAYERS, me ? { id: me.id, username: me.username, avatar: me.avatar } : null, mine), [me, mine]);
  const name = (k: string) => t(`town.stage.${k}` as TKey);

  const take = (n: number) => {
    const r = claimTownStage(n, total);
    if (r.ok) {
      haptic('move');
      toast('success', t('town.got', { n: num(r.coins) }));
    } else toast('error', t(r.error === 'claimed' ? 'town.err.claimed' : 'town.err.locked'));
  };

  return (
    <div className="page town">
      <section className="town-hero" style={{ backgroundImage: `url("${townArt()}")` }}>
        <div className="town-hero-veil" />
        <span className="town-dates">🗓 {t('town.dates')}</span>
        <div className="town-hero-text">
          <h1>{t('town.title')}</h1>
          <p>{t('town.sub')}</p>
        </div>
      </section>

      <section className="town-stats">
        <div className="town-stat town-stat-main">
          <span className="town-flake" aria-hidden>❄</span>
          <div>
            <b>{num(total)}</b>
            <small>{t('town.total')}</small>
          </div>
          <div className="town-people">
            <LuUsers aria-hidden /> <b>{num(people)}</b> <small>{t('town.people')}</small>
          </div>
        </div>
        <div className="town-stat">
          <small>{t('town.mine')}</small>
          <b>
            ❄ {num(mine)}
          </b>
          {myPlace && <small className="muted">#{myPlace}</small>}
        </div>
      </section>

      <section className="town-road" aria-label={t('town.stages')}>
        <div className="town-line">
          <i style={{ width: `${Math.round(prog * 100)}%` }} />
        </div>
        <ol>
          {TOWN_STAGES.map((s) => {
            const open = stageOpen(s, total);
            const now = next?.n === s.n;
            return (
              <li key={s.n} className={`town-st ${open ? 'is-open' : ''} ${now ? 'is-now' : ''}`}>
                <span className="town-st-ico">
                  {open || now ? s.icon : <LuLock />}
                  {open && (
                    <em className="town-st-ok">
                      <LuCheck />
                    </em>
                  )}
                </span>
                <span className="town-st-dot" />
                <b>
                  {s.n}. {name(s.key)}
                </b>
                <small>❄ {num(s.goal)}</small>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="card town-card">
        <h2>
          <LuGift aria-hidden /> {t('town.rewards')}
        </h2>
        <p className="muted small">{t('town.rewardsHint')}</p>
        <ul className="town-rewards">
          {TOWN_STAGES.map((s) => {
            const open = stageOpen(s, total);
            const got = claimed.includes(s.n);
            return (
              <li key={s.n} className={open ? '' : 'is-locked'}>
                <span className="town-rw-ico">{s.icon}</span>
                <span className="town-rw-main">
                  <b>
                    {s.n}. {name(s.key)}
                  </b>
                  <small>
                    +{num(s.coins)} DAMEO Coin{s.n === 5 ? ` · ${t('town.finalGift')}` : ''}
                  </small>
                </span>
                {got ? (
                  <span className="badge">
                    <LuCheck /> {t('town.taken')}
                  </span>
                ) : open ? (
                  <button className="btn btn-primary btn-sm" onClick={() => take(s.n)}>
                    {t('town.take')}
                  </button>
                ) : (
                  <span className="badge">
                    <LuLock /> ❄ {num(s.goal)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card town-card">
        <h2>❄ {t('town.how')}</h2>
        <ul className="town-how">
          <li>
            <LuTrophy className="ico-gold" aria-hidden /> {t('town.how.win')} <b>+{SNOW_PER.win} ❄</b>
          </li>
          <li>
            <LuHandshake aria-hidden /> {t('town.how.draw')} <b>+{SNOW_PER.draw} ❄</b>
          </li>
          <li>
            <LuX className="ico-loss" aria-hidden /> {t('town.how.loss')} <b>+{SNOW_PER.loss} ❄</b>
          </li>
        </ul>
      </section>

      <section className="card town-card">
        <h2>
          <span aria-hidden>👑</span> {t('town.top')}
        </h2>
        <ol className="town-top">
          {top.map((r, i) => (
            <li key={r.id} className={r.me ? 'is-me' : ''}>
              <span className={`town-place town-place-${i + 1}`}>{i + 1}</span>
              <Avatar name={r.name} seed={r.avatar ?? undefined} size={34} frame={null} />
              <span className="town-top-name">{r.me ? t('town.you') : r.name}</span>
              <b>❄ {num(r.snow)}</b>
            </li>
          ))}
        </ol>
        <p className="muted small">{t('town.topHint')}</p>
      </section>
      <p className="muted small town-beta">{t('town.beta')}</p>
    </div>
  );
}
