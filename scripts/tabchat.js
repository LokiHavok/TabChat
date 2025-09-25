// Tabbed Chat Module for Foundry VTT v13 - WORKING CHAT VERSION
// 4-tab system: WORLD | OOC | GAME | MESSAGES

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  static tabPanels = {};
  static _activeTab = 'world';
  static _initialized = false;
  static _hasInjectedTabs = false;
  static _currentScene = null;

  static init() {
    console.log(`${MODULE_ID} | WORKING CHAT VERSION - Init called`);
  }

  static ready() {
    if (TabbedChatManager._initialized) return;
    TabbedChatManager._initialized = true;
    console.log(`${MODULE_ID} | WORKING CHAT VERSION - Ready called`);
    
    TabbedChatManager._currentScene = canvas?.scene?.id || 'default';
    
    // Try to inject tabs immediately if chat is already rendered
    setTimeout(() => {
      if (ui.chat?.element && !TabbedChatManager._hasInjectedTabs) {
        console.log(`${MODULE_ID}: Attempting immediate tab injection`);
        TabbedChatManager.injectTabs(ui.chat, ui.chat.element, {});
      }
    }, 500);
    
    // Load existing messages after tabs are ready
    setTimeout(() => {
      if (TabbedChatManager._hasInjectedTabs) {
        TabbedChatManager._loadExistingMessages();
      }
    }, 1500);
  }

  static _loadExistingMessages() {
    try {
      const $html = $(ui.chat.element);
      const messages = game.messages.contents.sort((a, b) => a.timestamp - b.timestamp);
      console.log(`${MODULE_ID}: Loading ${messages.length} existing messages`);
      
      for (const message of messages) {
        TabbedChatManager._renderMessage(message, $html);
      }
      console.log(`${MODULE_ID}: Finished loading existing messages`);
    } catch (err) {
      console.error(`${MODULE_ID}: Error loading existing messages`, err);
    }
  }

  static setupHooks() {
    console.log(`${MODULE_ID} | WORKING CHAT VERSION - Setting up hooks`);
    
    // Multiple hooks to catch tab injection
    Hooks.on('renderChatLog', async (app, html, data) => {
      console.log(`${MODULE_ID}: renderChatLog hook fired`);
      await TabbedChatManager.injectTabs(app, html, data);
    });
    
    // Backup injection hook
    Hooks.on('renderApplication', async (app, html, data) => {
      if (app.constructor.name === 'ChatLog' && !TabbedChatManager._hasInjectedTabs) {
        console.log(`${MODULE_ID}: Backup renderApplication hook fired for ChatLog`);
        await TabbedChatManager.injectTabs(app, html, data);
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
    
    // Handle /b commands - intercept before Foundry processes
    Hooks.on('chatMessage', (chatlog, messageText, chatData) => {
      if (messageText.startsWith('/b ')) {
        console.log(`${MODULE_ID}: Intercepting /b command`);
        
        // Create OOC message directly
        const content = '[OOC] ' + messageText.substring(3);
        ChatMessage.create({
          content: content,
          style: CONST.CHAT_MESSAGE_STYLES.OTHER,
          speaker: ChatMessage.getSpeaker(),
          _tabchatOOC: true
        });
        
        return false; // Prevent default processing
      }
      return true; // Allow other messages to process normally
    });
    
    // Handle new messages
    Hooks.on('createChatMessage', async (message) => {
      console.log(`${MODULE_ID}: New message created`, { id: message.id });
      if (TabbedChatManager._hasInjectedTabs) {
        await TabbedChatManager._renderMessage(message, $(ui.chat.element));
      }
    });
  }

  static async injectTabs(app, html, data) {
    if (TabbedChatManager._hasInjectedTabs) {
      console.log(`${MODULE_ID}: Tabs already injected`);
      return;
    }

    if (!(html instanceof HTMLElement)) {
      console.log(`${MODULE_ID}: HTML is not an element, trying jQuery`);
      html = html[0] || html;
      if (!(html instanceof HTMLElement)) {
        console.error(`${MODULE_ID}: Invalid HTML type`);
        return;
      }
    }

    const $html = $(html);
    console.log(`${MODULE_ID}: WORKING CHAT VERSION - Injecting tabs`);

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
    console.log(`${MODULE_ID}: Creating tabbed interface`);
    
    // Hide original but keep for compatibility
    defaultOl.css({
      'position': 'absolute',
      'top': '-10000px',
      'left': '-10000px',
      'width': '1px',
      'height': '1px',
      'opacity': '0',
      'pointer-events': 'none'
    });
    
    // Get scene info
    const sceneName = canvas?.scene?.name || 'No Scene';
    const sceneId = TabbedChatManager._currentScene || 'default';
    
    // Create tabbed interface HTML - CORRECT ORDER
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
    
    // Insert tabs
    try {
      const parent = defaultOl.parent();
      parent.append(tabHtml);
      console.log(`${MODULE_ID}: Added tabbed interface to parent`);
    } catch (err) {
      defaultOl.after(tabHtml);
      console.log(`${MODULE_ID}: Added tabbed interface after OL`);
    }

    // Cache panels - SIMPLIFIED (no scene complexity initially)
    TabbedChatManager.tabPanels = {
      world: $html.find(`.tabchat-panel[data-tab="world"] ol.chat-messages`),
      ooc: $html.find(`.tabchat-panel[data-tab="ooc"] ol.chat-messages`),
      game: $html.find(`.tabchat-panel[data-tab="game"] ol.chat-messages`),
      messages: $html.find(`.tabchat-panel[data-tab="messages"] ol.chat-messages`)
    };
    
    // Verify panels exist
    ['world', 'ooc', 'game', 'messages'].forEach((tab) => {
      const panel = TabbedChatManager.tabPanels[tab];
      console.log(`${MODULE_ID}: Panel ${tab} exists: ${panel && panel.length > 0}`);
    });

    // Set up click handlers
    $html.find('.tabchat-nav').off('click.tabchat').on('click.tabchat', '.tabchat-tab', function(event) {
      event.preventDefault();
      event.stopPropagation();
      
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
          const panel = TabbedChatManager.tabPanels[tabName];
          if (panel && panel.length) {
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

  static async _renderMessage(message, $html) {
    if (!message || !TabbedChatManager._hasInjectedTabs) {
      return;
    }

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
    
    console.log(`${MODULE_ID}: Processing message for ${tab} tab`, {
      id: message.id,
      content: (message.content || '').substring(0, 30)
    });
    
    // Get panel - SIMPLIFIED
    const panel = TabbedChatManager.tabPanels[tab];
    if (!panel || !panel.length) {
      console.warn(`${MODULE_ID}: No panel found for ${tab}`);
      return;
    }
    
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
          
          console.log(`${MODULE_ID}: Replaced "${tokenName}" with "${actorName}"`);
        }
      }
      
      // Add to panel
      panel.append(msgHtml);
      
      // Highlight effect
      msgHtml.addClass('tabbed-whispers-highlight');
      setTimeout(() => msgHtml.removeClass('tabbed-whispers-highlight'), 2500);
      
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
