const DISPLAY_NAMES = {
  'youtube.com':       'YouTube',
  'facebook.com':      'Facebook',
  'x.com':             'X',
  'twitter.com':       'Twitter',
  'tiktok.com':        'TikTok',
  'instagram.com':     'Instagram',
  'reddit.com':        'Reddit',
  'twitch.tv':         'Twitch',
  'netflix.com':       'Netflix',
  'github.com':        'GitHub',
  'docs.google.com':   'Google Docs',
  'sheets.google.com': 'Google Sheets',
  'slides.google.com': 'Google Slides',
  'mail.google.com':   'Gmail',
  'discord.com':       'Discord',
  'notion.so':         'Notion',
  'figma.com':         'Figma',
};

export function displayName(platform) {
  return DISPLAY_NAMES[platform.toLowerCase()] ?? platform;
}

// Mirrors ws_server.rs → normalize_app(): collapses legacy browser process
// names ("Google Chrome", "firefox", etc.) into the canonical "Browser".
export function normalizePlatform(name) {
  const n = name.toLowerCase();
  if (['chrome', 'chromium', 'firefox', 'brave', 'edge', 'opera'].some(b => n.includes(b))) {
    return 'Browser';
  }
  return name;
}

export const DISTRACTED_DOMAINS = new Set([
  'youtube.com', 'facebook.com', 'x.com', 'twitter.com',
  'tiktok.com', 'instagram.com', 'reddit.com', 'twitch.tv', 'netflix.com',
]);

export function hashColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360}, 65%, 62%)`;
}
