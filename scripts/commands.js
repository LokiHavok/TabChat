/**
 * Chat Commands Module for Tabbed Chat
 * Handles special chat commands for the tabbed chat system
 * 
 * Commands:
 * /b [message] - Send a bracket/OOC message (appears in OOC tab)
 * /g [message] - Send a global OOC message (visible across all scenes)
 * /gooc [message] - Alternative syntax for global OOC
 */

const MODULE_ID = 'tabchat';

class ChatCommands {
  /**
   * Set up hooks for intercepting and processing chat commands
   */
  static setupHooks() {
    // Hook into message creation before it happens
    Hooks.on('preCreateChatMessage', (doc, data, options, userId) => {
      const content = data.content || '';
      console.log(`${MODULE_ID}: preCreateChatMessage - content: "${content}"`);
      
      // Handle /b command (bracket/OOC)
      if (content.startsWith('/b ')) {
        console.log(`${MODULE_ID}: Intercepting /b command`);
        return ChatCommands._handleBracketCommand(content, userId);
      } 
      // Handle /g or /gooc command (global OOC)
      else if (content.match(/^\/g(ooc)? /)) {
        console.log(`${MODULE_ID}: Intercepting global OOC command`);
        return ChatCommands._handleGlobalOOCCommand(content, userId);
      }
      
      // Let other messages proceed normally
      return true;
    });
  }

  /**
   * Handle the /b (bracket/OOC) command
   * Creates an OOC message that appears in the current scene's OOC tab
   * @param {string} content - The full message content
   * @param {string} userId - The user ID who sent the message
   * @returns {boolean} false to prevent the original message
   */
  static _handleBracketCommand(content, userId) {
    // Extract the actual message (everything after "/b ")
    const message = content.substring(3).trim();
    const user = game.users.get(userId);
    
    // Create a custom OOC message with special flag
    setTimeout(() => {
      ChatMessage.create({
        user: userId,
        author: userId,
        speaker: { alias: user?.name || 'Unknown Player' },
        content: message,
        type: CONST.CHAT_MESSAGE_TYPES.OOC,
        _tabchat_forceOOC: true  // Special flag for tab routing
      });
    }, 50);
    
    return false; // Prevent the original "/b message" from being created
  }

  /**
   * Handle the /g or /gooc (global OOC) command
   * Creates a global OOC message visible across all scenes
   * @param {string} content - The full message content
   * @param {string} userId - The user ID who sent the message
   * @returns {boolean} false to prevent the original message
   */
  static _handleGlobalOOCCommand(content, userId) {
    // Extract the actual message using regex
    const match = content.match(/^\/g(ooc)? (.+)/);
    const message = match ? match[2] : '';
    
    // Create a global OOC message with special flag
    setTimeout(() => {
      ChatMessage.create({
        user: userId,
        author: userId,
        speaker: ChatMessage.getSpeaker(),
        content: `[Global OOC] ${message}`,
        type: CONST.CHAT_MESSAGE_TYPES.OOC,
        _tabchat_globalOOC: true  // Special flag for global visibility
      });
    }, 50);
    
    return false; // Prevent the original "/g message" from being created
  }
}

// Initialize the command system
ChatCommands.setupHooks();

console.log(`${MODULE_ID}: Chat commands loaded`);
