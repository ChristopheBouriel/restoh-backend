# Dashboard Statistics API

## Overview

The `GET /api/admin/stats` endpoint provides comprehensive statistics for the admin dashboard. It aggregates data from orders, reservations, and menu items to give a complete view of restaurant performance.

## Endpoint

```
GET /api/admin/stats
```

**Authentication**: Required (Admin only)

**Headers**:
```
Authorization: Bearer <admin_token>
```

## Response Structure

```json
{
  "success": true,
  "data": {
    "totalMenuItems": 15,
    "activeMenuItems": 12,
    "inactiveMenuItems": 3,
    "orders": {
      "thisMonth": {
        "total": 45,
        "revenue": 1250.00,
        "pickup": 30,
        "delivery": 15
      },
      "lastMonth": {
        "total": 52,
        "revenue": 1480.00,
        "pickup": 35,
        "delivery": 17
      },
      "today": {
        "total": 5,
        "revenue": 125.00,
        "pickup": 3,
        "delivery": 2
      },
      "sameDayLastWeek": {
        "total": 4,
        "revenue": 110.00,
        "pickup": 2,
        "delivery": 2
      }
    },
    "reservations": {
      "thisMonth": {
        "total": 28,
        "totalGuests": 84
      },
      "lastMonth": {
        "total": 32,
        "totalGuests": 96
      },
      "today": {
        "total": 3,
        "totalGuests": 10
      },
      "sameDayLastWeek": {
        "total": 2,
        "totalGuests": 6
      }
    },
    "revenue": {
      "thisMonth": 1250.00,
      "lastMonth": 1480.00,
      "today": 125.00,
      "sameDayLastWeek": 110.00
    }
  }
}
```

## Data Fields Explanation

### Menu Statistics

| Field | Type | Description |
|-------|------|-------------|
| `totalMenuItems` | number | Total number of menu items in the database |
| `activeMenuItems` | number | Number of menu items with `isAvailable: true` |
| `inactiveMenuItems` | number | Number of menu items with `isAvailable: false` |

### Orders Statistics

Each time period (`thisMonth`, `lastMonth`, `today`, `sameDayLastWeek`) contains:

| Field | Type | Description |
|-------|------|-------------|
| `total` | number | Total number of orders (excluding cancelled) |
| `revenue` | number | Sum of `totalPrice` for all orders (in the currency used) |
| `pickup` | number | Number of orders with `orderType: 'pickup'` |
| `delivery` | number | Number of orders with `orderType: 'delivery'` |

**Note**: Orders with `status: 'cancelled'` are excluded from all statistics.

### Reservations Statistics

Each time period (`thisMonth`, `lastMonth`, `today`, `sameDayLastWeek`) contains:

| Field | Type | Description |
|-------|------|-------------|
| `total` | number | Total number of reservations |
| `totalGuests` | number | Sum of all guests across reservations |

**Note**: Reservations with `status: 'cancelled'` or `status: 'no-show'` are excluded from all statistics.

### Revenue Statistics

| Field | Type | Description |
|-------|------|-------------|
| `thisMonth` | number | Total revenue from orders this month |
| `lastMonth` | number | Total revenue from orders last month |
| `today` | number | Total revenue from orders today |
| `sameDayLastWeek` | number | Total revenue from same day last week |

**Note**: This is a convenience duplicate of `orders.*.revenue` for easier access.

## Time Period Definitions

| Period | Definition |
|--------|------------|
| `thisMonth` | From the 1st day of the current month at 00:00:00 until now |
| `lastMonth` | From the 1st day of the previous month at 00:00:00 to the last day of the previous month at 23:59:59 |
| `today` | From today at 00:00:00 to today at 23:59:59 |
| `sameDayLastWeek` | The same day of the week, 7 days ago (00:00:00 to 23:59:59) |

### Example Date Calculations

If today is **Thursday, December 12, 2024**:

- `thisMonth`: December 1, 2024 00:00:00 → December 12, 2024 23:59:59
- `lastMonth`: November 1, 2024 00:00:00 → November 30, 2024 23:59:59
- `today`: December 12, 2024 00:00:00 → December 12, 2024 23:59:59
- `sameDayLastWeek`: December 5, 2024 00:00:00 → December 5, 2024 23:59:59 (previous Thursday)

## Frontend Integration Examples

### React/TypeScript Interface

```typescript
interface OrderStats {
  total: number;
  revenue: number;
  pickup: number;
  delivery: number;
}

interface ReservationStats {
  total: number;
  totalGuests: number;
}

interface DashboardStats {
  totalMenuItems: number;
  activeMenuItems: number;
  inactiveMenuItems: number;
  orders: {
    thisMonth: OrderStats;
    lastMonth: OrderStats;
    today: OrderStats;
    sameDayLastWeek: OrderStats;
  };
  reservations: {
    thisMonth: ReservationStats;
    lastMonth: ReservationStats;
    today: ReservationStats;
    sameDayLastWeek: ReservationStats;
  };
  revenue: {
    thisMonth: number;
    lastMonth: number;
    today: number;
    sameDayLastWeek: number;
  };
}

interface ApiResponse {
  success: boolean;
  data: DashboardStats;
}
```

### Fetch Example

```typescript
const fetchDashboardStats = async (token: string): Promise<DashboardStats> => {
  const response = await fetch('/api/admin/stats', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch dashboard stats');
  }

  const data: ApiResponse = await response.json();
  return data.data;
};
```

### Using with React Query

```typescript
import { useQuery } from '@tanstack/react-query';

const useDashboardStats = () => {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => fetchDashboardStats(token),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });
};
```

### Zustand Store Integration

```typescript
interface DashboardStore {
  stats: DashboardStats | null;
  isLoading: boolean;
  error: string | null;
  fetchStats: () => Promise<void>;
}

const useDashboardStore = create<DashboardStore>((set, get) => ({
  stats: null,
  isLoading: false,
  error: null,

  fetchStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch('/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        set({ stats: data.data, isLoading: false });
      } else {
        set({ error: 'Failed to load stats', isLoading: false });
      }
    } catch (error) {
      set({ error: 'Network error', isLoading: false });
    }
  }
}));
```

## UI Component Examples

### Stats Card Component

```tsx
interface StatsCardProps {
  title: string;
  current: number;
  previous: number;
  format?: 'number' | 'currency';
}

const StatsCard: React.FC<StatsCardProps> = ({ title, current, previous, format = 'number' }) => {
  const percentChange = previous > 0
    ? ((current - previous) / previous * 100).toFixed(1)
    : current > 0 ? '100' : '0';

  const isPositive = current >= previous;

  const formatValue = (value: number) => {
    if (format === 'currency') {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR'
      }).format(value);
    }
    return value.toLocaleString('fr-FR');
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
      <p className="text-3xl font-bold mt-2">{formatValue(current)}</p>
      <div className={`flex items-center mt-2 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <ArrowUpIcon /> : <ArrowDownIcon />}
        <span className="text-sm ml-1">{percentChange}% vs last period</span>
      </div>
    </div>
  );
};
```

### Dashboard Grid Example

```tsx
const DashboardStats: React.FC = () => {
  const { stats, isLoading } = useDashboardStore();

  if (isLoading) return <LoadingSpinner />;
  if (!stats) return <EmptyState />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Orders Today vs Same Day Last Week */}
      <StatsCard
        title="Orders Today"
        current={stats.orders.today.total}
        previous={stats.orders.sameDayLastWeek.total}
      />

      {/* Revenue Today */}
      <StatsCard
        title="Revenue Today"
        current={stats.revenue.today}
        previous={stats.revenue.sameDayLastWeek}
        format="currency"
      />

      {/* Reservations Today */}
      <StatsCard
        title="Reservations Today"
        current={stats.reservations.today.total}
        previous={stats.reservations.sameDayLastWeek.total}
      />

      {/* Guests Today */}
      <StatsCard
        title="Guests Today"
        current={stats.reservations.today.totalGuests}
        previous={stats.reservations.sameDayLastWeek.totalGuests}
      />

      {/* Monthly Summary */}
      <div className="col-span-full">
        <h2 className="text-xl font-bold mb-4">Monthly Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard
            title="Orders This Month"
            current={stats.orders.thisMonth.total}
            previous={stats.orders.lastMonth.total}
          />
          <StatsCard
            title="Revenue This Month"
            current={stats.revenue.thisMonth}
            previous={stats.revenue.lastMonth}
            format="currency"
          />
          <StatsCard
            title="Guests This Month"
            current={stats.reservations.thisMonth.totalGuests}
            previous={stats.reservations.lastMonth.totalGuests}
          />
        </div>
      </div>

      {/* Order Type Breakdown */}
      <div className="col-span-full bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Order Types This Month</h3>
        <div className="flex gap-8">
          <div>
            <span className="text-gray-500">Pickup</span>
            <p className="text-2xl font-bold">{stats.orders.thisMonth.pickup}</p>
          </div>
          <div>
            <span className="text-gray-500">Delivery</span>
            <p className="text-2xl font-bold">{stats.orders.thisMonth.delivery}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
```

## Comparison Calculations

### Week-over-Week Change

```typescript
const calculateWoWChange = (stats: DashboardStats) => {
  const todayOrders = stats.orders.today.total;
  const lastWeekOrders = stats.orders.sameDayLastWeek.total;

  if (lastWeekOrders === 0) {
    return todayOrders > 0 ? 100 : 0;
  }

  return ((todayOrders - lastWeekOrders) / lastWeekOrders) * 100;
};
```

### Month-over-Month Change

```typescript
const calculateMoMChange = (stats: DashboardStats) => {
  const thisMonthRevenue = stats.revenue.thisMonth;
  const lastMonthRevenue = stats.revenue.lastMonth;

  if (lastMonthRevenue === 0) {
    return thisMonthRevenue > 0 ? 100 : 0;
  }

  return ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
};
```

### Average Order Value

```typescript
const calculateAverageOrderValue = (orderStats: OrderStats): number => {
  if (orderStats.total === 0) return 0;
  return orderStats.revenue / orderStats.total;
};

// Usage
const avgOrderToday = calculateAverageOrderValue(stats.orders.today);
const avgOrderThisMonth = calculateAverageOrderValue(stats.orders.thisMonth);
```

### Average Guests per Reservation

```typescript
const calculateAvgGuestsPerReservation = (reservationStats: ReservationStats): number => {
  if (reservationStats.total === 0) return 0;
  return reservationStats.totalGuests / reservationStats.total;
};
```

## Error Handling

### HTTP Status Codes

| Status | Description |
|--------|-------------|
| 200 | Success |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - User is not an admin |
| 500 | Internal Server Error |

### Error Response Format

```json
{
  "success": false,
  "error": "Error message here",
  "code": "ERROR_CODE"
}
```

### Frontend Error Handling

```typescript
const fetchDashboardStats = async (token: string) => {
  try {
    const response = await fetch('/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status === 401) {
      // Token expired, redirect to login
      window.location.href = '/login';
      return null;
    }

    if (response.status === 403) {
      // Not an admin
      throw new Error('Access denied. Admin privileges required.');
    }

    if (!response.ok) {
      throw new Error('Failed to fetch dashboard statistics');
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Dashboard stats error:', error);
    throw error;
  }
};
```

## Performance Considerations

1. **Caching**: Consider caching the stats on the frontend for 5 minutes since the data doesn't change frequently.

2. **Polling**: If you need real-time updates, poll every 5-10 minutes rather than continuously.

3. **Backend Optimization**: The backend uses MongoDB aggregation pipelines with parallel execution for optimal performance.

## Migration from Previous API

If you were using the previous stats endpoint that returned `totalCategories`, `categories`, and `cuisines`, note that these fields have been removed. The new response structure focuses on actionable business metrics.

**Old fields removed**:
- `totalCategories`
- `totalCuisines`
- `categories` (array)
- `cuisines` (array)

**New fields added**:
- `orders` (with time period breakdowns)
- `reservations` (with time period breakdowns)
- `revenue` (convenience summary)
