require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// تخزين محاولات تسجيل الدخول الفاشلة
const failedAttempts = new Map();

// مدة الحظر بالمللي ثانية (5 ثواني = 5000 مللي ثانية)
const BLOCK_DURATION = 5000;

// Middleware للتحقق من IP محظور
const checkBlockedIP = (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (failedAttempts.has(clientIP)) {
        const attempts = failedAttempts.get(clientIP);
        
        // إذا كان IP محظوراً ولم تنته المدة
        if (attempts.isBlocked && attempts.blockUntil > Date.now()) {
            const remainingTime = Math.ceil((attempts.blockUntil - Date.now()) / 1000);
            return res.render('login', {
                error: `تم حظر عنوان IP الخاص بك مؤقتاً`,
                blocked: true,
                remainingTime: remainingTime,
                attempts: attempts.count
            });
        }
        
        // إذا انتهت مدة الحظر نمسح البيانات
        if (attempts.isBlocked && attempts.blockUntil <= Date.now()) {
            failedAttempts.delete(clientIP);
        }
    }
    
    next();
};

// بيانات المستخدمين
const users = [
    { username: 'admin', password: 'admin123', role: 'admin' },
    { username: 'user1', password: 'password1', role: 'user' }
];

// Routes
app.get('/', (req, res) => {
    if (req.session.user) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/login');
    }
});

app.get('/login', checkBlockedIP, (req, res) => {
    res.render('login', { 
        error: null, 
        blocked: false,
        remainingTime: null,
        attempts: 0
    });
});

app.post('/login', checkBlockedIP, (req, res) => {
    const { username, password } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // إذا كان IP محظوراً
    if (failedAttempts.has(clientIP) && failedAttempts.get(clientIP).isBlocked) {
        const attempts = failedAttempts.get(clientIP);
        const remainingTime = Math.ceil((attempts.blockUntil - Date.now()) / 1000);
        return res.render('login', {
            error: `تم حظر عنوان IP الخاص بك مؤقتاً`,
            blocked: true,
            remainingTime: remainingTime,
            attempts: attempts.count
        });
    }
    
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        // تسجيل الدخول الناجح - مسح أي محاولات فاشلة
        if (failedAttempts.has(clientIP)) {
            failedAttempts.delete(clientIP);
        }
        
        req.session.user = user;
        return res.redirect('/dashboard');
    }
    
    // تسجيل الدخول الفاشل
    if (!failedAttempts.has(clientIP)) {
        failedAttempts.set(clientIP, {
            count: 1,
            lastAttempt: Date.now(),
            isBlocked: false,
            blockUntil: null
        });
    } else {
        const attempts = failedAttempts.get(clientIP);
        attempts.count++;
        attempts.lastAttempt = Date.now();
        
        // حظر IP بعد 3 محاولات فاشلة بالضبط
        if (attempts.count >= 3) {
            attempts.isBlocked = true;
            attempts.blockUntil = Date.now() + BLOCK_DURATION;
            return res.render('login', {
                error: 'تم حظر عنوان IP الخاص بك مؤقتاً بسبب كثرة المحاولات الفاشلة',
                blocked: true,
                remainingTime: Math.ceil(BLOCK_DURATION / 1000),
                attempts: attempts.count
            });
        }
    }
    
    res.render('login', {
        error: 'اسم المستخدم أو كلمة المرور غير صحيحة',
        blocked: false,
        attemptsLeft: 3 - failedAttempts.get(clientIP).count,
        attempts: failedAttempts.get(clientIP).count
    });
});

app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('dashboard', { user: req.session.user });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`الخادم يعمل على http://localhost:${PORT}`);
});