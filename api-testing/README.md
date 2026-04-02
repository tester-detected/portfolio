# API Testing — Интернет-магазин

Примеры тестирования REST API интернет-магазина: авторизация, CRUD-операции, валидация, негативные сценарии, проверки безопасности.

## Базовые сведения

| Параметр | Значение |
|----------|----------|
| Base URL | `https://api.shop.example.com/v1` |
| Авторизация | Bearer token (JWT) |
| Формат | JSON |
| Коды ответов | 200, 201, 204, 400, 401, 403, 404, 409, 422, 500 |

### Получение токена

```
POST /auth/login
Content-Type: application/json

{
  "email": "testuser@example.com",
  "password": "Passw0rd"
}
```

**Ответ 200:**
```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "dGVzdHJlZn...",
  "expires_in": 3600
}
```

---

## 1. Авторизация

### 1.1 Успешный логин

```
POST /auth/login

{
  "email": "testuser@example.com",
  "password": "Passw0rd"
}
```

**Проверки:**
- Статус `200`
- Тело содержит `access_token`, `refresh_token`, `expires_in`
- `access_token` — валидный JWT (3 части, разделённые точкой)
- `expires_in` > 0

### 1.2 Неверный пароль

```
POST /auth/login

{
  "email": "testuser@example.com",
  "password": "wrong"
}
```

**Проверки:**
- Статус `401`
- Сообщение не раскрывает, что именно неверно (email или пароль)
- Тело **не содержит** `access_token`

### 1.3 Несуществующий email

```
POST /auth/login

{
  "email": "nobody@example.com",
  "password": "Passw0rd"
}
```

**Проверки:**
- Статус `401`
- Тот же текст ошибки, что и при неверном пароле (чтобы не раскрывать существование аккаунта)

### 1.4 Пустое тело запроса

```
POST /auth/login

{}
```

**Проверки:**
- Статус `422`
- Ошибки валидации для обоих полей

### 1.5 Обновление токена

```
POST /auth/refresh

{
  "refresh_token": "dGVzdHJlZn..."
}
```

**Проверки:**
- Статус `200`
- Новый `access_token` отличается от старого
- Старый `access_token` больше не работает (опционально)

### 1.6 Запрос без токена

```
GET /products
Authorization: (отсутствует)
```

**Проверки:**
- Статус `401`
- Сообщение: `Unauthorized` или аналогичное

### 1.7 Запрос с истёкшим токеном

```
GET /products
Authorization: Bearer expired.token.here
```

**Проверки:**
- Статус `401`
- Сообщение указывает на истечение токена

---

## 2. Товары (Products)

### 2.1 Получение списка товаров

```
GET /products?page=1&per_page=20&category_id=3&sort=price_asc
Authorization: Bearer {{token}}
```

**Проверки:**
- Статус `200`
- Тело содержит массив `items` и объект `pagination`
- `pagination.total` >= 0
- `pagination.page` = 1
- `pagination.per_page` = 20
- Все товары имеют `category_id` = 3
- Цены отсортированы по возрастанию
- Каждый товар содержит: `id`, `name`, `price`, `stock`, `category_id`, `is_active`

### 2.2 Получение товара по ID

```
GET /products/42
Authorization: Bearer {{token}}
```

**Проверки:**
- Статус `200`
- `id` = 42
- Все обязательные поля присутствуют
- `price` > 0
- `stock` >= 0

### 2.3 Несуществующий товар

```
GET /products/999999
Authorization: Bearer {{token}}
```

**Проверки:**
- Статус `404`
- Корректное сообщение об ошибке

### 2.4 Создание товара

```
POST /products
Authorization: Bearer {{admin_token}}
Content-Type: application/json

{
  "name": "Тестовый товар",
  "price": 1500.00,
  "stock": 100,
  "category_id": 3,
  "description": "Описание тестового товара"
}
```

**Проверки:**
- Статус `201`
- Ответ содержит `id` созданного товара
- `GET /products/{{id}}` возвращает созданный товар с теми же данными

### 2.5 Создание товара — валидация

```
POST /products
Authorization: Bearer {{admin_token}}

{
  "name": "",
  "price": -100,
  "stock": -5,
  "category_id": 999999
}
```

**Проверки:**
- Статус `422`
- Ошибки валидации для каждого поля:
  - `name` — обязательное
  - `price` — должен быть > 0
  - `stock` — должен быть >= 0
  - `category_id` — категория не существует

### 2.6 Обновление товара

```
PUT /products/{{product_id}}
Authorization: Bearer {{admin_token}}

{
  "price": 2000.00
}
```

**Проверки:**
- Статус `200`
- `price` = 2000.00
- Остальные поля не изменились

### 2.7 Удаление товара

```
DELETE /products/{{product_id}}
Authorization: Bearer {{admin_token}}
```

**Проверки:**
- Статус `204`
- Повторный `GET /products/{{product_id}}` → `404`
- Повторный `DELETE /products/{{product_id}}` → `404` (идемпотентность)

### 2.8 Создание товара без прав администратора

```
POST /products
Authorization: Bearer {{user_token}}

{
  "name": "Хакерский товар",
  "price": 1.00,
  "stock": 1,
  "category_id": 1
}
```

**Проверки:**
- Статус `403`
- Товар **не создан**

---

## 3. Заказы (Orders)

### 3.1 Создание заказа

```
POST /orders
Authorization: Bearer {{token}}

{
  "items": [
    { "product_id": 42, "quantity": 2 },
    { "product_id": 15, "quantity": 1 }
  ]
}
```

**Проверки:**
- Статус `201`
- `status` = `new`
- `total_amount` = сумма (цена * количество) по всем позициям
- `items` содержит 2 позиции с правильными `product_id` и `quantity`
- Остаток товара на складе уменьшился

### 3.2 Заказ товара с недостаточным остатком

```
POST /orders
Authorization: Bearer {{token}}

{
  "items": [
    { "product_id": 42, "quantity": 999999 }
  ]
}
```

**Проверки:**
- Статус `422`
- Сообщение указывает на недостаток товара
- Остаток на складе не изменился

### 3.3 Заказ несуществующего товара

```
POST /orders
Authorization: Bearer {{token}}

{
  "items": [
    { "product_id": 999999, "quantity": 1 }
  ]
}
```

**Проверки:**
- Статус `404` или `422`
- Заказ не создан

### 3.4 Пустой заказ

```
POST /orders
Authorization: Bearer {{token}}

{
  "items": []
}
```

**Проверки:**
- Статус `422`
- Ошибка: минимум одна позиция

### 3.5 Отмена заказа

```
PATCH /orders/{{order_id}}/cancel
Authorization: Bearer {{token}}
```

**Проверки:**
- Статус `200`
- `status` = `cancelled`
- Остаток товара вернулся на склад
- Повторная отмена → `409` (конфликт) или `422`

### 3.6 Отмена чужого заказа

```
PATCH /orders/{{other_user_order_id}}/cancel
Authorization: Bearer {{token}}
```

**Проверки:**
- Статус `403`
- Заказ не отменён

### 3.7 Отмена доставленного заказа

```
PATCH /orders/{{delivered_order_id}}/cancel
Authorization: Bearer {{token}}
```

**Проверки:**
- Статус `422`
- Сообщение: нельзя отменить доставленный заказ
- Статус заказа не изменился

### 3.8 Получение своих заказов

```
GET /orders?page=1&per_page=10
Authorization: Bearer {{token}}
```

**Проверки:**
- Статус `200`
- Все заказы принадлежат текущему пользователю
- Ни один чужой заказ не возвращается
- Пагинация работает корректно

---

## 4. Оплата (Payments)

### 4.1 Оплата заказа

```
POST /orders/{{order_id}}/pay
Authorization: Bearer {{token}}

{
  "method": "card",
  "card_token": "tok_test_visa_4242"
}
```

**Проверки:**
- Статус `200`
- Статус оплаты = `completed`
- Статус заказа изменился на `paid`
- `amount` = `total_amount` заказа

### 4.2 Повторная оплата уже оплаченного заказа

```
POST /orders/{{paid_order_id}}/pay
Authorization: Bearer {{token}}

{
  "method": "card",
  "card_token": "tok_test_visa_4242"
}
```

**Проверки:**
- Статус `409`
- Деньги не списаны повторно

### 4.3 Оплата с невалидным методом

```
POST /orders/{{order_id}}/pay
Authorization: Bearer {{token}}

{
  "method": "bitcoin"
}
```

**Проверки:**
- Статус `422`
- Допустимые методы: `card`, `sbp`, `wallet`

---

## 5. Негативные и граничные сценарии

### 5.1 SQL-инъекция

```
GET /products?category_id=1;DROP TABLE products;--
Authorization: Bearer {{token}}
```

**Проверки:**
- Статус `400` или `422` (не `500`)
- Таблица `products` существует и работает

### 5.2 XSS в названии товара

```
POST /products
Authorization: Bearer {{admin_token}}

{
  "name": "<script>alert('xss')</script>",
  "price": 100,
  "stock": 10,
  "category_id": 1
}
```

**Проверки:**
- При `GET` HTML-теги экранированы или удалены

### 5.3 Очень длинная строка

```
POST /products
Authorization: Bearer {{admin_token}}

{
  "name": "А".repeat(10000),
  "price": 100,
  "stock": 10,
  "category_id": 1
}
```

**Проверки:**
- Статус `422` — превышена длина
- Сервер не падает

### 5.4 Неверный Content-Type

```
POST /auth/login
Content-Type: text/plain

email=test@example.com&password=Passw0rd
```

**Проверки:**
- Статус `415` (Unsupported Media Type) или `400`

### 5.5 Большой payload

```
POST /orders
Authorization: Bearer {{token}}

{
  "items": [ ... 10000 позиций ... ]
}
```

**Проверки:**
- Статус `413` или `422`
- Сервер не зависает

### 5.6 Параллельные запросы (race condition)

Два одновременных запроса на покупку последнего товара на складе (`stock` = 1):

```
POST /orders  { "items": [{ "product_id": 42, "quantity": 1 }] }  — Пользователь A
POST /orders  { "items": [{ "product_id": 42, "quantity": 1 }] }  — Пользователь B
```

**Проверки:**
- Только один заказ создан успешно
- Второй получает ошибку
- `stock` не уходит в минус

---

## 6. Проверки заголовков и метаданных

| Что проверяем | Ожидание |
|---------------|----------|
| `Content-Type` ответа | `application/json` |
| `X-Request-Id` | Уникальный ID в каждом ответе (для отладки) |
| `Cache-Control` | `no-store` для эндпоинтов с данными пользователя |
| CORS (`Access-Control-Allow-Origin`) | Только разрешённые домены, не `*` |
| Время ответа | < 500ms для простых запросов, < 2s для списков |
| Rate limiting (`429 Too Many Requests`) | Срабатывает при превышении лимита |
| `Strict-Transport-Security` | Присутствует (HTTPS only) |
| Чувствительные данные | Пароли, токены карт **не возвращаются** в ответах |

---

## Файлы

| Файл | Описание |
|------|----------|
| [README.md](README.md) | Документация — эндпоинты, проверки, сценарии |
| [shop-api.postman_collection.json](shop-api.postman_collection.json) | Postman-коллекция с тестами |

Коллекцию можно импортировать в Postman: **Import → File → shop-api.postman_collection.json**
