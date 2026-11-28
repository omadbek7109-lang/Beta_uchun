import type { MouseEvent } from 'react';
import { LuArrowRight, LuHourglass } from 'react-icons/lu';
import { useI18n } from '../i18n/index.tsx';
import { navigate } from '../router.tsx';
import { seasonAt } from '../services/pass/core.ts';

const FRAME = new URL('pass/frame-prem-crownwings.webp', document.baseURI).href;
const HALL = new URL('pass/hall-throne.webp', document.baseURI).href;

/** DAMEO Pass ad for the Arena carousel: the season, its name and the days left; a tap opens the Pass. */
export function PassBanner() {
  const { t, lang } = useI18n();
  const s = seasonAt(Date.now());
  const left = Math.max(0, Math.ceil((s.end - Date.now()) / 86_400_000));
  const open = (e: MouseEvent) => {
    e.preventDefault();
    navigate('/pass');
  };
  return (
    <a
      className="pass-banner"
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && open(e as unknown as MouseEvent)}
      aria-label={t('passAd.aria')}
      style={{ ['--pass-hall' as string]: `url("${HALL}")` }}
    >
      <span className="pass-ad-art" aria-hidden="true">
        <span className="pass-ad-hall" />
        <img src={FRAME} alt="" width={320} height={320} decoding="async" />
        <b className="pass-ad-d">D</b>
      </span>
      <span className="pass-ad-copy">
        <span className="pass-ad-kicker">
          DAMEO PASS · {t('pass.season', { n: s.n })}
        </span>
        <span className="pass-ad-title">{lang === 'en' ? s.theme.name_en : s.theme.name_uz}</span>
        <span className="pass-ad-sub">{t('passAd.sub')}</span>
        <span className="pass-ad-foot">
          <span className="pass-ad-left">
            <LuHourglass /> {t('passAd.left', { n: left })}
          </span>
          <span className="flect-go pass-ad-go" aria-hidden="true">
            <LuArrowRight />
          </span>
        </span>
      </span>
    </a>
  );
}
