// FocusTube Popup Controller
// Handles user settings, exam mode toggles, topic management, and storage sync.

const DEFAULT_SETTINGS = {
  examModeEnabled: true,
  studyTopics: ['Operating Systems', 'Memory Management', 'Computer Science'],
  blockShorts: true,
  strictMode: false,
  blockedCount: 0
};

let currentSettings = { ...DEFAULT_SETTINGS };

// DOM Elements
const examModeToggle = document.getElementById('examModeToggle');
const masterCard = document.getElementById('masterCard');
const masterStatusText = document.getElementById('masterStatusText');
const tagContainer = document.getElementById('tagContainer');
const tagInput = document.getElementById('tagInput');
const btnAddTag = document.getElementById('btnAddTag');
const topicCount = document.getElementById('topicCount');
const blockShortsToggle = document.getElementById('blockShortsToggle');
const strictModeToggle = document.getElementById('strictModeToggle');
const blockedCountEl = document.getElementById('blockedCount');
const btnResetStats = document.getElementById('btnResetStats');

/**
 * Loads settings from chrome.storage.local and populates UI
 */
function loadSettings() {
  if (!chrome.storage || !chrome.storage.local) {
    console.warn('[FocusTube Popup] chrome.storage not available, using default settings');
    renderUI();
    return;
  }

  chrome.storage.local.get(DEFAULT_SETTINGS, (stored) => {
    currentSettings = { ...DEFAULT_SETTINGS, ...stored };
    renderUI();
  });
}

/**
 * Saves current settings to chrome.storage.local and notifies active tabs
 */
function saveSettings() {
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.set(currentSettings, () => {
      notifyActiveYouTubeTabs();
    });
  }
}

/**
 * Sends real-time update message to active YouTube tabs
 */
function notifyActiveYouTubeTabs() {
  if (!chrome.tabs) return;

  chrome.tabs.query({ url: '*://*.youtube.com/*' }, (tabs) => {
    if (!tabs) return;
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'FOCUSTUBE_SETTINGS_UPDATED',
        settings: currentSettings
      }).catch(() => {
        // Tab might not be ready or active
      });
    });
  });
}

/**
 * Renders the state of toggles, tags, and counters
 */
function renderUI() {
  // Master Exam Toggle
  examModeToggle.checked = currentSettings.examModeEnabled;
  if (currentSettings.examModeEnabled) {
    masterCard.classList.add('active');
    masterStatusText.textContent = 'Off-topic videos are blocked';
    masterStatusText.style.color = '#94a3b8';
  } else {
    masterCard.classList.remove('active');
    masterStatusText.textContent = 'Focus mode is disabled (all videos allowed)';
    masterStatusText.style.color = '#f59e0b';
  }

  // Checkboxes
  blockShortsToggle.checked = currentSettings.blockShorts;
  strictModeToggle.checked = currentSettings.strictMode;

  // Stats
  blockedCountEl.textContent = currentSettings.blockedCount || 0;

  // Render Tags
  renderTags();
}

/**
 * Renders topic tags list
 */
function renderTags() {
  tagContainer.innerHTML = '';
  const topics = currentSettings.studyTopics || [];
  topicCount.textContent = `${topics.length} topic${topics.length === 1 ? '' : 's'}`;

  if (topics.length === 0) {
    const emptyHint = document.createElement('span');
    emptyHint.style.cssText = 'color: #64748b; font-size: 11px; font-style: italic; padding: 4px 0;';
    emptyHint.textContent = 'No topics added. Add your exam subjects below!';
    tagContainer.appendChild(emptyHint);
    return;
  }

  topics.forEach((topic, index) => {
    const tag = document.createElement('span');
    tag.className = 'tag';

    const textSpan = document.createElement('span');
    textSpan.textContent = topic;

    const removeBtn = document.createElement('span');
    removeBtn.className = 'tag-remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.title = 'Remove topic';
    removeBtn.addEventListener('click', () => {
      removeTopic(index);
    });

    tag.appendChild(textSpan);
    tag.appendChild(removeBtn);
    tagContainer.appendChild(tag);
  });
}

/**
 * Adds a new topic
 */
function addTopic(topicText) {
  const trimmed = topicText.trim();
  if (!trimmed) return;

  const exists = currentSettings.studyTopics.some(
    (t) => t.toLowerCase() === trimmed.toLowerCase()
  );

  if (!exists) {
    currentSettings.studyTopics.push(trimmed);
    saveSettings();
    renderTags();
  }

  tagInput.value = '';
}

/**
 * Removes a topic by index
 */
function removeTopic(index) {
  currentSettings.studyTopics.splice(index, 1);
  saveSettings();
  renderTags();
}

// Event Listeners
examModeToggle.addEventListener('change', () => {
  currentSettings.examModeEnabled = examModeToggle.checked;
  saveSettings();
  renderUI();
});

blockShortsToggle.addEventListener('change', () => {
  currentSettings.blockShorts = blockShortsToggle.checked;
  saveSettings();
});

strictModeToggle.addEventListener('change', () => {
  currentSettings.strictMode = strictModeToggle.checked;
  saveSettings();
});

btnAddTag.addEventListener('click', () => {
  addTopic(tagInput.value);
});

tagInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addTopic(tagInput.value);
  }
});

// Preset buttons
document.querySelectorAll('.preset-chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    const topic = btn.getAttribute('data-topic');
    if (topic) {
      addTopic(topic);
    }
  });
});

// Reset counter
btnResetStats.addEventListener('click', () => {
  currentSettings.blockedCount = 0;
  saveSettings();
  blockedCountEl.textContent = '0';
});

// Initial boot
document.addEventListener('DOMContentLoaded', loadSettings);
