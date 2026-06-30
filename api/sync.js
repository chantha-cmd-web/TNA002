const { writeFileSync, readFileSync, existsSync, mkdirSync } = require('fs');
const { join } = require('path');
const ALLOWED_TOKEN = process.env.SYNC_TOKEN || 'tna-sync-2026';
const DATA_DIR = join('/tmp', 'tna_sync');
const DATA_FILE = join(DATA_DIR, 'data.json');
const VERSION_FILE = join(DATA_DIR, 'version.json');

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readData() {
  if (!existsSync(DATA_FILE)) return {};
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
  } catch { return {}; }
}

function readVersion() {
  if (!existsSync(VERSION_FILE)) return 0;
  try {
    const v = JSON.parse(readFileSync(VERSION_FILE, 'utf-8'));
    return v.version || 0;
  } catch { return 0; }
}

function writeData(data, version) {
  ensureDir();
  writeFileSync(DATA_FILE, JSON.stringify(data), 'utf-8');
  writeFileSync(VERSION_FILE, JSON.stringify({ version }), 'utf-8');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const action = req.query.action || '';
  const token = req.query.token || '';

  if (token !== ALLOWED_TOKEN) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    if (req.method === 'GET') {
      if (action === 'readVersion') {
        return res.json({ status: 'ok', version: readVersion() });
      }

      if (action.startsWith('read&key=')) {
        const key = action.replace('read&key=', '');
        const data = readData();
        return res.json({ status: 'ok', value: data[key] !== undefined ? data[key] : null });
      }

      if (action === 'readAll') {
        const data = readData();
        return res.json({ status: 'ok', data, version: readVersion() });
      }

      return res.status(400).json({ error: 'Unknown action: ' + action });
    }

    if (req.method === 'POST') {
      const body = req.body || {};

      if (action.startsWith('write&key=')) {
        const key = action.replace('write&key=', '');
        const data = readData();
        data[key] = body.value !== undefined ? body.value : body;
        writeData(data, readVersion() + 1);
        return res.json({ status: 'ok', version: readVersion() });
      }

      if (action === 'writeBatch') {
        const data = readData();
        for (const [k, v] of Object.entries(body)) {
          data[k] = v;
        }
        writeData(data, readVersion() + 1);
        return res.json({ status: 'ok', version: readVersion() });
      }

      if (action === 'reset') {
        writeData({}, 0);
        return res.json({ status: 'ok', version: 0 });
      }

      return res.status(400).json({ error: 'Unknown action: ' + action });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Sync error:', err);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
};
