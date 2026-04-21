const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const app = express();
const rootDir = __dirname;
const dataDir = path.join(rootDir, 'data');
const contentFile = path.join(dataDir, 'portfolio-content.json');
const port = Number(process.env.PORT || 3000);
const adminPassword = process.env.ADMIN_PASSWORD || 'salum-admin-2026';
const tokenTtlMs = 12 * 60 * 60 * 1000;
const activeTokens = new Map();

const defaultContent = {
  heroTitle: 'Computer and digital solutions built with care.',
  heroLead: 'I am Salum Said Sizya, an IT student focused on cybersecurity, web development, programming, graphics design, and mobile app design. I build practical work that is clear, modern, and useful.',
  aboutHeading: 'About Me',
  aboutIntro: 'A short summary of what I study and what I enjoy building.',
  aboutBody1: 'I am an IT student at CBE with a strong interest in cybersecurity, programming, web development, mobile app design, and graphic design. I enjoy understanding how systems work and using that knowledge to build clear, reliable, and user-friendly solutions.',
  aboutBody2: 'I focus on clean structure, professional presentation, and steady improvement. My goal is to deliver work that is practical, easy to understand, and ready for real-world use.',
  email: 'salumsizya8@gmail.com',
  phone: '+255 622 296 685',
  skills: [
    'HTML',
    'CSS',
    'JavaScript',
    'PHP',
    'Python',
    'C',
    'C++',
    'Java',
    'Networking',
    'Linux (Ubuntu)',
    'SQL',
    'Cybersecurity Basics',
    'Web Technologies',
    'Multimedia Systems',
    'Database Management',
    'Graphic Design'
  ],
  projects: [
    {
      label: 'Web',
      title: 'Login Form Project',
      description: 'A responsive login page focused on form layout, validation, and clear visual structure.'
    },
    {
      label: 'Practice',
      title: 'Website Design',
      description: 'Simple website layouts used to improve structure, spacing, readability, and responsive design.'
    },
    {
      label: 'Linux',
      title: 'Linux Commands Practice',
      description: 'Hands-on practice with Ubuntu commands and basic terminal workflows for everyday system tasks.'
    },
    {
      label: 'Data',
      title: 'SQL Database',
      description: 'Database exercises focused on tables, queries, and organizing information in a structured way.'
    },
    {
      label: 'Mobile',
      title: 'Mobile App Design',
      description: 'Early interface concepts for mobile applications with attention to clarity and user flow.'
    }
  ]
};

function trimValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeProject(project, fallback = {}) {
  return {
    label: trimValue(project?.label) || trimValue(fallback.label),
    title: trimValue(project?.title) || trimValue(fallback.title),
    description: trimValue(project?.description) || trimValue(fallback.description)
  };
}

function normalizeContent(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const mergedProjects = defaultContent.projects.map((fallbackProject, index) => normalizeProject(source.projects?.[index], fallbackProject));

  return {
    heroTitle: trimValue(source.heroTitle) || defaultContent.heroTitle,
    heroLead: trimValue(source.heroLead) || defaultContent.heroLead,
    aboutHeading: trimValue(source.aboutHeading) || defaultContent.aboutHeading,
    aboutIntro: trimValue(source.aboutIntro) || defaultContent.aboutIntro,
    aboutBody1: trimValue(source.aboutBody1) || defaultContent.aboutBody1,
    aboutBody2: trimValue(source.aboutBody2) || defaultContent.aboutBody2,
    email: trimValue(source.email) || defaultContent.email,
    phone: trimValue(source.phone) || defaultContent.phone,
    skills: Array.isArray(source.skills)
      ? source.skills.map((skill) => trimValue(skill)).filter(Boolean)
      : defaultContent.skills.slice(),
    projects: mergedProjects
  };
}

async function ensureContentFile() {
  try {
    await fs.access(contentFile);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(contentFile, JSON.stringify(defaultContent, null, 2), 'utf8');
  }
}

async function readContentFile() {
  await ensureContentFile();
  const raw = await fs.readFile(contentFile, 'utf8');

  try {
    return normalizeContent(JSON.parse(raw));
  } catch {
    return normalizeContent(defaultContent);
  }
}

async function writeContentFile(content) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(contentFile, JSON.stringify(normalizeContent(content), null, 2), 'utf8');
}

function issueToken() {
  const token = crypto.randomUUID();
  activeTokens.set(token, Date.now() + tokenTtlMs);
  return token;
}

function requireCmsAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [, token] = authHeader.split(' ');
  const expiresAt = activeTokens.get(token);

  if (!token || !expiresAt) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (expiresAt < Date.now()) {
    activeTokens.delete(token);
    return res.status(401).json({ error: 'Session expired' });
  }

  return next();
}

app.use(express.json({ limit: '250kb' }));
app.use(express.static(rootDir));

app.get('/', (req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/content', async (req, res, next) => {
  try {
    res.json(await readContentFile());
  } catch (error) {
    next(error);
  }
});

app.post('/api/login', async (req, res) => {
  const password = trimValue(req.body?.password);

  if (!password || password !== adminPassword) {
    return res.status(401).json({ error: 'Wrong password' });
  }

  const token = issueToken();
  return res.json({
    token,
    expiresAt: Date.now() + tokenTtlMs
  });
});

app.put('/api/content', requireCmsAuth, async (req, res, next) => {
  try {
    const content = normalizeContent(req.body);
    await writeContentFile(content);
    res.json({ ok: true, content });
  } catch (error) {
    next(error);
  }
});

app.post('/api/reset', requireCmsAuth, async (req, res, next) => {
  try {
    await writeContentFile(defaultContent);
    res.json({ ok: true, content: defaultContent });
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Portfolio backend running on http://localhost:${port}`);
});