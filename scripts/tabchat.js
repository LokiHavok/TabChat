// Tabbed Chat Module for Foundry VTT v13
// Inspired by fvtt-tabbed-whispers and proximity-text-chat

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  static tabPanels = {};
  static _activeTab = 'ic';
  static _initialized = false;

  static init() {
    game.settings.register(MODULE_ID, 'proximityRange', {
      name: 'IC Proximity Range',
      hint: 'Max distance (units) for IC messages to appear (default: 30).',
      scope: 'world',
      config: true,
      default: 30,
      type: Number
    });
    console.log(`${MODULE_ID} | Initialized settings`);

    // Patch the prototype to cover all future instances
    if (!ChatLog.prototype._originalPostOne) {
      ChatLog.prototype._originalPostOne = ChatLog.prototype._postOne;
      ChatLog.prototype._postOne = async function (...args) {
        console.log(`${MODULE_ID}: Suppressed default _postOne on prototype`, { args });
        return; // Do nothing; TabbedChatManager handles messages
      };
    }
  }

  static ready() {
    if (TabbedChatManager._initialized) {
      console.log(`${MODULE_ID} | Already initialized, skipping`);
      return;
    }
    TabbedChatManager._initialized = true;
    console.log(`${MODULE_ID} | Ready`);
    // Delay as a fallback to render existing messages
    setTimeout(() => {
      if (!ui.chat?.element) {
        console.warn(`${MODULE_ID}: UI not ready, skipping existing message rendering`);
        return;
      }
      const $html = $(ui.chat.element);
      const messages = game.messages.contents.sort((a, b) => a.id.localeCompare(b.id));
      for (const message of messages) {
        console.log(`${MODULE_ID}: Rendering existing message (fallback)`, { id: message.id, data: message.data });
        TabbedChatManager.renderMessage(message, $html);
      }
    }, 5000); // 5-second delay

    // Patch the current ui.chat instance
    if (ui.chat && typeof ui.chat._postOne === 'function') {
      ui.chat._originalPostOne = ui.chat._postOne;
      ui.chat._postOne = async function (...args) {
        console.log(`${MODULE_ID}: Suppressed default _postOne on ui.chat instance`, { args });
        return; // Do nothing; TabbedChatManager handles messages
      };
      console.log(`${MODULE_ID} | Disabled ui.chat._postOne`);
    } else {
      console.warn(`${MODULE_ID}: Failed to patch ui.chat._postOne, method not found`);
    }

    // Failsafe: Add a hidden <ol> if none exists
    if (!ui.chat?.element.find('ol.chat-messages').length) {
      ui.chat.element.append('<ol class="chat-messages" style="display:none"></ol>');
      console.log(`${MODULE_ID} | Inserted dummy chat-messages <ol>`);
    }
  }

  static async injectTabs(app, html, data) {
    if (!(html instanceof HTMLElement) || TabbedChatManager._initialized) {
      console.log(`${MODULE_ID}: Skipping injection (already initialized or invalid HTML)`, { html });
      return;
    }

    const $html = $(html);
    console.log(`${MODULE_ID}: Initial ChatLog DOM structure`, { html: $html.html() });

    let defaultOl = $html.find('ol.chat-messages');
    if (!defaultOl.length) {
      defaultOl = $html.find('.chat-messages-container ol');
    }
    if (!defaultOl.length) {
      defaultOl = $html.find('ol'); // Broad fallback
    }
    if (!defaultOl.length) {
      console.warn(`${MODULE_ID}: No <ol> found initially, setting up observer`, { html: $html.html() });
      await TabbedChatManager._waitForChatOl($html);
      defaultOl = $html.find('ol.chat-messages') || $html.find('.chat-messages-container ol') || $html.find('ol');
      if (!defaultOl.length) {
        console.error(`${MODULE_ID}: Failed to find OL after waiting, attempting reinitialization`, { html: $html.html() });
        TabbedChatManager._initialized = false; // Allow reinitialization
        return;
      }
    }

    TabbedChatManager._replaceMessageList(defaultOl, $html);
    TabbedChatManager._initialized = true;
  }

  static _waitForChatOl($html) {
    return new Promise((resolve) => {
      const observer = new MutationObserver((mutations, obs) => {
        const ol = $html.find('ol.chat-messages') || $html.find('.chat-messages-container ol') || $html.find('ol');
        if (ol.length) {
          console.log(`${MODULE_ID}: Chat OL detected by observer`, { olCount: ol.length, html: $html.html() });
          obs.disconnect();
          resolve();
        }
      });
      observer.observe($html[0], { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        console.warn(`${MODULE_ID}: Observer timed out waiting for OL after 10 seconds`);
        resolve();
      }, 10000); // 10-second timeout
    });
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

    console.log(`${MODULE_ID}: Injected tab order`, { tabs: $html.find('.tabchat-nav .tabchat-tab').map((i, el) => $(el).data('tab')).get() });

    ['ic', 'ooc', 'rolls', 'whisper'].forEach((tab) => {
      const panel = $html.find(`.tabchat-panel[data-tab="${tab}"] ol.chat-messages`);
      TabbedChatManager.tabPanels[tab] = panel;
      if (!panel.length) {
        console.error(`${MODULE_ID}: Failed to cache panel for tab ${tab}`, { domCheck: $html.find(`.tabchat-panel[data-tab="${tab}"]`).length ? 'Panel exists, no OL' : 'Panel missing' });
      } else {
        console.log(`${MODULE_ID}: Successfully cached panel for ${tab}`);
      }
    });

    $html.find('.tabchat-nav').on('click', '.tabchat-tab', (event) => {
      const tabName = event.currentTarget.dataset.tab;
      TabbedChatManager._activateTab(tabName, $html);
    });

    TabbedChatManager._scrollBottom($html);
  }

  static async renderMessage(message, $html) {
    if (!message || typeof message !== 'object') {
      console.error(`${MODULE_ID}: Invalid message object`, { message });
      return;
    }

    let rendered;
    if (message.type === 'base') {
      rendered = `<li class="chat-message" data-message-id="${message.id}"><div class="message-content">[${message.type.toUpperCase()}] ${message.speaker.alias || 'Unknown'}: ${message.content || 'No content'}</div></li>`;
      console.log(`${MODULE_ID}: Custom rendered for base message`, { type: typeof rendered, value: rendered });
    } else {
      try {
        rendered = await message.renderHTML();
        console.log(`${MODULE_ID}: Rendered type (default)`, { type: typeof rendered, value: rendered });
        if (!rendered) {
          throw new Error('Render returned undefined');
        }
      } catch (e) {
        console.error(`${MODULE_ID}: Error rendering message (default)`, {
          error: e.message,
          stack: e.stack,
          message: {
            id: message.id,
            content: message.content,
            type: message.type,
            speaker: message.speaker,
            whisper: message.whisper,
            isRoll: message.isRoll,
            data: message.data || 'Data unavailable'
          }
        });
        rendered = `<li class="chat-message" data-message-id="${message.id}"><div class="message-content">[${message.type.toUpperCase()}] ${message.speaker.alias || 'Unknown'}: ${message.content || 'No content'}</div></li>`;
      }
    }

    let msgHtml = $(rendered);
    if (!msgHtml || typeof msgHtml !== 'object' || !('addClass' in msgHtml)) {
      console.error(`${MODULE_ID}: Invalid msgHtml after wrapping`, {
        msgHtml,
        renderedType: typeof rendered,
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
    if (tab) {
      if (!TabbedChatManager.tabPanels[tab]?.length) {
        console.warn(`${MODULE_ID}: Tab panel for ${tab} not found, reinitializing`);
        let defaultOl = $html.find('ol.chat-messages') || $html.find('.chat-messages-container ol') || $html.find('ol');
        if (defaultOl.length) {
          TabbedChatManager._replaceMessageList(defaultOl, $html);
        } else {
          console.error(`${MODULE_ID}: No OL found for reinitialization`, { html: $html.html() });
        }
      }
      const $panel = $html.find(`.tabchat-panel[data-tab="${tab}"] ol.chat-messages`);
      if ($panel.length) {
        console.log(`${MODULE_ID}: Attempting to append to ${tab} panel`, { panelExists: $panel.length });
        $panel.append(msgHtml);
        if (TabbedChatManager._activeTab === tab) {
          TabbedChatManager._scrollBottom($html, tab);
        }
        msgHtml.addClass('tabbed-whispers-highlight');
        setTimeout(() => msgHtml.removeClass('tabbed-whispers-highlight'), 2500);
      } else {
        console.warn(`${MODULE_ID}: No valid panel for ${tab}, using fallback`, { html: $html.html() });
        TabbedChatManager.tabPanels['ooc']?.append(msgHtml);
      }
    } else {
      console.warn(`${MODULE_ID}: No valid tab for message, using fallback`, { message: { id: message.id, content: message.content, type: message.type } });
      TabbedChatManager.tabPanels['ooc']?.append(msgHtml);
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

// Prevent Foundry's default appending with pre-hook
Hooks.on('preCreateChatMessage', (message, data, options, userId) => {
  console.log(`${MODULE_ID}: Pre-creating message, marking for custom handling`, { id: message.id, content: message.content });
  message._customHandled = true;
});

Hooks.on('renderChatMessageHTML', (message, html, data) => {
  console.log(`${MODULE_ID}: Intercepting renderChatMessageHTML`, { id: message.id, htmlExists: !!html });
  if (message._customHandled) {
    if (html) html.remove();
    return false;
  }
  return true;
});

// Handle new messages
Hooks.on('createChatMessage', async (message, html, data) => {
  await TabbedChatManager.renderMessage(message, $(ui.chat.element));
});

// Handle updates
Hooks.on('updateChatMessage', async (message, update, options, userId) => {
  const msgHtml = $(await message.renderHTML());
  await TabbedChatManager.updateMessage(message, msgHtml, $(ui.chat.element));
});

// Handle deletes
Hooks.on('deleteChatMessage', (message, options, userId) => {
  TabbedChatManager.deleteMessage(message.id, $(ui.chat.element));
});
