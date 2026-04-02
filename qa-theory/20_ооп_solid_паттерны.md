# ООП: принципы, SOLID, паттерны автоматизации

## 4 принципа ООП

### 1. Инкапсуляция

Скрытие внутренней реализации. Доступ к данным только через методы.

```javascript
class User {
  #password; // приватное поле

  constructor(email, password) {
    this.email = email;
    this.#password = this.#hash(password);
  }

  checkPassword(input) {
    return this.#hash(input) === this.#password;
  }

  #hash(str) { /* ... */ }
}

// user.#password → ошибка (нет доступа снаружи)
// user.checkPassword('123') → true/false
```

**Зачем:** защита данных от некорректного изменения, упрощение интерфейса.

### 2. Наследование

Создание нового класса на основе существующего. Потомок получает свойства и методы родителя.

```javascript
class BasePage {
  open(url) { cy.visit(url); }
  getTitle() { return cy.get('h1'); }
}

class LoginPage extends BasePage {
  fillEmail(email) { cy.get('#email').type(email); }
  fillPassword(pwd) { cy.get('#password').type(pwd); }
  submit() { cy.get('button[type=submit]').click(); }
}
```

### 3. Полиморфизм

Одинаковый интерфейс — разное поведение. Один метод работает по-разному в зависимости от объекта.

```javascript
class EmailNotification {
  send(message) { /* отправить email */ }
}

class SlackNotification {
  send(message) { /* отправить в Slack */ }
}

// Один интерфейс — разные реализации
function notify(notifier, message) {
  notifier.send(message); // не важно, email или Slack
}
```

### 4. Абстракция

Выделение значимых характеристик, игнорирование деталей.

```javascript
// Абстрактный класс (в TS)
abstract class TestReporter {
  abstract generate(results): void;
  abstract upload(): void;
}

// Конкретные реализации
class MochawesomeReporter extends TestReporter { /* ... */ }
class AllureReporter extends TestReporter { /* ... */ }
```

---

## SOLID

5 принципов проектирования, которые делают код понятным и поддерживаемым.

### S — Single Responsibility (Единственная ответственность)

Класс должен иметь только одну причину для изменения.

```javascript
// Плохо: LoginPage и умеет логиниться, и генерирует отчёт
class LoginPage {
  login() { /* ... */ }
  generateReport() { /* не его ответственность */ }
}

// Хорошо: каждый класс — одна задача
class LoginPage { login() { /* ... */ } }
class ReportGenerator { generate() { /* ... */ } }
```

### O — Open/Closed (Открыт для расширения, закрыт для изменения)

Новая функциональность добавляется через наследование/композицию, а не редактированием существующего кода.

### L — Liskov Substitution (Подстановка Лисков)

Объекты наследников должны корректно заменять объекты родителей.

### I — Interface Segregation (Разделение интерфейсов)

Много маленьких специализированных интерфейсов лучше, чем один большой.

### D — Dependency Inversion (Инверсия зависимостей)

Модули верхнего уровня не зависят от модулей нижнего уровня. Оба зависят от абстракций.

---

## Паттерны автоматизации тестирования

### Page Object Model (POM)

Самый важный паттерн в UI-автоматизации. Каждая страница = отдельный класс.

```javascript
// pages/LoginPage.js
class LoginPage {
  get emailInput() { return cy.get('#email'); }
  get passwordInput() { return cy.get('#password'); }
  get submitBtn() { return cy.get('button[type=submit]'); }

  login(email, password) {
    this.emailInput.type(email);
    this.passwordInput.type(password);
    this.submitBtn.click();
  }
}

// tests/login.spec.js
const loginPage = new LoginPage();
loginPage.login('user@example.com', 'Passw0rd');
```

**Зачем:** при изменении UI — правим один файл (page), а не все тесты.

### Factory (Фабрика)

Создание тестовых данных через фабрику вместо хардкода.

```javascript
class UserFactory {
  static create(overrides = {}) {
    return {
      email: `user_${Date.now()}@test.com`,
      password: 'Passw0rd',
      name: 'Test User',
      ...overrides,
    };
  }
}

const admin = UserFactory.create({ role: 'admin' });
const user = UserFactory.create({ name: 'Иван' });
```

### Builder (Строитель)

Пошаговое создание сложных объектов.

```javascript
class OrderBuilder {
  constructor() { this.order = { items: [] }; }
  withProduct(id, qty) { this.order.items.push({ product_id: id, quantity: qty }); return this; }
  withAddress(addr) { this.order.address = addr; return this; }
  withPayment(method) { this.order.payment = method; return this; }
  build() { return this.order; }
}

const order = new OrderBuilder()
  .withProduct(42, 2)
  .withAddress('Москва, ул. Тестовая, 1')
  .withPayment('card')
  .build();
```

### Singleton

Один экземпляр на всё приложение (например, конфигурация).

```javascript
class Config {
  static #instance;
  static getInstance() {
    if (!Config.#instance) Config.#instance = new Config();
    return Config.#instance;
  }
}
```

---

## Композиция vs Наследование

Современный подход предпочитает **композицию** — включать объекты как поля, а не строить глубокие деревья наследования.

```javascript
// Наследование (плохо при глубокой иерархии):
class DashboardPage extends PageWithNavigation extends BasePage

// Композиция (гибче):
class DashboardPage {
  constructor() {
    this.nav = new NavigationComponent();
    this.sidebar = new SidebarComponent();
  }
}
```
