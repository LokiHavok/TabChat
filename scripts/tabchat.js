// Tabbed Chat Module for Foundry VTT v13
// Inspired by fvtt-tabbed-whispers and proximity-text-chat

const MODULE_ID = 'tabchat';

class TabbedChatLog extends foundry.applications.sidebar.tabs.ChatLog {
  constructor(options = {}) {
    super(options);
    this._activeTab = 'ic';
    this.tabPanels = {};
  }

  async _renderInner(data) {
    const html = await super._renderInner(data);

    const $html = $(html);
    const defaultOl = $html.find('ol.chat-messages');
    if (!defaultOl.length) {
      console.warn(`${MODULE_ID}: No chat-messages OL found`);
      return html;
    }

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

    // Cache panels
    ['ic', 'ooc', 'rolls', 'whisper'].forEach((tab) => {
      this.tabPanels[tab] = $html.find(`.tabchat-panel[data-tab="${tab}"] ol.chat-messages`);
    });

    // Bind clicks
    $html.find('.tabchat-nav').on('click', '.tabchat-tab', (event) => this._activateTab(event.currentTarget.dataset.tab, $html));

    // Render existing messages
    const messages = game.messages.contents.sort((a, b) => a.id.localeCompare(b.id));
    for (const message of messages) {
      await this.renderMessage(message);
    }

    this._scrollBottom();
    return html;
  }

  async renderMessage(message) {
    let rendered = await message.renderHTML();
    if (!rendered) {
      // Fallback for base messages or render failure
      rendered = document.createElement('li');
      rendered.className = 'chat-message';
      rendered.dataset.messageId = message.id;
      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';
      contentDiv.textContent = `[${message.type.toUpperCase()}] ${message.speaker.alias || 'Unknown'}: ${message.content || 'No content'}`;
      rendered.appendChild(contentDiv);
    }
    const msgHtml = $(rendered);

    const tab = this._getMessageTab(message);
    if (tab && this.tabPanels[tab]) {
      this.tabPanels[tab].append(msgHtml);
      if (this._activeTab === tab) {
        this._scrollBottom(tab);
      }
      msgHtml.addClass('tabbed-whispers-highlight');
      setTimeout(() => msgHtml.removeClass('tabbed-whispers-highlight'), 2500);
    }
  }

  _getMessageTab(message) {
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

  _activateTab(tabName, $html) {
    $html.find('.tabchat-tab').removeClass('active');
    $html.find(`[data-tab="${tabName}"]`).addClass('active');
    $html.find('.tabchat-panel').removeClass('active');
    $html.find(`.tabchat-panel[data-tab="${tabName}"]`).addClass('active');
    this._activeTab = tabName;
    this._scrollBottom();
  }

  _scrollBottom(tabName = this._activeTab) {
    const ol = this.tabPanels[tabName];
    if (ol && ol.length) {
      ol.prop('scrollTop', ol[0].scrollHeight);
    }
  }

  _onCreateDocument(document, collection, options, userId) {
    super._onCreateDocument?.(document, collection, options, userId);
    this.renderMessage(document);
  }

  _onUpdateDocument(document, update, options, userId) {
    super._onUpdateDocument?.(document, update, options, userId);
    this.renderMessage(document);
  }

  _onDeleteDocument(document, collection, options, userId) {
    super._onDeleteDocument?.(document, collection, options, userId);
    const $html = $(this.element);
    ['ic', 'ooc', 'rolls', 'whisper'].forEach((tab) => {
      this.tabPanels[tab]?.find(`[data-message-id="${document.id}"]`).remove();
    });
  }
}

// Module Initialization
Hooks.once('init', () => {
  game.settings.register(MODULE_ID, 'proximityRange', {
    name: 'IC Proximity Range',
    hint: 'Max distance (units) for IC messages to appear (default: 30).',
    scope: 'world',
    config: true,
    default: 30,
    type: Number
  });
});

Hooks.once('ready', () => {
  if (ui.chat instanceof TabbedChatLog) return;
  const chatOptions = foundry.utils.deepClone(ui.chat?.options || {});
  ui.chat.close({ force: true }).catch((err) => console.warn(`${MODULE_ID}: Error closing chat:`, err));
  ui.chat = new TabbedChatLog(chatOptions);
  ui.chat.render(true).catch((err) => console.error(`${MODULE_ID}: Error rendering:`, err));
});
