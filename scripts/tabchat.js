// Tabbed Chat Module for Foundry VTT v13 - STABLE VERSION
// 4-tab system: WORLD | OOC | GAME | MESSAGES

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  static tabPanels = {};
  static _activeTab = 'world';
  static _initialized = false;
  static _hasInjectedTabs = false;
  static _currentScene = null;
  static _processing = false; // Prevent recursive processing

  static init() {
    console.log(`${MODULE_ID} | STABLE VERSION - Init called`);
  }

  static ready() {
    if (TabbedChatManager._initialized) return;
    TabbedChatManager._initialized = true;
    console.log(`${MODULE_ID} | STABLE VERSION - Ready called`);
    
    TabbedChatManager._currentScene = canvas?.scene?.id || 'default';
    
    // Load existing messages after tabs are ready
    setTimeout(() => {
      if (TabbedChatManager._hasInjectedTabs) {
        TabbedChatManager._loadExistingMessages();
      }
    }, 1000);
  }

  static _loadExistingMessages() {
    if (TabbedChatManager._processing) return;
    
    try {
      TabbedChatManager._processing = true;
      const $html = $(ui.chat.element);
      const messages = game.messages.contents.sort((a, b) => a.timestamp - b.timestamp);
      console.log(`${MODULE_ID}: Loading ${messages.length} existing messages`);
      
      for (const message of messages) {
        TabbedChatManager._renderMessageSafe(message, $html);
      }
      console.log(`${MODULE_ID}: Finished loading existing messages`);
    } catch (err) {
      console.error(`${MODULE_ID}: Error loading existing messages`, err);
    } finally {
      TabbedChatManager._processing = false;
    }
  }

  static setupHooks() {
    console.log(`${MODULE_ID} | STABLE VERSION - Setting up hooks`);
    
    // Inject tabs when chat renders
    Hooks.on('renderChatLog', async (app, html, data) => {
      if (!TabbedChatManager._hasInjectedTabs) {
        setTimeout(async () => {
          await TabbedChatManager.injectTabs(app, html, data);
        }, 300);
      }
    });
    
    // Handle scene changes
    Hooks.on('canvasReady', (canvas) => {
      const newScene = canvas?.scene?.id || 'default';
      if (TabbedChatManager._currentScene !== newScene) {
        console.log(`${MODULE_ID}: Scene changed to ${newScene}`);
        TabbedChatManager._currentScene = newScene;
      }
    });
    
    // Handle /b commands - with safety check
    Hooks.on('preCreateChatMessage', (doc, data, options, userId) => {
      if (TabbedChatManager._processing) return;
      
      try {
        const content = String(data.content || '');
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
    
    // Handle new messages - with safety check
    Hooks.on('createChatMessage', async (message) => {
      if (TabbedChatManager._processing || !TabbedChatManager._hasInjectedTabs) return;
      
      console.log(`${MODULE_ID}: New message created`, { id: message.id });
      TabbedChatManager._renderMessageSafe(message, $(ui.chat.element));
    });
  }

  static async injectTabs(app, html, data) {
    if (TabbedChatManager._hasInjectedTabs) {
      console.log(`${MODULE_ID}: Tabs already injected`);
      return;
    }

    if (!(html instanceof HTMLElement)) return;

    const $html = $(html);
    console.log(`${MODULE_ID}: STABLE VERSION - Injecting tabs`);

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
    // Hide original chat list but keep for compatibility
    defaultOl.css({
      'position': 'absolute',
      'top': '-10000px',
      'left': '-10000px',
      'width': '1px',
      'height': '1px',
      'opacity': '0',
      'pointer-events': 'none'
    });
    
    // Remove existing styles
    $('#tabchat-stable-styles').remove();
    
    // Add stable CSS with your preferred green color (#215112)
    const tabStyles = `
      <style id="tabchat-stable-styles">
        .tabchat-container {
          height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          position: relative !important;
          z-index: 100 !important;
          background: transparent !important;
        }
        
        .tabchat-nav {
          display: flex !important;
          flex-direction: row !important;
          flex-shrink: 0 !important;
          background: #1a1a1a !important;
          border-bottom: 2px solid #215112 !important;
          margin: 0 !important;
          padding: 0 !important;
          min-height: 40px !important;
          order: 0 !important;
        }
        
        .tabchat-tab {
          flex: 1 !important;
          padding: 12px 8px !important;
          cursor: pointer !important;
          background: #2a2a2a !important;
          color: #999 !important;
          border-right: 1px solid #444 !important;
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
          order: inherit !important;
        }
        
        .tabchat-tab:last-child {
          border-right: none !important;
        }
        
        .tabchat-tab:hover {
          background: #3a3a3a !important;
          color: #ccc !important;
        }
        
        .tabchat-tab.active {
          background: #215112 !important;
          color: #fff !important;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.3) !important;
        }
        
        .tabchat-tab[data-tab="world"] { order: 1 !important; }
        .tabchat-tab[data-tab="ooc"] { order: 2 !important; }
        .tabchat-tab[data-tab="game"] { order: 3 !important; }
        .tabchat-tab[data-tab="messages"] { order: 4 !important; }
        
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
          padding: 8px !important;
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
          0% { background-color: rgba(33, 81, 18, 0.4) !important; }
          100% { background-color: transparent !important; }
        }
        
        .scene-indicator {
          position: absolute;
          top: 2px;
          right: 5px;
          font-size: 8px;
          color: #215112;
          opacity: 0.7;
          pointer-events: none;
        }
      </style>
    `;
    
    $('head').append(tabStyles);
    
    // Create tabbed interface - EXPLICIT ORDER with CSS order properties
    const sceneName = canvas?.scene?.name || 'No Scene';
    const sceneId = TabbedChatManager._currentScene || 'default';
    
    const tabHtml = `
      <div class="tabchat-container" data-module="tabchat" data-scene="${sceneId}">
        <div class="scene-indicator">${sceneName}</div>
        <nav class="tabchat-nav">
          <div class="tabchat-tab active" data-tab="world" data-order="1">WORLD</div>
          <div class="tabchat-tab" data-tab="ooc" data-order="2">OOC</div>
          <div class="tabchat-tab" data-tab="game" data-order="3">GAME</div>
          <div class="tabchat-tab" data-tab="messages" data-order="4">MESSAGES</div>
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
    
    // Insert tabs
    const parent = defaultOl.parent();
    parent.append(tabHtml);
    console.log(`${MODULE_ID}: Added tabbed interface`);

    // Cache panels
    const sceneKey = TabbedChatManager._currentScene || 'default';
    if (!TabbedChatManager.tabPanels[sceneKey]) {
      TabbedChatManager.tabPanels[sceneKey] = {};
    }
    
    ['world', 'ooc', 'game', 'messages'].forEach((tab) => {
      const panel = $html.find(`.tabchat-panel[data-tab="${tab}"] ol.chat-messages`);
      TabbedChatManager.tabPanels[sceneKey][tab] = panel;
      console.log(`${MODULE_ID}: Cached panel for ${tab}`);
    });

    // Set up click handlers with debouncing
    let clickTimeout = null;
    $html.find('.tabchat-nav').off('click.tabchat').on('click.tabchat', '.tabchat-tab', function(event) {
      event.preventDefault();
      event.stopPropagation();
      
      // Debounce clicks to prevent rapid firing
      if (clickTimeout) return;
      
      clickTimeout = setTimeout(() => {
        clickTimeout = null;
      }, 200);
      
      const $tab = $(this);
      const tabName = $tab.data('tab');
      
      console.log(`${MODULE_ID}: Tab clicked: ${tabName}`);
      
      try {
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
      } catch (err) {
        console.error(`${MODULE_ID}: Error in tab click handler:`, err);
      }
    });
    
    console.log(`${MODULE_ID}: ✅ Click handlers attached`);
  }

  static _renderMessageSafe(message, $html) {
    if (!message || !TabbedChatManager._hasInjectedTabs || TabbedChatManager._processing) {
      return;
    }

    // Prevent recursive processing
    const processingFlag = `_tabchat_processing_${message.id}`;
    if (message[processingFlag]) return;
    message[processingFlag] = true;

    setTimeout(async () => {
      try {
        await TabbedChatManager._renderMessage(message, $html);
      } catch (err) {
        console.error(`${MODULE_ID}: Error rendering message:`, err);
      } finally {
        delete message[processingFlag];
      }
    }, 10);
  }

  static async _renderMessage(message, $html) {
    let rendered;
    try {
      rendered = await message.renderHTML();
      if (!rendered) return;
    } catch (e) {
      console.error(`${MODULE_ID}: Error rendering message HTML`, e);
      return;
    }

    const msgHtml = $(rendered);
    const tab = TabbedChatManager._getMessageTab(message);
    const sceneKey = TabbedChatManager._currentScene || 'default';
    
    // Get panel
    const panels = TabbedChatManager.tabPanels[sceneKey];
    if (!panels || !panels[tab] || !panels[tab].length) {
      console.warn(`${MODULE_ID}: No panel for ${tab} in scene ${sceneKey}`);
      return;
    }
    
    const panel = panels[tab];
    
    try {
      // Special processing for WORLD tab - actor name instead of token name
      if (tab === 'world' && message.speaker?.token) {
        const tokenDoc = canvas?.scene?.tokens?.get(message.speaker.token);
        if (tokenDoc?.actor && tokenDoc.actor.name !== tokenDoc.name) {
          const actorName = tokenDoc.actor.name;
          const tokenName = tokenDoc.name;
          
          msgHtml.find('*').each(function() {
            const $this = $(this);
            const text = $this.text();
            if (text.includes(tokenName)) {
              const newHtml = $this.html().replace(new RegExp(tokenName, 'g'), actorName);
              $this.html(newHtml);
            }
          });
        }
      }
      
      // Add to panel
      panel.append(msgHtml);
      
      // Highlight effect
      msgHtml.addClass('tabchat-highlight');
      setTimeout(() => msgHtml.removeClass('tabchat-highlight'), 2000);
      
      // Auto-scroll if active tab
      if (TabbedChatManager._activeTab === tab) {
        setTimeout(() => {
          if (panel[0]) {
            panel[0].scrollTop = panel[0].scrollHeight;
          }
        }, 50);
      }
      
      console.log(`${MODULE_ID}: ✅ Rendered to ${tab} tab`);
      
    } catch (err) {
      console.error(`${MODULE_ID}: Error appending message:`, err);
    }
  }

  static _getMessageTab(message) {
    try {
      // GAME: All rolls
      if (message.isRoll || message.rolls?.length > 0) return 'game';
      
      // MESSAGES: All whispers  
      if (message.whisper?.length > 0) return 'messages';
      
      // OOC: /b command or no token
      if (message._tabchatOOC || (message.content && message.content.includes('[OOC]'))) return 'ooc';
      
      // WORLD: Has token speaker
      if (message.speaker?.token) return 'world';
      
      // Default: OOC
      return 'ooc';
      
    } catch (err) {
      console.error(`${MODULE_ID}: Error determining tab:`, err);
      return 'ooc';
    }
  }
}

// Module Initialization
Hooks.once('init', TabbedChatManager.init);
Hooks.once('ready', TabbedChatManager.ready);
TabbedChatManager.setupHooks();
