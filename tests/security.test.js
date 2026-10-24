const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const User = require('../models/User');
const Portfolio = require('../models/Portfolio');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { createApp } = require('../index.js');

const app = createApp();

const originalUserFind = User.find;
const originalPortfolioFind = Portfolio.find;
const originalPortfolioCountDocuments = Portfolio.countDocuments;

const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMzQ1Njc4OTAiLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJpYXQiOjE3MDAwMDAwMDB9.signature';

function buildAuthHeader(role = 'admin') {
  const payload = { id: '6a3fccae145eec7c529b1df1', role, iat: Math.floor(Date.now() / 1000) };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const signature = 'test-signature';
  return `Bearer ${header}.${encoded}.${signature}`;
}

test.beforeEach(() => {
  User.find = () => ({
    select: () => ({
      sort: () => ({
        lean: async () => [
          {
            _id: 'mentor-1',
            slug: 'alice-johnson',
            fullName: 'Alice Johnson',
            designation: 'Senior Mentor',
            company: 'deepScode',
            bio: 'Experienced mentor',
            photoUrl: 'https://example.com/photo.jpg',
            expertise: ['JavaScript', 'Node.js'],
            linkedinUrl: 'https://linkedin.com/in/alice',
            instagramUrl: 'https://instagram.com/alice',
            rating: 4.8,
            studentsCount: 42,
            isActive: true,
            createdAt: new Date('2024-01-01T00:00:00Z'),
            email: 'alice@example.com',
            phone: '+1234567890',
            password: 'hashed-secret',
          },
        ],
      }),
    }),
  });

  Portfolio.find = () => ({
    select: () => ({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            lean: async () => [
              {
                _id: 'portfolio-1',
                title: 'Portfolio project',
                slug: 'portfolio-project',
                description: 'Visible project description',
                category: 'Web Dev',
                courseTitle: 'Full Stack Bootcamp',
                studentName: 'Alice',
                thumbnail: 'https://example.com/thumb.jpg',
                gallery: ['https://example.com/1.jpg'],
                technologies: ['Node.js'],
                tags: ['backend'],
                githubUrl: 'https://github.com/alice',
                liveUrl: 'https://example.com',
                figmaUrl: '',
                behanceUrl: '',
                videoUrl: '',
                driveUrl: '',
                featured: true,
                publishedAt: new Date('2024-02-01T00:00:00Z'),
                createdAt: new Date('2024-02-01T00:00:00Z'),
                studentEmail: 'alice@example.com',
                studentPhoto: 'https://example.com/student.jpg',
                adminRemarks: 'internal note',
              },
            ],
          }),
        }),
      }),
    }),
  });

  Portfolio.countDocuments = async () => 1;
});

test.afterEach(() => {
  User.find = originalUserFind;
  Portfolio.find = originalPortfolioFind;
  Portfolio.countDocuments = originalPortfolioCountDocuments;
});

test('GET /api/inquiries should reject unauthenticated requests', async () => {
  const response = await request(app).get('/api/inquiries');
  assert.equal(response.status, 401);
});

test('GET /api/mentors should not return private user fields publicly', async () => {
  const response = await request(app).get('/api/mentors');
  assert.equal(response.status, 200);
  if (response.body?.data && response.body.data.length) {
    const mentor = response.body.data[0];
    assert.ok(!('email' in mentor));
    assert.ok(!('phone' in mentor));
    assert.ok(!('password' in mentor));
  }
});

test('GET /api/portfolio should not expose private student fields publicly', async () => {
  const response = await request(app).get('/api/portfolio');
  assert.equal(response.status, 200);
  const rows = response.body?.portfolios || response.body?.data || [];
  if (rows.length) {
    const item = rows[0];
    assert.ok(!('studentEmail' in item));
    assert.ok(!('studentPhoto' in item));
  }
});

test('GET /api/leads should reject unauthenticated requests', async () => {
  const response = await request(app).get('/api/leads');
  assert.equal(response.status, 401);
});
