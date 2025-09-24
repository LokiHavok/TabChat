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
  }

  static ready() {
    if (TabbedChatManager._initialized) {
      console.log(`${MODULE_ID} | Already initialized, skipping`);
      return;
    }
    TabbedChatManager._initialized = true;
    console.log(`${MODULE_ID} | Ready`);
  }

  static async injectTabs(app, html, data) {
    if (!(html instanceof HTMLElement) || TabbedChatManager._initialized) {
      console.log(`${MODULE_ID}: Skipping injection (already initialized or invalid HTML)`, { html });
      return;
    }

    const $html = $(html);
    let defaultOl = $html.find('ol.chat-messages');
    if (!defaultOl.length) {
      defaultOl = $html.find('.chat-messages-container ol') || $html.find('ol');
      if (!defaultOl.length) {
        console.warn(`${MODULE_ID}: No chat-messages OL found initially, setting up observer`, { html: $html.html() });
        await TabbedChatManager._waitForChatOl($html);
        defaultOl = $html.find('ol.chat-messages') || $html.find('.chat-messages-container ol') || $html.find('ol');
        if (!defaultOl.length) {
          console.error(`${MODULE_ID}: Failed to find OL after waiting`, { html: $html.html() });
          return;
        }
      }
    }

    console.log(`${MODULE_ID}: Injecting tabs into DOM`, { olCount: defaultOl.length, htmlBefore: $html.html() });

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

    const $tabContainer = $html.find('.tabchat-container');
    if (!$tabContainer.length) {
      console.error(`${MODULE_ID}: Failed to inject tab container`, { htmlAfter: $html.html() });
      return;
    }
    console.log(`${MODULE_ID}: Tabs injected successfully`, { tabCount: $html.find('.tabchat-tab').length });

    ['ic', 'ooc', 'rolls', 'whisper'].forEach((tab) => {
      TabbedChatManager.tabPanels[tab] = $html.find(`.tabchat-panel[data-tab="${tab}"] ol.chat-messages`);
      console.log(`${MODULE_ID}: Cached panel for ${tab}`, { exists: !!TabbedChatManager.tabPanels[tab].length });
    });

    $html.find('.tabchat-nav').on('click', '.tabchat-tab', (event) => {
      const tabName = event.currentTarget.dataset.tab;
      TabbedChatManager._activateTab(tabName, $html);
    });

    TabbedChatManager._scrollBottom($html);
    TabbedChatManager._initialized = true;
  }

  static _waitForChatOl($html) {
    return new Promise((resolve) => {
      const observer = new MutationObserver((mutations, obs) => {
        const ol = $html.find('ol.chat-messages') || $html.find('.chat-messages-container ol') || $html.find('ol');
        if (ol.length) {
          console.log(`${MODULE_ID}: Chat OL detected by observer`, { olCount: ol.length });
          obs.disconnect();
          resolve();
        }
      });
      observer.observe($html[0], { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        console.warn(`${MODULE_ID}: Observer timed out waiting for OL`);
        resolve();
      }, 5000); // 5-second timeout
    });
  }

  static async renderMessage(message, $html) {
    let rendered = await message.renderHTML();
    if (!rendered) {
      rendered = document.createElement('li');
      rendered.className = 'chat-message';
      rendered.dataset.messageId = message.id;
      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';
      contentDiv.textContent = `[${message.type.toUpperCase()}] ${message.speaker.alias || 'Unknown'}: ${message.content || 'No content'}`;
      rendered.appendChild(contentDiv);
    }
    const msgHtml = $(rendered);

    const tab = TabbedChatManager._getMessageTab(message);
    if (tab && TabbedChatManager.tabPanels[tab]) {
      console.log(`${MODULE_ID}: Rendering message to ${tab} tab`, { id: message.id, content: message.content });
      TabbedChatManager.tabPanels[tab].append(msgHtml);
      if (TabbedChatManager._activeTab === tab) {
        TabbedChatManager._scrollBottom($html, tab);
      }
      msgHtml.addClass('tabbed-whispers-highlight');
      setTimeout(() => msgHtml.removeClass('tabbed-whispers-highlight'), 2500);
    } else {
      console.warn(`${MODULE_ID}: No valid tab or panel, using fallback`, { tab, panels: TabbedChatManager.tabPanels });
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

// Prevent default append and handle messages
Hooks.on('renderChatMessageHTML', (message, html, data) => {
  if (html) html.remove();
  return false;
});

Hooks.on('createChatMessage', async (message, html, data) => {
  await TabbedChatManager.renderMessage(message, $(ui.chat.element));
});

Hooks.on('updateChatMessage', async (message, update, options, userId) => {
  await TabbedChatManager.renderMessage(message, $(ui.chat.element));
});

Hooks.on('deleteChatMessage', (message, options, userId) => {
  const $html = $(ui.chat.element);
  ['ic', 'ooc', 'rolls', 'whisper'].forEach((tab) => {
    TabbedChatManager.tabPanels[tab]?.find(`[data-message-id="${message.id}"]`).remove();
  });
});
