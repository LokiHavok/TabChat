/**
 * Chat Commands Module for Tabbed Chat - FIXED VERSION
 * Handles special chat commands for the tabbed chat system
 * 
 * Commands:
 * /b [message] - Send a bracket/OOC message (appears in OOC tab) prefaced with {OOC}
 * /g [message] - Send a global message (visible across all scenes) prefaced with [Global]
 * /gooc [message] - Alternative syntax for global message
 * 
 * Compatibility Bridge: Narrator Tools
 * Routes Narrator Tools commands to IC tab:
 * /desc, /describe, /description - Descriptive messages
 * /narrate, /narration - Canvas and chat narration
 * /as [speaker] - Send as specific speaker
 * /note, /notify, /notification - GM notes (not routed, stays as-is)
 */

const MODULE_ID = 'tabchat';

class ChatCommands {
  /**
   * Set up hooks for intercepting and processing chat commands
   */
  static setupHooks() {
    console.log(`${MODULE_ID}: Setting up command hooks`);
    
    // Hook into message creation before it happens
    Hooks.on('preCreateChatMessage', (doc, data, options, userId) => {
      const content = data.content || '';
      console.log(`${MODULE_ID}: preCreateChatMessage - content: "${content}"`);
      
      // Handle /b command (bracket/OOC)
      if (content.startsWith('/b ')) {
        console.log(`${MODULE_ID}: Processing /b command`);
        ChatCommands._handleBracketCommand(content, userId, data);
        return false; // Prevent original message
      } 
      // Handle /g or /gooc command (global message)
      else if (content.match(/^\/g(ooc)?\s+/)) {
        console.log(`${MODULE_ID}: Processing /g command`);
        ChatCommands._handleGlobalCommand(content, userId, data);
        return false; // Prevent original message
      }
      
      // COMPATIBILITY BRIDGE: Narrator Tools
      // Ensure Narrator Tools commands route to IC tab
      if (ChatCommands._isNarratorToolsCommand(content)) {
        console.log(`${MODULE_ID}: Detected Narrator Tools command, ensuring IC routing`);
        ChatCommands._ensureICRouting(data);
      }
      
      // Let other messages proceed normally
      return true;
    });

    // Hook to clean up any leaked command messages
    Hooks.on('createChatMessage', (message) => {
      const content = message.content || '';
      if (content.startsWith('/b ') || content.match(/^\/g(ooc)?\s+/)) {
        console.log(`${MODULE_ID}: Cleaning up leaked command message`);
        setTimeout(() => {
          if (message.id) {
            message.delete();
          }
        }, 100);
      }
    });
  }

  /**
   * Check if content is a Narrator Tools command
   * @param {string} content - Message content
   * @returns {boolean} True if Narrator Tools command
   */
  static _isNarratorToolsCommand(content) {
    // Check for Narrator Tools commands (excluding /note which stays GM-only)
    const narratorCommands = [
      /^\/desc\s+/i,
      /^\/describe\s+/i,
      /^\/description\s+/i,
      /^\/narrate\s+/i,
      /^\/narration\s+/i,
      /^\/as\s+/i
    ];
    
    return narratorCommands.some(regex => regex.test(content));
  }

  /**
   * Ensure Narrator Tools messages route to IC tab
   * @param {object} data - Message data
   */
  static _ensureICRouting(data) {
    // Mark this as an IC message by ensuring it has proper speaker data
    if (!data.speaker) {
      data.speaker = ChatMessage.getSpeaker();
    }
    
    // Ensure scene is set for proper instancing
    if (!data.speaker.scene) {
      data.speaker.scene = canvas?.scene?.id;
    }
    
    // Force IC routing by adding a dummy token reference
    // This tricks the routing logic into thinking this is a token message
    if (!data.speaker.token && !data.speaker.actor) {
      // Get first available token or actor as fallback
      const token = canvas?.tokens?.controlled?.[0] || canvas?.tokens?.placeables?.[0];
      if (token) {
        data.speaker.token = token.id;
        data.speaker.actor = token.actor?.id;
      } else {
        // If no token, at least set the scene to ensure IC routing
        data.speaker.token = 'narrator-tools-dummy';
      }
    }
  }

  /**
   * Handle the /b (bracket/OOC) command
   * Creates an OOC message that appears in the current scene's OOC tab
   * Format: [OOC] Represented Actor - Message
   * @param {string} content - The full message content
   * @param {string} userId - The user ID who sent the message  
   * @param {object} originalData - Original message data
   */
  static _handleBracketCommand(content, userId, originalData) {
    // Extract the actual message (everything after "/b ")
    const message = content.substring(3).trim();
    
    if (!message) {
      ui.notifications.warn("Empty /b command. Usage: /b [message]");
      return;
    }
    
    const speaker = ChatMessage.getSpeaker();
    const actor = speaker?.actor ? game.actors.get(speaker.actor) : null;
    const actorName = actor?.name || speaker.alias || 'Unknown';
    
    console.log(`${MODULE_ID}: Creating /b message: "${message}"`);
    
    // Create OOC message with [OOC] Represented Actor - Message format
    ChatMessage.create({
      user: userId,
      author: userId,
      speaker: speaker,
      content: `<span class="tabchat-ooc-prefix">[OOC]</span> <strong>${actorName}</strong> - ${message}`,
      type: CONST.CHAT_MESSAGE_TYPES.OOC,
      _tabchat_forceOOC: true  // Special flag for tab routing
    });
  }

  /**
   * Handle the /g or /gooc (global) command
   * Creates a global message visible across all scenes
   * Format: [GLOBAL] Player Name - Message
   * @param {string} content - The full message content
   * @param {string} userId - The user ID who sent the message
   * @param {object} originalData - Original message data
   */
  static _handleGlobalCommand(content, userId, originalData) {
    // Extract the actual message using regex
    const match = content.match(/^\/g(ooc)?\s+(.+)/);
    const message = match ? match[2] : '';
    
    if (!message) {
      ui.notifications.warn("Empty /g command. Usage: /g [message]");
      return;
    }
    
    const user = game.users.get(userId);
    const playerName = user?.name || 'Unknown Player';
    
    console.log(`${MODULE_ID}: Creating /g message: "${message}"`);
    
    // Create a global message with [GLOBAL] Player Name - Message format
    ChatMessage.create({
      user: userId,
      author: userId,
      speaker: ChatMessage.getSpeaker(),
      content: `<span class="tabchat-global-prefix">[GLOBAL]</span> <strong>${playerName}</strong> - ${message}`,
      type: CONST.CHAT_MESSAGE_TYPES.OOC,
      _tabchat_globalOOC: true  // Special flag for global visibility
    });
  }

  /**
   * Initialize chat command processing
   */
  static init() {
    console.log(`${MODULE_ID}: Initializing chat commands`);
    ChatCommands.setupHooks();
  }
}

// Initialize the command system
Hooks.once('ready', () => {
  ChatCommands.init();
});

console.log(`${MODULE_ID}: Chat commands module loaded`);
