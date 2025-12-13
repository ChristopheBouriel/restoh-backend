const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const contactRoutes = require('../../routes/contact');
const newsletterRoutes = require('../../routes/newsletterRoutes');
const errorHandler = require('../../middleware/errorHandler');
const Contact = require('../../models/Contact');
const User = require('../../models/User');
const {
  createTestUser,
  createTestAdmin,
  generateAuthToken,
} = require('../helpers/testHelpers');

// Create test app with both contact and newsletter routes
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/contact', contactRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use(errorHandler);

// Helper to create test contact message
const createTestContact = async (contactData = {}) => {
  const defaultContact = {
    name: contactData.name || 'Test User',
    email: contactData.email || 'testcontact@example.com',
    phone: contactData.phone || '0612345678',
    subject: contactData.subject || 'general',
    message: contactData.message || 'This is a test message',
    status: contactData.status || 'new',
    userId: contactData.userId || null,
    discussion: contactData.discussion || [],
  };

  const contact = await Contact.create(defaultContact);
  return contact;
};

describe('Contact Routes Integration Tests', () => {
  let user;
  let admin;
  let userToken;
  let adminToken;

  beforeEach(async () => {
    user = await createTestUser({ email: 'contactuser@example.com', name: 'Contact User' });
    admin = await createTestAdmin({ email: 'contactadmin@example.com', name: 'Contact Admin' });
    userToken = generateAuthToken(user._id);
    adminToken = generateAuthToken(admin._id);
  });

  describe('POST /api/contact', () => {
    it('should submit contact form successfully (unauthenticated)', async () => {
      const contactData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '0612345678',
        subject: 'general',
        message: 'Hello, I have a question about your restaurant.',
      };

      const res = await request(app)
        .post('/api/contact')
        .send(contactData)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Thank you');
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.submittedAt).toBeDefined();
    });

    it('should submit contact form with authenticated user', async () => {
      const contactData = {
        name: user.name,
        email: user.email,
        subject: 'reservation',
        message: 'Question about reservations.',
      };

      const res = await request(app)
        .post('/api/contact')
        .set('Authorization', `Bearer ${userToken}`)
        .send(contactData)
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify userId was stored
      const contact = await Contact.findById(res.body.data.id);
      expect(contact.userId.toString()).toBe(user._id.toString());
    });

    it('should fail with invalid email', async () => {
      const res = await request(app)
        .post('/api/contact')
        .send({
          name: 'John Doe',
          email: 'invalid-email',
          subject: 'general',
          message: 'Test message',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail with missing required fields', async () => {
      const res = await request(app)
        .post('/api/contact')
        .send({
          name: 'John Doe',
          // missing email, subject, message
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail with subject too short', async () => {
      const res = await request(app)
        .post('/api/contact')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          subject: 'Hi', // Too short (min 5 chars)
          message: 'This is a test message that is long enough.',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/contact/my-messages', () => {
    beforeEach(async () => {
      // Create messages for the user
      await createTestContact({ email: user.email, subject: 'general' });
      await createTestContact({ email: user.email, subject: 'reservation' });
      // Create message for another user
      await createTestContact({ email: 'other@example.com', subject: 'general' });
    });

    it('should get user own messages', async () => {
      const res = await request(app)
        .get('/api/contact/my-messages')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.data.every(m => m.email === user.email)).toBe(true);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/contact/my-messages')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/contact/:id/reply', () => {
    let userContact;

    beforeEach(async () => {
      userContact = await createTestContact({ email: user.email });
    });

    it('should add reply to own contact message', async () => {
      const res = await request(app)
        .patch(`/api/contact/${userContact._id}/reply`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ text: 'Thank you for your response!' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.discussion).toHaveLength(1);
      expect(res.body.data.discussion[0].text).toBe('Thank you for your response!');
      expect(res.body.data.status).toBe('newlyReplied');
    });

    it('should allow admin to reply to any message', async () => {
      const res = await request(app)
        .patch(`/api/contact/${userContact._id}/reply`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ text: 'We will look into this.' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('replied');
    });

    it('should fail to reply to other user message', async () => {
      const otherContact = await createTestContact({ email: 'other@example.com' });

      const res = await request(app)
        .patch(`/api/contact/${otherContact._id}/reply`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ text: 'Trying to reply' })
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should return 404 for non-existent contact', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/contact/${fakeId}/reply`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ text: 'Test reply' })
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/contact/admin/messages', () => {
    beforeEach(async () => {
      await createTestContact({ status: 'new' });
      await createTestContact({ status: 'read' });
      await createTestContact({ status: 'replied' });
    });

    it('should get all messages as admin', async () => {
      const res = await request(app)
        .get('/api/contact/admin/messages')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.count).toBeGreaterThanOrEqual(3);
      expect(res.body.total).toBeGreaterThanOrEqual(3);
    });

    it('should filter messages by status', async () => {
      const res = await request(app)
        .get('/api/contact/admin/messages?status=new')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.every(m => m.status === 'new')).toBe(true);
    });

    it('should paginate messages', async () => {
      const res = await request(app)
        .get('/api/contact/admin/messages?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toBeDefined();
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .get('/api/contact/admin/messages')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/contact/admin/messages/:id/status', () => {
    let contact;

    beforeEach(async () => {
      contact = await createTestContact({ status: 'new' });
    });

    it('should update contact status as admin', async () => {
      const res = await request(app)
        .patch(`/api/contact/admin/messages/${contact._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'read' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('read');
    });

    it('should fail with invalid status', async () => {
      const res = await request(app)
        .patch(`/api/contact/admin/messages/${contact._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'invalid_status' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should return 404 for non-existent contact', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/contact/admin/messages/${fakeId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'read' })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .patch(`/api/contact/admin/messages/${contact._id}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'read' })
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/contact/admin/messages/:id', () => {
    let contact;

    beforeEach(async () => {
      contact = await createTestContact();
    });

    it('should soft delete contact message as admin', async () => {
      const res = await request(app)
        .delete(`/api/contact/admin/messages/${contact._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('archived');

      // Verify soft deletion (document still exists but marked as deleted)
      const deleted = await Contact.findById(contact._id);
      expect(deleted).not.toBeNull();
      expect(deleted.isDeleted).toBe(true);
      expect(deleted.deletedBy.toString()).toBe(admin._id.toString());
      expect(deleted.deletedAt).toBeInstanceOf(Date);
    });

    it('should return 404 for non-existent contact', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/contact/admin/messages/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .delete(`/api/contact/admin/messages/${contact._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should return 404 when trying to delete already deleted contact', async () => {
      // First delete
      await request(app)
        .delete(`/api/contact/admin/messages/${contact._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Try to delete again
      const res = await request(app)
        .delete(`/api/contact/admin/messages/${contact._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/contact/admin/messages/deleted', () => {
    beforeEach(async () => {
      // Create some contacts and soft delete some
      const contact1 = await createTestContact({ subject: 'active1' });
      const contact2 = await createTestContact({ subject: 'deleted1' });
      const contact3 = await createTestContact({ subject: 'deleted2' });

      // Soft delete contact2 and contact3
      await Contact.updateOne(
        { _id: contact2._id },
        { isDeleted: true, deletedBy: admin._id, deletedAt: new Date() }
      );
      await Contact.updateOne(
        { _id: contact3._id },
        { isDeleted: true, deletedBy: admin._id, deletedAt: new Date() }
      );
    });

    it('should get deleted messages as admin', async () => {
      const res = await request(app)
        .get('/api/contact/admin/messages/deleted')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.data.every(m => m.isDeleted === true)).toBe(true);
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .get('/api/contact/admin/messages/deleted')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/contact/admin/messages/:id/restore', () => {
    let deletedContact;

    beforeEach(async () => {
      deletedContact = await createTestContact({ subject: 'to-restore' });
      await Contact.updateOne(
        { _id: deletedContact._id },
        { isDeleted: true, deletedBy: admin._id, deletedAt: new Date() }
      );
    });

    it('should restore deleted message as admin', async () => {
      const res = await request(app)
        .patch(`/api/contact/admin/messages/${deletedContact._id}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('restored');

      // Verify restoration
      const restored = await Contact.findById(deletedContact._id);
      expect(restored.isDeleted).toBe(false);
      expect(restored.deletedBy).toBeNull();
      expect(restored.deletedAt).toBeNull();
    });

    it('should return 404 for non-deleted message', async () => {
      // Create a non-deleted contact
      const activeContact = await createTestContact({ subject: 'active' });

      const res = await request(app)
        .patch(`/api/contact/admin/messages/${activeContact._id}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .patch(`/api/contact/admin/messages/${deletedContact._id}/restore`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('Soft delete excludes from normal queries', () => {
    beforeEach(async () => {
      // Create contacts - one active, one deleted
      await createTestContact({ email: user.email, subject: 'active-user' });
      const deletedContact = await createTestContact({ email: user.email, subject: 'deleted-user' });
      await Contact.updateOne(
        { _id: deletedContact._id },
        { isDeleted: true, deletedBy: admin._id, deletedAt: new Date() }
      );
    });

    it('should not return deleted messages in user messages', async () => {
      const res = await request(app)
        .get('/api/contact/my-messages')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].subject).toBe('active-user');
    });

    it('should not return deleted messages in admin list', async () => {
      const res = await request(app)
        .get('/api/contact/admin/messages')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      // Should only show active messages
      expect(res.body.data.every(m => m.isDeleted === false)).toBe(true);
    });
  });

  describe('PATCH /api/contact/:id/reply - Validation Errors', () => {
    let userContact;

    beforeEach(async () => {
      userContact = await createTestContact({ email: user.email });
    });

    it('should fail with empty text', async () => {
      const res = await request(app)
        .patch(`/api/contact/${userContact._id}/reply`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ text: '' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail with missing text field', async () => {
      const res = await request(app)
        .patch(`/api/contact/${userContact._id}/reply`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/contact/:id/discussion/:discussionId/status', () => {
    let userContact;
    let adminReplyId;
    let userReplyId;

    beforeEach(async () => {
      // Create contact with discussion messages
      userContact = await createTestContact({
        email: user.email,
        status: 'replied',
        discussion: [
          {
            userId: admin._id,
            name: admin.name,
            role: 'admin',
            text: 'Admin reply to user',
            date: new Date(),
            status: 'new'
          },
          {
            userId: user._id,
            name: user.name,
            role: 'user',
            text: 'User follow-up question',
            date: new Date(),
            status: 'new'
          }
        ]
      });

      // Get the IDs of the discussion messages
      const refreshedContact = await Contact.findById(userContact._id);
      adminReplyId = refreshedContact.discussion[0]._id;
      userReplyId = refreshedContact.discussion[1]._id;
    });

    it('should allow user to mark admin message as read', async () => {
      const res = await request(app)
        .patch(`/api/contact/${userContact._id}/discussion/${adminReplyId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'read' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.discussionMessage.status).toBe('read');
    });

    it('should allow admin to mark user message as read', async () => {
      // First set contact status to newlyReplied to test status change
      await Contact.findByIdAndUpdate(userContact._id, { status: 'newlyReplied' });

      const res = await request(app)
        .patch(`/api/contact/${userContact._id}/discussion/${userReplyId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'read' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.discussionMessage.status).toBe('read');
      expect(res.body.data.contactStatus).toBe('read');
    });

    it('should fail when user tries to mark user message as read', async () => {
      const res = await request(app)
        .patch(`/api/contact/${userContact._id}/discussion/${userReplyId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'read' })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('User can only mark admin messages');
    });

    it('should fail when admin tries to mark admin message as read', async () => {
      const res = await request(app)
        .patch(`/api/contact/${userContact._id}/discussion/${adminReplyId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'read' })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Admin can only mark user messages');
    });

    it('should fail with invalid status value', async () => {
      const res = await request(app)
        .patch(`/api/contact/${userContact._id}/discussion/${adminReplyId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'invalid_status' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail for non-existent contact', async () => {
      const fakeContactId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/contact/${fakeContactId}/discussion/${adminReplyId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'read' })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('should fail for non-existent discussion message', async () => {
      const fakeDiscussionId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/contact/${userContact._id}/discussion/${fakeDiscussionId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'read' })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Discussion message not found');
    });

    it('should fail when user tries to access other user contact', async () => {
      const otherContact = await createTestContact({ email: 'other@example.com' });

      const res = await request(app)
        .patch(`/api/contact/${otherContact._id}/discussion/${adminReplyId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'read' })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('only access your own');
    });
  });
});

describe('Newsletter Routes Integration Tests', () => {
  let admin;
  let adminToken;
  let user;
  let userToken;

  beforeEach(async () => {
    admin = await createTestAdmin({ email: 'newsletteradmin@example.com' });
    adminToken = generateAuthToken(admin._id);
    user = await createTestUser({
      email: 'newsletteruser@example.com',
      isEmailVerified: true,
    });
    userToken = generateAuthToken(user._id);
  });

  describe('GET /api/newsletter/stats', () => {
    beforeEach(async () => {
      // Create users with different notification preferences
      await createTestUser({
        email: 'subscriber1@example.com',
        isEmailVerified: true,
        notifications: { newsletter: true, promotions: true },
      });
      await createTestUser({
        email: 'subscriber2@example.com',
        isEmailVerified: true,
        notifications: { newsletter: true, promotions: false },
      });
      await createTestUser({
        email: 'unverified@example.com',
        isEmailVerified: false,
        notifications: { newsletter: true, promotions: true },
      });
    });

    it('should get newsletter stats as admin', async () => {
      const res = await request(app)
        .get('/api/newsletter/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.totalVerifiedUsers).toBeDefined();
      expect(res.body.data.newsletterSubscribers).toBeDefined();
      expect(res.body.data.promotionSubscribers).toBeDefined();
      expect(res.body.data.newsletterOptInRate).toBeDefined();
      expect(res.body.data.promotionOptInRate).toBeDefined();
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .get('/api/newsletter/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/newsletter/stats')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/newsletter/unsubscribe/newsletter/:userId', () => {
    it('should unsubscribe user from newsletter', async () => {
      // Ensure user has newsletter enabled
      await User.findByIdAndUpdate(user._id, { 'notifications.newsletter': true });

      const res = await request(app)
        .get(`/api/newsletter/unsubscribe/newsletter/${user._id}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('unsubscribed');

      // Verify unsubscription
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.notifications.newsletter).toBe(false);
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/newsletter/unsubscribe/newsletter/${fakeId}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/newsletter/unsubscribe/promotions/:userId', () => {
    it('should unsubscribe user from promotions', async () => {
      // Ensure user has promotions enabled
      await User.findByIdAndUpdate(user._id, { 'notifications.promotions': true });

      const res = await request(app)
        .get(`/api/newsletter/unsubscribe/promotions/${user._id}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('unsubscribed');

      // Verify unsubscription
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.notifications.promotions).toBe(false);
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/newsletter/unsubscribe/promotions/${fakeId}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/newsletter/send', () => {
    const emailService = require('../../services/email/emailService');

    beforeEach(async () => {
      // Create subscribers for newsletter
      await createTestUser({
        email: 'newsletter1@example.com',
        isEmailVerified: true,
        isActive: true,
        notifications: { newsletter: true, promotions: false },
      });
      await createTestUser({
        email: 'newsletter2@example.com',
        isEmailVerified: true,
        isActive: true,
        notifications: { newsletter: true, promotions: false },
      });
      // Reset mock
      emailService.sendBulkEmails.mockClear();
      emailService.sendBulkEmails.mockResolvedValue({ success: 2, failed: 0, errors: [] });
    });

    it('should send newsletter to subscribers as admin', async () => {
      const res = await request(app)
        .post('/api/newsletter/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          subject: 'Weekly Newsletter',
          content: 'Here are the latest updates from RestOh!',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Newsletter sent');
      expect(res.body.data.totalSubscribers).toBeGreaterThanOrEqual(2);
      expect(emailService.sendBulkEmails).toHaveBeenCalled();
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .post('/api/newsletter/send')
        .send({
          subject: 'Newsletter',
          content: 'Content',
        })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .post('/api/newsletter/send')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          subject: 'Newsletter',
          content: 'Content',
        })
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should fail with missing subject', async () => {
      const res = await request(app)
        .post('/api/newsletter/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          content: 'Content only',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail with missing content', async () => {
      const res = await request(app)
        .post('/api/newsletter/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          subject: 'Subject only',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/newsletter/promotion', () => {
    const emailService = require('../../services/email/emailService');

    beforeEach(async () => {
      // Create subscribers for promotions
      await createTestUser({
        email: 'promo1@example.com',
        isEmailVerified: true,
        isActive: true,
        notifications: { newsletter: false, promotions: true },
      });
      await createTestUser({
        email: 'promo2@example.com',
        isEmailVerified: true,
        isActive: true,
        notifications: { newsletter: false, promotions: true },
      });
      // Reset mock
      emailService.sendBulkEmails.mockClear();
      emailService.sendBulkEmails.mockResolvedValue({ success: 2, failed: 0, errors: [] });
    });

    it('should send promotion to subscribers as admin', async () => {
      const res = await request(app)
        .post('/api/newsletter/promotion')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          subject: 'Special Offer!',
          promotionContent: '50% off all desserts this weekend!',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Promotion email sent');
      expect(res.body.data.totalSubscribers).toBeGreaterThanOrEqual(2);
      expect(emailService.sendBulkEmails).toHaveBeenCalled();
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .post('/api/newsletter/promotion')
        .send({
          subject: 'Promo',
          promotionContent: 'Content',
        })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should fail as regular user', async () => {
      const res = await request(app)
        .post('/api/newsletter/promotion')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          subject: 'Promo',
          promotionContent: 'Content',
        })
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should fail with missing subject', async () => {
      const res = await request(app)
        .post('/api/newsletter/promotion')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          promotionContent: 'Content only',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should fail with missing promotionContent', async () => {
      const res = await request(app)
        .post('/api/newsletter/promotion')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          subject: 'Subject only',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });
});
