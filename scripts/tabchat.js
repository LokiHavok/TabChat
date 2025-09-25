// Tabbed Chat Module for Foundry VTT v13 - DOM DETECTIVE VERSION
// 4-tab system: WORLD | OOC | GAME | MESSAGES

const MODULE_ID = 'tabchat';

class TabbedChatManager {
  static tabPanels = {};
  static _activeTab = 'world';
  static _hasInjectedTabs = false;

  static init() {
    console.log(`${MODULE_ID} | DOM DETECTIVE - Init called`);
  }

  static ready() {
    console.log(`${MODULE_ID} | DOM DETECTIVE - Ready called`);
    
    // Multiple attempts with DOM investigation
    setTimeout(() => TabbedChatManager.investigateAndInject(), 1000);
    setTimeout(() => TabbedChatManager.investigateAndInject(), 2000);
    setTimeout(() => TabbedChatManager.investigateAndInject(), 3000);
  }

  static setupHooks() {
    console.log(`${MODULE_ID} | DOM DETECTIVE - Setting up hooks`);
    
    // Try injection on chat render
    Hooks.on('renderChatLog', () => {
      setTimeout(() => TabbedChatManager.investigateAndInject(), 200);
    });
    
    // Handle /b commands
    Hooks.on('chatMessage', (chatlog, messageText, chatData) => {
      if (messageText.startsWith('/b ')) {
        const content = '[OOC] ' + messageText.substring(3);
        ChatMessage.create({
          content: content,
          style: CONST.CHAT_MESSAGE_STYLES.OTHER,
          speaker: ChatMessage.getSpeaker(),
          _tabchatOOC: true
        });
        return false;
      }
      return true;
    });
    
    // Handle new messages
    Hooks.on('createChatMessage', (message) => {
      if (TabbedChatManager._hasInjectedTabs) {
        setTimeout(() => TabbedChatManager.renderMessage(message), 50);
      }
    });
  }

  static investigateAndInject() {
    if (TabbedChatManager._hasInjectedTabs) {
      console.log(`${MODULE_ID}: Already injected`);
      return;
    }

    if (!ui.chat?.element) {
      console.log(`${MODULE_ID}: Chat element not ready`);
      return;
    }

    console.log(`${MODULE_ID}: 🔍 INVESTIGATING DOM STRUCTURE`);
    const $chat = $(ui.chat.element);

    // Investigation: What elements exist?
    console.log(`${MODULE_ID}: Chat element HTML:`, $chat[0].outerHTML.substring(0, 500));
    
    // Look for various possible chat containers
    const possibleSelectors = [
      'ol.chat-messages',
      'ol',
      '.chat-messages',
      '.chat-log',
      '#chat-log',
      '.window-content ol',
      '[data-tab="chat"] ol',
      '.chat-messages-container'
    ];

    let $targetElement = null;
    let selectorUsed = '';

    for (const selector of possibleSelectors) {
      const $found = $chat.find(selector);
      if ($found.length > 0) {
        console.log(`${MODULE_ID}: Found ${$found.length} elements with selector: ${selector}`);
        $found.each((i, el) => {
          console.log(`${MODULE_ID}: Element ${i}:`, {
            tagName: el.tagName,
            className: el.className,
            id: el.id,
            innerHTML: el.innerHTML.substring(0, 100)
          });
        });
        
        if (!$targetElement) {
          $targetElement = $found.first();
          selectorUsed = selector;
        }
      }
    }

    if (!$targetElement || !$targetElement.length) {
      console.error(`${MODULE_ID}: ❌ No suitable target element found`);
      
      // Last resort: just inject into the main chat window
      console.log(`${MODULE_ID}: 🚨 LAST RESORT - Injecting into window-content`);
      const $windowContent = $chat.find('.window-content');
      if ($windowContent.length) {
        TabbedChatManager.bruteForceInject($windowContent);
        return;
      } else {
        console.error(`${MODULE_ID}: Even window-content not found!`);
        return;
      }
    }

    console.log(`${MODULE_ID}: ✅ Using target element with selector: ${selectorUsed}`);
    
    // Hide the target element
    $targetElement.css({
      'position': 'absolute',
      'top': '-9999px',
      'left': '-9999px',
      'visibility': 'hidden'
    });

    // Create simple tabs that should definitely be visible
    const tabsHtml = `
      <div id="TABCHAT-OBVIOUS" style="
        position: relative !important;
        z-index: 99999 !important;
        background: #ff0000 !important;
        border: 10px solid #00ff00 !important;
        height: 400px !important;
        width: 100% !important;
        display: block !important;
      ">
        <div style="
          background: #0000ff !important;
          color: #ffffff !important;
          padding: 20px !important;
          font-size: 20px !important;
          font-weight: bold !important;
          text-align: center !important;
        ">TABCHAT IS HERE!</div>
        
        <div id="tabchat-buttons" style="
          height: 60px !important;
          background: #ffff00 !important;
          display: block !important;
        ">
          <button class="tabchat-btn active" data-tab="world" style="
            width: 25% !important;
            height: 60px !important;
            float: left !important;
            background: #215112 !important;
            color: white !important;
            border: 3px solid #000000 !important;
            font-size: 16px !important;
            font-weight: bold !important;
            cursor: pointer !important;
            display: block !important;
          ">WORLD</button>
          
          <button class="tabchat-btn" data-tab="ooc" style="
            width: 25% !important;
            height: 60px !important;
            float: left !important;
            background: #666666 !important;
            color: white !important;
            border: 3px solid #000000 !important;
            font-size: 16px !important;
            font-weight: bold !important;
            cursor: pointer !important;
            display: block !important;
          ">OOC</button>
          
          <button class="tabchat-btn" data-tab="game" style="
            width: 25% !important;
            height: 60px !important;
            float: left !important;
            background: #666666 !important;
            color: white !important;
            border: 3px solid #000000 !important;
            font-size: 16px !important;
            font-weight: bold !important;
            cursor: pointer !important;
            display: block !important;
          ">GAME</button>
          
          <button class="tabchat-btn" data-tab="messages" style="
            width: 25% !important;
            height: 60px !important;
            float: left !important;
            background: #666666 !important;
            color: white !important;
            border: 3px solid #000000 !important;
            font-size: 16px !important;
            font-weight: bold !important;
            cursor: pointer !important;
            display: block !important;
          ">MESSAGES</button>
        </div>
        
        <div id="tabchat-content" style="
          height: 280px !important;
          background: #ffffff !important;
          border: 5px solid #000000 !important;
          overflow: hidden !important;
          position: relative !important;
        ">
          <div class="tabchat-panel active" data-tab="world" style="
            height: 100% !important;
            overflow-y: auto !important;
            padding: 10px !important;
            background: #e0ffe0 !important;
            display: block !important;
          "></div>
          
          <div class="tabchat-panel" data-tab="ooc" style="
            height: 100% !important;
            overflow-y: auto !important;
            padding: 10px !important;
            background: #ffe0e0 !important;
            display: none !important;
          "></div>
          
          <div class="tabchat-panel" data-tab="game" style="
            height: 100% !important;
            overflow-y: auto !important;
            padding: 10px !important;
            background: #e0e0ff !important;
            display: none !important;
          "></div>
          
          <div class="tabchat-panel" data-tab="messages" style="
            height: 100% !important;
            overflow-y: auto !important;
            padding: 10px !important;
            background: #ffffe0 !important;
            display: none !important;
          "></div>
        </div>
      </div>
    `;

    // Insert the tabs
    try {
      $targetElement.after(tabsHtml);
      console.log(`${MODULE_ID}: ✅ INSERTED OBVIOUS TABS after target element`);
    } catch (err) {
      console.error(`${MODULE_ID}: Error inserting after target:`, err);
      try {
        $targetElement.parent().append(tabsHtml);
        console.log(`${MODULE_ID}: ✅ INSERTED OBVIOUS TABS into parent`);
      } catch (err2) {
        console.error(`${MODULE_ID}: Error inserting into parent:`, err2);
        return;
      }
    }

    TabbedChatManager.finishSetup($chat);
  }

  static bruteForceInject($container) {
    console.log(`${MODULE_ID}: 🚨 BRUTE FORCE INJECTION into container`);
    
    const bruteForceHtml = `
      <div id="TABCHAT-BRUTE-FORCE" style="
        position: fixed !important;
        top: 100px !important;
        left: 100px !important;
        width: 400px !important;
        height: 300px !important;
        z-index: 999999 !important;
        background: #ff0000 !important;
        border: 10px solid #00ff00 !important;
        color: #ffffff !important;
        font-size: 20px !important;
        padding: 20px !important;
      ">
        <div>TABCHAT BRUTE FORCE INJECTION</div>
        <button style="background: #215112; color: white; padding: 10px; margin: 5px; font-size: 14px; border: none; cursor: pointer;">WORLD</button>
        <button style="background: #666; color: white; padding: 10px; margin: 5px; font-size: 14px; border: none; cursor: pointer;">OOC</button>
        <button style="background: #666; color: white; padding: 10px; margin: 5px; font-size: 14px; border: none; cursor: pointer;">GAME</button>
        <button style="background: #666; color: white; padding: 10px; margin: 5px; font-size: 14px; border: none; cursor: pointer;">MESSAGES</button>
      </div>
    `;
    
    $container.append(bruteForceHtml);
    console.log(`${MODULE_ID}: ✅ BRUTE FORCE INJECTION COMPLETE`);
  }

  static finishSetup($chat) {
    // Verify the tabs were actually inserted
    const $obvious = $chat.find('#TABCHAT-OBVIOUS');
    if (!$obvious.length) {
      console.error(`${MODULE_ID}: ❌ OBVIOUS TABS NOT FOUND AFTER INSERTION`);
      return;
    }

    console.log(`${MODULE_ID}: ✅ OBVIOUS TABS CONFIRMED IN DOM`);

    // Cache panels
    TabbedChatManager.tabPanels = {
      world: $chat.find('.tabchat-panel[data-tab="world"]'),
      ooc: $chat.find('.tabchat-panel[data-tab="ooc"]'),
      game: $chat.find('.tabchat-panel[data-tab="game"]'),
      messages: $chat.find('.tabchat-panel[data-tab="messages"]')
    };

    // Set up click handlers
    $chat.find('.tabchat-btn').off('click.tabchat').on('click.tabchat', function(event) {
      event.preventDefault();
      event.stopPropagation();
      
      const $btn = $(this);
      const tabName = $btn.data('tab');
      
      console.log(`${MODULE_ID}: 🎯 TAB CLICKED: ${tabName}`);
      
      // Update button styles
      $chat.find('.tabchat-btn').removeClass('active').css('background', '#666666');
      $btn.addClass('active').css('background', '#215112');
      
      // Update panels
      $chat.find('.tabchat-panel').removeClass('active').hide();
      $chat.find(`.tabchat-panel[data-tab="${tabName}"]`).addClass('active').show();
      
      TabbedChatManager._activeTab = tabName;
      
      console.log(`${MODULE_ID}: ✅ Switched to ${tabName}`);
    });

    TabbedChatManager._hasInjectedTabs = true;
    console.log(`${MODULE_ID}: ✅ SETUP COMPLETE - TABS SHOULD BE VISIBLE`);

    // Load existing messages
    setTimeout(() => {
      const messages = game.messages.contents.sort((a, b) => a.timestamp - b.timestamp);
      console.log(`${MODULE_ID}: Loading ${messages.length} existing messages`);
      for (const message of messages) {
        TabbedChatManager.renderMessage(message);
      }
    }, 500);
  }

  static async renderMessage(message) {
    if (!TabbedChatManager._hasInjectedTabs || !message) return;

    const tab = TabbedChatManager.getMessageTab(message);
    const panel = TabbedChatManager.tabPanels[tab];
    
    if (!panel || !panel.length) return;

    let rendered;
    try {
      rendered = await message.renderHTML();
      if (!rendered) return;
    } catch (e) {
      console.error(`${MODULE_ID}: Error rendering message`, e);
      return;
    }

    const $msgHtml = $(rendered);
    
    // For WORLD tab, replace token name with actor name
    if (tab === 'world' && message.speaker?.token) {
      const tokenDoc = canvas?.scene?.tokens?.get(message.speaker.token);
      if (tokenDoc?.actor && tokenDoc.actor.name !== tokenDoc.name) {
        const actorName = tokenDoc.actor.name;
        const tokenName = tokenDoc.name;
        
        $msgHtml.find('*').each(function() {
          if ($(this).text().includes(tokenName)) {
            $(this).html($(this).html().replace(new RegExp(tokenName, 'g'), actorName));
          }
        });
      }
    }

    panel.append($msgHtml);

    if (TabbedChatManager._activeTab === tab && panel[0]) {
      setTimeout(() => {
        panel[0].scrollTop = panel[0].scrollHeight;
      }, 50);
    }

    console.log(`${MODULE_ID}: Added message to ${tab} tab`);
  }

  static getMessageTab(message) {
    try {
      if (message.isRoll || message.rolls?.length > 0) return 'game';
      if (message.whisper?.length > 0) return 'messages';
      if (message._tabchatOOC || (message.content && message.content.includes('[OOC]'))) return 'ooc';
      if (message.speaker?.token) return 'world';
      return 'ooc';
    } catch (err) {
      return 'ooc';
    }
  }
}

// Initialize
Hooks.once('init', TabbedChatManager.init);
Hooks.once('ready', TabbedChatManager.ready);
TabbedChatManager.setupHooks();
