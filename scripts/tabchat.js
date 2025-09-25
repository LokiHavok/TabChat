// Tabbed Chat Module for Foundry VTT v13 - Concise Scene Instanced Version
// Four tabs: WORLD | OOC | GAME | MESSAGES with scene instancing

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  static tabPanels = {};
  static sceneMessages = {};
  static globalOOCMessages = [];
  static _activeTab = 'ic';
  static _currentScene = null;
  static _chatInjected = false;

  static init() {
    console.log(`${MODULE_ID} | Concise version loading`);
    TabbedChatManager._currentScene = canvas?.scene?.id || 'default';
    TabbedChatManager._initializeSceneMessages(TabbedChatManager._currentScene);
  }

  static ready() {
    console.log(`${MODULE_ID} | Ready - attempting injection`);
    // Multiple injection attempts
    [500, 1500, 3000].forEach(delay => {
      setTimeout(() => TabbedChatManager._tryInjectTabs(), delay);
    });
  }

  static _tryInjectTabs() {
    if (!ui.chat?.element || TabbedChatManager._chatInjected) return;
    
    const $html = $(ui.chat.element);
    if ($html.find('.tabchat-container').length > 0) {
      TabbedChatManager._chatInjected = true;
      TabbedChatManager._loadExistingMessages($html);
      return;
    }

    console.log(`${MODULE_ID}: Injecting tabs...`);
    if (TabbedChatManager._injectTabs($html)) {
      TabbedChatManager._chatInjected = true;
      setTimeout(() => TabbedChatManager._loadExistingMessages($html), 500);
    }
  }

  static _injectTabs($html) {
    // Find and hide original chat container
    const selectors = ['ol#chat-log', 'ol.chat-messages', '.chat-messages-container ol', 'ol'];
    let chatContainer = null;
    
    for (const selector of selectors) {
      const found = $html.find(selector);
      if (found.length > 0) {
        chatContainer = found.first();
        break;
      }
    }
    
    if (!chatContainer) {
      console.warn(`${MODULE_ID}: No chat container found`);
      return false;
    }

    chatContainer.css({
      'display': 'none !important',
      'position': 'absolute',
      'visibility': 'hidden'
    });

    // Create tabbed interface - FIXED ORDER AND CLICKABILITY
    const tabsHTML = `
      <div class="tabchat-container">
        <nav class="tabchat-nav">
          <a class="tabchat-tab active" data-tab="ic" style="order: 7;">WORLD</a>
          <div class="tabchat-separator" style="order: 6;"></div>
          <a class="tabchat-tab" data-tab="ooc" style="order: 5;">OOC</a>
          <div class="tabchat-separator" style="order: 4;"></div>
          <a class="tabchat-tab" data-tab="rolls" style="order: 3;">GAME</a>
          <div class="tabchat-separator" style="order: 2;"></div>
          <a class="tabchat-tab" data-tab="messages" style="order: 1;">MESSAGES</a>
        </nav>
        <section class="tabchat-panel active" data-tab="ic">
          <ol class="chat-messages"></ol>
        </section>
        <section class="tabchat-panel" data-tab="ooc">
          <ol class="chat-messages"></ol>
        </section>
        <section class="tabchat-panel" data-tab="rolls">
          <ol class="chat-messages"></ol>
        </section>
        <section class="tabchat-panel" data-tab="messages">
          <ol class="chat-messages"></ol>
        </section>
      </div>
      <style>
        .tabchat-container {
          height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          z-index: 9999 !important;
        }
        .tabchat-nav {
          display: flex !important;
          align-items: center !important;
          background: rgba(0, 0, 0, 0.8) !important;
          border-bottom: 2px solid #444 !important;
          flex-shrink: 0 !important;
          z-index: 10000 !important;
          position: relative !important;
        }
        .tabchat-tab {
          flex: 1 !important;
          padding: 16px 8px !important;
          text-align: center !important;
          background: rgba(0, 0, 0, 0.5) !important;
          color: #ccc !important;
          font-size: 18px !important;
          font-weight: bold !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          user-select: none !important;
          pointer-events: auto !important;
          position: relative !important;
        }
        .tabchat-tab:hover {
          background: rgba(255, 255, 255, 0.1) !important;
          color: #fff !important;
        }
        .tabchat-tab.active {
          background: rgba(255, 255, 255, 0.15) !important;
          color: #fff !important;
          border-bottom: 3px solid #4CAF50 !important;
        }
        .tabchat-separator {
          width: 2px !important;
          height: 50px !important;
          background: #666 !important;
          flex-shrink: 0 !important;
        }
        .tabchat-panel {
          display: none !important;
          flex: 1 !important;
          overflow: hidden !important;
        }
        .tabchat-panel.active {
          display: flex !important;
          flex-direction: column !important;
        }
        .tabchat-panel ol.chat-messages {
          flex: 1 !important;
          overflow-y: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          list-style: none !important;
        }
      </style>
    `;

    chatContainer.after(tabsHTML);

    // Cache panels and add handlers with debugging
    ['ic', 'ooc', 'rolls', 'messages'].forEach(tab => {
      TabbedChatManager.tabPanels[tab] = $html.find(`.tabchat-panel[data-tab="${tab}"] ol.chat-messages`);
      console.log(`${MODULE_ID}: Cached panel ${tab}:`, TabbedChatManager.tabPanels[tab].length > 0);
    });

    // Add click handlers with debugging
    $html.find('.tabchat-tab').off('click.tabchat').on('click.tabchat', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const tabName = e.currentTarget.dataset.tab;
      console.log(`${MODULE_ID}: Tab clicked: ${tabName}`);
      TabbedChatManager._activateTab(tabName, $html);
    });
    
    console.log(`${MODULE_ID}: Added click handlers to ${$html.find('.tabchat-tab').length} tabs`);

    console.log(`${MODULE_ID}: ✅ Tabs injected successfully`);
    return true;
  }

  static _loadExistingMessages($html) {
    const messages = game.messages.contents.sort((a, b) => a.id.localeCompare(b.id));
    console.log(`${MODULE_ID}: Loading ${messages.length} messages`);
    
    messages.forEach(message => TabbedChatManager.renderMessage(message, $html));
    TabbedChatManager._switchToScene(TabbedChatManager._currentScene, $html);
  }

  static _initializeSceneMessages(sceneId) {
    if (!TabbedChatManager.sceneMessages[sceneId]) {
      TabbedChatManager.sceneMessages[sceneId] = {
        ic: [], ooc: [], rolls: []
      };
    }
  }

  static _switchToScene(sceneId, $html) {
    if (!TabbedChatManager._chatInjected) return;
    
    TabbedChatManager._initializeSceneMessages(sceneId);
    
    // Clear scene-specific tabs
    ['ic', 'ooc', 'rolls'].forEach(tab => {
      if (TabbedChatManager.tabPanels[tab]) {
        TabbedChatManager.tabPanels[tab].empty();
      }
    });
    
    // Restore scene messages
    ['ic', 'ooc', 'rolls'].forEach(tab => {
      const messages = TabbedChatManager.sceneMessages[sceneId][tab] || [];
      messages.forEach(msgHtml => {
        if (TabbedChatManager.tabPanels[tab]) {
          TabbedChatManager.tabPanels[tab].append(msgHtml.clone());
        }
      });
    });
    
    // Add global OOC messages
    TabbedChatManager.globalOOCMessages.forEach(msgHtml => {
      if (TabbedChatManager.tabPanels.ooc) {
        TabbedChatManager.tabPanels.ooc.append(msgHtml.clone());
      }
    });
    
    setTimeout(() => TabbedChatManager._scrollToBottom($html), 100);
  }

  static async renderMessage(message, $html) {
    if (!TabbedChatManager._chatInjected) return;

    let rendered;
    try {
      rendered = await message.renderHTML();
    } catch (e) {
      console.error(`${MODULE_ID}: Render error`, e);
      return;
    }

    const msgHtml = $(rendered);
    const tab = TabbedChatManager._getMessageTab(message);
    const currentScene = canvas?.scene?.id || 'default';
    const messageScene = message.speaker?.scene || currentScene;
    const currentUserId = game.user.id;
    const messageAuthor = message.author?.id || message.author;
    
    if (!TabbedChatManager._shouldRenderMessage(message, tab, currentScene, currentUserId, messageAuthor)) {
      return;
    }
    
    if (tab && TabbedChatManager.tabPanels[tab]?.length) {
      TabbedChatManager.tabPanels[tab].append(msgHtml);
      TabbedChatManager._storeMessage(message, msgHtml, tab, messageScene);
      
      if (TabbedChatManager._activeTab === tab) {
        setTimeout(() => TabbedChatManager._scrollToBottom($html), 50);
      }
    }
  }

  static _getMessageTab(message) {
    // Global OOC
    if (message._tabchat_globalOOC || message.content?.match(/^\/g(ooc)? /)) {
      return 'ooc';
    }
    
    // /b command
    if (message._tabchat_forceOOC || message.content?.startsWith('/b ')) {
      return 'ooc';
    }
    
    // Rolls
    if (message.isRoll || message.type === 'roll') return 'rolls';
    
    // Whispers
    if (message.whisper?.length > 0) return 'messages';
    
    // Token speaker = WORLD, otherwise OOC
    return message.speaker?.token ? 'ic' : 'ooc';
  }

  static _shouldRenderMessage(message, tab, currentScene, currentUserId, messageAuthor) {
    const messageScene = message.speaker?.scene || currentScene;
    
    if (tab === 'messages') {
      // Whispers: GMs see all, players see their own
      if (game.user.isGM) return true;
      const whisperTargets = message.whisper || [];
      return messageAuthor === currentUserId || whisperTargets.includes(currentUserId);
    }
    
    if (tab === 'ic' || tab === 'ooc' || tab === 'rolls') {
      // Global OOC visible to all
      if (message._tabchat_globalOOC) return true;
      
      // Scene-specific: same scene OR author
      return messageScene === currentScene || messageAuthor === currentUserId;
    }
    
    return true;
  }

  static _storeMessage(message, msgHtml, tab, messageScene) {
    if (tab === 'messages') return; // Global whispers
    
    if (message._tabchat_globalOOC) {
      TabbedChatManager.globalOOCMessages.push(msgHtml.clone());
    } else {
      TabbedChatManager._initializeSceneMessages(messageScene);
      TabbedChatManager.sceneMessages[messageScene][tab].push(msgHtml.clone());
    }
  }

  static _activateTab(tabName, $html) {
    $html.find('.tabchat-tab').removeClass('active');
    $html.find(`.tabchat-tab[data-tab="${tabName}"]`).addClass('active');
    $html.find('.tabchat-panel').removeClass('active');
    $html.find(`.tabchat-panel[data-tab="${tabName}"]`).addClass('active');
    TabbedChatManager._activeTab = tabName;
    
    setTimeout(() => TabbedChatManager._scrollToBottom($html), 50);
  }

  static _scrollToBottom($html, tabName = TabbedChatManager._activeTab) {
    const ol = $html.find(`.tabchat-panel[data-tab="${tabName}"] ol.chat-messages`);
    if (ol?.length) {
      ol.scrollTop(ol[0].scrollHeight);
    }
  }

  static setupHooks() {
    // Chat rendering
    Hooks.on('renderChatLog', (app, html) => {
      TabbedChatManager._tryInjectTabs();
    });
    
    // Scene changes
    Hooks.on('canvasReady', (canvas) => {
      const newSceneId = canvas.scene?.id;
      if (newSceneId !== TabbedChatManager._currentScene) {
        TabbedChatManager._currentScene = newSceneId;
        TabbedChatManager._initializeSceneMessages(newSceneId);
        
        if (ui.chat?.element && TabbedChatManager._chatInjected) {
          TabbedChatManager._switchToScene(newSceneId, $(ui.chat.element));
        }
      }
    });
    
    // Message handling with better /b command prevention
    Hooks.on('preCreateChatMessage', (doc, data, options, userId) => {
      const content = data.content || '';
      console.log(`${MODULE_ID}: preCreateChatMessage - content: "${content}"`);
      
      if (content.startsWith('/b ')) {
        console.log(`${MODULE_ID}: Intercepting /b command`);
        doc._tabchat_forceOOC = true;
        
        // Create custom OOC message and prevent original
        const message = content.substring(3).trim();
        const user = game.users.get(userId);
        
        setTimeout(() => {
          ChatMessage.create({
            user: userId,
            author: userId,
            speaker: { alias: user?.name || 'Unknown Player' },
            content: message,
            type: CONST.CHAT_MESSAGE_TYPES.OOC,
            _tabchat_forceOOC: true
          });
        }, 50);
        
        return false; // This should prevent the original message
      } else if (content.startsWith('/g ')) {
        console.log(`${MODULE_ID}: Intercepting /g command`);
        doc._tabchat_globalOOC = true;
        
        const message = content.substring(3).trim();
        
        setTimeout(() => {
          ChatMessage.create({
            user: userId,
            author: userId,
            speaker: ChatMessage.getSpeaker(),
            content: `[Global] ${message}`,
            type: CONST.CHAT_MESSAGE_TYPES.OOC,
            _tabchat_globalOOC: true
          });
        }, 50);
        
        return false;
      }
    });
    
    Hooks.on('renderChatMessageHTML', (message, html) => {
      const hasTabUI = ui.chat?.element && $(ui.chat.element).find('.tabchat-container').length > 0;
      if (hasTabUI && html?.remove) {
        html.remove();
        return false;
      }
    });
    
    Hooks.on('createChatMessage', async (message) => {
      if (TabbedChatManager._chatInjected && ui.chat?.element) {
        await TabbedChatManager.renderMessage(message, $(ui.chat.element));
      }
    });
  }
}

// Initialize
Hooks.once('init', TabbedChatManager.init);
Hooks.once('ready', TabbedChatManager.ready);
TabbedChatManager.setupHooks();

console.log(`${MODULE_ID}: Concise module loaded`);
