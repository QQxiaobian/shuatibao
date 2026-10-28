/**
 * 刷题小程序自托管后端
 *
 * 只依赖 Node 内置模块，负责：
 *  - 托管 dist-nas 静态站点
 *  - 共享试卷的创建 / 列表 / 详情 / 删除
 *  - 考试记录的写入 / 查询（可按共享试卷筛选）
 *
 * 数据保存在 DATA_DIR/db.json，默认容器内 /data，本地默认 ./data
 */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const STATIC_DIR = path.resolve(process.env.STATIC_DIR || path.join(__dirname, '..', 'dist-nas'));
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const DB_FILE = path.join(DATA_DIR, 'db.json');
const MAX_BODY = 8 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const DEFAULT_DB = { sharedExams: [], records: [] };

let db = null;
let writeChain = Promise.resolve();

async function loadDb() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fsp.readFile(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    db = {
      sharedExams: Array.isArray(parsed.sharedExams) ? parsed.sharedExams : [],
      records: Array.isArray(parsed.records) ? parsed.records : [],
    };
  } catch {
    db = { ...DEFAULT_DB, sharedExams: [], records: [] };
    await persist();
  }
}

function persist() {
  const snapshot = JSON.stringify(db, null, 2);
  writeChain = writeChain.then(async () => {
    const tmp = `${DB_FILE}.tmp`;
    await fsp.writeFile(tmp, snapshot, 'utf8');
    await fsp.rename(tmp, DB_FILE);
  }).catch((err) => {
    console.error('[db] 写入失败:', err);
  });
  return writeChain;
}

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('请求内容过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });
}

function cleanText(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeQuestions(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((q) => q && typeof q === 'object')
    .slice(0, 500)
    .map((q) => ({
      id: cleanText(q.id, 80) || newId('q'),
      type: ['single', 'multiple', 'judge', 'short'].includes(q.type) ? q.type : 'single',
      question: cleanText(q.question, 5000),
      options: Array.isArray(q.options)
        ? q.options.slice(0, 10).map((o) => cleanText(o, 2000))
        : [],
      answer: Array.isArray(q.answer)
        ? q.answer.slice(0, 10).map((a) => cleanText(a, 500))
        : cleanText(q.answer, 5000),
      analysis: cleanText(q.analysis, 5000),
      subject: cleanText(q.subject, 200),
      chapter: cleanText(q.chapter, 200),
      difficulty: [1, 2, 3].includes(Number(q.difficulty)) ? Number(q.difficulty) : 2,
      source: ['mock', 'import', 'manual'].includes(q.source) ? q.source : 'import',
      bankId: cleanText(q.bankId, 80) || 'shared',
      createdAt: Number(q.createdAt) || Date.now(),
      updatedAt: Number(q.updatedAt) || Date.now(),
    }));
}

function summarizeShared(exam) {
  return {
    id: exam.id,
    name: exam.name,
    questionCount: exam.questions.length,
    totalScore: exam.totalScore,
    typeDistribution: exam.typeDistribution,
    perQuestionScores: exam.perQuestionScores,
    createdBy: exam.createdBy,
    createdAt: exam.createdAt,
    recordCount: db.records.filter((r) => r.sharedExamId === exam.id).length,
  };
}

async function handleApi(req, res, url) {
  const { pathname } = url;

  if (req.method === 'GET' && pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      time: Date.now(),
      sharedExams: db.sharedExams.length,
      records: db.records.length,
    });
    return true;
  }

  if (pathname === '/api/shared-exams' && req.method === 'GET') {
    const exams = [...db.sharedExams]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(summarizeShared);
    sendJson(res, 200, { exams });
    return true;
  }

  if (pathname === '/api/shared-exams' && req.method === 'POST') {
    const body = await readBody(req);
    const questions = normalizeQuestions(body.questions);
    if (!cleanText(body.name, 200)) {
      sendError(res, 400, '试卷名称不能为空');
      return true;
    }
    if (questions.length === 0) {
      sendError(res, 400, '试卷没有题目');
      return true;
    }
    const exam = {
      id: newId('shared'),
      name: cleanText(body.name, 200),
      createdBy: cleanText(body.createdBy, 60) || '匿名用户',
      questions,
      totalScore: Math.max(0, Number(body.totalScore) || 0),
      typeDistribution: body.typeDistribution && typeof body.typeDistribution === 'object'
        ? body.typeDistribution
        : { single: 0, multiple: 0, judge: 0, short: 0 },
      perQuestionScores: body.perQuestionScores && typeof body.perQuestionScores === 'object'
        ? body.perQuestionScores
        : { single: 2, multiple: 4, judge: 2, short: 10 },
      createdAt: Date.now(),
    };
    db.sharedExams.unshift(exam);
    await persist();
    sendJson(res, 201, { exam: summarizeShared(exam) });
    return true;
  }

  const sharedMatch = pathname.match(/^\/api\/shared-exams\/([^/]+)$/);
  if (sharedMatch) {
    const id = decodeURIComponent(sharedMatch[1]);
    const exam = db.sharedExams.find((e) => e.id === id);
    if (!exam) {
      sendError(res, 404, '共享试卷不存在');
      return true;
    }
    if (req.method === 'GET') {
      sendJson(res, 200, { exam });
      return true;
    }
    if (req.method === 'DELETE') {
      db.sharedExams = db.sharedExams.filter((e) => e.id !== id);
      db.records = db.records.filter((r) => r.sharedExamId !== id);
      await persist();
      sendJson(res, 200, { ok: true });
      return true;
    }
    sendError(res, 405, '不支持的请求方法');
    return true;
  }

  if (pathname === '/api/exam-records' && req.method === 'GET') {
    const sharedExamId = url.searchParams.get('sharedExamId');
    const records = db.records
      .filter((r) => (sharedExamId ? r.sharedExamId === sharedExamId : true))
      .sort((a, b) => b.finishedAt - a.finishedAt);
    sendJson(res, 200, { records });
    return true;
  }

  if (pathname === '/api/exam-records' && req.method === 'POST') {
    const body = await readBody(req);
    if (!cleanText(body.sharedExamId, 80) || !cleanText(body.examName, 200)) {
      sendError(res, 400, '缺少试卷信息');
      return true;
    }
    const record = {
      id: newId('record'),
      sharedExamId: cleanText(body.sharedExamId, 80),
      examName: cleanText(body.examName, 200),
      participant: cleanText(body.participant, 60) || '匿名用户',
      userAnswers: body.userAnswers && typeof body.userAnswers === 'object' ? body.userAnswers : {},
      score: Math.max(0, Number(body.score) || 0),
      totalScore: Math.max(0, Number(body.totalScore) || 0),
      accuracy: Math.max(0, Math.min(100, Number(body.accuracy) || 0)),
      duration: Math.max(0, Number(body.duration) || 0),
      finishedAt: Date.now(),
    };
    db.records.unshift(record);
    await persist();
    sendJson(res, 201, { record });
    return true;
  }

  if (pathname.startsWith('/api/')) {
    sendError(res, 404, '接口不存在');
    return true;
  }

  return false;
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/' || pathname === '') pathname = '/index.html';

  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(STATIC_DIR, safePath);

  if (!filePath.startsWith(STATIC_DIR)) {
    sendError(res, 403, '禁止访问');
    return;
  }

  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
  } catch {
    // 无扩展名的路径回退到 index.html（Hash 路由本身不需要，但兼容直接访问）
    if (!path.extname(pathname)) {
      filePath = path.join(STATIC_DIR, 'index.html');
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
  }

  try {
    const ext = path.extname(filePath).toLowerCase();
    const data = await fsp.readFile(filePath);
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    };
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }
    await serveStatic(req, res, url);
  } catch (err) {
    console.error('[server] 请求处理失败:', err);
    if (!res.headersSent) sendError(res, 500, '服务器内部错误');
  }
});

await loadDb();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`刷题小程序已启动: http://0.0.0.0:${PORT}`);
  console.log(`静态目录: ${STATIC_DIR}`);
  console.log(`数据目录: ${DATA_DIR}`);
});
