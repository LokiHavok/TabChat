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
      TabbedChatManager.renderMessage(message,
