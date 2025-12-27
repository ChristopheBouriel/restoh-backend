const mongoose = require('mongoose');
require('dotenv').config();
const Contact = require('../models/Contact');
const User = require('../models/User');

// Helper to get date relative to today
const getRelativeDate = (daysFromNow) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date;
};

// Contact messages template
const contactsTemplate = [
  // From registered users
  {
    userEmail: 'demo@test.com',
    name: 'Demo User',
    phone: '0655443322',
    subject: 'Complaint - Booking fail',
    message: 'I cannot book!?',
    status: 'replied',
    daysAgo: -15,
    discussion: [
      {
        adminEmail: 'admin@restoh.com',
        text: "We'll immediately check our system and keep you informed",
        hoursAfter: 1
      },
      {
        userEmail: 'demo@test.com',
        text: 'Yes, you should do!',
        hoursAfter: 2
      },
      {
        adminEmail: 'admin@restoh.com',
        text: 'Normally everything is ok now, tell us',
        hoursAfter: 3
      }
    ]
  },
  {
    userEmail: 'kris@gmail.com',
    name: 'Kris',
    phone: '0607087788',
    subject: 'General inquiry - Nothing special',
    message: 'This is a test message to check the contact system.',
    status: 'read',
    daysAgo: -10
  },
  {
    userEmail: 'demo@test.com',
    name: 'Demo User',
    phone: '0655443322',
    subject: 'Complaint - The app is slow',
    message: 'The app is very slow for reservations',
    status: 'new',
    daysAgo: -5
  },
  // From non-registered users
  {
    name: 'Bob',
    email: 'bob@gmail.com',
    subject: 'Reservation - Booking',
    message: 'I would like to book for tomorrow evening at 20h for 6 people',
    status: 'replied',
    daysAgo: -8,
    discussion: [
      {
        adminEmail: 'admin@restoh.com',
        text: 'Sure! Please call us at 04 50 XX XX XX to confirm your booking',
        hoursAfter: 2
      }
    ]
  },
  {
    name: 'Joe',
    email: 'joe@gmail.com',
    subject: 'Compliment - Great experience',
    message: 'Just wanted to say we had an amazing dinner last night. The staff was wonderful!',
    status: 'read',
    daysAgo: -3
  },
  {
    name: 'Guy',
    email: 'guy@gmail.com',
    subject: 'General inquiry - Menu question',
    message: 'Do you have vegan options on your menu?',
    status: 'new',
    daysAgo: -1
  },
  // Today's contacts
  {
    userEmail: 'demo@test.com',
    name: 'Demo User',
    phone: '0655443322',
    subject: 'General inquiry - Reservation Question',
    message: 'I have a question about group reservations for 20 people.',
    status: 'replied',
    daysAgo: 0,
    discussion: [
      {
        adminEmail: 'admin@restoh.com',
        text: 'We can accommodate groups up to 22 people. Please call us to arrange.',
        hoursAfter: 1
      }
    ]
  },
  {
    name: 'Marie',
    email: 'marie@gmail.com',
    subject: 'Job application - Server position',
    message: 'Hello, I am interested in the server position. Where can I send my CV?',
    status: 'new',
    daysAgo: 0
  }
];

async function seedContacts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get users for reference
    const users = await User.find({});
    const userMap = {};
    users.forEach(user => {
      userMap[user.email] = {
        id: user._id,
        name: user.name
      };
    });

    // Clear existing contacts
    await Contact.deleteMany({});
    console.log('🗑️  Cleared existing contacts');

    // Create contacts
    const createdContacts = [];
    for (const contactTemplate of contactsTemplate) {
      const user = contactTemplate.userEmail ? userMap[contactTemplate.userEmail] : null;
      const admin = userMap['admin@restoh.com'];

      const baseDate = getRelativeDate(contactTemplate.daysAgo);

      // Build discussion array if present
      const discussion = [];
      if (contactTemplate.discussion) {
        for (const msg of contactTemplate.discussion) {
          const msgDate = new Date(baseDate);
          msgDate.setHours(msgDate.getHours() + msg.hoursAfter);

          if (msg.adminEmail) {
            const msgAdmin = userMap[msg.adminEmail];
            discussion.push({
              userId: msgAdmin.id,
              name: msgAdmin.name,
              role: 'admin',
              text: msg.text,
              date: msgDate,
              status: 'read'
            });
          } else if (msg.userEmail) {
            const msgUser = userMap[msg.userEmail];
            discussion.push({
              userId: msgUser.id,
              name: msgUser.name,
              role: 'user',
              text: msg.text,
              date: msgDate,
              status: 'read'
            });
          }
        }
      }

      const contactData = {
        userId: user ? user.id : null,
        name: contactTemplate.name,
        email: contactTemplate.userEmail || contactTemplate.email,
        phone: contactTemplate.phone || null,
        subject: contactTemplate.subject,
        message: contactTemplate.message,
        status: contactTemplate.status,
        discussion,
        isDeleted: false,
        deletedBy: null,
        deletedAt: null,
        createdAt: baseDate,
        updatedAt: baseDate
      };

      const contact = await Contact.create(contactData);
      createdContacts.push(contact);
    }

    console.log(`✅ Created ${createdContacts.length} contacts`);

    // Display created contacts
    console.log('\n📋 CREATED CONTACTS:');
    createdContacts.forEach((contact, index) => {
      const replies = contact.discussion.length;
      console.log(`${index + 1}. ${contact.name} - "${contact.subject}" - ${contact.status} - ${replies} replies`);
    });

    await mongoose.connection.close();
    console.log('\n🔒 Database connection closed');

  } catch (error) {
    console.error('❌ Error seeding contacts:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedContacts();
}

module.exports = { seedContacts };
