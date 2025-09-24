TabChat

A Foundry VTT module that adds a tabbed chat interface with four tabs: In-Character (IC), Out-of-Character (OOC), Rolls, and Whispers. IC messages are proximity-based, OOC can be local or global, Rolls are scene-specific, and Whispers are user-specific.

Features





IC Tab: Messages are filtered by:





Scene (only current scene).



Proximity (default 30 ft, configurable).



Commands: /shout or /s (60 ft), /low or /l (15 ft), /phone or /p userId1,userId2 message (cross-scene to recipients, 10 ft eavesdropping in speaker's scene).



OOC Tab: Local to scene by default, use /global message or /gooc message for global chat.



Rolls Tab: Scene-specific dice rolls.



Whispers Tab: Private messages to specific users.



Auto-switches to relevant tab on new messages.



Configurable default proximity range and OOC global setting.

Installation





Place the tabchat folder in Data/modules/ of your Foundry VTT installation.



In Foundry, go to Add-on Modules, click Install Module, and enter the manifest URL: https://raw.githubusercontent.com/yourusername/tabchat/main/module.json (replace with your GitHub repo URL after uploading).



Activate the module in your world.

Usage





Select a token to send IC messages with proximity.



Use commands in the chat input:





/s message or /shout message: Speak at 60 ft.



/l message or /low message: Speak at 15 ft.



/p userId1,userId2 message or /phone userId1,userId2 message: Send to specific users (find IDs via game.users in console). Nearby tokens (10 ft) in the speaker's scene can eavesdrop.



/global message or /gooc message: Global OOC chat.



Configure settings in Game Settings > Configure Settings > Module Settings:





Default IC Proximity Range (default: 30 ft).



OOC Global by Default (default: false).

Compatibility





Tested with Foundry VTT v13.



May work with v12 with minor tweaks (replace canvas.tokens with canvas.tokens.placeables).

Development





Fork or modify the code in scripts/tabchat.js and styles/tabchat.css.



Report issues or contribute at [GitHub repo URL] (replace with your repo).

Credits





Built for Foundry VTT v13.



Inspired by modules like Tabbed Whispers and Voice Range Chat.