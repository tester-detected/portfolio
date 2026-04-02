# SQL для тестировщика — Интернет-магазин

Практические SQL-запросы, которые QA-инженер использует в повседневной работе: проверка данных, поиск аномалий, валидация бизнес-логики.

## Схема базы данных

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   users      │     │   products   │     │  categories  │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id           │     │ id           │     │ id           │
│ email        │     │ name         │     │ name         │
│ name         │     │ category_id ─┼────>│              │
│ phone        │     │ price        │     └──────────────┘
│ created_at   │     │ stock        │
│ is_active    │     │ is_active    │
└──────┬───────┘     │ created_at   │
       │             └──────┬───────┘
       │                    │
       v                    v
┌──────────────┐     ┌──────────────┐
│   orders     │     │ order_items  │
├──────────────┤     ├──────────────┤
│ id           │     │ id           │
│ user_id ─────┤     │ order_id ────┤
│ status       │     │ product_id ──┤
│ total_amount │     │ quantity     │
│ created_at   │     │ price        │
│ updated_at   │     └──────────────┘
└──────┬───────┘
       │
       v
┌──────────────┐
│  payments    │
├──────────────┤
│ id           │
│ order_id ────┤
│ amount       │
│ method       │
│ status       │
│ created_at   │
└──────────────┘
```

**Статусы заказа:** `new` → `paid` → `shipped` → `delivered` / `cancelled` / `refunded`  
**Статусы оплаты:** `pending` → `completed` / `failed` / `refunded`  
**Методы оплаты:** `card`, `sbp`, `wallet`

---

## 1. Проверка целостности данных

### Заказы без позиций (битые данные)

```sql
SELECT o.id, o.status, o.total_amount, o.created_at
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE oi.id IS NULL;
```

### Позиции заказа, ссылающиеся на несуществующие товары

```sql
SELECT oi.id, oi.order_id, oi.product_id
FROM order_items oi
LEFT JOIN products p ON p.id = oi.product_id
WHERE p.id IS NULL;
```

### Заказы без оплаты, хотя статус `paid`

```sql
SELECT o.id, o.status, o.total_amount
FROM orders o
LEFT JOIN payments p ON p.order_id = o.id AND p.status = 'completed'
WHERE o.status = 'paid'
  AND p.id IS NULL;
```

### Пользователи без email (нарушение бизнес-правила)

```sql
SELECT id, name, phone, created_at
FROM users
WHERE email IS NULL
   OR TRIM(email) = '';
```

---

## 2. Поиск дубликатов

### Дубликаты email (должен быть уникальным)

```sql
SELECT email, COUNT(*) AS cnt
FROM users
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY cnt DESC;
```

### Дубликаты товаров по названию в одной категории

```sql
SELECT category_id, name, COUNT(*) AS cnt
FROM products
GROUP BY category_id, name
HAVING COUNT(*) > 1;
```

### Двойные оплаты одного заказа

```sql
SELECT order_id, COUNT(*) AS payments_count, SUM(amount) AS total_paid
FROM payments
WHERE status = 'completed'
GROUP BY order_id
HAVING COUNT(*) > 1;
```

---

## 3. Валидация бизнес-логики

### Сумма заказа не совпадает с суммой позиций

```sql
SELECT
    o.id,
    o.total_amount AS order_total,
    SUM(oi.price * oi.quantity) AS calculated_total,
    o.total_amount - SUM(oi.price * oi.quantity) AS difference
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id, o.total_amount
HAVING o.total_amount != SUM(oi.price * oi.quantity);
```

### Оплата не совпадает с суммой заказа

```sql
SELECT
    o.id,
    o.total_amount,
    p.amount AS paid_amount,
    o.total_amount - p.amount AS difference
FROM orders o
JOIN payments p ON p.order_id = o.id AND p.status = 'completed'
WHERE o.total_amount != p.amount;
```

### Заказы с отрицательной или нулевой суммой

```sql
SELECT id, user_id, total_amount, status, created_at
FROM orders
WHERE total_amount <= 0;
```

### Товары с ценой 0 или отрицательной

```sql
SELECT id, name, price, category_id
FROM products
WHERE price <= 0
  AND is_active = true;
```

### Позиции с количеством <= 0

```sql
SELECT oi.id, oi.order_id, oi.product_id, oi.quantity
FROM order_items oi
WHERE oi.quantity <= 0;
```

---

## 4. JOIN-ы: связываем данные из разных таблиц

### Полная информация о заказе (пользователь + товары + оплата)

```sql
SELECT
    o.id AS order_id,
    u.name AS customer,
    u.email,
    o.status AS order_status,
    p.name AS product,
    oi.quantity,
    oi.price,
    pay.method AS payment_method,
    pay.status AS payment_status,
    o.created_at
FROM orders o
JOIN users u ON u.id = o.user_id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
LEFT JOIN payments pay ON pay.order_id = o.id
ORDER BY o.created_at DESC
LIMIT 50;
```

### Товары, которые ни разу не покупали

```sql
SELECT p.id, p.name, p.price, c.name AS category
FROM products p
JOIN categories c ON c.id = p.category_id
LEFT JOIN order_items oi ON oi.product_id = p.id
WHERE oi.id IS NULL
  AND p.is_active = true
ORDER BY p.created_at;
```

### Пользователи, которые зарегистрировались, но не сделали ни одного заказа

```sql
SELECT u.id, u.name, u.email, u.created_at
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE o.id IS NULL
  AND u.is_active = true
ORDER BY u.created_at;
```

---

## 5. Агрегации и аналитика

### Топ-10 товаров по продажам

```sql
SELECT
    p.id,
    p.name,
    SUM(oi.quantity) AS total_sold,
    SUM(oi.price * oi.quantity) AS revenue
FROM order_items oi
JOIN products p ON p.id = oi.product_id
JOIN orders o ON o.id = oi.order_id
WHERE o.status NOT IN ('cancelled', 'refunded')
GROUP BY p.id, p.name
ORDER BY total_sold DESC
LIMIT 10;
```

### Выручка по месяцам

```sql
SELECT
    DATE_TRUNC('month', o.created_at) AS month,
    COUNT(DISTINCT o.id) AS orders_count,
    COUNT(DISTINCT o.user_id) AS unique_customers,
    SUM(o.total_amount) AS revenue
FROM orders o
WHERE o.status NOT IN ('cancelled', 'refunded')
GROUP BY DATE_TRUNC('month', o.created_at)
ORDER BY month DESC;
```

### Средний чек по методу оплаты

```sql
SELECT
    p.method,
    COUNT(*) AS payments_count,
    ROUND(AVG(p.amount), 2) AS avg_amount,
    MIN(p.amount) AS min_amount,
    MAX(p.amount) AS max_amount
FROM payments p
WHERE p.status = 'completed'
GROUP BY p.method
ORDER BY avg_amount DESC;
```

### Распределение заказов по статусам

```sql
SELECT
    status,
    COUNT(*) AS cnt,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS percentage
FROM orders
GROUP BY status
ORDER BY cnt DESC;
```

---

## 6. Подзапросы и оконные функции

### Пользователи, потратившие больше среднего

```sql
SELECT
    u.id,
    u.name,
    u.email,
    user_totals.total_spent
FROM users u
JOIN (
    SELECT user_id, SUM(total_amount) AS total_spent
    FROM orders
    WHERE status NOT IN ('cancelled', 'refunded')
    GROUP BY user_id
) user_totals ON user_totals.user_id = u.id
WHERE user_totals.total_spent > (
    SELECT AVG(total_spent)
    FROM (
        SELECT SUM(total_amount) AS total_spent
        FROM orders
        WHERE status NOT IN ('cancelled', 'refunded')
        GROUP BY user_id
    ) avg_calc
)
ORDER BY user_totals.total_spent DESC;
```

### Последний заказ каждого пользователя (оконная функция)

```sql
SELECT *
FROM (
    SELECT
        u.name,
        u.email,
        o.id AS order_id,
        o.status,
        o.total_amount,
        o.created_at,
        ROW_NUMBER() OVER (PARTITION BY u.id ORDER BY o.created_at DESC) AS rn
    FROM users u
    JOIN orders o ON o.user_id = u.id
) ranked
WHERE rn = 1
ORDER BY created_at DESC;
```

### Нарастающий итог выручки по дням

```sql
SELECT
    DATE(created_at) AS day,
    SUM(total_amount) AS daily_revenue,
    SUM(SUM(total_amount)) OVER (ORDER BY DATE(created_at)) AS cumulative_revenue
FROM orders
WHERE status NOT IN ('cancelled', 'refunded')
GROUP BY DATE(created_at)
ORDER BY day;
```

---

## 7. Проверки после тестирования фич

### После теста «Оформление заказа»: проверяем, что заказ создался корректно

```sql
-- Подставляем email тестового пользователя
SELECT
    o.id,
    o.status,
    o.total_amount,
    o.created_at,
    COUNT(oi.id) AS items_count,
    SUM(oi.price * oi.quantity) AS items_total
FROM orders o
JOIN users u ON u.id = o.user_id
JOIN order_items oi ON oi.order_id = o.id
WHERE u.email = 'testuser@example.com'
  AND o.created_at > NOW() - INTERVAL '1 hour'
GROUP BY o.id, o.status, o.total_amount, o.created_at
ORDER BY o.created_at DESC;
```

### После теста «Отмена заказа»: проверяем возврат на склад

```sql
SELECT
    p.id,
    p.name,
    p.stock,
    oi.quantity AS ordered_qty,
    o.status
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
WHERE o.id = :order_id
  AND o.status = 'cancelled';
-- stock должен увеличиться на ordered_qty после отмены
```

### После теста «Регистрация»: проверяем нового пользователя в БД

```sql
SELECT id, email, name, phone, is_active, created_at
FROM users
WHERE email = 'newuser@example.com'
  AND created_at > NOW() - INTERVAL '5 minutes';
```

### Очистка тестовых данных после прогона

```sql
-- Удаляем в правильном порядке (FK constraints)
DELETE FROM payments WHERE order_id IN (
    SELECT id FROM orders WHERE user_id IN (
        SELECT id FROM users WHERE email LIKE '%@testdata.qa'
    )
);

DELETE FROM order_items WHERE order_id IN (
    SELECT id FROM orders WHERE user_id IN (
        SELECT id FROM users WHERE email LIKE '%@testdata.qa'
    )
);

DELETE FROM orders WHERE user_id IN (
    SELECT id FROM users WHERE email LIKE '%@testdata.qa'
);

DELETE FROM users WHERE email LIKE '%@testdata.qa';
```
