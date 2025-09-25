// Tabbed Chat Module for Foundry VTT v13 - VISIBLE TABS VERSION
// 4-tab system: WORLD | OOC | GAME | MESSAGES

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  static tabPanels = {};
  static _activeTab = 'world';
  static _hasInjectedTabs = false;

  static init() {
    console.log(`${MODULE_ID} | VISIBLE TABS - Init called`);
  }

  static ready() {
    console.log(`${MODULE_ID} | VISIBLE TABS - Ready called`);
    
    // Multiple attempts to inject tabs
    setTimeout(() => TabbedChatManager.tryInjectTabs(), 1000);
    setTimeout(() => TabbedChatManager.tryInjectTabs(), 2000);
    setTimeout(() => TabbedChatManager.tryInjectTabs(), 3000);
  }

  static setupHooks() {
    console.log(`${MODULE_ID} | VISIBLE TABS - Setting up hooks`);
    
    // Try injection on every chat render
    Hooks.on('renderChatLog', () => {
      setTimeout(() => TabbedChatManager.tryInjectTabs(), 200);
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
    
    // Handle new messages
    Hooks.on('createChatMessage', (message) => {
      if (TabbedChatManager._hasInjectedTabs) {
        setTimeout(() => TabbedChatManager.renderMessage(message), 50);
      }
    });
  }

  static tryInjectTabs() {
    if (TabbedChatManager._hasInjectedTabs) {
      console.log(`${MODULE_ID}: Tabs already injected`);
      return;
    }

    if (!ui.chat?.element) {
      console.log(`${MODULE_ID}: Chat element not ready yet`);
      return;
    }

    console.log(`${MODULE_ID}: ATTEMPTING TAB INJECTION`);

    const $chat = $(ui.chat.element);
    const $originalOl = $chat.find('ol.chat-messages').first();
    
    if (!$originalOl.length) {
      console.error(`${MODULE_ID}: No original ol.chat-messages found`);
      console.log(`${MODULE_ID}: Available elements:`, $chat.find('ol').length);
      return;
    }

    console.log(`${MODULE_ID}: Found original chat messages, creating tabs`);

    // Hide original but don't remove
    $originalOl.css({
      'position': 'absolute',
      'top': '-9999px',
      'left': '-9999px',
      'visibility': 'hidden'
    });

    // Create bright, obvious tabs for testing
    const tabsHtml = `
      <div id="tabchat-container" style="
        height: 100%;
        display: block;
        background: red;
        border: 5px solid yellow;
        position: relative;
        z-index: 10000;
      ">
        <div id="tabchat-nav" style="
          height: 50px;
          display: block;
          background: blue;
          border-bottom: 3px solid white;
          position: relative;
        ">
          <button class="tabchat-btn active" data-tab="world" style="
            width: 25%;
            height: 50px;
            float: left;
            background: #215112;
            color: white;
            border: 2px solid white;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            display: block;
          ">WORLD</button>
          <button class="tabchat-btn" data-tab="ooc" style="
            width: 25%;
            height: 50px;
            float: left;
            background: #666;
            color: white;
            border: 2px solid white;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            display: block;
          ">OOC</button>
          <button class="tabchat-btn" data-tab="game" style="
            width: 25%;
            height: 50px;
            float: left;
            background: #666;
            color: white;
            border: 2px solid white;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            display: block;
          ">GAME</button>
          <button class="tabchat-btn" data-tab="messages" style="
            width: 25%;
            height: 50px;
            float: left;
            background: #666;
            color: white;
            border: 2px solid white;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            display: block;
          ">MESSAGES</button>
        </div>
        <div id="tabchat-panels" style="
          height: calc(100% - 50px);
          background: black;
          position: relative;
          overflow: hidden;
        ">
          <div class="tabchat-panel active" data-tab="world" style="
            height: 100%;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 10px;
            background: rgba(0,255,0,0.1);
            display: block;
          "></div>
          <div class="tabchat-panel" data-tab="ooc" style="
            height: 100%;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 10px;
            background: rgba(255,0,0,0.1);
            display: none;
          "></div>
          <div class="tabchat-panel" data-tab="game" style="
            height: 100%;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 10px;
            background: rgba(0,0,255,0.1);
            display: none;
          "></div>
          <div class="tabchat-panel" data-tab="messages" style="
            height: 100%;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 10px;
            background: rgba(255,255,0,0.1);
            display: none;
          "></div>
        </div>
      </div>
    `;

    // Try multiple insertion methods
    try {
      // Method 1: After original
      $originalOl.after(tabsHtml);
      console.log(`${MODULE_ID}: Method 1 - Inserted after original ol`);
    } catch (err) {
      try {
        // Method 2: Append to parent
        $originalOl.parent().append(tabsHtml);
        console.log(`${MODULE_ID}: Method 2 - Appended to parent`);
      } catch (err2) {
        try {
          // Method 3: Replace content
          $chat.find('.window-content').append(tabsHtml);
          console.log(`${MODULE_ID}: Method 3 - Appended to window-content`);
        } catch (err3) {
          console.error(`${MODULE_ID}: All insertion methods failed`, err, err2, err3);
          return;
        }
      }
    }

    // Verify injection worked
    const $container = $chat.find('#tabchat-container');
    if (!$container.length) {
      console.error(`${MODULE_ID}: Tab container not found after injection`);
      return;
    }

    console.log(`${MODULE_ID}: ✅ TAB CONTAINER CREATED - should be visible with colored borders`);

    // Cache panels
    TabbedChatManager.tabPanels = {
      world: $chat.find('.tabchat-panel[data-tab="world"]'),
      ooc: $chat.find('.tabchat-panel[data-tab="ooc"]'),
      game: $chat.find('.tabchat-panel[data-tab="game"]'),
      messages: $chat.find('.tabchat-panel[data-tab="messages"]')
    };

    // Verify panels
    ['world', 'ooc', 'game', 'messages'].forEach(tab => {
      const panel = TabbedChatManager.tabPanels[tab];
      console.log(`${MODULE_ID}: Panel ${tab} found: ${panel && panel.length > 0}`);
    });

    // Set up click handlers
    $chat.find('.tabchat-btn').off('click.tabchat').on('click.tabchat', function(event) {
      event.preventDefault();
      event.stopPropagation();
      
      const $btn = $(this);
      const tabName = $btn.data('tab');
      
      console.log(`${MODULE_ID}: ✅ TAB CLICKED: ${tabName}`);
      
      try {
        // Update button styles
        $chat.find('.tabchat-btn').removeClass('active').css({
          'background': '#666',
          'color': 'white'
        });
        
        $btn.addClass('active').css({
          'background': '#215112',
          'color': 'white'
        });
        
        // Update panels
        $chat.find('.tabchat-panel').removeClass('active').css('display', 'none');
        $chat.find(`.tabchat-panel[data-tab="${tabName}"]`).addClass('active').css('display', 'block');
        
        TabbedChatManager._activeTab = tabName;
        
        // Auto-scroll
        const panel = TabbedChatManager.tabPanels[tabName];
        if (panel && panel[0]) {
          setTimeout(() => {
            panel[0].scrollTop = panel[0].scrollHeight;
          }, 50);
        }
        
        console.log(`${MODULE_ID}: ✅ Switched to ${tabName} tab`);
        
      } catch (err) {
        console.error(`${MODULE_ID}: Error in tab click handler:`, err);
      }
    });

    TabbedChatManager._hasInjectedTabs = true;
    console.log(`${MODULE_ID}: ✅ TABS FULLY INJECTED AND READY`);

    // Load existing messages
    setTimeout(() => {
      const messages = game.messages.contents.sort((a, b) => a.timestamp - b.timestamp);
      console.log(`${MODULE_ID}: Loading ${messages.length} existing messages`);
      for (const message of messages) {
        TabbedChatManager.renderMessage(message);
      }
      console.log(`${MODULE_ID}: ✅ Existing messages loaded`);
    }, 500);
  }

  static async renderMessage(message) {
    if (!TabbedChatManager._hasInjectedTabs || !message) return;

    const tab = TabbedChatManager.getMessageTab(message);
    const panel = TabbedChatManager.tabPanels[tab];
    
    if (!panel || !panel.length) {
      console.warn(`${MODULE_ID}: No panel for tab ${tab}`);
      return;
    }

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

    // Add to panel
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
      // GAME: rolls
      if (message.isRoll || message.rolls?.length > 0) return 'game';
      
      // MESSAGES: whispers
      if (message.whisper?.length > 0) return 'messages';
      
      // OOC: /b command or no token
      if (message._tabchatOOC || (message.content && message.content.includes('[OOC]'))) return 'ooc';
      
      // WORLD: has token
      if (message.speaker?.token) return 'world';
      
      // Default: OOC
      return 'ooc';
    } catch (err) {
      return 'ooc';
    }
  }
}

// Initialize
Hooks.once('init', TabbedChatManager.init);
Hooks.once('ready', TabbedChatManager.ready);
TabbedChatManager.setupHooks();
