// Tabbed Chat Module for Foundry VTT v13 - BASIC WORKING VERSION
// 4-tab system: WORLD | OOC | GAME | MESSAGES

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  static tabPanels = {};
  static _activeTab = 'world';
  static _hasInjectedTabs = false;

  static init() {
    console.log(`${MODULE_ID} | BASIC VERSION - Init called`);
  }

  static ready() {
    console.log(`${MODULE_ID} | BASIC VERSION - Ready called`);
    
    // Simple delayed injection
    setTimeout(() => {
      if (ui.chat?.element && !TabbedChatManager._hasInjectedTabs) {
        TabbedChatManager.injectTabs();
      }
    }, 2000);
  }

  static setupHooks() {
    console.log(`${MODULE_ID} | BASIC VERSION - Setting up hooks`);
    
    // Simple hook for chat rendering
    Hooks.on('renderChatLog', () => {
      if (!TabbedChatManager._hasInjectedTabs) {
        setTimeout(() => TabbedChatManager.injectTabs(), 100);
      }
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

  static injectTabs() {
    if (TabbedChatManager._hasInjectedTabs || !ui.chat?.element) {
      return;
    }

    console.log(`${MODULE_ID}: BASIC VERSION - Injecting tabs`);

    const $chat = $(ui.chat.element);
    const $originalOl = $chat.find('ol.chat-messages').first();
    
    if (!$originalOl.length) {
      console.error(`${MODULE_ID}: No original chat messages found`);
      return;
    }

    // Hide original
    $originalOl.hide();

    // Create very simple tab structure
    const tabsHtml = `
      <div id="tabchat-simple" style="height: 100%; display: flex; flex-direction: column;">
        <div id="tabchat-buttons" style="display: flex; background: #222; border-bottom: 2px solid #215112; height: 40px;">
          <button class="tabchat-btn tabchat-active" data-tab="world" style="flex: 1; background: #215112; color: white; border: none; cursor: pointer; font-size: 11px; font-weight: bold;">WORLD</button>
          <button class="tabchat-btn" data-tab="ooc" style="flex: 1; background: #333; color: #ccc; border: none; cursor: pointer; font-size: 11px; font-weight: bold;">OOC</button>
          <button class="tabchat-btn" data-tab="game" style="flex: 1; background: #333; color: #ccc; border: none; cursor: pointer; font-size: 11px; font-weight: bold;">GAME</button>
          <button class="tabchat-btn" data-tab="messages" style="flex: 1; background: #333; color: #ccc; border: none; cursor: pointer; font-size: 11px; font-weight: bold;">MESSAGES</button>
        </div>
        <div id="tabchat-content" style="flex: 1; overflow: hidden; position: relative;">
          <div class="tabchat-tab-content tabchat-content-active" data-tab="world" style="height: 100%; overflow-y: auto; overflow-x: hidden; padding: 5px; display: block;"></div>
          <div class="tabchat-tab-content" data-tab="ooc" style="height: 100%; overflow-y: auto; overflow-x: hidden; padding: 5px; display: none;"></div>
          <div class="tabchat-tab-content" data-tab="game" style="height: 100%; overflow-y: auto; overflow-x: hidden; padding: 5px; display: none;"></div>
          <div class="tabchat-tab-content" data-tab="messages" style="height: 100%; overflow-y: auto; overflow-x: hidden; padding: 5px; display: none;"></div>
        </div>
      </div>
    `;

    // Insert after original
    $originalOl.after(tabsHtml);

    // Cache panels
    TabbedChatManager.tabPanels = {
      world: $chat.find('.tabchat-tab-content[data-tab="world"]'),
      ooc: $chat.find('.tabchat-tab-content[data-tab="ooc"]'),
      game: $chat.find('.tabchat-tab-content[data-tab="game"]'),
      messages: $chat.find('.tabchat-tab-content[data-tab="messages"]')
    };

    // Simple click handlers
    $chat.find('.tabchat-btn').on('click', function() {
      const tabName = $(this).data('tab');
      console.log(`${MODULE_ID}: Switching to ${tabName}`);
      
      // Update buttons
      $chat.find('.tabchat-btn').removeClass('tabchat-active').css({
        'background': '#333',
        'color': '#ccc'
      });
      $(this).addClass('tabchat-active').css({
        'background': '#215112',
        'color': 'white'
      });
      
      // Update content
      $chat.find('.tabchat-tab-content').removeClass('tabchat-content-active').hide();
      $chat.find(`.tabchat-tab-content[data-tab="${tabName}"]`).addClass('tabchat-content-active').show();
      
      TabbedChatManager._activeTab = tabName;
      
      // Scroll to bottom
      const panel = TabbedChatManager.tabPanels[tabName];
      if (panel && panel[0]) {
        panel[0].scrollTop = panel[0].scrollHeight;
      }
    });

    TabbedChatManager._hasInjectedTabs = true;
    console.log(`${MODULE_ID}: ✅ Basic tabs injected successfully`);

    // Load existing messages
    setTimeout(() => {
      const messages = game.messages.contents.sort((a, b) => a.timestamp - b.timestamp);
      console.log(`${MODULE_ID}: Loading ${messages.length} existing messages`);
      for (const message of messages) {
        TabbedChatManager.renderMessage(message);
      }
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
      panel[0].scrollTop = panel[0].scrollHeight;
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
