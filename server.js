const TelegramBot = require('node-telegram-bot-api');
const { token } = require('./data.js');

// Initialize bot
const bot = new TelegramBot(token, { polling: true });

// CONFIGURATION (CRITICAL)
const ADMIN_ID = 7612857358; // Your PERSONAL ID from @myidbot
const REQUIRED_CHANNEL = "@whiz_t"; // Case-sensitive
const RATE_LIMIT = { count: 3, window: 300000 }; // 3 requests per 5 minutes

// Storage
const userStates = new Map(); // { userId: { verified: boolean } }
const rateLimits = new Map(); // { userId: [timestamp1, timestamp2] }

// 1. VERIFICATION SYSTEM (FIXED)
async function verifyMembership(userId) {
  try {
    const member = await bot.getChatMember(REQUIRED_CHANNEL, userId);
    return ['member', 'administrator', 'creator'].includes(member.status);
  } catch (e) {
    console.error(`Verification failed. Ensure:
      1. Bot is in ${REQUIRED_CHANNEL}
      2. Channel is public
      3. Bot isn't banned from channel`);
    return false;
  }
}

// 2. CONTENT SAVER (WORKS IN ALL CHANNELS)
async function saveContent(userChatId, channelHandle, messageId) {
  try {
    // STEP 1: Forward through your account (bypasses restrictions)
    await bot.forwardMessage(ADMIN_ID, channelHandle, parseInt(messageId));
    
    // STEP 2: Forward from your account to user
    // Get your last forwarded message
    const updates = await bot.getUpdates({ limit: 1, offset: -1 });
    if (updates.length === 0) throw new Error("No recent forwards from admin");
    
    const forwardedMsg = updates[0].message;
    await bot.forwardMessage(userChatId, forwardedMsg.chat.id, forwardedMsg.message_id);
    
    return { success: true };
  } catch (error) {
    console.error("Save error:", error);
    return {
      success: false,
      message: error.response?.description || 
        "Failed to save. The bot may need admin rights in that channel."
    };
  }
}

// 3. MESSAGE HANDLER (WITH DEBUGGING)
bot.on('message', async (msg) => {
  console.log("Incoming message:", msg.text); // Debug log
  
  // Handle /start command
  if (msg.text?.startsWith('/start')) {
    const userId = msg.from.id;
    
    if (userId === ADMIN_ID) {
      userStates.set(userId, { verified: true });
      return bot.sendMessage(msg.chat.id, "👑 Admin access granted!");
    }

    const isMember = await verifyMembership(userId);
    if (isMember) {
      userStates.set(userId, { verified: true });
      return bot.sendMessage(msg.chat.id, "✅ Access granted! Send me Telegram links.");
    } else {
      return bot.sendMessage(
        msg.chat.id,
        `🔒 Please join ${REQUIRED_CHANNEL} first:\n\nhttps://t.me/${REQUIRED_CHANNEL.slice(1)}`,
        { disable_web_page_preview: true }
      );
    }
  }

  // Handle Telegram links
  const linkMatch = msg.text?.match(/https?:\/\/t\.me\/(c\/)?([^/]+)\/(\d+)/i);
  if (linkMatch) {
    const [_, __, channelHandle, messageId] = linkMatch;
    const userId = msg.from.id;

    // Verify membership
    if (!userStates.get(userId)?.verified) {
      return bot.sendMessage(msg.chat.id, "❌ Please verify with /start first");
    }

    // Rate limiting
    const now = Date.now();
    const recentRequests = (rateLimits.get(userId) || []).filter(t => now - t < RATE_LIMIT.window);
    if (recentRequests.length >= RATE_LIMIT.count) {
      const waitTime = Math.ceil((RATE_LIMIT.window - (now - recentRequests[0])) / 60000);
      return bot.sendMessage(msg.chat.id, `⏳ Please wait ${waitTime} minute(s)`);
    }

    // Processing animation
    const progressMsg = await bot.sendMessage(msg.chat.id, "⏳ Processing...\n0% ▰▱▱▱▱▱▱▱▱▱");

    // Simulate processing
    let progress = 0;
    const interval = setInterval(async () => {
      progress += 10;
      try {
        await bot.editMessageText(
          `⏳ Processing...\n${progress}% ${'▰'.repeat(progress/10)}${'▱'.repeat(10-progress/10)}`,
          {
            chat_id: msg.chat.id,
            message_id: progressMsg.message_id
          }
        );
      } catch (e) {}

      if (progress >= 100) {
        clearInterval(interval);
        const result = await saveContent(msg.chat.id, channelHandle, messageId);
        
        await bot.deleteMessage(msg.chat.id, progressMsg.message_id);
        
        if (result.success) {
          rateLimits.set(userId, [...recentRequests, now]);
          await bot.sendMessage(msg.chat.id, "✅ Content saved!");
        } else {
          await bot.sendMessage(msg.chat.id, `❌ Error: ${result.message}`);
        }
      }
    }, 500);
  }
});

// 4. ERROR HANDLING
bot.on('polling_error', (error) => {
  console.error("Polling error:", error);
  if (error.code === 'ETELEGRAM') {
    console.error("Telegram API error:", error.response);
  }
});

console.log("Bot is running and waiting for messages...");
