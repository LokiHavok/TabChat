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
        for (const message of messages) {
          TabbedChatManager.renderMessage(message, $html);
        }
      } catch (err) {
        console.error(`${MODULE_ID} | Error rendering fallback messages`, err);
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
    const tabHtml = `
      <div class="tabchat-container">
        <nav class="tabchat-nav">
          ${['ic', 'ooc', 'rolls', 'whisper'].map((tab) => `
            <a class="tabchat-tab ${tab === 'ic' ? 'active' : ''}" data-tab="${tab}">
              ${tab.toUpperCase()}
            </a>
          `).join('')}
        </nav>
        ${['ic', 'ooc', 'rolls', 'whisper'].map((tab) => `
          <section class="tabchat-panel ${tab === 'ic' ? 'active' : ''}" data-tab="${tab}">
            <ol class="chat-messages"></ol>
          </section>
        `).join('')}
        <ol class="chat-messages" style="display: none !important; height: 0 !important; overflow: hidden !important;"></ol>
      </div>
    `;
    
    defaultOl.replaceWith(tabHtml);
    console.log(`${MODULE_ID}: FIXED - Replaced message list with tabbed interface`);

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
    
    console.log(`${MODULE_ID}: FIXED - Rendering message to ${tab} tab`);
    
    if (tab && TabbedChatManager.tabPanels[tab]?.length) {
      TabbedChatManager.tabPanels[tab].append(msgHtml);
      if (TabbedChatManager._activeTab === tab) {
        TabbedChatManager._scrollBottom($html, tab);
      }
      
      // Add highlight effect
      msgHtml.addClass('tabbed-whispers-highlight');
      setTimeout(() => msgHtml.removeClass('tabbed-whispers-highlight'), 2500);
    } else {
      console.warn(`${MODULE_ID}: No valid tab panel for ${tab}, using OOC fallback`);
      TabbedChatManager.tabPanels['ooc']?.append(msgHtml);
    }
  }

  static _getMessageTab(message) {
    if (message.isRoll) return 'rolls';
    if (message.whisper?.length > 0) return 'whisper';
    if (message.content?.startsWith('/ooc ')) return 'ooc';

    const speaker = message.speaker;
    if (speaker?.token) {
      const sceneId = speaker.scene;
      if (sceneId !== canvas?.scene?.id) return 'ooc';

      const tokenDoc = canvas?.scene?.tokens?.get(speaker.token);
      if (!tokenDoc) return 'ooc';

      const controlledTokens = canvas?.tokens?.controlled;
      if (controlledTokens.length === 0 || game.user.isGM) return 'ic';

      const controlled = controlledTokens[0];
      const distance = canvas.grid.measureDistance(tokenDoc.center, controlled.center);
      const range = game.settings.get(MODULE_ID, 'proximityRange') || 30;
      if (distance <= range) return 'ic';
    }

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
      ol.prop('scrollTop', ol[0].scrollHeight);
    }
  }
}

// Module Initialization
Hooks.once('init', TabbedChatManager.init);
Hooks.once('ready', TabbedChatManager.ready);

// Setup hooks after everything is defined
TabbedChatManager.setupHooks();
