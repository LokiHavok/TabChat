// Tabbed Chat Module for Foundry VTT v13 - SCENE-AWARE VERSION
// 4-tab system: WORLD | OOC | GAME | MESSAGES with scene separation

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  static tabPanels = {};
  static _activeTab = 'world';
  static _initialized = false;
  static _hasInjectedTabs = false;
  static _currentScene = null;

  static init() {
    console.log(`${MODULE_ID} | SCENE-AWARE - Init called`);
    
    // Store original methods
    try {
      const ChatLogClass = foundry.applications.sidebar.tabs.ChatLog;
      if (!ChatLogClass.prototype._tabchat_originalPostOne) {
        ChatLogClass.prototype._tabchat_originalPostOne = ChatLogClass.prototype._postOne;
        console.log(`${MODULE_ID} | Stored original ChatLog._postOne`);
      }
    } catch (err) {
      console.error(`${MODULE_ID} | Failed to store ChatLog prototype:`, err);
    }
  }

  static ready() {
    if (TabbedChatManager._initialized) {
      console.log(`${MODULE_ID} | Already initialized, skipping`);
      return;
    }
    TabbedChatManager._initialized = true;
    console.log(`${MODULE_ID} | SCENE-AWARE - Ready called`);
    
    // Track current scene
    TabbedChatManager._currentScene = canvas?.scene?.id || null;
    
    // Store original ui.chat method
    try {
      if (ui.chat && typeof ui.chat._postOne === 'function') {
        if (!ui.chat._tabchat_originalPostOne) {
          ui.chat._tabchat_originalPostOne = ui.chat._postOne;
          console.log(`${MODULE_ID} | Stored original ui.chat._postOne`);
        }
      }
    } catch (err) {
      console.warn(`${MODULE_ID} | Failed to store ui.chat._postOne`, err);
    }
    
    // Load existing messages after tabs are ready
    setTimeout(() => {
      try {
        if (!ui.chat?.element || !TabbedChatManager._hasInjectedTabs) {
          console.warn(`${MODULE_ID}: UI or tabs not ready for existing messages`);
          return;
        }
        const $html = $(ui.chat.element);
        const messages = game.messages.contents.sort((a, b) => a.timestamp - b.timestamp);
        console.log(`${MODULE_ID}: Loading ${messages.length} existing messages`);
        
        for (const message of messages) {
          TabbedChatManager.renderMessage(message, $html);
        }
        console.log(`${MODULE_ID}: Finished loading existing messages`);
      } catch (err) {
        console.error(`${MODULE_ID} | Error rendering existing messages`, err);
      }
    }, 2000);
  }

  static setupHooks() {
    console.log(`${MODULE_ID} | SCENE-AWARE - Setting up hooks`);
    
    // Inject tabs immediately when chat renders
    Hooks.on('renderChatLog', async (app, html, data) => {
      await TabbedChatManager.injectTabs(app, html, data);
    });
    
    // Handle scene changes for scene-specific tabs
    Hooks.on('canvasReady', (canvas) => {
      const newScene = canvas?.scene?.id || null;
      if (TabbedChatManager._currentScene !== newScene) {
        console.log(`${MODULE_ID}: Scene changed from ${TabbedChatManager._currentScene} to ${newScene}`);
        TabbedChatManager._currentScene = newScene;
        TabbedChatManager._refreshSceneTabs();
      }
    });
    
    // Handle /b commands and other preprocessing
    Hooks.on('preCreateChatMessage', (doc, data, options, userId) => {
      try {
        // Ensure content is a string
        const content = typeof data.content === 'string' ? data.content : String(data.content || '');
        
        console.log(`${MODULE_ID}: preCreateChatMessage`, { content: content.substring(0, 30) });
        
        // Handle /b command for OOC bypass
        if (content.startsWith('/b ')) {
          data.content = '[OOC] ' + content.substring(3);
          data.style = CONST.CHAT_MESSAGE_STYLES.OTHER;
          doc.updateSource({ _tabchatOOC: true });
          console.log(`${MODULE_ID}: Processed /b command`);
        }
      } catch (err) {
        console.error(`${MODULE_ID}: Error in preCreateChatMessage`, err);
      }
    });
    
    // Suppress default rendering when tabbed UI is active
    Hooks.on('renderChatMessageHTML', (message, html, data) => {
      try {
        const hasTabUI = ui.chat?.element && $(ui.chat.element).find('.tabchat-container').length > 0;
        if (hasTabUI) {
          console.log(`${MODULE_ID}: Suppressing default render for message ${message.id}`);
          return false;
        }
      } catch (err) {
        console.error(`${MODULE_ID}: Error in renderChatMessageHTML hook`, err);
      }
      return true;
    });
    
    Hooks.on('createChatMessage', async (message) => {
      console.log(`${MODULE_ID}: createChatMessage hook fired`, { id: message.id });
      if (TabbedChatManager._hasInjectedTabs) {
        await TabbedChatManager.renderMessage(message, $(ui.chat.element));
      }
    });
    
    Hooks.on('updateChatMessage', async (message, update, options, userId) => {
      if (TabbedChatManager._hasInjectedTabs) {
        try {
          const msgHtml = $(await message.renderHTML());
          await TabbedChatManager.updateMessage(message, msgHtml, $(ui.chat.element));
        } catch (err) {
          console.error(`${MODULE_ID}: Error updating message`, err);
        }
      }
    });
    
    Hooks.on('deleteChatMessage', (message, options, userId) => {
      if (TabbedChatManager._hasInjectedTabs) {
        TabbedChatManager.deleteMessage(message.id, $(ui.chat.element));
      }
    });
  }

  static async injectTabs(app, html, data) {
    if (TabbedChatManager._hasInjectedTabs) {
      console.log(`${MODULE_ID}: Tabs already injected, skipping`);
      return;
    }

    if (!(html instanceof HTMLElement)) {
      console.log(`${MODULE_ID}: Skipping injection - invalid HTML type`);
      return;
    }

    const $html = $(html);
    console.log(`${MODULE_ID}: SCENE-AWARE - Injecting tabs`);

    let defaultOl = $html.find('ol.chat-messages');
    if (!defaultOl.length) {
      defaultOl = $html.find('.chat-messages-container ol, ol').first();
    }
    
    if (!defaultOl.length) {
      console.warn(`${MODULE_ID}: No chat <ol> found, waiting`);
      await TabbedChatManager._waitForChatOl($html);
      defaultOl = $html.find('ol.chat-messages, .chat-messages-container ol, ol').first();
      if (!defaultOl.length) {
        console.error(`${MODULE_ID}: Failed to find chat OL`);
        return;
      }
    }

    try {
      TabbedChatManager._replaceMessageList(defaultOl, $html);
      TabbedChatManager._hasInjectedTabs = true;
      
      // Apply rendering suppression after successful injection
      setTimeout(() => {
        TabbedChatManager._applyRenderingPatches();
      }, 100);
      
      console.log(`${MODULE_ID}: ✅ Successfully injected tabs`);
    } catch (err) {
      console.error(`${MODULE_ID}: Error injecting tabs:`, err);
    }
  }

  static _waitForChatOl($html) {
    return new Promise((resolve) => {
      const observer = new MutationObserver((mutations, obs) => {
        const ol = $html.find('ol.chat-messages, .chat-messages-container ol, ol');
        if (ol.length) {
          console.log(`${MODULE_ID}: Chat OL detected`);
          obs.disconnect();
          resolve();
        }
      });
      observer.observe($html[0], { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 5000);
    });
  }

  static _replaceMessageList(defaultOl, $html) {
    // Move original ol off-screen but keep it for other modules
    defaultOl.css({
      'position': 'absolute',
      'top': '-9999px',
      'left': '-9999px',
      'width': '1px',
      'height': '1px',
      'opacity': '0',
      'pointer-events': 'none'
    });
    
    // Enhanced CSS with better visibility and functionality
    const tabStyles = `
      <style id="tabchat-styles-scene">
        .tabchat-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          position: relative;
          z-index: 10;
          background: transparent;
        }
        .tabchat-nav {
          display: flex;
          flex-direction: row;
          flex-shrink: 0;
          background: linear-gradient(135deg, rgba(0,0,0,0.6), rgba(0,0,0,0.4));
          border-bottom: 2px solid #4a9eff;
          box-shadow: 0 3px 8px rgba(0,0,0,0.4);
          border-radius: 8px 8px 0 0;
          padding: 0;
          margin-bottom: 2px;
        }
        .tabchat-tab {
          padding: 12px 18px;
          cursor: pointer;
          background: rgba(0,0,0,0.4);
          color: #bbb;
          border-right: 1px solid #555;
          user-select: none;
          transition: all 0.3s ease;
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          position: relative;
          flex: 1;
          text-align: center;
        }
        .tabchat-tab:first-child {
          border-radius: 8px 0 0 0;
        }
        .tabchat-tab:last-child {
          border-right: none;
          border-radius: 0 8px 0 0;
        }
        .tabchat-tab:hover {
          background: rgba(74, 158, 255, 0.2);
          color: #fff;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(74, 158, 255, 0.3);
        }
        .tabchat-tab.active {
          background: linear-gradient(135deg, rgba(74, 158, 255, 0.4), rgba(74, 158, 255, 0.3));
          color: #fff;
          font-weight: bold;
          box-shadow: inset 0 -4px 0 #4a9eff, 0 2px 8px rgba(74, 158, 255, 0.4);
        }
        .tabchat-tab.active::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          right: 0;
          height: 2px;
          background: #4a9eff;
        }
        .tabchat-panel {
          flex: 1;
          display: none;
          flex-direction: column;
          overflow: hidden;
          background: rgba(0,0,0,0.05);
          border-radius: 0 0 8px 8px;
          position: relative;
        }
        .tabchat-panel.active {
          display: flex !important;
        }
        .tabchat-panel ol.chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
          margin: 0;
          list-style: none;
          background: transparent;
        }
        .tabchat-highlight {
          animation: tabchat-glow 3s ease-out;
        }
        @keyframes tabchat-glow {
          0% { 
            background-color: rgba(74, 158, 255, 0.4) !important;
            box-shadow: 0 0 15px rgba(74, 158, 255, 0.6);
          }
          100% { 
            background-color: transparent !important;
            box-shadow: none;
          }
        }
        .scene-indicator {
          position: absolute;
          top: 4px;
          right: 8px;
          font-size: 9px;
          color: #4a9eff;
          opacity: 0.7;
        }
      </style>
    `;
    
    // Add styles
    if (!$('#tabchat-styles-scene').length) {
      $('head').append(tabStyles);
    }
    
    // Get current scene name for indicator
    const sceneName = canvas?.scene?.name || 'No Scene';
    
    const tabHtml = `
      <div class="tabchat-container" data-module="tabchat" data-scene="${TabbedChatManager._currentScene || 'none'}">
        <div class="scene-indicator">${sceneName}</div>
        <nav class="tabchat-nav">
          <a class="tabchat-tab active" data-tab="world">WORLD</a>
          <a class="tabchat-tab" data-tab="ooc">OOC</a>
          <a class="tabchat-tab" data-tab="game">GAME</a>
          <a class="tabchat-tab" data-tab="messages">MESSAGES</a>
        </nav>
        <section class="tabchat-panel active" data-tab="world">
          <ol class="chat-messages"></ol>
        </section>
        <section class="tabchat-panel" data-tab="ooc">
          <ol class="chat-messages"></ol>
        </section>
        <section class="tabchat-panel" data-tab="game">
          <ol class="chat-messages"></ol>
        </section>
        <section class="tabchat-panel" data-tab="messages">
          <ol class="chat-messages"></ol>
        </section>
      </div>
    `;
    
    // Insert tabs using the safest method
    try {
      const chatContainer = defaultOl.parent();
      if (chatContainer && chatContainer.length) {
        chatContainer.append(tabHtml);
        console.log(`${MODULE_ID}: Injected tabs into chat container`);
      } else {
        defaultOl.after(tabHtml);
        console.log(`${MODULE_ID}: Injected tabs after OL`);
      }
    } catch (err) {
      console.error(`${MODULE_ID}: Error inserting tab HTML:`, err);
      return;
    }

    // Cache tab panels by scene
    const sceneKey = TabbedChatManager._currentScene || 'default';
    TabbedChatManager.tabPanels[sceneKey] = {};
    
    ['world', 'ooc', 'game', 'messages'].forEach((tab) => {
      const panel = $html.find(`.tabchat-panel[data-tab="${tab}"] ol.chat-messages`);
      TabbedChatManager.tabPanels[sceneKey][tab] = panel;
      console.log(`${MODULE_ID}: Cached panel for ${tab} in scene ${sceneKey}`, { exists: panel.length > 0 });
    });

    // Set up click handlers
    try {
      $html.find('.tabchat-nav').off('click.tabchat').on('click.tabchat', '.tabchat-tab', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const tabName = $(event.currentTarget).data('tab');
        console.log(`${MODULE_ID}: Tab clicked: ${tabName}`);
        TabbedChatManager._activateTab(tabName, $html);
      });
      console.log(`${MODULE_ID}: ✅ Click handlers attached`);
    } catch (err) {
      console.error(`${MODULE_ID}: Error setting up click handlers:`, err);
    }
  }

  static _applyRenderingPatches() {
    try {
      // Apply patches to suppress default rendering
      const ChatLogClass = foundry.applications.sidebar.tabs.ChatLog;
      if (ChatLogClass.prototype._tabchat_originalPostOne && !ChatLogClass.prototype._tabchat_patched) {
        ChatLogClass.prototype._postOne = async function (...args) {
          const $el = this?.element ? $(this.element) : null;
          if ($el && $el.find('.tabchat-container').length) {
            return; // Suppress when tabchat is active
          }
          return await ChatLogClass.prototype._tabchat_originalPostOne.apply(this, args);
        };
        ChatLogClass.prototype._tabchat_patched = true;
        console.log(`${MODULE_ID} | Applied ChatLog patch`);
      }

      if (ui.chat && ui.chat._tabchat_originalPostOne && !ui.chat._tabchat_patched) {
        ui.chat._postOne = async function (...args) {
          const $el = this?.element ? $(this.element) : null;
          if ($el && $el.find('.tabchat-container').length) {
            return; // Suppress when tabchat is active
          }
          return await ui.chat._tabchat_originalPostOne.apply(this, args);
        };
        ui.chat._tabchat_patched = true;
        console.log(`${MODULE_ID} | Applied ui.chat patch`);
      }
    } catch (err) {
      console.error(`${MODULE_ID} | Failed to apply rendering patches:`, err);
    }
  }

  static async renderMessage(message, $html) {
    if (!message || typeof message !== 'object') {
      console.error(`${MODULE_ID}: Invalid message object`);
      return;
    }

    if (!TabbedChatManager._hasInjectedTabs) {
      console.log(`${MODULE_ID}: Tabs not ready, skipping render`);
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
    const sceneKey = TabbedChatManager._getMessageScene(message);
    
    console.log(`${MODULE_ID}: Processing message for ${tab} tab in scene ${sceneKey}`, {
      id: message.id,
      author: message.author?.id,
      hasToken: !!message.speaker?.token
    });
    
    // Check if message should be rendered
    if (!TabbedChatManager._shouldRenderMessage(message, tab, sceneKey)) {
      console.log(`${MODULE_ID}: Skipping message - filtered out`);
      return;
    }
    
    // Get the correct panel for this scene
    const panel = TabbedChatManager.tabPanels[sceneKey]?.[tab];
    if (!panel?.length) {
      console.warn(`${MODULE_ID}: No panel found for ${tab} in scene ${sceneKey}`);
      return;
    }
    
    console.log(`${MODULE_ID}: ✅ RENDERING message to ${tab} tab`);
    
    try {
      // Special processing for WORLD tab - replace token name with actor name
      if (tab === 'world' && message.speaker?.token) {
        const tokenDoc = canvas?.scene?.tokens?.get(message.speaker.token);
        if (tokenDoc?.actor && tokenDoc.actor.name !== tokenDoc.name) {
          const actorName = tokenDoc.actor.name;
          const tokenName = tokenDoc.name;
          
          msgHtml.find('.message-sender, .sender-name, .speaker-name, .message-sender-name').each(function() {
            const $this = $(this);
            if ($this.text().includes(tokenName)) {
              $this.html($this.html().replace(new RegExp(tokenName, 'g'), actorName));
            }
          });
          
          console.log(`${MODULE_ID}: Replaced "${tokenName}" with "${actorName}" in WORLD tab`);
        }
      }
      
      // Add message to appropriate panel
      panel.append(msgHtml);
      
      // Add highlight effect
      msgHtml.addClass('tabchat-highlight');
      setTimeout(() => msgHtml.removeClass('tabchat-highlight'), 3000);
      
      // Auto-scroll if this is the active tab
      if (TabbedChatManager._activeTab === tab) {
        setTimeout(() => {
          TabbedChatManager._scrollToBottom($html, tab);
        }, 100);
      }
    } catch (err) {
      console.error(`${MODULE_ID}: Error appending message:`, err);
    }
  }

  static _getMessageTab(message) {
    try {
      // GAME: All rolls go here
      if (message.isRoll || message.rolls?.length > 0) {
        return 'game';
      }
      
      // MESSAGES: All whispers go here
      if (message.whisper?.length > 0) {
        return 'messages';
      }
      
      // OOC: Check for /b command bypass or no token
      if (message._tabchatOOC || (typeof message.content === 'string' && message.content.includes('[OOC]'))) {
        return 'ooc';
      }
      
      // WORLD: Has token speaker
      if (message.speaker?.token) {
        return 'world';
      }
      
      // Default: OOC for everything else (GM narration, player without token)
      return 'ooc';
      
    } catch (err) {
      console.error(`${MODULE_ID}: Error determining message tab:`, err);
      return 'ooc';
    }
  }

  static _getMessageScene(message) {
    // For MESSAGES tab, use current scene (global)
    if (message.whisper?.length > 0) {
      return TabbedChatManager._currentScene || 'default';
    }
    
    // For other tabs, use message scene or current scene
    const messageScene = message.speaker?.scene || TabbedChatManager._currentScene;
    return messageScene || 'default';
  }

  static _shouldRenderMessage(message, tab, sceneKey) {
    try {
      const currentUserId = game.user.id;
      const messageAuthor = message.author?.id;
      
      if (tab === 'messages') {
        // MESSAGES: GM sees all, players see only their own
        if (game.user.isGM) return true;
        const whisperTargets = message.whisper || [];
        const isAuthor = messageAuthor === currentUserId;
        const isTarget = whisperTargets.includes(currentUserId);
        return isAuthor || isTarget;
      } else {
        // Other tabs: Show if same scene OR if user is author
        const currentScene = TabbedChatManager._currentScene || 'default';
        const isSameScene = sceneKey === currentScene;
        const isAuthor = messageAuthor === currentUserId;
        return isSameScene || isAuthor;
      }
    } catch (err) {
      console.error(`${MODULE_ID}: Error in _shouldRenderMessage:`, err);
      return true;
    }
  }

  static _refreshSceneTabs() {
    // Clear messages from scene-specific tabs when scene changes
    if (!TabbedChatManager._hasInjectedTabs) return;
    
    const $html = $(ui.chat.element);
    const sceneKey = TabbedChatManager._currentScene || 'default';
    
    // Initialize panels for new scene if needed
    if (!TabbedChatManager.tabPanels[sceneKey]) {
      TabbedChatManager.tabPanels[sceneKey] = {};
      ['world', 'ooc', 'game', 'messages'].forEach((tab) => {
        const panel = $html.find(`.tabchat-panel[data-tab="${tab}"] ol.chat-messages`);
        TabbedChatManager.tabPanels[sceneKey][tab] = panel;
      });
    }
    
    // Clear scene-specific tabs (but not MESSAGES)
    ['world', 'ooc', 'game'].forEach(tab => {
      const panel = TabbedChatManager.tabPanels[sceneKey]?.[tab];
      if (panel?.length) {
        panel.empty();
      }
    });
    
    // Update scene indicator
    const sceneName = canvas?.scene?.name || 'No Scene';
    $html.find('.scene-indicator').text(sceneName);
    $html.find('.tabchat-container').attr('data-scene', sceneKey);
    
    // Re-render relevant messages for new scene
    setTimeout(() => {
      const messages = game.messages.contents.sort((a, b) => a.timestamp - b.timestamp);
      for (const message of messages) {
        const msgTab = TabbedChatManager._getMessageTab(message);
        const msgScene = TabbedChatManager._getMessageScene(message);
        
        // Only render messages for current scene (except MESSAGES which are global)
        if (msgTab === 'messages' || msgScene === sceneKey) {
          TabbedChatManager.renderMessage(message, $html);
        }
      }
    }, 100);
    
    console.log(`${MODULE_ID}: Refreshed tabs for scene ${sceneKey}`);
  }

  static async updateMessage(message, msgHtml, $html) {
    try {
      const tab = TabbedChatManager._getMessageTab(message);
      const sceneKey = TabbedChatManager._getMessageScene(message);
      const panel = TabbedChatManager.tabPanels[sceneKey]?.[tab];
      
      if (panel?.length) {
        const existing = panel.find(`[data-message-id="${message.id}"]`);
        if (existing.length) {
          existing.replaceWith(msgHtml);
          if (TabbedChatManager._activeTab === tab) {
            TabbedChatManager._scrollToBottom($html, tab);
          }
        }
      }
    } catch (err) {
      console.error(`${MODULE_ID}: Error updating message:`, err);
    }
  }

  static deleteMessage(messageId, $html) {
    try {
      // Remove from all scenes and tabs
      Object.keys(TabbedChatManager.tabPanels).forEach(sceneKey => {
        ['world', 'ooc', 'game', 'messages'].forEach(tab => {
          const panel = TabbedChatManager.tabPanels[sceneKey]?.[tab];
          panel?.find(`[data-message-id="${messageId}"]`).remove();
        });
      });
    } catch (err) {
      console.error(`${MODULE_ID}: Error deleting message:`, err);
    }
  }

  static _activateTab(tabName, $html) {
    try {
      console.log(`${MODULE_ID}: Activating tab: ${tabName}`);
      
      // Update tab appearances
      $html.find('.tabchat-tab').removeClass('active');
      $html.find(`.tabchat-tab[data-tab="${tabName}"]`).addClass('active');
      
      // Show/hide panels
      $html.find('.tabchat-panel').removeClass('active');
      $html.find(`.tabchat-panel[data-tab="${tabName}"]`).addClass('active');
      
      TabbedChatManager._activeTab = tabName;
      
      // Scroll to bottom
      setTimeout(() => {
        TabbedChatManager._scrollToBottom($html, tabName);
      }, 50);
      
      console.log(`${MODULE_ID}: ✅ Tab ${tabName} activated`);
    } catch (err) {
      console.error(`${MODULE_ID}: Error activating tab:`, err);
    }
  }

  static _scrollToBottom($html, tabName = TabbedChatManager._activeTab) {
    try {
      const ol = $html.find(`.tabchat-panel[data-tab="${tabName}"] ol.chat-messages`);
      if (ol?.length) {
        const scrollElement = ol[0];
        requestAnimationFrame(() => {
          scrollElement.scrollTop = scrollElement.scrollHeight;
        });
      }
    } catch (err) {
      console.error(`${MODULE_ID}: Error scrolling:`, err);
    }
  }
}

// Module Initialization
Hooks.once('init', TabbedChatManager.init);
Hooks.once('ready', TabbedChatManager.ready);

// Setup hooks immediately for proper tab injection
TabbedChatManager.setupHooks();
