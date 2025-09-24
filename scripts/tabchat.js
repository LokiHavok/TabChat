// Tabbed Chat Module for Foundry VTT v13
// Inspired by fvtt-tabbed-whispers and proximity-text-chat

class TabbedChatLog extends ChatLog {
  constructor(options = {}) {
    super(options);
    this._activeTab = 'ic';
    this.tabPanels = {};
  }

  /**
   * Override to inject tab structure after base render.
   */
  async _renderInner(data) {
    await super._renderInner(data);

    // Replace the default <ol class="chat-messages"> with tabbed structure
    const defaultOl = this.element.find('ol.chat-messages');
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
      this.tabPanels[tab] = this.element.find(`.tabchat-panel[data-tab="${tab}"] ol.chat-messages`);
    });

    // Bind tab clicks
    this.element.find('.tabchat-tab').on('click', (event) => this._activateTab(event.currentTarget.dataset.tab));

    // Render existing messages into tabs
    const messages = this.collection.sort((a, b) => a.id.localeCompare(b.id));
    for (const message of messages) {
      await this.renderMessage(message);
    }

    // Initial scroll
    this._scrollBottom();
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
    if (message.whisper && message.whisper.length > 0) return 'whisper';

    // IC/OOC logic
    const speaker = message.speaker;
    if (speaker?.token) {
      const sceneId = speaker.scene;
      if (sceneId !== canvas?.scene?.id) return 'ooc'; // Not current scene -> OOC (global)

      const tokenDoc = canvas?.scene?.tokens?.get(speaker.token);
      if (!tokenDoc) return 'ooc';

      const controlledTokens = canvas?.tokens?.controlled;
      if (controlledTokens.length === 0) return 'ic'; // No controlled token -> full IC visibility

      // Proximity check (using first controlled token)
      const controlled = controlledTokens[0];
      const distance = canvas.dimensions.distanceBetween(tokenDoc.center, controlled.center);
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
    $(`[data-tab="${tabName}"]`, this.element).addClass('active');
    this.element.find('.tabchat-panel').removeClass('active');
    $(`.tabchat-panel[data-tab="${tabName}"]`, this.element).addClass('active');
    this._activeTab = tabName;
    this._scrollBottom();
  }

  /**
   * Scroll the active tab (or specified) to bottom.
   */
  _scrollBottom(tabName = this._activeTab) {
    const ol = this.tabPanels[tabName];
    if (ol && ol.length) {
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

  // Optional: Register OOC prefix detection if you want manual overrides (e.g., "/ooc message")
  // Extend _getMessageTab to check if content.startsWith('/ooc ') -> return 'ooc'
});

Hooks.once('ready', () => {
  // Replace core ChatLog with tabbed version
  if (ui.chat instanceof TabbedChatLog) return;
  const chatOptions = foundry.utils.deepClone(ui.chat.options || {});
  ui.chat.close({ force: true });
  ui.chat = new TabbedChatLog(chatOptions);
  ui.chat.render(true);
  ui.sidebar._tabs[3] = ui.chat; // Ensure sidebar tab reference updates (index for chat)
});
