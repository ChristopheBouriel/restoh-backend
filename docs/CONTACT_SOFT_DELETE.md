# Contact Messages - Soft Delete (Nouveautés)

## Changements

Le DELETE sur les messages contact fait maintenant un **soft delete** (archivage) au lieu d'une suppression définitive.

## Nouveaux champs dans ContactMessage

```typescript
interface ContactMessage {
  // ... champs existants ...

  // Nouveaux champs soft delete
  isDeleted: boolean;           // false par défaut
  deletedBy: string | null;     // ID admin qui a supprimé
  deletedAt: string | null;     // Date ISO de suppression
}
```

## Nouveaux endpoints Admin

### Voir les messages archivés

```http
GET /api/contact/admin/messages/deleted
Authorization: Bearer <admin_token>
```

Query params: `page`, `limit` (pagination standard)

Réponse: Liste des messages avec `isDeleted: true`, inclut `deletedBy` populé avec `firstName`, `lastName`, `email`.

### Restaurer un message archivé

```http
PATCH /api/contact/admin/messages/:id/restore
Authorization: Bearer <admin_token>
```

Réponse:
```json
{
  "success": true,
  "message": "Contact message restored successfully",
  "data": { /* message avec isDeleted: false */ }
}
```

## Comportement modifié

### DELETE (archivage)

```http
DELETE /api/contact/admin/messages/:id
```

- **Avant**: Suppression définitive
- **Maintenant**: Soft delete (archive)

Réponse:
```json
{
  "success": true,
  "message": "Contact message archived successfully"
}
```

Le message reste en base avec:
- `isDeleted: true`
- `deletedBy: <admin_id>`
- `deletedAt: <date>`

### Requêtes existantes

Tous les endpoints existants (`GET /admin/messages`, `GET /my-messages`, etc.) excluent automatiquement les messages archivés. Aucune modification côté front nécessaire.

## Intégration Admin Dashboard

```tsx
// Exemple bouton archive/restore
{message.isDeleted ? (
  <button onClick={() => restoreMessage(message.id)}>
    Restaurer
  </button>
) : (
  <button onClick={() => archiveMessage(message.id)}>
    Archiver
  </button>
)}

// Affichage info suppression
{message.isDeleted && message.deletedBy && (
  <span className="text-red-500 text-sm">
    Archivé par {message.deletedBy.firstName} le {new Date(message.deletedAt).toLocaleDateString('fr-FR')}
  </span>
)}
```

## Zustand store (ajouts)

```typescript
// Nouvelles actions à ajouter
fetchDeletedMessages: async () => {
  const res = await fetch('/api/contact/admin/messages/deleted', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  set({ deletedMessages: data.data });
},

restoreMessage: async (id: string) => {
  await fetch(`/api/contact/admin/messages/${id}/restore`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` }
  });
  // Refresh les deux listes
  get().fetchMessages();
  get().fetchDeletedMessages();
}
```
