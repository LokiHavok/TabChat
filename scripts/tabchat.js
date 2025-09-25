// Tabbed Chat Module for Foundry VTT v13 - v25 Clean Rebuild
// Four tabs: WORLD | OOC | GAME | MESSAGES with scene instancing
// Based on working v9 functionality, updated for v13 API compatibility

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  static tabPanels = {};
  static sceneMessages = {}; // Store messages per scene per tab
  static globalOOCMessages = []; // Global OOC messages (cross-scene)
  static _activeTab = 'ic';
  static _currentScene = null;
  static _chatInjected = false;

  static init() {
    console.log(`${MODULE_ID} | v25 Clean Rebuild - Init called`);
    
    // Initialize current scene
    TabbedChatManager._currentScene = canvas?.scene?.id || 'default';
    TabbedChatManager._initializeSceneMessages(TabbedChatManager._currentScene);
    
    // Register custom chat commands
    TabbedChatManager._registerCustomCommands();
  }

  static ready() {
    console.log(`${MODULE_ID} | v25 - Ready, attempting tab injection`);
    
    // Multiple injection attempts to handle various loading scenarios
    const delays = [500, 1500, 3000];
    delays.forEach(delay => {
      setTimeout(() => TabbedChatManager._tryInjectTabs(), delay);
    });
  }

  static setupHooks() {
    console.log(`${MODULE_ID} | v25 - Setting up hooks`);
    
    // Chat rendering hooks
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

    // Scene change detection for scene instancing
    Hooks.on('canvasReady', (canvas) => {
      const newSceneId = canvas.scene?.id;
      if (newSceneId && newSceneId !== TabbedChatManager._currentScene) {
        console.log(`${MODULE_ID}: Scene changed from ${TabbedChatManager._currentScene} to ${newSceneId}`);
        TabbedChatManager._currentScene = newSceneId;
        TabbedChatManager._initializeSceneMessages(newSceneId);
        
        if (TabbedChatManager._chatInjected && ui.chat?.element) {
          TabbedChatManager._switchToScene(newSceneId, $(ui.chat.element));
        }
      }
    });

    // Message processing hooks (v13 compatible)
    Hooks.on('renderChatMessageHTML', (message, html, data) => {
      const hasTabUI = ui.chat?.element && $(ui.chat.element).find('.tabchat-container').length > 0;
      if (hasTabUI) {
        if (html && typeof html.remove === 'function') {
          html.remove();
        }
        return false;
      }
      return true;
    });

    Hooks.on('createChatMessage', async (message) => {
      if (TabbedChatManager._chatInjected && ui.chat?.element) {
        await TabbedChatManager._renderMessage(message, $(ui.chat.element));
      }
    });

    Hooks.on('updateChatMessage', async (message, update, options, userId) => {
      if (TabbedChatManager._chatInjected && ui.chat?.element) {
        try {
          const msgHtml = $(await message.renderHTML());
          await TabbedChatManager._updateMessage(message, msgHtml, $(ui.chat.element));
        } catch (err) {
          console.error(`${MODULE_ID}: Error updating message`, err);
        }
      }
    });

    Hooks.on('deleteChatMessage', (message, options, userId) => {
      if (TabbedChatManager._chatInjected && ui.chat?.element) {
        TabbedChatManager._deleteMessage(message.id, $(ui.chat.element));
      }
    });
  }

  // Custom Command Registration
  static _registerCustomCommands() {
    // Register /b and /g commands via chatMessage hook
    Hooks.on('chatMessage', (chatLog, message, chatData) => {
      if (message.startsWith('/b ')) {
        const content = message.substring(3).trim();
        const user = game.user;
        
        ChatMessage.create({
          user: user.id,
          author: user.id,
          speaker: { alias: user.name },
          content: content,
          style: CONST.CHAT_MESSAGE_STYLES.OOC, // v13 compatible
          _tabchat_forceOOC: true
        });
        
        return false; // Prevent default processing
      }
      
      if (message.startsWith('/g ')) {
        const content = message.substring(3).trim();
        const user = game.user;
        
        ChatMessage.create({
          user: user.id,
          author: user.id,
          speaker: ChatMessage.getSpeaker(),
          content: `[Global] ${content}`,
          style: CONST.CHAT_MESSAGE_STYLES.OOC, // v13 compatible
          _tabchat_globalOOC: true
        });
        
        return false; // Prevent default processing
      }
      
      return true; // Allow other messages
    });
  }

  // Tab Injection System
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
      const success = TabbedChatManager._injectTabs($html);
      
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

  static _injectTabs($html) {
    try {
      console.log(`${MODULE_ID}: Direct injection attempt`);
      
      // Find chat container using multiple selectors
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
      
      // Hide original container
      chatContainer.css({
        'display': 'none !important',
        'height': '0 !important',
        'overflow': 'hidden !important',
        'position': 'absolute',
        'visibility': 'hidden'
      });
      
      // Create tab structure (CSS handles ordering)
      const tabsHtml = `
        <div class="tabchat-container">
          <nav class="tabchat-nav">
            <a class="tabchat-tab active" data-tab="ic">WORLD</a>
            <div class="tabchat-separator"></div>
            <a class="tabchat-tab" data-tab="ooc">OOC</a>
            <div class="tabchat-separator"></div>
            <a class="tabchat-tab" data-tab="rolls">GAME</a>
            <div class="tabchat-separator"></div>
            <a class="tabchat-tab" data-tab="messages">MESSAGES</a>
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
      `;
      
      // Insert after original container
      chatContainer.after(tabsHtml);
      
      // Cache tab panels
      ['ic', 'ooc', 'rolls', 'messages'].forEach((tab) => {
        const panel = $html.find(`.tabchat-panel[data-tab="${tab}"] ol.chat-messages`);
        TabbedChatManager.tabPanels[tab] = panel;
        console.log(`${MODULE_ID}: Cached panel for ${tab}`, { exists: panel.length > 0 });
      });
      
      // Add click handlers using event delegation
      $html.find('.tabchat-nav').off('click.tabchat').on('click.tabchat', '.tabchat-tab', (event) => {
        const tabName = event.currentTarget.dataset.tab;
        console.log(`${MODULE_ID}: Tab clicked: ${tabName}`);
        TabbedChatManager._activateTab(tabName, $html);
      });
      
      console.log(`${MODULE_ID}: ✅ Tabs injected successfully - Order controlled by CSS`);
      return true;
      
    } catch (err) {
      console.error(`${MODULE_ID}: Error in tab injection`, err);
      return false;
    }
  }

  static async _handleChatRender(app, html, data) {
    try {
      const $html = html instanceof jQuery ? html : $(html);
      
      if ($html.find('.tabchat-container').length > 0) {
        console.log(`${MODULE_ID}: Tabs already exist, skipping injection`);
        return;
      }
      
      console.log(`${MODULE_ID}: Chat render detected, attempting injection`);
      const success = TabbedChatManager._injectTabs($html);
      
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

  // Scene Management System
  static _initializeSceneMessages(sceneId) {
    if (!TabbedChatManager.sceneMessages[sceneId]) {
      TabbedChatManager.sceneMessages[sceneId] = {
        ic: [],
        ooc: [],
        rolls: []
        // messages tab is global, not per-scene
      };
      console.log(`${MODULE_ID}: Initialized message storage for scene ${sceneId}`);
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
    
    // Add global OOC messages to OOC tab
    TabbedChatManager.globalOOCMessages.forEach(msgHtml => {
      if (TabbedChatManager.tabPanels.ooc) {
        TabbedChatManager.tabPanels.ooc.append(msgHtml.clone());
      }
    });
    
    console.log(`${MODULE_ID}: Switched to scene ${sceneId} chat instance`);
    
    // Scroll to top after scene switch
    setTimeout(() => {
      TabbedChatManager._scrollToTop($html, TabbedChatManager._activeTab);
    }, 100);
  }

  static _loadExistingMessages($html) {
    try {
      const messages = game.messages.contents.sort((a, b) => a.id.localeCompare(b.id));
      console.log(`${MODULE_ID}: Loading ${messages.length} existing messages`);
      
      for (const message of messages) {
        TabbedChatManager._renderMessage(message, $html);
      }
      
      console.log(`${MODULE_ID}: Finished loading existing messages`);
      TabbedChatManager._switchToScene(TabbedChatManager._currentScene, $html);
    } catch (err) {
      console.error(`${MODULE_ID}: Error loading existing messages`, err);
    }
  }

  // Message Processing System
  static async _renderMessage(message, $html) {
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
      console.error(`${MODULE_ID}: Error rendering message`, e);
      return;
    }

    const msgHtml = $(rendered);
    const tab = TabbedChatManager._getMessageTab(message);
    const currentScene = canvas?.scene?.id || 'default';
    const currentUserId = game.user.id;
    const messageScene = message.speaker?.scene || currentScene;
    const messageAuthor = message.author?.id || message.author;
    
    console.log(`${MODULE_ID}: Processing message for ${tab} tab`);
    
    // Check if should render based on scene/user rules
    const shouldRender = TabbedChatManager._shouldRenderMessage(message, tab, currentScene, currentUserId, messageAuthor);
    
    if (!shouldRender) {
      console.log(`${MODULE_ID}: Skipping message - filtered out`);
      return;
    }
    
    if (tab && TabbedChatManager.tabPanels[tab]?.length) {
      // Apply message formatting
      TabbedChatManager._formatMessage(message, msgHtml, tab);
      
      // Add to appropriate tab
      TabbedChatManager.tabPanels[tab].append(msgHtml);
      
      // Store message for scene instancing
      TabbedChatManager._storeMessage(message, msgHtml, tab, messageScene);
      
      // Add highlight animation
      msgHtml.addClass('tabbed-messages-highlight');
      setTimeout(() => msgHtml.removeClass('tabbed-messages-highlight'), 2500);
      
      // Auto-scroll if active tab
      if (TabbedChatManager._activeTab === tab) {
        setTimeout(() => {
          TabbedChatManager._scrollToTop($html, tab);
        }, 50);
      }
    }
  }

  static _getMessageTab(message) {
    // Handle special command overrides
    if (message._tabchat_globalOOC) return 'ooc';
    if (message._tabchat_forceOOC) return 'ooc';
    
    // v13 compatible message type detection
    if (message.isRoll || (message.rolls && message.rolls.length > 0)) return 'rolls';
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
      const isAuthor = (messageAuthor === currentUserId);
      const isTarget = whisperTargets.includes(currentUserId);
      return isAuthor || isTarget;
    }
    
    if (tab === 'ic' || tab === 'ooc' || tab === 'rolls') {
      // Global OOC visible to all
      if (message._tabchat_globalOOC) return true;
      
      // Scene instancing: same scene OR user is author
      const isSameScene = (messageScene === currentScene);
      const isAuthor = (messageAuthor === currentUserId);
      return isSameScene || isAuthor;
    }
    
    return true;
  }

  static _formatMessage(message, msgHtml, tab) {
    const content = message.content || '';
    
    // Global OOC styling
    if (message._tabchat_globalOOC) {
      msgHtml.addClass('tabchat-global-ooc');
      return;
    }
    
    // /b command formatting - use player name
    if (message._tabchat_forceOOC) {
      const username = game.users.get(message.author?.id || message.author)?.name || 'Unknown Player';
      msgHtml.find('.message-sender-name, .message-sender').text(username);
      msgHtml.find('.message-metadata .message-sender').text(username);
      return;
    }
  }

  static _storeMessage(message, msgHtml, tab, messageScene) {
    if (tab === 'messages') {
      return; // Global whispers, no scene storage
    } else if (message._tabchat_globalOOC) {
      TabbedChatManager.globalOOCMessages.push(msgHtml.clone());
    } else {
      TabbedChatManager._initializeSceneMessages(messageScene);
      TabbedChatManager.sceneMessages[messageScene][tab].push(msgHtml.clone());
    }
  }

  // Tab Control System
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

  // Message Update/Delete System
  static async _updateMessage(message, msgHtml, $html) {
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

  static _deleteMessage(messageId, $html) {
    ['ic', 'ooc', 'rolls', 'messages'].forEach((tab) => {
      TabbedChatManager.tabPanels[tab]?.find(`[data-message-id="${messageId}"]`).remove();
    });
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

console.log(`${MODULE_ID}: v25 Clean Rebuild loaded successfully`);
