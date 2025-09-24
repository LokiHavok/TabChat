// Register settings on init
Hooks.once('init', () => {
  console.log("TabChat: init hook fired");
  game.settings.register('tabchat', 'defaultProximityRange', {
    name: 'Default IC Proximity Range (ft)',
    hint: 'Distance for normal IC chat in grid units (feet).',
    scope: 'world',
    config: true,
    default: 30,
    type: Number
  });
  game.settings.register('tabchat', 'oocDefaultGlobal', {
    name: 'OOC Global by Default',
    hint: 'Ignore scene filtering for OOC.',
    scope: 'world',
    config: true,
    default: false,
    type: Boolean
  });
});

// Parse IC commands and tag messages
Hooks.on('preCreateChatMessage', (messageData, options, userId) => {
  console.log("TabChat: preCreateChatMessage fired", messageData.content);
  const isIC = messageData.style === CONST.CHAT_MESSAGE_STYLES.IC;
  const isOOC = messageData.style === CONST.CHAT_MESSAGE_STYLES.OOC;
  messageData.flags = messageData.flags || {};
  messageData.flags.world = messageData.flags.world || {};

  // Scene tagging for IC and messages with rolls
  if ([CONST.CHAT_MESSAGE_STYLES.IC].includes(messageData.style) || messageData.rolls?.length > 0) {
    if (messageData.speaker?.token) {
      const token = canvas.tokens?.get(messageData.speaker.token);
      if (token) messageData.speaker.scene = token.scene?.id;
    }
  }

  // OOC: Default local, override with /global or /gooc
  if (isOOC) {
    messageData.speaker = messageData.speaker || { scene: game.scenes.viewed?.id || null };
    if (messageData.content.startsWith('/global ') || messageData.content.startsWith('/gooc ')) {
      messageData.content = messageData.content.startsWith('/global ') ? messageData.content.slice(8) : messageData.content.slice(6);
      messageData.flags.world.globalOOC = true;
    }
  }

  // IC Proximity: Parse commands and set ranges
  if (isIC && messageData.speaker?.token) {
    const defaultRange = game.settings.get('tabchat', 'defaultProximityRange');
    let range = defaultRange;
    let isPhone = false;
    let phoneRecipients = [];

    // Parse commands with aliases
    if (messageData.content.startsWith('/shout ') || messageData.content.startsWith('/s ')) {
      range = defaultRange * 2;
      messageData.content = messageData.content.startsWith('/shout ') ? messageData.content.slice(7) : messageData.content.slice(3);
    } else if (messageData.content.startsWith('/low ') || messageData.content.startsWith('/l ')) {
      range = defaultRange / 2;
      messageData.content = messageData.content.startsWith('/low ') ? messageData.content.slice(5) : messageData.content.slice(3);
    } else if (messageData.content.startsWith('/phone ') || messageData.content.startsWith('/p ')) {
      isPhone = true;
      const content = messageData.content.startsWith('/phone ') ? messageData.content.slice(7) : messageData.content.slice(3);
      const parts = content.split(' ', 2);
      phoneRecipients = (parts[0] || '').split(',').map(id => game.users.get(id)?.id).filter(id => id);
      messageData.content = parts[1] || '';
      range = 10; // Eavesdropping range for /phone
      messageData.flags.world.phoneRecipients = phoneRecipients; // Store for rendering
    }

    messageData.flags.world.proximityRange = range;
    messageData.flags.world.isPhone = isPhone;
  }
});

// Filter messages by tab, scene, and proximity
Hooks.on('renderChatMessageHTML', (message, html, data) => {
  if (!ui.chat?.element) {
    console.warn("TabChat: ui.chat.element not ready");
    return;
  }
  console.log("TabChat: renderChatMessageHTML fired", message.content);
  const log = ui.chat;
  const activeTabElement = log.element.querySelector('.tab-button.active');
  const activeTab = activeTabElement ? activeTabElement.getAttribute('data-tab') : null;
  const currentSceneId = game.scenes.viewed?.id;
  const viewerTokens = canvas.tokens?.controlled || [];
  const isPhone = message.getFlag('world', 'isPhone');
  const phoneRecipients = message.getFlag('world', 'phoneRecipients') || [];

  // Determine target panel
  let targetPanel;
  if (message.style === CONST.CHAT_MESSAGE_STYLES.IC) {
    targetPanel = '#ic-panel';
  } else if (message.style === CONST.CHAT_MESSAGE_STYLES.OOC) {
    targetPanel = '#ooc-panel';
  } else if (message.rolls?.length > 0) {
    targetPanel = '#rolls-panel';
  } else if (message.whisper?.length > 0) {
    targetPanel = '#whispers-panel';
  } else {
    targetPanel = '#ic-panel';
  }

  // Scene and visibility filter
  let shouldShow = true;
  const speakerScene = message.speaker?.scene;
  const isGlobalOOC = message.getFlag('world', 'globalOOC');
  if (targetPanel === '#rolls-panel') {
    shouldShow = speakerScene === currentSceneId;
  } else if (targetPanel === '#ooc-panel') {
    shouldShow = isGlobalOOC || speakerScene === currentSceneId;
  } else if (targetPanel === '#whispers-panel') {
    shouldShow = message.whisper.includes(game.user.id) || game.user.isGM;
  }

  // IC Proximity filter (including /phone)
  if (targetPanel === '#ic-panel' && shouldShow) {
    if (isPhone) {
      // /phone: Show for recipients (any scene) or eavesdroppers (speaker's scene)
      shouldShow = phoneRecipients.includes(game.user.id);
      if (!shouldShow && message.speaker?.token && viewerTokens.length > 0) {
        const speakerToken = canvas.tokens?.get(message.speaker.token);
        if (speakerToken && speakerScene === currentSceneId) {
          const gridSize = canvas.scene.grid.size;
          const speakerPos = { x: speakerToken.x, y: speakerToken.y };
          const range = message.getFlag('world', 'proximityRange') || 10;
          shouldShow = viewerTokens.some(viewerToken => {
            const viewerPos = { x: viewerToken.x, y: viewerToken.y };
            const distance = Math.sqrt(
              Math.pow((speakerPos.x - viewerPos.x) / gridSize, 2) +
              Math.pow((speakerPos.y - viewerPos.y) / gridSize, 2)
            ) * canvas.scene.grid.distance;
            return distance <= range;
          });
        }
      }
      if (shouldShow && !phoneRecipients.includes(game.user.id)) {
        html.classList.add('phone-eavesdrop'); // Style eavesdropped messages
      }
    } else if (message.speaker?.token && viewerTokens.length > 0) {
      // Normal IC, /shout, /low: Scene and proximity check
      shouldShow = speakerScene === currentSceneId;
      if (shouldShow) {
        const speakerToken = canvas.tokens?.get(message.speaker.token);
        const range = message.getFlag('world', 'proximityRange') || game.settings.get('tabchat', 'defaultProximityRange');
        const gridSize = canvas.scene.grid.size;
        const speakerPos = { x: speakerToken.x, y: speakerToken.y };
        shouldShow = viewerTokens.some(viewerToken => {
          const viewerPos = { x: viewerToken.x, y: viewerToken.y };
          const distance = Math.sqrt(
            Math.pow((speakerPos.x - viewerPos.x) / gridSize, 2) +
            Math.pow((speakerPos.y - viewerPos.y) / gridSize, 2)
          ) * canvas.scene.grid.distance;
          return distance <= range;
        });
      }
    } else {
      shouldShow = false; // No token or no controlled tokens
    }
  }

  // Append or hide
  if (shouldShow) {
    const panel = log.element.querySelector(targetPanel);
    if (panel) panel.appendChild(html);
    if (activeTab === targetPanel.slice(1)) log.scrollBottom();
    // Auto-switch to tab if new message
    if (activeTab !== targetPanel.slice(1)) {
      switchToTab(targetPanel.slice(1));
    }
  } else {
    html.style.display = 'none';
  }
});

// Re-render on scene change
Hooks.on('renderScene', () => {
  if (ui.chat) ui.chat.render();
});

// Tab switching function
function switchToTab(tabId) {
  if (!ui.chat?.element) {
    console.warn("TabChat: ui.chat.element not ready in switchToTab");
    return;
  }
  const log = ui.chat;
  log.element.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  log.element.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.remove('active');
    panel.style.display = 'none';
  });
  const btn = log.element.querySelector(`.tab-button[data-tab="${tabId}"]`);
  if (btn) btn.classList.add('active');
  const panel = log.element.querySelector(`#${tabId}-panel`);
  if (panel) {
    panel.classList.add('active');
    panel.style.display = 'block';
  }
  log.scrollBottom();
}

// UI Injection with higher priority
Hooks.on('renderChatLog', async (log, html) => {
  if (!ui.chat?.element || !html) {
    console.warn("TabChat: ui.chat.element or html not ready in renderChatLog");
    return;
  }
  // Wait for UI to stabilize
  await new Promise(resolve => setTimeout(resolve, 200));
  console.log("TabChat: renderChatLog fired");
  // Log chat log structure for debugging
  console.log("TabChat: Chat log HTML structure", html.outerHTML);
  if (html.querySelector('.tabbed-chat-tabs') === null) {
    const navHtml = `
      <nav class="tabbed-chat-tabs">
        <button class="tab-button active" data-tab="ic">IC</button>
        <button class="tab-button" data-tab="ooc">OOC</button>
        <button class="tab-button" data-tab="rolls">Rolls</button>
        <button class="tab-button" data-tab="whispers">Whispers</button>
      </nav>
    `;
    const panelsHtml = `
      <div class="tab-panel active message-list" id="ic-panel"></div>
      <div class="tab-panel message-list" id="ooc-panel"></div>
      <div class="tab-panel message-list" id="rolls-panel"></div>
      <div class="tab-panel message-list" id="whispers-panel"></div>
    `;
    // Find the original message list
    let chatMessages = html.querySelector('ol#chat-log');
    if (chatMessages) {
      console.log("TabChat: Found chat message container", chatMessages.tagName + '#' + chatMessages.id);
      // Insert nav before the ol
      chatMessages.insertAdjacentHTML('beforebegin', navHtml);
      // Move existing messages to panels
      html.querySelectorAll('.message').forEach(el => {
        const messageId = el.getAttribute('data-message-id');
        const message = game.messages.get(messageId);
        if (message) Hooks.call('renderChatMessageHTML', message, el);
      });
      // Replace the ol with the panels
      chatMessages.outerHTML = panelsHtml;
    } else {
      console.warn("TabChat: No valid chat message container found (ol#chat-log)");
    }
  }
  // Attach tab click handlers
  html.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', (ev) => {
      const tabId = ev.currentTarget.getAttribute('data-tab');
      switchToTab(tabId);
    });
  });
}, { priority: 100 });
