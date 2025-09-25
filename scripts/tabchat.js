// Tabbed Chat Module for Foundry VTT v13 - FIXED VERSION
// Simple 4-tab system: WORLD | OOC | ROLLS | WHISPER

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  static tabPanels = {};
  static _activeTab = 'ic';
  static _initialized = false;
  static _hasInjectedTabs = false;

  static init() {
    console.log(`${MODULE_ID} | FIXED VERSION - Init called`);
    
    // Store original methods but don't patch them aggressively yet
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
    console.log(`${MODULE_ID} | FIXED VERSION - Ready called`);
    
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
    
    // Render existing messages after tabs are set up
    setTimeout(() => {
      try {
        if (!ui.chat?.element || !TabbedChatManager._hasInjectedTabs) {
          console.warn(`${MODULE_ID}: UI or tabs not ready, skipping existing message rendering`);
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
    console.log(`${MODULE_ID} | FIXED VERSION - Setting up hooks`);
    
    Hooks.on('renderChatLog', async (app, html, data) => {
      await TabbedChatManager.injectTabs(app, html, data);
    });
    
    // Handle /b commands in chat input
    Hooks.on('preCreateChatMessage', (doc, data, options, userId) => {
      console.log(`${MODULE_ID}: preCreateChatMessage`, { content: data?.content?.substring(0, 30) });
      
      // Handle /b command
      if (data.content && data.content.startsWith('/b ')) {
        data.content = '[OOC] ' + data.content.substring(3);
        data.type = CONST.CHAT_MESSAGE_TYPES.OTHER;
        doc.updateSource({ _tabchatBypass: true });
        console.log(`${MODULE_ID}: Processed /b command in preCreate`);
      }
    });
    
    // LESS aggressive rendering suppression - only suppress default positioning
    Hooks.on('renderChatMessage', (message, html, data) => {
      try {
        const hasTabUI = ui.chat?.element && $(ui.chat.element).find('.tabchat-container').length > 0;
        if (hasTabUI) {
          // Don't append to default chat log, we'll handle it
          return false;
        }
      } catch (err) {
        console.error(`${MODULE_ID}: Error in renderChatMessage hook`, err);
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
        const msgHtml = $(await message.renderHTML());
        await TabbedChatManager.updateMessage(message, msgHtml, $(ui.chat.element));
      }
    });
    
    Hooks.on('deleteChatMessage', (message, options, userId) => {
      if (TabbedChatManager._hasInjectedTabs) {
        TabbedChatManager.deleteMessage(message.id, $(ui.chat.element));
      }
    });
  }

  // Core Methods
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
    console.log(`${MODULE_ID}: FIXED - Injecting tabs`);

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
    TabbedChatManager._hasInjectedTabs = true;
    
    // Apply rendering suppression AFTER tabs are injected
    setTimeout(() => {
      TabbedChatManager._applyRenderingPatches();
    }, 500);
  }

  static _applyRenderingPatches() {
    try {
      // Patch ChatLog prototype
      const ChatLogClass = foundry.applications.sidebar.tabs.ChatLog;
      if (ChatLogClass.prototype._tabchat_originalPostOne && !ChatLogClass.prototype._tabchat_patched) {
        ChatLogClass.prototype._postOne = async function (...args) {
          const $el = this?.element ? $(this.element) : null;
          if ($el && $el.find('.tabchat-container').length) {
            console.log(`${MODULE_ID}: Suppressing ChatLog._postOne - tabchat active`);
            return;
          }
          return await ChatLogClass.prototype._tabchat_originalPostOne.apply(this, args);
        };
        ChatLogClass.prototype._tabchat_patched = true;
        console.log(`${MODULE_ID} | Applied ChatLog._postOne patch`);
      }

      // Patch ui.chat instance
      if (ui.chat && ui.chat._tabchat_originalPostOne && !ui.chat._tabchat_patched) {
        ui.chat._postOne = async function (...args) {
          const $el = this?.element ? $(this.element) : null;
          if ($el && $el.find('.tabchat-container').length) {
            console.log(`${MODULE_ID}: Suppressing ui.chat._postOne - tabchat active`);
            return;
          }
          return await ui.chat._tabchat_originalPostOne.apply(this, args);
        };
        ui.chat._tabchat_patched = true;
        console.log(`${MODULE_ID} | Applied ui.chat._postOne patch`);
      }
    } catch (err) {
      console.error(`${MODULE_ID} | Failed to apply rendering patches:`, err);
    }
  }

  static _waitForChatOl($html) {
    return new Promise((resolve) => {
      const observer = new MutationObserver((mutations, obs) => {
        const ol = $html.find('ol.chat-messages, .chat-messages-container ol, ol');
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
    // Hide the original ol completely
    defaultOl.css({
      'display': 'none !important',
      'height': '0 !important', 
      'overflow': 'hidden !important',
      'position': 'absolute',
      'visibility': 'hidden'
    });
    
    // Create CSS for better tab styling
    const tabStyles = `
      <style id="tabchat-styles">
        .tabchat-container {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .tabchat-nav {
          display: flex;
          flex-direction: row;
          flex-shrink: 0;
          background: rgba(0,0,0,0.3);
          border-bottom: 1px solid #444;
        }
        .tabchat-tab {
          padding: 8px 12px;
          cursor: pointer;
          background: rgba(0,0,0,0.2);
          color: #ccc;
          border-right: 1px solid #444;
          user-select: none;
          transition: all 0.2s;
        }
        .tabchat-tab:hover {
          background: rgba(255,255,255,0.1);
          color: #fff;
        }
        .tabchat-tab.active {
          background: rgba(255,255,255,0.2);
          color: #fff;
          font-weight: bold;
        }
        .tabchat-panel {
          flex: 1;
          display: none;
          flex-direction: column;
          overflow: hidden;
        }
        .tabchat-panel.active {
          display: flex;
        }
        .tabchat-panel ol.chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 0;
          margin: 0;
          list-style: none;
        }
        .tabbed-whispers-highlight {
          animation: highlight 2.5s ease-out;
        }
        @keyframes highlight {
          0% { background-color: rgba(255,255,0,0.3); }
          100% { background-color: transparent; }
        }
      </style>
    `;
    
    // Add styles to head if not already present
    if (!$('#tabchat-styles').length) {
      $('head').append(tabStyles);
    }
    
    const tabHtml = `
      <div class="tabchat-container">
        <nav class="tabchat-nav">
          <a class="tabchat-tab active" data-tab="ic">WORLD</a>
          <a class="tabchat-tab" data-tab="ooc">OOC</a>
          <a class="tabchat-tab" data-tab="rolls">GAME</a>
          <a class="tabchat-tab" data-tab="whisper">MESSAGES</a>
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
        <section class="tabchat-panel" data-tab="whisper">
          <ol class="chat-messages"></ol>
        </section>
      </div>
    `;
    
    // Insert tabbed interface AFTER the original ol
    defaultOl.after(tabHtml);
    console.log(`${MODULE_ID}: FIXED - Added tabbed interface`);

    // Cache tab panels
    ['ic', 'ooc', 'rolls', 'whisper'].forEach((tab) => {
      const panel = $html.find(`.tabchat-panel[data-tab="${tab}"] ol.chat-messages`);
      TabbedChatManager.tabPanels[tab] = panel;
      console.log(`${MODULE_ID}: Cached panel for ${tab}`, { exists: panel.length > 0 });
    });

    // Add click handlers with proper delegation
    $html.find('.tabchat-nav').off('click.tabchat').on('click.tabchat', '.tabchat-tab', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const tabName = $(event.currentTarget).data('tab');
      console.log(`${MODULE_ID}: Tab clicked: ${tabName}`);
      TabbedChatManager._activateTab(tabName, $html);
    });

    console.log(`${MODULE_ID}: Tabs setup complete with click handlers`);
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
      console.error(`${MODULE_ID}: Error rendering message, using fallback`, e);
      rendered = `<li class="chat-message" data-message-id="${message.id}">
        <div class="message-content">[FALLBACK] ${message.speaker?.alias || 'Unknown'}: ${message.content || 'No content'}</div>
      </li>`;
    }

    const msgHtml = $(rendered);
    const tab = TabbedChatManager._getMessageTab(message);
    const currentScene = canvas?.scene?.id;
    const currentUserId = game.user.id;
    const messageAuthor = message.author?.id || message.author;
    
    console.log(`${MODULE_ID}: Processing message for ${tab} tab`, {
      id: message.id,
      author: messageAuthor,
      content: message.content?.substring(0, 30) + '...'
    });
    
    let shouldRender = TabbedChatManager._shouldRenderMessage(message, tab, currentScene, currentUserId, messageAuthor);
    
    if (!shouldRender) {
      console.log(`${MODULE_ID}: Skipping message - filtered out`);
      return;
    }
    
    console.log(`${MODULE_ID}: ✅ RENDERING message to ${tab} tab`);
    
    if (tab && TabbedChatManager.tabPanels[tab]?.length) {
      // Process /b command display
      if (message.content?.includes('[OOC]')) {
        msgHtml.addClass('ooc-message');
      }
      
      // For WORLD tab, replace token name with actor name
      if (tab === 'ic' && message.speaker?.token && message.speaker?.actor) {
        const tokenDoc = canvas?.scene?.tokens?.get(message.speaker.token);
        if (tokenDoc && tokenDoc.actor) {
          const actorName = tokenDoc.actor.name;
          const tokenName = tokenDoc.name;
          
          msgHtml.find('.message-sender, .sender-name, .speaker-name').each(function() {
            const $this = $(this);
            if ($this.text().includes(tokenName)) {
              $this.html($this.html().replace(tokenName, actorName));
            }
          });
        }
      }
      
      TabbedChatManager.tabPanels[tab].append(msgHtml);
      
      // Add highlight effect for new messages
      msgHtml.addClass('tabbed-whispers-highlight');
      setTimeout(() => msgHtml.removeClass('tabbed-whispers-highlight'), 2500);
      
      // Auto-scroll if this is the active tab
      if (TabbedChatManager._activeTab === tab) {
        setTimeout(() => {
          TabbedChatManager._scrollToBottom($html, tab);
        }, 100);
      }
    } else {
      console.warn(`${MODULE_ID}: No valid tab panel for ${tab}`);
    }
  }

  static _getMessageTab(message) {
    // Handle rolls first
    if (message.isRoll || message.type === CONST.CHAT_MESSAGE_TYPES.ROLL) return 'rolls';
    
    // Handle whispers
    if (message.whisper?.length > 0) return 'whisper';
    
    // Check for OOC bypass or content
    if (message._tabchatBypass || message.content?.includes('[OOC]') || message.content?.startsWith('/b ')) {
      return 'ooc';
    }
    
    // Check if message has a token speaker
    const speaker = message.speaker;
    if (speaker?.token) {
      return 'ic'; // Token speaking = WORLD
    }
    
    // No token = OOC
    return 'ooc';
  }

  static _shouldRenderMessage(message, tab, currentScene, currentUserId, messageAuthor) {
    const messageScene = message.speaker?.scene;
    
    if (tab === 'whisper') {
      // GMs see all whispers, players see only their own
      if (game.user.isGM) return true;
      const whisperTargets = message.whisper || [];
      const isAuthor = (messageAuthor === currentUserId);
      const isTarget = whisperTargets.includes(currentUserId);
      return isAuthor || isTarget;
    } else {
      // For other tabs: show if same scene OR if user is author
      const isSameScene = !messageScene || !currentScene || (messageScene === currentScene);
      const isAuthor = (messageAuthor === currentUserId);
      return isSameScene || isAuthor;
    }
  }

  static async updateMessage(message, msgHtml, $html) {
    const tab = TabbedChatManager._getMessageTab(message);
    if (tab && TabbedChatManager.tabPanels[tab]?.length) {
      const existing = TabbedChatManager.tabPanels[tab].find(`[data-message-id="${message.id}"]`);
      if (existing.length) {
        existing.replaceWith(msgHtml);
        if (TabbedChatManager._activeTab === tab) {
          TabbedChatManager._scrollToBottom($html, tab);
        }
      }
    }
  }

  static deleteMessage(messageId, $html) {
    ['ic', 'ooc', 'rolls', 'whisper'].forEach((tab) => {
      TabbedChatManager.tabPanels[tab]?.find(`[data-message-id="${messageId}"]`).remove();
    });
  }

  static _activateTab(tabName, $html) {
    console.log(`${MODULE_ID}: Activating tab: ${tabName}`);
    
    // Update tab appearances
    $html.find('.tabchat-tab').removeClass('active');
    $html.find(`.tabchat-tab[data-tab="${tabName}"]`).addClass('active');
    
    // Hide all panels and show the selected one
    $html.find('.tabchat-panel').removeClass('active').hide();
    $html.find(`.tabchat-panel[data-tab="${tabName}"]`).addClass('active').show();
    
    TabbedChatManager._activeTab = tabName;
    
    // Scroll to bottom when switching tabs
    setTimeout(() => {
      TabbedChatManager._scrollToBottom($html, tabName);
    }, 50);
  }

  static _scrollToBottom($html, tabName = TabbedChatManager._activeTab) {
    const ol = $html.find(`.tabchat-panel[data-tab="${tabName}"] ol.chat-messages`);
    if (ol?.length) {
      const scrollElement = ol[0];
      requestAnimationFrame(() => {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      });
    }
  }
}

// Module Initialization
Hooks.once('init', TabbedChatManager.init);
Hooks.once('ready', TabbedChatManager.ready);

// Setup hooks
TabbedChatManager.setupHooks();
