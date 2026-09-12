// FocusTube content script
// Injected on YouTube pages to filter and block irrelevant videos during study/exam sessions.

console.log('[FocusTube] Content script initialized at:', window.location.href);

// Default configuration
const DEFAULT_SETTINGS = {
  examModeEnabled: true,
  studyTopics: ['Operating Systems', 'Memory Management', 'Computer Science'],
  blockShorts: true,
  strictMode: false,
  blockedCount: 0
};

let currentSettings = { ...DEFAULT_SETTINGS };
let lastProcessedVideoId = null;
let titleDetectionTimeout = null;
let activeShieldElement = null;
let pauseEnforcerInterval = null;
const allowedSessionVideoIds = new Set();

// Comprehensive keyword dictionaries for educational vs distraction classification
const DISTRACTION_KEYWORDS = [
  'gameplay', 'walkthrough', 'speedrun', 'playthrough', 'let\'s play', 'gaming',
  'roblox', 'minecraft', 'fortnite', 'gta', 'gta 5', 'gta v', 'valorant', 'pubg',
  'free fire', 'among us', 'call of duty', 'esports', 'twitch',
  'official music video', 'official video', 'official audio', 'music video',
  'lyric video', 'lyrics', 'remix', 'full album', 'soundtrack', 'vevo',
  'vlog', 'prank', 'pranks', 'roast', 'funny moments', 'comedy club', 'stand up comedy',
  'meme', 'memes', 'try not to laugh', 'unboxing', 'haul', 'gossip', 'drama',
  'mukbang', 'challenge', 'tik tok', 'tiktok compilation', 'shorts compilation',
  'official trailer', 'teaser trailer', 'movie clip', 'full movie', 'web series',
  'anime fight', 'bloopers', 'highlights', 'match highlights', 'goals', 'ufc', 'wwe'
];

const EDUCATIONAL_KEYWORDS = [
  'lecture', 'tutorial', 'course', 'full course', 'crash course', 'revision',
  'chapter', 'syllabus', 'gate', 'nptel', 'mit ocw', 'khan academy', 'harvard',
  'stanford', 'class 10', 'class 11', 'class 12', 'engineering', 'derivation',
  'proof', 'concept', 'notes', 'solved question', 'previous year', 'pyq',
  'exam prep', 'examination', 'one shot', 'oneshot', 'complete guide', 'roadmap',
  'explanation', 'how to code', 'learn', 'problem solving', 'solution',
  'data structures', 'algorithms', 'operating system', 'memory management',
  'mathematics', 'calculus', 'physics', 'chemistry', 'biology', 'computer science',
  'study with me', 'deep dive', 'architecture', 'fundamentals', 'interview prep'
];

/**
 * Loads settings from chrome.storage.local
 */
function initializeSettings() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(DEFAULT_SETTINGS, (stored) => {
      if (stored) {
        currentSettings = { ...DEFAULT_SETTINGS, ...stored };
        console.log('[FocusTube] Loaded settings:', currentSettings);
      }
      evaluateCurrentPage('settings-loaded');
    });

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        let changed = false;
        for (const [key, { newValue }] of Object.entries(changes)) {
          if (newValue !== undefined) {
            currentSettings[key] = newValue;
            changed = true;
          }
        }
        if (changed) {
          console.log('[FocusTube] Settings updated dynamically:', currentSettings);
          evaluateCurrentPage('settings-changed');
        }
      }
    });
  } else {
    evaluateCurrentPage('default-settings');
  }
}

// Listen for direct messages from popup
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === 'FOCUSTUBE_SETTINGS_UPDATED') {
      currentSettings = { ...DEFAULT_SETTINGS, ...message.settings };
      evaluateCurrentPage('message-settings-updated');
    }
  });
}

/**
 * Creates or updates an on-screen diagnostic badge.
 */
function updateDiagnosticBadge(statusText, badgeType = 'info') {
  let badge = document.getElementById('focustube-diagnostic-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'focustube-diagnostic-badge';
    badge.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999999;
      background: rgba(9, 13, 22, 0.95);
      backdrop-filter: blur(8px);
      color: #38bdf8;
      border: 1px solid #0284c7;
      padding: 8px 16px;
      border-radius: 9999px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 10px rgba(56, 189, 248, 0.2);
      pointer-events: none;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    document.body.appendChild(badge);
  }

  let dotColor = '#38bdf8';
  if (badgeType === 'success') dotColor = '#22c55e';
  if (badgeType === 'blocked') dotColor = '#ef4444';
  if (badgeType === 'warning') dotColor = '#f59e0b';

  badge.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dotColor};box-shadow:0 0 8px ${dotColor};"></span> FocusTube: ${statusText}`;
}

// Immediately display badge when DOM is available
if (document.body) {
  updateDiagnosticBadge('Study Guard Ready');
} else {
  document.addEventListener('DOMContentLoaded', () => updateDiagnosticBadge('Study Guard Ready'));
}

/**
 * Extracts the current video ID from the URL (supports both /watch?v= and /shorts/).
 */
function getVideoId() {
  try {
    const url = new URL(window.location.href);
    if (url.pathname.startsWith('/shorts/')) {
      const parts = url.pathname.split('/').filter(Boolean);
      return parts[1] || null;
    }
    if (url.pathname === '/watch') {
      return url.searchParams.get('v');
    }
  } catch (e) {
    // Fallback if URL parsing fails
  }
  return null;
}

/**
 * Checks if current page is YouTube Shorts
 */
function isShortsPage() {
  return window.location.pathname.startsWith('/shorts/');
}

/**
 * Attempts to extract the video title using known YouTube DOM selectors.
 */
function queryVideoTitleFromDOM() {
  const candidateSelectors = [
    'ytd-watch-metadata #title h1 yt-formatted-string',
    'h1.ytd-watch-metadata yt-formatted-string',
    'h1.style-scope.ytd-watch-metadata',
    '#above-the-fold #title h1',
    'h1.title.style-scope.ytd-video-primary-info-renderer',
    'h2.ytd-reel-player-header-renderer yt-formatted-string',
    'ytd-reel-player-header-renderer h2'
  ];

  for (const selector of candidateSelectors) {
    const el = document.querySelector(selector);
    if (el && el.textContent && el.textContent.trim().length > 0) {
      return el.textContent.trim();
    }
  }

  if (document.title && document.title.includes('- YouTube')) {
    const cleanTitle = document.title.replace(/\s*-\s*YouTube$/, '').trim();
    if (cleanTitle.length > 0) {
      return cleanTitle;
    }
  }

  return null;
}

/**
 * Extracts channel name from the DOM if available.
 */
function queryChannelNameFromDOM() {
  const channelSelectors = [
    'ytd-watch-metadata ytd-channel-name a',
    '#owner #channel-name a',
    '#channel-name yt-formatted-string a',
    'ytd-video-owner-renderer #channel-name a'
  ];

  for (const selector of channelSelectors) {
    const el = document.querySelector(selector);
    if (el && el.textContent && el.textContent.trim().length > 0) {
      return el.textContent.trim();
    }
  }
  return '';
}

/**
 * Evaluates whether a video is relevant to the active exam session or should be blocked.
 * @returns {{ isAllowed: boolean, reason: string }}
 */
function evaluateVideoRelevance(title, channelName = '') {
  // 1. If Exam Mode is turned off, allow everything
  if (!currentSettings.examModeEnabled) {
    return { isAllowed: true, reason: 'Exam Mode is Disabled' };
  }

  const videoId = getVideoId();

  // 2. Check for student session override
  if (videoId && allowedSessionVideoIds.has(videoId)) {
    return { isAllowed: true, reason: 'Temporarily Allowed by Student' };
  }

  // 3. Check YouTube Shorts
  if (isShortsPage() && currentSettings.blockShorts) {
    return {
      isAllowed: false,
      reason: 'YouTube Shorts are blocked to avoid doom-scrolling during exams.'
    };
  }

  const normalizedTitle = (title || '').toLowerCase();
  const normalizedChannel = (channelName || '').toLowerCase();
  const combinedText = `${normalizedTitle} ${normalizedChannel}`;

  // 4. Check against user's custom study topics
  const topics = currentSettings.studyTopics || [];
  let topicMatched = false;
  let matchedTopicName = '';

  for (const topic of topics) {
    const cleanTopic = topic.trim().toLowerCase();
    if (!cleanTopic) continue;

    // Check exact phrase match or significant subwords
    if (combinedText.includes(cleanTopic)) {
      topicMatched = true;
      matchedTopicName = topic;
      break;
    }

    // Split topic into key words (length >= 3)
    const keywords = cleanTopic.split(/\s+/).filter(w => w.length >= 3);
    const matchesKeyword = keywords.length > 0 && keywords.every(kw => combinedText.includes(kw));
    if (matchesKeyword) {
      topicMatched = true;
      matchedTopicName = topic;
      break;
    }
  }

  if (topicMatched) {
    return {
      isAllowed: true,
      reason: `Matches study subject: "${matchedTopicName}"`
    };
  }

  // 5. Strict Mode Check: If student enabled Strict Mode, only matching topics are allowed
  if (currentSettings.strictMode) {
    return {
      isAllowed: false,
      reason: `Strict Exam Mode active: Video does not match your topics (${topics.join(', ') || 'No topics set'}).`
    };
  }

  // 6. Check for obvious distraction signals (gaming, music videos, vlogs, memes)
  for (const distraction of DISTRACTION_KEYWORDS) {
    if (combinedText.includes(distraction)) {
      return {
        isAllowed: false,
        reason: `Distraction detected: matches non-study entertainment pattern ("${distraction}").`
      };
    }
  }

  // 7. Check for general educational signals
  for (const eduKeyword of EDUCATIONAL_KEYWORDS) {
    if (combinedText.includes(eduKeyword)) {
      return {
        isAllowed: true,
        reason: `Educational content recognized ("${eduKeyword}").`
      };
    }
  }

  // 8. If topics are explicitly specified and video is neither educational nor matched:
  if (topics.length > 0) {
    return {
      isAllowed: false,
      reason: `Off-topic video: does not appear relevant to your exam subjects (${topics.slice(0, 3).join(', ')}).`
    };
  }

  // Fallback: allow if no strong distraction was detected
  return {
    isAllowed: true,
    reason: 'No clear distraction pattern detected.'
  };
}

/**
 * Pauses video playback and locks it while off-topic video is active.
 */
function enforceVideoPause() {
  const video = document.querySelector('video');
  if (video) {
    video.pause();
    video.muted = true;
  }

  if (!pauseEnforcerInterval) {
    pauseEnforcerInterval = setInterval(() => {
      if (activeShieldElement && document.body.contains(activeShieldElement)) {
        const v = document.querySelector('video');
        if (v && !v.paused) {
          v.pause();
        }
      } else {
        clearInterval(pauseEnforcerInterval);
        pauseEnforcerInterval = null;
      }
    }, 250);
  }
}

/**
 * Creates and displays the modern Focus Shield blocking overlay over the player.
 */
function showFocusShield(title, reason) {
  enforceVideoPause();

  // If shield already exists and matches, just update text
  let shield = document.getElementById('focustube-shield-overlay');
  if (!shield) {
    shield = document.createElement('div');
    shield.id = 'focustube-shield-overlay';
    shield.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 2147483647;
      background: radial-gradient(circle at 50% 40%, rgba(15, 23, 42, 0.96) 0%, rgba(3, 7, 18, 0.99) 100%);
      color: #f8fafc;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 32px 24px;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      backdrop-filter: blur(12px);
      animation: focustubeFadeIn 0.3s ease-out forwards;
    `;

    // Inject custom animation styles if not already present
    if (!document.getElementById('focustube-shield-styles')) {
      const styleTag = document.createElement('style');
      styleTag.id = 'focustube-shield-styles';
      styleTag.textContent = `
        @keyframes focustubeFadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        .ft-btn-search {
          background: linear-gradient(135deg, #0284c7, #38bdf8);
          color: #ffffff !important;
          border: none;
          padding: 10px 22px;
          border-radius: 9999px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 4px 14px rgba(56, 189, 248, 0.35);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .ft-btn-search:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(56, 189, 248, 0.5);
        }
        .ft-btn-override {
          background: transparent;
          color: #94a3b8 !important;
          border: 1px solid rgba(148, 163, 184, 0.3);
          padding: 9px 18px;
          border-radius: 9999px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .ft-btn-override:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #f1f5f9 !important;
          border-color: rgba(255, 255, 255, 0.4);
        }
      `;
      document.head.appendChild(styleTag);
    }
  }

  const activeTopicDisplay = (currentSettings.studyTopics && currentSettings.studyTopics.length > 0)
    ? currentSettings.studyTopics.join(', ')
    : 'General Study';

  shield.innerHTML = `
    <div style="max-width: 520px; display: flex; flex-direction: column; align-items: center; gap: 14px;">
      <div style="width: 56px; height: 56px; border-radius: 16px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); display: flex; align-items: center; justify-content: center; font-size: 28px; box-shadow: 0 0 24px rgba(239, 68, 68, 0.25);">
        🛡️
      </div>

      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #f87171; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25); padding: 3px 10px; border-radius: 9999px;">
        Exam Focus Mode Active
      </div>

      <h2 style="font-size: 22px; font-weight: 700; color: #ffffff; margin: 0; line-height: 1.3;">
        Distraction Blocked
      </h2>

      <p style="font-size: 13px; color: #94a3b8; margin: 0; line-height: 1.5;">
        ${reason}
      </p>

      <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 10px; padding: 10px 16px; font-size: 12px; color: #cbd5e1; width: 100%; box-sizing: border-box;">
        <span style="color: #38bdf8; font-weight: 600;">Current Study Topics:</span> ${activeTopicDisplay}
      </div>

      <div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin-top: 8px;">
        <button class="ft-btn-search" id="ft-btn-search-topic">
          🔍 Search Study Material
        </button>
        <button class="ft-btn-override" id="ft-btn-allow-once">
          I need this for exam (Allow Video)
        </button>
      </div>
    </div>
  `;

  // Attach to YouTube video container
  const playerContainer = document.querySelector('#movie_player') ||
                          document.querySelector('.html5-video-player') ||
                          document.querySelector('ytd-player') ||
                          document.querySelector('#player-container');

  if (playerContainer) {
    if (!playerContainer.style.position || playerContainer.style.position === 'static') {
      playerContainer.style.position = 'relative';
    }
    playerContainer.appendChild(shield);
    activeShieldElement = shield;
  } else {
    // Fallback: attach to body
    document.body.appendChild(shield);
    activeShieldElement = shield;
  }

  // Hook up button events
  const btnSearch = shield.querySelector('#ft-btn-search-topic');
  if (btnSearch) {
    btnSearch.addEventListener('click', () => {
      const searchTopic = (currentSettings.studyTopics && currentSettings.studyTopics[0]) || 'Computer Science';
      window.location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTopic + ' lecture')}`;
    });
  }

  const btnOverride = shield.querySelector('#ft-btn-allow-once');
  if (btnOverride) {
    btnOverride.addEventListener('click', () => {
      const videoId = getVideoId();
      if (videoId) {
        allowedSessionVideoIds.add(videoId);
        removeFocusShield();
        updateDiagnosticBadge(`Allowed by user override: "${title.slice(0, 20)}..."`, 'warning');
        const v = document.querySelector('video');
        if (v) {
          v.muted = false;
          v.play().catch(() => {});
        }
      }
    });
  }

  // Increment blocked count in chrome storage
  incrementBlockedCount();
}

/**
 * Removes the Focus Shield overlay and restores normal video playback
 */
function removeFocusShield() {
  const shield = document.getElementById('focustube-shield-overlay');
  if (shield) {
    shield.remove();
  }
  activeShieldElement = null;

  if (pauseEnforcerInterval) {
    clearInterval(pauseEnforcerInterval);
    pauseEnforcerInterval = null;
  }

  const video = document.querySelector('video');
  if (video) {
    video.muted = false;
  }
}

/**
 * Increments the blocked distractions counter in storage
 */
function incrementBlockedCount() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get({ blockedCount: 0 }, (result) => {
      const newCount = (result.blockedCount || 0) + 1;
      chrome.storage.local.set({ blockedCount: newCount });
    });
  }
}

/**
 * Evaluates current video and enforces blocking or allowing.
 */
function checkAndFilterVideo(videoId, title) {
  const channelName = queryChannelNameFromDOM();
  const evaluation = evaluateVideoRelevance(title, channelName);

  console.log(`[FocusTube] Evaluation for "${title}":`, evaluation);

  if (!evaluation.isAllowed) {
    // Off-topic video: block and show shield
    showFocusShield(title, evaluation.reason);
    updateDiagnosticBadge(`🚫 Blocked: "${title.slice(0, 22)}..."`, 'blocked');
  } else {
    // Study-related video: allow playback
    removeFocusShield();
    const shortTitle = title ? `"${title.slice(0, 24)}..."` : 'Video';
    updateDiagnosticBadge(`📚 Study Video: ${shortTitle}`, 'success');
  }
}

/**
 * Waits for the video title element to populate in the dynamic DOM.
 */
function waitForVideoTitle(videoId, maxWaitMs = 5000) {
  if (titleDetectionTimeout) {
    clearTimeout(titleDetectionTimeout);
    titleDetectionTimeout = null;
  }

  const startTime = Date.now();
  updateDiagnosticBadge(`Scanning video (${videoId})...`, 'info');

  function checkTitle() {
    if (getVideoId() !== videoId) {
      return;
    }

    const title = queryVideoTitleFromDOM();
    if (title) {
      lastProcessedVideoId = videoId;
      checkAndFilterVideo(videoId, title);
      return;
    }

    if (Date.now() - startTime < maxWaitMs) {
      titleDetectionTimeout = setTimeout(checkTitle, 150);
    } else {
      const fallbackTitle = document.title ? document.title.replace(/\s*-\s*YouTube$/, '').trim() : 'Unknown';
      lastProcessedVideoId = videoId;
      console.warn(`[FocusTube] Title detection timed out for video ID ${videoId}. Fallback: "${fallbackTitle}"`);
      checkAndFilterVideo(videoId, fallbackTitle);
    }
  }

  checkTitle();
}

/**
 * Handles evaluation when settings update or page navigation triggers.
 */
function evaluateCurrentPage(source = 'unknown') {
  const videoId = getVideoId();

  if (!videoId) {
    removeFocusShield();
    if (lastProcessedVideoId !== null) {
      lastProcessedVideoId = null;
      updateDiagnosticBadge(currentSettings.examModeEnabled ? 'Exam Guard: Browse Mode' : 'Focus Mode Disabled', 'info');
    }
    return;
  }

  console.log(`[FocusTube] Video page transition [${source}] for video ID: ${videoId}`);
  waitForVideoTitle(videoId);
}

// 1. YouTube SPA custom DOM events
document.addEventListener('yt-navigate-finish', () => evaluateCurrentPage('yt-navigate-finish'));
document.addEventListener('yt-page-data-updated', () => evaluateCurrentPage('yt-page-data-updated'));
window.addEventListener('yt-navigate-finish', () => evaluateCurrentPage('yt-navigate-finish-window'));

// 2. Navigation API (Modern Chromium)
if (window.navigation) {
  window.navigation.addEventListener('navigatesuccess', () => evaluateCurrentPage('navigation-api'));
}

// 3. Document Title Observer
const titleEl = document.querySelector('title');
if (titleEl) {
  const titleObserver = new MutationObserver(() => {
    evaluateCurrentPage('title-mutation');
  });
  titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
}

// 4. Polling fallback (runs every 350ms) to catch any SPA URL switches
let previousUrl = window.location.href;
setInterval(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== previousUrl) {
    previousUrl = currentUrl;
    evaluateCurrentPage('url-polling');
  }
}, 350);

// Initialize settings and run first check
initializeSettings();
