import os
import sys
import json
import logging
from typing import Dict, Any

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
def load_dotenv(filepath=".env"):
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "8830052755:AAEXkmyT2BaGh876mZvducpzRjJtATdlOWY")
WEB_APP_URL = os.getenv("WEB_APP_URL", "https://lucky-bingo-iota.vercel.app/")
GROUP_URL = os.getenv("GROUP_URL", "https://t.me/your_telegram_channel")
CONTACT_URL = os.getenv("CONTACT_URL", "https://t.me/your_support_username")
USER_STORE_FILE = "user_store.json"

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

# ==============================================================================
# SYSTEM DATA: PAYMENT METHODS (from Lucky Bingo Core)
# ==============================================================================
PAYMENT_METHODS: Dict[str, Dict[str, Any]] = {
    "Telebirr": {
        "name": "Telebirr",
        "account_name": "Lucky Bingo",
        "account_number": "0911 000 000",
        "min_amount": 50,
        "bonus": "ከ 100 ETB በላይ 20% ተጨማሪ ቦነስ",
    },
    "CBE Birr": {
        "name": "CBE Birr",
        "account_name": "Lucky Bingo CBE Birr",
        "account_number": "1000 000 000",
        "min_amount": 50,
        "bonus": "ከ 100 ETB በላይ 20% ተጨማሪ ቦነስ",
    },
    "M-Pesa": {
        "name": "M-Pesa",
        "account_name": "Lucky Bingo M-Pesa",
        "account_number": "0700 000 000",
        "min_amount": 50,
        "bonus": "ከ 100 ETB በላይ 20% ተጨማሪ ቦነስ",
    },
}

# ==============================================================================
# USER DATA STORAGE (Balance, Transactions, Profile)
# ==============================================================================
def load_all_users() -> Dict[str, Any]:
    if os.path.exists(USER_STORE_FILE):
        try:
            with open(USER_STORE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error("Error reading user store: %s", e)
    return {}

def save_all_users(data: Dict[str, Any]) -> None:
    try:
        with open(USER_STORE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error("Error writing user store: %s", e)

def get_user_profile(user_id: int, full_name: str = "", username: str = "") -> Dict[str, Any]:
    users = load_all_users()
    key = str(user_id)
    if key not in users:
        users[key] = {
            "id": user_id,
            "full_name": full_name or "Player",
            "username": username or "",
            "balance": 50.00,  # 50 ETB Lucky Bingo starting bonus
            "bonus": 0.00,
            "transactions": [
                {
                    "id": "TX-START-BONUS",
                    "type": "bonus",
                    "amount": 50.00,
                    "method": "System Bonus",
                    "status": "completed",
                    "date": "Welcome Bonus",
                }
            ],
        }
        save_all_users(users)
    else:
        # Update name/username if changed
        updated = False
        if full_name and users[key].get("full_name") != full_name:
            users[key]["full_name"] = full_name
            updated = True
        if username and users[key].get("username") != username:
            users[key]["username"] = username
            updated = True
        if updated:
            save_all_users(users)
    return users[key]

# ==============================================================================
# KEYBOARD BUILDERS
# ==============================================================================
def get_main_keyboard() -> InlineKeyboardMarkup:
    """Exact 6-row main inline keyboard."""
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
        # Row 5: Join Group & Contact Us
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

def get_deposit_methods_keyboard() -> InlineKeyboardMarkup:
    """Deposit payment methods pulled directly from the system."""
    keyboard = []
    for method_name in PAYMENT_METHODS:
        keyboard.append([
            InlineKeyboardButton(text=method_name, callback_data=f"dep_{method_name}")
        ])
    keyboard.append([
        InlineKeyboardButton(text="« ወደ ዋናው ማውጫ (Back)", callback_data="back_to_menu")
    ])
    return InlineKeyboardMarkup(keyboard)

def get_withdraw_methods_keyboard() -> InlineKeyboardMarkup:
    """Withdrawal payment methods pulled directly from the system."""
    keyboard = []
    for method_name in PAYMENT_METHODS:
        keyboard.append([
            InlineKeyboardButton(text=method_name, callback_data=f"wth_{method_name}")
        ])
    keyboard.append([
        InlineKeyboardButton(text="« ወደ ዋናው ማውጫ (Back)", callback_data="back_to_menu")
    ])
    return InlineKeyboardMarkup(keyboard)

# ==============================================================================
# COMMAND & FLOW HANDLERS
# ==============================================================================
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles /start command."""
    user = update.effective_user
    first_name = user.first_name if user else "Player"
    get_user_profile(user.id if user else 0, user.full_name if user else "", user.username or "")

    welcome_text = (
        f"👋 *Welcome, {first_name}, to Lucky Bingo!*\n\n"
        f"🎉 Play live multiplayer bingo games, win real prizes, and enjoy instant payouts.\n\n"
        f"Tap *Play Games 🎮* below to launch the game directly inside Telegram!"
    )

    if update.effective_message:
        await update.effective_message.reply_text(
            text=welcome_text,
            reply_markup=get_main_keyboard(),
            parse_mode="Markdown",
        )

async def deposit_flow(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Initial text and 3 options for deposit."""
    text = "💳 የማስገቢያ መንገድ ይምረጡ"
    reply_markup = get_deposit_methods_keyboard()
    if update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.message.reply_text(text=text, reply_markup=reply_markup)
    elif update.effective_message:
        await update.effective_message.reply_text(text=text, reply_markup=reply_markup)

async def withdraw_flow(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Initial text and 3 options for withdrawal."""
    text = "🏧 የመውጫ መንገድ ይምረጡ"
    reply_markup = get_withdraw_methods_keyboard()
    if update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.message.reply_text(text=text, reply_markup=reply_markup)
    elif update.effective_message:
        await update.effective_message.reply_text(text=text, reply_markup=reply_markup)

async def balance_flow(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Displays real-time balance pulled directly from the system."""
    user = update.effective_user
    profile = get_user_profile(user.id if user else 0, user.full_name if user else "", user.username or "")

    balance = profile.get("balance", 50.00)
    bonus = profile.get("bonus", 0.00)
    total = balance + bonus

    text = (
        f"💰 *የሂሳብ መረጃ (Account Balance)*\n\n"
        f"• *ዋና ሂሳብ (Main Balance):* `{balance:.2f} ETB`\n"
        f"• *ቦነስ ሂሳብ (Bonus Balance):* `{bonus:.2f} ETB`\n"
        f"• *አጠቃላይ (Total):* `{total:.2f} ETB`\n\n"
        f"• *የተጫዋች ID:* `{user.id if user else 'N/A'}`\n"
        f"• *የሂሳብ ሁኔታ:* ንቁ ተጫዋች (Active) ✅"
    )

    keyboard = [
        [
            InlineKeyboardButton(text="💳 አስገባ (Deposit)", callback_data="deposit"),
            InlineKeyboardButton(text="🏧 አውጣ (Withdraw)", callback_data="withdraw"),
        ],
        [
            InlineKeyboardButton(text="🎮 ጨዋታ ጀምር (Play Games)", web_app=WebAppInfo(url=WEB_APP_URL))
        ],
        [
            InlineKeyboardButton(text="« ወደ ዋናው ማውጫ (Back)", callback_data="back_to_menu")
        ],
    ]

    if update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.message.reply_text(text=text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")
    elif update.effective_message:
        await update.effective_message.reply_text(text=text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")

async def transactions_flow(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Displays transaction history pulled directly from the system."""
    user = update.effective_user
    profile = get_user_profile(user.id if user else 0, user.full_name if user else "", user.username or "")
    txs = profile.get("transactions", [])

    lines = []
    if txs:
        for t in txs[:5]:
            kind = "🟢" if t.get("type") in ("deposit", "bonus", "win") else "🔴"
            lines.append(f"{kind} *{t.get('method', 'TX')}*: `{t.get('amount', 0):.2f} ETB` ({t.get('status', 'completed')})")
    else:
        lines.append("ምንም የተመዘገበ ግብይት የለም (No recent transactions)")

    history_str = "\n".join(lines)
    text = (
        f"📜 *የቅርብ ጊዜ ግብይቶች (Transaction History)*\n\n"
        f"• *የተጫዋች ID:* `{user.id if user else 'N/A'}`\n"
        f"• *የተመዘገቡ ግብይቶች ብዛት:* {len(txs)}\n\n"
        f"{history_str}\n\n"
        f"ሁሉንም ዝርዝር መረጃዎች በቀጥታ በጨዋታው ውስጥ መመልከት ይችላሉ።"
    )

    keyboard = [
        [
            InlineKeyboardButton(text="🎮 በጨዋታው ውስጥ ይመልከቱ (View in Game)", web_app=WebAppInfo(url=WEB_APP_URL))
        ],
        [
            InlineKeyboardButton(text="« ወደ ዋናው ማውጫ (Back)", callback_data="back_to_menu")
        ],
    ]

    if update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.message.reply_text(text=text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")
    elif update.effective_message:
        await update.effective_message.reply_text(text=text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")

async def transfer_flow(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles transfer money flow."""
    text = (
        "↔️ *ገንዘብ ለጓደኛ ያስተላልፉ (Transfer Money)*\n\n"
        "ገንዘብን በቀጥታ ለሌላ ተጫዋች በ 0% የአገልግሎት ክፍያ ማስተላለፍ ይችላሉ።\n"
        "የተቀባዩን የተጠቃሚ ስም (Username) ወይም የተጫዋች ID በጨዋታው ውስጥ በማስገባት ወዲያውኑ ያስተላልፉ!"
    )
    keyboard = [
        [InlineKeyboardButton(text="🎮 በጨዋታው ውስጥ ያስተላልፉ", web_app=WebAppInfo(url=WEB_APP_URL))],
        [InlineKeyboardButton(text="« ወደ ዋናው ማውጫ (Back)", callback_data="back_to_menu")],
    ]
    if update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.message.reply_text(text=text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")
    elif update.effective_message:
        await update.effective_message.reply_text(text=text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")

async def register_flow(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles registration flow."""
    user = update.effective_user
    name = user.first_name if user else "Player"
    text = (
        f"📝 *Register New Account*\n\n"
        f"Welcome, {name}!\n"
        f"Your Telegram ID (`{user.id if user else ''}`) is automatically synced with your Lucky Bingo account.\n\n"
        f"Tap below to launch Lucky Bingo and claim your 50 ETB welcome bonus!"
    )
    keyboard = [
        [InlineKeyboardButton(text="🎮 Play Games (Start)", web_app=WebAppInfo(url=WEB_APP_URL))],
        [InlineKeyboardButton(text="« ወደ ዋናው ማውጫ (Back)", callback_data="back_to_menu")],
    ]
    if update.effective_message:
        await update.effective_message.reply_text(text=text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")

# ==============================================================================
# CALLBACK QUERY ROUTER
# ==============================================================================
async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles all button taps."""
    query = update.callback_query
    await query.answer()

    data = query.data
    user = update.effective_user

    # Main options
    if data == "deposit":
        await deposit_flow(update, context)
        return
    if data == "withdraw":
        await withdraw_flow(update, context)
        return
    if data == "balance":
        await balance_flow(update, context)
        return
    if data == "transactions":
        await transactions_flow(update, context)
        return
    if data == "transfer":
        await transfer_flow(update, context)
        return
    if data == "back_to_menu":
        await start_command(update, context)
        return

    # Specific deposit method tapped (dep_Telebirr, dep_CBE Birr, dep_M-Pesa)
    if data.startswith("dep_"):
        method_name = data.replace("dep_", "")
        method = PAYMENT_METHODS.get(method_name, PAYMENT_METHODS["Telebirr"])
        text = (
            f"💳 *{method['name']} የማስገቢያ መረጃ*\n\n"
            f"• *የሂሳብ ስም:* `{method['account_name']}`\n"
            f"• *የሂሳብ ቁጥር:* `{method['account_number']}` _(ለመገልበጥ ቁጥሩን ይንኩ)_\n"
            f"• *ዝቅተኛ መጠን:* `{method['min_amount']} ETB`\n"
            f"• *ቦነስ:* {method['bonus']} 🎁\n\n"
            f"ገንዘቡን ከላኩ በኋላ በጨዋታው ውስጥ የግብይት ቁጥርዎን (Tx Reference) በማስገባት በቀጥታ ማስገባት ይችላሉ።"
        )
        keyboard = [
            [InlineKeyboardButton(text="🎮 በጨዋታው ውስጥ አስገባ (Open Game)", web_app=WebAppInfo(url=f"{WEB_APP_URL}#deposit"))],
            [InlineKeyboardButton(text="« የማስገቢያ መንገዶች (Back)", callback_data="deposit")],
        ]
        await query.message.reply_text(text=text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")
        return

    # Specific withdraw method tapped (wth_Telebirr, wth_CBE Birr, wth_M-Pesa)
    if data.startswith("wth_"):
        method_name = data.replace("wth_", "")
        method = PAYMENT_METHODS.get(method_name, PAYMENT_METHODS["Telebirr"])
        text = (
            f"🏧 *{method['name']} ገንዘብ ማውጫ*\n\n"
            f"• *የተመረጠ መንገድ:* {method['name']}\n"
            f"• *ዝቅተኛ ማውጫ:* `{method['min_amount']} ETB`\n"
            f"• *የአገልግሎት ክፍያ:* `0% (ነፃ)`\n\n"
            f"ገንዘብ ለማውጣት የ{method['name']} ስልክ ቁጥርዎን እና ማውጣት የሚፈልጉትን መጠን በጨዋታው ውስጥ ያስገቡ።"
        )
        keyboard = [
            [InlineKeyboardButton(text="🎮 በጨዋታው ውስጥ አውጣ (Withdraw in Game)", web_app=WebAppInfo(url=f"{WEB_APP_URL}#deposit"))],
            [InlineKeyboardButton(text="« የመውጫ መንገዶች (Back)", callback_data="withdraw")],
        ]
        await query.message.reply_text(text=text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")
        return

    # Profile option
    if data == "profile":
        profile = get_user_profile(user.id if user else 0, user.full_name if user else "", user.username or "")
        text = (
            f"👤 *My Profile*\n\n"
            f"• *Name:* {profile.get('full_name')}\n"
            f"• *User ID:* `{user.id if user else 'N/A'}`\n"
            f"• *Username:* @{user.username if user and user.username else 'Not set'}\n"
            f"• *Main Balance:* `{profile.get('balance', 50.0):.2f} ETB`\n"
            f"• *Status:* Verified Player ✅"
        )
        keyboard = [
            [InlineKeyboardButton(text="🎮 Play Games 🎮", web_app=WebAppInfo(url=WEB_APP_URL))],
            [InlineKeyboardButton(text="« ወደ ዋናው ማውጫ (Back)", callback_data="back_to_menu")],
        ]
        await query.message.reply_text(text=text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")
        return

    # Refer & Earn
    if data == "refer_earn":
        bot_username = (await context.bot.get_me()).username
        text = (
            f"🎁 *የሪፈራል ፕሮግራም (Refer & Earn)*\n\n"
            f"ጓደኞችዎን ይጋብዙ እና በእያንዳንዱ በሚጫወቱት ጨዋታ የኮሚሽን ቦነስ ያግኙ!\n\n"
            f"🔗 *የእርስዎ የግብዣ ሊንክ (Referral Link):*\n"
            f"`https://t.me/{bot_username}?start=ref_{user.id if user else '0'}`"
        )
        keyboard = [
            [InlineKeyboardButton(text="« ወደ ዋናው ማውጫ (Back)", callback_data="back_to_menu")]
        ]
        await query.message.reply_text(text=text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")
        return

    # Contact Us
    if data == "contact_us":
        text = (
            "📞 *የደንበኞች አገልግሎት (Contact Us)*\n\n"
            "ማንኛውም ጥያቄ ወይም ድጋፍ ከፈለጉ የ 24/7 የደንበኞች አገልግሎታችንን ያነጋግሩ።"
        )
        keyboard = [
            [InlineKeyboardButton(text="« ወደ ዋናው ማውጫ (Back)", callback_data="back_to_menu")]
        ]
        await query.message.reply_text(text=text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")
        return

# ==============================================================================
# MENU SETUP (post_init)
# ==============================================================================
async def post_init(application: Application) -> None:
    """Sets the Telegram bot menu commands and menu button matching reference UI."""
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
# MAIN APPLICATION
# ==============================================================================
def main() -> None:
    """Starts the bot."""
    if BOT_TOKEN == "YOUR_BOT_TOKEN_HERE":
        logger.warning(
            "[WARNING] BOT_TOKEN is not set! Please edit BOT_TOKEN in bot.py or set the BOT_TOKEN environment variable."
        )

    # Initialize the Application with post_init
    app = Application.builder().token(BOT_TOKEN).post_init(post_init).build()

    # Command handlers matching the menu
    app.add_handler(CommandHandler(["start", "Start", "help", "menu"], start_command))
    app.add_handler(CommandHandler(["deposit", "Deposit"], deposit_flow))
    app.add_handler(CommandHandler(["withdraw", "Withdraw"], withdraw_flow))
    app.add_handler(CommandHandler(["balance", "Balance"], balance_flow))
    app.add_handler(CommandHandler(["transactions", "Transactions", "transaction", "Transaction"], transactions_flow))
    app.add_handler(CommandHandler(["register", "Register"], register_flow))
    app.add_handler(CommandHandler(["transfer", "Transfer"], transfer_flow))

    # Inline button callback router
    app.add_handler(CallbackQueryHandler(button_callback))

    print("[INFO] Lucky Bingo Bot is starting... Polling for updates.")
    app.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
