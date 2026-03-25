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
    const { type, link, referrer } = await req.json();
    const today   = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const country = req.headers.get('x-vercel-ip-country') || 'Unknown';

    const cmds = [];

    if (type === 'pageview') {
      cmds.push(['HINCRBY', 'stats:pageviews', today, '1']);
      cmds.push(['HINCRBY', 'stats:countries', country, '1']);
      const source = parseReferrer(referrer);
      if (source) cmds.push(['HINCRBY', 'stats:referrers', source, '1']);
      else        cmds.push(['HINCRBY', 'stats:referrers', 'Direct', '1']);
    } else if (type === 'click' && link) {
      cmds.push(['HINCRBY', 'stats:clicks', link, '1']);
    }

    if (cmds.length) await redis(cmds);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }
}
