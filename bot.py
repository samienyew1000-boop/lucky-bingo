import os
import logging
from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    WebAppInfo,
)
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    ContextTypes,
)

# ==============================================================================
# CONFIGURATION
# ==============================================================================
# Replace with your Bot Token from @BotFather, or set the BOT_TOKEN environment variable
BOT_TOKEN = os.getenv("BOT_TOKEN", "YOUR_BOT_TOKEN_HERE")

# Lucky Bingo Web App URL
WEB_APP_URL = os.getenv("WEB_APP_URL", "https://lucky-bingo-iota.vercel.app/")

# Telegram Channel or Community Group URL
GROUP_URL = os.getenv("GROUP_URL", "https://t.me/your_telegram_channel")

# Support / Contact URL (or use callback)
CONTACT_URL = os.getenv("CONTACT_URL", "https://t.me/your_support_username")

# ==============================================================================
# LOGGING SETUP
# ==============================================================================
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


# ==============================================================================
# KEYBOARD BUILDER
# ==============================================================================
def get_main_keyboard() -> InlineKeyboardMarkup:
    """
    Builds the inline keyboard with the exact 6-row layout:
      Row 1: Play Games 🎮 (Full width Web App)
      Row 2: Deposit 💰 | Withdraw 💰
      Row 3: Transfer ↔️ | My Profile 👤
      Row 4: Transactions 📜 | Balance 💰
      Row 5: Join Group ↗️ | Contact Us
      Row 6: Refer & Earn 🎁
    """
    keyboard = [
        # Row 1: Full-width Web App button
        [
            InlineKeyboardButton(
                text="Play Games 🎮",
                web_app=WebAppInfo(url=WEB_APP_URL),
            )
        ],
        # Row 2: Deposit & Withdraw
        [
            InlineKeyboardButton(text="Deposit 💰", callback_data="deposit"),
            InlineKeyboardButton(text="Withdraw 💰", callback_data="withdraw"),
        ],
        # Row 3: Transfer & My Profile
        [
            InlineKeyboardButton(text="Transfer ↔️", callback_data="transfer"),
            InlineKeyboardButton(text="My Profile 👤", callback_data="profile"),
        ],
        # Row 4: Transactions & Balance
        [
            InlineKeyboardButton(text="Transactions 📜", callback_data="transactions"),
            InlineKeyboardButton(text="Balance 💰", callback_data="balance"),
        ],
        # Row 5: Join Group (URL) & Contact Us (URL or Callback)
        [
            InlineKeyboardButton(text="Join Group ↗️", url=GROUP_URL),
            (
                InlineKeyboardButton(text="Contact Us", url=CONTACT_URL)
                if CONTACT_URL.startswith("http")
                else InlineKeyboardButton(text="Contact Us", callback_data="contact_us")
            ),
        ],
        # Row 6: Refer & Earn
        [
            InlineKeyboardButton(text="Refer & Earn 🎁", callback_data="refer_earn"),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


# ==============================================================================
# COMMAND HANDLERS
# ==============================================================================
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles the /start command."""
    user = update.effective_user
    first_name = user.first_name if user else "Player"

    welcome_text = (
        f"👋 *Welcome, {first_name}, to Lucky Bingo!*\n\n"
        f"🎉 Play live multiplayer bingo games, win real prizes, and enjoy instant payouts.\n\n"
        f"Tap *Play Games 🎮* below to launch the game directly inside Telegram!"
    )

    await update.message.reply_text(
        text=welcome_text,
        reply_markup=get_main_keyboard(),
        parse_mode="Markdown",
    )


# ==============================================================================
# CALLBACK QUERY HANDLERS (Interactive button clicks)
# ==============================================================================
async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Responds to inline button clicks."""
    query = update.callback_query
    await query.answer()  # Acknowledge the callback to prevent spinner

    data = query.data
    user = update.effective_user

    responses = {
        "deposit": (
            "💳 *Deposit Funds*\n\n"
            "To add money to your account, choose your payment method in the Web App or follow deposit instructions."
        ),
        "withdraw": (
            "🏧 *Withdraw Winnings*\n\n"
            "Submit your withdrawal request. Payouts are processed swiftly to your verified account."
        ),
        "transfer": (
            "↔️ *Transfer Funds*\n\n"
            "Send balance directly to another player using their Telegram username or Account ID."
        ),
        "profile": (
            f"👤 *My Profile*\n\n"
            f"• *Name:* {user.full_name}\n"
            f"• *User ID:* `{user.id}`\n"
            f"• *Username:* @{user.username if user.username else 'Not set'}\n"
            f"• *Status:* Verified Player ✅"
        ),
        "transactions": (
            "📜 *Transaction History*\n\n"
            "View all your recent deposits, game stakes, wins, and withdrawals in the game dashboard."
        ),
        "balance": (
            "💰 *Your Balance*\n\n"
            "• *Main Balance:* 0.00 ETB\n"
            "• *Bonus Balance:* 0.00 ETB\n\n"
            "Launch the game to view live balance and stats!"
        ),
        "refer_earn": (
            "🎁 *Refer & Earn Program*\n\n"
            f"Share your referral link with friends and earn rewards every time they play!\n\n"
            f"🔗 *Your Referral Link:*\n"
            f"`https://t.me/{(await context.bot.get_me()).username}?start=ref_{user.id}`"
        ),
        "contact_us": (
            "📞 *Support & Contact*\n\n"
            "Need help? Contact our 24/7 customer support team for fast assistance."
        ),
    }

    message_text = responses.get(data, "Option selected.")

    # Send the response back to user
    await query.message.reply_text(
        text=message_text,
        parse_mode="Markdown",
    )


# ==============================================================================
# MAIN APPLICATION
# ==============================================================================
def main() -> None:
    """Starts the bot."""
    if BOT_TOKEN == "YOUR_BOT_TOKEN_HERE":
        logger.warning(
            "⚠️ BOT_TOKEN is not set! Please edit BOT_TOKEN in bot.py or set the BOT_TOKEN environment variable."
        )

    # Initialize the Application
    app = Application.builder().token(BOT_TOKEN).build()

    # Register handlers
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CallbackQueryHandler(button_callback))

    # Run the bot
    print("🤖 Lucky Bingo Bot is starting...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
