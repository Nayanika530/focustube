// FocusTube Webpage Interactive Controller
// Handles extension download, interactive live simulator, copy actions, and FAQ accordions.

document.addEventListener('DOMContentLoaded', () => {
  initDownloadHandlers();
  initSimulator();
  initFaqAccordion();
  initCopyButtons();
});

/**
 * Handles download triggers and user feedback
 */
function initDownloadHandlers() {
  const downloadButtons = document.querySelectorAll('.btn-download-action');

  downloadButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      // Allow default link download behavior for focustube-extension.zip
      showToast('🚀 Downloading FocusTube v0.1.0 (.zip)...');
    });
  });
}

/**
 * Toast Notification Helper
 */
function showToast(message) {
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>⚡</span> <span>${message}</span>`;
  toastContainer.appendChild(toast);

  // Force reflow and animate in
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 350);
  }, 3200);
}

/**
 * Interactive YouTube Simulator
 */
function initSimulator() {
  const simVideoSelect = document.getElementById('simVideoSelect');
  const simExamToggle = document.getElementById('simExamToggle');
  const simShield = document.getElementById('simShield');
  const simVideoTitle = document.getElementById('simVideoTitle');
  const simVideoChannel = document.getElementById('simVideoChannel');
  const simDiagnosticPill = document.getElementById('simDiagnosticPill');
  const simShieldReason = document.getElementById('simShieldReason');
  const simBtnSearch = document.getElementById('simBtnSearch');
  const simBtnOverride = document.getElementById('simBtnOverride');
  const simPlayerCanvas = document.getElementById('simPlayerCanvas');

  if (!simVideoSelect || !simExamToggle) return;

  // Video catalog
  const videoCatalog = {
    os_memory: {
      title: 'L-5.1: Memory Management and Virtual Memory in OS',
      channel: 'Gate Smashers • 1.2M views',
      isDistraction: false,
      reason: 'Matches study subject: "Operating Systems, Memory Management"',
      bgGrad: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 50%, #0284c7 100%)',
      icon: '⚙️'
    },
    gta6: {
      title: 'Grand Theft Auto VI - Official Gameplay & World Trailer',
      channel: 'Rockstar Games • 185M views',
      isDistraction: true,
      reason: 'Distraction detected: matches non-study entertainment pattern ("gameplay", "trailer").',
      bgGrad: 'linear-gradient(135deg, #4c0519 0%, #881337 50%, #e11d48 100%)',
      icon: '🎮'
    },
    music: {
      title: 'Dua Lipa - Levitating (Official Music Video)',
      channel: 'Dua Lipa • 890M views',
      isDistraction: true,
      reason: 'Distraction detected: matches non-study entertainment pattern ("official music video").',
      bgGrad: 'linear-gradient(135deg, #3b0764 0%, #6b21a8 50%, #a855f7 100%)',
      icon: '🎵'
    },
    full_course: {
      title: 'Operating System Full Course for Beginners - Architecture & Scheduling',
      channel: 'freeCodeCamp.org • 3.4M views',
      isDistraction: false,
      reason: 'Educational lecture recognized ("course", "operating system").',
      bgGrad: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #10b981 100%)',
      icon: '💻'
    },
    memes: {
      title: 'Try Not To Laugh - Best Memes & Funny Clips 2026',
      channel: 'Meme Central • 4.1M views',
      isDistraction: true,
      reason: 'Distraction detected: matches non-study entertainment pattern ("memes", "funny clips").',
      bgGrad: 'linear-gradient(135deg, #451a03 0%, #78350f 50%, #d97706 100%)',
      icon: '😹'
    }
  };

  let allowedOverrides = new Set();

  function updateSimulatorState() {
    const selectedKey = simVideoSelect.value;
    const video = videoCatalog[selectedKey] || videoCatalog.os_memory;
    const isExamModeOn = simExamToggle.checked;
    const isOverridden = allowedOverrides.has(selectedKey);

    // Update metadata
    simVideoTitle.textContent = video.title;
    simVideoChannel.textContent = video.channel;

    // Draw simulated video canvas thumbnail
    renderVideoCanvas(simPlayerCanvas, video);

    // Determine if blocked
    const shouldBlock = isExamModeOn && video.isDistraction && !isOverridden;

    if (shouldBlock) {
      simShield.classList.add('active');
      simShieldReason.textContent = video.reason;
      simDiagnosticPill.innerHTML = `<span class="status-dot red"></span> FocusTube: 🚫 Blocked: "${video.title.slice(0, 20)}..."`;
    } else {
      simShield.classList.remove('active');
      if (!isExamModeOn) {
        simDiagnosticPill.innerHTML = `<span class="status-dot yellow"></span> FocusTube: Mode Disabled (All Allowed)`;
      } else if (isOverridden) {
        simDiagnosticPill.innerHTML = `<span class="status-dot yellow"></span> FocusTube: 🔓 Allowed by Override`;
      } else {
        simDiagnosticPill.innerHTML = `<span class="status-dot green"></span> FocusTube: 📚 Study Video Allowed`;
      }
    }
  }

  // Draw graphical canvas for mock video preview
  function renderVideoCanvas(canvas, video) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Background Gradient
    const grad = ctx.createLinearGradient(0, 0, width, height);
    if (video.isDistraction) {
      grad.addColorStop(0, '#1a0b16');
      grad.addColorStop(1, '#2c0f20');
    } else {
      grad.addColorStop(0, '#0a192f');
      grad.addColorStop(1, '#0e2b4d');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Grid pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Centered Badge / Icon
    ctx.font = '54px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(video.icon, width / 2, height / 2 - 20);

    // Video Category Tag
    ctx.font = '600 15px "Outfit", sans-serif';
    ctx.fillStyle = video.isDistraction ? '#f87171' : '#38bdf8';
    ctx.fillText(video.isDistraction ? 'ENTERTAINMENT FEED' : 'ACADEMIC STUDY STREAM', width / 2, height / 2 + 35);
  }

  // Event Listeners
  simVideoSelect.addEventListener('change', () => {
    updateSimulatorState();
  });

  simExamToggle.addEventListener('change', () => {
    updateSimulatorState();
  });

  if (simBtnSearch) {
    simBtnSearch.addEventListener('click', () => {
      // Simulate switching to study lecture
      simVideoSelect.value = 'os_memory';
      updateSimulatorState();
      showToast('Switched to Operating Systems lecture material!');
    });
  }

  if (simBtnOverride) {
    simBtnOverride.addEventListener('click', () => {
      allowedOverrides.add(simVideoSelect.value);
      updateSimulatorState();
      showToast('Video allowed for this simulated session.');
    });
  }

  // Resize canvas for sharp rendering
  function handleResize() {
    simPlayerCanvas.width = simPlayerCanvas.parentElement.clientWidth || 800;
    simPlayerCanvas.height = simPlayerCanvas.parentElement.clientHeight || 450;
    updateSimulatorState();
  }

  window.addEventListener('resize', handleResize);
  setTimeout(handleResize, 100);
}

/**
 * Copy to clipboard action with visual tooltip
 */
function initCopyButtons() {
  document.querySelectorAll('.btn-copy').forEach((btn) => {
    btn.addEventListener('click', () => {
      const textToCopy = btn.getAttribute('data-copy');
      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          const originalText = btn.textContent;
          btn.textContent = 'Copied!';
          btn.style.color = '#38bdf8';
          setTimeout(() => {
            btn.textContent = originalText;
            btn.style.color = '';
          }, 2000);
        });
      }
    });
  });
}

/**
 * Interactive FAQ accordion toggle
 */
function initFaqAccordion() {
  document.querySelectorAll('.faq-question').forEach((button) => {
    button.addEventListener('click', () => {
      const item = button.closest('.faq-item');
      const isOpen = item.classList.contains('open');

      // Close all other items
      document.querySelectorAll('.faq-item').forEach((otherItem) => {
        otherItem.classList.remove('open');
      });

      // Toggle current item
      if (!isOpen) {
        item.classList.add('open');
      }
    });
  });
}
