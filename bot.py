import os
import sys
import logging

# Ensure stdout and stderr handle UTF-8 without crashing on Windows cp1252 consoles
if sys.platform == "win32":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    WebAppInfo,
    BotCommand,
    MenuButtonCommands,
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
# Helper to read .env file if present
def load_dotenv(filepath=".env"):
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))

load_dotenv()

# Telegram Bot Token from @BotFather
BOT_TOKEN = os.getenv("BOT_TOKEN", "8830052755:AAEXkmyT2BaGh876mZvducpzRjJtATdlOWY")

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


async def deposit_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles the /deposit command."""
    text = (
        "💳 *Deposit Money*\n\n"
        "To deposit funds into your Lucky Bingo account, choose your payment method in the game portal."
    )
    kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("Deposit in Game 🎮", web_app=WebAppInfo(url=WEB_APP_URL))]
    ])
    if update.effective_message:
        await update.effective_message.reply_text(text=text, reply_markup=kb, parse_mode="Markdown")


async def withdraw_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles the /withdraw command."""
    text = (
        "🏧 *Withdraw Money*\n\n"
        "Submit your payout request directly in the Web App to receive your earnings swiftly."
    )
    kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("Withdraw in Game 🎮", web_app=WebAppInfo(url=WEB_APP_URL))]
    ])
    if update.effective_message:
        await update.effective_message.reply_text(text=text, reply_markup=kb, parse_mode="Markdown")


async def balance_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles the /balance command."""
    text = (
        "💰 *Check Balance*\n\n"
        "• *Main Balance:* 0.00 ETB\n"
        "• *Bonus Balance:* 0.00 ETB\n\n"
        "Launch the game to view live balance and stats!"
    )
    kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("Play Games 🎮", web_app=WebAppInfo(url=WEB_APP_URL))]
    ])
    if update.effective_message:
        await update.effective_message.reply_text(text=text, reply_markup=kb, parse_mode="Markdown")


async def register_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles the /register command."""
    user = update.effective_user
    name = user.first_name if user else "Player"
    text = (
        f"📝 *Register New Account*\n\n"
        f"Welcome, {name}!\n"
        f"Your Telegram ID (`{user.id}`) is already connected as your player account.\n\n"
        f"Tap below to launch Lucky Bingo and claim your starting bonus!"
    )
    kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("Play Games 🎮", web_app=WebAppInfo(url=WEB_APP_URL))]
    ])
    if update.effective_message:
        await update.effective_message.reply_text(text=text, reply_markup=kb, parse_mode="Markdown")


async def transfer_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles the /transfer command."""
    text = (
        "↔️ *Send Money to Friend*\n\n"
        "Transfer balance instantly to another player with 0% fee.\n"
        "Open the game dashboard to initiate a player-to-player transfer."
    )
    kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("Transfer in Game 🎮", web_app=WebAppInfo(url=WEB_APP_URL))]
    ])
    if update.effective_message:
        await update.effective_message.reply_text(text=text, reply_markup=kb, parse_mode="Markdown")


async def post_init(application: Application) -> None:
    """Sets the Telegram bot menu commands and menu button matching reference image."""
    commands = [
        BotCommand("start", "Start the bot"),
        BotCommand("deposit", "Deposit money"),
        BotCommand("withdraw", "Withdraw money"),
        BotCommand("balance", "Check Balance"),
        BotCommand("register", "Register new account"),
        BotCommand("transfer", "Send money to friend"),
    ]
    await application.bot.set_my_commands(commands)
    await application.bot.set_chat_menu_button(menu_button=MenuButtonCommands())
    logger.info("Bot commands menu registered successfully.")


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
            "[WARNING] BOT_TOKEN is not set! Please edit BOT_TOKEN in bot.py or set the BOT_TOKEN environment variable."
        )

    # Initialize the Application with post_init to register Telegram Menu Button and commands
    app = Application.builder().token(BOT_TOKEN).post_init(post_init).build()

    # Register command handlers matching menu items
    app.add_handler(CommandHandler(["start", "Start", "help", "menu"], start_command))
    app.add_handler(CommandHandler(["deposit", "Deposit"], deposit_command))
    app.add_handler(CommandHandler(["withdraw", "Withdraw"], withdraw_command))
    app.add_handler(CommandHandler(["balance", "Balance"], balance_command))
    app.add_handler(CommandHandler(["register", "Register"], register_command))
    app.add_handler(CommandHandler(["transfer", "Transfer"], transfer_command))
    app.add_handler(CallbackQueryHandler(button_callback))

    # Run the bot
    print("[INFO] Lucky Bingo Bot is starting... Polling for updates.")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
