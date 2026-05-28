const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'academy.db');
let db = null;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  return db;
}

function saveDb() {
  if (!db) return;
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function toObjects(result) {
  if (!result || result.length === 0) return [];
  const cols = result[0].columns;
  return result[0].values.map(row => { const o = {}; cols.forEach((c, i) => o[c] = row[i]); return o; });
}

async function initDatabase() {
  const db = await getDb();

  // === CORE TABLES ===
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
    phone TEXT, address TEXT, is_blocked INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
    role TEXT DEFAULT 'admin', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, author TEXT NOT NULL,
    description TEXT, price REAL NOT NULL, image TEXT, category TEXT,
    pages INTEGER, language TEXT DEFAULT 'বাংলা', in_stock INTEGER DEFAULT 1,
    is_ebook INTEGER DEFAULT 0, pdf_url TEXT, preview_pages INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  try { db.run("ALTER TABLE books ADD COLUMN is_ebook INTEGER DEFAULT 0"); } catch(e){}
  try { db.run("ALTER TABLE books ADD COLUMN pdf_url TEXT"); } catch(e){}
  try { db.run("ALTER TABLE books ADD COLUMN preview_pages INTEGER"); } catch(e){}

  db.run(`CREATE TABLE IF NOT EXISTS book_access (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, book_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE,
    UNIQUE(user_id, book_id)
  )`);


  db.run(`CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, instructor TEXT NOT NULL,
    description TEXT, price REAL NOT NULL, image TEXT, category TEXT,
    duration TEXT, lessons_count INTEGER DEFAULT 0, level TEXT DEFAULT 'শিক্ষানবিস',
    enrolled INTEGER DEFAULT 0, is_published INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // === LMS TABLES ===
  db.run(`CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT, course_id INTEGER NOT NULL,
    title TEXT NOT NULL, type TEXT DEFAULT 'video',
    content_url TEXT, pdf_url TEXT, description TEXT, sort_order INTEGER DEFAULT 0,
    duration TEXT, is_free INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
  )`);
  // Add pdf_url column if missing (migration for existing DBs)
  try { db.run('ALTER TABLE lessons ADD COLUMN pdf_url TEXT'); } catch(e) {}

  db.run(`CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, course_id INTEGER NOT NULL,
    lesson_id INTEGER, title TEXT NOT NULL,
    time_limit_mins INTEGER DEFAULT 30, pass_marks INTEGER DEFAULT 60,
    total_marks INTEGER DEFAULT 100, is_published INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS quiz_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, quiz_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    option_a TEXT, option_b TEXT, option_c TEXT, option_d TEXT,
    correct_option TEXT NOT NULL, marks INTEGER DEFAULT 1,
    explanation TEXT,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
    quiz_id INTEGER NOT NULL, score INTEGER DEFAULT 0,
    total_marks INTEGER, answers_json TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (quiz_id) REFERENCES quizzes(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS qna (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
    course_id INTEGER, lesson_id INTEGER,
    question TEXT NOT NULL, answer TEXT,
    answered_by INTEGER, status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL, progress INTEGER DEFAULT 0,
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (course_id) REFERENCES courses(id),
    UNIQUE(user_id, course_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS lesson_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
    lesson_id INTEGER NOT NULL, completed INTEGER DEFAULT 0,
    completed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (lesson_id) REFERENCES lessons(id),
    UNIQUE(user_id, lesson_id)
  )`);

  // === CART & ORDERS ===
  db.run(`CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
    item_type TEXT NOT NULL, item_id INTEGER NOT NULL, quantity INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
    total REAL NOT NULL, status TEXT DEFAULT 'pending',
    name TEXT, email TEXT, phone TEXT, address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL,
    item_type TEXT NOT NULL, item_id INTEGER NOT NULL,
    item_title TEXT NOT NULL, price REAL NOT NULL, quantity INTEGER DEFAULT 1,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  )`);

  // === SITE SETTINGS ===
  db.run(`CREATE TABLE IF NOT EXISTS site_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT, setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT, category TEXT DEFAULT 'general'
  )`);

  // Seed settings
  const settingsCount = toObjects(db.exec('SELECT COUNT(*) as c FROM site_settings'))[0]?.c || 0;
  if (settingsCount === 0) {
    const defaults = [
      ['site_name','রুসুখ অনলাইন একাডেমি','general'],
      ['site_tagline','ইসলামী শিক্ষার জন্য বাংলাদেশের সেরা অনলাইন প্ল্যাটফর্ম','general'],
      ['hero_title','ইসলামী জ্ঞানের আলোয় আলোকিত হোন','general'],
      ['hero_description','রুসুখ অনলাইন একাডেমিতে স্বাগতম। কুরআন, হাদীস, ফিক্বহ ও আরবী ভাষার উপর মানসম্মত কোর্স এবং বই সংগ্রহ করুন।','general'],
      ['contact_email','info@rusukh.com','contact'],
      ['contact_phone','+৮৮০ ১৭XX-XXXXXX','contact'],
      ['contact_address','ঢাকা, বাংলাদেশ','contact'],
      ['office_hours','শনি-বৃহস্পতি, সকাল ১০টা - রাত ৮টা','contact'],
      ['footer_text','© ২০২৬ রুসুখ অনলাইন একাডেমি। সর্বস্বত্ব সংরক্ষিত।','general'],
      ['primary_color','#0D7C66','appearance'],
      ['accent_color','#D4A843','appearance'],
      ['font_family','Noto Sans Bengali','appearance'],
    ];
    for (const s of defaults) db.run('INSERT INTO site_settings (setting_key,setting_value,category) VALUES (?,?,?)', s);
  }

  // === SEED DATA ===
  const adminCount = toObjects(db.exec('SELECT COUNT(*) as c FROM admins'))[0]?.c || 0;
  if (adminCount === 0) {
    db.run('INSERT INTO admins (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['অ্যাডমিন', 'admin@rusukh.com', bcrypt.hashSync('Admin123', 10), 'superadmin']);
    console.log('  👤 Admin created: admin@rusukh.com / Admin123');
  }

  const bookCount = toObjects(db.exec('SELECT COUNT(*) as c FROM books'))[0]?.c || 0;
  if (bookCount === 0) {
    const books = [
      ['ঈমানের মূলনীতি','শাইখ আব্দুল আযীয','ইসলামী বিশ্বাসের মৌলিক নীতিমালা সম্পর্কে বিস্তারিত আলোচনা।',350,'','আক্বীদাহ',280,'বাংলা'],
      ['সহীহ হাদীস সংকলন','ইমাম বুখারী (অনুবাদ)','সহীহ বুখারী থেকে নির্বাচিত হাদীসের বাংলা অনুবাদ ও ব্যাখ্যা।',500,'','হাদীস',450,'বাংলা'],
      ['ফিক্বহুস সুন্নাহ','সাইয়্যিদ সাবিক','ইসলামী আইনশাস্ত্রের সহজবোধ্য ব্যাখ্যা।',420,'','ফিক্বহ',520,'বাংলা'],
      ['আরবী ভাষা শিক্ষা','ড. আব্দুর রহীম','মাদীনা ইউনিভার্সিটির পাঠ্যক্রম অনুসারে আরবী ভাষা শেখার গাইড।',300,'','ভাষা',320,'বাংলা-আরবী'],
      ['সীরাতুন নবী (সা.)','সফিউর রহমান মুবারকপুরী','রাসূলুল্লাহ (সা.) এর জীবনী।',600,'','সীরাত',680,'বাংলা'],
      ['তাফসীরুল কুরআন','ইবন কাসীর (অনুবাদ)','পবিত্র কুরআনের বিশ্বস্ত তাফসীর।',750,'','তাফসীর',820,'বাংলা']
    ];
    for (const b of books) db.run('INSERT INTO books (title,author,description,price,image,category,pages,language) VALUES (?,?,?,?,?,?,?,?)', b);

    const courses = [
      ['কুরআন তিলাওয়াত কোর্স','ক্বারী আহমদ সাঈদ','সঠিক তাজওীদ সহ কুরআন তিলাওয়াত শিখুন।',1500,'','কুরআন','৩ মাস',36,'শিক্ষানবিস',245],
      ['ইসলামী আক্বীদাহ কোর্স','শাইখ মুহাম্মদ ইবরাহীম','তাওহীদ, রিসালাত ও আখিরাত সম্পর্কে গভীর জ্ঞান।',1200,'','আক্বীদাহ','২ মাস',24,'মধ্যম',189],
      ['আরবী ভাষা কোর্স (স্তর ১)','উস্তায রাশেদ আল-ফারুক','শূন্য থেকে আরবী ভাষা শিখুন।',2000,'','ভাষা','৪ মাস',48,'শিক্ষানবিস',320],
      ['ফিক্বহুল ইবাদাত','মুফতী তারিক মাসউদ','ইবাদতের ফিক্বহ।',1800,'','ফিক্বহ','৩ মাস',40,'মধ্যম',156],
      ['হাদীস অধ্যয়ন কোর্স','ড. আবু বকর জাকারিয়া','হাদীস শাস্ত্রের মূলনীতি ও পরিভাষা।',1600,'','হাদীস','২.৫ মাস',30,'উন্নত',98],
      ['ইসলামী ইতিহাস কোর্স','প্রফেসর আব্দুল্লাহ আল-মামুন','খিলাফতে রাশেদা থেকে আধুনিক যুগ।',1000,'','ইতিহাস','২ মাস',20,'শিক্ষানবিস',275]
    ];
    for (const c of courses) db.run('INSERT INTO courses (title,instructor,description,price,image,category,duration,lessons_count,level,enrolled) VALUES (?,?,?,?,?,?,?,?,?,?)', c);
    console.log('  🌱 Seeded 6 books and 6 courses');
  }

  saveDb();
  console.log('  📦 Database initialized successfully');
}

module.exports = { getDb, initDatabase, saveDb, toObjects };
