# Contact Messages API

## Overview

The Contact API allows users to submit contact forms and administrators to manage contact messages. Messages support a discussion thread system and soft delete with restore capability.

## Endpoints

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/contact` | Public | Submit contact form |
| GET | `/api/contact/my-messages` | User | Get own messages |
| PATCH | `/api/contact/:id/reply` | User/Admin | Add reply to discussion |
| PATCH | `/api/contact/:id/discussion/:discussionId/status` | User/Admin | Mark message as read |
| GET | `/api/contact/admin/messages` | Admin | Get all messages |
| GET | `/api/contact/admin/messages/deleted` | Admin | Get archived messages |
| PATCH | `/api/contact/admin/messages/:id/status` | Admin | Update message status |
| PATCH | `/api/contact/admin/messages/:id/restore` | Admin | Restore archived message |
| DELETE | `/api/contact/admin/messages/:id` | Admin | Archive message (soft delete) |

---

## Data Models

### Contact Message

```typescript
interface ContactMessage {
  id: string;
  userId: string | null;        // Set if user was authenticated
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied' | 'newlyReplied' | 'closed';
  discussion: DiscussionMessage[];
  isDeleted: boolean;
  deletedBy: string | null;     // Admin user ID who deleted
  deletedAt: string | null;     // ISO date string
  createdAt: string;
  updatedAt: string;
}

interface DiscussionMessage {
  id: string;
  userId: string;
  name: string;
  role: 'admin' | 'user';
  text: string;
  date: string;
  status: 'new' | 'read';
}
```

### Status Flow

```
new → read → replied → newlyReplied → read → ...
                  ↘ closed
```

| Status | Description |
|--------|-------------|
| `new` | Just submitted, not yet read by admin |
| `read` | Admin has read the message |
| `replied` | Admin has replied |
| `newlyReplied` | User has replied, awaiting admin response |
| `closed` | Conversation closed |

---

## Public Endpoints

### Submit Contact Form

```http
POST /api/contact
```

**Rate Limit**: 3 requests/hour (production), 30 requests/hour (development)

**Request Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "0612345678",      // Optional
  "subject": "general",
  "message": "I have a question about your restaurant..."
}
```

**Validation**:
- `name`: Required, max 100 chars
- `email`: Required, valid email format
- `phone`: Optional, max 20 chars
- `subject`: Required, min 3 chars, max 200 chars
- `message`: Required, max 1000 chars

**Response** (200):
```json
{
  "success": true,
  "message": "Thank you for your message! We will get back to you soon.",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "submittedAt": "2025-12-13T10:30:00.000Z"
  }
}
```

**Note**: If user is authenticated (sends Bearer token), the `userId` is automatically captured.

---

## User Endpoints

### Get My Messages

```http
GET /api/contact/my-messages
Authorization: Bearer <token>
```

Returns all contact messages submitted by the authenticated user (matched by email).

**Response** (200):
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "subject": "general",
      "message": "My question...",
      "status": "replied",
      "discussion": [...],
      "isDeleted": false,
      "createdAt": "2025-12-13T10:30:00.000Z",
      "updatedAt": "2025-12-13T11:00:00.000Z"
    }
  ]
}
```

### Add Reply to Discussion

```http
PATCH /api/contact/:id/reply
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "text": "Thank you for your response..."
}
```

**Validation**:
- `text`: Required, max 1000 chars

**Permissions**:
- Users can only reply to their own messages (matched by email)
- Admins can reply to any message

**Response** (200):
```json
{
  "success": true,
  "message": "Reply added successfully",
  "data": {
    "discussion": [...],
    "status": "newlyReplied"  // or "replied" if admin
  }
}
```

### Mark Discussion Message as Read

```http
PATCH /api/contact/:id/discussion/:discussionId/status
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "status": "read"
}
```

**Permissions**:
- Users can only mark admin messages as read
- Admins can only mark user messages as read

**Response** (200):
```json
{
  "success": true,
  "message": "Discussion message marked as read",
  "data": {
    "discussionMessage": {...},
    "contactStatus": "read"
  }
}
```

---

## Admin Endpoints

### Get All Messages

```http
GET /api/contact/admin/messages
Authorization: Bearer <admin_token>
```

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Items per page |
| `status` | string | - | Filter by status |

**Example**:
```http
GET /api/contact/admin/messages?status=new&page=1&limit=20
```

**Response** (200):
```json
{
  "success": true,
  "count": 5,
  "total": 25,
  "pagination": {
    "next": { "page": 2, "limit": 20 },
    "prev": null
  },
  "data": [...]
}
```

**Note**: Soft-deleted messages are NOT included. Use `/admin/messages/deleted` to view them.

### Get Archived (Deleted) Messages

```http
GET /api/contact/admin/messages/deleted
Authorization: Bearer <admin_token>
```

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Items per page |

**Response** (200):
```json
{
  "success": true,
  "count": 2,
  "total": 2,
  "pagination": {},
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "subject": "spam",
      "message": "...",
      "status": "new",
      "isDeleted": true,
      "deletedBy": {
        "id": "507f1f77bcf86cd799439099",
        "firstName": "Admin",
        "lastName": "User",
        "email": "admin@restoh.com"
      },
      "deletedAt": "2025-12-13T14:00:00.000Z",
      "createdAt": "2025-12-13T10:30:00.000Z"
    }
  ]
}
```

### Update Message Status

```http
PATCH /api/contact/admin/messages/:id/status
Authorization: Bearer <admin_token>
```

**Request Body**:
```json
{
  "status": "read"
}
```

**Valid statuses**: `new`, `read`, `replied`, `newlyReplied`, `closed`

**Response** (200):
```json
{
  "success": true,
  "message": "Contact message status updated successfully",
  "data": {...}
}
```

### Archive (Soft Delete) Message

```http
DELETE /api/contact/admin/messages/:id
Authorization: Bearer <admin_token>
```

**Response** (200):
```json
{
  "success": true,
  "message": "Contact message archived successfully"
}
```

**Note**: This is a soft delete. The message is marked as deleted but retained in the database with audit information (who deleted, when). Use the restore endpoint to recover.

### Restore Archived Message

```http
PATCH /api/contact/admin/messages/:id/restore
Authorization: Bearer <admin_token>
```

**Response** (200):
```json
{
  "success": true,
  "message": "Contact message restored successfully",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "isDeleted": false,
    "deletedBy": null,
    "deletedAt": null,
    ...
  }
}
```

---

## TypeScript Interfaces

```typescript
// Request types
interface SubmitContactRequest {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

interface ReplyRequest {
  text: string;
}

interface UpdateStatusRequest {
  status: 'new' | 'read' | 'replied' | 'newlyReplied' | 'closed';
}

interface MarkReadRequest {
  status: 'read';
}

// Response types
interface ContactMessage {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: ContactStatus;
  discussion: DiscussionMessage[];
  isDeleted: boolean;
  deletedBy: string | DeletedByUser | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DeletedByUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface DiscussionMessage {
  id: string;
  userId: string;
  name: string;
  role: 'admin' | 'user';
  text: string;
  date: string;
  status: 'new' | 'read';
}

type ContactStatus = 'new' | 'read' | 'replied' | 'newlyReplied' | 'closed';

interface PaginatedResponse<T> {
  success: boolean;
  count: number;
  total: number;
  pagination: {
    next?: { page: number; limit: number };
    prev?: { page: number; limit: number };
  };
  data: T[];
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  code?: string;
}
```

---

## React Examples

### Submit Contact Form

```tsx
const submitContactForm = async (formData: SubmitContactRequest): Promise<void> => {
  const response = await fetch('/api/contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Include token if user is logged in (optional)
      ...(token && { 'Authorization': `Bearer ${token}` })
    },
    body: JSON.stringify(formData)
  });

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 429) {
      throw new Error('Too many requests. Please try again later.');
    }
    throw new Error(error.error || 'Failed to submit form');
  }

  return response.json();
};
```

### Admin: Fetch Messages with Zustand

```typescript
interface ContactStore {
  messages: ContactMessage[];
  deletedMessages: ContactMessage[];
  isLoading: boolean;
  total: number;

  fetchMessages: (page?: number, status?: string) => Promise<void>;
  fetchDeletedMessages: (page?: number) => Promise<void>;
  archiveMessage: (id: string) => Promise<void>;
  restoreMessage: (id: string) => Promise<void>;
}

const useContactStore = create<ContactStore>((set, get) => ({
  messages: [],
  deletedMessages: [],
  isLoading: false,
  total: 0,

  fetchMessages: async (page = 1, status) => {
    set({ isLoading: true });
    const token = useAuthStore.getState().token;

    const params = new URLSearchParams({ page: String(page) });
    if (status) params.append('status', status);

    const response = await fetch(`/api/contact/admin/messages?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    set({
      messages: data.data,
      total: data.total,
      isLoading: false
    });
  },

  fetchDeletedMessages: async (page = 1) => {
    set({ isLoading: true });
    const token = useAuthStore.getState().token;

    const response = await fetch(`/api/contact/admin/messages/deleted?page=${page}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    set({ deletedMessages: data.data, isLoading: false });
  },

  archiveMessage: async (id: string) => {
    const token = useAuthStore.getState().token;

    await fetch(`/api/contact/admin/messages/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    // Refresh messages
    get().fetchMessages();
  },

  restoreMessage: async (id: string) => {
    const token = useAuthStore.getState().token;

    await fetch(`/api/contact/admin/messages/${id}/restore`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    // Refresh both lists
    get().fetchMessages();
    get().fetchDeletedMessages();
  }
}));
```

### Admin Messages Component

```tsx
const AdminContactMessages: React.FC = () => {
  const { messages, deletedMessages, isLoading, fetchMessages, fetchDeletedMessages, archiveMessage, restoreMessage } = useContactStore();
  const [showDeleted, setShowDeleted] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    if (showDeleted) {
      fetchDeletedMessages();
    } else {
      fetchMessages(1, statusFilter || undefined);
    }
  }, [showDeleted, statusFilter]);

  const displayMessages = showDeleted ? deletedMessages : messages;

  return (
    <div>
      <div className="flex gap-4 mb-4">
        <button
          onClick={() => setShowDeleted(false)}
          className={!showDeleted ? 'font-bold' : ''}
        >
          Active Messages
        </button>
        <button
          onClick={() => setShowDeleted(true)}
          className={showDeleted ? 'font-bold' : ''}
        >
          Archived
        </button>
      </div>

      {!showDeleted && (
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="read">Read</option>
          <option value="replied">Replied</option>
          <option value="newlyReplied">Awaiting Response</option>
          <option value="closed">Closed</option>
        </select>
      )}

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <ul>
          {displayMessages.map((msg) => (
            <li key={msg.id} className="border p-4 mb-2">
              <div className="flex justify-between">
                <div>
                  <strong>{msg.name}</strong> ({msg.email})
                  <span className={`badge badge-${msg.status}`}>{msg.status}</span>
                </div>
                <div>
                  {msg.isDeleted ? (
                    <button onClick={() => restoreMessage(msg.id)}>
                      Restore
                    </button>
                  ) : (
                    <button onClick={() => archiveMessage(msg.id)}>
                      Archive
                    </button>
                  )}
                </div>
              </div>
              <p>{msg.subject}</p>
              <p className="text-gray-600">{msg.message}</p>
              {msg.isDeleted && msg.deletedBy && (
                <p className="text-sm text-red-500">
                  Archived by {typeof msg.deletedBy === 'object' ? msg.deletedBy.firstName : 'Admin'}
                  on {new Date(msg.deletedAt!).toLocaleDateString()}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
```

---

## Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid input data |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `MESSAGE_NOT_FOUND` | Contact message not found |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |

**Error Response Format**:
```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE"
}
```
