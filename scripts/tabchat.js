// Enhanced Tabbed Chat Module for Foundry VTT v13 - v9 Restoration
// 4-tab system: WORLD | OOC | GAME | MESSAGES

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  static tabPanels = {};
  static sceneMessages = {}; // Store messages per scene per tab
  static globalOOCMessages = []; // Global OOC messages (non-scene specific)
  static _activeTab = 'ic';
  static _currentScene = null;
  static _initialized = false;
  static _chatInjected = false;

  static init() {
    console.log(`${MODULE_ID} | v9 RESTORATION - Init called`);
    
    // Initialize scene messages structure
    TabbedChatManager._currentScene = canvas?.scene?.id || 'default';
    TabbedChatManager._initializeSceneMessages(TabbedChatManager._currentScene);
    
    // Register custom chat command for /b
    TabbedChatManager._registerChatCommands();
  }

  static _registerChatCommands() {
    // Register /b command handler
    Hooks.on('chatMessage', (chatLog, message, chatData) => {
      if (message.startsWith('/b ')) {
        const content = message.substring(3); // Remove '/b '
        const speaker = ChatMessage.getSpeaker();
        const user = game.user;
        
        // Create OOC message with player name
        ChatMessage.create({
          user: user.id,
          author: user.id,
          speaker: { alias: user.name }, // Use player name instead of actor
          content: content,
          style: CONST.CHAT_MESSAGE_STYLES.OOC,
          _tabchat_forceOOC: true
        });
        
        return false; // Prevent default processing
      }
      
      // Handle global OOC commands
      if (message.startsWith('/g ') || message.startsWith('/gooc ')) {
        const content = message.substring(message.startsWith('/g ') ? 3 : 6);
        const speaker = ChatMessage.getSpeaker();
        const user = game.user;
        
        ChatMessage.create({
          user: user.id,
          author: user.id,
          speaker: speaker,
          content: `[Global] ${content}`,
          style: CONST.CHAT_MESSAGE_STYLES.OOC,
          _tabchat_globalOOC: true
        });
        
        return false; // Prevent default processing
      }
      
      return true; // Allow other messages to process normally
    });
  }

  static ready() {
    if (TabbedChatManager._initialized) {
      console.log(`${MODULE_ID} | Already initialized, skipping`);
      return;
    }
    TabbedChatManager._initialized = true;
    console.log(`${MODULE_ID} | v9 RESTORATION - Ready called`);
    
    // Try to inject tabs immediately if chat is ready
    setTimeout(() => {
      TabbedChatManager._tryInjectTabs();
    }, 500);
    
    // Also try multiple times to handle loading issues
    setTimeout(() => {
      TabbedChatManager._tryInjectTabs();
    }, 1500);
    
    setTimeout(() => {
      TabbedChatManager._tryInjectTabs();
    }, 3000);
  }

  static _tryInjectTabs() {
    try {
      if (!ui.chat?.element) {
        console.log(`${MODULE_ID}: UI chat not ready yet`);
        return false;
      }
      
      const $html = $(ui.chat.element);
      if ($html.find('.tabchat-container').length > 0) {
        console.log(`${MODULE_ID}: Tabs already injected`);
        if (!TabbedChatManager._chatInjected) {
          TabbedChatManager._chatInjected = true;
          TabbedChatManager._loadExistingMessages($html);
        }
        return true;
      }
      
      console.log(`${MODULE_ID}: Attempting to inject tabs...`);
      const success = TabbedChatManager._injectTabsDirectly($html);
      
      if (success) {
        TabbedChatManager._chatInjected = true;
        setTimeout(() => {
          TabbedChatManager._loadExistingMessages($html);
        }, 500);
      }
      
      return success;
    } catch (err) {
      console.error(`${MODULE_ID}: Error in _tryInjectTabs`, err);
      return false;
    }
  }

  static _loadExistingMessages($html) {
    try {
      const messages = game.messages.contents.sort((a, b) => a.id.localeCompare(b.id));
      console.log(`${MODULE_ID}: Loading ${messages.length} existing messages`);
      for (const message of messages) {
        TabbedChatManager.renderMessage(message, $html);
      }
      console.log(`${MODULE_ID}: Finished loading existing messages`);
      
      // Switch to current scene's messages
      TabbedChatManager._switchToScene(TabbedChatManager._currentScene, $html);
    } catch (err) {
      console.error(`${MODULE_ID} | Error loading existing messages`, err);
    }
  }

  static setupHooks() {
    console.log(`${MODULE_ID} | v9 RESTORATION - Setting up hooks`);
    
    // Multiple hooks to catch chat rendering
    Hooks.on('renderChatLog', async (app, html, data) => {
      console.log(`${MODULE_ID}: renderChatLog hook fired`);
      await TabbedChatManager._handleChatRender(app, html, data);
    });
    
    Hooks.on('renderApplication', async (app, html, data) => {
      if (app.constructor.name === 'ChatLog' || app === ui.chat) {
        console.log(`${MODULE_ID}: renderApplication hook fired for ChatLog`);
        await TabbedChatManager._handleChatRender(app, html, data);
      }
    });
    
    // Scene change hook for chat instancing
    Hooks.on('canvasReady', (canvas) => {
      const newSceneId = canvas.scene?.id;
      if (newSceneId && newSceneId !== TabbedChatManager._currentScene) {
        console.log(`${MODULE_ID}: Scene changed from ${TabbedChatManager._currentScene} to ${newSceneId}`);
        TabbedChatManager._currentScene = newSceneId;
        TabbedChatManager._initializeSceneMessages(newSceneId);
        
        // Switch chat to new scene
        if (ui.chat?.element && TabbedChatManager._chatInjected) {
          TabbedChatManager._switchToScene(newSceneId, $(ui.chat.element));
        }
      }
    });
    
    // Use the new v13 hook instead of deprecated one
    Hooks.on('renderChatMessageHTML', (message, html, data) => {
      try {
        const hasTabUI = ui.chat?.element && $(ui.chat.element).find('.tabchat-container').length > 0;
        if (hasTabUI) {
          console.log(`${MODULE_ID}: Suppressing renderChatMessageHTML for tabbed UI`, { id: message.id });
          if (html && typeof html.remove === 'function') {
            html.remove();
          }
          return false;
        }
        return true;
      } catch (err) {
        console.error(`${MODULE_ID}: Error in renderChatMessageHTML hook`, err);
        return true;
      }
    });
    
    Hooks.on('createChatMessage', async (message) => {
      if (TabbedChatManager._chatInjected && ui.chat?.element) {
        await TabbedChatManager.renderMessage(message, $(ui.chat.element));
      }
    });
    
    Hooks.on('updateChatMessage', async (message, update, options, userId) => {
      if (TabbedChatManager._chatInjected && ui.chat?.element) {
        try {
          const msgHtml = $(await message.renderHTML());
          await TabbedChatManager.updateMessage(message, msgHtml, $(ui.chat.element));
        } catch (err) {
          console.error(`${MODULE_ID}: Error updating message`, err);
        }
      }
    });
    
    Hooks.on('deleteChatMessage', (message, options, userId) => {
      if (TabbedChatManager._chatInjected && ui.chat?.element) {
        TabbedChatManager.deleteMessage(message.id, $(ui.chat.element));
      }
    });
  }

  static async _handleChatRender(app, html, data) {
    try {
      // Convert to jQuery if needed
      const $html = html instanceof jQuery ? html : $(html);
      
      if ($html.find('.tabchat-container').length > 0) {
        console.log(`${MODULE_ID}: Tabs already exist, skipping injection`);
        return;
      }
      
      console.log(`${MODULE_ID}: Chat render detected, attempting injection`);
      const success = TabbedChatManager._injectTabsDirectly($html);
      
      if (success && !TabbedChatManager._chatInjected) {
        TabbedChatManager._chatInjected = true;
        setTimeout(() => {
          TabbedChatManager._loadExistingMessages($html);
        }, 100);
      }
    } catch (err) {
      console.error(`${MODULE_ID}: Error in _handleChatRender`, err);
    }
  }

  // Scene Messages Management
  static _initializeSceneMessages(sceneId) {
    if (!TabbedChatManager.sceneMessages[sceneId]) {
      TabbedChatManager.sceneMessages[sceneId] = {
        ic: [],
        ooc: [],  // OOC is now scene-specific too
        rolls: []
        // messages (whisper) is global, not per-scene
      };
      console.log(`${MODULE_ID}: Initialized message storage for scene ${sceneId}`);
    }
  }

  static _switchToScene(sceneId, $html) {
    if (!TabbedChatManager._chatInjected) return;
    
    TabbedChatManager._initializeSceneMessages(sceneId);
    
    // Clear current display for scene-specific tabs (IC, OOC, ROLLS)
    ['ic', 'ooc', 'rolls'].forEach(tab => {
      if (TabbedChatManager.tabPanels[tab]) {
        TabbedChatManager.tabPanels[tab].empty();
      }
    });
    
    // Restore scene-specific messages
    ['ic', 'ooc', 'rolls'].forEach(tab => {
      const messages = TabbedChatManager.sceneMessages[sceneId][tab] || [];
      messages.forEach(msgHtml => {
        if (TabbedChatManager.tabPanels[tab]) {
          TabbedChatManager.tabPanels[tab].append(msgHtml.clone());
        }
      });
    });
    
    // Add global OOC messages to OOC tab
    TabbedChatManager.globalOOCMessages.forEach(msgHtml => {
      if (TabbedChatManager.tabPanels.ooc) {
        TabbedChatManager.tabPanels.ooc.append(msgHtml.clone());
      }
    });
    
    // Messages (whisper) tab remains unchanged as it's global
    
    // Scroll to TOP when switching scenes
    setTimeout(() => {
      TabbedChatManager._scrollToTop($html, TabbedChatManager._activeTab);
    }, 100);
    
    console.log(`${MODULE_ID}: Switched to scene ${sceneId} chat instance`);
  }

  static _injectTabsDirectly($html) {
    try {
      console.log(`${MODULE_ID}: Direct injection attempt`);
      
      // Find chat messages container more defensively
      let chatContainer = null;
      const selectors = [
        'ol#chat-log',
        'ol.chat-messages',
        '.chat-messages-container ol',
        '#chat ol',
        '.chat ol',
        'ol'
      ];
      
      for (const selector of selectors) {
        const found = $html.find(selector);
        if (found.length > 0) {
          chatContainer = found.first();
          console.log(`${MODULE_ID}: Found chat container with selector: ${selector}`);
          break;
        }
      }
      
      if (!chatContainer || chatContainer.length === 0) {
        console.warn(`${MODULE_ID}: Could not find chat messages container`);
        return false;
      }
      
      // Hide the original container
      chatContainer.css({
        'display': 'none !important',
        'height': '0 !important',
        'overflow': 'hidden !important',
        'position': 'absolute',
        'visibility': 'hidden'
      });
      
      // Create tabs HTML - FIXED ORDER: WORLD | OOC | GAME | MESSAGES
      const tabs = [
        { id: 'messages', label: 'MESSAGES' },
        { id: 'rolls', label: 'GAME' },
        { id: 'ooc', label: 'OOC' },
        { id: 'ic', label: 'WORLD' }
      ];
      
      const tabsHtml = TabbedChatManager._createTabsHTML(tabs);
      
      // Insert after the original container
      chatContainer.after(tabsHtml);
      
      // Cache the new tab panels
      ['ic', 'ooc', 'rolls', 'messages'].forEach((tab) => {
        const panel = $html.find(`.tabchat-panel[data-tab="${tab}"] ol.chat-messages`);
        TabbedChatManager.tabPanels[tab] = panel;
        console.log(`${MODULE_ID}: Cached panel for ${tab}`, { exists: panel.length > 0 });
      });
      
      // Add click handlers
      $html.find('.tabchat-nav').off('click.tabchat').on('click.tabchat', '.tabchat-tab', (event) => {
        const tabName = event.currentTarget.dataset.tab;
        console.log(`${MODULE_ID}: Tab clicked: ${tabName}`);
        TabbedChatManager._activateTab(tabName, $html);
      });
      
      console.log(`${MODULE_ID}: ✅ Successfully injected tabbed interface with correct order: WORLD | OOC | GAME | MESSAGES`);
      return true;
      
    } catch (err) {
      console.error(`${MODULE_ID}: Error in direct injection`, err);
      return false;
    }
  }

  static _createTabsHTML(tabs) {
    return `
      <div class="tabchat-container">
        <nav class="tabchat-nav">
          ${tabs.map((tab, index) => `
            <a class="tabchat-tab ${tab.id === 'ic' ? 'active' : ''}" data-tab="${tab.id}">
              ${tab.label}
            </a>
            ${index < tabs.length - 1 ? '<div class="tabchat-separator"></div>' : ''}
          `).join('')}
        </nav>
        ${tabs.map((tab) => `
          <section class="tabchat-panel ${tab.id === 'ic' ? 'active' : ''}" data-tab="${tab.id}">
            <ol class="chat-messages"></ol>
          </section>
        `).join('')}
      </div>
      <style>
        /* HIGH PRIORITY STYLES - Override Carolingian UI */
        .tabchat-container {
          height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          z-index: 9999 !important;
          position: relative !important;
        }
        .tabchat-nav {
          display: flex !important;
          align-items: center !important;
          background: rgba(0, 0, 0, 0.8) !important;
          border-bottom: 2px solid #444 !important;
          padding: 0 !important;
          margin: 0 !important;
          flex-shrink: 0 !important;
          z-index: 10000 !important;
        }
        .tabchat-tab {
          flex: 1 !important;
          padding: 16px 8px !important;
          text-align: center !important;
          background: rgba(0, 0, 0, 0.5) !important;
          color: #ccc !important;
          text-decoration: none !important;
          font-size: 18px !important;
          font-weight: bold !important;
          border: none !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          user-select: none !important;
          line-height: 1.2 !important;
          min-height: 50px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .tabchat-tab:hover {
          background: rgba(255, 255, 255, 0.1) !important;
          color: #fff !important;
        }
        .tabchat-tab.active {
          background: rgba(255, 255, 255, 0.15) !important;
          color: #fff !important;
          border-bottom: 4px solid #4CAF50 !important;
        }
        .tabchat-separator {
          width: 2px !important;
          height: 50px !important;
          background: #666 !important;
          margin: 0 !important;
          flex-shrink: 0 !important;
        }
        .tabchat-panel {
          display: none !important;
          flex: 1 !important;
          overflow: hidden !important;
          height: 100% !important;
        }
        .tabchat-panel.active {
          display: flex !important;
          flex-direction: column !important;
        }
        .tabchat-panel ol.chat-messages {
          flex: 1 !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          margin: 0 !important;
          padding: 0 !important;
          list-style: none !important;
          height: 100% !important;
          max-height: none !important;
        }
        .tabbed-messages-highlight {
          animation: messageHighlight 2.5s ease-out !important;
        }
        @keyframes messageHighlight {
          0% { background-color: rgba(76, 175, 80, 0.3) !important; }
          100% { background-color: transparent !important; }
        }
        
        .tabchat-global-ooc {
          background-color: rgba(255, 165, 0, 0.1) !important;
          border-left: 3px solid orange !important;
          padding-left: 8px !important;
        }
      </style>
    `;
  }

  static async renderMessage(message, $html) {
    if (!message || typeof message !== 'object' || !TabbedChatManager._chatInjected) {
      return;
    }

    let rendered;
    try {
      rendered = await message.renderHTML();
      if (!rendered) {
        throw new Error('Render returned undefined');
      }
    } catch (e) {
      console.error(`${MODULE_ID}: Error rendering message, using fallback`, e);
      rendered = `<li class="chat-message" data-message-id="${message.id}">
        <div class="message-content">[FALLBACK] ${message.speaker?.alias || 'Unknown'}: ${message.content || 'No content'}</div>
      </li>`;
    }

    const msgHtml = $(rendered);
    const tab = TabbedChatManager._getMessageTab(message);
    const currentScene = canvas?.scene?.id || 'default';
    const currentUserId = game.user.id;
    const messageScene = message.speaker?.scene || currentScene;
    
    // Use author instead of deprecated user property
    const messageAuthor = message.author?.id || message.author;
    
    console.log(`${MODULE_ID}: Processing message for ${tab} tab`, {
      id: message.id,
      author: messageAuthor,
      currentUser: currentUserId,
      scene: currentScene,
      messageScene: messageScene
    });
    
    // Enhanced filtering logic
    let shouldRender = TabbedChatManager._shouldRenderMessage(message, tab, currentScene, currentUserId, messageAuthor);
    
    if (!shouldRender) {
      console.log(`${MODULE_ID}: Skipping message - filtered out`);
      return;
    }
    
    console.log(`${MODULE_ID}: ✅ RENDERING message to ${tab} tab`);
    
    if (tab && TabbedChatManager.tabPanels[tab]?.length) {
      // Apply special formatting based on message type and tab
      TabbedChatManager._formatMessage(message, msgHtml, tab);
      
      TabbedChatManager.tabPanels[tab].append(msgHtml);
      
      // Store message appropriately
      TabbedChatManager._storeMessage(message, msgHtml, tab, messageScene);
      
      // Add highlight effect
      msgHtml.addClass('tabbed-messages-highlight');
      setTimeout(() => msgHtml.removeClass('tabbed-messages-highlight'), 2500);
      
      // Only scroll if this is the active tab
      if (TabbedChatManager._activeTab === tab) {
        setTimeout(() => {
          TabbedChatManager._scrollToTop($html, tab);
        }, 50);
      }
    } else {
      console.warn(`${MODULE_ID}: No valid tab panel for ${tab}`);
    }
  }

  static _formatMessage(message, msgHtml, tab) {
    const content = message.content || '';
    
    // Handle Global OOC messages
    if (message._tabchat_globalOOC) {
      msgHtml.addClass('tabchat-global-ooc');
      return;
    }
    
    // Handle /b command - use player username instead of actor name
    if (message._tabchat_forceOOC) {
      const username = game.users.get(message.author?.id || message.author)?.name || 'Unknown Player';
      msgHtml.find('.message-sender-name, .message-sender').text(username);
      msgHtml.find('.message-metadata .message-sender').text(username);
      return;
    }
  }

  static _storeMessage(message, msgHtml, tab, messageScene) {
    if (tab === 'messages') {
      return; // Messages tab is global
    } else if (message._tabchat_globalOOC) {
      TabbedChatManager.globalOOCMessages.push(msgHtml.clone());
    } else {
      TabbedChatManager._initializeSceneMessages(messageScene);
      TabbedChatManager.sceneMessages[messageScene][tab].push(msgHtml.clone());
    }
  }

  static _getMessageTab(message) {
    // Handle Global OOC commands first
    if (message._tabchat_globalOOC) {
      return 'ooc';
    }
    
    // Handle /b command override
    if (message._tabchat_forceOOC) {
      return 'ooc';
    }
    
    // Handle rolls first (v13 compatible)
    if (message.isRoll || (message.rolls && message.rolls.length > 0)) return 'rolls';
    
    // Handle whispers (now messages)
    if (message.whisper?.length > 0) return 'messages';
    
    // Check if message has a token speaker
    const speaker = message.speaker;
    if (speaker?.token) {
      return 'ic'; // Token speaking = WORLD
    }
    
    return 'ooc'; // No token = OOC
  }

  static _shouldRenderMessage(message, tab, currentScene, currentUserId, messageAuthor) {
    const messageScene = message.speaker?.scene || currentScene;
    
    if (tab === 'messages') {
      // MESSAGES (whisper): GMs see all, players see only their own
      if (game.user.isGM) {
        return true;
      } else {
        const whisperTargets = message.whisper || [];
        const isAuthor = (messageAuthor === currentUserId);
        const isTarget = whisperTargets.includes(currentUserId);
        return isAuthor || isTarget;
      }
    } else if (tab === 'ic' || tab === 'ooc' || tab === 'rolls') {
      // Global OOC messages are visible to everyone
      if (message._tabchat_globalOOC) {
        return true;
      }
      
      // Scene-specific messages
      const isSameScene = (messageScene === currentScene);
      const isAuthor = (messageAuthor === currentUserId);
      return isSameScene || isAuthor;
    }
    
    return true;
  }

  static async updateMessage(message, msgHtml, $html) {
    const tab = TabbedChatManager._getMessageTab(message);
    if (tab && TabbedChatManager.tabPanels[tab]?.length) {
      const existing = TabbedChatManager.tabPanels[tab].find(`[data-message-id="${message.id}"]`);
      if (existing.length) {
        TabbedChatManager._formatMessage(message, msgHtml, tab);
        existing.replaceWith(msgHtml);
        if (TabbedChatManager._activeTab === tab) {
          TabbedChatManager._scrollToTop($html, tab);
        }
      }
    }
  }

  static deleteMessage(messageId, $html) {
    ['ic', 'ooc', 'rolls', 'messages'].forEach((tab) => {
      TabbedChatManager.tabPanels[tab]?.find(`[data-message-id="${messageId}"]`).remove();
    });
  }

  static _activateTab(tabName, $html) {
    $html.find('.tabchat-tab').removeClass('active');
    $html.find(`[data-tab="${tabName}"]`).addClass('active');
    $html.find('.tabchat-panel').removeClass('active');
    $html.find(`.tabchat-panel[data-tab="${tabName}"]`).addClass('active');
    TabbedChatManager._activeTab = tabName;
    
    console.log(`${MODULE_ID}: Switched to ${tabName} tab`);
    
    setTimeout(() => {
      TabbedChatManager._scrollToTop($html, tabName);
    }, 50);
  }

  static _scrollToTop($html, tabName = TabbedChatManager._activeTab) {
    const ol = $html.find(`.tabchat-panel[data-tab="${tabName}"] ol.chat-messages`);
    if (ol?.length) {
      ol.scrollTop(0);
      ol.animate({ scrollTop: 0 }, 200);
    }
  }
}

// Module Initialization
Hooks.once('init', () => {
  console.log(`${MODULE_ID}: Init hook fired`);
  TabbedChatManager.init();
});

Hooks.once('ready', () => {
  console.log(`${MODULE_ID}: Ready hook fired`);
  TabbedChatManager.ready();
});

// Setup hooks
TabbedChatManager.setupHooks();

console.log(`${MODULE_ID}: v9 Restored - High Priority Module loaded`);
