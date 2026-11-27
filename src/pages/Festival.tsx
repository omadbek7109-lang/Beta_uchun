/**
 * BETA — "Qish festivali" (Winter Festival) page: countdown, advent calendar, the Ice Giant boss, the team race,
 * holiday bots, the gift board, 12 challenges, the New Year's Eve arena and the "DAMEO 2026" year review.
 * Rules: services/festival.ts. Light by design: CSS only, one 1 s timer while the page is visible.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuCheck, LuChevronLeft, LuChevronRight, LuGift, LuLock, LuPlay, LuShare2, LuSparkles, LuSwords, LuTrophy, LuX } from 'react-icons/lu';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Confetti } from '../components/Confetti.tsx';
import { useToast } from '../components/Toast.tsx';
import { useI18n, type TKey } from '../i18n/index.tsx';
import { navigate } from '../router.tsx';
import { DEMO_PLAYERS } from '../services/demoData.ts';
import {
  ALL12_COINS, BOSS_HP, BOSS_MILESTONES, CH_COINS, FEST_EVENT, FEST_PREVIEW, HOLIDAY_BOTS, botBeaten, bossState, calendarState, challenges,
  chooseTeam, claimAll12, claimBossDown, claimBossMilestone, claimBot, claimChallenge, countdown, loadFest, openDay, saveFest, streakBonus,
  festArt, teamState, topHitters, yearReview, type FestState,
} from '../services/festival.ts';
import { NY_FRAMES } from '../services/newYear.ts';
import { everyActive, haptic } from '../services/telegram.ts';

const frameName = (id: string | undefined, lang: string) => {
  const f = NY_FRAMES.find((x) => x.id === id);
  return f ? (lang === 'en' ? f.name_en : f.name_uz) : '';
};

export function Festival() {
  const { t, num, lang } = useI18n();
  const { me, matches } = useAuth();
  const { toast } = useToast();
  const [s, setS] = useState<FestState>(() => loadFest());
  const [now, setNow] = useState(Date.now());
  const [boom, setBoom] = useState(0);
  const [review, setReview] = useState(false);
  const [opening, setOpening] = useState<number | null>(null);
  useEffect(() => everyActive(() => setNow(Date.now()), 1000), []);
  useEffect(() => {
    const on = () => setS(loadFest());
    window.addEventListener(FEST_EVENT, on);
    return () => window.removeEventListener(FEST_EVENT, on);
  }, []);
  useEffect(() => {
    if (!boom) return;
    const id = setTimeout(() => setBoom(0), 5000);
    return () => clearTimeout(id);
  }, [boom]);
  const commit = (n: FestState) => {
    setS(n);
    saveFest(n);
  };
  const got = (coins: number) => {
    haptic('capture');
    toast('success', t('fest.got', { n: coins }));
  };

  const cal = useMemo(() => calendarState(s, matches, now), [s, matches, Math.floor(now / 60_000)]);
  const boss = bossState(s, now);
  const team = teamState(s, now);
  const chs = challenges(s, cal);
  const doneCh = chs.filter((c) => c.have >= c.goal).length;
  const cd = countdown(now);
  const hitters = useMemo(() => topHitters(DEMO_PLAYERS, me ? { id: me.id, username: me.username } : null, s), [me, s]);
  const myRow = hitters.find((r) => r.me);

  const open = (d: number) => {
    const r = openDay(s, matches, d, now);
    if (!r.ok) return;
    setOpening(d);
    setTimeout(() => setOpening(null), 900);
    commit(r.s);
    got(r.coins);
    if (r.frame) toast('success', t('fest.cal.frame', { name: frameName(r.frame, lang) }));
    if (d === 31) setBoom(Date.now());
  };

  return (
    <div className="page fest">
      {boom > 0 &&
        createPortal(
        <div className="fest-fireworks" aria-hidden="true">
          <Confetti count={60} />
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="fest-fw" style={{ left: `${12 + i * 15}%`, animationDelay: `${(i % 3) * 0.45}s` }} />
          ))}
        </div>,
          document.body,
        )}

      {/* hero + countdown */}
      <section className="fest-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(20, 10, 60, 0.92) 0%, rgba(20, 10, 60, 0.55) 55%, rgba(20, 10, 60, 0.15) 100%), url("${festArt('banner')}")` }}>
        <div className="fest-hero-txt">
          <span className="fest-chip">{t('fest.day', { n: cal.today })}</span>
          <h1>❄ {t('fest.title')}</h1>
          <p>{t('fest.sub')}</p>
        </div>
        <div className="fest-cd" aria-label={t('fest.cd')}>
          {[
            [cd.d, 'fest.cd.d'],
            [cd.h, 'fest.cd.h'],
            [cd.m, 'fest.cd.m'],
            [cd.s, 'fest.cd.s'],
          ].map(([v, k]) => (
            <span key={k as string}>
              <b>{String(v).padStart(2, '0')}</b>
              <small>{t(k as TKey)}</small>
            </span>
          ))}
        </div>
        <small className="fest-cd-label">{t('fest.cd')}</small>
      </section>

      {/* 1. advent calendar */}
      <section className="card fest-card">
        <header className="fest-head">
          <h2>
            <LuGift /> {t('fest.cal.title')}
          </h2>
          {cal.streak > 0 && <span className="fest-pill">🔥 {t('fest.cal.streak', { n: cal.streak, p: Math.round(streakBonus(cal.streak) * 100) })}</span>}
        </header>
        <p className="muted small">{cal.playedToday ? t('fest.cal.hintReady') : t('fest.cal.hintPlay')}</p>
        <div className="fest-cal">
          {cal.days.map(({ d, r, st }) => (
            <button
              key={d}
              type="button"
              className={`fest-box st-${st} ${r.big ? 'is-big' : ''} ${opening === d ? 'is-opening' : ''} ${d === cal.today ? 'is-today' : ''}`}
              disabled={st !== 'ready' && st !== 'play'}
              onClick={() => (st === 'ready' ? open(d) : st === 'play' ? navigate('/play') : undefined)}
              aria-label={t('fest.cal.box', { n: d })}
            >
              <span className="fest-box-n">{d}</span>
              <img className="fest-box-img" src={festArt(st === 'opened' ? 'gift-open' : 'gift')} alt="" loading="lazy" decoding="async" />
              {st === 'locked' && <LuLock className="fest-box-lock" />}
              {st === 'opened' && <small>🪙{r.coins}</small>}
            </button>
          ))}
        </div>
      </section>

      {/* 2. the Ice Giant */}
      <section className={`card fest-card fest-boss ph-${boss.phase}`}>
        <header className="fest-head">
          <h2>
            <LuSwords /> {t('fest.boss.title')}
          </h2>
          <span className="fest-pill">{t('fest.boss.phase', { n: Math.min(4, boss.phase) })}</span>
        </header>
        <div className="fest-boss-art" aria-hidden="true">
          <img className="fest-boss-body" src={festArt(boss.down ? 'boss-down' : boss.phase >= 3 ? 'boss-cracked' : 'boss')} alt="" decoding="async" />
        </div>
        <div className="fest-hp">
          <i style={{ width: `${boss.pct * 100}%` }} />
          <b>
            {boss.down ? t('fest.boss.down') : `${num(boss.hp)} / ${num(BOSS_HP)} ❤`}
          </b>
        </div>
        <p className="muted small">{t('fest.boss.how')}</p>
        <div className="fest-row">
          <span>
            {t('fest.boss.mine')}: <b>{num(boss.mine)}</b>
          </span>
          {myRow && (
            <span>
              {t('fest.boss.place')}: <b>#{myRow.place}</b>
            </span>
          )}
        </div>
        <div className="fest-miles">
          {BOSS_MILESTONES.map((m) => {
            const done = s.got.includes(m.id);
            const can = boss.mine >= m.hits && !done;
            return (
              <button
                key={m.id}
                className={`fest-mile ${done ? 'is-done' : can ? 'is-ready' : ''}`}
                disabled={!can}
                onClick={() => {
                  const r = claimBossMilestone(s, m.id);
                  if (r.ok) (commit(r.s), got(r.coins));
                }}
              >
                <b>{m.hits}</b>
                <small>{done ? <LuCheck /> : `🪙${m.coins}`}</small>
              </button>
            );
          })}
          <button
            className={`fest-mile fest-mile-big ${s.got.includes('boss-down') ? 'is-done' : boss.down && boss.mine > 0 ? 'is-ready' : ''}`}
            disabled={!boss.down || s.got.includes('boss-down') || boss.mine < 1}
            onClick={() => {
              const r = claimBossDown(s, now);
              if (r.ok) (commit(r.s), got(r.coins), setBoom(Date.now()));
            }}
          >
            <b>💥</b>
            <small>{s.got.includes('boss-down') ? <LuCheck /> : '🪙1000'}</small>
          </button>
        </div>
        <ol className="fest-top">
          {hitters.slice(0, 5).map((r) => (
            <li key={r.id} className={r.me ? 'is-me' : ''}>
              <span>{r.place}</span>
              <b>{r.me ? t('town.you') : r.name}</b>
              <em>{num(r.hits)}</em>
            </li>
          ))}
          {myRow && myRow.place > 5 && (
            <li className="is-me">
              <span>{myRow.place}</span>
              <b>{t('town.you')}</b>
              <em>{num(myRow.hits)}</em>
            </li>
          )}
        </ol>
      </section>

      {/* 3. team race */}
      <section className="card fest-card">
        <header className="fest-head">
          <h2>⚔ {t('fest.team.title')}</h2>
        </header>
        {!s.team ? (
          <>
            <p className="muted small">{t('fest.team.pick')}</p>
            <div className="fest-teams">
              {(['santa', 'snow'] as const).map((k) => (
                <button key={k} className={`fest-team t-${k}`} onClick={() => (commit(chooseTeam(s, k)), haptic('capture'))}>
                  <span>{k === 'santa' ? '🎅' : '❄️'}</span>
                  <b>{t(`fest.team.${k}` as TKey)}</b>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="fest-race">
              <span className="t-santa" style={{ width: `${team.santaPct}%` }}>
                🎅 {team.santaPct}%
              </span>
              <span className="t-snow" style={{ width: `${100 - team.santaPct}%` }}>
                {100 - team.santaPct}% ❄️
              </span>
            </div>
            <div className="fest-row">
              <span>
                {t('fest.team.mine')}: <b>{t(`fest.team.${s.team}` as TKey)}</b>
              </span>
              <span>
                {t('fest.team.pts')}: <b>+{num(team.mine)}</b>
              </span>
            </div>
            <p className="muted small">{t(team.lead === s.team ? 'fest.team.leading' : 'fest.team.behind')}</p>
          </>
        )}
      </section>

      {/* 4. holiday bots + gift board */}
      <section className="card fest-card">
        <header className="fest-head">
          <h2>🤖 {t('fest.bots.title')}</h2>
          <span className="fest-pill">
            {HOLIDAY_BOTS.filter((b) => botBeaten(s, b.id)).length}/3
          </span>
        </header>
        <div className="fest-bots">
          {HOLIDAY_BOTS.map((b) => {
            const beaten = botBeaten(s, b.id);
            const taken = s.got.includes(`bot-${b.id}`);
            return (
              <article key={b.id} className={`fest-bot b-${b.id} ${beaten ? 'is-beaten' : ''}`}>
                <img className="fest-bot-face" src={festArt(b.art)} alt="" loading="lazy" decoding="async" />
                <b>{t(`fest.bot.${b.id}` as TKey)}</b>
                <small>
                  {t(`fest.bot.${b.id}.d` as TKey)} · {b.rating}
                </small>
                {beaten && !taken ? (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      const r = claimBot(s, b.id);
                      if (r.ok) (commit(r.s), got(r.coins));
                    }}
                  >
                    🪙 {b.coins}
                  </button>
                ) : (
                  <button className="btn btn-sm" onClick={() => navigate(`/game?mode=bot&hb=${b.id}&side=w`)}>
                    {taken ? <LuCheck /> : <LuPlay />} {t(taken ? 'fest.bots.again' : 'fest.bots.play')}
                  </button>
                )}
              </article>
            );
          })}
        </div>
        <button className="fest-gift-mode" onClick={() => navigate('/game?mode=bot&level=medium&gifts=1&side=w')}>
          <img src={festArt('gift')} alt="" loading="lazy" />
          <div>
            <b>{t('fest.giftMode')}</b>
            <small>{t('fest.giftMode.d')}</small>
          </div>
          <LuChevronRight />
        </button>
      </section>

      {/* 5. twelve challenges */}
      <section className="card fest-card">
        <header className="fest-head">
          <h2>
            <LuTrophy /> {t('fest.ch.title')}
          </h2>
          <span className="fest-pill">{doneCh}/12</span>
        </header>
        <ul className="fest-ch">
          {chs.map((c, i) => {
            const done = c.have >= c.goal;
            const taken = s.got.includes(`ch-${c.id}`);
            return (
              <li key={c.id} className={taken ? 'is-taken' : done ? 'is-done' : ''}>
                <span className="fest-ch-n">{i + 1}</span>
                <div>
                  <b>{t(`fest.ch.${c.id}` as TKey, { n: c.goal })}</b>
                  <span className="fest-bar">
                    <i style={{ width: `${(c.have / c.goal) * 100}%` }} />
                  </span>
                </div>
                <button
                  className="btn btn-sm btn-primary"
                  disabled={!done || taken}
                  onClick={() => {
                    const r = claimChallenge(s, c);
                    if (r.ok) (commit(r.s), got(r.coins));
                  }}
                >
                  {taken ? <LuCheck /> : done ? `🪙${CH_COINS}` : `${c.have}/${c.goal}`}
                </button>
              </li>
            );
          })}
        </ul>
        <button
          className={`btn btn-primary fest-all12 ${s.got.includes('all12') ? 'is-taken' : ''}`}
          disabled={doneCh < 12 || s.got.includes('all12')}
          onClick={() => {
            const r = claimAll12(s, chs);
            if (r.ok) (commit(r.s), got(r.coins), setBoom(Date.now()));
          }}
        >
          👑 {s.got.includes('all12') ? t('town.taken') : t('fest.ch.all', { n: ALL12_COINS })}
        </button>
      </section>

      {/* 6. New Year's Eve arena */}
      <section className="card fest-card fest-eve">
        <header className="fest-head">
          <h2>🎆 {t('fest.eve.title')}</h2>
        </header>
        <p>{t(cd.arena ? 'fest.eve.now' : 'fest.eve.when')}</p>
        <ul className="fest-eve-list">
          <li>🕚 {t('fest.eve.l1')}</li>
          <li>🏆 {t('fest.eve.l2')}</li>
          <li>👑 {t('fest.eve.l3')}</li>
        </ul>
        {FEST_PREVIEW && (
          <button className="btn btn-sm" onClick={() => setBoom(Date.now())}>
            <LuSparkles /> {t('fest.eve.try')}
          </button>
        )}
      </section>

      {/* 7. year review */}
      <section className="fest-wrapped" onClick={() => setReview(true)} role="button" tabIndex={0}>
        <div>
          <small>{t('fest.wr.kicker')}</small>
          <b>DAMEO 2026</b>
          <span>{t('fest.wr.cta')}</span>
        </div>
        <LuPlay />
      </section>

      {FEST_PREVIEW && <p className="muted small fest-beta">{t('fest.beta')}</p>}

      {review && createPortal(<YearReview onClose={() => setReview(false)} />, document.body)}
    </div>
  );
}

/* ------------------------------------------------------------------ "DAMEO 2026" story */
function YearReview({ onClose }: { onClose: () => void }) {
  const { t, num } = useI18n();
  const { me, matches } = useAuth();
  const { toast } = useToast();
  const y = useMemo(() => yearReview(matches, DEMO_PLAYERS, me ? { rating: me.rating, username: me.username } : null), [matches, me]);
  const slides = [
    { k: 'intro', big: '2026', line: t('fest.wr.s0', { name: y.name || 'DAMEO' }) },
    { k: 'games', big: num(y.games), line: t('fest.wr.s1', { days: y.days, h: y.hours }) },
    { k: 'wins', big: num(y.wins), line: t('fest.wr.s2', { d: y.draws, best: y.best }) },
    { k: 'rival', big: y.rival ? y.rival.name : '—', line: y.rival ? t('fest.wr.s3', { n: y.rival.n }) : t('fest.wr.s3none') },
    { k: 'fast', big: y.fastest ? `${y.fastest}` : '—', line: t('fest.wr.s4') },
    { k: 'top', big: `${y.better}%`, line: t('fest.wr.s5', { r: y.rating }) },
  ];
  const [i, setI] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    timer.current = setTimeout(() => setI((n) => (n < slides.length - 1 ? n + 1 : n)), 4200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [i, slides.length]);
  const sl = slides[i];

  const share = async () => {
    const c = document.createElement('canvas');
    c.width = 1080;
    c.height = 1350;
    const g = c.getContext('2d')!;
    const gr = g.createLinearGradient(0, 0, 0, 1350);
    gr.addColorStop(0, '#2a1d63');
    gr.addColorStop(1, '#0f0a2e');
    g.fillStyle = gr;
    g.fillRect(0, 0, 1080, 1350);
    g.fillStyle = 'rgba(255,255,255,0.7)';
    for (let k = 0; k < 120; k++) {
      g.beginPath();
      g.arc((k * 137) % 1080, (k * 251) % 1350, 1 + (k % 3), 0, Math.PI * 2);
      g.fill();
    }
    g.textAlign = 'center';
    g.fillStyle = '#c4b5fd';
    g.font = '700 46px system-ui, sans-serif';
    g.fillText('DAMEO 2026', 540, 150);
    g.fillStyle = '#fff';
    g.font = '800 64px system-ui, sans-serif';
    g.fillText(y.name || 'DAMEO', 540, 250);
    const rows: [string, string][] = [
      [t('fest.wr.c.games'), num(y.games)],
      [t('fest.wr.c.wins'), num(y.wins)],
      [t('fest.wr.c.best'), num(y.best)],
      [t('fest.wr.c.rating'), num(y.rating)],
      [t('fest.wr.c.better'), `${y.better}%`],
    ];
    rows.forEach(([k, v], n) => {
      const yy = 420 + n * 165;
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.beginPath();
      g.roundRect(120, yy - 85, 840, 135, 30);
      g.fill();
      g.textAlign = 'left';
      g.fillStyle = '#ddd6fe';
      g.font = '600 40px system-ui, sans-serif';
      g.fillText(k, 170, yy);
      g.textAlign = 'right';
      g.fillStyle = '#ffd76a';
      g.font = '800 60px system-ui, sans-serif';
      g.fillText(v, 910, yy + 8);
    });
    g.textAlign = 'center';
    g.fillStyle = '#c4b5fd';
    g.font = '600 36px system-ui, sans-serif';
    g.fillText('@Dameo_game ❄', 540, 1280);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
    if (!blob) return;
    const file = new File([blob], 'dameo-2026.png', { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
    try {
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: 'DAMEO 2026' });
        return;
      }
    } catch {
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dameo-2026.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('success', t('city.saved'));
  };

  return (
    <div className="fest-story" role="dialog" aria-modal="true">
      <div className="fest-story-bars">
        {slides.map((x, n) => (
          <i key={x.k} className={n < i ? 'is-done' : n === i ? 'is-on' : ''} />
        ))}
      </div>
      <button className="fest-story-x" onClick={onClose} aria-label={t('city.cancel')}>
        <LuX />
      </button>
      <div className={`fest-story-slide sl-${sl.k}`} key={sl.k}>
        <small>{t(`fest.wr.h${i}` as TKey)}</small>
        <b>{sl.big}</b>
        <p>{sl.line}</p>
      </div>
      <div className="fest-story-nav">
        <button onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0} aria-label={t('city.back')}>
          <LuChevronLeft />
        </button>
        {i === slides.length - 1 ? (
          <button className="btn btn-primary" onClick={share}>
            <LuShare2 /> {t('city.share')}
          </button>
        ) : (
          <span />
        )}
        <button onClick={() => setI((n) => Math.min(slides.length - 1, n + 1))} disabled={i === slides.length - 1} aria-label={t('fest.next')}>
          <LuChevronRight />
        </button>
      </div>
    </div>
  );
}
