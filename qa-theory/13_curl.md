# curl — утилита для работы с HTTP

**curl** (Client URL) — консольная утилита для отправки HTTP-запросов. Предустановлена в Linux/macOS, в Windows доступна из Git Bash или PowerShell.

## Базовые команды

### GET-запрос

```bash
# Простой GET
curl https://api.example.com/products

# С заголовками ответа
curl -i https://api.example.com/products

# Только заголовки (без тела)
curl -I https://api.example.com/products

# С подробным выводом (запрос + ответ)
curl -v https://api.example.com/products
```

### POST-запрос

```bash
# Отправка JSON
curl -X POST https://api.example.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "Passw0rd"}'

# Отправка формы
curl -X POST https://example.com/login \
  -d "email=user@example.com&password=Passw0rd"
```

### PUT, PATCH, DELETE

```bash
# PUT — полное обновление
curl -X PUT https://api.example.com/products/42 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbG..." \
  -d '{"name": "Новое имя", "price": 2000}'

# PATCH — частичное обновление
curl -X PATCH https://api.example.com/products/42 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbG..." \
  -d '{"price": 2500}'

# DELETE
curl -X DELETE https://api.example.com/products/42 \
  -H "Authorization: Bearer eyJhbG..."
```

## Полезные флаги

| Флаг | Назначение | Пример |
|------|-----------|--------|
| `-X` | HTTP-метод | `-X POST` |
| `-H` | Добавить заголовок | `-H "Authorization: Bearer ..."` |
| `-d` | Тело запроса (data) | `-d '{"key": "value"}'` |
| `-i` | Показать заголовки ответа | `curl -i url` |
| `-I` | Только заголовки (HEAD) | `curl -I url` |
| `-v` | Verbose (всё: запрос + ответ) | `curl -v url` |
| `-s` | Silent (без прогресс-бара) | `curl -s url` |
| `-o` | Сохранить в файл | `curl -o file.json url` |
| `-L` | Следовать редиректам | `curl -L url` |
| `-k` | Игнорировать ошибки SSL | `curl -k https://self-signed.example.com` |
| `-u` | Basic Auth | `curl -u user:password url` |
| `-w` | Формат вывода | `curl -w "%{http_code}" -s -o /dev/null url` |

## Практические примеры

### Проверить статус-код

```bash
curl -s -o /dev/null -w "%{http_code}" https://example.com
# Выведет: 200
```

### Замерить время ответа

```bash
curl -s -o /dev/null -w "DNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" https://example.com
```

### Скачать файл

```bash
curl -O https://example.com/report.pdf
# или с другим именем:
curl -o my_report.pdf https://example.com/report.pdf
```

### Авторизоваться и использовать токен

```bash
# 1. Получить токен
TOKEN=$(curl -s -X POST https://api.example.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "Passw0rd"}' \
  | jq -r '.access_token')

# 2. Использовать токен
curl -H "Authorization: Bearer $TOKEN" https://api.example.com/products
```

## curl vs Postman

| | curl | Postman |
|---|---|---|
| Интерфейс | Командная строка | GUI |
| Автоматизация | Легко встраивается в скрипты и CI/CD | Через Newman (CLI) |
| Коллекции | Нет | Да, с переменными и тестами |
| Скорость | Мгновенный запуск | Нужно открыть приложение |
| Когда использовать | Быстрая проверка, скрипты, CI | Разработка и отладка API |
