// Default copy for Mandi's automated emails.
// Voice: warm, faith-forward, community-feel — workouts/recipes/faith talks/BTS.
// Newsletter sells the cookbook waitlist + monthly notes from Mandi.

export const COMMS_DEFAULTS = {
  welcome: {
    label: 'Welcome Email',
    summary: 'Goes out the moment someone joins the list.',
    when: 'Triggered: newsletter signup',
    icon: 'mail',
    fields: {
      subject: {
        label: 'Subject line',
        help: 'The first thing they see in their inbox.',
        type: 'text',
        value: "You're in — welcome to the loop.",
      },
      intro_p1: {
        label: 'Opening paragraph',
        help: 'The first sentences after the hero image.',
        type: 'textarea',
        value: 'So glad you’re here. This is where I send the workouts I’m loving, the recipes my family is actually eating, the faith talks that won’t fit on Instagram, and the behind-the-scenes — straight to your inbox.',
      },
      intro_p2: {
        label: 'Second paragraph',
        help: 'Sets up the cadence + the cookbook tease.',
        type: 'textarea',
        value: "I write once or twice a month — never spammy. And the moment my <em>cookbook</em> drops, you'll be the first to know. It's been in the works for a while, and I want this list to be the room where it gets announced first.",
      },
      cta_button: {
        label: 'CTA button label',
        help: 'Sends them back to the site to browse programs.',
        type: 'text',
        value: 'See My Programs',
      },
      pull_quote: {
        label: 'Pull quote',
        help: 'A line that anchors the email — Mandi-style.',
        type: 'textarea',
        value: 'Strong body. Quiet faith. Real food. That’s the whole thing.',
      },
      coaching_headline: {
        label: 'Programs CTA headline',
        help: 'The headline above the "join a program" section.',
        type: 'text',
        value: 'Want to do this <em>with me</em>?',
      },
      coaching_paragraph: {
        label: 'Programs CTA paragraph',
        help: 'Why they should consider Reset & Rebuild or Lock In & Level Up.',
        type: 'textarea',
        value: 'If you want a program with structure — not just inspiration — I run two: <strong>Reset &amp; Rebuild</strong> (6-week summer fitness + mindset) and <strong>Lock In &amp; Level Up</strong> (6-week strength challenge). Both are designed for real life.',
      },
      coaching_cta: {
        label: 'Programs button label',
        type: 'text',
        value: 'Browse Programs →',
      },
    },
  },

  day7: {
    label: 'Day 7 Follow-Up',
    summary: 'A week in — sets expectations for what shows up in the newsletter.',
    when: 'Triggered: 7 days after newsletter signup',
    icon: 'flag',
    fields: {
      subject: {
        label: 'Subject line',
        type: 'text',
        value: 'a week in — here’s what’s coming',
      },
      kicker: {
        label: 'Kicker',
        type: 'text',
        value: 'Real Talk',
      },
      headline: {
        label: 'Headline',
        type: 'text',
        value: 'What this list actually is.',
      },
      intro_p1: {
        label: 'Opening paragraph',
        type: 'textarea',
        value: 'It’s been a week since you joined — so here’s the honest breakdown of what shows up here, and what I won’t waste your time with.',
      },
      intro_p2: {
        label: 'Second paragraph',
        type: 'textarea',
        value: 'I write once or twice a month. No daily noise. No fake hype. Just things I actually want to share.',
      },
      pull_quote: {
        label: 'Pull quote',
        type: 'text',
        value: 'If it doesn’t matter to me first, it doesn’t land here.',
      },
      path1_title: {
        label: 'Section 1 — Title',
        help: 'What kind of content shows up.',
        type: 'text',
        value: 'Real life, real things.',
      },
      path1_text: {
        label: 'Section 1 — Body',
        type: 'textarea',
        value: 'Workouts I’m doing. Recipes my family actually eats. Faith talks that don’t fit on Instagram. The brand codes for stuff that’s really in my routine. Behind-the-scenes from real life.',
      },
      path2_title: {
        label: 'Section 2 — Title',
        help: 'When something\'s launching — cookbook, programs, partnerships.',
        type: 'text',
        value: 'When something’s launching.',
      },
      path2_text: {
        label: 'Section 2 — Body',
        type: 'textarea',
        value: 'New programs, partnerships, the cookbook (when it drops), big news — you’ll hear it here first, before anywhere else. That’s the whole point of being on this list.',
      },
      path2_cta: {
        label: 'Section 2 — Button label',
        type: 'text',
        value: 'Browse Programs →',
      },
      closing: {
        label: 'Closing line',
        type: 'textarea',
        value: 'Either way — so glad you’re here. Stay with me.',
      },
    },
  },

  apply_reply: {
    label: 'Application / Inquiry Reply',
    summary: 'Sent instantly when someone fills out the contact / inquiry form.',
    when: 'Triggered: contact form submitted',
    icon: 'check',
    fields: {
      subject: {
        label: 'Subject line',
        type: 'text',
        value: 'Got your message — talk soon.',
      },
      kicker: {
        label: 'Kicker',
        type: 'text',
        value: 'Message Received',
      },
      headline: {
        label: 'Headline',
        type: 'text',
        value: 'Got it.',
      },
      intro_p1: {
        label: 'Opening line',
        help: 'Use {firstName} to personalise — it’ll be replaced with the sender’s first name.',
        type: 'textarea',
        value: '{firstName} — thanks for reaching out. I read every message that comes in. This isn’t going into a black hole.',
      },
      intro_p2: {
        label: 'Setup line',
        type: 'text',
        value: 'Here’s what happens next:',
      },
      step1: {
        label: 'Step 1',
        type: 'textarea',
        value: 'Within <strong>48 hours</strong>, I’ll personally read what you wrote and email you back.',
      },
      step2: {
        label: 'Step 2',
        type: 'textarea',
        value: 'If you asked about a program, I’ll send the right link and answer any questions about whether it’s the right fit.',
      },
      step3: {
        label: 'Step 3',
        type: 'textarea',
        value: 'If it’s a brand or partnership inquiry, I’ll loop in my team and we’ll get back with next steps.',
      },
      wait_kicker: {
        label: '"While you wait" header',
        type: 'text',
        value: 'While you wait —',
      },
      wait_text: {
        label: '"While you wait" body',
        type: 'textarea',
        value: 'Browse the programs on the site. Reset &amp; Rebuild and Lock In &amp; Level Up are both open right now, and the cookbook is coming.',
      },
      wait_cta: {
        label: 'Programs button label',
        type: 'text',
        value: 'See Programs →',
      },
    },
  },
};

// Helper — flatten a comms object to just {field: value}
export function flattenDefaults(kind) {
  const def = COMMS_DEFAULTS[kind];
  if (!def) return {};
  const out = {};
  for (const [k, v] of Object.entries(def.fields)) out[k] = v.value;
  return out;
}

export const COMMS_ORDER = ['welcome', 'day4', 'day7', 'apply_reply'];
