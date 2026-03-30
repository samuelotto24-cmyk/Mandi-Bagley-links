export const config = { runtime: 'edge' };

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PASSWORD = process.env.DASHBOARD_PASSWORD || 'Password2024';
const PREFIX = process.env.REDIS_PREFIX || 'stats:';

async function redis(commands) {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  return res.json();
}

export default async function handler(req) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token !== PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build all commands in a single pipeline (data + 7-day subscriber history)
  const commands = [
    ['GET', PREFIX + 'youtube:tokens'],
    ['GET', PREFIX + 'youtube:channel'],
    ['GET', PREFIX + 'youtube:videos'],
    ['GET', PREFIX + 'youtube:analytics'],
  ];
  const historyDates = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    var dateStr = d.toISOString().split('T')[0];
    historyDates.push(dateStr);
    commands.push(['GET', PREFIX + 'youtube:subscribers:' + dateStr]);
  }

  const results = await redis(commands);

  const tokens = results[0]?.result ? JSON.parse(results[0].result) : null;
  if (!tokens) {
    return new Response(JSON.stringify({ connected: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const channel = results[1]?.result ? JSON.parse(results[1].result) : null;
  const videos = results[2]?.result ? JSON.parse(results[2].result) : [];
  const analytics = results[3]?.result ? JSON.parse(results[3].result) : null;

  const subscriberHistory = historyDates.map(function(date, idx) {
    var r = results[4 + idx];
    return {
      date: date,
      count: r?.result ? parseInt(r.result, 10) : null,
    };
  }).filter(function(h) { return h.count !== null; });

  return new Response(JSON.stringify({
    connected: true,
    channelTitle: tokens.channelTitle,
    connectedAt: tokens.connectedAt,
    channel: channel,
    videos: videos,
    analytics: analytics,
    subscriberHistory: subscriberHistory,
  }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=120' },
  });
}
