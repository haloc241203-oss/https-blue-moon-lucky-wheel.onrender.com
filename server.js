'use strict';
require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
app.disable('x-powered-by');
app.use((req,res,next)=>{res.set('X-Content-Type-Options','nosniff');res.set('Referrer-Policy','strict-origin-when-cross-origin');res.set('X-Frame-Options','DENY');next()});
app.use(express.json({ limit: '8kb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
const port = Number(process.env.PORT || 3000);
const dbPath = path.resolve(process.env.DB_PATH || './data/spins.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const hashSecret = process.env.HASH_SECRET;
if (!hashSecret || hashSecret.length < 24) throw new Error('Set HASH_SECRET >= 24 characters in .env');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS spins (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  email_hash TEXT NOT NULL UNIQUE,
  phone_hash TEXT NOT NULL UNIQUE,
  prize_id INTEGER NOT NULL,
  prize_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);

// Segment 0 is centered at 12 o’clock; indices increase clockwise. The graphic must match this order.
const defaults = [
  ['Chúc bạn may mắn lần sau',0],
  ['500.000đ tiền mặt',0],
  ['Tặng bánh ngọt',0],
  ['Voucher 10%',30],
  ['Voucher 100.000đ cho hóa đơn từ 300.000đ',10],
  ['Tặng kem Aice',10],
  ['Tặng bánh ngọt',0],
  ['Voucher 10%',30],
  ['Voucher 100.000đ cho hóa đơn từ 300.000đ',10],
  ['Tặng kem Aice',10]
];
db.exec(`CREATE TABLE IF NOT EXISTS wheel_config (id INTEGER PRIMARY KEY CHECK(id BETWEEN 0 AND 9),weight INTEGER NOT NULL CHECK(weight>=0));
CREATE TABLE IF NOT EXISTS redemptions (spin_id TEXT PRIMARY KEY REFERENCES spins(id), redeemed_at TEXT NOT NULL DEFAULT (datetime('now')));`);
const seed = db.prepare('INSERT OR IGNORE INTO wheel_config (id,weight) VALUES (?,?)');
for (let i=0;i<10;i++) seed.run(i,defaults[i][1]);
function getSegments(){
 const weights=db.prepare('SELECT id,weight FROM wheel_config ORDER BY id').all();
 return defaults.map(([name],id)=>({id,name,weight:weights[id].weight}));
}
function normalizeEmail(v) { return String(v || '').trim().toLowerCase(); }
function normalizePhone(v) {
  let x = String(v || '').replace(/[\s.()-]/g, '');
  if (x.startsWith('+84')) x = '0' + x.slice(3);
  else if (x.startsWith('84') && x.length === 11) x = '0' + x.slice(2);
  return x;
}
function secureHash(text) { return crypto.createHmac('sha256', hashSecret).update(text).digest('hex'); }
function drawSegment() {
  const segments=getSegments();
  const sum=segments.reduce((v,s)=>v+s.weight,0);
  if (!Number.isSafeInteger(sum) || sum<=0) throw Error("Invalid prize weights");
  const n = crypto.randomInt(sum);
  let at = 0;
  for (const s of segments) { at += s.weight; if (n < at) return s; }
  throw new Error('Invalid prize weights');
}
const buckets = new Map();
function limitRequest(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const b = buckets.get(ip) || { count: 0, start: now };
  if (now - b.start > 60_000) { b.count = 0; b.start = now; }
  b.count++;
  buckets.set(ip, b);
  if (b.count > 12) return res.status(429).json({ error: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.' });
  next();
}
setInterval(() => {
  const threshold = Date.now() - 120_000;
  for (const [ip, v] of buckets) if (v.start < threshold) buckets.delete(ip);
}, 120_000).unref();
app.get('/api/config', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ segments: getSegments().map(({ id, name }) => ({ id, name })) });
});
const insertSpin = db.prepare('INSERT INTO spins (id,email,phone,email_hash,phone_hash,prize_id,prize_name) VALUES (?,?,?,?,?,?,?)');
const createSpin = db.transaction((email, phone) => {
  const prize = drawSegment();
  const id = crypto.randomUUID();
  insertSpin.run(id, email, phone, secureHash(email), secureHash(phone), prize.id, prize.name);
  return { id, segmentId: prize.id, prize: prize.name };
});
app.post('/api/spin', limitRequest, (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const phone = normalizePhone(req.body?.phone);
  if (!/^[a-z0-9._%+-]+@gmail\.com$/.test(email))
    return res.status(400).json({ error: 'Vui lòng nhập địa chỉ Gmail hợp lệ.' });
  if (!/^0[35789][0-9]{8}$/.test(phone))
    return res.status(400).json({ error: 'Vui lòng nhập số điện thoại Việt Nam hợp lệ.' });
  if (req.body?.consent !== true)
    return res.status(400).json({ error: 'Vui lòng đồng ý với điều khoản tham gia.' });
  try {
    const result = createSpin(email, phone);
    res.set('Cache-Control', 'no-store');
    res.status(201).json(result);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE')
      return res.status(409).json({ error: 'Gmail hoặc số điện thoại này đã tham gia vòng quay.' });
    console.error(err);
    res.status(500).json({ error: 'Có lỗi xảy ra, vui lòng thử lại.' });
  }
});
function adminAuth(req,res,next){
 const key=process.env.ADMIN_KEY||'';
 const candidate=req.get('X-Admin-Key')||'';
 if(key.length<24||candidate.length!==key.length||!crypto.timingSafeEqual(Buffer.from(candidate),Buffer.from(key)))
   return res.status(403).json({error:'Mật khẩu quản trị không hợp lệ.'});
 next();
}
app.get('/api/admin/stats',adminAuth,(req,res)=>{
 const total=db.prepare('SELECT COUNT(*) n FROM spins').get().n;
 const redeemed=db.prepare('SELECT COUNT(*) n FROM redemptions').get().n;
 const breakdown=db.prepare('SELECT prize_id id,prize_name name,COUNT(*) count FROM spins GROUP BY prize_id,prize_name ORDER BY prize_id').all();
 res.set('Cache-Control','no-store');
 res.json({total,redeemed,breakdown,segments:getSegments()});
});
app.get('/api/admin/participants',adminAuth,(req,res)=>{
 const page=Math.min(100000,Math.max(1,Number.parseInt(req.query.page,10)||1));
 const limit=25;
 const rows=db.prepare(`SELECT s.id,s.email,s.phone,s.prize_name,s.created_at,r.redeemed_at
  FROM spins s LEFT JOIN redemptions r ON r.spin_id=s.id
  ORDER BY s.created_at DESC,s.rowid DESC LIMIT ? OFFSET ?`).all(limit,(page-1)*limit);
 res.set('Cache-Control','no-store');
 res.json({page,limit,rows});
});
app.post('/api/admin/weights',adminAuth,(req,res)=>{
 const weights=req.body?.weights;
 if(!Array.isArray(weights)||weights.length!==10||!weights.every(x=>Number.isSafeInteger(x)&&x>=0&&x<=100000)||weights.reduce((a,b)=>a+b,0)!==100)
   return res.status(400).json({error:'Cần nhập 10 xác suất nguyên không âm, tổng bằng 100%.'});
 const update=db.prepare('UPDATE wheel_config SET weight=? WHERE id=?');
 db.transaction(()=>weights.forEach((v,i)=>update.run(v,i)))();
 res.json({ok:true,segments:getSegments()});
});
app.post('/api/admin/redeem',adminAuth,(req,res)=>{
 const id=String(req.body?.code||'').trim();
 const record=db.prepare('SELECT id,prize_name,created_at FROM spins WHERE id=?').get(id);
 if(!record)return res.status(404).json({error:'Không tìm thấy mã trúng thưởng.'});
 const used=db.prepare('SELECT redeemed_at FROM redemptions WHERE spin_id=?').get(id);
 if(used)return res.status(409).json({error:'Mã này đã đổi quà lúc '+used.redeemed_at,record});
 db.prepare('INSERT INTO redemptions (spin_id) VALUES (?)').run(id);
 res.json({ok:true,record});
});
function csvCell(v) {
  // Guard against spreadsheet formula injection in exported contacts.
  let text = String(v ?? '');
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
app.get('/api/admin/export.csv',adminAuth, (req, res) => {
  const rows = db.prepare('SELECT s.id,s.email,s.phone,s.prize_name,s.created_at,r.redeemed_at FROM spins s LEFT JOIN redemptions r ON s.id=r.spin_id ORDER BY s.created_at DESC').all();
  const columns = ['id', 'email', 'phone', 'prize_name', 'created_at','redeemed_at'];
  const csv = '\uFEFF' + [columns.join(','), ...rows.map(r => columns.map(k => csvCell(r[k])).join(','))].join('\r\n');
  res.set('Cache-Control', 'no-store');
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="blue-moon-winners.csv"');
  res.send(csv);
});
app.get('/healthz', (req, res) => res.status(200).json({ok:true}));
app.listen(port, '0.0.0.0', () => console.log(`Blue Moon wheel listening on ${port}`));
