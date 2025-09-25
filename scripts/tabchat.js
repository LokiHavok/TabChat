// Tabbed Chat Module for Foundry VTT v13 - WORKING VERSION
// 4-tab system: WORLD | OOC | GAME | MESSAGES

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  static tabPanels = {};
  static _activeTab = 'world';
  static _initialized = false;
  static _hasInjectedTabs = false;
  static _currentScene = null;

  static init() {
    console.log(`${MODULE_ID} | WORKING VERSION - Init called`);
  }

  static ready() {
    if (TabbedChatManager._initialized) return;
    TabbedChatManager._initialized = true;
    console.log(`${MODULE_ID} | WORKING VERSION - Ready called`);
    
    TabbedChatManager._currentScene = canvas?.scene?.id || 'default';
    
    // Load existing messages after short delay
    setTimeout(() => {
      try {
        if (!TabbedChatManager._hasInjectedTabs) {
          console.warn(`${MODULE_ID}: Tabs not ready for existing messages`);
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
        console.error(`${MODULE_ID}: Error rendering existing messages`, err);
      }
    }, 1000);
  }

  static setupHooks() {
    console.log(`${MODULE_ID} | WORKING VERSION - Setting up hooks`);
    
    // Inject tabs when chat renders
    Hooks.on('renderChatLog', async (app, html, data) => {
      // Wait for other modules to finish
      setTimeout(async () => {
        await TabbedChatManager.injectTabs(app, html, data);
      }, 200);
    });
    
    // Handle scene changes
    Hooks.on('canvasReady', (canvas) => {
      const newScene = canvas?.scene?.id || 'default';
      if (TabbedChatManager._currentScene !== newScene) {
        console.log(`${MODULE_ID}: Scene changed from ${TabbedChatManager._currentScene} to ${newScene}`);
        TabbedChatManager._currentScene = newScene;
        TabbedChatManager._refreshSceneTabs();
      }
    });
    
    // Handle /b commands
    Hooks.on('preCreateChatMessage', (doc, data, options, userId) => {
      try {
        const content = String(data.content || '');
        console.log(`${MODULE_ID}: preCreateChatMessage`, { content: content.substring(0, 30) });
        
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
    
    // Handle new messages
    Hooks.on('createChatMessage', async (message) => {
      console.log(`${MODULE_ID}: createChatMessage hook fired`, { id: message.id });
      if (TabbedChatManager._hasInjectedTabs) {
        await TabbedChatManager.renderMessage(message, $(ui.chat.element));
      }
    });
    
    // Handle message updates
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
    
    // Handle message deletion
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
      console.log(`${MODULE_ID}: Invalid HTML type`);
      return;
    }

    const $html = $(html);
    console.log(`${MODULE_ID}: WORKING VERSION - Injecting tabs`);

    let defaultOl = $html.find('ol.chat-messages').first();
    if (!defaultOl.length) {
      defaultOl = $html.find('ol').first();
    }
    
    if (!defaultOl.length) {
      console.error(`${MODULE_ID}: No chat <ol> found`);
      return;
    }

    try {
      TabbedChatManager._createTabbedInterface(defaultOl, $html);
      TabbedChatManager._hasInjectedTabs = true;
      console.log(`${MODULE_ID}: ✅ Successfully injected tabs`);
    } catch (err) {
      console.error(`${MODULE_ID}: Error injecting tabs:`, err);
    }
  }

  static _createTabbedInterface(defaultOl, $html) {
    // Hide original but keep it for compatibility
    defaultOl.css({
      'position': 'absolute',
      'top': '-10000px',
      'left': '-10000px',
      'width': '1px',
      'height': '1px',
      'opacity': '0',
      'pointer-events': 'none',
      'overflow': 'hidden'
    });
    
    // Remove any existing tabchat styles
    $('#tabchat-styles').remove();
    
    // Add comprehensive CSS
    const tabStyles = `
      <style id="tabchat-styles">
        .tabchat-container {
          height: 100%;
          display: flex !important;
          flex-direction: column !important;
          position: relative;
          z-index: 100;
          background: transparent;
        }
        
        .tabchat-nav {
          display: flex !important;
          flex-direction: row !important;
          flex-shrink: 0 !important;
          background: #2c2c2c !important;
          border-bottom: 2px solid #4a9eff !important;
          margin: 0 !important;
          padding: 0 !important;
          min-height: 40px !important;
        }
        
        .tabchat-tab {
          flex: 1 !important;
          padding: 10px 8px !important;
          cursor: pointer !important;
          background: #1a1a1a !important;
          color: #999 !important;
          border-right: 1px solid #444 !important;
          border-left: none !important;
          border-top: none !important;
          border-bottom: none !important;
          user-select: none !important;
          transition: all 0.2s ease !important;
          font-weight: bold !important;
          font-size: 11px !important;
          text-transform: uppercase !important;
          text-align: center !important;
          letter-spacing: 0.5px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          position: relative !important;
        }
        
        .tabchat-tab:last-child {
          border-right: none !important;
        }
        
        .tabchat-tab:hover {
          background: #333 !important;
          color: #ccc !important;
        }
        
        .tabchat-tab.active {
          background: #4a9eff !important;
          color: #fff !important;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.3) !important;
        }
        
        .tabchat-panel {
          flex: 1 !important;
          display: none !important;
          flex-direction: column !important;
          overflow: hidden !important;
          background: transparent !important;
          position: relative !important;
          height: 100% !important;
        }
        
        .tabchat-panel.active {
          display: flex !important;
        }
        
        .tabchat-panel ol.chat-messages {
          flex: 1 !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          padding: 5px !important;
          margin: 0 !important;
          list-style: none !important;
          background: transparent !important;
          height: 100% !important;
          max-height: none !important;
        }
        
        .tabchat-highlight {
          animation: tabchat-glow 2s ease-out !important;
        }
        
        @keyframes tabchat-glow {
          0% { 
            background-color: rgba(74, 158, 255, 0.3) !important;
          }
          100% { 
            background-color: transparent !important;
          }
        }
        
        .scene-indicator {
          position: absolute;
          top: 2px;
          right: 5px;
          font-size: 8px;
          color: #4a9eff;
          opacity: 0.6;
          pointer-events: none;
        }
      </style>
    `;
    
    $('head').append(tabStyles);
    
    // Get scene info
    const sceneName = canvas?.scene?.name || 'No Scene';
    const sceneId = TabbedChatManager._currentScene || 'default';
    
    // Create tabbed interface HTML - CORRECT ORDER: WORLD | OOC | GAME | MESSAGES
    const tabHtml = `
      <div class="tabchat-container" data-module="tabchat" data-scene="${sceneId}">
        <div class="scene-indicator">${sceneName}</div>
        <nav class="tabchat-nav">
          <div class="tabchat-tab active" data-tab="world">WORLD</div>
          <div class="tabchat-tab" data-tab="ooc">OOC</div>
          <div class="tabchat-tab" data-tab="game">GAME</div>
          <div class="tabchat-tab" data-tab="messages">MESSAGES</div>
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
    
    // Insert tabs safely
    try {
      const parent = defaultOl.parent();
      parent.append(tabHtml);
      console.log(`${MODULE_ID}: Added tabbed interface to parent`);
    } catch (err) {
      defaultOl.after(tabHtml);
      console.log(`${MODULE_ID}: Added tabbed interface after OL`);
    }

    // Cache panels by scene
    const sceneKey = TabbedChatManager._currentScene || 'default';
    if (!TabbedChatManager.tabPanels[sceneKey]) {
      TabbedChatManager.tabPanels[sceneKey] = {};
    }
    
    ['world', 'ooc', 'game', 'messages'].forEach((tab) => {
      const panel = $html.find(`.tabchat-panel[data-tab="${tab}"] ol.chat-messages`);
      TabbedChatManager.tabPanels[sceneKey][tab] = panel;
      console.log(`${MODULE_ID}: Cached panel for ${tab} in scene ${sceneKey}`, { exists: panel.length > 0 });
    });

    // Set up click handlers
    $html.find('.tabchat-nav').off('click.tabchat').on('click.tabchat', '.tabchat-tab', function(event) {
      event.preventDefault();
      event.stopPropagation();
      
      const $tab = $(this);
      const tabName = $tab.data('tab');
      
      console.log(`${MODULE_ID}: Tab clicked: ${tabName}`);
      
      // Update tab appearances
      $html.find('.tabchat-tab').removeClass('active');
      $tab.addClass('active');
      
      // Show/hide panels
      $html.find('.tabchat-panel').removeClass('active');
      $html.find(`.tabchat-panel[data-tab="${tabName}"]`).addClass('active');
      
      TabbedChatManager._activeTab = tabName;
      
      // Scroll to bottom
      setTimeout(() => {
        const panel = $html.find(`.tabchat-panel[data-tab="${tabName}"] ol.chat-messages`);
        if (panel.length) {
          const scrollEl = panel[0];
          scrollEl.scrollTop = scrollEl.scrollHeight;
        }
      }, 50);
      
      console.log(`${MODULE_ID}: ✅ Activated tab ${tabName}`);
    });
    
    console.log(`${MODULE_ID}: ✅ Click handlers attached`);
  }

  static async renderMessage(message, $html) {
    if (!message || !TabbedChatManager._hasInjectedTabs) {
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

    const msgHtml = $(rendered);
    const tab = TabbedChatManager._getMessageTab(message);
    const sceneKey = TabbedChatManager._getMessageScene(message);
    
    console.log(`${MODULE_ID}: Processing message for ${tab} tab in scene ${sceneKey}`, {
      id: message.id,
      content: (message.content || '').substring(0, 30)
    });
    
    // Check if message should be rendered
    if (!TabbedChatManager._shouldRenderMessage(message, tab, sceneKey)) {
      console.log(`${MODULE_ID}: Skipping message - filtered out`);
      return;
    }
    
    // Get the correct panel
    const panels = TabbedChatManager.tabPanels[sceneKey];
    if (!panels || !panels[tab] || !panels[tab].length) {
      console.warn(`${MODULE_ID}: No panel found for ${tab} in scene ${sceneKey}`);
      return;
    }
    
    const panel = panels[tab];
    
    try {
      // Special processing for WORLD tab - replace token name with actor name
      if (tab === 'world' && message.speaker?.token) {
        const tokenDoc = canvas?.scene?.tokens?.get(message.speaker.token);
        if (tokenDoc?.actor && tokenDoc.actor.name !== tokenDoc.name) {
          const actorName = tokenDoc.actor.name;
          const tokenName = tokenDoc.name;
          
          msgHtml.find('*').each(function() {
            const $this = $(this);
            if ($this.text().includes(tokenName)) {
              $this.html($this.html().replace(new RegExp(tokenName, 'g'), actorName));
            }
          });
          
          console.log(`${MODULE_ID}: Replaced "${tokenName}" with "${actorName}"`);
        }
      }
      
      // Add message to panel
      panel.append(msgHtml);
      
      // Add highlight effect
      msgHtml.addClass('tabchat-highlight');
      setTimeout(() => msgHtml.removeClass('tabchat-highlight'), 2000);
      
      // Auto-scroll if this is the active tab
      if (TabbedChatManager._activeTab === tab) {
        setTimeout(() => {
          const scrollEl = panel[0];
          scrollEl.scrollTop = scrollEl.scrollHeight;
        }, 50);
      }
      
      console.log(`${MODULE_ID}: ✅ RENDERED message to ${tab} tab`);
      
    } catch (err) {
      console.error(`${MODULE_ID}: Error appending message:`, err);
    }
  }

  static _getMessageTab(message) {
    try {
      // GAME: All rolls
      if (message.isRoll || message.rolls?.length > 0) {
        return 'game';
      }
      
      // MESSAGES: All whispers
      if (message.whisper?.length > 0) {
        return 'messages';
      }
      
      // OOC: /b command or no token
      if (message._tabchatOOC || (typeof message.content === 'string' && message.content.includes('[OOC]'))) {
        return 'ooc';
      }
      
      // WORLD: Has token speaker
      if (message.speaker?.token) {
        return 'world';
      }
      
      // Default: OOC
      return 'ooc';
      
    } catch (err) {
      console.error(`${MODULE_ID}: Error determining message tab:`, err);
      return 'ooc';
    }
  }

  static _getMessageScene(message) {
    // MESSAGES are global
    if (message.whisper?.length > 0) {
      return TabbedChatManager._currentScene || 'default';
    }
    
    // Others use message scene or current scene
    return message.speaker?.scene || TabbedChatManager._currentScene || 'default';
  }

  static _shouldRenderMessage(message, tab, sceneKey) {
    try {
      const currentUserId = game.user.id;
      const messageAuthor = message.author?.id;
      
      if (tab === 'messages') {
        // MESSAGES: GM sees all, players see only theirs
        if (game.user.isGM) return true;
        const whisperTargets = message.whisper || [];
        const isAuthor = messageAuthor === currentUserId;
        const isTarget = whisperTargets.includes(currentUserId);
        return isAuthor || isTarget;
      } else {
        // Others: same scene OR authored by user
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
    if (!TabbedChatManager._hasInjectedTabs) return;
    
    const $html = $(ui.chat.element);
    const sceneKey = TabbedChatManager._currentScene || 'default';
    
    // Initialize panels for new scene
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
        }
      }
    } catch (err) {
      console.error(`${MODULE_ID}: Error updating message:`, err);
    }
  }

  static deleteMessage(messageId, $html) {
    try {
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
}

// Module Initialization
Hooks.once('init', TabbedChatManager.init);
Hooks.once('ready', TabbedChatManager.ready);
TabbedChatManager.setupHooks();
