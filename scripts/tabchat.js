// Enhanced Tabbed Chat Module for Foundry VTT v13 - With Scene Instancing
// 4-tab system: WORLD | OOC | GAME | MESSAGES

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  static tabPanels = {};
  static sceneMessages = {}; // Store messages per scene per tab
  static _activeTab = 'ic';
  static _currentScene = null;
  static _initialized = false;

  static init() {
    console.log(`${MODULE_ID} | ENHANCED VERSION - Init called`);
    
    // Initialize scene messages structure
    TabbedChatManager._currentScene = canvas?.scene?.id || 'default';
    TabbedChatManager._initializeSceneMessages(TabbedChatManager._currentScene);
    
    // Use the new v13 namespace
    try {
      const ChatLogClass = foundry.applications.sidebar.tabs.ChatLog;
      if (!ChatLogClass.prototype._tabchat_originalPostOne) {
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

  static ready() {
    if (TabbedChatManager._initialized) {
      console.log(`${MODULE_ID} | Already initialized, skipping`);
      return;
    }
    TabbedChatManager._initialized = true;
    console.log(`${MODULE_ID} | ENHANCED VERSION - Ready called`);
    
    // Patch ui.chat instance
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
    
    // Render existing messages after a delay
    setTimeout(() => {
      try {
        if (!ui.chat?.element) {
          console.warn(`${MODULE_ID}: UI not ready, skipping existing message rendering`);
          return;
        }
        const $html = $(ui.chat.element);
        const messages = game.messages.contents.sort((a, b) => a.id.localeCompare(b.id));
        console.log(`${MODULE_ID}: Loading ${messages.length} existing messages`);
        for (const message of messages) {
          TabbedChatManager.renderMessage(message, $html);
        }
        console.log(`${MODULE_ID}: Finished loading existing messages`);
        
        // Switch to current scene's messages
        TabbedChatManager._switchToScene(TabbedChatManager._currentScene, $html);
      } catch (err) {
        console.error(`${MODULE_ID} | Error rendering existing messages`, err);
      }
    }, 1500);
  }

  static setupHooks() {
    console.log(`${MODULE_ID} | ENHANCED VERSION - Setting up hooks`);
    
    Hooks.on('renderChatLog', async (app, html, data) => {
      await TabbedChatManager.injectTabs(app, html, data);
    });
    
    // Scene change hook for chat instancing
    Hooks.on('canvasReady', (canvas) => {
      const newSceneId = canvas.scene?.id;
      if (newSceneId && newSceneId !== TabbedChatManager._currentScene) {
        console.log(`${MODULE_ID}: Scene changed from ${TabbedChatManager._currentScene} to ${newSceneId}`);
        TabbedChatManager._currentScene = newSceneId;
        TabbedChatManager._initializeSceneMessages(newSceneId);
        
        // Switch chat to new scene
        if (ui.chat?.element) {
          TabbedChatManager._switchToScene(newSceneId, $(ui.chat.element));
        }
      }
    });
    
    Hooks.on('preCreateChatMessage', (doc, data, options, userId) => {
      // Handle /b command preprocessing
      if (data.content && data.content.startsWith('/b ')) {
        // Force the message to be treated as OOC
        doc._tabchat_forceOOC = true;
        console.log(`${MODULE_ID}: /b command detected, forcing OOC tab`);
      }
    });
    
    // Suppress Foundry's default render when tabbed UI is active
    Hooks.on('renderChatMessageHTML', (message, html, data) => {
      try {
        const hasTabUI = ui.chat?.element && $(ui.chat.element).find('.tabchat-container').length > 0;
        if (hasTabUI) {
          console.log(`${MODULE_ID}: Suppressing renderChatMessageHTML for tabbed UI`, { id: message.id });
          if (html) {
            if (html instanceof HTMLElement && typeof html.remove === 'function') {
              html.remove();
            } else if (html && typeof html.remove === 'function') {
              html.remove();
            }
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
      await TabbedChatManager.renderMessage(message, $(ui.chat.element));
    });
    
    Hooks.on('updateChatMessage', async (message, update, options, userId) => {
      const msgHtml = $(await message.renderHTML());
      await TabbedChatManager.updateMessage(message, msgHtml, $(ui.chat.element));
    });
    
    Hooks.on('deleteChatMessage', (message, options, userId) => {
      TabbedChatManager.deleteMessage(message.id, $(ui.chat.element));
    });
  }

  // Scene Messages Management
  static _initializeSceneMessages(sceneId) {
    if (!TabbedChatManager.sceneMessages[sceneId]) {
      TabbedChatManager.sceneMessages[sceneId] = {
        ic: [],
        ooc: [],
        rolls: []
        // messages (whisper) is global, not per-scene
      };
      console.log(`${MODULE_ID}: Initialized message storage for scene ${sceneId}`);
    }
  }

  static _switchToScene(sceneId, $html) {
    TabbedChatManager._initializeSceneMessages(sceneId);
    
    // Clear current display for scene-specific tabs
    ['ic', 'ooc', 'rolls'].forEach(tab => {
      if (TabbedChatManager.tabPanels[tab]) {
        TabbedChatManager.tabPanels[tab].empty();
      }
    });
    
    // Restore messages for new scene
    ['ic', 'ooc', 'rolls'].forEach(tab => {
      const messages = TabbedChatManager.sceneMessages[sceneId][tab] || [];
      messages.forEach(msgHtml => {
        if (TabbedChatManager.tabPanels[tab]) {
          TabbedChatManager.tabPanels[tab].append(msgHtml.clone());
        }
      });
    });
    
    // Messages (whisper) tab remains unchanged as it's global
    
    // Scroll to bottom of active tab
    setTimeout(() => {
      TabbedChatManager._scrollToLastMessage($html, TabbedChatManager._activeTab);
    }, 100);
    
    console.log(`${MODULE_ID}: Switched to scene ${sceneId} chat instance`);
  }

  // Core Methods
  static async injectTabs(app, html, data) {
    if (!(html instanceof HTMLElement)) {
      console.log(`${MODULE_ID}: Skipping injection - invalid HTML type`);
      return;
    }

    const $html = $(html);
    console.log(`${MODULE_ID}: ENHANCED - Injecting tabs`);

    let defaultOl = $html.find('ol.chat-messages');
    if (!defaultOl.length) {
      defaultOl = $html.find('.chat-messages-container ol');
    }
    if (!defaultOl.length) {
      defaultOl = $html.find('ol');
    }
    
    if (!defaultOl.length) {
      console.warn(`${MODULE_ID}: No <ol> found, waiting for it`);
      await TabbedChatManager._waitForChatOl($html);
      defaultOl = $html.find('ol.chat-messages') || $html.find('.chat-messages-container ol') || $html.find('ol');
      if (!defaultOl.length) {
        console.error(`${MODULE_ID}: Failed to find OL after waiting`);
        return;
      }
    }

    TabbedChatManager._replaceMessageList(defaultOl, $html);
  }

  static _waitForChatOl($html) {
    return new Promise((resolve) => {
      const observer = new MutationObserver((mutations, obs) => {
        const ol = $html.find('ol.chat-messages') || $html.find('.chat-messages-container ol') || $html.find('ol');
        if (ol.length) {
          console.log(`${MODULE_ID}: Chat OL detected by observer`);
          obs.disconnect();
          resolve();
        }
      });
      observer.observe($html[0], { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        console.warn(`${MODULE_ID}: Observer timeout`);
        resolve();
      }, 10000);
    });
  }

  static _replaceMessageList(defaultOl, $html) {
    // Keep the original ol.chat-messages but hide it completely
    defaultOl.css({
      'display': 'none !important',
      'height': '0 !important', 
      'overflow': 'hidden !important',
      'position': 'absolute',
      'visibility': 'hidden'
    });
    
    // CORRECT tab order: WORLD, OOC, GAME, MESSAGES
    const tabs = [
      { id: 'ic', label: 'WORLD' },
      { id: 'ooc', label: 'OOC' },
      { id: 'rolls', label: 'GAME' },
      { id: 'messages', label: 'MESSAGES' }
    ];
    
    const tabHtml = `
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
        .tabchat-nav {
          display: flex;
          align-items: center;
          background: rgba(0, 0, 0, 0.8);
          border-bottom: 2px solid #444;
          padding: 0;
          margin: 0;
        }
        .tabchat-tab {
          flex: 1;
          padding: 12px 8px;
          text-align: center;
          background: rgba(0, 0, 0, 0.5);
          color: #ccc;
          text-decoration: none;
          font-size: 16px;
          font-weight: bold;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .tabchat-tab:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        .tabchat-tab.active {
          background: rgba(255, 255, 255, 0.15);
          color: #fff;
          border-bottom: 3px solid #4CAF50;
        }
        .tabchat-separator {
          width: 2px;
          height: 40px;
          background: #666;
          margin: 0;
        }
        .tabchat-panel {
          display: none;
          height: 100%;
        }
        .tabchat-panel.active {
          display: block;
        }
        .tabchat-panel ol.chat-messages {
          height: 100%;
          overflow-y: auto;
          margin: 0;
          padding: 0;
        }
        .tabchat-container {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .tabbed-messages-highlight {
          animation: messageHighlight 2.5s ease-out;
        }
        @keyframes messageHighlight {
          0% { background-color: rgba(76, 175, 80, 0.3); }
          100% { background-color: transparent; }
        }
      </style>
    `;
    
    // Insert tabbed interface AFTER the original ol
    defaultOl.after(tabHtml);
    console.log(`${MODULE_ID}: ENHANCED - Added tabbed interface with order: WORLD | OOC | GAME | MESSAGES`);

    // Cache tab panels (updated to use 'messages' instead of 'whisper')
    ['ic', 'ooc', 'rolls', 'messages'].forEach((tab) => {
      const panel = $html.find(`.tabchat-panel[data-tab="${tab}"] ol.chat-messages`);
      TabbedChatManager.tabPanels[tab] = panel;
      console.log(`${MODULE_ID}: Cached panel for ${tab}`, { exists: panel.length > 0 });
    });

    // Add click handlers
    $html.find('.tabchat-nav').on('click', '.tabchat-tab', (event) => {
      const tabName = event.currentTarget.dataset.tab;
      TabbedChatManager._activateTab(tabName, $html);
    });

    console.log(`${MODULE_ID}: Enhanced tabs setup complete`);
  }

  static async renderMessage(message, $html) {
    if (!message || typeof message !== 'object') {
      console.error(`${MODULE_ID}: Invalid message object`);
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
      messageScene: messageScene,
      content: message.content?.substring(0, 30) + '...'
    });
    
    // Enhanced filtering logic
    let shouldRender = TabbedChatManager._shouldRenderMessage(message, tab, currentScene, currentUserId, messageAuthor);
    
    if (!shouldRender) {
      console.log(`${MODULE_ID}: Skipping message - filtered out`);
      return;
    }
    
    console.log(`${MODULE_ID}: ✅ RENDERING message to ${tab} tab`);
    
    if (tab && TabbedChatManager.tabPanels[tab]?.length) {
      // Process /b command - remove /b and add OOC prefix
      if (message.content?.startsWith('/b ')) {
        msgHtml.find('.message-content').each(function() {
          const content = $(this).html();
          $(this).html(content.replace('/b ', '[OOC] '));
        });
      }
      
      TabbedChatManager.tabPanels[tab].append(msgHtml);
      
      // Store message in appropriate scene (except for messages tab which is global)
      if (tab !== 'messages') {
        TabbedChatManager._initializeSceneMessages(messageScene);
        TabbedChatManager.sceneMessages[messageScene][tab].push(msgHtml.clone());
      }
      
      // Add highlight effect
      msgHtml.addClass('tabbed-messages-highlight');
      setTimeout(() => msgHtml.removeClass('tabbed-messages-highlight'), 2500);
      
      // Only scroll if this is the active tab
      if (TabbedChatManager._activeTab === tab) {
        setTimeout(() => {
          TabbedChatManager._scrollToLastMessage($html, tab);
        }, 50);
      }
    } else {
      console.warn(`${MODULE_ID}: No valid tab panel for ${tab}`);
    }
  }

  static _getMessageTab(message) {
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
      // WORLD/OOC/GAME: Show if same scene OR if user is author
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
        existing.replaceWith(msgHtml);
        
        // Update stored message for scene instancing (except messages tab)
        if (tab !== 'messages') {
          TabbedChatManager._initializeSceneMessages(messageScene);
          const storedMessages = TabbedChatManager.sceneMessages[messageScene][tab];
          const msgIndex = storedMessages.findIndex(msg => 
            msg.find(`[data-message-id="${message.id}"]`).length > 0
          );
          if (msgIndex !== -1) {
            storedMessages[msgIndex] = msgHtml.clone();
          }
        }
        
        if (TabbedChatManager._activeTab === tab) {
          TabbedChatManager._scrollToLastMessage($html, tab);
        }
      }
    }
  }

  static deleteMessage(messageId, $html) {
    ['ic', 'ooc', 'rolls', 'messages'].forEach((tab) => {
      // Remove from display
      TabbedChatManager.tabPanels[tab]?.find(`[data-message-id="${messageId}"]`).remove();
      
      // Remove from stored messages (except messages tab)
      if (tab !== 'messages') {
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
    
    // Scroll to last message when switching tabs
    setTimeout(() => {
      TabbedChatManager._scrollToLastMessage($html, tabName);
    }, 50);
  }

  static _scrollToLastMessage($html, tabName = TabbedChatManager._activeTab) {
    const ol = $html.find(`.tabchat-panel[data-tab="${tabName}"] ol.chat-messages`);
    if (ol?.length) {
      const messages = ol.find('.chat-message');
      if (messages.length > 0) {
        // Scroll to the last message
        const lastMessage = messages.last();
        ol.animate({
          scrollTop: ol[0].scrollHeight
        }, 300, () => {
          // Center on the last message
          const messageOffset = lastMessage.position();
          if (messageOffset) {
            const containerHeight = ol.height();
            const messageHeight = lastMessage.outerHeight();
            const centerOffset = containerHeight / 2 - messageHeight / 2;
            const newScrollTop = ol.scrollTop() + messageOffset.top - centerOffset;
            
            if (newScrollTop > 0) {
              ol.animate({ scrollTop: newScrollTop }, 200);
            }
          }
        });
      }
    }
  }
}

// Module Initialization
Hooks.once('init', TabbedChatManager.init);
Hooks.once('ready', TabbedChatManager.ready);

// Setup hooks after everything is defined
TabbedChatManager.setupHooks();
