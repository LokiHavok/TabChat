// Tabbed Chat Module for Foundry VTT v13 - Core Features Only
// Simple 4-tab system: WORLD | OOC | ROLLS | WHISPER

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  static tabPanels = {};
  static _activeTab = 'ic';
  static _initialized = false;

  static init() {
    console.log(`${MODULE_ID} | CORE VERSION - Init called`);
    
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
    console.log(`${MODULE_ID} | CORE VERSION - Ready called`);
    
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
      } catch (err) {
        console.error(`${MODULE_ID} | Error rendering existing messages`, err);
      }
    }, 1500);
  }

  static setupHooks() {
    console.log(`${MODULE_ID} | CORE VERSION - Setting up hooks`);
    
    Hooks.on('renderChatLog', async (app, html, data) => {
      await TabbedChatManager.injectTabs(app, html, data);
    });
    
    Hooks.on('preCreateChatMessage', (doc, data, options, userId) => {
      console.log(`${MODULE_ID}: preCreateChatMessage`, { id: doc?.id, content: data?.content });
      
      try {
        // FIXED: Better type checking for content
        const content = data.content;
        if (content && typeof content === 'string' && content.startsWith('/b ')) {
          // Mark this message as an OOC bypass
          doc._tabchatBypass = true;
          // Remove the /b command from the content and add [OOC] prefix
          data.content = '[OOC] ' + content.substring(3);
          console.log(`${MODULE_ID}: Processed /b command, new content:`, data.content);
        }
      } catch (err) {
        console.error(`${MODULE_ID}: Error in preCreateChatMessage hook`, err);
      }
    });
    
    // FIXED: Less aggressive suppression of renderChatMessageHTML
    Hooks.on('renderChatMessageHTML', (message, html, data) => {
      try {
        const hasTabUI = ui.chat?.element && $(ui.chat.element).find('.tabchat-container').length > 0;
        if (hasTabUI) {
          console.log(`${MODULE_ID}: Suppressing renderChatMessageHTML for tabbed UI`, { id: message.id });
          // Don't completely remove - just prevent default rendering
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

  // Core Methods
  static async injectTabs(app, html, data) {
    if (!(html instanceof HTMLElement)) {
      console.log(`${MODULE_ID}: Skipping injection - invalid HTML type`);
      return;
    }

    const $html = $(html);
    console.log(`${MODULE_ID}: CORE - Injecting tabs`);

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
    // FIXED: Less aggressive hiding - keep it in DOM but make it invisible
    defaultOl.css({
      'position': 'absolute',
      'left': '-9999px',
      'top': '-9999px',
      'width': '1px',
      'height': '1px',
      'overflow': 'hidden',
      'opacity': '0'
    });
    
    // CORRECT tab order: WORLD, OOC, GAME, MESSAGES
    const tabs = [
      { id: 'ic', label: 'WORLD' },
      { id: 'ooc', label: 'OOC' },
      { id: 'rolls', label: 'GAME' },
      { id: 'whisper', label: 'MESSAGES' }
    ];
    
    const tabHtml = `
      <div class="tabchat-container" style="height: 100%; display: flex; flex-direction: column;">
        <nav class="tabchat-nav" style="display: flex; flex-direction: row; border-bottom: 1px solid #444; background: #222; flex-shrink: 0;">
          <a class="tabchat-tab active" data-tab="ic" style="order: 1; padding: 8px 12px; cursor: pointer; border-right: 1px solid #444; background: #333; color: #fff;">WORLD</a>
          <a class="tabchat-tab" data-tab="ooc" style="order: 2; padding: 8px 12px; cursor: pointer; border-right: 1px solid #444; background: #222; color: #ccc;">OOC</a>
          <a class="tabchat-tab" data-tab="rolls" style="order: 3; padding: 8px 12px; cursor: pointer; border-right: 1px solid #444; background: #222; color: #ccc;">GAME</a>
          <a class="tabchat-tab" data-tab="whisper" style="order: 4; padding: 8px 12px; cursor: pointer; background: #222; color: #ccc;">MESSAGES</a>
        </nav>
        <div class="tabchat-content" style="flex: 1; overflow: hidden; position: relative;">
          <section class="tabchat-panel active" data-tab="ic" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; overflow-y: auto;">
            <ol class="chat-messages" style="list-style: none; margin: 0; padding: 8px;"></ol>
          </section>
          <section class="tabchat-panel" data-tab="ooc" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; overflow-y: auto; display: none;">
            <ol class="chat-messages" style="list-style: none; margin: 0; padding: 8px;"></ol>
          </section>
          <section class="tabchat-panel" data-tab="rolls" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; overflow-y: auto; display: none;">
            <ol class="chat-messages" style="list-style: none; margin: 0; padding: 8px;"></ol>
          </section>
          <section class="tabchat-panel" data-tab="whisper" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; overflow-y: auto; display: none;">
            <ol class="chat-messages" style="list-style: none; margin: 0; padding: 8px;"></ol>
          </section>
        </div>
      </div>
    `;
    
    // Insert tabbed interface AFTER the original ol
    defaultOl.after(tabHtml);
    console.log(`${MODULE_ID}: CORE - Added tabbed interface with correct order: WORLD | OOC | GAME | MESSAGES`);

    // Cache tab panels
    ['ic', 'ooc', 'rolls', 'whisper'].forEach((tab) => {
      const panel = $html.find(`.tabchat-panel[data-tab="${tab}"] ol.chat-messages`);
      TabbedChatManager.tabPanels[tab] = panel;
      console.log(`${MODULE_ID}: Cached panel for ${tab}`, { exists: panel.length > 0 });
    });

    // FIXED: Better tab styling and click handlers
    $html.find('.tabchat-nav').on('click', '.tabchat-tab', (event) => {
      const tabName = event.currentTarget.dataset.tab;
      TabbedChatManager._activateTab(tabName, $html);
    });

    // Add hover effects
    $html.find('.tabchat-tab').hover(
      function() { 
        if (!$(this).hasClass('active')) {
          $(this).css('background-color', '#2a2a2a');
        }
      },
      function() { 
        if (!$(this).hasClass('active')) {
          $(this).css('background-color', '#222');
        }
      }
    );

    console.log(`${MODULE_ID}: Tabs setup complete`);
  }

  static async renderMessage(message, $html) {
    if (!message || typeof message !== 'object') {
      console.error(`${MODULE_ID}: Invalid message object`);
      return;
    }

    // Check if tabchat container exists
    if (!$html.find('.tabchat-container').length) {
      console.log(`${MODULE_ID}: No tabchat container found, skipping message render`);
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
    
    // Use author instead of deprecated user property
    const messageAuthor = message.author?.id || message.author;
    
    console.log(`${MODULE_ID}: Processing message for ${tab} tab`, {
      id: message.id,
      author: messageAuthor,
      currentUser: currentUserId,
      scene: currentScene,
      content: (message.content || '').substring(0, 30) + '...'
    });
    
    // SIMPLIFIED filtering logic
    let shouldRender = TabbedChatManager._shouldRenderMessage(message, tab, currentScene, currentUserId, messageAuthor);
    
    if (!shouldRender) {
      console.log(`${MODULE_ID}: Skipping message - filtered out`);
      return;
    }
    
    console.log(`${MODULE_ID}: ✅ RENDERING message to ${tab} tab`);
    
    if (tab && TabbedChatManager.tabPanels[tab]?.length) {
      // Process /b command display
      const content = message.content || '';
      if (content.startsWith('/b ')) {
        msgHtml.find('.message-content').each(function() {
          const currentContent = $(this).html();
          $(this).html(currentContent.replace('/b ', '[OOC] '));
        });
      }
      
      // For WORLD tab, replace token name with actor name
      if (tab === 'ic' && message.speaker?.token && message.speaker?.actor) {
        const tokenDoc = canvas?.scene?.tokens?.get(message.speaker.token);
        if (tokenDoc && tokenDoc.actor) {
          const actorName = tokenDoc.actor.name;
          const tokenName = tokenDoc.name;
          
          // Replace token name with actor name in the message display
          msgHtml.find('.message-sender, .sender-name, .speaker-name').each(function() {
            const $this = $(this);
            if ($this.text().includes(tokenName)) {
              $this.html($this.html().replace(tokenName, actorName));
            }
          });
          
          // Also check in the main content area for speaker identification
          msgHtml.find('.message-content, .flavor-text').each(function() {
            const $this = $(this);
            if ($this.html().includes(tokenName)) {
              $this.html($this.html().replace(new RegExp(tokenName, 'g'), actorName));
            }
          });
          
          console.log(`${MODULE_ID}: Replaced token name "${tokenName}" with actor name "${actorName}" in WORLD tab`);
        }
      }
      
      // FIXED: Ensure the message is properly appended
      const targetPanel = TabbedChatManager.tabPanels[tab];
      if (targetPanel && targetPanel.length > 0) {
        targetPanel.append(msgHtml);
        
        // Add highlight effect
        msgHtml.addClass('tabbed-whispers-highlight');
        setTimeout(() => msgHtml.removeClass('tabbed-whispers-highlight'), 2500);
        
        // Only scroll if this is the active tab
        if (TabbedChatManager._activeTab === tab) {
          setTimeout(() => {
            TabbedChatManager._scrollBottom($html, tab);
          }, 50);
        }

        console.log(`${MODULE_ID}: Message successfully appended to ${tab} tab`);
      } else {
        console.error(`${MODULE_ID}: Target panel not found for tab ${tab}`);
      }
    } else {
      console.warn(`${MODULE_ID}: No valid tab panel for ${tab}`);
    }
  }

  static _getMessageTab(message) {
    // Handle rolls first
    if (message.isRoll || message.type === 'roll') return 'rolls';
    
    // Handle whispers
    if (message.whisper?.length > 0) return 'whisper';
    
    // Check for processed /b bypass command
    if (message._tabchatBypass) {
      console.log(`${MODULE_ID}: Bypass flag detected, routing to OOC`);
      return 'ooc';
    }
    
    // Legacy check for unprocessed /b command (fallback) with null check
    const content = message.content || '';
    if (typeof content === 'string' && content.startsWith('/b ')) {
      console.log(`${MODULE_ID}: Unprocessed /b command detected, routing to OOC`, { content: content.substring(0, 20) });
      return 'ooc';
    }
    
    // Check if message has a token speaker
    const speaker = message.speaker;
    if (speaker?.token) {
      // Token is speaking = WORLD (IC)
      console.log(`${MODULE_ID}: Token speaker detected, routing to WORLD`, { token: speaker.token });
      return 'ic';
    }
    
    // No token = OOC (includes GM narration without token)
    console.log(`${MODULE_ID}: No token speaker, routing to OOC`);
    return 'ooc';
  }

  static _shouldRenderMessage(message, tab, currentScene, currentUserId, messageAuthor) {
    // Get scene info
    const messageScene = message.speaker?.scene;
    
    if (tab === 'whisper') {
      // WHISPER: GMs see all, players see only their own
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
      // WORLD/OOC/ROLLS: Show if same scene OR if user is author
      const isSameScene = !messageScene || !currentScene || (messageScene === currentScene);
      const isAuthor = (messageAuthor === currentUserId);
      return isSameScene || isAuthor;
    }
    
    return true; // Default: show message
  }

  static async updateMessage(message, msgHtml, $html) {
    const tab = TabbedChatManager._getMessageTab(message);
    if (tab && TabbedChatManager.tabPanels[tab]?.length) {
      const existing = TabbedChatManager.tabPanels[tab].find(`[data-message-id="${message.id}"]`);
      if (existing.length) {
        existing.replaceWith(msgHtml);
        if (TabbedChatManager._activeTab === tab) {
          TabbedChatManager._scrollBottom($html, tab);
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
    // Update tab appearance
    $html.find('.tabchat-tab').removeClass('active').css({
      'background-color': '#222',
      'color': '#ccc'
    });
    $html.find(`[data-tab="${tabName}"]`).addClass('active').css({
      'background-color': '#333',
      'color': '#fff'
    });
    
    // Update panel visibility
    $html.find('.tabchat-panel').removeClass('active').hide();
    $html.find(`.tabchat-panel[data-tab="${tabName}"]`).addClass('active').show();
    
    TabbedChatManager._activeTab = tabName;
    console.log(`${MODULE_ID}: Activated tab ${tabName}`);
    
    // Scroll to bottom when switching tabs
    setTimeout(() => {
      TabbedChatManager._scrollBottom($html, tabName);
    }, 50);
  }

  static _scrollBottom($html, tabName = TabbedChatManager._activeTab) {
    const panel = $html.find(`.tabchat-panel[data-tab="${tabName}"]`);
    if (panel?.length) {
      panel.prop('scrollTop', panel[0].scrollHeight);
    }
  }
}

// Module Initialization
Hooks.once('init', TabbedChatManager.init);
Hooks.once('ready', TabbedChatManager.ready);

// Setup hooks after everything is defined
TabbedChatManager.setupHooks();
