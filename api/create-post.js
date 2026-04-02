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

  const authHeader = req.headers.get('authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token !== PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { image, images = [], platform = 'instagram', notes = '', automationKeyword = '' } = body;

    if (!image && images.length === 0) {
      return new Response(JSON.stringify({ error: 'No image provided' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse base64 image (kept for fallback reference in imageContent block below)
    let mediaType = 'image/jpeg';
    let base64Data = image || '';
    if (image && image.startsWith('data:')) {
      const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) {
        return new Response(JSON.stringify({ error: 'Invalid image format' }), {
          status: 400, headers: { 'Content-Type': 'application/json' },
        });
      }
      mediaType = match[1];
      base64Data = match[2];
    }

    // Fetch voice training data + peak hours + automations from Redis
    const PREFIX = process.env.REDIS_PREFIX || 'stats:';
    const results = await redis([
      ['GET', PREFIX + 'tiktok:cache'],
      ['GET', PREFIX + 'youtube:videos'],
      ['HGETALL', PREFIX + 'hourly'],
      ['GET', PREFIX + 'ig:captions'],
      ['GET', PREFIX + 'automations'],
    ]);

    // Look up the attached automation
    let automationCTA = '';
    if (automationKeyword) {
      const automationsRaw = results[4]?.result;
      if (automationsRaw) {
        try {
          const automations = JSON.parse(automationsRaw);
          const matched = automations.find(a => a.keyword === automationKeyword && a.active);
          if (matched) {
            automationCTA = `\n\nIMPORTANT — AUTOMATION CTA: This post has the "${matched.keyword}" automation attached. You MUST end the caption with a clear call-to-action telling followers to comment "${matched.keyword}" to get "${matched.captureHeadline}". Work it naturally into the caption — don't just tack it on. Example: "Comment ${matched.keyword} and I'll send you my ${matched.captureHeadline.toLowerCase().replace(/^your\s+/i, '')}! 🔥"`;
          }
        } catch {}
      }
    }

    // Assemble voice examples — full captions, not just titles
    const voiceParts = [];

    // Instagram captions (the richest voice data)
    const igCaptions = results[3]?.result;
    if (igCaptions) {
      try {
        const captions = JSON.parse(igCaptions);
        if (captions.length) {
          voiceParts.push('Instagram captions (THIS IS THE PRIMARY VOICE REFERENCE — match this style closely):\n' +
            captions.slice(0, 15).map((c, i) => `${i + 1}. "${c}"`).join('\n\n'));
        }
      } catch {}
    }

    // TikTok titles + descriptions
    const tiktokCache = results[0]?.result;
    if (tiktokCache) {
      try {
        const ttData = JSON.parse(tiktokCache);
        const posts = (ttData.recentVideos || []).filter(v => v.title);
        if (posts.length) {
          voiceParts.push('TikTok posts:\n' + posts.map(v => `- "${v.title}"`).join('\n'));
        }
      } catch {}
    }

    // YouTube titles + descriptions
    const ytVideos = results[1]?.result;
    if (ytVideos) {
      try {
        const videos = JSON.parse(ytVideos);
        const vids = (Array.isArray(videos) ? videos : []).filter(v => v.title);
        if (vids.length) {
          const ytExamples = vids.map(v => {
            const desc = v.description ? v.description.split('\n').slice(0, 3).join('\n') : '';
            return desc ? `- Title: "${v.title}"\n  Description: "${desc}"` : `- "${v.title}"`;
          });
          voiceParts.push('YouTube videos:\n' + ytExamples.join('\n'));
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

Your job: Look at this image and write a ${platform} post that sounds EXACTLY like ${CLIENT_NAME} wrote it — not like an AI, not like a marketer, like HER.

VOICE TRAINING — study these examples carefully and match this person's actual writing style:
${voiceExamples}

VOICE ANALYSIS — before writing, internalize:
- How does ${CLIENT_NAME} start posts? (hook style, first words)
- What emojis does she actually use? (only use ones from her examples)
- How long are her typical captions? (match the length)
- Does she use all caps, abbreviations, slang? (mirror it)
- How does she do CTAs? (match her style, not generic marketing)
- What's her hashtag style? (number, type, placement)

PLATFORM RULES:
${platformRules[platform] || platformRules.instagram}

BEST POSTING TIME (from their audience data): ${bestTimeStr}

${notes ? `CREATOR'S NOTES: ${notes}` : ''}${automationCTA}

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "caption": "the full caption text with line breaks and emojis",
  "hashtags": ["relevant", "hashtags"],
  "bestTime": "${bestTimeStr}",
  "platformTips": ["1-2 short actionable tips for this specific post on ${platform}"]
}

Rules:
- Write in first person as ${CLIENT_NAME}
- The caption must be indistinguishable from her real posts
- Match her exact emoji patterns, sentence structure, and energy
- If her examples use lowercase, use lowercase. If she uses caps for emphasis, do the same.
- Never use corporate language like "leverage", "optimize", or "drive engagement"
- If no voice examples are available, write naturally for a ${CLIENT_NICHE} creator`;

    // Build image content blocks — all carousel images for context
    const imageContent = [];
    const allImages = images.length > 0 ? images : (image ? [image] : []);

    for (const img of allImages.slice(0, 10)) {
      let mt = 'image/jpeg';
      let b64 = img;
      if (img.startsWith('data:')) {
        const m = img.match(/^data:(image\/\w+);base64,(.+)$/);
        if (m) { mt = m[1]; b64 = m[2]; }
      }
      if (b64.length > 1500000) continue;
      imageContent.push({
        type: 'image',
        source: { type: 'base64', media_type: mt, data: b64 },
      });
    }

    if (!imageContent.length && image) {
      imageContent.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64Data },
      });
    }

    const isCarousel = allImages.length > 1;
    const carouselNote = isCarousel
      ? `\n\nThis is a CAROUSEL POST with ${allImages.length} images. Write ONE caption that works for the entire carousel. Reference the variety/progression of images naturally.`
      : '';

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
            ...imageContent,
            {
              type: 'text',
              text: `Write a ${platform} post for ${isCarousel ? 'this carousel of ' + allImages.length + ' images' : 'this image'}.${carouselNote}`,
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
