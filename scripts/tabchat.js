// Tabbed Chat Module for Foundry VTT v13 - FORCED STYLING VERSION
// 4-tab system: WORLD | OOC | GAME | MESSAGES

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  static tabPanels = {};
  static _activeTab = 'world';
  static _initialized = false;
  static _hasInjectedTabs = false;
  static _currentScene = null;

  static init() {
    console.log(`${MODULE_ID} | FORCED STYLING VERSION - Init called`);
  }

  static ready() {
    if (TabbedChatManager._initialized) return;
    TabbedChatManager._initialized = true;
    console.log(`${MODULE_ID} | FORCED STYLING VERSION - Ready called`);
    
    TabbedChatManager._currentScene = canvas?.scene?.id || 'default';
    
    // Try to inject tabs immediately if chat exists
    setTimeout(() => {
      if (ui.chat?.element && !TabbedChatManager._hasInjectedTabs) {
        console.log(`${MODULE_ID}: Immediate tab injection attempt`);
        TabbedChatManager.injectTabs(ui.chat, ui.chat.element, {});
      }
    }, 500);
    
    // Load existing messages
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
    console.log(`${MODULE_ID} | FORCED STYLING VERSION - Setting up hooks`);
    
    // Multiple hooks for tab injection
    Hooks.on('renderChatLog', async (app, html, data) => {
      console.log(`${MODULE_ID}: renderChatLog hook fired`);
      await TabbedChatManager.injectTabs(app, html, data);
    });
    
    Hooks.on('renderApplication', async (app, html, data) => {
      if (app.constructor.name === 'ChatLog' && !TabbedChatManager._hasInjectedTabs) {
        console.log(`${MODULE_ID}: Backup renderApplication hook fired`);
        await TabbedChatManager.injectTabs(app, html, data);
      }
    });
    
    // Scene changes
    Hooks.on('canvasReady', (canvas) => {
      const newScene = canvas?.scene?.id || 'default';
      if (TabbedChatManager._currentScene !== newScene) {
        console.log(`${MODULE_ID}: Scene changed to ${newScene}`);
        TabbedChatManager._currentScene = newScene;
      }
    });
    
    // /b command handling
    Hooks.on('chatMessage', (chatlog, messageText, chatData) => {
      if (messageText.startsWith('/b ')) {
        console.log(`${MODULE_ID}: Intercepting /b command`);
        
        const content = '[OOC] ' + messageText.substring(3);
        ChatMessage.create({
          content: content,
          style: CONST.CHAT_MESSAGE_STYLES.OTHER,
          speaker: ChatMessage.getSpeaker(),
          _tabchatOOC: true
        });
        
        return false; // Prevent default
      }
      return true;
    });
    
    // New messages
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
      html = html[0] || html;
      if (!(html instanceof HTMLElement)) {
        console.error(`${MODULE_ID}: Invalid HTML type`);
        return;
      }
    }

    const $html = $(html);
    console.log(`${MODULE_ID}: FORCED STYLING VERSION - Injecting tabs`);

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
      
      // Force styling after injection
      setTimeout(() => {
        TabbedChatManager._forceTabStyling($html);
      }, 100);
      
      console.log(`${MODULE_ID}: ✅ Successfully injected tabs`);
    } catch (err) {
      console.error(`${MODULE_ID}: Error injecting tabs:`, err);
    }
  }

  static _createTabbedInterface(defaultOl, $html) {
    console.log(`${MODULE_ID}: Creating tabbed interface`);
    
    // Hide original chat
    defaultOl.css({
      'position': 'absolute',
      'top': '-10000px',
      'left': '-10000px',
      'width': '1px',
      'height': '1px',
      'opacity': '0',
      'pointer-events': 'none'
    });
    
    // Inject aggressive inline CSS to override everything
    const inlineStyles = `
      <style id="tabchat-force-styles">
        .tabchat-container {
          height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          position: relative !important;
          z-index: 9999 !important;
          background: transparent !important;
        }
        
        .tabchat-nav {
          display: flex !important;
          flex-direction: row !important;
          flex-shrink: 0 !important;
          background: #1a1a1a !important;
          border-bottom: 3px solid #215112 !important;
          margin: 0 !important;
          padding: 0 !important;
          min-height: 45px !important;
        }
        
        .tabchat-tab {
          flex: 1 !important;
          padding: 15px 10px !important;
          cursor: pointer !important;
          background: #2a2a2a !important;
          color: #999 !important;
          border-right: 2px solid #444 !important;
          user-select: none !important;
          transition: all 0.3s ease !important;
          font-weight: bold !important;
          font-size: 12px !important;
          text-transform: uppercase !important;
          text-align: center !important;
          letter-spacing: 1px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          position: relative !important;
          border-top: none !important;
          border-bottom: none !important;
          border-left: none !important;
          text-decoration: none !important;
          outline: none !important;
        }
        
        .tabchat-tab:last-child {
          border-right: none !important;
        }
        
        .tabchat-tab:hover {
          background: #3a3a3a !important;
          color: #ddd !important;
          transform: translateY(-2px) !important;
        }
        
        .tabchat-tab.active {
          background: #215112 !important;
          color: #ffffff !important;
          box-shadow: inset 0 3px 6px rgba(0,0,0,0.4) !important;
          border-bottom: 3px solid #2a6b1a !important;
        }
        
        .tabchat-panel {
          flex: 1 !important;
          display: none !important;
          flex-direction: column !important;
          overflow: hidden !important;
          background: rgba(0,0,0,0.05) !important;
          position: relative !important;
          height: calc(100% - 45px) !important;
          min-height: 300px !important;
        }
        
        .tabchat-panel.active {
          display: flex !important;
        }
        
        .tabchat-panel ol.chat-messages {
          flex: 1 !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          padding: 10px !important;
          margin: 0 !important;
          list-style: none !important;
          background: transparent !important;
          height: 100% !important;
          max-height: none !important;
        }
        
        .tabbed-whispers-highlight {
          animation: tabchat-pulse 2.5s ease-out !important;
        }
        
        @keyframes tabchat-pulse {
          0% { 
            background-color: rgba(33, 81, 18, 0.5) !important;
            box-shadow: 0 0 12px rgba(33, 81, 18, 0.7) !important;
          }
          100% { 
            background-color: transparent !important;
            box-shadow: none !important;
          }
        }
        
        .scene-indicator {
          position: absolute;
          top: 5px;
          right: 10px;
          font-size: 9px;
          color: #215112;
          opacity: 0.8;
          pointer-events: none;
          font-weight: bold;
        }
      </style>
    `;
    
    // Remove existing styles and add new ones
    $('#tabchat-force-styles').remove();
    $('head').append(inlineStyles);
    
    // Create tabs HTML
    const sceneName = canvas?.scene?.name || 'No Scene';
    const sceneId = TabbedChatManager._currentScene || 'default';
    
    const tabHtml = `
      <div class="tabchat-container" data-module="tabchat" data-scene="${sceneId}" style="height: 100%; display: flex; flex-direction: column; z-index: 9999;">
        <div class="scene-indicator">${sceneName}</div>
        <nav class="tabchat-nav" style="display: flex; background: #1a1a1a; border-bottom: 3px solid #215112; min-height: 45px;">
          <div class="tabchat-tab active" data-tab="world" style="flex: 1; background: #215112; color: #fff; padding: 15px 10px; text-align: center; cursor: pointer; font-weight: bold; font-size: 12px; text-transform: uppercase;">WORLD</div>
          <div class="tabchat-tab" data-tab="ooc" style="flex: 1; background: #2a2a2a; color: #999; padding: 15px 10px; text-align: center; cursor: pointer; font-weight: bold; font-size: 12px; text-transform: uppercase; border-right: 2px solid #444;">OOC</div>
          <div class="tabchat-tab" data-tab="game" style="flex: 1; background: #2a2a2a; color: #999; padding: 15px 10px; text-align: center; cursor: pointer; font-weight: bold; font-size: 12px; text-transform: uppercase; border-right: 2px solid #444;">GAME</div>
          <div class="tabchat-tab" data-tab="messages" style="flex: 1; background: #2a2a2a; color: #999; padding: 15px 10px; text-align: center; cursor: pointer; font-weight: bold; font-size: 12px; text-transform: uppercase;">MESSAGES</div>
        </nav>
        <section class="tabchat-panel active" data-tab="world" style="flex: 1; display: flex; flex-direction: column; background: rgba(0,0,0,0.05);">
          <ol class="chat-messages" style="flex: 1; overflow-y: auto; padding: 10px; margin: 0; list-style: none;"></ol>
        </section>
        <section class="tabchat-panel" data-tab="ooc" style="flex: 1; display: none; flex-direction: column; background: rgba(0,0,0,0.05);">
          <ol class="chat-messages" style="flex: 1; overflow-y: auto; padding: 10px; margin: 0; list-style: none;"></ol>
        </section>
        <section class="tabchat-panel" data-tab="game" style="flex: 1; display: none; flex-direction: column; background: rgba(0,0,0,0.05);">
          <ol class="chat-messages" style="flex: 1; overflow-y: auto; padding: 10px; margin: 0; list-style: none;"></ol>
        </section>
        <section class="tabchat-panel" data-tab="messages" style="flex: 1; display: none; flex-direction: column; background: rgba(0,0,0,0.05);">
          <ol class="chat-messages" style="flex: 1; overflow-y: auto; padding: 10px; margin: 0; list-style: none;"></ol>
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

    // Cache panels
    TabbedChatManager.tabPanels = {
      world: $html.find(`.tabchat-panel[data-tab="world"] ol.chat-messages`),
      ooc: $html.find(`.tabchat-panel[data-tab="ooc"] ol.chat-messages`),
      game: $html.find(`.tabchat-panel[data-tab="game"] ol.chat-messages`),
      messages: $html.find(`.tabchat-panel[data-tab="messages"] ol.chat-messages`)
    };
    
    // Verify panels
    ['world', 'ooc', 'game', 'messages'].forEach((tab) => {
      const panel = TabbedChatManager.tabPanels[tab];
      console.log(`${MODULE_ID}: Panel ${tab} exists: ${panel && panel.length > 0}`);
    });

    // Set up click handlers with aggressive event handling
    $html.find('.tabchat-nav').off('click.tabchat touchstart.tabchat').on('click.tabchat touchstart.tabchat', '.tabchat-tab', function(event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      
      const $tab = $(this);
      const tabName = $tab.data('tab');
      
      console.log(`${MODULE_ID}: Tab clicked: ${tabName}`);
      
      try {
        // Force visual update with inline styles
        $html.find('.tabchat-tab').each(function() {
          $(this).removeClass('active').css({
            'background': '#2a2a2a',
            'color': '#999'
          });
        });
        
        $tab.addClass('active').css({
          'background': '#215112',
          'color': '#ffffff'
        });
        
        // Force panel switching with inline styles
        $html.find('.tabchat-panel').each(function() {
          $(this).removeClass('active').css('display', 'none');
        });
        
        $html.find(`.tabchat-panel[data-tab="${tabName}"]`).addClass('active').css('display', 'flex');
        
        TabbedChatManager._activeTab = tabName;
        
        // Auto-scroll
        setTimeout(() => {
          const panel = TabbedChatManager.tabPanels[tabName];
          if (panel && panel.length && panel[0]) {
            panel[0].scrollTop = panel[0].scrollHeight;
          }
        }, 50);
        
        console.log(`${MODULE_ID}: ✅ Activated tab ${tabName}`);
      } catch (err) {
        console.error(`${MODULE_ID}: Error in tab click handler:`, err);
      }
    });
    
    console.log(`${MODULE_ID}: ✅ Click handlers attached`);
  }

  static _forceTabStyling($html) {
    // Force styling with direct DOM manipulation
    try {
      const container = $html.find('.tabchat-container')[0];
      if (container) {
        container.style.cssText = 'height: 100% !important; display: flex !important; flex-direction: column !important; z-index: 9999 !important;';
      }
      
      const nav = $html.find('.tabchat-nav')[0];
      if (nav) {
        nav.style.cssText = 'display: flex !important; background: #1a1a1a !important; border-bottom: 3px solid #215112 !important; min-height: 45px !important;';
      }
      
      $html.find('.tabchat-tab').each(function(index) {
        const tab = this;
        tab.style.cssText = 'flex: 1 !important; padding: 15px 10px !important; cursor: pointer !important; font-weight: bold !important; font-size: 12px !important; text-align: center !important; text-transform: uppercase !important; border-right: 2px solid #444 !important;';
        
        if ($(tab).hasClass('active')) {
          tab.style.cssText += 'background: #215112 !important; color: #ffffff !important;';
        } else {
          tab.style.cssText += 'background: #2a2a2a !important; color: #999 !important;';
        }
      });
      
      $html.find('.tabchat-panel').each(function() {
        const panel = this;
        panel.style.cssText = 'flex: 1 !important; flex-direction: column !important; overflow: hidden !important;';
        
        if ($(panel).hasClass('active')) {
          panel.style.display = 'flex';
        } else {
          panel.style.display = 'none';
        }
      });
      
      console.log(`${MODULE_ID}: ✅ Forced styling applied`);
    } catch (err) {
      console.error(`${MODULE_ID}: Error forcing styling:`, err);
    }
  }

  static async _renderMessage(message, $html) {
    if (!message || !TabbedChatManager._hasInjectedTabs) return;

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
    
    const panel = TabbedChatManager.tabPanels[tab];
    if (!panel || !panel.length) {
      console.warn(`${MODULE_ID}: No panel found for ${tab}`);
      return;
    }
    
    try {
      // Actor name replacement for WORLD tab
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
      
      // Highlight
      msgHtml.addClass('tabbed-whispers-highlight');
      setTimeout(() => msgHtml.removeClass('tabbed-whispers-highlight'), 2500);
      
      // Auto-scroll if active
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
      if (message.isRoll || message.rolls?.length > 0) return 'game';
      if (message.whisper?.length > 0) return 'messages';
      if (message._tabchatOOC || (message.content && message.content.includes('[OOC]'))) return 'ooc';
      if (message.speaker?.token) return 'world';
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
