export const config = { runtime: 'edge' };

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(commands) {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  return res.json();
}

function parseReferrer(ref) {
  if (!ref) return null;
  try {
    const h = new URL(ref).hostname.replace(/^www\./, '').replace(/^l\./, '');
    const map = {
      'instagram.com': 'Instagram',
      'tiktok.com': 'TikTok',
      'youtube.com': 'YouTube',
      'google.com': 'Google',
      'facebook.com': 'Facebook',
      't.co': 'Twitter/X',
      'twitter.com': 'Twitter/X',
      'pinterest.com': 'Pinterest',
      'snapchat.com': 'Snapchat',
      'linktr.ee': 'Linktree',
      'reddit.com': 'Reddit',
      'beacons.ai': 'Beacons',
    };
    return map[h] || h;
  } catch {
    return null;
  }
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const body = await req.json();
    const { type } = body;
    const now     = new Date();
    const today   = now.toISOString().split('T')[0];
    const hour    = String(now.getUTCHours()).padStart(2, '0');
    const country = req.headers.get('x-vercel-ip-country') || 'Unknown';
    const city    = req.headers.get('x-vercel-ip-city') || '';
    const region  = req.headers.get('x-vercel-ip-country-region') || '';

    const cmds = [];

    if (type === 'pageview') {
      const source = parseReferrer(body.referrer);
      cmds.push(['HINCRBY', 'stats:pageviews', today, '1']);
      cmds.push(['HINCRBY', 'stats:hourly', `${today}:${hour}`, '1']);
      cmds.push(['HINCRBY', 'stats:countries', country, '1']);
      if (city) cmds.push(['HINCRBY', 'stats:cities', region ? `${city}, ${region}` : city, '1']);
      if (source) cmds.push(['HINCRBY', 'stats:referrers', source, '1']);
      else        cmds.push(['HINCRBY', 'stats:referrers', 'Direct', '1']);
      if (body.device)   cmds.push(['HINCRBY', 'stats:devices', body.device, '1']);
      if (body.browser)  cmds.push(['HINCRBY', 'stats:browsers', body.browser, '1']);
      if (body.os)       cmds.push(['HINCRBY', 'stats:os', body.os, '1']);
      if (body.language) cmds.push(['HINCRBY', 'stats:languages', body.language.split('-')[0], '1']);
      cmds.push(['HINCRBY', 'stats:visitors', body.returning ? 'returning' : 'new', '1']);

    } else if (type === 'click' && body.link) {
      cmds.push(['HINCRBY', 'stats:clicks', body.link, '1']);
      if (body.source) {
        cmds.push(['HINCRBY', 'stats:conversions', `${body.source}\u2192${body.link}`, '1']);
      }

    } else if (type === 'scroll' && body.depth) {
      cmds.push(['HINCRBY', 'stats:scroll', String(body.depth), '1']);

    } else if (type === 'duration' && body.ms) {
      cmds.push(['HINCRBY', 'stats:duration', today, String(Math.round(body.ms))]);
      cmds.push(['HINCRBY', 'stats:duration_count', today, '1']);
    }

    if (cmds.length) await redis(cmds);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }
}
