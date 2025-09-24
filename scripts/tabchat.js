// Tabbed Chat Module for Foundry VTT v13
// Inspired by fvtt-tabbed-whispers and proximity-text-chat

class TabbedChatLog extends foundry.applications.sidebar.tabs.ChatLog {
  constructor(options = {}) {
    super(options);
    this._activeTab = 'ic';
    this.tabPanels = {};
  }

  /**
   * Override to inject tab structure after base render.
   */
  async _renderInner(data) {
    const html = await super._renderInner(data);

    // Replace the default <ol class="chat-messages"> with tabbed structure
    const defaultOl = html.find('ol.chat-messages');
    if (!defaultOl.length) {
      console.warn('TabbedChatLog: No chat-messages OL found in rendered HTML');
      return html; // Fallback to prevent breaking
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

    // Cache tab OL elements after render
    this.element = html; // Ensure this.element is set for tab binding
    ['ic', 'ooc', 'rolls', 'whisper'].forEach((tab) => {
      this.tabPanels[tab] = html.find(`.tabchat-panel[data-tab="${tab}"] ol.chat-messages`);
    });

    // Bind tab clicks
    html.find('.tabchat-tab').on('click', (event) => this._activateTab(event.currentTarget.dataset.tab));

    // Render existing messages into tabs
    const messages = this.collection.sort((a, b) => a.id.localeCompare(b.id));
    for (const message of messages) {
      await this.renderMessage(message);
    }

    // Initial scroll
    this._scrollBottom();
    return html;
  }

  /**
   * Render a message into the appropriate tab.
   */
  async renderMessage(message, options = {}) {
    const html = await message.render();
    const tab = this._getMessageTab(message);
    if (tab && this.tabPanels[tab]) {
      this.tabPanels[tab].append(html);
      if (this._activeTab === tab) {
        this._scrollBottom(tab);
      }
    }
  }

  /**
   * Determine which tab a message belongs to.
   */
  _getMessageTab(message) {
    // Rolls tab
    if (message.isRoll) return 'rolls';

    // Whispers tab
    if (message.whisper?.length > 0) return 'whisper';

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
      const range = game.settings.get('tabchat', 'proximityRange') || 30;
      if (distance <= range) return 'ic';
    }

    // Default to OOC (no token, far away, etc.)
    return 'ooc';
  }

  /**
   * Override to handle updates by replacing HTML in the tab.
   */
  updateMessage(message, html, options = {}) {
    const tab = this._getMessageTab(message);
    if (tab && this.tabPanels[tab]) {
      const existing = this.tabPanels[tab].find(`[data-message-id="${message.id}"]`);
      if (existing.length) {
        existing.replaceWith(html);
        if (this._activeTab === tab) {
          this._scrollBottom(tab);
        }
      }
    }
  }

  /**
   * Override to remove from the tab.
   */
  deleteMessage(messageId) {
    ['ic', 'ooc', 'rolls', 'whisper'].forEach((tab) => {
      this.tabPanels[tab]?.find(`[data-message-id="${messageId}"]`).remove();
    });
  }

  /**
   * Switch to a tab.
   */
  _activateTab(tabName) {
    this.element.find('.tabchat-tab').removeClass('active');
    this.element.find(`[data-tab="${tabName}"]`).addClass('active');
    this.element.find('.tabchat-panel').removeClass('active');
    this.element.find(`.tabchat-panel[data-tab="${tabName}"]`).addClass('active');
    this._activeTab = tabName;
    this._scrollBottom();
  }

  /**
   * Scroll the active tab (or specified) to bottom.
   */
  _scrollBottom(tabName = this._activeTab) {
    const ol = this.tabPanels[tabName];
    if (ol?.length) {
      ol.prop('scrollTop', ol[0].scrollHeight);
    }
  }

  /**
   * Override collection create hook.
   */
  _onCreateDocument(document, collection, options, userId) {
    super._onCreateDocument?.(document, collection, options, userId);
    this.renderMessage(document, options);
  }

  /**
   * Override collection update hook.
   */
  _onUpdateDocument(document, update, options, userId) {
    super._onUpdateDocument?.(document, update, options, userId);
    this.updateMessage(document, document.render(), options);
  }

  /**
   * Override collection delete hook.
   */
  _onDeleteDocument(document, collection, options, userId) {
    super._onDeleteDocument?.(document, collection, options, userId);
    this.deleteMessage(document.id);
  }
}

// Module Initialization
Hooks.once('init', () => {
  // Register proximity setting
  game.settings.register('tabchat', 'proximityRange', {
    name: 'IC Proximity Range',
    hint: 'Max distance (units) for IC messages to appear (default: 30).',
    scope: 'world',
    config: true,
    default: 30,
    type: Number
  });
});

Hooks.once('ready', () => {
  // Replace core ChatLog with tabbed version
  if (ui.chat instanceof TabbedChatLog) {
    console.log('TabbedChatLog: Already initialized, skipping.');
    return;
  }
  console.log('TabbedChatLog: Initializing chat replacement...');
  const chatOptions = foundry.utils.deepClone(ui.chat?.options || {});
  ui.chat.close({ force: true }).catch((err) => console.warn('TabbedChatLog: Error closing core chat:', err));
  ui.chat = new TabbedChatLog(chatOptions);
  ui.chat.render(true).catch((err) => console.error('TabbedChatLog: Error rendering:', err));
});
