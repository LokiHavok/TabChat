// Tabbed Chat Module for Foundry VTT v13
// Inspired by fvtt-tabbed-whispers and proximity-text-chat

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  static tabPanels = {};
  static _activeTab = 'ic';
  static _initialized = false; // Prevent multiple injections

  static init() {
    // Register proximity setting (world scope, like in tabbed-whispers)
    game.settings.register(MODULE_ID, 'proximityRange', {
      name: 'IC Proximity Range',
      hint: 'Max distance (units) for IC messages to appear (default: 30).',
      scope: 'world',
      config: true,
      default: 30,
      type: Number
    });

    console.log(`${MODULE_ID} | Initialized settings`);
  }

  static ready() {
    if (TabbedChatManager._initialized) {
      console.log(`${MODULE_ID} | Already initialized, skipping`);
      return;
    }
    TabbedChatManager._initialized = true;
    console.log(`${MODULE_ID} | Ready`);
  }

  static injectTabs(app, html, data) {
    if (!(html instanceof HTMLElement)) {
      console.warn(`${MODULE_ID}: Expected HTMLElement in renderChatLog, got`, html);
      return;
    }

    // Convert to jQuery for compatibility (or use native DOM if preferred)
    const $html = $(html);
    const defaultOl = $html.find('ol.chat-messages');
    if (!defaultOl.length) {
      console.warn(`${MODULE_ID}: No chat-messages OL found`);
      return;
    }

    const tabHtml = `
      <div class="tabchat-container">
        <nav class="tabchat-nav">
          <a class="tabchat-tab active" data-tab="ic">IC</a>
          <a class="tabchat-tab" data-tab="ooc">OOC</a>
          <a class="tabchat-tab" data-tab="rolls">Rolls</a>
          <a class="tabchat-tab" data-tab="whisper">Whispers</a>
        </nav>
        ${['ic', 'ooc', 'rolls', 'whisper'].map((tab) => `
          <section class="tabchat-panel ${tab === 'ic' ? 'active' : ''}" data-tab="${tab}">
            <ol class="chat-messages"></ol>
          </section>
        `).join('')}
      </div>
    `;
    defaultOl.replaceWith(tabHtml);

    // Cache tab OL elements
    ['ic', 'ooc', 'rolls', 'whisper'].forEach((tab) => {
      TabbedChatManager.tabPanels[tab] = $html.find(`.tabchat-panel[data-tab="${tab}"] ol.chat-messages`);
    });

    // Bind tab clicks
    $html.find('.tabchat-tab').on('click', (event) => TabbedChatManager._activateTab(event.currentTarget.dataset.tab, $html));

    // Render existing messages into tabs
    const messages = game.messages.contents.sort((a, b) => a.id.localeCompare(b.id));
    for (const message of messages) {
      TabbedChatManager.renderMessage(message, $html);
    }

    // Initial scroll
    TabbedChatManager._scrollBottom($html);
  }

  static async renderMessage(message, $html) {
    const msgHtml = await message.render();
    const tab = TabbedChatManager._getMessageTab(message);
    if (tab && TabbedChatManager.tabPanels[tab]) {
      TabbedChatManager.tabPanels[tab].append(msgHtml);
      if (TabbedChatManager._activeTab === tab) {
        TabbedChatManager._scrollBottom($html, tab);
      }
      // Add highlight animation inspired by tabbed-whispers.css
      msgHtml.addClass('tabbed-whispers-highlight');
      setTimeout(() => msgHtml.removeClass('tabbed-whispers-highlight'), 2500); // ~8 iterations * 0.3s
    }
  }

  static _getMessageTab(message) {
    // Rolls tab
    if (message.isRoll) return 'rolls';

    // Whispers tab
    if (message.whisper?.length > 0) return 'whisper';

    // Optional: Manual /ooc prefix inspired by user input needs
    if (message.content?.startsWith('/ooc ')) return 'ooc';

    // IC/OOC logic
    const speaker = message.speaker;
    if (speaker?.token) {
      const sceneId = speaker.scene;
      if (sceneId !== canvas?.scene?.id) return 'ooc'; // Not current scene -> OOC (global)

      const tokenDoc = canvas?.scene?.tokens?.get(speaker.token);
      if (!tokenDoc) return 'ooc';

      const controlledTokens = canvas?.tokens?.controlled;
      if (controlledTokens.length === 0 || game.user.isGM) return 'ic'; // No controlled token or GM -> full IC visibility

      // Proximity check (using first controlled token)
      const controlled = controlledTokens[0];
      const distance = canvas.grid.measureDistance(tokenDoc.center, controlled.center);
      const range = game.settings.get(MODULE_ID, 'proximityRange') || 30;
      if (distance <= range) return 'ic';
    }

    // Default to OOC (no token, far away, etc.)
    return 'ooc';
  }

  static async updateMessage(message, msgHtml, $html) {
    const tab = TabbedChatManager._getMessageTab(message);
    if (tab && TabbedChatManager.tabPanels[tab]) {
      const existing = TabbedChatManager.tabPanels[tab].find(`[data-message-id="${message.id}"]`);
      if (existing.length) {
        existing.replaceWith(msgHtml);
        if (TabbedChatManager._activeTab === tab) {
          TabbedChatManager._scrollBottom($html, tab);
        }
      }
    }
  }

  static deleteMessage(messageId, $html) {
    ['ic', 'ooc', 'rolls', 'whisper'].forEach((tab) => {
      TabbedChatManager.tabPanels[tab]?.find(`[data-message-id="${messageId}"]`).remove();
    });
  }

  static _activateTab(tabName, $html) {
    $html.find('.tabchat-tab').removeClass('active');
    $html.find(`[data-tab="${tabName}"]`).addClass('active');
    $html.find('.tabchat-panel').removeClass('active');
    $html.find(`.tabchat-panel[data-tab="${tabName}"]`).addClass('active');
    TabbedChatManager._activeTab = tabName;
    TabbedChatManager._scrollBottom($html);
  }

  static _scrollBottom($html, tabName = TabbedChatManager._activeTab) {
    const ol = $html.find(`.tabchat-panel[data-tab="${tabName}"] ol.chat-messages`);
    if (ol?.length) {
      ol.prop('scrollTop', ol[0].scrollHeight);
    }
  }
}

// Module Initialization
Hooks.once('init', TabbedChatManager.init);

Hooks.once('ready', TabbedChatManager.ready);

// Inject tabs on chat render
Hooks.on('renderChatLog', (app, html, data) => {
  TabbedChatManager.injectTabs(app, html, data);
});

// Handle new messages
Hooks.on('renderChatMessageHTML', async (message, html, data) => {
  // Prevent default append; we handle it
  html.remove();
  await TabbedChatManager.renderMessage(message, $(ui.chat.element));
});

// Handle updates
Hooks.on('updateChatMessage', async (message, update, options, userId) => {
  const msgHtml = await message.render();
  await TabbedChatManager.updateMessage(message, msgHtml, $(ui.chat.element));
});

// Handle deletes
Hooks.on('deleteChatMessage', (message, options, userId) => {
  TabbedChatManager.deleteMessage(message.id, $(ui.chat.element));
});
