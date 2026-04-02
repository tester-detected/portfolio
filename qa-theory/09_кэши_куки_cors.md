# Кэширование, куки, CORS

## Кэширование

**Кэш** — промежуточное хранилище данных для ускорения повторного доступа. Вместо повторного запроса к источнику берём данные из кэша.

### Виды кэшей

| Вид | Где хранится | Пример |
|-----|-------------|--------|
| **Кэш браузера** | На устройстве пользователя | Картинки, CSS, JS-файлы. Управляется заголовками `Cache-Control`, `ETag`, `Expires` |
| **Кэш CDN** | На серверах CDN (Cloudflare, Akamai) | Статические файлы, раздаваемые из ближайшего узла |
| **Серверный кэш** | В памяти сервера (Redis, Memcached) | Результаты тяжёлых SQL-запросов, сессии пользователей |
| **Кэш DNS** | На устройстве / у провайдера | Соответствие доменного имени → IP-адреса |
| **Кэш прокси** | На прокси-сервере | Корпоративные прокси кэшируют трафик для экономии канала |
| **Кэш приложения** | В коде (in-memory) | Словари, справочники, конфиги, загруженные при старте |

### Заголовки HTTP для управления кэшем

```
Cache-Control: max-age=3600        # Кэшировать 1 час
Cache-Control: no-cache            # Кэшировать, но перепроверять актуальность
Cache-Control: no-store            # Вообще не кэшировать (для чувствительных данных)

ETag: "abc123"                     # Хэш содержимого — сервер сравнивает при повторном запросе
If-None-Match: "abc123"            # Браузер отправляет: «у меня версия abc123, она актуальна?»
                                   # Если да → 304 Not Modified (без тела), иначе → 200 + новые данные

Expires: Thu, 01 Jan 2027 00:00:00 GMT   # Устаревший способ (вытеснен Cache-Control)
```

### Что тестировщику проверять

- После обновления контента пользователь видит новую версию (кэш инвалидируется)
- Чувствительные данные (токены, персональные данные) имеют `Cache-Control: no-store`
- CDN-кэш очищается при деплое новой версии
- `ETag` корректно обновляется при изменении ресурса

---

## Куки (Cookies)

**Cookie** — небольшой фрагмент данных, который сервер отправляет браузеру. Браузер сохраняет его и отправляет обратно с каждым последующим запросом к этому серверу.

### Для чего используются

- Авторизация (session ID)
- Персонализация (язык, тема)
- Аналитика (отслеживание пользователей)

### Ограничения куки

| Параметр | Ограничение |
|----------|-------------|
| Размер одной куки | **4 КБ** (4096 байт) |
| Количество на домен | **~50 кук** (зависит от браузера, обычно 50-180) |
| Общий объём на домен | **~80 КБ** |
| Кроссдоменные | Куки привязаны к домену, чужой домен их не видит |

### Атрибуты куки

```
Set-Cookie: session_id=abc123; 
  Domain=.example.com;          # Для какого домена (включая поддомены)
  Path=/;                       # Для каких путей
  Expires=Thu, 01 Jan 2027;     # Когда истекает (или Max-Age=3600)
  Secure;                       # Передавать только по HTTPS
  HttpOnly;                     # Недоступна из JavaScript (защита от XSS)
  SameSite=Strict;              # Защита от CSRF: 
                                #   Strict — только с того же сайта
                                #   Lax — + переходы по ссылкам
                                #   None — отовсюду (требует Secure)
```

### Session cookie vs Persistent cookie

| | Session | Persistent |
|---|---|---|
| Срок жизни | До закрытия браузера | До `Expires` / `Max-Age` |
| Хранение | Только в памяти | На диске |
| Пример | Корзина в магазине | «Запомнить меня» |

### Что тестировщику проверять

- `HttpOnly` на сессионных куки (нельзя украсть через XSS)
- `Secure` на куки с токенами (не летят по HTTP)
- `SameSite` выставлен (защита от CSRF)
- Куки удаляются при логауте
- Приложение работает при отключённых куках (graceful degradation)
- Куки не содержат чувствительных данных в открытом виде

---

## CORS (Cross-Origin Resource Sharing)

**CORS** — механизм безопасности, который контролирует, может ли веб-страница с одного домена делать запросы к другому домену.

### Зачем нужен

Браузер по умолчанию блокирует запросы между разными origins (Same-Origin Policy). CORS позволяет серверу явно разрешить кроссдоменные запросы.

### Что такое Origin

```
https://example.com:443/page
└─схема─┘└──домен──┘└порт┘

Origin = схема + домен + порт
```

Два URL имеют одинаковый origin, только если **все три** части совпадают.

| URL A | URL B | Один origin? |
|-------|-------|:---:|
| `https://example.com` | `https://example.com/page` | Да |
| `https://example.com` | `http://example.com` | Нет (схема) |
| `https://example.com` | `https://api.example.com` | Нет (домен) |
| `https://example.com` | `https://example.com:8080` | Нет (порт) |

### Как работает CORS

**Простой запрос** (GET, POST с `Content-Type: text/plain`):
```
Браузер → GET https://api.shop.com/products
         Origin: https://shop.com

Сервер  ← 200 OK
         Access-Control-Allow-Origin: https://shop.com
         
Браузер: Origin совпадает с Allow-Origin → показываем данные
```

**Preflight-запрос** (PUT, DELETE, или POST с `Content-Type: application/json`):
```
1. Браузер → OPTIONS https://api.shop.com/products    (preflight)
              Origin: https://shop.com
              Access-Control-Request-Method: POST
              Access-Control-Request-Headers: Content-Type, Authorization

2. Сервер  ← 204 No Content
              Access-Control-Allow-Origin: https://shop.com
              Access-Control-Allow-Methods: GET, POST, PUT, DELETE
              Access-Control-Allow-Headers: Content-Type, Authorization
              Access-Control-Max-Age: 86400

3. Браузер → POST https://api.shop.com/products       (реальный запрос)

4. Сервер  ← 201 Created
```

### Основные заголовки CORS

| Заголовок | Назначение |
|-----------|-----------|
| `Access-Control-Allow-Origin` | Какие origins разрешены (`https://shop.com` или `*`) |
| `Access-Control-Allow-Methods` | Какие HTTP-методы разрешены |
| `Access-Control-Allow-Headers` | Какие заголовки разрешены |
| `Access-Control-Allow-Credentials` | Разрешить отправку куки (`true` / не указан) |
| `Access-Control-Max-Age` | Сколько секунд кэшировать preflight |

### Типичные ошибки CORS

```
Access to XMLHttpRequest at 'https://api.shop.com' 
from origin 'https://shop.com' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Причины:** Сервер не возвращает заголовок `Access-Control-Allow-Origin`, или возвращает неверный origin.

### Что тестировщику проверять

- `Access-Control-Allow-Origin` — **не `*`** на продакшене с авторизацией
- При `Allow-Credentials: true` нельзя использовать `Allow-Origin: *` (браузер заблокирует)
- Preflight (OPTIONS) возвращает правильные методы и заголовки
- API недоступен с неавторизованных доменов
- Ошибки CORS — смотреть в DevTools → Console и Network
