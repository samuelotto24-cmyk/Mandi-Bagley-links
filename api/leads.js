export const config = { runtime: 'edge' };

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PASSWORD    = process.env.DASHBOARD_PASSWORD || 'Password2024';
const PREFIX      = process.env.REDIS_PREFIX || 'stats:';

async function redisPipeline(commands) {
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

function parseHashStrings(item) {
  if (!item || !item.result) return {};
  const obj = {};
  for (let i = 0; i < item.result.length; i += 2) {
    obj[item.result[i]] = item.result[i + 1];
  }
  return obj;
}

function parseHashNumbers(item) {
  if (!item || !item.result) return {};
  const obj = {};
  for (let i = 0; i < item.result.length; i += 2) {
    obj[item.result[i]] = parseInt(item.result[i + 1], 10) || 0;
  }
  return obj;
}

function authorize(req) {
  const url = new URL(req.url);
  const queryAuth = url.searchParams.get('_auth');
  if (queryAuth === PASSWORD) return true;
  const header = req.headers.get('Authorization') || '';
  if (header === `Bearer ${PASSWORD}`) return true;
  return false;
}

export default async function handler(req) {
  if (!authorize(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const isCSV = url.searchParams.get('export') === 'csv';

  try {
    // Step 1: Load automations list
    const [autoResult] = await redisPipeline([['GET', `${PREFIX}automations`]]);
    const automations = autoResult && autoResult.result
      ? JSON.parse(autoResult.result)
      : [];

    // Step 2: Build pipeline for leads + funnel stats (+ emails if CSV)
    const commands = [['LRANGE', `${PREFIX}leads`, '0', '99']];
    for (const auto of automations) {
      commands.push(['HGETALL', `${PREFIX}funnel:${auto.keyword}`]);
    }
    if (isCSV) {
      for (const auto of automations) {
        commands.push(['HGETALL', `${PREFIX}emails:${auto.slug}`]);
      }
    }

    const results = await redisPipeline(commands);

    // Parse recent leads
    const leadsResult = results[0];
    const recentLeads = (leadsResult && leadsResult.result || []).map((entry) => {
      try { return JSON.parse(entry); } catch { return entry; }
    });

    // Parse funnel stats per automation
    const funnels = {};
    for (let i = 0; i < automations.length; i++) {
      const stats = parseHashNumbers(results[1 + i]);
      funnels[automations[i].keyword] = {
        comments: stats.comments || 0,
        dms:      stats.dms || 0,
        clicks:   stats.clicks || 0,
        captured: stats.captured || 0,
      };
    }

    const totalEmails = Object.values(funnels).reduce(
      (sum, f) => sum + f.captured, 0
    );

    // CSV export
    if (isCSV) {
      const rows = ['email,keyword,slug,captured_at'];
      for (let i = 0; i < automations.length; i++) {
        const emailsHash = parseHashStrings(results[1 + automations.length + i]);
        const { keyword, slug } = automations[i];
        for (const [email, meta] of Object.entries(emailsHash)) {
          let capturedAt = '';
          try {
            const parsed = JSON.parse(meta);
            capturedAt = parsed.captured_at || parsed.date || '';
          } catch {
            capturedAt = meta;
          }
          rows.push(`${email},${keyword},${slug},${capturedAt}`);
        }
      }

      return new Response(rows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="leads.csv"',
        },
      });
    }

    // JSON response
    return new Response(JSON.stringify({
      recentLeads,
      funnels,
      totalEmails,
      automationCount: automations.length,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to load lead data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
