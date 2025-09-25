// Tabbed Chat Module for Foundry VTT v13 - Feature Complete Restoration
// Four tabs: WORLD | OOC | GAME | MESSAGES with scene instancing

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  static currentTab = 'ic';
  static currentScene = null;
  static tabs = null;

  static init() {
    console.log(`${MODULE_ID} | Feature Complete version loading`);
    TabbedChatManager.currentScene = canvas?.scene?.id || 'default';
  }

  static ready() {
    console.log(`${MODULE_ID} | Ready - setting up enhanced tabs with all features`);
  }

  static setupHooks() {
    console.log(`${MODULE_ID} | Setting up all hooks`);

    // Chat rendering with tab injection
    Hooks.on('renderChatLog', async (chatLog, html, data) => {
      console.log(`${MODULE_ID}: renderChatLog hook fired`);
      TabbedChatManager._injectTabs(html);
    });

    // Message classification on render (v13 compatible)
    Hooks.on('renderChatMessageHTML', (chatMessage, html, data) => {
      TabbedChatManager._classifyMessage(chatMessage, html, data);
    });

    // Scene changes for scene instancing
    Hooks.on('canvasReady', (canvas) => {
      const newSceneId = canvas.scene?.id;
      if (newSceneId !== TabbedChatManager.currentScene) {
        console.log(`${MODULE_ID}: Scene changed from ${TabbedChatManager.currentScene} to ${newSceneId}`);
        TabbedChatManager.currentScene = newSceneId;
        TabbedChatManager._updateVisibility();
      }
    });

    // Command interception for /b and /g
    Hooks.on('preCreateChatMessage', (doc, data, options, userId) => {
      return TabbedChatManager._handleCommands(doc, data, userId);
    });

    // Suppress default rendering for tabbed UI
    Hooks.on('renderChatMessageHTML', (message, html) => {
      const hasTabUI = document.querySelector('.tabchat-nav');
      if (hasTabUI && html && html.remove) {
        html.remove();
        return false;
      }
    });

    // New message handling
    Hooks.on('createChatMessage', (chatMessage) => {
      TabbedChatManager._handleNewMessage(chatMessage);
    });
  }

  static _injectTabs(html) {
    console.log(`${MODULE_ID}: _injectTabs called`);
    
    const $html = $(html);
    
    // Check if already injected
    if ($html.find('.tabchat-nav').length > 0) {
      console.log(`${MODULE_ID}: Tabs already injected`);
      return;
    }

    // Find chat log
    let $chatLog = $html.find('#chat-log');
    if ($chatLog.length === 0) {
      $chatLog = $html.find('ol').first();
      console.log(`${MODULE_ID}: Using fallback selector`);
    }
    
    if ($chatLog.length === 0) {
      console.error(`${MODULE_ID}: Could not find chat log`);
      return;
    }

    console.log(`${MODULE_ID}: Found chat log, injecting tabs`);

    // Create the complete tabbed interface with all features
    const tabsHTML = `
      <div class="tabchat-wrapper">
        <nav class="tabchat-nav">
          <a class="tabchat-tab active" data-tab="ic">WORLD</a>
          <div class="tabchat-separator"></div>
          <a class="tabchat-tab" data-tab="ooc">OOC</a>
          <div class="tabchat-separator"></div>
          <a class="tabchat-tab" data-tab="rolls">GAME</a>
          <div class="tabchat-separator"></div>
          <a class="tabchat-tab" data-tab="messages">MESSAGES</a>
        </nav>
      </div>
      <style>
        .tabchat-wrapper {
          position: relative;
          z-index: 1000;
        }
        .tabchat-nav {
          display: flex !important;
          align-items: center !important;
          background: rgba(0, 0, 0, 0.8) !important;
          border-bottom: 2px solid #444 !important;
          margin: 0 !important;
          padding: 0 !important;
          flex-shrink: 0 !important;
        }
        .tabchat-tab {
          flex: 1 !important;
          padding: 16px 8px !important;
          text-align: center !important;
          background: rgba(0, 0, 0, 0.5) !important;
          color: #ccc !important;
          font-size: 18px !important;
          font-weight: bold !important;
          cursor: pointer !important;
          text-decoration: none !important;
          border: none !important;
          transition: all 0.2s ease !important;
          user-select: none !important;
          position: relative !important;
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
          height: 50px !important;
          background: #666 !important;
          flex-shrink: 0 !important;
        }
        
        /* Message visibility system */
        .chat-message {
          display: list-item !important;
        }
        .chat-message.tabchat-hidden {
          display: none !important;
        }
        
        /* Message classification classes */
        .tabchat-ic { /* WORLD tab messages */ }
        .tabchat-ooc { /* OOC tab messages */ }
        .tabchat-rolls { /* GAME tab messages */ }
        .tabchat-messages { /* MESSAGES tab messages */ }
        .tabchat-global { /* Global OOC messages */ }
        .tabchat-scene-specific { /* Scene-specific messages */ }
        
        /* Global OOC highlighting */
        .tabchat-global {
          background-color: rgba(255, 165, 0, 0.1) !important;
          border-left: 3px solid orange !important;
          padding-left: 8px !important;
        }
      </style>
    `;

    // Insert the tabs before chat log
    $chatLog.before(tabsHTML);
    
    // FIXED: Direct click handlers (not delegation) for reliable clicking
    console.log(`${MODULE_ID}: Adding direct click handlers`);
    
    // Find tabs and attach handlers directly
    const $tabs = $html.find('.tabchat-tab');
    console.log(`${MODULE_ID}: Found ${$tabs.length} tabs to attach handlers to`);
    
    $tabs.each(function() {
      const $tab = $(this);
      const tabName = $tab.data('tab');
      
      console.log(`${MODULE_ID}: Attaching handler to ${tabName} tab`);
      
      $tab.off('click').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log(`${MODULE_ID}: ${tabName} tab clicked!`);
        
        // Update active state
        $tabs.removeClass('active');
        $tab.addClass('active');
        
        // Update current tab
        TabbedChatManager.currentTab = tabName;
        
        // Update message visibility  
        TabbedChatManager._updateVisibility();
        
        console.log(`${MODULE_ID}: Successfully switched to ${tabName} tab`);
      });
    });
    
    // Verify all handlers are attached
    $tabs.each(function(index) {
      const tabName = $(this).data('tab');
      const hasHandler = $._data(this, 'events') && $._data(this, 'events').click;
      console.log(`${MODULE_ID}: Tab ${tabName} - Click handler: ${hasHandler ? 'YES' : 'NO'}`);
    });

    console.log(`${MODULE_ID}: ✅ All features injected successfully`);
    
    // Initial visibility update
    setTimeout(() => {
      TabbedChatManager._updateVisibility();
    }, 200);
  }

  static _classifyMessage(chatMessage, html, data) {
    const $html = $(html);
    const messageStyle = data.message.style;
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

    // Add SCENE CLASSIFICATION for scene instancing (except messages and global)
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
    console.log(`${MODULE_ID}: Updating visibility for tab: ${TabbedChatManager.currentTab}, scene: ${TabbedChatManager.currentScene}`);
    
    const $messages = $('#chat-log .chat-message, ol .chat-message');
    console.log(`${MODULE_ID}: Processing ${$messages.length} messages`);
    
    $messages.each((index, element) => {
      TabbedChatManager._updateMessageVisibility($(element));
    });
    
    // Auto-scroll to bottom after visibility update
    setTimeout(() => {
      const chatLog = document.getElementById('chat-log') || document.querySelector('ol');
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

    // Tab filtering - must match current tab
    const tabMatch = 
      (TabbedChatManager.currentTab === 'ic' && isIC) ||
      (TabbedChatManager.currentTab === 'ooc' && isOOC) ||
      (TabbedChatManager.currentTab === 'rolls' && isRolls) ||
      (TabbedChatManager.currentTab === 'messages' && isMessages);

    if (!tabMatch) return false;

    // MESSAGES tab (whispers) - special visibility rules
    if (TabbedChatManager.currentTab === 'messages') {
      if (game.user.isGM) return true; // GM sees all whispers
      
      const whisperTargets = $messageEl.data('whisper-targets') || [];
      const isAuthor = (messageAuthor === currentUserId);
      const isTarget = whisperTargets.includes(currentUserId);
      return isAuthor || isTarget;
    }

    // GLOBAL OOC messages are visible to everyone regardless of scene
    if (isGlobal) return true;

    // SCENE INSTANCING: Scene-specific filtering for IC/OOC/ROLLS
    if (isSceneSpecific && TabbedChatManager.currentScene) {
      const isCurrentScene = $messageEl.hasClass(`tabchat-scene-${TabbedChatManager.currentScene}`);
      const isAuthor = (messageAuthor === currentUserId);
      return isCurrentScene || isAuthor; // Show if same scene OR user authored it
    }

    return true; // Default: show message
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
          style: CONST.CHAT_MESSAGE_STYLES.OOC,
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
          style: CONST.CHAT_MESSAGE_STYLES.OOC,
          _tabchat_globalOOC: true
        });
      }, 50);
      
      return false; // Prevent original message
    }

    return true; // Allow other messages
  }

  static _handleNewMessage(chatMessage) {
    // Determine which tab this message belongs to for notifications
    let targetTab = '';
    
    if (chatMessage._tabchat_forceOOC) {
      targetTab = 'ooc';
    } else if (chatMessage._tabchat_globalOOC) {
      targetTab = 'ooc';
    } else if (chatMessage.isRoll || (chatMessage.rolls && chatMessage.rolls.length > 0)) {
      targetTab = 'rolls';
    } else if (chatMessage.whisper && chatMessage.whisper.length > 0) {
      targetTab = 'messages';
    } else {
      switch (chatMessage.style) {
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

    console.log(`${MODULE_ID}: New message for ${targetTab} tab`);
    
    // Could add notification system here
    // if (targetTab !== TabbedChatManager.currentTab) {
    //   // Show notification on inactive tab
    // }
  }
}

// Initialize the module
Hooks.once('init', () => {
  console.log(`${MODULE_ID}: Init hook fired`);
  TabbedChatManager.init();
});

Hooks.once('ready', () => {
  console.log(`${MODULE_ID}: Ready hook fired`);
  TabbedChatManager.ready();
});

// Setup all hooks
TabbedChatManager.setupHooks();

console.log(`${MODULE_ID}: Feature Complete module loaded successfully`);
