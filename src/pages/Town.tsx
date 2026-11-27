/**
 * BETA — "Qishki shahar" page (Winter Town): the shared town, the five stages with their goals, the player's share,
 * how snow is earned, the stage rewards (taken with "Olish") and the top builders. Data: services/winterTown.ts.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { LuCheck, LuLock, LuGift, LuTrophy, LuHandshake, LuX, LuUsers, LuPlus, LuPencil, LuPaintbrush, LuMoveHorizontal, LuTrash2 } from 'react-icons/lu';
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
  TOWN_SLOTS,
  TOWN_STAGES,
  MAP_H,
  MAP_W,
  type TownItemKey,
  decoItems,
  setTownDeco,
  townDeco,
  townScene,
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

const art = (n: string) => new URL(`town/${n}.webp`, document.baseURI).href;

/** The town picture with everything built so far; in "Bezash" mode the free plots show (+) and take decorations. */
function TownMap({ total }: { total: number }) {
  const { t } = useI18n();
  const scroller = useRef<HTMLDivElement>(null);
  const [deco, setDeco] = useState(() => townDeco());
  const [edit, setEdit] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const [fresh, setFresh] = useState<number | null>(null);
  const scene = useMemo(() => townScene(total, deco), [total, deco]);
  const items = useMemo(() => decoItems(total), [total]);

  // start in the middle of the town (the tree)
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);

  const pick = (slot: number) => {
    setSel(slot);
    haptic('move');
  };
  const put = (it: TownItemKey | null) => {
    if (sel == null) return;
    setDeco(setTownDeco(sel, it));
    setFresh(it ? sel : null);
    haptic(it ? 'capture' : 'move');
  };
  const toggle = () => {
    setEdit((e) => !e);
    setSel(null);
  };

  return (
    <>
      <section className={`town-map-card ${edit ? 'is-edit' : ''}`}>
        <div className="town-map-scroll" ref={scroller}>
          <div className="town-map" style={{ backgroundImage: `url("${art('map')}")` }}>
            {scene.map((p) => (
              <img
                key={p.id + p.item}
                className={`town-sp ${p.slot != null && p.slot === fresh ? 'is-new' : ''} ${p.slot != null && p.slot === sel ? 'is-sel' : ''}`}
                src={art(p.item)}
                alt=""
                draggable={false}
                loading="lazy"
                decoding="async"
                style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, zIndex: p.z }}
              />
            ))}
            {edit &&
              TOWN_SLOTS.map(([x, y], i) => (
                <button
                  key={i}
                  type="button"
                  className={`town-slot ${deco[i] ? 'has' : ''} ${sel === i ? 'is-sel' : ''}`}
                  style={{ left: `${(x / MAP_W) * 100}%`, top: `${(y / MAP_H) * 100}%` }}
                  aria-label={t('town.slot', { n: i + 1 })}
                  onClick={() => pick(i)}
                >
                  {deco[i] ? <LuPencil /> : <LuPlus />}
                </button>
              ))}
          </div>
        </div>
        <span className="town-dates">🗓 {t('town.dates')}</span>
        <span className="town-swipe" aria-hidden>
          <LuMoveHorizontal /> {t('town.swipe')}
        </span>
        <button type="button" className={`btn btn-sm town-edit-btn ${edit ? 'btn-primary' : ''}`} onClick={toggle}>
          {edit ? <LuCheck /> : <LuPaintbrush />} {t(edit ? 'town.done' : 'town.decorate')}
        </button>
      </section>

      {edit && (
        <section className="card town-picker">
          <div className="town-picker-head">
            <b>{sel == null ? t('town.pickSlot') : t('town.slot', { n: sel + 1 })}</b>
            {sel != null && deco[sel] && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => put(null)}>
                <LuTrash2 /> {t('town.remove')}
              </button>
            )}
          </div>
          {sel != null && (
            <div className="town-items">
              {items.map((it) => (
                <button
                  key={it.key}
                  type="button"
                  disabled={!it.open}
                  className={`town-item ${deco[sel] === it.key ? 'is-on' : ''}`}
                  onClick={() => put(it.key)}
                >
                  <img src={art(it.key)} alt="" loading="lazy" decoding="async" draggable={false} />
                  {!it.open && (
                    <small>
                      <LuLock /> {t('town.stageLock', { n: it.stage })}
                    </small>
                  )}
                </button>
              ))}
            </div>
          )}
          <p className="muted small">{t('town.decoHint')}</p>
        </section>
      )}
    </>
  );
}

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
      <TownMap total={total} />
      <div className="town-intro">
        <h1>{t('town.title')}</h1>
        <p>{t('town.sub')}</p>
      </div>

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
