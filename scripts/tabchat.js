// Tabbed Chat Module for Foundry VTT v13 - CLEAN WORKING VERSION
// 4-tab system: WORLD | OOC | GAME | MESSAGES

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  static tabPanels = {};
  static _activeTab = 'world';
  static _hasInjectedTabs = false;

  static init() {
    console.log(`${MODULE_ID} | CLEAN WORKING - Init called`);
  }

  static ready() {
    console.log(`${MODULE_ID} | CLEAN WORKING - Ready called`);
    
    // Multiple attempts to inject
    setTimeout(() => TabbedChatManager.tryInject(), 1000);
    setTimeout(() => TabbedChatManager.tryInject(), 2000);
    setTimeout(() => TabbedChatManager.tryInject(), 3000);
  }

  static setupHooks() {
    console.log(`${MODULE_ID} | CLEAN WORKING - Setting up hooks`);
    
    // Try injection on chat render
    Hooks.on('renderChatLog', () => {
      setTimeout(() => TabbedChatManager.tryInject(), 200);
    });
    
    // Handle /b commands
    Hooks.on('chatMessage', (chatlog, messageText, chatData) => {
      if (messageText.startsWith('/b ')) {
        const content = '[OOC] ' + messageText.substring(3);
        ChatMessage.create({
          content: content,
          style: CONST.CHAT_MESSAGE_STYLES.OTHER,
          speaker: ChatMessage.getSpeaker(),
          _tabchatOOC: true
        });
        return false;
      }
      return true;
    });
    
    // Handle new messages - simplified to prevent lockups
    Hooks.on('createChatMessage', (message) => {
      if (!TabbedChatManager._hasInjectedTabs) return;
      
      console.log(`${MODULE_ID}: Processing new message ${message.id}`);
      
      // Simple timeout without blocking flags
      setTimeout(() => {
        try {
          TabbedChatManager.renderMessage(message);
        } catch (err) {
          console.error(`${MODULE_ID}: Error rendering message:`, err);
        }
      }, 50);
    });
  }

  static tryInject() {
    if (TabbedChatManager._hasInjectedTabs || !ui.chat?.element) return;

    console.log(`${MODULE_ID}: Attempting clean injection`);
    const $chat = $(ui.chat.element);

    // Find any suitable chat container
    const possibleSelectors = [
      'ol.chat-messages',
      'ol',
      '.chat-messages',
      '.window-content ol'
    ];

    let $targetElement = null;
    for (const selector of possibleSelectors) {
      const $found = $chat.find(selector);
      if ($found.length > 0) {
        $targetElement = $found.first();
        break;
      }
    }

    if (!$targetElement || !$targetElement.length) {
      console.warn(`${MODULE_ID}: No target found, using window-content`);
      $targetElement = $chat.find('.window-content');
      if (!$targetElement.length) return;
    }

    // Hide original
    $targetElement.css({
      'position': 'absolute',
      'top': '-9999px',
      'visibility': 'hidden'
    });

    // Create clean tabs with v11 styling
    const cleanTabsHtml = `
      <div class="tabchat-container" style="
        height: 100%;
        display: flex;
        flex-direction: column;
        background: transparent;
        position: relative;
        z-index: 100;
      ">
        <nav class="tabchat-nav" style="
          display: flex;
          flex-direction: row;
          flex-shrink: 0;
          background: #1a1a1a;
          border-bottom: 2px solid #215112;
          height: 40px;
          margin: 0;
          padding: 0;
        ">
          <div class="tabchat-tab active" data-tab="world" style="
            order: 1;
            flex: 1;
            padding: 12px 8px;
            cursor: pointer;
            background: #215112;
            color: #fff;
            border-right: 1px solid #444;
            font-weight: bold;
            font-size: 11px;
            text-transform: uppercase;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
          ">WORLD</div>
          <div class="tabchat-tab" data-tab="ooc" style="
            order: 2;
            flex: 1;
            padding: 12px 8px;
            cursor: pointer;
            background: #2a2a2a;
            color: #999;
            border-right: 1px solid #444;
            font-weight: bold;
            font-size: 11px;
            text-transform: uppercase;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
          ">OOC</div>
          <div class="tabchat-tab" data-tab="game" style="
            order: 3;
            flex: 1;
            padding: 12px 8px;
            cursor: pointer;
            background: #2a2a2a;
            color: #999;
            border-right: 1px solid #444;
            font-weight: bold;
            font-size: 11px;
            text-transform: uppercase;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
          ">GAME</div>
          <div class="tabchat-tab" data-tab="messages" style="
            order: 4;
            flex: 1;
            padding: 12px 8px;
            cursor: pointer;
            background: #2a2a2a;
            color: #999;
            font-weight: bold;
            font-size: 11px;
            text-transform: uppercase;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
          ">MESSAGES</div>
        </nav>
        <section class="tabchat-panel active" data-tab="world" style="
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: rgba(0,0,0,0.05);
        ">
          <div class="chat-messages" style="
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 8px;
            margin: 0;
            background: transparent;
          "></div>
        </section>
        <section class="tabchat-panel" data-tab="ooc" style="
          flex: 1;
          display: none;
          flex-direction: column;
          overflow: hidden;
          background: rgba(0,0,0,0.05);
        ">
          <div class="chat-messages" style="
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 8px;
            margin: 0;
            background: transparent;
          "></div>
        </section>
        <section class="tabchat-panel" data-tab="game" style="
          flex: 1;
          display: none;
          flex-direction: column;
          overflow: hidden;
          background: rgba(0,0,0,0.05);
        ">
          <div class="chat-messages" style="
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 8px;
            margin: 0;
            background: transparent;
          "></div>
        </section>
        <section class="tabchat-panel" data-tab="messages" style="
          flex: 1;
          display: none;
          flex-direction: column;
          overflow: hidden;
          background: rgba(0,0,0,0.05);
        ">
          <div class="chat-messages" style="
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 8px;
            margin: 0;
            background: transparent;
          "></div>
        </section>
      </div>
    `;

    // Insert tabs
    try {
      $targetElement.after(cleanTabsHtml);
      console.log(`${MODULE_ID}: Clean tabs inserted`);
    } catch (err) {
      $targetElement.parent().append(cleanTabsHtml);
      console.log(`${MODULE_ID}: Clean tabs appended to parent`);
    }

    // Cache panels
    TabbedChatManager.tabPanels = {
      world: $chat.find('.tabchat-panel[data-tab="world"] .chat-messages'),
      ooc: $chat.find('.tabchat-panel[data-tab="ooc"] .chat-messages'),
      game: $chat.find('.tabchat-panel[data-tab="game"] .chat-messages'),
      messages: $chat.find('.tabchat-panel[data-tab="messages"] .chat-messages')
    };

    // Set up click handlers - simplified to prevent lockups
    $chat.off('click.tabchat').on('click.tabchat', '.tabchat-tab', function(event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      
      const $clickedTab = $(this);
      const tabName = $clickedTab.data('tab');
      
      // Prevent rapid clicking with simple check
      if ($clickedTab.hasClass('clicking')) {
        console.log(`${MODULE_ID}: Ignoring rapid click`);
        return;
      }
      
      $clickedTab.addClass('clicking');
      setTimeout(() => $clickedTab.removeClass('clicking'), 200);
      
      console.log(`${MODULE_ID}: Clean tab clicked: ${tabName}`);
      
      try {
        // Simple, direct DOM updates
        $chat.find('.tabchat-tab').removeClass('active').css({
          'background': '#2a2a2a',
          'color': '#999'
        });
        
        $clickedTab.addClass('active').css({
          'background': '#215112',
          'color': '#fff'
        });
        
        // Update panels
        $chat.find('.tabchat-panel').removeClass('active').css('display', 'none');
        $chat.find(`.tabchat-panel[data-tab="${tabName}"]`).addClass('active').css('display', 'flex');
        
        TabbedChatManager._activeTab = tabName;
        
        // Auto-scroll
        const panel = TabbedChatManager.tabPanels[tabName];
        if (panel && panel[0]) {
          setTimeout(() => {
            panel[0].scrollTop = panel[0].scrollHeight;
          }, 50);
        }
        
        console.log(`${MODULE_ID}: Successfully switched to ${tabName}`);
        
      } catch (err) {
        console.error(`${MODULE_ID}: Error in click handler:`, err);
        $clickedTab.removeClass('clicking');
      }
    });

    TabbedChatManager._hasInjectedTabs = true;
    console.log(`${MODULE_ID}: ✅ Clean tabs setup complete`);

    // Load existing messages
    setTimeout(() => {
      const messages = game.messages.contents.sort((a, b) => a.timestamp - b.timestamp);
      console.log(`${MODULE_ID}: Loading ${messages.length} existing messages`);
      for (const message of messages) {
        TabbedChatManager.renderMessage(message);
      }
    }, 300);
  }

  static async renderMessage(message) {
    if (!TabbedChatManager._hasInjectedTabs || !message) return;

    const tab = TabbedChatManager.getMessageTab(message);
    const panel = TabbedChatManager.tabPanels[tab];
    
    if (!panel || !panel.length) return;

    let rendered;
    try {
      rendered = await message.renderHTML();
      if (!rendered) return;
    } catch (e) {
      console.error(`${MODULE_ID}: Error rendering message`, e);
      return;
    }

    const $msgHtml = $(rendered);
    
    // For WORLD tab, replace token name with actor name
    if (tab === 'world' && message.speaker?.token) {
      const tokenDoc = canvas?.scene?.tokens?.get(message.speaker.token);
      if (tokenDoc?.actor && tokenDoc.actor.name !== tokenDoc.name) {
        const actorName = tokenDoc.actor.name;
        const tokenName = tokenDoc.name;
        
        $msgHtml.find('*').each(function() {
          if ($(this).text().includes(tokenName)) {
            $(this).html($(this).html().replace(new RegExp(tokenName, 'g'), actorName));
          }
        });
      }
    }

    // Add highlight effect
    $msgHtml.addClass('tabchat-highlight');
    setTimeout(() => $msgHtml.removeClass('tabchat-highlight'), 2000);

    panel.append($msgHtml);

    // Auto-scroll if active tab
    if (TabbedChatManager._activeTab === tab && panel[0]) {
      setTimeout(() => {
        panel[0].scrollTop = panel[0].scrollHeight;
      }, 50);
    }

    console.log(`${MODULE_ID}: Added message to ${tab} tab`);
  }

  static getMessageTab(message) {
    try {
      if (message.isRoll || message.rolls?.length > 0) return 'game';
      if (message.whisper?.length > 0) return 'messages';
      if (message._tabchatOOC || (message.content && message.content.includes('[OOC]'))) return 'ooc';
      if (message.speaker?.token) return 'world';
      return 'ooc';
    } catch (err) {
      return 'ooc';
    }
  }
}

// Add highlight CSS
const highlightCSS = `
  <style id="tabchat-highlight-css">
    .tabchat-highlight {
      animation: tabchat-glow 2s ease-out;
    }
    @keyframes tabchat-glow {
      0% { 
        background-color: rgba(33, 81, 18, 0.4);
        box-shadow: 0 0 8px rgba(33, 81, 18, 0.6);
      }
      100% { 
        background-color: transparent;
        box-shadow: none;
      }
    }
  </style>
`;

// Initialize
Hooks.once('init', TabbedChatManager.init);
Hooks.once('ready', () => {
  $('head').append(highlightCSS);
  TabbedChatManager.ready();
});
TabbedChatManager.setupHooks();
