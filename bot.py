import os
import sys
import json
import sqlite3
import logging
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
from datetime import datetime
from typing import Dict, Any, Optional, List

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
    KeyboardButton,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
    WebAppInfo,
    BotCommand,
    MenuButtonCommands,
)
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    filters,
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

# Authorized Administrators (comma-separated in .env or set here)
ADMIN_USERNAMES = [u.strip().lstrip("@").lower() for u in os.getenv("ADMIN_USERNAMES", "").split(",") if u.strip()]
ADMIN_PHONES = [p.strip() for p in os.getenv("ADMIN_PHONES", "").split(",") if p.strip()]
ADMIN_TELEGRAM_IDS = [int(i.strip()) for i in os.getenv("ADMIN_TELEGRAM_IDS", "").split(",") if i.strip().isdigit()]

DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DB_PATH = os.path.join(DB_DIR, "lucky_bingo.db")
PLAYERS_DATA_JS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "players-data.js")
PLAYERS_JSON = os.path.join(DB_DIR, "players.json")

# Secondary mirror path if present
MIRROR_DIR = r"C:\Users\HP\Desktop\telegram bot bingo"
MIRROR_PLAYERS_DATA_JS = os.path.join(MIRROR_DIR, "players-data.js")

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

# ==============================================================================
# DATABASE MANAGEMENT (SQLite)
# ==============================================================================
def normalize_phone(phone: str) -> str:
    """Normalize phone number to international Ethiopian format (+251...)."""
    if not phone:
        return ""
    cleaned = "".join(c for c in phone if c.isdigit() or c == "+")
    if cleaned.startswith("+251"):
        return cleaned
    if cleaned.startswith("251"):
        return "+" + cleaned
    if cleaned.startswith("09") and len(cleaned) == 10:
        return "+251" + cleaned[1:]
    if cleaned.startswith("07") and len(cleaned) == 10:
        return "+251" + cleaned[1:]
    if len(cleaned) == 9 and (cleaned.startswith("9") or cleaned.startswith("7")):
        return "+251" + cleaned
    if not cleaned.startswith("+"):
        return "+" + cleaned
    return cleaned

def is_admin_check(user_id: int, username: str = "", phone: str = "") -> bool:
    """Check if the given user is an authorized administrator."""
    if user_id in ADMIN_TELEGRAM_IDS:
        return True
    clean_user = (username or "").lstrip("@").strip().lower()
    if clean_user and clean_user in [u.lower() for u in ADMIN_USERNAMES]:
        return True
    if phone:
        norm = normalize_phone(phone)
        for ap in ADMIN_PHONES:
            if norm == normalize_phone(ap):
                return True
    # Also check if marked as admin in DB
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
            if row and row["role"] == "admin":
                return True
    except Exception:
        pass
    return False

def init_db() -> None:
    os.makedirs(DB_DIR, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT,
                first_name TEXT,
                last_name TEXT,
                phone_number TEXT UNIQUE,
                role TEXT DEFAULT 'player',
                balance REAL DEFAULT 0.0,
                bonus_balance REAL DEFAULT 0.0,
                bonus_claimed INTEGER DEFAULT 0,
                is_verified INTEGER DEFAULT 0,
                status TEXT DEFAULT 'active',
                registered_at TEXT,
                last_active TEXT
            )
        """)
        # Backward-compatible column check
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'player'")
        except sqlite3.OperationalError:
            pass

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                user_id INTEGER,
                type TEXT,
                method TEXT,
                amount REAL,
                phone_number TEXT,
                status TEXT DEFAULT 'completed',
                created_at TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        """)
        conn.commit()
    logger.info("SQLite database initialized at: %s", DB_PATH)

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def get_or_create_user(user_id: int, username: str = "", first_name: str = "", last_name: str = "") -> Dict[str, Any]:
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    is_admin = is_admin_check(user_id, username)
    user_role = "admin" if is_admin else "player"

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            cursor.execute("""
                INSERT INTO users (id, username, first_name, last_name, role, balance, bonus_balance, bonus_claimed, is_verified, status, registered_at, last_active)
                VALUES (?, ?, ?, ?, ?, 0.0, 0.0, 0, 0, 'active', ?, ?)
            """, (user_id, username or "", first_name or "", last_name or "", user_role, now, now))
            conn.commit()
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
        else:
            # Keep admin role if recognized
            current_role = "admin" if (is_admin or row["role"] == "admin") else row["role"]
            cursor.execute("""
                UPDATE users SET username = ?, first_name = ?, last_name = ?, role = ?, last_active = ?
                WHERE id = ?
            """, (username or row["username"], first_name or row["first_name"], last_name or row["last_name"], current_role, now, user_id))
            conn.commit()
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
        return dict(row)

def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def get_user_transactions(user_id: int) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10", (user_id,))
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

def export_admin_players() -> None:
    """Exports regular players to players-data.js so Admin Panel displays them for the super administrator."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # Verified regular players
            cursor.execute("SELECT * FROM users WHERE is_verified = 1 AND role = 'player' ORDER BY registered_at DESC")
            rows = cursor.fetchall()

            # Find designated admin record if present
            cursor.execute("SELECT * FROM users WHERE role = 'admin' LIMIT 1")
            admin_row = cursor.fetchone()

        players_list = []
        for r in rows:
            uid = r["id"]
            uname = r["username"]
            fname = r["first_name"] or ""
            lname = r["last_name"] or ""
            full_name = f"{fname} {lname}".strip() or (f"@{uname}" if uname else f"Player {uid}")
            display_user = f"@{uname}" if uname else f"ID: {uid}"
            phone = r["phone_number"] or "N/A"
            bal = float(r["balance"] or 0.0)

            players_list.append({
                "id": f"TG-{uid}",
                "name": full_name,
                "username": display_user,
                "email": f"{uname or uid}@t.me",
                "phone": phone,
                "balance": bal,
                "games": 0,
                "lastActive": "Just now",
                "status": "active" if r["status"] == "active" else r["status"],
                "avatar": "blue",
                "note": f"Telegram Verified Player (TG ID: {uid})",
            })

        admin_data = {
            "name": (f"{admin_row['first_name'] or ''} {admin_row['last_name'] or ''}".strip() or "Super Administrator") if admin_row else "Super Administrator",
            "username": f"@{admin_row['username']}" if (admin_row and admin_row["username"]) else (f"@{ADMIN_USERNAMES[0]}" if ADMIN_USERNAMES else "@Admin"),
            "phone": (admin_row["phone_number"] if admin_row and admin_row["phone_number"] else (ADMIN_PHONES[0] if ADMIN_PHONES else "N/A")),
            "role": "Super administrator"
        }
        # Check if custom settings exist in data/payment_settings.json
        custom_pm_file = os.path.join(DB_DIR, "payment_settings.json")
        payment_methods_data = PAYMENT_METHODS
        if os.path.exists(custom_pm_file):
            try:
                with open(custom_pm_file, "r", encoding="utf-8") as pf:
                    custom_pm = json.load(pf)
                    payment_methods_data = {k: dict(v) for k, v in PAYMENT_METHODS.items()}
                    for k, v in custom_pm.items():
                        if k in payment_methods_data and isinstance(v, dict):
                            payment_methods_data[k].update(v)
            except Exception:
                pass

        # Format JS content with players list, admin profile, and deposit accounts
        js_content = (
            "/* Generated by Lucky Bingo Bot. Live verified player records for Admin Panel. */\n"
            '"use strict";\n'
            f"window.LUCKY_BINGO_ADMIN = {json.dumps(admin_data, ensure_ascii=False, indent=2)};\n"
            f"window.LUCKY_BINGO_PAYMENT_METHODS = {json.dumps(payment_methods_data, ensure_ascii=False, indent=2)};\n"
            f"window.LUCKY_BINGO_PLAYERS = {json.dumps(players_list, ensure_ascii=False, indent=2)};\n"
        )

        with open(PLAYERS_DATA_JS, "w", encoding="utf-8") as f:
            f.write(js_content)

        with open(PLAYERS_JSON, "w", encoding="utf-8") as f:
            json.dump({"admin": admin_data, "payment_methods": payment_methods_data, "players": players_list}, f, ensure_ascii=False, indent=2)

        # Mirror copy if directory exists
        if os.path.exists(MIRROR_DIR):
            try:
                with open(MIRROR_PLAYERS_DATA_JS, "w", encoding="utf-8") as f:
                    f.write(js_content)
            except Exception:
                pass

        logger.info("Admin players exported: %d verified players.", len(players_list))
    except Exception as e:
        logger.error("Error exporting admin players: %s", e)

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

def get_payment_methods() -> Dict[str, Dict[str, Any]]:
    """Retrieves payment methods, merging custom receiving numbers if configured."""
    custom_pm_file = os.path.join(DB_DIR, "payment_settings.json")
    if os.path.exists(custom_pm_file):
        try:
            with open(custom_pm_file, "r", encoding="utf-8") as pf:
                custom_pm = json.load(pf)
                merged = {k: dict(v) for k, v in PAYMENT_METHODS.items()}
                for k, v in custom_pm.items():
                    if k in merged and isinstance(v, dict):
                        merged[k].update(v)
                return merged
        except Exception:
            pass
    return PAYMENT_METHODS

# ==============================================================================
# KEYBOARD BUILDERS
# ==============================================================================
def get_main_keyboard(is_admin_user: bool = False, user_id: int = 0) -> InlineKeyboardMarkup:
    """Exact 6-row main inline keyboard, plus Admin Controls row if authorized."""
    if is_admin_user:
        separator = "&" if "?" in WEB_APP_URL else "?"
        web_app_url = f"{WEB_APP_URL}{separator}role=admin&admin=1&u={user_id}"
    else:
        web_app_url = WEB_APP_URL

    keyboard = [
        # Row 1: Full-width Web App button
        [
            InlineKeyboardButton(
                text="Play Games 🎮",
                web_app=WebAppInfo(url=web_app_url),
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

    # Row 7: Only shown to authorized administrator
    if is_admin_user:
        keyboard.append([
            InlineKeyboardButton(text="🛡️ Admin Controls (የአስተዳዳሪ ክፍል)", callback_data="admin_dashboard")
        ])

    return InlineKeyboardMarkup(keyboard)

def get_contact_request_keyboard() -> ReplyKeyboardMarkup:
    """One-tap contact share reply keyboard."""
    button = KeyboardButton(text="📱 ስልክ ቁጥርዎን ያጋሩ (Share Phone Number) 🎁", request_contact=True)
    return ReplyKeyboardMarkup([[button]], resize_keyboard=True, one_time_keyboard=True)

def get_deposit_methods_keyboard() -> InlineKeyboardMarkup:
    """Deposit payment methods pulled directly from the system."""
    keyboard = []
    methods = get_payment_methods()
    for method_name in methods:
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
    methods = get_payment_methods()
    for method_name in methods:
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
    """Handles /start command with verification check and bonus claim prompt."""
    user = update.effective_user
    if not user:
        return

    profile = get_or_create_user(
        user_id=user.id,
        username=user.username or "",
        first_name=user.first_name or "",
        last_name=user.last_name or "",
    )

    is_admin = is_admin_check(user.id, user.username or "", profile.get("phone_number", ""))
    first_name = user.first_name or "Player"

    # If the user has not verified their phone number and is not admin, prompt them to share contact
    if not profile.get("is_verified") and not is_admin:
        prompt_text = (
            f"👋 ሰላም *{first_name}*! ወደ *Lucky Bingo* እንኳን በደህና መጡ! 🎲\n\n"
            f"🎁 *የ 50 ETB የመመዝገቢያ ቦነስ* ለመቀበል እና መለያዎን ለማረጋገጥ ከታች ያለውን "
            f"**'📱 ስልክ ቁጥርዎን ያጋሩ'** የሚለውን ቁልፍ ይጫኑ።\n\n"
            f"🔒 _ስልክ ቁጥርዎ ለተቀማጭ እና ገንዘብ ማውጫ ደህንነት ብቻ ያገለግላል።_"
        )
        if update.effective_message:
            await update.effective_message.reply_text(
                text=prompt_text,
                reply_markup=get_contact_request_keyboard(),
                parse_mode="Markdown",
            )
        return

    # If already verified or admin, show main menu
    phone = profile.get("phone_number", "N/A")
    bal = profile.get("balance", 0.0)
    role_badge = " [🛡️ Super Admin]" if is_admin else ""

    welcome_text = (
        f"👋 ሰላም *{first_name}*{role_badge}! ወደ *Lucky Bingo* እንኳን በደህና መጡ! 🎲\n\n"
        f"📱 *የተረጋገጠ ስልክ:* `{phone}`\n"
        f"💰 *የሂሳብ መጠን:* `{bal:.2f} ETB`\n\n"
        f"ለመጫወት ከታች *Play Games 🎮* የሚለውን ይጫኑ!"
    )

    if update.effective_message:
        await update.effective_message.reply_text(
            text=welcome_text,
            reply_markup=get_main_keyboard(is_admin_user=is_admin, user_id=user.id),
            parse_mode="Markdown",
        )

# ==============================================================================
# CONTACT SHARING & ANTI-FRAUD BONUS HANDLER
# ==============================================================================
async def contact_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles phone contact sharing. Regular users become 'player' role (NOT admin)."""
    user = update.effective_user
    message = update.effective_message
    if not user or not message or not message.contact:
        return

    contact = message.contact

    # 1. Anti-Spoofing: Ensure shared contact belongs to the current Telegram user
    if contact.user_id != user.id:
        await message.reply_text(
            text="⚠️ *ስህተት:* እባክዎ የራስዎን ስልክ ቁጥር ብቻ ያጋሩ! የሌላ ሰውን ኮንታክት ማጋራት አይፈቀድም።",
            reply_markup=get_contact_request_keyboard(),
            parse_mode="Markdown",
        )
        return

    raw_phone = contact.phone_number
    phone = normalize_phone(raw_phone)
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    # Check admin privilege: only designated admin gets 'admin' role
    is_admin = is_admin_check(user.id, user.username or "", phone)
    assigned_role = "admin" if is_admin else "player"

    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM users WHERE phone_number = ?", (phone,))
        existing_phone_user = cursor.fetchone()

        cursor.execute("SELECT * FROM users WHERE id = ?", (user.id,))
        current_user = cursor.fetchone()

        phone_already_used = existing_phone_user is not None and existing_phone_user["id"] != user.id
        already_claimed = (
            (existing_phone_user and existing_phone_user["bonus_claimed"] == 1) or
            (current_user and current_user["bonus_claimed"] == 1)
        )

        if already_claimed or phone_already_used:
            # Phone has already been registered / bonus already consumed
            cursor.execute("""
                UPDATE users
                SET phone_number = ?, role = ?, is_verified = 1, last_active = ?
                WHERE id = ?
            """, (phone, assigned_role, now, user.id))
            conn.commit()

            msg_text = (
                f"⚠️ *ማስታወቂያ:*\n\n"
                f"ይህ ስልክ ቁጥር (`{phone}`) ቀደም ሲል የ 50 ETB የመመዝገቢያ ቦነስ ተጠቅሟል!\n"
                f"ተጨማሪ ቦነስ ማግኘት አይቻልም።\n\n"
                f"መለያዎ በስልክ ቁጥር `{phone}` ተረጋግጧል ✅"
            )
        else:
            # Brand new registration: grant 50 ETB bonus!
            new_balance = 50.00
            cursor.execute("""
                UPDATE users
                SET phone_number = ?, role = ?, balance = balance + ?, bonus_claimed = 1, is_verified = 1, last_active = ?
                WHERE id = ?
            """, (phone, assigned_role, new_balance, now, user.id))

            tx_id = f"TX-BN-{user.id}"
            cursor.execute("""
                INSERT OR REPLACE INTO transactions (id, user_id, type, method, amount, phone_number, status, created_at)
                VALUES (?, ?, 'bonus', 'Welcome Bonus', ?, ?, 'completed', ?)
            """, (tx_id, user.id, new_balance, phone, now))
            conn.commit()

            msg_text = (
                f"🎉 *እንኳን ደስ አለዎት! መለያዎ ተረጋግጧል!*\n\n"
                f"📱 *የተረጋገጠ ስልክ:* `{phone}`\n"
                f"🎁 *የእንኳን ደህና መጡ ቦነስ:* `50.00 ETB` ወደ ሂሳብዎ ተጨምሯል!\n\n"
                f"አሁን በቀጥታ ጨዋታውን መጫወት ይችላሉ።"
            )

    # Export to admin players data immediately
    export_admin_players()

    # Clear reply keyboard
    await message.reply_text(
        text="መለያዎ ዝግጁ ነው! ዋናው ማውጫ ተከፍቷል:",
        reply_markup=ReplyKeyboardRemove(),
    )

    # Send full inline keyboard menu (with Admin Controls if authorized admin)
    await message.reply_text(
        text=msg_text,
        reply_markup=get_main_keyboard(is_admin_user=is_admin, user_id=user.id),
        parse_mode="Markdown",
    )

# ==============================================================================
# ADMIN CONSOLE & CONTROLS (Only for designated admin)
# ==============================================================================
async def admin_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles /admin command. Strictly protected for authorized administrators."""
    user = update.effective_user
    if not user:
        return

    profile = get_or_create_user(user.id, user.username or "", user.first_name or "", user.last_name or "")
    if not is_admin_check(user.id, user.username or "", profile.get("phone_number", "")):
        if update.effective_message:
            await update.effective_message.reply_text(
                "⛔ *ይቅርታ! ይህንን ማውጫ ለመጠቀም የአስተዳዳሪ (Admin) ፈቃድ የለዎትም።*",
                parse_mode="Markdown",
            )
        return

    # Gather system statistics
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) AS total FROM users WHERE role = 'player'")
        total_players = cursor.fetchone()["total"]

        cursor.execute("SELECT COUNT(*) AS verified FROM users WHERE role = 'player' AND is_verified = 1")
        verified_players = cursor.fetchone()["verified"]

        cursor.execute("SELECT SUM(balance) AS total_bal FROM users WHERE role = 'player'")
        bal_row = cursor.fetchone()
        total_balance = float(bal_row["total_bal"] or 0.0)

        cursor.execute("SELECT COUNT(*) AS pending FROM transactions WHERE status = 'pending'")
        pending_tx = cursor.fetchone()["pending"]

    admin_text = (
        f"🛡️ *Lucky Bingo — Admin Control Center*\n\n"
        f"👤 *Super Admin:* @{user.username if user.username else user.id}\n\n"
        f"📊 *የስርዓት ሁኔታ (System Statistics):*\n"
        f"• *ተጫዋቾች (Total Players):* `{total_players}`\n"
        f"• *የተረጋገጡ (Verified Players):* `{verified_players}`\n"
        f"• *አጠቃላይ የተጫዋች ሂሳብ:* `{total_balance:.2f} ETB`\n"
        f"• *በመጠባበቅ ላይ ያሉ ጥያቄዎች:* `{pending_tx}`\n\n"
        f"ከታች ካሉት አማራጮች አንዱን ይምረጡ:"
    )

    keyboard = [
        [
            InlineKeyboardButton(text="👥 የተጫዋቾች ዝርዝር (Players)", callback_data="admin_players"),
            InlineKeyboardButton(text=f"💳 የግብይት ጥያቄዎች ({pending_tx})", callback_data="admin_pending_tx"),
        ],
        [
            InlineKeyboardButton(text="🌐 Admin Panel (Web Console)", web_app=WebAppInfo(url=f"{WEB_APP_URL}admin.html")),
        ],
        [
            InlineKeyboardButton(text="« ወደ ዋናው ማውጫ (Back)", callback_data="back_to_menu"),
        ],
    ]

    if update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.message.reply_text(
            text=admin_text,
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="Markdown",
        )
    elif update.effective_message:
        await update.effective_message.reply_text(
            text=admin_text,
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="Markdown",
        )

# ==============================================================================
# DEPOSIT & WITHDRAW FLOWS (Bound to Phone Number)
# ==============================================================================
async def deposit_flow(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Deposit prompt bound to verified phone number."""
    user = update.effective_user
    if not user:
        return
    profile = get_or_create_user(user.id, user.username or "", user.first_name or "", user.last_name or "")

    # Verification gate
    if not profile.get("is_verified") and not is_admin_check(user.id, user.username or ""):
        text = (
            "⚠️ *ገንዘብ ለማስገባት መጀመሪያ ስልክ ቁጥርዎን ማረጋገጥ አለብዎት።*\n\n"
            "እባክዎ ከታች ያለውን **'📱 ስልክ ቁጥርዎን ያጋሩ'** የሚለውን ቁልፍ በመጫን ያረጋግጡ።"
        )
        if update.callback_query:
            await update.callback_query.answer()
            await update.callback_query.message.reply_text(text=text, reply_markup=get_contact_request_keyboard(), parse_mode="Markdown")
        elif update.effective_message:
            await update.effective_message.reply_text(text=text, reply_markup=get_contact_request_keyboard(), parse_mode="Markdown")
        return

    text = "💳 የማስገቢያ መንገድ ይምረጡ"
    reply_markup = get_deposit_methods_keyboard()
    if update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.message.reply_text(text=text, reply_markup=reply_markup)
    elif update.effective_message:
        await update.effective_message.reply_text(text=text, reply_markup=reply_markup)

async def withdraw_flow(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Withdrawal prompt bound to verified phone number."""
    user = update.effective_user
    if not user:
        return
    profile = get_or_create_user(user.id, user.username or "", user.first_name or "", user.last_name or "")

    # Verification gate
    if not profile.get("is_verified") and not is_admin_check(user.id, user.username or ""):
        text = (
            "⚠️ *ገንዘብ ለማውጣት መጀመሪያ ስልክ ቁጥርዎን ማረጋገጥ አለብዎት።*\n\n"
            "እባክዎ ከታች ያለውን **'📱 ስልክ ቁጥርዎን ያጋሩ'** የሚለውን ቁልፍ በመጫን ያረጋግጡ።"
        )
        if update.callback_query:
            await update.callback_query.answer()
            await update.callback_query.message.reply_text(text=text, reply_markup=get_contact_request_keyboard(), parse_mode="Markdown")
        elif update.effective_message:
            await update.effective_message.reply_text(text=text, reply_markup=get_contact_request_keyboard(), parse_mode="Markdown")
        return

    text = "🏧 የመውጫ መንገድ ይምረጡ"
    reply_markup = get_withdraw_methods_keyboard()
    if update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.message.reply_text(text=text, reply_markup=reply_markup)
    elif update.effective_message:
        await update.effective_message.reply_text(text=text, reply_markup=reply_markup)

async def balance_flow(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Displays real-time balance pulled directly from SQLite DB."""
    user = update.effective_user
    if not user:
        return
    profile = get_or_create_user(user.id, user.username or "", user.first_name or "", user.last_name or "")

    balance = float(profile.get("balance", 0.0))
    bonus = float(profile.get("bonus_balance", 0.0))
    total = balance + bonus
    phone = profile.get("phone_number") or "ያልተረጋገጠ ⚠️"
    status_label = "የተረጋገጠ ✅" if profile.get("is_verified") else "ያልተረጋገጠ ⚠️"

    text = (
        f"💰 *የሂሳብ መረጃ (Account Balance)*\n\n"
        f"• *ዋና ሂሳብ (Main Balance):* `{balance:.2f} ETB`\n"
        f"• *ቦነስ ሂሳብ (Bonus Balance):* `{bonus:.2f} ETB`\n"
        f"• *አጠቃላይ (Total):* `{total:.2f} ETB`\n\n"
        f"• *የተረጋገጠ ስልክ:* `{phone}`\n"
        f"• *የተጫዋች ID:* `{user.id}`\n"
        f"• *የሂሳብ ሁኔታ:* {status_label}"
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
    """Displays transaction history pulled directly from SQLite DB."""
    user = update.effective_user
    if not user:
        return
    get_or_create_user(user.id, user.username or "", user.first_name or "", user.last_name or "")
    txs = get_user_transactions(user.id)

    lines = []
    if txs:
        for t in txs:
            kind = "🟢" if t.get("type") in ("deposit", "bonus", "win") else "🔴"
            amount = float(t.get("amount", 0.0))
            method = t.get("method", "TX")
            status = t.get("status", "completed")
            lines.append(f"{kind} *{method}*: `{amount:.2f} ETB` ({status})")
    else:
        lines.append("ምንም የተመዘገበ ግብይት የለም (No transactions found)")

    history_str = "\n".join(lines)
    text = (
        f"📜 *የቅርብ ጊዜ ግብይቶች (Transaction History)*\n\n"
        f"• *የተጫዋች ID:* `{user.id}`\n"
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
    if not user:
        return
    profile = get_or_create_user(user.id, user.username or "", user.first_name or "", user.last_name or "")
    if not profile.get("is_verified"):
        await start_command(update, context)
        return

    name = user.first_name or "Player"
    text = (
        f"📝 *የተጠቃሚ መለያ (Account Profile)*\n\n"
        f"ሰላም, {name}!\n"
        f"የቴሌግራም መለያዎ (`{user.id}`) በስልክ ቁጥር `{profile.get('phone_number')}` ተረጋግጧል።\n\n"
        f"ጨዋታዎችን ለመጫወት ከታች ያለውን ቁልፍ ይጫኑ!"
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
    """Handles all inline button clicks."""
    query = update.callback_query
    if not query:
        return
    await query.answer()

    data = query.data
    user = update.effective_user
    if not user:
        return

    # Admin Control callbacks
    if data == "admin_dashboard":
        await admin_command(update, context)
        return

    if data == "admin_players":
        if not is_admin_check(user.id, user.username or ""):
            await query.message.reply_text("⛔ Access Denied.")
            return
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE role = 'player' ORDER BY registered_at DESC LIMIT 8")
            players = cursor.fetchall()
        
        lines = []
        for p in players:
            uname = f"@{p['username']}" if p["username"] else f"ID:{p['id']}"
            phone = p["phone_number"] or "No phone"
            bal = float(p["balance"] or 0.0)
            lines.append(f"• *{uname}* | `{phone}` | `{bal:.2f} ETB`")
        
        plist_str = "\n".join(lines) if lines else "ምንም የተመዘገቡ ተጫዋቾች የሉም።"
        text = f"👥 *የተጫዋቾች ዝርዝር (Registered Players):*\n\n{plist_str}"
        keyboard = [
            [InlineKeyboardButton(text="« ወደ Admin Controls", callback_data="admin_dashboard")]
        ]
        await query.message.reply_text(text=text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")
        return

    if data == "admin_pending_tx":
        if not is_admin_check(user.id, user.username or ""):
            await query.message.reply_text("⛔ Access Denied.")
            return
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM transactions WHERE status = 'pending' ORDER BY created_at DESC LIMIT 8")
            txs = cursor.fetchall()
        
        if not txs:
            text = "✅ *በመጠባበቅ ላይ ያለ ምንም የግብይት ጥያቄ የለም።* (No pending transactions)"
            keyboard = [[InlineKeyboardButton(text="« ወደ Admin Controls", callback_data="admin_dashboard")]]
            await query.message.reply_text(text=text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")
            return

        text = "💳 *በመጠባበቅ ላይ ያሉ ግብይቶች (Pending Transactions):*\n\nየተጫዋቾችን ጥያቄ ለማጽደቅ ወይም ለመሰረዝ ከታች ያሉትን ቁልፎች ይጫኑ:"
        keyboard = []
        for t in txs:
            tx_id = t["id"]
            t_type = "ተቀማጭ (Deposit)" if t["type"] == "deposit" else "ማውጫ (Withdraw)"
            amt = float(t["amount"] or 0.0)
            u_id = t["user_id"]
            keyboard.append([
                InlineKeyboardButton(text=f"📋 {t_type} {amt:.0f} ETB (User {u_id})", callback_data="admin_pending_tx")
            ])
            keyboard.append([
                InlineKeyboardButton(text="✓ አጽድቅ (Approve)", callback_data=f"tx_app_{tx_id}"),
                InlineKeyboardButton(text="× ሰርዝ (Reject)", callback_data=f"tx_rej_{tx_id}"),
            ])

        keyboard.append([InlineKeyboardButton(text="« ወደ Admin Controls", callback_data="admin_dashboard")])
        await query.message.reply_text(text=text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")
        return

    if data.startswith("tx_app_"):
        if not is_admin_check(user.id, user.username or ""):
            await query.message.reply_text("⛔ Access Denied.")
            return
        tx_id = data.replace("tx_app_", "")
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM transactions WHERE id = ?", (tx_id,))
            tx = cursor.fetchone()
            if not tx or tx["status"] != "pending":
                await query.message.reply_text("⚠️ ይህ ግብይት ቀደም ሲል ተስተናግዷል።")
                return

            amount = float(tx["amount"] or 0.0)
            target_user_id = tx["user_id"]
            tx_type = tx["type"]

            if tx_type == "deposit":
                cursor.execute("UPDATE users SET balance = balance + ? WHERE id = ?", (amount, target_user_id))
            elif tx_type == "withdraw":
                cursor.execute("UPDATE users SET balance = MAX(0, balance - ?) WHERE id = ?", (amount, target_user_id))

            cursor.execute("UPDATE transactions SET status = 'approved' WHERE id = ?", (tx_id,))
            conn.commit()

        export_admin_players()

        # Notify target user
        try:
            if tx_type == "deposit":
                await context.bot.send_message(
                    chat_id=target_user_id,
                    text=f"🎉 *የተቀማጭ ጥያቄዎ ጸድቋል!*\n\n`{amount:.2f} ETB` ወደ ሂሳብዎ ተጨምሯል ✅\nአሁን በቀጥታ ጨዋታዎችን መጫወት ይችላሉ!",
                    parse_mode="Markdown",
                )
            else:
                await context.bot.send_message(
                    chat_id=target_user_id,
                    text=f"🏧 *የገንዘብ ማውጣት ጥያቄዎ ጸድቋል!*\n\nየ `{amount:.2f} ETB` ክፍያዎ በተመረጠው መንገድ ተልኳል ✅",
                    parse_mode="Markdown",
                )
        except Exception:
            pass

        action_word = "ተጨምሯል" if tx_type == "deposit" else "ተቀንሷል"
        await query.message.reply_text(
            f"✅ ግብይት `{tx_id}` ጸድቋል!\n`{amount:.2f} ETB` ወደ ተጠቃሚ `{target_user_id}` ሂሳብ {action_word}።",
            parse_mode="Markdown",
        )
        return

    if data.startswith("tx_rej_"):
        if not is_admin_check(user.id, user.username or ""):
            await query.message.reply_text("⛔ Access Denied.")
            return
        tx_id = data.replace("tx_rej_", "")
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM transactions WHERE id = ?", (tx_id,))
            tx = cursor.fetchone()
            if not tx or tx["status"] != "pending":
                await query.message.reply_text("⚠️ ይህ ግብይት ቀደም ሲል ተስተናግዷል።")
                return

            cursor.execute("UPDATE transactions SET status = 'rejected' WHERE id = ?", (tx_id,))
            conn.commit()

        export_admin_players()

        try:
            await context.bot.send_message(
                chat_id=tx["user_id"],
                text=f"⚠️ የ `{float(tx['amount']):.2f} ETB` {tx['type']} ጥያቄዎ ውድቅ ተደርጓል። እባክዎ መረጃዎን አስተካክለው እንደገና ይሞክሩ።",
                parse_mode="Markdown",
            )
        except Exception:
            pass

        await query.message.reply_text(f"× ግብይት `{tx_id}` ውድቅ ተደርጓል።", parse_mode="Markdown")
        return

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
        methods = get_payment_methods()
        method = methods.get(method_name, methods["Telebirr"])
        profile = get_or_create_user(user.id, user.username or "", user.first_name or "", user.last_name or "")
        phone = profile.get("phone_number") or "N/A"

        text = (
            f"💳 *{method['name']} የማስገቢያ መረጃ*\n\n"
            f"• *የሂሳብ ስም:* `{method['account_name']}`\n"
            f"• *የሂሳብ ቁጥር:* `{method['account_number']}` _(ለመገልበጥ ቁጥሩን ይንኩ)_\n"
            f"• *ዝቅተኛ መጠን:* `{method['min_amount']} ETB`\n"
            f"• *ቦነስ:* {method['bonus']} 🎁\n\n"
            f"📱 *የእርስዎ የተረጋገጠ ስልክ:* `{phone}`\n\n"
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
        methods = get_payment_methods()
        method = methods.get(method_name, methods["Telebirr"])
        profile = get_or_create_user(user.id, user.username or "", user.first_name or "", user.last_name or "")
        phone = profile.get("phone_number") or "N/A"
        bal = float(profile.get("balance", 0.0))

        text = (
            f"🏧 *{method['name']} ገንዘብ ማውጫ*\n\n"
            f"• *የተመረጠ መንገድ:* {method['name']}\n"
            f"• *ገንዘቡ የሚላክበት ስልክ:* `{phone}`\n"
            f"• *የሚገኝ ሂሳብ:* `{bal:.2f} ETB`\n"
            f"• *ዝቅተኛ ማውጫ:* `{method['min_amount']} ETB`\n"
            f"• *የአገልግሎት ክፍያ:* `0% (ነፃ)`\n\n"
            f"ገንዘብ ለማውጣት በጨዋታው ውስጥ ማውጣት የሚፈልጉትን መጠን ያስገቡ። ገንዘቡ በቀጥታ ወደ `{phone}` ይላካል።"
        )
        keyboard = [
            [InlineKeyboardButton(text="🎮 በጨዋታው ውስጥ አውጣ (Withdraw in Game)", web_app=WebAppInfo(url=f"{WEB_APP_URL}#deposit"))],
            [InlineKeyboardButton(text="« የመውጫ መንገዶች (Back)", callback_data="withdraw")],
        ]
        await query.message.reply_text(text=text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")
        return

    # Profile option
    if data == "profile":
        profile = get_or_create_user(user.id, user.username or "", user.first_name or "", user.last_name or "")
        phone = profile.get("phone_number") or "ያልተረጋገጠ ⚠️"
        bal = float(profile.get("balance", 0.0))
        bonus_status = "የተወሰደ (50 ETB) ✅" if profile.get("bonus_claimed") else "ያልተወሰደ 🎁"
        is_admin = is_admin_check(user.id, user.username or "", phone)
        status_label = "Super Administrator 🛡️" if is_admin else ("የተረጋገጠ (Verified) ✅" if profile.get("is_verified") else "ያልተረጋገጠ ⚠️")

        fname = profile.get("first_name") or ""
        lname = profile.get("last_name") or ""
        full_name = f"{fname} {lname}".strip() or "Player"

        text = (
            f"👤 *የተጠቃሚ መረጃ (My Profile)*\n\n"
            f"• *ስም:* {full_name}\n"
            f"• *የቴሌግራም ID:* `{user.id}`\n"
            f"• *የተጠቃሚ ስም:* @{user.username if user.username else 'የለም'}\n"
            f"• *የተረጋገጠ ስልክ:* `{phone}`\n"
            f"• *ዋና ሂሳብ:* `{bal:.2f} ETB`\n"
            f"• *የቦነስ ሁኔታ:* {bonus_status}\n"
            f"• *የመለያ ሁኔታ:* {status_label}"
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
            f"`https://t.me/{bot_username}?start=ref_{user.id}`"
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
    try:
        await application.bot.delete_webhook(drop_pending_updates=True)
        logger.info("Deleted any existing webhook to ensure clean polling.")
    except Exception as e:
        logger.warning("Could not delete webhook: %s", e)

    commands = [
        BotCommand("start", "Start the bot"),
        BotCommand("deposit", "Deposit money"),
        BotCommand("withdraw", "Withdraw money"),
        BotCommand("balance", "Check Balance"),
        BotCommand("register", "Register new account"),
        BotCommand("transfer", "Send money to friend"),
    ]
    try:
        await application.bot.set_my_commands(commands)
        await application.bot.set_chat_menu_button(menu_button=MenuButtonCommands())
        logger.info("Bot commands menu registered successfully.")
    except Exception as e:
        logger.warning("Could not set bot commands or menu button immediately: %s", e)

# ==============================================================================
# BACKGROUND WEB / HEALTH SERVER (FOR ETHIODEPLOY / CLOUD HOSTING)
# ==============================================================================
def start_background_web_server() -> None:
    """Runs a background HTTP server to respond to health checks and serve the webapp if needed."""
    port = int(os.getenv("PORT", "8080"))

    class HealthAndStaticServer(SimpleHTTPRequestHandler):
        def do_GET(self):
            if self.path in ("/health", "/healthz", "/ping"):
                self.send_response(200)
                self.send_header("Content-Type", "text/plain")
                self.end_headers()
                self.wfile.write(b"OK")
                return
            return super().do_GET()

        def log_message(self, format, *args):
            pass  # Keep logs clean

    def serve():
        try:
            server = HTTPServer(("0.0.0.0", port), HealthAndStaticServer)
            logger.info("Background HTTP/Health server listening on port %d", port)
            server.serve_forever()
        except Exception as e:
            logger.warning("Could not start background HTTP server on port %d: %s", port, e)

    t = threading.Thread(target=serve, daemon=True)
    t.start()

# ==============================================================================
# MAIN APPLICATION
# ==============================================================================
def main() -> None:
    """Starts the bot."""
    init_db()
    export_admin_players()
    start_background_web_server()

    if BOT_TOKEN == "YOUR_BOT_TOKEN_HERE":
        logger.warning(
            "[WARNING] BOT_TOKEN is not set! Please edit BOT_TOKEN in bot.py or set the BOT_TOKEN environment variable."
        )

    app = (
        Application.builder()
        .token(BOT_TOKEN)
        .read_timeout(30)
        .write_timeout(30)
        .connect_timeout(30)
        .post_init(post_init)
        .build()
    )

    # Command handlers matching the menu
    app.add_handler(CommandHandler(["start", "Start", "help", "menu"], start_command))
    app.add_handler(CommandHandler(["deposit", "Deposit"], deposit_flow))
    app.add_handler(CommandHandler(["withdraw", "Withdraw"], withdraw_flow))
    app.add_handler(CommandHandler(["balance", "Balance"], balance_flow))
    app.add_handler(CommandHandler(["transactions", "Transactions", "transaction", "Transaction"], transactions_flow))
    app.add_handler(CommandHandler(["register", "Register"], register_flow))
    app.add_handler(CommandHandler(["transfer", "Transfer"], transfer_flow))
    app.add_handler(CommandHandler(["admin", "Admin"], admin_command))

    # Contact handler for phone number sharing & anti-fraud bonus verification
    app.add_handler(MessageHandler(filters.CONTACT, contact_handler))

    # Inline button callback router
    app.add_handler(CallbackQueryHandler(button_callback))

    print("[INFO] Lucky Bingo Bot is starting... Polling for updates.")
    app.run_polling(allowed_updates=Update.ALL_TYPES, drop_pending_updates=True)

if __name__ == "__main__":
    main()
