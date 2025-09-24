// Tabbed Chat Module for Foundry VTT v13
// Inspired by fvtt-tabbed-whispers and proximity-text-chat

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  static tabPanels = {};
  static _activeTab = 'ic';
  static _initialized = false;

  // ---------- Robust double-patch + hooks (replace existing init/ready/hooks block) ----------
  static init() {
    game.settings.register(MODULE_ID, 'proximityRange', {
      name: 'IC Proximity Range',
      hint: 'Max distance (units) for IC messages to appear (default: 30).',
      scope: 'world',
      config: true,
      default: 30,
      type: Number
    });
    console.log(`${MODULE_ID} | Initialized settings`);
    // --- Prototype patch: wrap original so behavior falls back if Tabbed UI not present ---
    if (!ChatLog.prototype._tabchat_originalPostOne) {
      ChatLog.prototype._tabchat_originalPostOne = ChatLog.prototype._postOne;
      ChatLog.prototype._postOne = async function (...args) {
        try {
          // Ensure this.element is valid before proceeding
          const $el = this?.element ? $(this.element) : null;
          if ($el && $el.find && $el.find('.tabchat-container').length) {
            console.log(`${MODULE_ID}: Suppressing ChatLog._postOne because tabchat is present`);
            return;
          }
          // No tab container found — fall back to original implementation
          return await ChatLog.prototype._tabchat_originalPostOne.apply(this, args);
        } catch (err) {
          console.error(`${MODULE_ID}: Error in patched ChatLog._postOne`, err);
          // On unexpected error, attempt original behavior
          if (ChatLog.prototype._tabchat_originalPostOne) {
            return await ChatLog.prototype._tabchat_originalPostOne.apply(this, args);
          }
        }
      };
    }
  }

  static ready() {
    if (TabbedChatManager._initialized) {
      console.log(`${MODULE_ID} | Already initialized, skipping`);
      return;
    }
    TabbedChatManager._initialized = true;
    console.log(`${MODULE_ID} | Ready`);
    // Patch the actual ui.chat instance method too (defensive)
    try {
      if (ui.chat && typeof ui.chat._postOne === 'function') {
        if (!ui.chat._tabchat_originalPostOne) ui.chat._tabchat_originalPostOne = ui.chat._postOne;
        ui.chat._postOne = async function (...args) {
          try {
            // Ensure this.element is valid before proceeding
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
    // Failsafe: ensure a hidden ol exists so older code that expects it won't crash
    try {
      if (ui.chat && ui.chat.element && !ui.chat.element.find('ol.chat-messages').length) {
        ui.chat.element.append('<ol class="chat-messages" style="display:none"></ol>');
        console.log(`${MODULE_ID} | Inserted dummy chat-messages <ol> (failsafe)`);
      }
    } catch (err) {
      console.warn(`${MODULE_ID} | Could not add dummy ol failsafe`, err);
    }
    // Render existing messages (deferred as a safety)
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

  // ---------------- Hooks ----------------
  static setupHooks() {
    // Inject tabs on chat render (renderChatLog still works; html may be HTMLElement or jQuery)
    Hooks.on('renderChatLog', async (app, html, data) => {
      await TabbedChatManager.injectTabs(app, html, data);
    });
    
    // Track messages we're handling to prevent Foundry's default behavior
    const customHandledMessages = new Set();
    
    // Mark pre-creation so we can suppress Foundry UI append in render hook
    Hooks.on('preCreateChatMessage', (doc, data, options, userId) => {
      try {
        // Since doc.id might be null at this point, we'll use the content as a temporary identifier
        const tempId = `${data.content}_${Date.now()}_${Math.random()}`;
        customHandledMessages.add(tempId);
        if (doc) doc._tempId = tempId;
        console.log(`${MODULE_ID}: preCreateChatMessage flagged for custom handling`, { id: doc?.id, tempId, content: data?.content });
      } catch (err) {
        console.warn(`${MODULE_ID}: preCreateChatMessage handler error`, err);
      }
    });
    
    // Add the actual message ID once it's created
    Hooks.on('createChatMessage', (message) => {
      try {
        if (message._tempId && customHandledMessages.has(message._tempId)) {
          customHandledMessages.delete(message._tempId);
          customHandledMessages.add(message.id);
          message._customHandled = true;
        }
      } catch (err) {
        console.warn(`${MODULE_ID}: createChatMessage handler error`, err);
      }
    });
    
    // Intercept Foundry's render hook (v13 uses HTMLElement)
    Hooks.on('renderChatMessageHTML', (message, html, data) => {
      try {
        const isCustom = customHandledMessages.has(message.id) || message._customHandled;
        console.log(`${MODULE_ID}: Intercepting renderChatMessageHTML`, { id: message.id, htmlExists: !!html, custom: isCustom });
        
        if (isCustom) {
          // html may be an HTMLElement or jQuery object
          if (html) {
            if (html instanceof HTMLElement && typeof html.remove === 'function') html.remove();
            else if (html && typeof html.remove === 'function') html.remove(); // jQuery
          }
          // Returning false prevents Foundry's default append logic for this message's rendered HTML
          return false;
        }
        return true;
      } catch (err) {
        console.error(`${MODULE_ID}: Error in renderChatMessageHTML hook`, err);
        // If something goes wrong, don't block Foundry
        return true;
      }
    });
    
    // Create/Update/Delete handlers
    Hooks.on('createChatMessage', async (message, html, data) => {
      // Handle the custom tracking first
      try {
        if (message._tempId && customHandledMessages.has(message._tempId)) {
          customHandledMessages.delete(message._tempId);
          customHandledMessages.add(message.id);
          message._customHandled = true;
        }
      } catch (err) {
        console.warn(`${MODULE_ID}: createChatMessage handler error`, err);
      }
      
      // Then render the message
      await TabbedChatManager.renderMessage(message, $(ui.chat.element));
    });
    
    Hooks.on('updateChatMessage', async (message, update, options, userId) => {
      const msgHtml = $(await message.renderHTML());
      await TabbedChatManager.updateMessage(message, msgHtml, $(ui.chat.element));
    });
    
    Hooks.on('deleteChatMessage', (message, options, userId) => {
      TabbedChatManager.deleteMessage(message.id, $(ui.chat.element));
    });
    
    // Optional: restore originals on unload/hot-reload
    Hooks.on('unload', () => {
      try {
        if (ChatLog.prototype._tabchat_originalPostOne) {
          ChatLog.prototype._postOne = ChatLog.prototype._tabchat_originalPostOne;
          delete ChatLog.prototype._tabchat_originalPostOne;
        }
        if (ui.chat && ui.chat._tabchat_originalPostOne) {
          ui.chat._postOne = ui.chat._tabchat_originalPostOne;
          delete ui.chat._tabchat_originalPostOne;
        }
        console.log(`${MODULE_ID} | Restored original ChatLog._postOne on unload`);
      } catch (err) {
        console.warn(`${MODULE_ID} | Error restoring originals on unload`, err);
      }
    });
  }

  // ---------------- Core Methods ----------------
  static async injectTabs(app, html, data) {
    if (!(html instanceof HTMLElement) || TabbedChatManager._initialized) {
      console.log(`${MODULE_ID}: Skipping injection (already initialized or invalid HTML)`, { html });
      return;
    }

    const $html = $(html);
    console.log(`${MODULE_ID}: Initial ChatLog DOM structure`, { html: $html.html() });

    let defaultOl = $html.find('ol.chat-messages');
    if (!defaultOl.length) {
      defaultOl = $html.find('.chat-messages-container ol');
    }
    if (!defaultOl.length) {
      defaultOl = $html.find('ol'); // Broad fallback
    }
    if (!defaultOl.length) {
      console.warn(`${MODULE_ID}: No <ol> found initially, setting up observer`, { html: $html.html() });
      await TabbedChatManager._waitForChatOl($html);
      defaultOl = $html.find('ol.chat-messages') || $html.find('.chat-messages-container ol') || $html.find('ol');
      if (!defaultOl.length) {
        console.error(`${MODULE_ID}: Failed to find OL after waiting, attempting reinitialization`, { html: $html.html() });
        TabbedChatManager._initialized = false; // Allow reinitialization
        return;
      }
    }

    TabbedChatManager._replaceMessageList(defaultOl, $html);
    TabbedChatManager._initialized = true;
  }

  static _waitForChatOl($html) {
    return new Promise((resolve) => {
      const observer = new MutationObserver((mutations, obs) => {
        const ol = $html.find('ol.chat-messages') || $html.find('.chat-messages-container ol') || $html.find('ol');
        if (ol.length) {
          console.log(`${MODULE_ID}: Chat OL detected by observer`, { olCount: ol.length, html: $html.html() });
          obs.disconnect();
          resolve();
        }
      });
      observer.observe($html[0], { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        console.warn(`${MODULE_ID}: Observer timed out waiting for OL after 10 seconds`);
        resolve();
      }, 10000); // 10-second timeout
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
      </div>
    `;
    defaultOl.replaceWith(tabHtml);

    console.log(`${MODULE_ID}: Injected tab order`, { tabs: $html.find('.tabchat-nav .tabchat-tab').map((i, el) => $(el).data('tab')).get() });

    ['ic', 'ooc', 'rolls', 'whisper'].forEach((tab) => {
      const panel = $html.find(`.tabchat-panel[data-tab="${tab}"] ol.chat-messages`);
      TabbedChatManager.tabPanels[tab] = panel;
      if (!panel.length) {
        console.error(`${MODULE_ID}: Failed to cache panel for tab ${tab}`, { domCheck: $html.find(`.tabchat-panel[data-tab="${tab}"]`).length ? 'Panel exists, no OL' : 'Panel missing' });
      } else {
        console.log(`${MODULE_ID}: Successfully cached panel for ${tab}`);
      }
    });

    $html.find('.tabchat-nav').on('click', '.tabchat-tab', (event) => {
      const tabName = event.currentTarget.dataset.tab;
      TabbedChatManager._activateTab(tabName, $html);
    });

    TabbedChatManager._scrollBottom($html);
  }

  static async renderMessage(message, $html) {
    if (!message || typeof message !== 'object') {
      console.error(`${MODULE_ID}: Invalid message object`, { message });
      return;
    }

    let rendered;
    if (message.type === 'base') {
      rendered = `<li class="chat-message" data-message-id="${message.id}"><div class="message-content">[${message.type.toUpperCase()}] ${message.speaker.alias || 'Unknown'}: ${message.content || 'No content'}</div></li>`;
      console.log(`${MODULE_ID}: Custom rendered for base message`, { type: typeof rendered, value: rendered });
    } else {
      try {
        rendered = await message.renderHTML();
        console.log(`${MODULE_ID}: Rendered type (default)`, { type: typeof rendered, value: rendered });
        if (!rendered) {
          throw new Error('Render returned undefined');
        }
      } catch (e) {
        console.error(`${MODULE_ID}: Error rendering message (default)`, {
          error: e.message,
          stack: e.stack,
          message: {
            id: message.id,
            content: message.content,
            type: message.type,
            speaker: message.speaker,
            whisper: message.whisper,
            isRoll: message.isRoll,
            data: message.data || 'Data unavailable'
          }
        });
        rendered = `<li class="chat-message" data-message-id="${message.id}"><div class="message-content">[${message.type.toUpperCase()}] ${message.speaker.alias || 'Unknown'}: ${message.content || 'No content'}</div></li>`;
      }
    }

    let msgHtml = $(rendered);
    if (!msgHtml || typeof msgHtml !== 'object' || !('addClass' in msgHtml)) {
      console.error(`${MODULE_ID}: Invalid msgHtml after wrapping`, {
        msgHtml,
        renderedType: typeof rendered,
        message: {
          id: message.id,
          content: message.content,
          type: message.type,
          speaker: message.speaker,
          whisper: message.whisper
        }
      });
      return;
    }

    const tab = TabbedChatManager._getMessageTab(message);
    if (tab) {
      if (!TabbedChatManager.tabPanels[tab]?.length) {
        console.warn(`${MODULE_ID}: Tab panel for ${tab} not found, reinitializing`);
        let defaultOl = $html.find('ol.chat-messages') || $html.find('.chat-messages-container ol') || $html.find('ol');
        if (defaultOl.length) {
          TabbedChatManager._replaceMessageList(defaultOl, $html);
        } else {
          console.error(`${MODULE_ID}: No OL found for reinitialization`, { html: $html.html() });
        }
      }
      const $panel = $html.find(`.tabchat-panel[data-tab="${tab}"] ol.chat-messages`);
      if ($panel.length) {
        console.log(`${MODULE_ID}: Attempting to append to ${tab} panel`, { panelExists: $panel.length });
        $panel.append(msgHtml);
        if (TabbedChatManager._activeTab === tab) {
          TabbedChatManager._scrollBottom($html, tab);
        }
        msgHtml.addClass('tabbed-whispers-highlight');
        setTimeout(() => msgHtml.removeClass('tabbed-whispers-highlight'), 2500);
      } else {
        console.warn(`${MODULE_ID}: No valid panel for ${tab}, using fallback`, { html: $html.html() });
        TabbedChatManager.tabPanels['ooc']?.append(msgHtml);
      }
    } else {
      console.warn(`${MODULE_ID}: No valid tab for message, using fallback`, { message: { id: message.id, content: message.content, type: message.type } });
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
    if (!msgHtml || typeof msgHtml !== 'object' || !('addClass' in msgHtml)) {
      console.error(`${MODULE_ID}: Invalid msgHtml in updateMessage()`, { msgHtml, message: { id: message.id, content: message.content, type: message.type } });
      return;
    }
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

// Setup all hooks after the class is defined
TabbedChatManager.setupHooks();
