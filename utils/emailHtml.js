/**
 * Renderizado HTML de plantillas de email (layouts basic / with-image / colorful / minimal).
 *
 * Si se pasa `campaignId`:
 *  - se inserta un pixel de apertura (open rate)
 *  - todos los <a href="http..."> del cuerpo se reescriben para pasar por el
 *    endpoint de tracking de clicks (CTR) y luego redirigir al destino original.
 */
export function buildEmailHtml(template, campaignId) {
  // API_URL es el host sin /api (ej. https://app.petnder.com); headerImage ya viene como /api/uploads/...
  const host = (process.env.API_URL || 'https://app.petnder.com').replace(/\/$/, '');
  const apiBase = `${host}/api`;
  const trackPixel = campaignId
    ? `<img src="${apiBase}/marketing/email/track/${campaignId}/open" width="1" height="1" style="display:none" />`
    : '';
  const color = template.headerColor || '#FF6B6B';
  const headerImg = template.headerImage
    ? `<img src="${host}${template.headerImage}" style="width:100%;max-height:200px;object-fit:cover" />`
    : '';
  const body = campaignId
    ? rewriteLinks(template.bodyHtml || '', `${apiBase}/marketing/email/track/${campaignId}/click`)
    : (template.bodyHtml || '');

  const layouts = {
    basic: `
      <table style="max-width:600px;margin:0 auto;background:#fff;font-family:Arial,sans-serif" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="background:${color};padding:30px 20px;text-align:center;color:#fff"><h1 style="margin:0;font-size:22px">${template.subject}</h1></td></tr>
        ${headerImg ? `<tr><td>${headerImg}</td></tr>` : ''}
        <tr><td style="padding:30px 20px;font-size:15px;color:#333;line-height:1.6">${body}</td></tr>
        <tr><td style="background:#f5f5f5;padding:20px;text-align:center;font-size:12px;color:#999">${template.footerText}${trackPixel}</td></tr>
      </table>`,
    'with-image': `
      <table style="max-width:600px;margin:0 auto;background:#fff;font-family:Arial,sans-serif" width="100%" cellpadding="0" cellspacing="0">
        ${headerImg ? `<tr><td>${headerImg}</td></tr>` : ''}
        <tr><td style="padding:25px 20px"><h1 style="margin:0 0 15px;font-size:22px;color:${color}">${template.subject}</h1><div style="font-size:15px;color:#333;line-height:1.6">${body}</div></td></tr>
        <tr><td style="background:${color};padding:20px;text-align:center;font-size:12px;color:#fff">${template.footerText}${trackPixel}</td></tr>
      </table>`,
    colorful: `
      <table style="max-width:600px;margin:0 auto;background:linear-gradient(135deg,${color},#FF8E72);font-family:Arial,sans-serif" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:40px 30px;text-align:center;color:#fff"><h1 style="margin:0 0 20px;font-size:26px">${template.subject}</h1>${headerImg ? headerImg : ''}</td></tr>
        <tr><td style="background:#fff;padding:30px;margin:0 20px;border-radius:12px"><div style="font-size:15px;color:#333;line-height:1.6">${body}</div></td></tr>
        <tr><td style="padding:20px;text-align:center;font-size:12px;color:rgba(255,255,255,0.8)">${template.footerText}${trackPixel}</td></tr>
      </table>`,
    minimal: `
      <table style="max-width:600px;margin:0 auto;background:#fff;font-family:Arial,sans-serif" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:40px 30px;border-bottom:3px solid ${color}"><h1 style="margin:0;font-size:20px;color:#111">${template.subject}</h1></td></tr>
        <tr><td style="padding:30px;font-size:15px;color:#444;line-height:1.7">${body}</td></tr>
        <tr><td style="padding:20px 30px;font-size:11px;color:#aaa;border-top:1px solid #eee">${template.footerText}${trackPixel}</td></tr>
      </table>`,
  };

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:20px 0;background:#f4f4f4">${layouts[template.layout] || layouts.basic}</body></html>`;
}

/**
 * Reescribe href="http(s)://..." → href="<trackUrl>?url=<encoded>".
 * Ignora mailto:, tel:, anclas y links ya trackeados.
 */
export function rewriteLinks(html, trackUrl) {
  return html.replace(/href\s*=\s*(["'])(https?:\/\/[^"']+)\1/gi, (match, quote, url) => {
    if (url.startsWith(trackUrl)) return match;
    return `href=${quote}${trackUrl}?url=${encodeURIComponent(url)}${quote}`;
  });
}

/** Solo se permite redirigir a URLs http/https absolutas (evita open redirect a esquemas raros). */
export function safeRedirectUrl(raw, fallback = 'https://petnder.com') {
  try {
    const url = new URL(String(raw || ''));
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString();
  } catch { /* inválida */ }
  return fallback;
}
