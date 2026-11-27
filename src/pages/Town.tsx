/**
 * BETA — Winter City ("Qishki shahar"): a city builder. My City (buy → inventory → place / move / turn / store),
 * the Global City (the event square + one house per player, up to 1 000 plots), friends' cities (visit, like),
 * daily gift + tasks, weekly prettiest cities and sharing a picture. Rules: services/city/store.ts.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LuArrowLeft, LuCheck, LuFlipHorizontal2, LuGift, LuHammer, LuHeart, LuHouse, LuListChecks, LuLock, LuMaximize, LuMinus, LuMove,
  LuPackage, LuPlus, LuShare2, LuShoppingBag, LuStore, LuTrophy, LuUsers, LuX, LuEye, LuMapPin,
} from 'react-icons/lu';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Avatar } from '../components/Avatar.tsx';
import { CityCanvas, type CityCanvasHandle, type Ghost } from '../components/city/CityCanvas.tsx';
import { useToast } from '../components/Toast.tsx';
import { useI18n } from '../i18n/index.tsx';
import type { TKey } from '../i18n/uz.ts';
import { ASSET, CITY_ASSETS, CITY_CATS, inCat, type CityAsset, type CityCat } from '../services/city/assets.ts';
import {
  type Building, type CityErr, type CityState, CITY_EVENT, buy, canPlace, cityScore, cityStats, claimGift, claimTask, friendCity,
  giftOf, dayKey, globalCity, like, loadCity, move, occupancy, place, saveCity, store, suggested, taskTaken, tasksOf, topCities, visit,
} from '../services/city/store.ts';
import { MAP_H, MAP_W, SECTORS, SLOTS } from '../services/city/map.ts';
import { DEMO_FRIEND_IDS, DEMO_PLAYERS } from '../services/demoData.ts';
import { DEMO_WALLET_EVENT, demoBalance } from '../services/demoWallet.ts';
import { haptic } from '../services/telegram.ts';
import { TOWN_STAGES, communitySnow, currentStage, mySnow, participants, stageOpen } from '../services/winterTown.ts';
import { ASSET as A_ } from '../services/city/assets.ts';
import { TownInfo } from './TownInfo.tsx';

const art = (n: string) => new URL(`town/${n}.webp`, document.baseURI).href;
type Tab = 'my' | 'global' | 'friends';
type Sheet = null | 'shop' | 'inv' | 'tasks' | 'event' | 'friends';
interface Placing {
  a: CityAsset;
  slot: number;
  flip: boolean;
  moveId?: string;
  /** not owned yet: confirming buys it first */
  preview?: boolean;
}

function Swatch({ a }: { a: CityAsset }) {
  return a.sprite ? <img src={art(a.sprite)} alt="" loading="lazy" decoding="async" draggable={false} /> : null;
}

export function Town() {
  const { t, num } = useI18n();
  const { me, matches } = useAuth();
  const { toast } = useToast();
  const api = useRef<CityCanvasHandle | null>(null);

  const [s, setS] = useState<CityState>(() => loadCity());
  const [coins, setCoins] = useState(() => demoBalance());
  useEffect(() => {
    const on = () => setCoins(demoBalance());
    const onCity = () => setS(loadCity());
    window.addEventListener(DEMO_WALLET_EVENT, on);
    window.addEventListener(CITY_EVENT, onCity);
    return () => {
      window.removeEventListener(DEMO_WALLET_EVENT, on);
      window.removeEventListener(CITY_EVENT, onCity);
    };
  }, []);
  const commit = (n: CityState) => {
    setS(n);
    saveCity(n);
  };

  const [tab, setTab] = useState<Tab>('my');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [build, setBuild] = useState(false);
  const [placing, setPlacing] = useState<Placing | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [friend, setFriend] = useState<{ id: string; name: string } | null>(null);
  const [peek, setPeek] = useState<Building | null>(null);
  const [cat, setCat] = useState<CityCat>('houses');
  const [z, setZ] = useState(1);
  const buying = useRef(false);

  // community event numbers
  const mine = useMemo(() => mySnow(matches), [matches]);
  const total = communitySnow(mine);
  const people = participants(total);
  const open = TOWN_STAGES.filter((st) => stageOpen(st, total)).map((st) => st.n);
  const next = currentStage(total);

  // what the map shows
  const names = useMemo(() => DEMO_PLAYERS.map((p) => p.username), []);
  const globalB = useMemo(() => globalCity(people, names), [people, names]);
  const friendB = useMemo(() => (friend ? friendCity(friend.id) : []), [friend]);
  const shown: Building[] = friend ? friendB : tab === 'global' ? globalB : s.b;
  const editable = !friend && tab === 'my';
  const occ = useMemo(() => occupancy(s.b), [s.b]);
  const stats = cityStats(s);
  const tasks = tasksOf(s, matches);
  const readyTasks = tasks.filter((x) => x.have >= x.goal && !taskTaken(s, x)).length + (s.gift !== dayKey() ? 1 : 0);

  // camera start per view (map px; z: 1 = the map fills the screen)
  const start = useMemo(() => {
    const at = (b?: Building) => (b && SLOTS[b.slot] ? { x: SLOTS[b.slot][0], y: SLOTS[b.slot][1] - 20, z: 2.4 } : null);
    if (friend) return at(friendB[0]) ?? { x: MAP_W / 2, y: MAP_H / 2, z: 1 };
    if (tab === 'global') return { x: MAP_W / 2, y: MAP_H / 2, z: 1 };
    return at(s.b[s.b.length - 1]) ?? { x: MAP_W / 2, y: MAP_H * 0.62, z: 1.3 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, friend]);

  /* ------------------------------------------------------------ placement */
  const ignoreIdx = placing?.moveId ? s.b.findIndex((b) => b.id === placing.moveId) + 1 : 0;
  const ghost: Ghost | null = placing ? { a: placing.a, slot: placing.slot, flip: placing.flip, ok: canPlace(placing.a, placing.slot, occ, ignoreIdx).ok } : null;
  const spots = useMemo(() => {
    if (!editable) return null;
    if (placing) return suggested(placing.a, occ, ignoreIdx);
    return build ? suggested(A_.house1, occ) : null;
  }, [editable, placing?.a, ignoreIdx, occ, build]);
  const startPlacing = (a: CityAsset, opts: { moveId?: string; preview?: boolean; flip?: boolean; slot?: number } = {}) => {
    setSheet(null);
    setPeek(null);
    setTab('my');
    setFriend(null);
    setBuild(true);
    const o = occupancy(s.b);
    const ign = opts.moveId ? s.b.findIndex((b) => b.id === opts.moveId) + 1 : 0;
    let slot = opts.slot ?? api.current?.centerSlot((i) => canPlace(a, i, o, ign).ok) ?? -1;
    if (slot < 0) slot = suggested(a, o, ign)[0] ?? 0;
    if (opts.slot == null) api.current?.flyTo(SLOTS[slot][0], SLOTS[slot][1] - 15, 3);
    setPlacing({ a, slot, flip: !!opts.flip, moveId: opts.moveId, preview: opts.preview });
    setSel(null);
  };
  const errText = (e: CityErr) => t(`city.err.${e}` as TKey);
  const confirm = () => {
    if (!placing || !ghost) return;
    if (!ghost.ok) {
      haptic('error');
      return toast('error', t('city.err.busy'));
    }
    let cur = s;
    if (placing.moveId) {
      const r = move(cur, placing.moveId, placing.slot, placing.flip);
      if (!r.ok) return toast('error', errText(r.error));
      commit(r.s);
      setDropId(null);
      setPlacing(null);
      haptic('move');
      return toast('success', t('city.moved'));
    }
    if (placing.preview || (cur.inv[placing.a.id] ?? 0) < 1) {
      if (buying.current) return;
      buying.current = true;
      const r = buy(cur, placing.a.id, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      buying.current = false;
      if (!r.ok) {
        haptic('error');
        return toast('error', errText(r.error));
      }
      cur = r.s;
    }
    const r = place(cur, placing.a.id, placing.slot, placing.flip);
    if (!r.ok) {
      commit(cur);
      return toast('error', errText(r.error));
    }
    commit(r.s);
    setDropId(r.b.id);
    haptic('capture');
    toast('success', t('city.built', { xp: placing.a.xp }));
    // more of the same in the bag → keep building (roads, fences, trees …)
    const nextFree = suggested(placing.a, occupancy(r.s.b));
    if ((r.s.inv[placing.a.id] ?? 0) > 0 && placing.a.w * placing.a.h <= 2 && nextFree.length) {
      const [x0, y0] = SLOTS[placing.slot];
      const n = nextFree.reduce((b, i) => ((SLOTS[i][0] - x0) ** 2 + (SLOTS[i][1] - y0) ** 2 < (SLOTS[b][0] - x0) ** 2 + (SLOTS[b][1] - y0) ** 2 ? i : b), nextFree[0]);
      setPlacing({ ...placing, preview: false, slot: n });
    } else setPlacing(null);
  };

  /* ------------------------------------------------------------ map taps */
  const onTap = (b: Building | null, slot: number) => {
    if (placing) {
      if (slot >= 0) setPlacing({ ...placing, slot });
      return;
    }
    if (editable && build) {
      setSel(b && s.b.some((o) => o.id === b.id) ? b.id : null);
      return;
    }
    setPeek(b);
  };
  const selB = sel ? s.b.find((b) => b.id === sel) : null;

  /* ------------------------------------------------------------ shop / inventory */
  const buyOne = (a: CityAsset) => {
    if (buying.current) return;
    buying.current = true;
    const r = buy(s, a.id, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    buying.current = false;
    if (!r.ok) {
      haptic('error');
      return toast('error', errText(r.error));
    }
    commit(r.s);
    haptic('move');
    toast('success', t('city.bought', { name: t(`city.a.${a.id}` as TKey) }));
  };
  const invList = CITY_ASSETS.filter((a) => (s.inv[a.id] ?? 0) > 0);

  /* ------------------------------------------------------------ friends */
  const friends = useMemo(() => DEMO_PLAYERS.filter((p) => DEMO_FRIEND_IDS.includes(p.id)), []);
  const top = useMemo(() => topCities(DEMO_PLAYERS, me ? { id: me.id, username: me.username } : null, s).slice(0, 10), [me, s]);
  const openFriend = (id: string, name: string) => {
    if (me && id === me.id) {
      setFriend(null);
      setTab('my');
      setSheet(null);
      return;
    }
    setFriend({ id, name });
    setSheet(null);
    setPeek(null);
    setPlacing(null);
    setBuild(false);
    commit(visit(s, id));
  };
  const liked = friend ? s.likes.includes(friend.id) : false;

  /* ------------------------------------------------------------ share */
  const share = async () => {
    const blob = await api.current?.snapshot();
    if (!blob) return;
    const file = new File([blob], 'dameo-shahar.jpg', { type: 'image/jpeg' });
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
    try {
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: 'DAMEO', text: t('city.shareText') });
        return;
      }
    } catch {
      /* cancelled */
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dameo-shahar.jpg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('success', t('city.saved'));
  };

  const switchTab = (n: Tab) => {
    setTab(n);
    setFriend(null);
    setPlacing(null);
    setSel(null);
    setPeek(null);
    setBuild(false);
    if (n === 'friends') setSheet('friends');
    else setSheet(null);
  };
  const viewTitle = friend ? t('city.friendCity', { name: friend.name }) : tab === 'global' ? t('city.global') : t('city.mine');
  const nm = (a: CityAsset) => t(`city.a.${a.id}` as TKey);

  return (
    <div className="page city-page">
      <div className="city-tabs" role="tablist">
        {(['my', 'global', 'friends'] as Tab[]).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k && (k !== 'friends' || !!friend || sheet === 'friends')} className={tab === k ? 'is-on' : ''} onClick={() => switchTab(k)}>
            {k === 'my' ? <LuHouse /> : k === 'global' ? <LuMapPin /> : <LuUsers />} {t(`city.tab.${k}` as TKey)}
          </button>
        ))}
      </div>

      {tab === 'global' && !friend ? (
        <div className="city-strip">
          <span>
            ❄ <b>{num(total)}</b>
          </span>
          <span>
            <LuUsers /> <b>{num(people)}</b>
          </span>
          <span>
            <LuHouse /> <b>{num(Math.min(people, SLOTS.length))}</b>/{num(SLOTS.length)}
          </span>
          <span className="city-strip-stage">{next ? `${next.icon} ${t(`town.stage.${next.key}` as TKey)}` : `🎆 ${t('city.allOpen')}`}</span>
        </div>
      ) : (
        <div className="city-strip">
          <span className="city-lv">
            <b>{t('city.lv', { n: stats.lv })}</b>
            <i style={{ width: `${Math.round(((stats.xp - stats.from) / Math.max(1, stats.to - stats.from)) * 100)}%` }} />
          </span>
          <span>
            <LuHouse /> <b>{num(stats.houses)}</b>
          </span>
          <span>
            🪙 <b>{num(coins)}</b>
          </span>
          <span>
            ❄ <b>{num(mine)}</b>
          </span>
        </div>
      )}

      <div className="city-sectors" role="list" aria-label={t('city.sectors')}>
        <button onClick={() => api.current?.overview()}>
          <LuMaximize /> {t('city.z.city')}
        </button>
        {SECTORS.map((sc) => (
          <button key={sc.id} onClick={() => api.current?.flyTo(sc.x, sc.y - 10, 2.6)}>
            {sc.id + 1}. {sc.name}
          </button>
        ))}
      </div>

      <div className={`city-stage ${placing ? 'is-placing' : ''}`}>
        <CityCanvas
          api={api}
          buildings={shown}
          ghost={ghost}
          spots={spots}
          selected={editable ? sel : null}
          dropId={editable ? dropId : null}
          fireworks={tab === 'global' && !friend && open.includes(5)}
          start={start}
          onGhostMove={(slot) => placing && setPlacing({ ...placing, slot })}
          onTapBuilding={onTap}
          onZoom={setZ}
        />
        <div className="city-title">
          {friend && (
            <button className="icon-btn city-back" onClick={() => switchTab('friends')} aria-label={t('city.back')}>
              <LuArrowLeft />
            </button>
          )}
          <b>{viewTitle}</b>
          {!friend && tab === 'my' && <small>{t('city.cityValue', { n: num(stats.value) })}</small>}
        </div>
        <div className="city-zoom">
          <button onClick={() => api.current?.zoom(1.6)} aria-label={t('city.zoomIn')}>
            <LuPlus />
          </button>
          <button onClick={() => api.current?.zoom(1 / 1.6)} aria-label={t('city.zoomOut')}>
            <LuMinus />
          </button>
          <button onClick={() => api.current?.overview()} aria-label={t('city.overview')}>
            <LuMaximize />
          </button>
          <span className="city-zlv">{z < 1.4 ? t('city.z.city') : z < 2.4 ? t('city.z.district') : z < 3.8 ? t('city.z.street') : t('city.z.house')}</span>
        </div>

        {placing && ghost && (
          <div className="city-place">
            <div className={`city-place-status ${ghost.ok ? 'ok' : 'bad'}`}>
              {ghost.ok ? <LuCheck /> : <LuX />} {nm(placing.a)} · {ghost.ok ? t('city.canPlace') : t('city.cantPlace')}
              {placing.preview && <em> · 🪙 {num(placing.a.price)}</em>}
            </div>
            <div className="city-place-row">
              <button className="btn btn-sm" onClick={() => setPlacing(null)}>
                <LuX /> {t('city.cancel')}
              </button>
              <button className="btn btn-sm" onClick={() => setPlacing({ ...placing, flip: !placing.flip })}>
                <LuFlipHorizontal2 /> {t('city.turn')}
              </button>
              <button className="btn btn-sm btn-primary" disabled={!ghost.ok} onClick={confirm}>
                <LuCheck /> {placing.preview ? t('city.buyPlace') : t('city.confirm')}
              </button>
            </div>
            <small className="city-place-hint">{t('city.dragHint')}</small>
          </div>
        )}

        {!placing && selB && editable && (
          <div className="city-selbar">
            <b>{nm(ASSET[selB.a])}</b>
            <div className="city-place-row">
              <button className="btn btn-sm" onClick={() => startPlacing(ASSET[selB.a], { moveId: selB.id, flip: !!selB.f, slot: selB.slot })}>
                <LuMove /> {t('city.move')}
              </button>
              <button
                className="btn btn-sm"
                onClick={() => {
                  const r = move(s, selB.id, selB.slot, !selB.f);
                  if (r.ok) commit(r.s);
                }}
              >
                <LuFlipHorizontal2 /> {t('city.turn')}
              </button>
              <button
                className="btn btn-sm"
                onClick={() => {
                  commit(store(s, selB.id));
                  setSel(null);
                  toast('success', t('city.stored'));
                }}
              >
                <LuPackage /> {t('city.toInv')}
              </button>
              <button className="btn btn-sm" onClick={() => setSel(null)} aria-label={t('city.cancel')}>
                <LuX />
              </button>
            </div>
          </div>
        )}

        {!placing && peek && (
          <div className="city-selbar">
            <b>
              {nm(ASSET[peek.a])}
              {peek.o ? ` · ${peek.o}` : ''}
            </b>
            <div className="city-place-row">
              {peek.o && (
                <button className="btn btn-sm btn-primary" onClick={() => openFriend(`npc:${peek.o}`, peek.o!)}>
                  <LuEye /> {t('city.visitCity')}
                </button>
              )}
              <button className="btn btn-sm" onClick={() => setPeek(null)} aria-label={t('city.cancel')}>
                <LuX />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* action bar */}
      <div className="city-actions">
        {friend ? (
          <>
            <button className={`city-act ${liked ? 'is-on' : ''}`} onClick={() => (liked ? null : (commit(like(s, friend.id)), haptic('move')))}>
              <LuHeart /> <span>{num(cityScore(friend.id).likes + (liked ? 1 : 0))}</span>
            </button>
            <button className="city-act" onClick={share}>
              <LuShare2 /> <span>{t('city.share')}</span>
            </button>
            <button className="city-act" onClick={() => switchTab('my')}>
              <LuHouse /> <span>{t('city.tab.my')}</span>
            </button>
          </>
        ) : tab === 'global' ? (
          <>
            <button className="city-act" onClick={() => setSheet('event')}>
              <LuTrophy /> <span>{t('city.event')}</span>
            </button>
            <button className="city-act" onClick={share}>
              <LuShare2 /> <span>{t('city.share')}</span>
            </button>
            <button className="city-act" onClick={() => switchTab('my')}>
              <LuHammer /> <span>{t('city.buildMine')}</span>
            </button>
          </>
        ) : (
          <>
            <button className="city-act" onClick={() => setSheet('shop')}>
              <LuShoppingBag /> <span>{t('city.shop')}</span>
            </button>
            <button className="city-act" onClick={() => setSheet('inv')}>
              <LuPackage /> <span>{t('city.inv')}</span>
              {invList.length > 0 && <em className="city-dot">{invList.reduce((n, a) => n + s.inv[a.id], 0)}</em>}
            </button>
            <button
              className={`city-act city-act-main ${build ? 'is-on' : ''}`}
              onClick={() => {
                setBuild((v) => !v);
                setSel(null);
                setPlacing(null);
              }}
            >
              <LuHammer /> <span>{t(build ? 'city.done' : 'city.build')}</span>
            </button>
            <button className="city-act" onClick={() => setSheet('tasks')}>
              <LuListChecks /> <span>{t('city.tasks')}</span>
              {readyTasks > 0 && <em className="city-dot">{readyTasks}</em>}
            </button>
            <button className="city-act" onClick={share}>
              <LuShare2 /> <span>{t('city.share')}</span>
            </button>
          </>
        )}
      </div>

      {sheet && (
        <div className="city-sheet-wrap" onClick={() => setSheet(null)}>
          <section className="city-sheet" onClick={(e: { stopPropagation(): void }) => e.stopPropagation()} role="dialog" aria-modal="true">
            <header className="city-sheet-head">
              <b>
                {sheet === 'shop' && (
                  <>
                    <LuStore /> {t('city.shopTitle')}
                  </>
                )}
                {sheet === 'inv' && (
                  <>
                    <LuPackage /> {t('city.inv')}
                  </>
                )}
                {sheet === 'tasks' && (
                  <>
                    <LuListChecks /> {t('city.tasks')}
                  </>
                )}
                {sheet === 'event' && (
                  <>
                    <LuTrophy /> {t('city.event')}
                  </>
                )}
                {sheet === 'friends' && (
                  <>
                    <LuUsers /> {t('city.tab.friends')}
                  </>
                )}
              </b>
              {sheet === 'shop' && <span className="city-coins">🪙 {num(coins)}</span>}
              <button className="icon-btn" onClick={() => setSheet(null)} aria-label={t('city.cancel')}>
                <LuX />
              </button>
            </header>

            {sheet === 'shop' && (
              <>
                <div className="city-cats">
                  {CITY_CATS.map((c) => (
                    <button key={c} className={cat === c ? 'is-on' : ''} onClick={() => setCat(c)}>
                      {t(`city.cat.${c}` as TKey)}
                    </button>
                  ))}
                </div>
                <div className="city-shop">
                  {CITY_ASSETS.filter((a) => inCat(a, cat)).map((a) => (
                    <article key={a.id} className={`city-card rar-${a.rarity}`}>
                      <div className="city-card-art">
                        <Swatch a={a} />
                        {a.limited && <span className="city-tag">{t('city.limited')}</span>}
                        {(s.inv[a.id] ?? 0) > 0 && <span className="city-own">×{s.inv[a.id]}</span>}
                      </div>
                      <b className="city-card-name">{nm(a)}</b>
                      <small className="city-card-meta">
                        <span className={`city-rar rar-${a.rarity}`}>{t(`city.rar.${a.rarity}` as TKey)}</span> · {a.w}×{a.h}
                      </small>
                      <div className="city-card-buy">
                        <button className="btn btn-sm city-pv" onClick={() => startPlacing(a, { preview: true })} aria-label={t('city.preview')}>
                          <LuEye />
                        </button>
                        <button className="btn btn-sm btn-primary" disabled={coins < a.price} onClick={() => buyOne(a)}>
                          🪙 {num(a.price)}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                <p className="muted small">{t('city.shopHint')}</p>
              </>
            )}

            {sheet === 'inv' && (
              <>
                {invList.length === 0 ? (
                  <div className="city-empty">
                    <LuPackage />
                    <p>{t('city.invEmpty')}</p>
                    <button className="btn btn-primary btn-sm" onClick={() => setSheet('shop')}>
                      <LuShoppingBag /> {t('city.shop')}
                    </button>
                  </div>
                ) : (
                  <div className="city-shop">
                    {invList.map((a) => (
                      <article key={a.id} className={`city-card rar-${a.rarity}`}>
                        <div className="city-card-art">
                          <Swatch a={a} />
                          <span className="city-own">×{s.inv[a.id]}</span>
                        </div>
                        <b className="city-card-name">{nm(a)}</b>
                        <button className="btn btn-sm btn-primary" onClick={() => startPlacing(a)}>
                          <LuHammer /> {t('city.place')}
                        </button>
                      </article>
                    ))}
                  </div>
                )}
                <div className="city-statgrid">
                  <span>
                    <small>{t('city.st.houses')}</small>
                    <b>{num(stats.houses)}</b>
                  </span>
                  <span>
                    <small>{t('city.st.objects')}</small>
                    <b>{num(stats.objects)}</b>
                  </span>
                  <span>
                    <small>{t('city.st.area')}</small>
                    <b>{num(stats.area)}</b>
                  </span>
                  <span>
                    <small>{t('city.st.value')}</small>
                    <b>🪙 {num(stats.value)}</b>
                  </span>
                  <span>
                    <small>{t('city.st.bought')}</small>
                    <b>{num(stats.bought)}</b>
                  </span>
                  <span>
                    <small>{t('city.st.today')}</small>
                    <b>+{num(stats.today)}</b>
                  </span>
                </div>
              </>
            )}

            {sheet === 'tasks' && (
              <>
                <div className={`city-gift ${s.gift === dayKey() ? 'is-taken' : ''}`}>
                  <LuGift />
                  <div>
                    <b>{t('city.gift')}</b>
                    <small>
                      {(() => {
                        const g = giftOf(dayKey());
                        return 'coins' in g ? `🪙 ${g.coins}` : `${t(`city.a.${g.item}` as TKey)} ×${g.n}`;
                      })()}
                    </small>
                  </div>
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={s.gift === dayKey()}
                    onClick={() => {
                      const r = claimGift(s);
                      if (r.ok) {
                        commit(r.s);
                        haptic('capture');
                        toast('success', t('city.giftGot'));
                      }
                    }}
                  >
                    {s.gift === dayKey() ? t('town.taken') : t('town.take')}
                  </button>
                </div>
                {(['day', 'week'] as const).map((k) => (
                  <div key={k} className="city-tasks">
                    <h3>{t(k === 'day' ? 'city.daily' : 'city.weekly')}</h3>
                    {tasks
                      .filter((x) => (k === 'week') === !!x.week)
                      .map((x) => {
                        const got = taskTaken(s, x);
                        const done = x.have >= x.goal;
                        return (
                          <div key={x.id} className={`city-task ${got ? 'is-taken' : ''}`}>
                            <div className="city-task-main">
                              <b>{t(`city.task.${x.id}` as TKey, { n: x.goal })}</b>
                              <span className="city-bar">
                                <i style={{ width: `${(x.have / x.goal) * 100}%` }} />
                              </span>
                              <small>
                                {x.have}/{x.goal} · 🪙 {x.coins} · +{x.xp} XP
                              </small>
                            </div>
                            <button
                              className="btn btn-sm btn-primary"
                              disabled={!done || got}
                              onClick={() => {
                                const r = claimTask(s, x);
                                if (r.ok) {
                                  commit(r.s);
                                  haptic('capture');
                                  toast('success', t('town.got', { n: x.coins }));
                                }
                              }}
                            >
                              {got ? <LuCheck /> : done ? t('town.take') : <LuLock />}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                ))}
                <p className="muted small">{t('city.tasksHint')}</p>
              </>
            )}

            {sheet === 'event' && <TownInfo />}

            {sheet === 'friends' && (
              <>
                <h3 className="city-h3">{t('city.friends')}</h3>
                <ul className="city-people">
                  {friends.map((p) => (
                    <li key={p.id}>
                      <Avatar name={p.username} seed={p.avatar} size={36} frame={null} />
                      <span className="city-people-name">
                        <b>{p.username}</b>
                        <small>
                          <LuHeart /> {num(cityScore(p.id).likes + (s.likes.includes(p.id) ? 1 : 0))}
                        </small>
                      </span>
                      <button className="btn btn-sm btn-primary" onClick={() => openFriend(p.id, p.username)}>
                        <LuEye /> {t('city.visit')}
                      </button>
                    </li>
                  ))}
                </ul>
                <h3 className="city-h3">
                  <LuTrophy /> {t('city.topWeek')}
                </h3>
                <ol className="city-people city-top">
                  {top.map((r) => (
                    <li key={r.id} className={r.me ? 'is-me' : ''}>
                      <span className={`town-place town-place-${r.place}`}>{r.place}</span>
                      <span className="city-people-name">
                        <b>{r.me ? t('town.you') : r.name}</b>
                        <small>
                          <LuHeart /> {num(r.likes)} · 🪙 {num(r.value)}
                        </small>
                      </span>
                      <button className="btn btn-sm" onClick={() => (r.me ? switchTab('my') : openFriend(r.id, r.name))}>
                        <LuEye />
                      </button>
                    </li>
                  ))}
                </ol>
                <p className="muted small">{t('city.topHint')}</p>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
