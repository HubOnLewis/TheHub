import { HUB_LOGO_ALT, HUB_LOGO_SRC } from '../branding/logo.js';

export type BrandLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'hero';

const SIZE_CLASS: Record<BrandLogoSize, string> = {
  xs: 'brand-logo--xs',
  sm: 'brand-logo--sm',
  md: 'brand-logo--md',
  lg: 'brand-logo--lg',
  hero: 'brand-logo--hero',
};

type Props = {
  size?: BrandLogoSize;
  className?: string;
  alt?: string;
  /** Decorative watermark — no extra chrome */
  watermark?: boolean;
};

export default function BrandLogo({ size = 'md', className = '', alt = HUB_LOGO_ALT, watermark = false }: Props) {
  return (
    <img
      src={HUB_LOGO_SRC}
      alt={alt}
      className={`brand-logo ${SIZE_CLASS[size]}${watermark ? ' brand-logo--watermark' : ''}${className ? ` ${className}` : ''}`}
      width={undefined}
      height={undefined}
      decoding="async"
      draggable={false}
    />
  );
}
