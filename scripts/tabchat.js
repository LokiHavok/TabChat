// Tabbed Chat Module for Foundry VTT v13
// Inspired by fvtt-tabbed-whispers and proximity-text-chat

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  static tabPanels = {};
  static _activeTab = 'ic';
  static _initialized = false;

  static init() {
    // Register proximity setting
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

    // Delay rendering to ensure UI is fully loaded
    setTimeout(() => {
      const $html = $(ui.chat.element);
      const messages = game.messages.contents.sort((a, b) => a.id.localeCompare(b.id));
      for (const message of messages) {
        TabbedChatManager.renderMessage(message, $html);
      }
    }, 1000); // 1-second delay
  }

  static async injectTabs(app, html, data) {
    if (!(html instanceof HTMLElement) || TabbedChatManager._initialized) {
      console.log(`${MODULE_ID}: Skipping injection (already initialized or invalid HTML)`, html);
      return;
    }

    const $html = $(html);

    // Log DOM structure for debugging
    console.log(`${MODULE_ID}: ChatLog DOM structure`, html.outerHTML);

    // Try multiple selectors
    let defaultOl = $html.find('ol.chat-messages');
    if (!defaultOl.length) {
      defaultOl = $html.find('.chat-messages-container ol');
    }
    if (!defaultOl.length) {
      defaultOl = $html.find('ol'); // Broad fallback
    }
    if (!defaultOl.length) {
      console.warn(`${MODULE_ID}: No <ol> found in ChatLog DOM. Attempting MutationObserver...`);

      const observer = new MutationObserver((mutations, obs) => {
        const ol = html.querySelector('ol.chat-messages') || html.querySelector('.chat-messages-container ol') || html.querySelector('ol');
        if (ol) {
          TabbedChatManager._replaceMessageList($(ol), $html);
          obs.disconnect();
          TabbedChatManager._initialized = true;
        }
      });
      observer.observe(html, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), 1000);
      return;
    }

    TabbedChatManager._replaceMessageList(defaultOl, $html);
    TabbedChatManager._initialized = true;
  }

  static _replaceMessageList(defaultOl, $html) {
    const tabHtml = `
      <div class="tabchat-container">
        <nav class="tabchat-nav">
          ${['ic', 'ooc', 'rolls', 'whisper'].map((tab) => `
            <a class="tabchat-tab ${tab === 'ic' ? 'active' : ''}" data-tab="${tab}">
              ${tab.toUpperCase()}
            </a>
          `).join('')}
        </nav>
        ${['ic', 'ooc', 'rolls', 'whisper'].map((tab) => `
          <section class="tabchat-panel ${tab === 'ic' ? 'active' : ''}" data-tab="${tab}">
            <ol class="chat-messages"></ol>
          </section>
        `).join('')}
      </div>
    `;
    defaultOl.replaceWith(tabHtml);

    // Log the injected tab order to verify
    console.log(`${MODULE_ID}: Injected tab order`, $html.find('.tabchat-nav .tabchat-tab').map((i, el) => $(el).data('tab')).get());

    // Cache tab OL elements with validation
    ['ic', 'ooc', 'rolls', 'whisper'].forEach((tab) => {
      const panel = $html.find(`.tabchat-panel[data-tab="${tab}"] ol.chat-messages`);
      TabbedChatManager.tabPanels[tab] = panel;
      if (!panel.length) {
        console.error(`${MODULE_ID}: Failed to cache panel for tab ${tab}. DOM:`, $html.find(`.tabchat-panel[data-tab="${tab}"]`).length ? 'Panel exists, no OL' : 'Panel missing');
      } else {
        console.log(`${MODULE_ID}: Successfully cached panel for ${tab}`);
      }
    });

    // Bind tab clicks with event delegation
    $html.find('.tabchat-nav').on('click', '.tabchat-tab', (event) => {
      const tabName = event.currentTarget.dataset.tab;
      TabbedChatManager._activateTab(tabName, $html);
    });

    // Initial scroll
    TabbedChatManager._scrollBottom($html);
  }

  static async renderMessage(message, $html) {
    if (!message || typeof message !== 'object') {
      console.error(`${MODULE_ID}: Invalid message object`, { message });
      return;
    }

    let msgHtml;
    try {
      msgHtml = await message.render();
      if (!msgHtml) {
        throw new Error('Render returned undefined');
      }
    } catch (e) {
      console.error(`${MODULE_ID}: Error rendering message`, {
        error: e.message,
        stack: e.stack,
        message: {
          id: message.id,
          content: message.content,
          type: message.type,
          speaker: message.speaker,
          whisper: message.whisper
        }
      });
      return;
    }

    if (!msgHtml || typeof msgHtml !== 'object' || !('addClass' in msgHtml)) {
      console.error(`${MODULE_ID}: Invalid msgHtml from render()`, {
        msgHtml,
        message: {
          id: message.id,
          content: message.content,
          type: message.type,
          speaker: message.speaker,
          whisper: message.whisper
        }
      });
      return;
    }

    const tab = TabbedChatManager._getMessageTab(message);
    if (tab && TabbedChatManager.tabPanels[tab]?.length) {
      TabbedChatManager.tabPanels[tab].append(msgHtml);
      if (TabbedChatManager._initialized && TabbedChatManager._activeTab === tab) {
        TabbedChatManager._scrollBottom($html, tab);
      }
      // Highlight animation from tabbed-whispers
      msgHtml.addClass('tabbed-whispers-highlight');
      setTimeout(() => msgHtml.removeClass('tabbed-whispers-highlight'), 2500);
    } else {
      console.warn(`${MODULE_ID}: No valid tab panel for message`, { tab, message: { id: message.id, content: message.content, type: message.type }, panels: TabbedChatManager.tabPanels });
    }
  }

  static _getMessageTab(message) {
    if (message.isRoll) return 'rolls';
    if (message.whisper?.length > 0) return 'whisper';
    if (message.content?.startsWith('/ooc ')) return 'ooc';

    const speaker = message.speaker;
    if (speaker?.token) {
      const sceneId = speaker.scene;
      if (sceneId !== canvas?.scene?.id) return 'ooc';

      const tokenDoc = canvas?.scene?.tokens?.get(speaker.token);
      if (!tokenDoc) return 'ooc';

      const controlledTokens = canvas?.tokens?.controlled;
      if (controlledTokens.length === 0 || game.user.isGM) return 'ic';

      const controlled = controlledTokens[0];
      const distance = canvas.grid.measureDistance(tokenDoc.center, controlled.center);
      const range = game.settings.get(MODULE_ID, 'proximityRange') || 30;
      if (distance <= range) return 'ic';
    }

    return 'ooc';
  }

  static async updateMessage(message, msgHtml, $html) {
    if (!msgHtml || typeof msgHtml !== 'object' || !('addClass' in msgHtml)) {
      console.error(`${MODULE_ID}: Invalid msgHtml in updateMessage()`, { msgHtml, message: { id: message.id, content: message.content, type: message.type } });
      return;
    }

    const tab = TabbedChatManager._getMessageTab(message);
    if (tab && TabbedChatManager.tabPanels[tab]?.length) {
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
Hooks.on('renderChatLog', async (app, html, data) => {
  await TabbedChatManager.injectTabs(app, html, data);
});

// Handle new messages
Hooks.on('renderChatMessageHTML', async (message, html, data) => {
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
