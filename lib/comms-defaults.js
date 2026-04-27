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

  day4: {
    label: 'Day 4 Check-In',
    summary: 'Mid-week note — sent automatically four days after signup.',
    when: 'Triggered: 4 days after newsletter signup',
    icon: 'clock',
    fields: {
      subject: {
        label: 'Subject line',
        type: 'text',
        value: 'A quick mid-week note',
      },
      kicker: {
        label: 'Kicker (small uppercase line)',
        help: 'Tiny tag above the headline.',
        type: 'text',
        value: 'The Mid-Week',
      },
      headline: {
        label: 'Headline',
        type: 'text',
        value: 'You showed up.',
      },
      subheadline: {
        label: 'Subheadline',
        help: 'Italic line below the headline.',
        type: 'text',
        value: 'And that already counts for something.',
      },
      intro_p1: {
        label: 'Opening paragraph',
        type: 'textarea',
        value: 'Quick check-in. You joined the list a few days ago, which means you said yes to taking this part of your life a little more seriously — and I notice that.',
      },
      intro_p2: {
        label: 'Second paragraph',
        type: 'textarea',
        value: 'Most people will half-commit. They’ll think about training, scroll past recipes, and never actually move. You opened the email. That’s already different.',
      },
      pull_quote: {
        label: 'Pull quote',
        help: 'The italic accent line.',
        type: 'textarea',
        value: 'Discipline isn’t loud. Most of it looks like showing up to small things on the days you don’t want to.',
      },
      closing_p1: {
        label: 'Closing line 1',
        type: 'text',
        value: 'Stay with me. Recipes and a workout are coming this week.',
      },
      closing_p2: {
        label: 'Closing line 2',
        help: 'Sets up the programs CTA.',
        type: 'textarea',
        value: 'And if you want structure — not just inspiration — my <strong>Reset &amp; Rebuild</strong> 6-week program is open. We rebuild together.',
      },
    },
  },

  day7: {
    label: 'Day 7 Choice Point',
    summary: 'A week in. Two paths: ride the list, or go all in on a program.',
    when: 'Triggered: 7 days after newsletter signup',
    icon: 'flag',
    fields: {
      subject: {
        label: 'Subject line',
        type: 'text',
        value: 'One week in — what now?',
      },
      kicker: {
        label: 'Kicker',
        type: 'text',
        value: 'A Week In.',
      },
      headline: {
        label: 'Headline',
        type: 'text',
        value: 'Two paths from here.',
      },
      intro_p1: {
        label: 'Opening paragraph',
        type: 'textarea',
        value: 'It’s been a week since you joined the list. So here’s the honest pitch: you have two ways to go from here, and both are valid.',
      },
      intro_p2: {
        label: 'Second paragraph',
        type: 'textarea',
        value: 'I’ll keep showing up in your inbox either way — recipes, workouts, faith talks, and the cookbook updates when they come. But if you’re looking for more structure, here’s what that looks like.',
      },
      pull_quote: {
        label: 'Pull quote',
        type: 'text',
        value: 'Inspiration is free. Transformation is structured.',
      },
      path1_title: {
        label: 'Path 1 — Title',
        help: 'The "stay on the list" option.',
        type: 'text',
        value: 'Stay in the loop.',
      },
      path1_text: {
        label: 'Path 1 — Body',
        type: 'textarea',
        value: 'Keep getting the newsletter. You’ll get recipes, workouts, and behind-the-scenes once or twice a month — and you’ll be first to know when the cookbook drops. No pressure, no sales pitches in every email.',
      },
      path2_title: {
        label: 'Path 2 — Title',
        help: 'The programs path.',
        type: 'text',
        value: 'Go all-in on a program.',
      },
      path2_text: {
        label: 'Path 2 — Body',
        type: 'textarea',
        value: '<strong>Reset &amp; Rebuild</strong> ($40) is my 6-week summer fitness + mindset program. <strong>Lock In &amp; Level Up</strong> ($30) is a 6-week strength challenge. Both are built for real life — workouts you can actually do, structure that holds.',
      },
      path2_cta: {
        label: 'Path 2 — Button label',
        type: 'text',
        value: 'Browse Programs →',
      },
      closing: {
        label: 'Closing line',
        type: 'textarea',
        value: 'Either way, I’m glad you’re here. The cookbook is coming, and you’ll know first.',
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
