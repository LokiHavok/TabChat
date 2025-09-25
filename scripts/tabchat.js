/**
 * Tabbed Chat Module for Foundry VTT v13 - Main Module
 * Scene Instanced Version with Four Tabs: WORLD | OOC | GAME | MESSAGES
 * 
 * Features:
 * - Scene-based message separation
 * - Four distinct chat tabs
 * - Message routing based on content and speaker
 * - Global OOC messages visible across scenes
 * - Whisper handling in MESSAGES tab
 */

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  // Static properties for managing chat state
  static tabPanels = {};           // jQuery references to tab panels
  static sceneMessages = {};       // Scene-specific message storage
  static globalOOCMessages = [];   // Global OOC messages (cross-scene)
  static _activeTab = 'ic';        // Currently active tab
  static _currentScene = null;     // Current scene ID
  static _chatInjected = false;    // Flag to prevent duplicate injection

  /**
   * Initialize the module on Foundry init
   */
  static init() {
    console.log(`${MODULE_ID} | Concise version loading`);
    TabbedChatManager._currentScene = canvas?.scene?.id || 'default';
    TabbedChatManager._initializeSceneMessages(TabbedChatManager._currentScene);
  }

  /**
   * Module ready - attempt to inject tabs into chat
   */
  static ready() {
    console.log(`${MODULE_ID} | Ready - attempting injection`);
    // Multiple injection attempts to handle various loading scenarios
    [500, 1500, 3000].forEach(delay => {
      setTimeout(() => TabbedChatManager._tryInjectTabs(), delay);
    });
  }

  /**
   * Attempt to inject tabbed interface into the chat window
   */
  static _tryInjectTabs() {
    if (!ui.chat?.element || TabbedChatManager._chatInjected) return;
    
    const $html = $(ui.chat.element);
    if ($html.find('.tabchat-container').length > 0) {
      TabbedChatManager._chatInjected = true;
      TabbedChatManager._loadExistingMessages($html);
      return;
    }

    console.log(`${MODULE_ID}: Injecting tabs...`);
    if (TabbedChatManager._injectTabs($html)) {
      TabbedChatManager._chatInjected = true;
      setTimeout(() => TabbedChatManager._loadExistingMessages($html), 500);
    }
  }

  /**
   * Inject the tabbed interface HTML structure
   * @param {jQuery} $html - The chat element
   * @returns {boolean} Success status
   */
  static _injectTabs($html) {
    // Find and hide the original chat container
    const selectors = ['ol#chat-log', 'ol.chat-messages', '.chat-messages-container ol', 'ol'];
    let chatContainer = null;
    
    for (const selector of selectors) {
      const found = $html.find(selector);
      if (found.length > 0) {
        chatContainer = found.first();
        break;
      }
    }
    
    if (!chatContainer) {
      console.warn(`${MODULE_ID}: No chat container found`);
      return false;
    }

    // Hide the original chat container
    chatContainer.css({
      'display': 'none !important',
      'position': 'absolute',
      'visibility': 'hidden'
    });

    // Create the tabbed interface HTML structure
    const tabsHTML = `
      <div class="tabchat-container">
        <nav class="tabchat-nav">
          <a class="tabchat-tab active" data-tab="ic" style="order: 1;">WORLD</a>
          <div class="tabchat-separator" style="order: 2;"></div>
          <a class="tabchat-tab" data-tab="ooc" style="order: 3;">OOC</a>
          <div class="tabchat-separator" style="order: 4;"></div>
          <a class="tabchat-tab" data-tab="rolls" style="order: 5;">GAME</a>
          <div class="tabchat-separator" style="order: 6;"></div>
          <a class="tabchat-tab" data-tab="messages" style="order: 7;">MESSAGES</a>
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
        <section class="tabchat-panel" data-tab="messages">
          <ol class="chat-messages"></ol>
        </section>
      </div>
    `;

    // Inject the HTML after the original chat container
    chatContainer.after(tabsHTML);

    // Cache panel references for efficient access
    ['ic', 'ooc', 'rolls', 'messages'].forEach(tab => {
      TabbedChatManager.tabPanels[tab] = $html.find(`.tabchat-panel[data-tab="${tab}"] ol.chat-messages`);
      console.log(`${MODULE_ID}: Cached panel ${tab}:`, TabbedChatManager.tabPanels[tab].length > 0);
    });

    // Add click handlers for tab switching
    $html.find('.tabchat-tab').off('click.tabchat').on('click.tabchat', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const tabName = e.currentTarget.dataset.tab;
      console.log(`${MODULE_ID}: Tab clicked: ${tabName}`);
      TabbedChatManager._activateTab(tabName, $html);
    });
    
    console.log(`${MODULE_ID}: Added click handlers to ${$html.find('.tabchat-tab').length} tabs`);
    console.log(`${MODULE_ID}: ✅ Tabs injected successfully`);
    return true;
  }

  /**
   * Load existing messages from the game into appropriate tabs
   * @param {jQuery} $html - The chat element
   */
  static _loadExistingMessages($html) {
    const messages = game.messages.contents.sort((a, b) => a.id.localeCompare(b.id));
    console.log(`${MODULE_ID}: Loading ${messages.length} messages`);
    
    messages.forEach(message => TabbedChatManager.renderMessage(message, $html));
    TabbedChatManager._switchToScene(TabbedChatManager._currentScene, $html);
  }

  /**
   * Initialize message storage for a scene
   * @param {string} sceneId - The scene ID
   */
  static _initializeSceneMessages(sceneId) {
    if (!TabbedChatManager.sceneMessages[sceneId]) {
      TabbedChatManager.sceneMessages[sceneId] = {
        ic: [],      // In-character messages
        ooc: [],     // Out-of-character messages  
        rolls: []    // Dice rolls and game mechanics
      };
    }
  }

  /**
   * Switch to a different scene, updating visible messages
   * @param {string} sceneId - The target scene ID
   * @param {jQuery} $html - The chat element
   */
  static _switchToScene(sceneId, $html) {
    if (!TabbedChatManager._chatInjected) return;
    
    TabbedChatManager._initializeSceneMessages(sceneId);
    
    // Clear scene-specific tabs
    ['ic', 'ooc', 'rolls'].forEach(tab => {
      if (TabbedChatManager.tabPanels[tab]) {
        TabbedChatManager.tabPanels[tab].empty();
      }
    });
    
    // Restore scene-specific messages
    ['ic', 'ooc', 'rolls'].forEach(tab => {
      const messages = TabbedChatManager.sceneMessages[sceneId][tab] || [];
      messages.forEach(msgHtml => {
        if (TabbedChatManager.tabPanels[tab]) {
          TabbedChatManager.tabPanels[tab].append(msgHtml.clone());
        }
      });
    });
    
    // Add global OOC messages (visible across all scenes)
    TabbedChatManager.globalOOCMessages.forEach(msgHtml => {
      if (TabbedChatManager.tabPanels.ooc) {
        TabbedChatManager.tabPanels.ooc.append(msgHtml.clone());
      }
    });
    
    setTimeout(() => TabbedChatManager._scrollToBottom($html), 100);
  }

  /**
   * Render a chat message into the appropriate tab
   * @param {ChatMessage} message - The message to render
   * @param {jQuery} $html - The chat element
   */
  static async renderMessage(message, $html) {
    if (!TabbedChatManager._chatInjected) return;

    // Render the message HTML
    let rendered;
    try {
      rendered = await message.renderHTML();
    } catch (e) {
      console.error(`${MODULE_ID}: Render error`, e);
      return;
    }

    const msgHtml = $(rendered);
    const tab = TabbedChatManager._getMessageTab(message);
    const currentScene = canvas?.scene?.id || 'default';
    const messageScene = message.speaker?.scene || currentScene;
    const currentUserId = game.user.id;
    const messageAuthor = message.author?.id || message.author;
    
    // Check if this message should be visible to the current user
    if (!TabbedChatManager._shouldRenderMessage(message, tab, currentScene, currentUserId, messageAuthor)) {
      return;
    }
    
    // Add message to the appropriate tab
    if (tab && TabbedChatManager.tabPanels[tab]?.length) {
      TabbedChatManager.tabPanels[tab].append(msgHtml);
      TabbedChatManager._storeMessage(message, msgHtml, tab, messageScene);
      
      // Auto-scroll if this tab is currently active
      if (TabbedChatManager._activeTab === tab) {
        setTimeout(() => TabbedChatManager._scrollToBottom($html), 50);
      }
    }
  }

  /**
   * Determine which tab a message should go to based on its properties
   * @param {ChatMessage} message - The message to categorize
   * @returns {string} The target tab name
   */
  static _getMessageTab(message) {
    // Global OOC messages (visible across all scenes)
    if (message._tabchat_globalOOC || message.content?.match(/^\/g(ooc)? /)) {
      return 'ooc';
    }
    
    // /b command messages (bracket/OOC)
    if (message._tabchat_forceOOC || message.content?.startsWith('/b ')) {
      return 'ooc';
    }
    
    // Dice rolls and game mechanics
    if (message.isRoll || message.type === 'roll') return 'rolls';
    
    // Private messages (whispers)
    if (message.whisper?.length > 0) return 'messages';
    
    // Messages with token speakers go to WORLD, others to OOC
    return message.speaker?.token ? 'ic' : 'ooc';
  }

  /**
   * Check if a message should be rendered for the current user and scene
   * @param {ChatMessage} message - The message to check
   * @param {string} tab - The target tab
   * @param {string} currentScene - Current scene ID
   * @param {string} currentUserId - Current user ID
   * @param {string} messageAuthor - Message author ID
   * @returns {boolean} Whether the message should be rendered
   */
  static _shouldRenderMessage(message, tab, currentScene, currentUserId, messageAuthor) {
    const messageScene = message.speaker?.scene || currentScene;
    
    if (tab === 'messages') {
      // Whispers: GMs see all, players see their own
      if (game.user.isGM) return true;
      const whisperTargets = message.whisper || [];
      return messageAuthor === currentUserId || whisperTargets.includes(currentUserId);
    }
    
    if (tab === 'ic' || tab === 'ooc' || tab === 'rolls') {
      // Global OOC messages are visible to everyone
      if (message._tabchat_globalOOC) return true;
      
      // Scene-specific messages: visible in same scene OR if you're the author
      return messageScene === currentScene || messageAuthor === currentUserId;
    }
    
    return true;
  }

  /**
   * Store a message in the appropriate storage location
   * @param {ChatMessage} message - The original message
   * @param {jQuery} msgHtml - The rendered HTML
   * @param {string} tab - The target tab
   * @param {string} messageScene - The message's scene
   */
  static _storeMessage(message, msgHtml, tab, messageScene) {
    if (tab === 'messages') return; // Don't store whispers (they're global)
    
    if (message._tabchat_globalOOC) {
      // Store in global OOC collection
      TabbedChatManager.globalOOCMessages.push(msgHtml.clone());
    } else {
      // Store in scene-specific collection
      TabbedChatManager._initializeSceneMessages(messageScene);
      TabbedChatManager.sceneMessages[messageScene][tab].push(msgHtml.clone());
    }
  }

  /**
   * Activate a specific tab
   * @param {string} tabName - The tab to activate
   * @param {jQuery} $html - The chat element
   */
  static _activateTab(tabName, $html) {
    // Remove active class from all tabs and panels
    $html.find('.tabchat-tab').removeClass('active');
    $html.find('.tabchat-panel').removeClass('active');
    
    // Add active class to selected tab and panel
    $html.find(`.tabchat-tab[data-tab="${tabName}"]`).addClass('active');
    $html.find(`.tabchat-panel[data-tab="${tabName}"]`).addClass('active');
    
    // Update active tab reference
    TabbedChatManager._activeTab = tabName;
    
    // Auto-scroll to bottom of newly activated tab
    setTimeout(() => TabbedChatManager._scrollToBottom($html), 50);
  }

  /**
   * Scroll a tab's chat panel to the bottom
   * @param {jQuery} $html - The chat element
   * @param {string} tabName - The tab to scroll (defaults to active tab)
   */
  static _scrollToBottom($html, tabName = TabbedChatManager._activeTab) {
    const ol = $html.find(`.tabchat-panel[data-tab="${tabName}"] ol.chat-messages`);
    if (ol?.length) {
      ol.scrollTop(ol[0].scrollHeight);
    }
  }

  /**
   * Set up all Foundry VTT hooks for the module
   */
  static setupHooks() {
    // Hook into chat log rendering
    Hooks.on('renderChatLog', (app, html) => {
      TabbedChatManager._tryInjectTabs();
    });
    
    // Hook into scene changes
    Hooks.on('canvasReady', (canvas) => {
      const newSceneId = canvas.scene?.id;
      if (newSceneId !== TabbedChatManager._currentScene) {
        TabbedChatManager._currentScene = newSceneId;
        TabbedChatManager._initializeSceneMessages(newSceneId);
        
        // Switch to the new scene's messages
        if (ui.chat?.element && TabbedChatManager._chatInjected) {
          TabbedChatManager._switchToScene(newSceneId, $(ui.chat.element));
        }
      }
    });
    
    // Hook to prevent duplicate message rendering
    Hooks.on('renderChatMessageHTML', (message, html) => {
      const hasTabUI = ui.chat?.element && $(ui.chat.element).find('.tabchat-container').length > 0;
      if (hasTabUI && html?.remove) {
        html.remove();
        return false;
      }
    });
    
    // Hook into new message creation
    Hooks.on('createChatMessage', async (message) => {
      if (TabbedChatManager._chatInjected && ui.chat?.element) {
        await TabbedChatManager.renderMessage(message, $(ui.chat.element));
      }
    });
  }
}

// Module Initialization
Hooks.once('init', TabbedChatManager.init);
Hooks.once('ready', TabbedChatManager.ready);
TabbedChatManager.setupHooks();

console.log(`${MODULE_ID}: Main module loaded`);
