import {Asset} from 'expo-asset';
import {manipulateAsync, SaveFormat} from 'expo-image-manipulator';

const LOGO = require('../../assets/icon.png');

export interface ExportReportLogoBrand {
  primary: string;
  primaryDark: string;
  surface: string;
}

export async function loadExportReportLogoDataUri(): Promise<string> {
  try {
    const asset = Asset.fromModule(LOGO);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    if (!uri) {
      return '';
    }

    const resized = await manipulateAsync(
      uri,
      [{resize: {width: 220, height: 220}}],
      {compress: 0.92, format: SaveFormat.PNG, base64: true},
    );

    if (!resized.base64) {
      return '';
    }

    return `data:image/png;base64,${resized.base64}`;
  } catch (error) {
    console.warn('[exportReportLogo] logo load failed', error);
    return '';
  }
}

export function buildExportReportCircularLogoHtml(
  appName: string,
  logoDataUri: string,
  brand: ExportReportLogoBrand,
): string {
  const safeName = appName.trim() || '?';
  const initial = safeName.charAt(0).toUpperCase();

  if (logoDataUri) {
    return `<div class="brand-logo-mark">
      <div class="brand-logo-ring">
        <img src="${logoDataUri}" alt="${safeName}" class="brand-logo-image" />
      </div>
    </div>`;
  }

  return `<div class="brand-logo-mark">
    <div class="brand-logo-ring brand-logo-ring-fallback">
      <span class="brand-logo-initial">${initial}</span>
    </div>
  </div>`;
}

export function getExportReportCircularLogoCss(brand: ExportReportLogoBrand, isRtl: boolean): string {
  const textSide = isRtl ? 'left' : 'right';

  return `
      .brand-logo-cell {
        display: table-cell;
        width: 108px;
        padding-${textSide}: 16px;
        vertical-align: middle;
      }
      .brand-logo-mark {
        width: 92px;
      }
      .brand-logo-ring {
        width: 84px;
        height: 84px;
        margin: 0 auto;
        border-radius: 50%;
        background: linear-gradient(180deg, #fff 0%, ${brand.surface} 100%);
        border: 2px solid rgba(108, 77, 255, 0.28);
        box-shadow:
          0 0 0 3px ${brand.primary},
          0 8px 18px rgba(108, 77, 255, 0.16);
        padding: 11px;
        overflow: hidden;
        box-sizing: border-box;
      }
      .brand-logo-image {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: contain;
        object-position: center;
      }
      .brand-logo-ring-fallback {
        padding: 0;
        text-align: center;
        line-height: 84px;
      }
      .brand-logo-initial {
        display: inline-block;
        font-size: 28px;
        font-weight: 800;
        color: ${brand.primaryDark};
        line-height: 1;
        vertical-align: middle;
      }`;
}
