// Tabbed Chat Module for Foundry VTT v13 - COMPATIBILITY FIXED
// Simple 4-tab system: WORLD | OOC | ROLLS | WHISPER

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  static tabPanels = {};
  static _activeTab = 'ic';
  static _initialized = false;
  static _hasInjectedTabs = false;

  static init() {
    console.log(`${MODULE_ID} | V13 COMPATIBLE - Init called`);
    
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
    console.log(`${MODULE_ID} | V13 COMPATIBLE - Ready called`);
    
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
    
    // Render existing messages after tabs are set up - longer delay for module compatibility
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
    }, 3000); // Increased delay for better module compatibility
  }

  static setupHooks() {
    console.log(`${MODULE_ID} | V13 COMPATIBLE - Setting up hooks`);
    
    // Wait for other modules to finish before injecting our tabs
    Hooks.on('renderChatLog', async (app, html, data) => {
      // Add extra delay to ensure other modules are done
      setTimeout(async () => {
        await TabbedChatManager.injectTabs(app, html, data);
      }, 500);
    });
    
    // Handle /b commands in chat input
    Hooks.on('preCreateChatMessage', (doc, data, options, userId) => {
      console.log(`${MODULE_ID}: preCreateChatMessage`, { content: data?.content?.substring(0, 30) });
      
      // Handle /b command
      if (data.content && data.content.startsWith('/b ')) {
        data.content = '[OOC] ' + data.content.substring(3);
        data.style = CONST.CHAT_MESSAGE_STYLES.OTHER; // Updated for v13
        doc.updateSource({ _tabchatBypass: true });
        console.log(`${MODULE_ID}: Processed /b command in preCreate`);
      }
    });
    
    // Use the NEW v13 hook - renderChatMessageHTML instead of renderChatMessage
    Hooks.on('renderChatMessageHTML', (message, html, data) => {
      try {
        const hasTabUI = ui.chat?.element && $(ui.chat.element).find('.tabchat-container').length > 0;
        if (hasTabUI) {
          // Don't append to default chat log, we'll handle it
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
    console.log(`${MODULE_ID}: V13 COMPATIBLE - Injecting tabs`);

    // Wait longer for other modules to finish their DOM manipulation
    await new Promise(resolve => setTimeout(resolve, 1000));

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

    try {
      TabbedChatManager._replaceMessageList(defaultOl, $html);
      TabbedChatManager._hasInjectedTabs = true;
      
      // Apply rendering suppression AFTER tabs are injected and other modules are ready
      setTimeout(() => {
        TabbedChatManager._applyRenderingPatches();
      }, 1500);
    } catch (err) {
      console.error(`${MODULE_ID}: Error injecting tabs:`, err);
    }
  }

  static _applyRenderingPatches() {
    try {
      // Patch ChatLog prototype
      const ChatLogClass = foundry.applications.sidebar.tabs.ChatLog;
      if (ChatLogClass.prototype._tabchat_originalPostOne && !ChatLogClass.prototype._tabchat_patched) {
        ChatLogClass.prototype._postOne = async function (...args) {
          try {
            const $el = this?.element ? $(this.element) : null;
            if ($el && $el.find('.tabchat-container').length) {
              console.log(`${MODULE_ID}: Suppressing ChatLog._postOne - tabchat active`);
              return;
            }
            return await ChatLogClass.prototype._tabchat_originalPostOne.apply(this, args);
          } catch (err) {
            console.error(`${MODULE_ID}: Error in patched ChatLog._postOne`, err);
            return await ChatLogClass.prototype._tabchat_originalPostOne.apply(this, args);
          }
        };
        ChatLogClass.prototype._tabchat_patched = true;
        console.log(`${MODULE_ID} | Applied ChatLog._postOne patch`);
      }

      // Patch ui.chat instance
      if (ui.chat && ui.chat._tabchat_originalPostOne && !ui.chat._tabchat_patched) {
        ui.chat._postOne = async function (...args) {
          try {
            const $el = this?.element ? $(this.element) : null;
            if ($el && $el.find('.tabchat-container').length) {
              console.log(`${MODULE_ID}: Suppressing ui.chat._postOne - tabchat active`);
              return;
            }
            return await ui.chat._tabchat_originalPostOne.apply(this, args);
          } catch (err) {
            console.error(`${MODULE_ID}: Error in patched ui.chat._postOne`, err);
            return await ui.chat._tabchat_originalPostOne.apply(this, args);
          }
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
    // Keep the original ol visible but move it out of the way
    // This prevents other modules from breaking when looking for it
    defaultOl.css({
      'position': 'absolute',
      'top': '-9999px',
      'left': '-9999px',
      'width': '1px',
      'height': '1px',
      'opacity': '0',
      'pointer-events': 'none',
      'overflow': 'hidden'
    });
    
    // Create CSS for better tab styling - avoid conflicts with other modules
    const tabStyles = `
      <style id="tabchat-styles-v13">
        .tabchat-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          position: relative;
          z-index: 1;
        }
        .tabchat-nav {
          display: flex;
          flex-direction: row;
          flex-shrink: 0;
          background: rgba(0,0,0,0.4);
          border-bottom: 2px solid #444;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .tabchat-tab {
          padding: 10px 16px;
          cursor: pointer;
          background: rgba(0,0,0,0.3);
          color: #ccc;
          border-right: 1px solid #555;
          user-select: none;
          transition: all 0.3s ease;
          font-weight: 500;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .tabchat-tab:hover {
          background: rgba(255,255,255,0.15);
          color: #fff;
          transform: translateY(-1px);
        }
        .tabchat-tab.active {
          background: rgba(255,255,255,0.25);
          color: #fff;
          font-weight: bold;
          box-shadow: inset 0 -3px 0 #4a9eff;
        }
        .tabchat-panel {
          flex: 1;
          display: none;
          flex-direction: column;
          overflow: hidden;
          background: transparent;
        }
        .tabchat-panel.active {
          display: flex !important;
        }
        .tabchat-panel ol.chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 0;
          margin: 0;
          list-style: none;
          background: transparent;
        }
        .tabbed-whispers-highlight {
          animation: tabchat-highlight 2.5s ease-out;
        }
        @keyframes tabchat-highlight {
          0% { background-color: rgba(74, 158, 255, 0.3) !important; }
          100% { background-color: transparent !important; }
        }
      </style>
    `;
    
    // Add styles to head if not already present
    if (!$('#tabchat-styles-v13').length) {
      $('head').append(tabStyles);
    }
    
    const tabHtml = `
      <div class="tabchat-container" data-module="tabchat">
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
    
    // Use safer DOM insertion that doesn't conflict with other modules
    try {
      // Find the chat container and insert our tabs as the last child
      const chatContainer = defaultOl.parent();
      if (chatContainer && chatContainer.length) {
        chatContainer.append(tabHtml);
        console.log(`${MODULE_ID}: V13 COMPATIBLE - Added tabbed interface to container`);
      } else {
        // Fallback to the original method
        defaultOl.after(tabHtml);
        console.log(`${MODULE_ID}: V13 COMPATIBLE - Added tabbed interface after OL`);
      }
    } catch (err) {
      console.error(`${MODULE_ID}: Error inserting tab HTML:`, err);
      return;
    }

    // Cache tab panels
    ['ic', 'ooc', 'rolls', 'whisper'].forEach((tab) => {
      const panel = $html.find(`.tabchat-panel[data-tab="${tab}"] ol.chat-messages`);
      TabbedChatManager.tabPanels[tab] = panel;
      console.log(`${MODULE_ID}: Cached panel for ${tab}`, { exists: panel.length > 0 });
    });

    // Add click handlers with proper delegation and error handling
    try {
      $html.find('.tabchat-nav').off('click.tabchat').on('click.tabchat', '.tabchat-tab', (event) => {
        event.preventDefault();
        event.stopPropagation();
        try {
          const tabName = $(event.currentTarget).data('tab');
          console.log(`${MODULE_ID}: Tab clicked: ${tabName}`);
          TabbedChatManager._activateTab(tabName, $html);
        } catch (err) {
          console.error(`${MODULE_ID}: Error handling tab click:`, err);
        }
      });
      console.log(`${MODULE_ID}: Tabs setup complete with click handlers`);
    } catch (err) {
      console.error(`${MODULE_ID}: Error setting up click handlers:`, err);
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
      try {
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
      } catch (err) {
        console.error(`${MODULE_ID}: Error appending message to tab:`, err);
      }
    } else {
      console.warn(`${MODULE_ID}: No valid tab panel for ${tab}`);
    }
  }

  static _getMessageTab(message) {
    try {
      // Handle rolls first - Updated for v13 API
      if (message.isRoll || message.rolls?.length > 0) return 'rolls';
      
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
    } catch (err) {
      console.error(`${MODULE_ID}: Error determining message tab:`, err);
      return 'ooc'; // Default fallback
    }
  }

  static _shouldRenderMessage(message, tab, currentScene, currentUserId, messageAuthor) {
    try {
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
    } catch (err) {
      console.error(`${MODULE_ID}: Error in _shouldRenderMessage:`, err);
      return true; // Default: show message
    }
  }

  static async updateMessage(message, msgHtml, $html) {
    try {
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
    } catch (err) {
      console.error(`${MODULE_ID}: Error updating message:`, err);
    }
  }

  static deleteMessage(messageId, $html) {
    try {
      ['ic', 'ooc', 'rolls', 'whisper'].forEach((tab) => {
        TabbedChatManager.tabPanels[tab]?.find(`[data-message-id="${messageId}"]`).remove();
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
      
      // Hide all panels and show the selected one
      $html.find('.tabchat-panel').removeClass('active').hide();
      $html.find(`.tabchat-panel[data-tab="${tabName}"]`).addClass('active').show();
      
      TabbedChatManager._activeTab = tabName;
      
      // Scroll to bottom when switching tabs
      setTimeout(() => {
        TabbedChatManager._scrollToBottom($html, tabName);
      }, 50);
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
      console.error(`${MODULE_ID}: Error scrolling to bottom:`, err);
    }
  }
}

// Module Initialization - Use later hooks for better compatibility
Hooks.once('init', TabbedChatManager.init);
Hooks.once('ready', TabbedChatManager.ready);

// Setup hooks after everything else is ready
Hooks.once('canvasReady', () => {
  // Even later initialization to ensure all other modules are done
  setTimeout(() => {
    TabbedChatManager.setupHooks();
  }, 1000);
});
