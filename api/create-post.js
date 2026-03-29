export const config = { runtime: 'edge' };

const CLIENT_NAME = 'Mandi Bagley';
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PASSWORD    = process.env.DASHBOARD_PASSWORD || 'Password2024';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.AI_KEY;
const CLIENT_NICHE = process.env.CLIENT_NICHE || 'Fitness · Faith · Food';
const CLIENT_DESCRIPTION = process.env.CLIENT_DESCRIPTION || 'Lifestyle fitness creator, recipe content, brand partnerships';

async function redis(commands) {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  return res.json();
}

function parseHash(item) {
  if (!item || !item.result) return {};
  const obj = {};
  for (let i = 0; i < item.result.length; i += 2) {
    obj[item.result[i]] = parseInt(item.result[i + 1], 10);
  }
  return obj;
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  if (url.searchParams.get('password') !== PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { image, platform = 'instagram', notes = '' } = body;

    if (!image) {
      return new Response(JSON.stringify({ error: 'No image provided' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse base64 image
    let mediaType = 'image/jpeg';
    let base64Data = image;
    if (image.startsWith('data:')) {
      const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) {
        return new Response(JSON.stringify({ error: 'Invalid image format' }), {
          status: 400, headers: { 'Content-Type': 'application/json' },
        });
      }
      mediaType = match[1];
      base64Data = match[2];
    }

    // Size check (~4MB base64 ≈ 3MB image)
    if (base64Data.length > 5500000) {
      return new Response(JSON.stringify({ error: 'Image too large. Max 4MB.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch voice training data + peak hours from Redis
    const PREFIX = process.env.REDIS_PREFIX || 'stats:';
    const results = await redis([
      ['GET', PREFIX + 'tiktok:cache'],
      ['GET', PREFIX + 'youtube:videos'],
      ['HGETALL', PREFIX + 'hourly'],
    ]);

    // Assemble voice examples
    const voiceParts = [];

    // TikTok titles
    const tiktokCache = results[0]?.result;
    if (tiktokCache) {
      try {
        const ttData = JSON.parse(tiktokCache);
        const titles = (ttData.recentVideos || []).map(v => v.title).filter(Boolean);
        if (titles.length) {
          voiceParts.push('TikTok posts:\n' + titles.map(t => `- "${t}"`).join('\n'));
        }
      } catch {}
    }

    // YouTube titles
    const ytVideos = results[1]?.result;
    if (ytVideos) {
      try {
        const videos = JSON.parse(ytVideos);
        const titles = (Array.isArray(videos) ? videos : []).map(v => v.title).filter(Boolean);
        if (titles.length) {
          voiceParts.push('YouTube videos:\n' + titles.map(t => `- "${t}"`).join('\n'));
        }
      } catch {}
    }

    const voiceExamples = voiceParts.length
      ? voiceParts.join('\n\n')
      : `No post history available. Write in a voice appropriate for a ${CLIENT_NICHE} creator: ${CLIENT_DESCRIPTION}`;

    // Compute peak posting time from hourly data
    const hourlyData = parseHash(results[2]);
    let bestTimeStr = 'evening (6-9 PM)';
    if (Object.keys(hourlyData).length > 0) {
      const byHour = {};
      for (const [key, val] of Object.entries(hourlyData)) {
        const hr = key.includes(':') ? parseInt(key.split(':').pop(), 10) : parseInt(key, 10);
        if (!isNaN(hr)) byHour[hr] = (byHour[hr] || 0) + val;
      }
      let bestStart = 18;
      let bestSum = -1;
      for (let h = 0; h < 24; h++) {
        const windowSum = (byHour[h] || 0) + (byHour[(h + 1) % 24] || 0) + (byHour[(h + 2) % 24] || 0);
        if (windowSum > bestSum) { bestSum = windowSum; bestStart = h; }
      }
      const fmtHr = (h) => { const ampm = h >= 12 ? 'PM' : 'AM'; return `${h % 12 || 12} ${ampm}`; };
      bestTimeStr = `${fmtHr(bestStart)} – ${fmtHr((bestStart + 3) % 24)}`;
    }

    // Platform-specific rules
    const platformRules = {
      instagram: 'Instagram: Max 2200 chars. Front-load the hook in the first line. Use line breaks for readability. End with a clear CTA. Use 5-10 relevant hashtags.',
      tiktok: 'TikTok: Keep it short and punchy (under 150 chars ideal). Use trending hook patterns like "POV:" or "This is your sign to...". Max 3-5 hashtags.',
      youtube: 'YouTube: Write a compelling title (under 60 chars) AND a full description. Include a hook in the first 2 lines (shown in search). Add timestamps placeholder. Use SEO-friendly keywords.',
    };

    const systemPrompt = `You are the personal social media copywriter for ${CLIENT_NAME}, a ${CLIENT_NICHE} creator.

Your job: Look at this image and write a ${platform} post that sounds exactly like ${CLIENT_NAME} wrote it.

VOICE TRAINING — match this tone, energy, and vocabulary:
${voiceExamples}

PLATFORM RULES:
${platformRules[platform] || platformRules.instagram}

BEST POSTING TIME (from their audience data): ${bestTimeStr}

${notes ? `CREATOR'S NOTES: ${notes}` : ''}

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "caption": "the full caption text with line breaks and emojis",
  "hashtags": ["relevant", "hashtags"],
  "bestTime": "${bestTimeStr}",
  "platformTips": ["1-2 short actionable tips for this specific post on ${platform}"]
}

Rules:
- Write in first person as ${CLIENT_NAME}
- Sound like a real person, NOT a marketing bot
- Match the energy and vocabulary from the voice training examples
- The caption should feel authentic and conversational
- Never use corporate language like "leverage", "optimize", or "drive engagement"`;

    // Call Claude Sonnet with vision
    const llmRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        stream: true,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Data },
            },
            {
              type: 'text',
              text: `Write a ${platform} post for this image.`,
            },
          ],
        }],
      }),
    });

    if (!llmRes.ok) {
      const errText = await llmRes.text();
      console.error('Claude API error:', errText);
      return new Response(JSON.stringify({ error: 'Caption generation failed' }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Stream SSE from Anthropic → client
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      const reader = llmRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const json = line.slice(6).trim();
            if (json === '[DONE]') continue;
            try {
              const evt = JSON.parse(json);
              if (evt.type === 'content_block_delta' && evt.delta?.text) {
                await writer.write(encoder.encode(`data: ${JSON.stringify({ text: evt.delta.text })}\n\n`));
              }
            } catch {}
          }
        }
        await writer.write(encoder.encode('data: [DONE]\n\n'));
      } catch (e) {
        console.error('Stream error:', e);
      } finally {
        writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });

  } catch (e) {
    console.error('Create post error:', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
