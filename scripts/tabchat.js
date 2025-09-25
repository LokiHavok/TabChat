// Tabbed Chat Module for Foundry VTT v13 - Clean Working Version
// Four tabs: WORLD | OOC | GAME | MESSAGES with scene instancing

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  static currentTab = 'ic';
  static currentScene = null;
  static tabs = null;

  static init() {
    console.log(`${MODULE_ID} | Clean version loading`);
    TabbedChatManager.currentScene = canvas?.scene?.id || 'default';
  }

  static ready() {
    console.log(`${MODULE_ID} | Ready - setting up tabs`);
  }

  static setupHooks() {
    console.log(`${MODULE_ID} | Setting up hooks`);

    // Chat rendering with tab injection
    Hooks.on('renderChatLog', async (chatLog, html, data) => {
      console.log(`${MODULE_ID}: renderChatLog hook fired`);
      TabbedChatManager._injectTabs(html);
    });

    // Message classification on render
    Hooks.on('renderChatMessageHTML', (chatMessage, html, data) => {
      console.log(`${MODULE_ID}: renderChatMessageHTML hook fired`);
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
      if (hasTabUI && html && html.remove) {
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
    console.log(`${MODULE_ID}: _injectTabs called`);
    
    const $html = $(html);
    console.log(`${MODULE_ID}: jQuery element found:`, $html.length > 0);
    
    // Check if already injected
    if ($html.find('.tabchat-container').length > 0) {
      console.log(`${MODULE_ID}: Tabs already injected`);
      return;
    }

    // Find chat log
    let $chatLog = $html.find('#chat-log');
    if ($chatLog.length === 0) {
      $chatLog = $html.find('ol');
      console.log(`${MODULE_ID}: Using fallback selector, found:`, $chatLog.length);
    }
    
    if ($chatLog.length === 0) {
      console.error(`${MODULE_ID}: Could not find chat log`);
      return;
    }

    console.log(`${MODULE_ID}: Found chat log, injecting tabs`);

    // Create the tabbed interface
    const tabsHTML = `
      <div class="tabchat-container">
        <nav class="tabchat-nav">
          <a class="tabchat-tab active" data-tab="ic">WORLD</a>
          <a class="tabchat-tab" data-tab="ooc">OOC</a>
          <a class="tabchat-tab" data-tab="rolls">GAME</a>
          <a class="tabchat-tab" data-tab="messages">MESSAGES</a>
        </nav>
      </div>
      <style>
        .tabchat-nav {
          display: flex;
          background: rgba(0, 0, 0, 0.8);
          border-bottom: 2px solid #444;
          margin: 0;
          padding: 0;
        }
        .tabchat-tab {
          flex: 1;
          padding: 16px 8px;
          text-align: center;
          background: rgba(0, 0, 0, 0.5);
          color: #ccc;
          font-size: 18px;
          font-weight: bold;
          cursor: pointer;
          text-decoration: none;
          border: none;
        }
        .tabchat-tab:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        .tabchat-tab.active {
          background: rgba(255, 255, 255, 0.15);
          color: #fff;
          border-bottom: 3px solid #4CAF50;
        }
        .chat-message {
          display: list-item;
        }
        .chat-message.tabchat-hidden {
          display: none !important;
        }
      </style>
    `;

    // Insert the tabs
    $chatLog.before(tabsHTML);
    
    // Add click handlers
    $html.find('.tabchat-tab').on('click', function(e) {
      e.preventDefault();
      const tabName = $(this).data('tab');
      console.log(`${MODULE_ID}: Tab clicked: ${tabName}`);
      
      $html.find('.tabchat-tab').removeClass('active');
      $(this).addClass('active');
      TabbedChatManager.currentTab = tabName;
      TabbedChatManager._updateVisibility();
    });

    console.log(`${MODULE_ID}: Tabs successfully injected`);
    
    // Initial visibility update
    setTimeout(() => {
      TabbedChatManager._updateVisibility();
    }, 100);
  }

  static _classifyMessage(chatMessage, html, data) {
    console.log(`${MODULE_ID}: Classifying message`);
    
    const $html = $(html);
    const messageStyle = data.message.style;
    
    // Remove existing classes
    $html.removeClass((index, className) => {
      return (className.match(/\btabchat-\S+/g) || []).join(' ');
    });

    // Determine tab classification
    let tabClass = '';
    
    if (chatMessage._tabchat_forceOOC) {
      tabClass = 'tabchat-ooc';
    } else if (chatMessage._tabchat_globalOOC) {
      tabClass = 'tabchat-ooc tabchat-global';
    } else if (chatMessage.isRoll || (chatMessage.rolls && chatMessage.rolls.length > 0)) {
      tabClass = 'tabchat-rolls';
    } else if (chatMessage.whisper && chatMessage.whisper.length > 0) {
      tabClass = 'tabchat-messages';
    } else {
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
          tabClass = data.message.speaker?.token ? 'tabchat-ic' : 'tabchat-ooc';
      }
    }

    // Add classification
    $html.addClass(tabClass);
    
    // Add scene classification
    if (!tabClass.includes('tabchat-messages') && !$html.hasClass('tabchat-global')) {
      const messageScene = data.message.speaker?.scene;
      if (messageScene) {
        $html.addClass('tabchat-scene-specific');
        $html.addClass(`tabchat-scene-${messageScene}`);
      }
    }

    console.log(`${MODULE_ID}: Classified as: ${tabClass}`);
    
    // Update visibility
    TabbedChatManager._updateMessageVisibility($html);
  }

  static _updateVisibility() {
    console.log(`${MODULE_ID}: Updating visibility for tab: ${TabbedChatManager.currentTab}`);
    
    const $messages = $('#chat-log .chat-message');
    console.log(`${MODULE_ID}: Found ${$messages.length} messages to process`);
    
    $messages.each((index, element) => {
      TabbedChatManager._updateMessageVisibility($(element));
    });
    
    // Scroll to bottom
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

    // Messages tab - special rules
    if (TabbedChatManager.currentTab === 'messages') {
      if (game.user.isGM) return true;
      
      const whisperTargets = $messageEl.data('whisper-targets') || [];
      const isAuthor = (messageAuthor === currentUserId);
      const isTarget = whisperTargets.includes(currentUserId);
      return isAuthor || isTarget;
    }

    // Global messages visible to all
    if (isGlobal) return true;

    // Scene-specific filtering
    if (isSceneSpecific && TabbedChatManager.currentScene) {
      const messageScene = $messageEl.hasClass(`tabchat-scene-${TabbedChatManager.currentScene}`);
      const isAuthor = (messageAuthor === currentUserId);
      return messageScene || isAuthor;
    }

    return true;
  }

  static _handleCommands(doc, data, userId) {
    const content = data.content || '';
    
    if (content.startsWith('/b ')) {
      console.log(`${MODULE_ID}: Handling /b command`);
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
      
      return false;
    }
    
    if (content.startsWith('/g ')) {
      console.log(`${MODULE_ID}: Handling /g command`);
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
      
      return false;
    }

    return true;
  }

  static _handleNewMessage(chatMessage) {
    console.log(`${MODULE_ID}: New message created`);
    // Add notification logic here if needed
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

console.log(`${MODULE_ID}: Clean module loaded successfully`);
