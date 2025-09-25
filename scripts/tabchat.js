// Enhanced Tabbed Chat Module for Foundry VTT v13 - Fixed Priority Version
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
    console.log(`${MODULE_ID} | HIGH PRIORITY VERSION - Init called`);
    
    // Initialize scene messages structure
    TabbedChatManager._currentScene = canvas?.scene?.id || 'default';
    TabbedChatManager._initializeSceneMessages(TabbedChatManager._currentScene);
    
    // Register custom chat command for /b
    TabbedChatManager._registerChatCommands();
    
    // More defensive patching with error handling
    try {
      const ChatLogClass = foundry.applications.sidebar.tabs.ChatLog;
      if (ChatLogClass && !ChatLogClass.prototype._tabchat_originalPostOne) {
        ChatLogClass.prototype._tabchat_originalPostOne = ChatLogClass.prototype._postOne;
        ChatLogClass.prototype._postOne = async function (...args) {
          try {
            const $el = this?.element ? $(this.element) : null;
            if ($el && $el.find && $el.find('.tabchat-container').length) {
              console.log(`${MODULE_ID}: Suppressing ChatLog._postOne because tabchat is present`);
              return;
            }
            return await ChatLogClass.prototype._tabchat_originalPostOne.apply(this, args);
          } catch (err) {
            console.error(`${MODULE_ID}: Error in patched ChatLog._postOne`, err);
            if (ChatLogClass.prototype._tabchat_originalPostOne) {
              return await ChatLogClass.prototype._tabchat_originalPostOne.apply(this, args);
            }
          }
        };
        console.log(`${MODULE_ID} | Successfully patched ChatLog prototype`);
      }
    } catch (err) {
      console.error(`${MODULE_ID} | Failed to patch ChatLog prototype:`, err);
    }
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
          type: CONST.CHAT_MESSAGE_TYPES.OOC,
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
          content: message, // Keep original command for processing
          type: CONST.CHAT_MESSAGE_TYPES.OOC,
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
    console.log(`${MODULE_ID} | HIGH PRIORITY VERSION - Ready called`);
    
    // More defensive ui.chat patching
    try {
      if (ui.chat && typeof ui.chat._postOne === 'function') {
        if (!ui.chat._tabchat_originalPostOne) ui.chat._tabchat_originalPostOne = ui.chat._postOne;
        ui.chat._postOne = async function (...args) {
          try {
            const $el = this?.element ? $(this.element) : null;
            if ($el && $el.find && $el.find('.tabchat-container').length) {
              console.log(`${MODULE_ID}: Suppressing ui.chat._postOne because tabchat is present`);
              return;
            }
            return await ui.chat._tabchat_originalPostOne.apply(this, args);
          } catch (err) {
            console.error(`${MODULE_ID}: Error in patched ui.chat._postOne`, err);
            if (ui.chat._tabchat_originalPostOne) {
              return await ui.chat._tabchat_originalPostOne.apply(this, args);
            }
          }
        };
        console.log(`${MODULE_ID} | Patched ui.chat._postOne (instance)`);
      }
    } catch (err) {
      console.warn(`${MODULE_ID} | Failed to patch ui.chat._postOne instance (continuing)`, err);
    }
    
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
    console.log(`${MODULE_ID} | HIGH PRIORITY VERSION - Setting up hooks`);
    
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
    
    Hooks.on('preCreateChatMessage', (doc, data, options, userId) => {
      // Handle special commands
      if (data.content) {
        if (data.content.startsWith('/b ')) {
          // Force /b messages to OOC tab with username
          doc._tabchat_forceOOC = true;
          console.log(`${MODULE_ID}: /b command detected, forcing OOC tab`);
        } else if (data.content.startsWith('/g ') || data.content.startsWith('/gooc ')) {
          // Force global OOC messages
          doc._tabchat_globalOOC = true;
          console.log(`${MODULE_ID}: Global OOC command detected`);
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
      
      // Create tabs HTML - CORRECT ORDER: WORLD | OOC | GAME | MESSAGES
      const tabs = [
        { id: 'ic', label: 'WORLD' },
        { id: 'ooc', label: 'OOC' },
        { id: 'rolls', label: 'GAME' },
        { id: 'messages', label: 'MESSAGES' }
      ];
      
      const tabsHtml = TabbedChatManager._createTabsHTML(tabs);
      
      // Insert after the original container
      chatContainer.after(tabsHtml);
      
      // Cache the new tab panels - NOTE: Reverse order to fix display issue
      const tabIds = ['ic', 'ooc', 'rolls', 'messages'];
      tabIds.forEach((tab) => {
        const panel = $html.find(`.tabchat-panel[data-tab="${tab}"] ol.chat-messages`);
        TabbedChatManager.tabPanels[tab] = panel;
        console.log(`${MODULE_ID}: Cached panel for ${tab}`, { exists: panel.length > 0 });
      });
      
      // Add click handlers
      $html.find('.tabchat-nav').off('click.tabchat').on('click.tabchat', '.tabchat-tab', (event) => {
        const tabName = event.currentTarget.dataset.tab;
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
        
        /* WORLD chat special formatting */
        .tabchat-panel[data-tab="ic"] .tabchat-me-action {
          color: #827896 !important;
          font-style: italic !important;
        }
        .tabchat-panel[data-tab="ic"] .tabchat-me-action * {
          color: #827896 !important;
        }
        .tabchat-global-ooc {
          background-color: rgba(255, 165, 0, 0.1) !important;
          border-left: 3px solid orange !important;
          padding-left: 8px !important;
        }
        
        /* Hide chat bubbles for /me commands */
        .tabchat-panel[data-tab="ic"] .tabchat-me-action .chat-message-bubble,
        .tabchat-panel[data-tab="ic"] .tabchat-me-action .message-bubble {
          display: none !important;
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
      let prefix = '[Global OOC] ';
      if (content.startsWith('/g ')) {
        msgHtml.find('.message-content').each(function() {
          const content = $(this).html();
          $(this).html(content.replace('/g ', prefix));
        });
      } else if (content.startsWith('/gooc ')) {
        msgHtml.find('.message-content').each(function() {
          const content = $(this).html();
          $(this).html(content.replace('/gooc ', prefix));
        });
      }
      msgHtml.addClass('tabchat-global-ooc');
      return;
    }
    
    // Handle /b command - use player username instead of actor name
    if (message._tabchat_forceOOC || content.startsWith('/b ')) {
      const username = game.users.get(message.author?.id || message.author)?.name || 'Unknown Player';
      msgHtml.find('.message-content').each(function() {
        const content = $(this).html();
        $(this).html(content.replace('/b ', ''));
      });
      // Update speaker info to show username instead of actor
      msgHtml.find('.message-sender-name, .message-sender').text(username);
      msgHtml.find('.message-metadata .message-sender').text(username);
      return;
    }
    
    // WORLD chat special formatting
    if (tab === 'ic') {
      const speaker = message.speaker;
      let actorName = 'Unknown';
      
      // Get Represented Actor name
      if (speaker?.actor) {
        const actor = game.actors.get(speaker.actor);
        if (actor) {
          actorName = actor.name;
        }
      }
      
      // Handle /me commands
      if (content.startsWith('/me ')) {
        msgHtml.find('.message-content').each(function() {
          const content = $(this).html();
          const cleanContent = content.replace('/me ', '');
          $(this).html(cleanContent).addClass('tabchat-me-action');
        });
        msgHtml.addClass('tabchat-me-action');
        
        // Remove token name entirely for /me commands, don't add "says:"
        msgHtml.find('.message-sender-name, .message-sender').remove();
        msgHtml.find('.message-metadata .message-sender').remove();
      } else if (!content.startsWith('/')) {
        // Regular speech formatting: [Represented Actor] says: "[message]"
        msgHtml.find('.message-content').each(function() {
          const currentContent = $(this).html();
          // Only add quotes if not already quoted and not empty
          if (currentContent.trim() && !currentContent.trim().startsWith('"')) {
            $(this).html(`"${currentContent}"`);
          }
        });
        
        // Replace sender name with "[Actor] says:"
        msgHtml.find('.message-sender-name, .message-sender').text(`${actorName} says:`);
        msgHtml.find('.message-metadata .message-sender').text(`${actorName} says:`);
      }
    }
  }

  static _storeMessage(message, msgHtml, tab, messageScene) {
    if (tab === 'messages') {
      // Messages tab is global - don't store per scene
      return;
    } else if (message._tabchat_globalOOC) {
      // Global OOC messages go to all scenes
      TabbedChatManager.globalOOCMessages.push(msgHtml.clone());
    } else {
      // Scene-specific messages (IC, OOC, ROLLS)
      TabbedChatManager._initializeSceneMessages(messageScene);
      TabbedChatManager.sceneMessages[messageScene][tab].push(msgHtml.clone());
    }
  }

  static _getMessageTab(message) {
    // Handle Global OOC commands first
    if (message._tabchat_globalOOC || message.content?.startsWith('/g ') || message.content?.startsWith('/gooc ')) {
      return 'ooc';
    }
    
    // Handle /b command override
    if (message._tabchat_forceOOC || message.content?.startsWith('/b ')) {
      return 'ooc';
    }
    
    // Handle rolls first
    if (message.isRoll || message.type === 'roll') return 'rolls';
    
    // Handle whispers (now messages)
    if (message.whisper?.length > 0) return 'messages';
    
    // Check if message has a token speaker
    const speaker = message.speaker;
    if (speaker?.token) {
      // Token is speaking = WORLD (IC)
      return 'ic';
    }
    
    // No token = OOC (includes GM narration without token)
    return 'ooc';
  }

  static _shouldRenderMessage(message, tab, currentScene, currentUserId, messageAuthor) {
    const messageScene = message.speaker?.scene || currentScene;
    
    if (tab === 'messages') {
      // MESSAGES (whisper): GMs see all, players see only their own
      if (game.user.isGM) {
        return true; // GM sees all whispers
      } else {
        // Players only see whispers they sent or received
        const whisperTargets = message.whisper || [];
        const isAuthor = (messageAuthor === currentUserId);
        const isTarget = whisperTargets.includes(currentUserId);
        return isAuthor || isTarget;
      }
    } else if (tab === 'ic' || tab === 'ooc' || tab === 'rolls') {
      // Global OOC messages are visible to everyone regardless of scene
      if (message._tabchat_globalOOC) {
        return true;
      }
      
      // Scene-specific messages: Show if same scene OR if user is author
      const isSameScene = (messageScene === currentScene);
      const isAuthor = (messageAuthor === currentUserId);
      return isSameScene || isAuthor;
    }
    
    return true; // Default: show message
  }

  static async updateMessage(message, msgHtml, $html) {
    const tab = TabbedChatManager._getMessageTab(message);
    const messageScene = message.speaker?.scene || TabbedChatManager._currentScene;
    
    if (tab && TabbedChatManager.tabPanels[tab]?.length) {
      const existing = TabbedChatManager.tabPanels[tab].find(`[data-message-id="${message.id}"]`);
      if (existing.length) {
        // Apply formatting to updated message
        TabbedChatManager._formatMessage(message, msgHtml, tab);
        existing.replaceWith(msgHtml);
        
        // Update stored message
        TabbedChatManager._updateStoredMessage(message, msgHtml, tab, messageScene);
        
        if (TabbedChatManager._activeTab === tab) {
          TabbedChatManager._scrollToTop($html, tab);
        }
      }
    }
  }

  static _updateStoredMessage(message, msgHtml, tab, messageScene) {
    if (tab === 'messages') {
      return; // Messages are global, no need to update stored messages
    } else if (message._tabchat_globalOOC) {
      // Update global OOC message
      const msgIndex = TabbedChatManager.globalOOCMessages.findIndex(msg => 
        msg.find(`[data-message-id="${message.id}"]`).length > 0
      );
      if (msgIndex !== -1) {
        TabbedChatManager.globalOOCMessages[msgIndex] = msgHtml.clone();
      }
    } else {
      // Update scene-specific message
      TabbedChatManager._initializeSceneMessages(messageScene);
      const storedMessages = TabbedChatManager.sceneMessages[messageScene][tab];
      const msgIndex = storedMessages.findIndex(msg => 
        msg.find(`[data-message-id="${message.id}"]`).length > 0
      );
      if (msgIndex !== -1) {
        storedMessages[msgIndex] = msgHtml.clone();
      }
    }
  }

  static deleteMessage(messageId, $html) {
    ['ic', 'ooc', 'rolls', 'messages'].forEach((tab) => {
      // Remove from display
      TabbedChatManager.tabPanels[tab]?.find(`[data-message-id="${messageId}"]`).remove();
      
      // Remove from stored messages
      if (tab !== 'messages') {
        // Remove from global OOC
        TabbedChatManager.globalOOCMessages = TabbedChatManager.globalOOCMessages.filter(msg => 
          msg.find(`[data-message-id="${messageId}"]`).length === 0
        );
        
        // Remove from scene messages
        Object.keys(TabbedChatManager.sceneMessages).forEach(sceneId => {
          const sceneMessages = TabbedChatManager.sceneMessages[sceneId][tab];
          if (sceneMessages) {
            const msgIndex = sceneMessages.findIndex(msg => 
              msg.find(`[data-message-id="${messageId}"]`).length > 0
            );
            if (msgIndex !== -1) {
              sceneMessages.splice(msgIndex, 1);
            }
          }
        });
      }
    });
  }

  static _activateTab(tabName, $html) {
    $html.find('.tabchat-tab').removeClass('active');
    $html.find(`[data-tab="${tabName}"]`).addClass('active');
    $html.find('.tabchat-panel').removeClass('active');
    $html.find(`.tabchat-panel[data-tab="${tabName}"]`).addClass('active');
    TabbedChatManager._activeTab = tabName;
    
    console.log(`${MODULE_ID}: Switched to ${tabName} tab`);
    
    // Scroll to TOP when switching tabs
    setTimeout(() => {
      TabbedChatManager._scrollToTop($html, tabName);
    }, 50);
  }

  static _scrollToTop($html, tabName = TabbedChatManager._activeTab) {
    const ol = $html.find(`.tabchat-panel[data-tab="${tabName}"] ol.chat-messages`);
    if (ol?.length) {
      // Force scroll to the very top
      ol.scrollTop(0);
      ol.animate({
        scrollTop: 0
      }, 200);
    }
  }
}

// Module Initialization with proper timing
Hooks.once('init', () => {
  console.log(`${MODULE_ID}: Init hook fired`);
  TabbedChatManager.init();
});

Hooks.once('ready', () => {
  console.log(`${MODULE_ID}: Ready hook fired`);
  TabbedChatManager.ready();
});

// Setup hooks after everything is defined
TabbedChatManager.setupHooks();

console.log(`${MODULE_ID}: High Priority Scene Instanced Module script loaded`);
