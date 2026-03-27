export const config = { runtime: 'edge' };

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function(c) {
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const RESEND_KEY = process.env.RESEND_API_KEY;
  const TO_EMAIL   = process.env.CONTACT_TO_EMAIL || 'samuelotto24@gmail.com';
  const FROM_EMAIL = process.env.CONTACT_FROM_EMAIL || 'hub@mandibagley.com';

  if (!RESEND_KEY) {
    return new Response(JSON.stringify({ error: 'Email not configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const name    = escapeHtml(body.name || 'Client');
    const type    = escapeHtml(body.type || 'General');
    const message = escapeHtml(body.message || '').replace(/\n/g, '<br>');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        subject: `[Hub] ${type} — ${name}`,
        html: `
          <h2>Hub Message from ${name}</h2>
          <p><strong>Type:</strong> ${type}</p>
          <p><strong>Message:</strong><br>${message}</p>
        `,
      }),
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Send failed' }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
