// Tabbed Chat Module for Foundry VTT v13 - FIXED VERSION
// Inspired by fvtt-tabbed-whispers and proximity-text-chat

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  static tabPanels = {};
  static _activeTab = 'ic';
  static _initialized = false;

  static init() {
    console.log(`${MODULE_ID} | FIXED VERSION LOADING - Init called`);
    
    game.settings.register(MODULE_ID, 'proximityRange', {
      name: 'IC Proximity Range',
      hint: 'Max distance (units) for IC messages to appear (default: 30).',
      scope: 'world',
      config: true,
      default: 30,
      type: Number
    });
    console.log(`${MODULE_ID} | Initialized settings`);
    
    // --- Prototype patch using v13 namespace ---
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
    console.log(`${MODULE_ID} | FIXED VERSION - Ready called`);
    
    // Patch the actual ui.chat instance method too
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
    
    // Failsafe: ensure a hidden ol exists
    try {
      if (ui.chat && ui.chat.element) {
        const $element = $(ui.chat.element);
        if (!$element.find('ol.chat-messages').length) {
          $element.append('<ol class="chat-messages" style="display:none"></ol>');
          console.log(`${MODULE_ID} | Inserted dummy chat-messages <ol> (failsafe)`);
        }
      }
    } catch (err) {
      console.warn(`${MODULE_ID} | Could not add dummy ol failsafe`, err);
    }
    
    // Render existing messages
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
    console.log(`${MODULE_ID} | FIXED VERSION - Setting up hooks`);
    
    // Inject tabs on chat render
    Hooks.on('renderChatLog', async (app, html, data) => {
      await TabbedChatManager.injectTabs(app, html, data);
    });
    
    // Simple pre-create logging
    Hooks.on('preCreateChatMessage', (doc, data, options, userId) => {
      console.log(`${MODULE_ID}: FIXED - preCreateChatMessage`, { id: doc?.id, content: data?.content });
    });
    
    // CRITICAL FIX: Suppress Foundry's default render when tabbed UI is active
    Hooks.on('renderChatMessageHTML', (message, html, data) => {
      try {
        // Check if our tabbed interface is active
        const hasTabUI = ui.chat?.element && $(ui.chat.element).find('.tabchat-container').length > 0;
        
        if (hasTabUI) {
          console.log(`${MODULE_ID}: FIXED - Suppressing renderChatMessageHTML for tabbed UI`, { id: message.id });
          // Remove the HTML element to prevent Foundry from appending it
          if (html) {
            if (html instanceof HTMLElement && typeof html.remove === 'function') {
              html.remove();
            } else if (html && typeof html.remove === 'function') {
              html.remove(); // jQuery
            }
          }
          return false; // Prevent Foundry's default behavior
        }
        
        console.log(`${MODULE_ID}: FIXED - Allowing default renderChatMessageHTML`, { id: message.id });
        return true;
      } catch (err) {
        console.error(`${MODULE_ID}: Error in renderChatMessageHTML hook`, err);
        return true; // Don't break Foundry if something goes wrong
      }
    });
    
    // Create/Update/Delete handlers
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
    
    // Cleanup on unload
    Hooks.on('unload', () => {
      try {
        const ChatLogClass = foundry.applications.sidebar.tabs.ChatLog;
        if (ChatLogClass.prototype._tabchat_originalPostOne) {
          ChatLogClass.prototype._postOne = ChatLogClass.prototype._tabchat_originalPostOne;
          delete ChatLogClass.prototype._tabchat_originalPostOne;
        }
        if (ui.chat && ui.chat._tabchat_originalPostOne) {
          ui.chat._postOne = ui.chat._tabchat_originalPostOne;
          delete ui.chat._tabchat_originalPostOne;
        }
        console.log(`${MODULE_ID} | Restored original methods on unload`);
      } catch (err) {
        console.warn(`${MODULE_ID} | Error restoring originals on unload`, err);
      }
    });
  }

  // Core Methods
  static async injectTabs(app, html, data) {
    if (!(html instanceof HTMLElement)) {
      console.log(`${MODULE_ID}: Skipping injection - invalid HTML type`);
      return;
    }

    const $html = $(html);
    console.log(`${MODULE_ID}: FIXED - Injecting tabs`, { initialized: TabbedChatManager._initialized });

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
    
    // Fixed tab order: WORLD -> OOC -> ROLLS -> WHISPER
    const tabs = [
      { id: 'ic', label: 'WORLD' },
      { id: 'ooc', label: 'OOC' },
      { id: 'rolls', label: 'ROLLS' },
      { id: 'whisper', label: 'WHISPER' }
    ];
    
    const tabHtml = `
      <div class="tabchat-container">
        <nav class="tabchat-nav">
          ${tabs.map((tab) => `
            <a class="tabchat-tab ${tab.id === 'ic' ? 'active' : ''}" data-tab="${tab.id}">
              ${tab.label}
            </a>
          `).join('')}
        </nav>
        ${tabs.map((tab) => `
          <section class="tabchat-panel ${tab.id === 'ic' ? 'active' : ''}" data-tab="${tab.id}">
            <ol class="chat-messages"></ol>
          </section>
        `).join('')}
      </div>
    `;
    
    // Insert tabbed interface AFTER the original ol instead of replacing it
    defaultOl.after(tabHtml);
    console.log(`${MODULE_ID}: FIXED - Added tabbed interface with correct tab order`);

    // Cache tab panels
    ['ic', 'ooc', 'rolls', 'whisper'].forEach((tab) => {
      const panel = $html.find(`.tabchat-panel[data-tab="${tab}"] ol.chat-messages`);
      TabbedChatManager.tabPanels[tab] = panel;
      console.log(`${MODULE_ID}: Cached panel for ${tab}`, { exists: panel.length > 0 });
    });

    // Add click handlers
    $html.find('.tabchat-nav').on('click', '.tabchat-tab', (event) => {
      const tabName = event.currentTarget.dataset.tab;
      TabbedChatManager._activateTab(tabName, $html);
    });

    TabbedChatManager._scrollBottom($html);
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
    const currentScene = canvas?.scene?.id;
    const messageScene = message.speaker?.scene || message._messageScene;
    const currentUserId = game.user.id;
    
    // Scene-based and permission filtering logic
    let shouldRender = true;
    
    if (tab === 'ic') {
      // IC (WORLD) messages: show if same scene OR if user is the author
      const isSameScene = (messageScene === currentScene);
      const isAuthor = (message.user === currentUserId);
      shouldRender = isSameScene || isAuthor;
      console.log(`${MODULE_ID}: IC message check`, { 
        messageScene, 
        currentScene, 
        isAuthor,
        shouldRender 
      });
    } else if (tab === 'ooc') {
      if (message._isGlobalOOC) {
        // Global OOC messages (/g, /gooc) show everywhere
        shouldRender = true;
        console.log(`${MODULE_ID}: Global OOC message - rendering in all scenes`);
      } else {
        // Local OOC: show if same scene OR if user is the author
        const isSameScene = (messageScene === currentScene);
        const isAuthor = (message.user === currentUserId);
        shouldRender = isSameScene || isAuthor;
        console.log(`${MODULE_ID}: Local OOC message check`, { 
          messageScene, 
          currentScene, 
          isAuthor,
          shouldRender 
        });
      }
    } else if (tab === 'rolls') {
      // ROLLS: show if same scene OR if user is the author
      const isSameScene = (messageScene === currentScene);
      const isAuthor = (message.user === currentUserId);
      shouldRender = isSameScene || isAuthor;
      console.log(`${MODULE_ID}: Rolls message check`, { 
        messageScene, 
        currentScene, 
        isAuthor,
        shouldRender 
      });
    } else if (tab === 'whisper') {
      // WHISPER filtering: players see only their whispers, GMs see ALL whispers
      if (game.user.isGM) {
        shouldRender = true; // GMs see all whispers
        console.log(`${MODULE_ID}: GM sees all whispers`);
      } else {
        // Players only see whispers they're involved in
        const whisperTargets = message.whisper || [];
        const isWhisperAuthor = (message.user === currentUserId);
        const isWhisperTarget = whisperTargets.includes(currentUserId);
        shouldRender = isWhisperAuthor || isWhisperTarget;
        console.log(`${MODULE_ID}: Whisper visibility check`, { 
          isAuthor: isWhisperAuthor, 
          isTarget: isWhisperTarget, 
          shouldRender,
          whisperTargets,
          currentUserId,
          messageUser: message.user
        });
      }
    }
    
    if (!shouldRender) {
      console.log(`${MODULE_ID}: Skipping message rendering`, { 
        tab, 
        reason: tab === 'whisper' ? 'not involved in whisper' : 'wrong scene',
        messageScene, 
        currentScene 
      });
      return;
    }
    
    console.log(`${MODULE_ID}: RENDERING message to ${tab} tab`, { messageId: message.id, content: message.content });
    
    if (tab && TabbedChatManager.tabPanels[tab]?.length) {
      // Process chat commands by removing the command prefix
      if (message.content?.startsWith('/g ')) {
        msgHtml.find('.message-content').each(function() {
          const content = $(this).html();
          $(this).html(content.replace('/g ', '[GLOBAL] '));
        });
      } else if (message.content?.startsWith('/gooc ')) {
        msgHtml.find('.message-content').each(function() {
          const content = $(this).html();
          $(this).html(content.replace('/gooc ', '[GLOBAL] '));
        });
      } else if (message.content?.startsWith('/b ')) {
        msgHtml.find('.message-content').each(function() {
          const content = $(this).html();
          $(this).html(content.replace('/b ', '[OOC] '));
        });
      }
      
      TabbedChatManager.tabPanels[tab].append(msgHtml);
      
      // Add highlight effect
      msgHtml.addClass('tabbed-whispers-highlight');
      setTimeout(() => msgHtml.removeClass('tabbed-whispers-highlight'), 2500);
      
      // Scroll to bottom only if this is the active tab and there are messages
      if (TabbedChatManager._activeTab === tab) {
        setTimeout(() => TabbedChatManager._scrollBottom($html, tab), 100);
      }
    } else {
      console.warn(`${MODULE_ID}: No valid tab panel for ${tab}, using OOC fallback`);
      TabbedChatManager.tabPanels['ooc']?.append(msgHtml);
    }
  }

  static _getMessageTab(message) {
    // Handle rolls (dice, combat notifications, etc.)
    if (message.isRoll || message.type === 'roll') return 'rolls';
    
    // Handle combat notifications (round announcements, etc.)
    if (message.type === 'other' && (
        message.content?.includes('Round') || 
        message.content?.includes('Combat') ||
        message.content?.includes('Initiative')
    )) {
      return 'rolls';
    }
    
    // Handle whispers
    if (message.whisper?.length > 0) return 'whisper';
    
    // Check for chat commands
    const content = message.content || '';
    
    // Narrator Tools module commands
    if (content.startsWith('/desc ') || content.startsWith('/describe ') || content.startsWith('/description ')) {
      message._isIC = true;
      message._messageScene = message.speaker?.scene || canvas?.scene?.id;
      return 'ic';
    }
    
    if (content.startsWith('/narrate ') || content.startsWith('/narration ')) {
      message._isIC = true;
      message._messageScene = message.speaker?.scene || canvas?.scene?.id;
      return 'ic';
    }
    
    if (content.startsWith('/note ') || content.startsWith('/notify ') || content.startsWith('/notification ')) {
      message._isLocalOOC = true;
      return 'ooc';
    }
    
    if (content.startsWith('/as ')) {
      message._isIC = true;
      message._messageScene = message.speaker?.scene || canvas?.scene?.id;
      return 'ic';
    }
    
    // Global OOC commands - these show in ALL scenes' OOC tabs
    if (content.startsWith('/g ') || content.startsWith('/gooc ')) {
      message._isGlobalOOC = true;
      return 'ooc';
    }
    
    // Bypass command - forces OOC even when controlling token
    if (content.startsWith('/b ') || content.startsWith('/ooc ')) {
      message._isLocalOOC = true;
      return 'ooc';
    }
    
    // Regular OOC command
    if (content.startsWith('/ooc ')) {
      message._isLocalOOC = true;
      return 'ooc';
    }

    const speaker = message.speaker;
    if (speaker?.token) {
      const messageScene = speaker.scene;
      const currentScene = canvas?.scene?.id;
      
      // If message is from a different scene than current, it goes to OOC
      // (unless it's a global message which we handle separately)
      if (messageScene !== currentScene) {
        message._isFromDifferentScene = true;
        return 'ooc';
      }

      const tokenDoc = canvas?.scene?.tokens?.get(speaker.token);
      if (!tokenDoc) return 'ooc';

      const controlledTokens = canvas?.tokens?.controlled;
      if (controlledTokens.length === 0 || game.user.isGM) {
        // No controlled tokens or GM - goes to IC (WORLD) tab
        message._isIC = true;
        message._messageScene = messageScene;
        return 'ic';
      }

      const controlled = controlledTokens[0];
      const distance = canvas.grid.measureDistance(tokenDoc.center, controlled.center);
      const range = game.settings.get(MODULE_ID, 'proximityRange') || 30;
      
      if (distance <= range) {
        // Within proximity range - goes to IC (WORLD) tab
        message._isIC = true;
        message._messageScene = messageScene;
        return 'ic';
      }
    }

    // Default to OOC for everything else
    message._isLocalOOC = true;
    return 'ooc';
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
    $html.find('.tabchat-tab').removeClass('active');
    $html.find(`[data-tab="${tabName}"]`).addClass('active');
    $html.find('.tabchat-panel').removeClass('active');
    $html.find(`.tabchat-panel[data-tab="${tabName}"]`).addClass('active');
    TabbedChatManager._activeTab = tabName;
    TabbedChatManager._scrollBottom($html);
  }

  static _scrollBottom($html, tabName = TabbedChatManager._activeTab) {
    const ol = $html.find(`.tabchat-panel[data-tab="${tabName}"] ol.chat-messages`);
    if (ol?.length) {
      // Only scroll if there are actual messages in the container
      const messageCount = ol.find('.chat-message').length;
      if (messageCount > 0) {
        ol.prop('scrollTop', ol[0].scrollHeight);
      } else {
        // Reset scroll position if no messages
        ol.prop('scrollTop', 0);
      }
    }
  }
}

// Module Initialization
Hooks.once('init', TabbedChatManager.init);
Hooks.once('ready', TabbedChatManager.ready);

// Setup hooks after everything is defined
TabbedChatManager.setupHooks();
