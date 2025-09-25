// Tabbed Chat Module for Foundry VTT v13 - CSS-Based Superior Implementation
// Four tabs: WORLD | OOC | GAME | MESSAGES with scene instancing

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  static currentTab = 'ic';
  static currentScene = null;
  static tabs = n// Tabbed Chat Module for Foundry VTT v13 - CSS-Based Superior Implementation
// Four tabs: WORLD | OOC | GAME | MESSAGES with scene instancing

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  static currentTab = 'ic';
  static currentScene = null;
  static tabs = null;

  static init() {
    console.log(`${MODULE_ID} | CSS-Based Superior Implementation loading`);
    TabbedChatManager.currentScene = canvas?.scene?.id || 'default';
  }

  static ready() {
    console.log(`${MODULE_ID} | Ready - setting up enhanced tabs`);
  }

  static setupHooks() {
    // Chat rendering with tab injection
    Hooks.on('renderChatLog', async (chatLog, html, data) => {
      console.log(`${MODULE_ID}: Injecting superior tabbed interface`);
      TabbedChatManager._injectTabs(html);
    });

    // Message classification on render (v13: renderChatMessage → renderChatMessageHTML)
    Hooks.on('renderChatMessageHTML', (chatMessage, html, data) => {
      TabbedChatManager._classifyMessage(chatMessage, html, data);
    });

    // Scene changes
    Hooks.on('canvasReady', (canvas) => {
      const newSceneId = canvas.scene?.id;
      if (newSceneId !== TabbedChatManager.currentScene) {
        console.log(`${MODULE_ID}: Scene changed to ${newSceneId}`);
        TabbedChatManager.currentScene = newSceneId;
        TabbedChatManager._updateVisibility();
      }
    });

    // Command interception
    Hooks.on('preCreateChatMessage', (doc, data, options, userId) => {
      return TabbedChatManager._handleCommands(doc, data, userId);
    });

    // Suppress default message rendering when tabs active
    Hooks.on('renderChatMessageHTML', (message, html) => {
      const hasTabUI = document.querySelector('.tabchat-container');
      if (hasTabUI && html?.remove) {
        html.remove();
        return false;
      }
    });

    // New message notifications
    Hooks.on('createChatMessage', (chatMessage) => {
      TabbedChatManager._handleNewMessage(chatMessage);
    });
  }

  static _injectTabs(html) {
    const $html = $(html);
    
    console.log(`${MODULE_ID}: _injectTabs called`);
    console.log(`${MODULE_ID}: HTML element:`, html);
    console.log(`${MODULE_ID}: jQuery element length:`, $html.length);
    
    // Check if already injected
    if ($html.find('.tabchat-container').length > 0) {
      console.log(`${MODULE_ID}: Tabs already injected, skipping`);
      return;
    }

    // Try multiple selectors to find chat log
    const chatSelectors = [
      '#chat-log',
      'ol#chat-log', 
      '.chat-log',
      'ol.chat-messages',
      '.chat-messages-container',
      '.sidebar-tab[data-tab="chat"] ol',
      'ol'
    ];
    
    let $chatLog = null;
    
    for (const selector of chatSelectors) {
      const found = $html.find(selector);
      console.log(`${MODULE_ID}: Trying selector "${selector}": found ${found.length} elements`);
      if (found.length > 0) {
        $chatLog = found.first();
        console.log(`${MODULE_ID}: Using chat log with selector: ${selector}`);
        break;
      }
    }
    
    if (!$chatLog || $chatLog.length === 0) {
      console.error(`${MODULE_ID}: Could not find chat log element in HTML:`, $html[0]);
      console.error(`${MODULE_ID}: Available elements:`, $html.find('*').map((i, el) => el.tagName + (el.id ? '#' + el.id : '') + (el.className ? '.' + el.className.split(' ').join('.') : '')).get());
      return;
    }

    // Create tab navigation HTML
    const tabNavHTML = `
      <nav class="tabchat-nav tabs" data-group="primary-tabs">
        <a class="tabchat-tab item active" data-tab="ic" data-tooltip="In Character">
          WORLD
          <i class="notification-pip fas fa-exclamation-circle" style="display: none;"></i>
        </a>
        <div class="tabchat-separator"></div>
        <a class="tabchat-tab item" data-tab="ooc" data-tooltip="Out of Character">
          OOC
          <i class="notification-pip fas fa-exclamation-circle" style="display: none;"></i>
        </a>
        <div class="tabchat-separator"></div>
        <a class="tabchat-tab item" data-tab="rolls" data-tooltip="Dice Rolls">
          GAME
          <i class="notification-pip fas fa-exclamation-circle" style="display: none;"></i>
        </a>
        <div class="tabchat-separator"></div>
        <a class="tabchat-tab item" data-tab="messages" data-tooltip="Private Messages">
          MESSAGES
          <i class="notification-pip fas fa-exclamation-circle" style="display: none;"></i>
        </a>
      </nav>
    `;

    // Inject CSS
    const cssHTML = `
      <style>
        .tabchat-nav {
          display: flex !important;
          align-items: center !important;
          background: rgba(0, 0, 0, 0.8) !important;
          border-bottom: 2px solid #444 !important;
          margin: 0 !important;
          padding: 0 !important;
          flex-shrink: 0 !important;
          z-index: 1000 !important;
        }
        .tabchat-tab {
          flex: 1 !important;
          padding: 14px 8px !important;
          text-align: center !important;
          background: rgba(0, 0, 0, 0.5) !important;
          color: #ccc !important;
          font-size: 18px !important;
          font-weight: bold !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          user-select: none !important;
          position: relative !important;
          text-decoration: none !important;
          border: none !important;
        }
        .tabchat-tab:hover {
          background: rgba(255, 255, 255, 0.1) !important;
          color: #fff !important;
        }
        .tabchat-tab.active {
          background: rgba(255, 255, 255, 0.15) !important;
          color: #fff !important;
          border-bottom: 3px solid #4CAF50 !important;
        }
        .tabchat-separator {
          width: 2px !important;
          height: 46px !important;
          background: #666 !important;
          flex-shrink: 0 !important;
        }
        .notification-pip {
          position: absolute !important;
          top: 2px !important;
          right: 4px !important;
          color: #ff6b6b !important;
          font-size: 10px !important;
          animation: pulse 2s infinite !important;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        /* Message visibility classes */
        .chat-message { display: list-item !important; }
        .chat-message.tabchat-hidden { display: none !important; }
        
        /* Message type indicators */
        .tabchat-ic { /* WORLD messages */ }
        .tabchat-ooc { /* OOC messages */ }
        .tabchat-rolls { /* GAME messages */ }
        .tabchat-messages { /* MESSAGES (whispers) */ }
        .tabchat-global { /* Global OOC messages */ }
        
        /* Scene-specific classes */
        .tabchat-scene-specific { /* Has scene association */ }
      </style>
    `;

    console.log(`${MODULE_ID}: Wrapping chat log and inserting tabs`);
    
    // Wrap the chat log content 
    try {
      $chatLog.wrap('<div class="tabchat-container"></div>');
      $chatLog.before(tabNavHTML);
      $html.prepend(cssHTML);
      
      console.log(`${MODULE_ID}: Successfully injected HTML`);

      // Initialize Foundry's TabsV2 system
      try {
        TabbedChatManager.tabs = new TabsV2({
          navSelector: ".tabchat-nav",
          contentSelector: $chatLog.is('#chat-log') ? "#chat-log" : "ol",
          initial: "ic",
          callback: (event, tabs, active) => {
            TabbedChatManager.currentTab = active;
            console.log(`${MODULE_ID}: Switched to ${active} tab`);
            TabbedChatManager._updateVisibility();
            TabbedChatManager._clearNotification(active);
          }
        });

        TabbedChatManager.tabs.bind(html);
        console.log(`${MODULE_ID}: ✅ Superior CSS-based tabs injected and bound`);
        
        // Initial visibility update
        setTimeout(() => {
          console.log(`${MODULE_ID}: Running initial visibility update`);
          TabbedChatManager._updateVisibility();
        }, 100);
        
      } catch (tabError) {
        console.error(`${MODULE_ID}: Error initializing TabsV2:`, tabError);
        
        // Fallback: manual click handlers
        console.log(`${MODULE_ID}: Using fallback click handlers`);
        $html.find('.tabchat-tab').on('click', function(e) {
          e.preventDefault();
          const tabName = $(this).data('tab');
          console.log(`${MODULE_ID}: Manual tab click: ${tabName}`);
          
          $html.find('.tabchat-tab').removeClass('active');
          $(this).addClass('active');
          TabbedChatManager.currentTab = tabName;
          TabbedChatManager._updateVisibility();
          TabbedChatManager._clearNotification(tabName);
        });
      }
      
    } catch (injectError) {
      console.error(`${MODULE_ID}: Error during injection:`, injectError);
    }
  }
      <nav class="tabchat-nav tabs" data-group="primary-tabs">
        <a class="tabchat-tab item active" data-tab="ic" data-tooltip="In Character">
          WORLD
          <i class="notification-pip fas fa-exclamation-circle" style="display: none;"></i>
        </a>
        <div class="tabchat-separator"></div>
        <a class="tabchat-tab item" data-tab="ooc" data-tooltip="Out of Character">
          OOC
          <i class="notification-pip fas fa-exclamation-circle" style="display: none;"></i>
        </a>
        <div class="tabchat-separator"></div>
        <a class="tabchat-tab item" data-tab="rolls" data-tooltip="Dice Rolls">
          GAME
          <i class="notification-pip fas fa-exclamation-circle" style="display: none;"></i>
        </a>
        <div class="tabchat-separator"></div>
        <a class="tabchat-tab item" data-tab="messages" data-tooltip="Private Messages">
          MESSAGES
          <i class="notification-pip fas fa-exclamation-circle" style="display: none;"></i>
        </a>
      </nav>
    `;

    // Inject CSS
    const cssHTML = `
      <style>
        .tabchat-nav {
          display: flex !important;
          align-items: center !important;
          background: rgba(0, 0, 0, 0.8) !important;
          border-bottom: 2px solid #444 !important;
          margin: 0 !important;
          padding: 0 !important;
          flex-shrink: 0 !important;
          z-index: 1000 !important;
        }
        .tabchat-tab {
          flex: 1 !important;
          padding: 14px 8px !important;
          text-align: center !important;
          background: rgba(0, 0, 0, 0.5) !important;
          color: #ccc !important;
          font-size: 18px !important;
          font-weight: bold !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          user-select: none !important;
          position: relative !important;
          text-decoration: none !important;
          border: none !important;
        }
        .tabchat-tab:hover {
          background: rgba(255, 255, 255, 0.1) !important;
          color: #fff !important;
        }
        .tabchat-tab.active {
          background: rgba(255, 255, 255, 0.15) !important;
          color: #fff !important;
          border-bottom: 3px solid #4CAF50 !important;
        }
        .tabchat-separator {
          width: 2px !important;
          height: 46px !important;
          background: #666 !important;
          flex-shrink: 0 !important;
        }
        .notification-pip {
          position: absolute !important;
          top: 2px !important;
          right: 4px !important;
          color: #ff6b6b !important;
          font-size: 10px !important;
          animation: pulse 2s infinite !important;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        /* Message visibility classes */
        .chat-message { display: list-item !important; }
        .chat-message.tabchat-hidden { display: none !important; }
        
        /* Message type indicators */
        .tabchat-ic { /* WORLD messages */ }
        .tabchat-ooc { /* OOC messages */ }
        .tabchat-rolls { /* GAME messages */ }
        .tabchat-messages { /* MESSAGES (whispers) */ }
        .tabchat-global { /* Global OOC messages */ }
        
        /* Scene-specific classes */
        .tabchat-scene-specific { /* Has scene association */ }
      </style>
    `;

    // Wrap the chat log content 
    const $chatLog = $html.find('#chat-log');
    if ($chatLog.length) {
      $chatLog.wrap('<div class="tabchat-container"></div>');
      $chatLog.before(tabNavHTML);
      $html.prepend(cssHTML);

      // Initialize Foundry's TabsV2 system
      TabbedChatManager.tabs = new TabsV2({
        navSelector: ".tabchat-nav",
        contentSelector: "#chat-log",
        initial: "ic",
        callback: (event, tabs, active) => {
          TabbedChatManager.currentTab = active;
          console.log(`${MODULE_ID}: Switched to ${active} tab`);
          TabbedChatManager._updateVisibility();
          TabbedChatManager._clearNotification(active);
        }
      });

      TabbedChatManager.tabs.bind(html);
      console.log(`${MODULE_ID}: ✅ Superior CSS-based tabs injected`);
      
      // Initial visibility update
      setTimeout(() => TabbedChatManager._updateVisibility(), 100);
    }
  }

  static _classifyMessage(chatMessage, html, data) {
    const $html = $(html);
    const messageStyle = data.message.style; // v13: type → style
    const content = data.message.content || '';
    
    // Remove any existing tabchat classes
    $html.removeClass((index, className) => {
      return (className.match(/\btabchat-\S+/g) || []).join(' ');
    });

    // Determine tab classification
    let tabClass = '';
    
    // Handle special commands first
    if (chatMessage._tabchat_forceOOC) {
      tabClass = 'tabchat-ooc';
    } else if (chatMessage._tabchat_globalOOC) {
      tabClass = 'tabchat-ooc tabchat-global';
    } else {
      // Check for rolls first (v13 way)
      if (chatMessage.isRoll || (chatMessage.rolls && chatMessage.rolls.length > 0)) {
        tabClass = 'tabchat-rolls';
      }
      // Check for whispers (v13 way)  
      else if (chatMessage.whisper && chatMessage.whisper.length > 0) {
        tabClass = 'tabchat-messages';
      }
      // Standard classification using v13 CHAT_MESSAGE_STYLES
      else {
        switch (messageStyle) {
          case CONST.CHAT_MESSAGE_STYLES.IC:
          case CONST.CHAT_MESSAGE_STYLES.EMOTE:
            tabClass = 'tabchat-ic';
            break;
          case CONST.CHAT_MESSAGE_STYLES.OOC:
            tabClass = 'tabchat-ooc';
            break;
          case CONST.CHAT_MESSAGE_STYLES.OTHER:
            tabClass = 'tabchat-rolls';
            break;
          default:
            // Token speaker = WORLD, otherwise OOC
            tabClass = data.message.speaker?.token ? 'tabchat-ic' : 'tabchat-ooc';
        }
      }
    }

    // Add tab classification
    $html.addClass(tabClass);

    // Add scene classification for scene-specific tabs
    if (!tabClass.includes('tabchat-messages') && !$html.hasClass('tabchat-global')) {
      const messageScene = data.message.speaker?.scene;
      if (messageScene) {
        $html.addClass('tabchat-scene-specific');
        $html.addClass(`tabchat-scene-${messageScene}`);
      }
    }

    console.log(`${MODULE_ID}: Classified message as: ${tabClass}`);
    
    // Update visibility immediately
    TabbedChatManager._updateMessageVisibility($html);
  }

  static _updateVisibility() {
    const $messages = $('#chat-log .chat-message');
    $messages.each((index, element) => {
      TabbedChatManager._updateMessageVisibility($(element));
    });
    
    // Scroll to bottom after visibility update
    setTimeout(() => {
      const chatLog = document.getElementById('chat-log');
      if (chatLog) {
        chatLog.scrollTop = chatLog.scrollHeight;
      }
    }, 50);
  }

  static _updateMessageVisibility($messageEl) {
    const currentUserId = game.user.id;
    const messageAuthor = $messageEl.data('message')?.author || $messageEl.data('author-id');
    const isVisible = TabbedChatManager._shouldMessageBeVisible($messageEl, currentUserId, messageAuthor);
    
    $messageEl.toggleClass('tabchat-hidden', !isVisible);
  }

  static _shouldMessageBeVisible($messageEl, currentUserId, messageAuthor) {
    // Get message classification
    const isIC = $messageEl.hasClass('tabchat-ic');
    const isOOC = $messageEl.hasClass('tabchat-ooc');
    const isRolls = $messageEl.hasClass('tabchat-rolls');
    const isMessages = $messageEl.hasClass('tabchat-messages');
    const isGlobal = $messageEl.hasClass('tabchat-global');
    const isSceneSpecific = $messageEl.hasClass('tabchat-scene-specific');

    // Tab filtering
    const tabMatch = 
      (TabbedChatManager.currentTab === 'ic' && isIC) ||
      (TabbedChatManager.currentTab === 'ooc' && isOOC) ||
      (TabbedChatManager.currentTab === 'rolls' && isRolls) ||
      (TabbedChatManager.currentTab === 'messages' && isMessages);

    if (!tabMatch) return false;

    // Messages tab (whispers) - special visibility rules
    if (TabbedChatManager.currentTab === 'messages') {
      if (game.user.isGM) return true; // GM sees all whispers
      
      const whisperTargets = $messageEl.data('whisper-targets') || [];
      const isAuthor = (messageAuthor === currentUserId);
      const isTarget = whisperTargets.includes(currentUserId);
      return isAuthor || isTarget;
    }

    // Global OOC messages are visible to everyone
    if (isGlobal) return true;

    // Scene-specific filtering for IC/OOC/ROLLS
    if (isSceneSpecific && TabbedChatManager.currentScene) {
      const messageScene = $messageEl.hasClass(`tabchat-scene-${TabbedChatManager.currentScene}`);
      const isAuthor = (messageAuthor === currentUserId);
      return messageScene || isAuthor; // Show if same scene OR user is author
    }

    return true; // Default to visible
  }

  static _handleCommands(doc, data, userId) {
    const content = data.content || '';
    
    if (content.startsWith('/b ')) {
      console.log(`${MODULE_ID}: Intercepting /b command`);
      const message = content.substring(3).trim();
      const user = game.users.get(userId);
      
      setTimeout(() => {
        ChatMessage.create({
          user: userId,
          author: userId,
          speaker: { alias: user?.name || 'Unknown Player' },
          content: message,
          style: CONST.CHAT_MESSAGE_STYLES.OOC, // v13: type → style
          _tabchat_forceOOC: true
        });
      }, 50);
      
      return false; // Prevent original message
    }
    
    if (content.startsWith('/g ')) {
      console.log(`${MODULE_ID}: Intercepting /g command`);
      const message = content.substring(3).trim();
      
      setTimeout(() => {
        ChatMessage.create({
          user: userId,
          author: userId,
          speaker: ChatMessage.getSpeaker(),
          content: `[Global] ${message}`,
          style: CONST.CHAT_MESSAGE_STYLES.OOC, // v13: type → style
          _tabchat_globalOOC: true
        });
      }, 50);
      
      return false; // Prevent original message
    }

    return true; // Allow other messages
  }

  static _handleNewMessage(chatMessage) {
    const messageStyle = chatMessage.style; // v13: type → style
    const content = chatMessage.content || '';
    
    // Determine which tab this message belongs to
    let targetTab = '';
    
    if (chatMessage._tabchat_forceOOC || content.startsWith('/b ')) {
      targetTab = 'ooc';
    } else if (chatMessage._tabchat_globalOOC || content.startsWith('/g ')) {
      targetTab = 'ooc';
    } else {
      // Check for rolls first (v13 way)
      if (chatMessage.isRoll || (chatMessage.rolls && chatMessage.rolls.length > 0)) {
        targetTab = 'rolls';
      }
      // Check for whispers (v13 way)
      else if (chatMessage.whisper && chatMessage.whisper.length > 0) {
        targetTab = 'messages';
      }
      // Standard classification
      else {
        switch (messageStyle) {
          case CONST.CHAT_MESSAGE_STYLES.IC:
          case CONST.CHAT_MESSAGE_STYLES.EMOTE:
            targetTab = 'ic';
            break;
          case CONST.CHAT_MESSAGE_STYLES.OOC:
            targetTab = 'ooc';
            break;
          case CONST.CHAT_MESSAGE_STYLES.OTHER:
            targetTab = 'rolls';
            break;
          default:
            targetTab = chatMessage.speaker?.token ? 'ic' : 'ooc';
        }
      }
    }

    // Show notification if message is for a different tab
    if (targetTab !== TabbedChatManager.currentTab) {
      TabbedChatManager._showNotification(targetTab);
    }
  }

  static _showNotification(tabName) {
    const $tab = $(`.tabchat-tab[data-tab="${tabName}"]`);
    const $notification = $tab.find('.notification-pip');
    $notification.show();
  }

  static _clearNotification(tabName) {
    const $tab = $(`.tabchat-tab[data-tab="${tabName}"]`);
    const $notification = $tab.find('.notification-pip');
    $notification.hide();
  }

  static _getMessageTab(message) {
    // Handle special commands
    if (message._tabchat_globalOOC || message.content?.startsWith('/g ')) {
      return 'ooc';
    }
    if (message._tabchat_forceOOC || message.content?.startsWith('/b ')) {
      return 'ooc';
    }
    
    // Check for rolls first (v13 way)
    if (message.isRoll || (message.rolls && message.rolls.length > 0)) {
      return 'rolls';
    }
    
    // Check for whispers (v13 way)
    if (message.whisper && message.whisper.length > 0) {
      return 'messages';
    }
    
    // Handle by message style (v13: type → style)
    switch (message.style) {
      case CONST.CHAT_MESSAGE_STYLES.IC:
      case CONST.CHAT_MESSAGE_STYLES.EMOTE:
        return 'ic';
      case CONST.CHAT_MESSAGE_STYLES.OOC:
        return 'ooc';
      case CONST.CHAT_MESSAGE_STYLES.OTHER:
        return 'rolls';
      default:
        return message.speaker?.token ? 'ic' : 'ooc';
    }
  }
}

// Initialize the module
Hooks.once('init', TabbedChatManager.init);
Hooks.once('ready', TabbedChatManager.ready);
TabbedChatManager.setupHooks();

console.log(`${MODULE_ID}: CSS-Based Superior Implementation loaded`);ull;

  static init() {
    console.log(`${MODULE_ID} | CSS-Based Superior Implementation loading`);
    TabbedChatManager.currentScene = canvas?.scene?.id || 'default';
  }

  static ready() {
    console.log(`${MODULE_ID} | Ready - setting up enhanced tabs`);
  }

  static setupHooks() {
    // Chat rendering with tab injection
    Hooks.on('renderChatLog', async (chatLog, html, data) => {
      console.log(`${MODULE_ID}: Injecting superior tabbed interface`);
      TabbedChatManager._injectTabs(html);
    });

    // Message classification on render (v13: renderChatMessage → renderChatMessageHTML)
    Hooks.on('renderChatMessageHTML', (chatMessage, html, data) => {
      TabbedChatManager._classifyMessage(chatMessage, html, data);
    });

    // Scene changes
    Hooks.on('canvasReady', (canvas) => {
      const newSceneId = canvas.scene?.id;
      if (newSceneId !== TabbedChatManager.currentScene) {
        console.log(`${MODULE_ID}: Scene changed to ${newSceneId}`);
        TabbedChatManager.currentScene = newSceneId;
        TabbedChatManager._updateVisibility();
      }
    });

    // Command interception
    Hooks.on('preCreateChatMessage', (doc, data, options, userId) => {
      return TabbedChatManager._handleCommands(doc, data, userId);
    });

    // Suppress default message rendering when tabs active
    Hooks.on('renderChatMessageHTML', (message, html) => {
      const hasTabUI = document.querySelector('.tabchat-container');
      if (hasTabUI && html?.remove) {
        html.remove();
        return false;
      }
    });

    // New message notifications
    Hooks.on('createChatMessage', (chatMessage) => {
      TabbedChatManager._handleNewMessage(chatMessage);
    });
  }

  static _injectTabs(html) {
    const $html = $(html);
    
    // Check if already injected
    if ($html.find('.tabchat-container').length > 0) {
      return;
    }

    // Create tab navigation
    const tabNavHTML = `
      <nav class="tabchat-nav tabs" data-group="primary-tabs">
        <a class="tabchat-tab item active" data-tab="ic" data-tooltip="In Character">
          WORLD
          <i class="notification-pip fas fa-exclamation-circle" style="display: none;"></i>
        </a>
        <div class="tabchat-separator"></div>
        <a class="tabchat-tab item" data-tab="ooc" data-tooltip="Out of Character">
          OOC
          <i class="notification-pip fas fa-exclamation-circle" style="display: none;"></i>
        </a>
        <div class="tabchat-separator"></div>
        <a class="tabchat-tab item" data-tab="rolls" data-tooltip="Dice Rolls">
          GAME
          <i class="notification-pip fas fa-exclamation-circle" style="display: none;"></i>
        </a>
        <div class="tabchat-separator"></div>
        <a class="tabchat-tab item" data-tab="messages" data-tooltip="Private Messages">
          MESSAGES
          <i class="notification-pip fas fa-exclamation-circle" style="display: none;"></i>
        </a>
      </nav>
    `;

    // Inject CSS
    const cssHTML = `
      <style>
        .tabchat-nav {
          display: flex !important;
          align-items: center !important;
          background: rgba(0, 0, 0, 0.8) !important;
          border-bottom: 2px solid #444 !important;
          margin: 0 !important;
          padding: 0 !important;
          flex-shrink: 0 !important;
          z-index: 1000 !important;
        }
        .tabchat-tab {
          flex: 1 !important;
          padding: 14px 8px !important;
          text-align: center !important;
          background: rgba(0, 0, 0, 0.5) !important;
          color: #ccc !important;
          font-size: 18px !important;
          font-weight: bold !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          user-select: none !important;
          position: relative !important;
          text-decoration: none !important;
          border: none !important;
        }
        .tabchat-tab:hover {
          background: rgba(255, 255, 255, 0.1) !important;
          color: #fff !important;
        }
        .tabchat-tab.active {
          background: rgba(255, 255, 255, 0.15) !important;
          color: #fff !important;
          border-bottom: 3px solid #4CAF50 !important;
        }
        .tabchat-separator {
          width: 2px !important;
          height: 46px !important;
          background: #666 !important;
          flex-shrink: 0 !important;
        }
        .notification-pip {
          position: absolute !important;
          top: 2px !important;
          right: 4px !important;
          color: #ff6b6b !important;
          font-size: 10px !important;
          animation: pulse 2s infinite !important;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        /* Message visibility classes */
        .chat-message { display: list-item !important; }
        .chat-message.tabchat-hidden { display: none !important; }
        
        /* Message type indicators */
        .tabchat-ic { /* WORLD messages */ }
        .tabchat-ooc { /* OOC messages */ }
        .tabchat-rolls { /* GAME messages */ }
        .tabchat-messages { /* MESSAGES (whispers) */ }
        .tabchat-global { /* Global OOC messages */ }
        
        /* Scene-specific classes */
        .tabchat-scene-specific { /* Has scene association */ }
      </style>
    `;

    // Wrap the chat log content 
    const $chatLog = $html.find('#chat-log');
    if ($chatLog.length) {
      $chatLog.wrap('<div class="tabchat-container"></div>');
      $chatLog.before(tabNavHTML);
      $html.prepend(cssHTML);

      // Initialize Foundry's TabsV2 system
      TabbedChatManager.tabs = new TabsV2({
        navSelector: ".tabchat-nav",
        contentSelector: "#chat-log",
        initial: "ic",
        callback: (event, tabs, active) => {
          TabbedChatManager.currentTab = active;
          console.log(`${MODULE_ID}: Switched to ${active} tab`);
          TabbedChatManager._updateVisibility();
          TabbedChatManager._clearNotification(active);
        }
      });

      TabbedChatManager.tabs.bind(html);
      console.log(`${MODULE_ID}: ✅ Superior CSS-based tabs injected`);
      
      // Initial visibility update
      setTimeout(() => TabbedChatManager._updateVisibility(), 100);
    }
  }

  static _classifyMessage(chatMessage, html, data) {
    const $html = $(html);
    const messageStyle = data.message.style; // v13: type → style
    const content = data.message.content || '';
    
    // Remove any existing tabchat classes
    $html.removeClass((index, className) => {
      return (className.match(/\btabchat-\S+/g) || []).join(' ');
    });

    // Determine tab classification
    let tabClass = '';
    
    // Handle special commands first
    if (chatMessage._tabchat_forceOOC) {
      tabClass = 'tabchat-ooc';
    } else if (chatMessage._tabchat_globalOOC) {
      tabClass = 'tabchat-ooc tabchat-global';
    } else {
      // Check for rolls first (v13 way)
      if (chatMessage.isRoll || (chatMessage.rolls && chatMessage.rolls.length > 0)) {
        tabClass = 'tabchat-rolls';
      }
      // Check for whispers (v13 way)  
      else if (chatMessage.whisper && chatMessage.whisper.length > 0) {
        tabClass = 'tabchat-messages';
      }
      // Standard classification using v13 CHAT_MESSAGE_STYLES
      else {
        switch (messageStyle) {
          case CONST.CHAT_MESSAGE_STYLES.IC:
          case CONST.CHAT_MESSAGE_STYLES.EMOTE:
            tabClass = 'tabchat-ic';
            break;
          case CONST.CHAT_MESSAGE_STYLES.OOC:
            tabClass = 'tabchat-ooc';
            break;
          case CONST.CHAT_MESSAGE_STYLES.OTHER:
            tabClass = 'tabchat-rolls';
            break;
          default:
            // Token speaker = WORLD, otherwise OOC
            tabClass = data.message.speaker?.token ? 'tabchat-ic' : 'tabchat-ooc';
        }
      }
    }

    // Add tab classification
    $html.addClass(tabClass);

    // Add scene classification for scene-specific tabs
    if (!tabClass.includes('tabchat-messages') && !$html.hasClass('tabchat-global')) {
      const messageScene = data.message.speaker?.scene;
      if (messageScene) {
        $html.addClass('tabchat-scene-specific');
        $html.addClass(`tabchat-scene-${messageScene}`);
      }
    }

    console.log(`${MODULE_ID}: Classified message as: ${tabClass}`);
    
    // Update visibility immediately
    TabbedChatManager._updateMessageVisibility($html);
  }

  static _updateVisibility() {
    const $messages = $('#chat-log .chat-message');
    $messages.each((index, element) => {
      TabbedChatManager._updateMessageVisibility($(element));
    });
    
    // Scroll to bottom after visibility update
    setTimeout(() => {
      const chatLog = document.getElementById('chat-log');
      if (chatLog) {
        chatLog.scrollTop = chatLog.scrollHeight;
      }
    }, 50);
  }

  static _updateMessageVisibility($messageEl) {
    const currentUserId = game.user.id;
    const messageAuthor = $messageEl.data('message')?.author || $messageEl.data('author-id');
    const isVisible = TabbedChatManager._shouldMessageBeVisible($messageEl, currentUserId, messageAuthor);
    
    $messageEl.toggleClass('tabchat-hidden', !isVisible);
  }

  static _shouldMessageBeVisible($messageEl, currentUserId, messageAuthor) {
    // Get message classification
    const isIC = $messageEl.hasClass('tabchat-ic');
    const isOOC = $messageEl.hasClass('tabchat-ooc');
    const isRolls = $messageEl.hasClass('tabchat-rolls');
    const isMessages = $messageEl.hasClass('tabchat-messages');
    const isGlobal = $messageEl.hasClass('tabchat-global');
    const isSceneSpecific = $messageEl.hasClass('tabchat-scene-specific');

    // Tab filtering
    const tabMatch = 
      (TabbedChatManager.currentTab === 'ic' && isIC) ||
      (TabbedChatManager.currentTab === 'ooc' && isOOC) ||
      (TabbedChatManager.currentTab === 'rolls' && isRolls) ||
      (TabbedChatManager.currentTab === 'messages' && isMessages);

    if (!tabMatch) return false;

    // Messages tab (whispers) - special visibility rules
    if (TabbedChatManager.currentTab === 'messages') {
      if (game.user.isGM) return true; // GM sees all whispers
      
      const whisperTargets = $messageEl.data('whisper-targets') || [];
      const isAuthor = (messageAuthor === currentUserId);
      const isTarget = whisperTargets.includes(currentUserId);
      return isAuthor || isTarget;
    }

    // Global OOC messages are visible to everyone
    if (isGlobal) return true;

    // Scene-specific filtering for IC/OOC/ROLLS
    if (isSceneSpecific && TabbedChatManager.currentScene) {
      const messageScene = $messageEl.hasClass(`tabchat-scene-${TabbedChatManager.currentScene}`);
      const isAuthor = (messageAuthor === currentUserId);
      return messageScene || isAuthor; // Show if same scene OR user is author
    }

    return true; // Default to visible
  }

  static _handleCommands(doc, data, userId) {
    const content = data.content || '';
    
    if (content.startsWith('/b ')) {
      console.log(`${MODULE_ID}: Intercepting /b command`);
      const message = content.substring(3).trim();
      const user = game.users.get(userId);
      
      setTimeout(() => {
        ChatMessage.create({
          user: userId,
          author: userId,
          speaker: { alias: user?.name || 'Unknown Player' },
          content: message,
          style: CONST.CHAT_MESSAGE_STYLES.OOC, // v13: type → style
          _tabchat_forceOOC: true
        });
      }, 50);
      
      return false; // Prevent original message
    }
    
    if (content.startsWith('/g ')) {
      console.log(`${MODULE_ID}: Intercepting /g command`);
      const message = content.substring(3).trim();
      
      setTimeout(() => {
        ChatMessage.create({
          user: userId,
          author: userId,
          speaker: ChatMessage.getSpeaker(),
          content: `[Global] ${message}`,
          style: CONST.CHAT_MESSAGE_STYLES.OOC, // v13: type → style
          _tabchat_globalOOC: true
        });
      }, 50);
      
      return false; // Prevent original message
    }

    return true; // Allow other messages
  }

  static _handleNewMessage(chatMessage) {
    const messageStyle = chatMessage.style; // v13: type → style
    const content = chatMessage.content || '';
    
    // Determine which tab this message belongs to
    let targetTab = '';
    
    if (chatMessage._tabchat_forceOOC || content.startsWith('/b ')) {
      targetTab = 'ooc';
    } else if (chatMessage._tabchat_globalOOC || content.startsWith('/g ')) {
      targetTab = 'ooc';
    } else {
      // Check for rolls first (v13 way)
      if (chatMessage.isRoll || (chatMessage.rolls && chatMessage.rolls.length > 0)) {
        targetTab = 'rolls';
      }
      // Check for whispers (v13 way)
      else if (chatMessage.whisper && chatMessage.whisper.length > 0) {
        targetTab = 'messages';
      }
      // Standard classification
      else {
        switch (messageStyle) {
          case CONST.CHAT_MESSAGE_STYLES.IC:
          case CONST.CHAT_MESSAGE_STYLES.EMOTE:
            targetTab = 'ic';
            break;
          case CONST.CHAT_MESSAGE_STYLES.OOC:
            targetTab = 'ooc';
            break;
          case CONST.CHAT_MESSAGE_STYLES.OTHER:
            targetTab = 'rolls';
            break;
          default:
            targetTab = chatMessage.speaker?.token ? 'ic' : 'ooc';
        }
      }
    }

    // Show notification if message is for a different tab
    if (targetTab !== TabbedChatManager.currentTab) {
      TabbedChatManager._showNotification(targetTab);
    }
  }

  static _showNotification(tabName) {
    const $tab = $(`.tabchat-tab[data-tab="${tabName}"]`);
    const $notification = $tab.find('.notification-pip');
    $notification.show();
  }

  static _clearNotification(tabName) {
    const $tab = $(`.tabchat-tab[data-tab="${tabName}"]`);
    const $notification = $tab.find('.notification-pip');
    $notification.hide();
  }

  static _getMessageTab(message) {
    // Handle special commands
    if (message._tabchat_globalOOC || message.content?.startsWith('/g ')) {
      return 'ooc';
    }
    if (message._tabchat_forceOOC || message.content?.startsWith('/b ')) {
      return 'ooc';
    }
    
    // Check for rolls first (v13 way)
    if (message.isRoll || (message.rolls && message.rolls.length > 0)) {
      return 'rolls';
    }
    
    // Check for whispers (v13 way)
    if (message.whisper && message.whisper.length > 0) {
      return 'messages';
    }
    
    // Handle by message style (v13: type → style)
    switch (message.style) {
      case CONST.CHAT_MESSAGE_STYLES.IC:
      case CONST.CHAT_MESSAGE_STYLES.EMOTE:
        return 'ic';
      case CONST.CHAT_MESSAGE_STYLES.OOC:
        return 'ooc';
      case CONST.CHAT_MESSAGE_STYLES.OTHER:
        return 'rolls';
      default:
        return message.speaker?.token ? 'ic' : 'ooc';
    }
  }
}

// Initialize the module
Hooks.once('init', TabbedChatManager.init);
Hooks.once('ready', TabbedChatManager.ready);
TabbedChatManager.setupHooks();

console.log(`${MODULE_ID}: CSS-Based Superior Implementation loaded`);
