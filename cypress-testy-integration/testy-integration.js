/**
 * Testy Integration for Cypress
 *
 * Скрипт для отправки результатов Cypress-тестов в Testy TMS.
 *
 * Два режима работы:
 *
 * A) Автоматический (без --plan / --plan-id):
 *    Создаёт/переиспользует план "Cypress Автотесты", добавляет ВСЕ кейсы,
 *    загружает все найденные результаты.
 *
 * B) Ручной тест-план (--plan "Имя" или --plan-id N):
 *    Берёт СУЩЕСТВУЮЩИЙ план (созданный вручную в Testy UI),
 *    загружает результаты ТОЛЬКО для кейсов из этого плана.
 *
 * Использование:
 *   node testy-integration.js                          # Режим A: всё в "Cypress Автотесты"
 *   node testy-integration.js --plan "Регресс v2.5"    # Режим B: только кейсы из плана
 *   node testy-integration.js --plan-id 5              # Режим B: план по ID
 *   node testy-integration.js --plan "Имя" --dry-run   # Показать маппинг, не загружать
 *   node testy-integration.js --list                   # Список всех тест-планов
 *   node testy-integration.js --setup                  # Только создать план (режим A)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// ===================== КОНФИГУРАЦИЯ =====================

const CONFIG = {
  testy: {
    hostname: process.env.TESTY_HOST || 'your-server-ip',
    port: parseInt(process.env.TESTY_PORT, 10) || 8080,
    projectId: 1,
    // Логин/пароль — можно переопределить через переменные окружения
    username: process.env.TESTY_USERNAME || 'testuser',
    password: process.env.TESTY_PASSWORD || 'testpassword',
  },
  // Имя тест-плана по умолчанию
  defaultPlanName: 'Cypress Автотесты',
  // Директория с mochawesome-отчётами
  reportsDir: path.join(__dirname, 'cypress', 'reports'),
  // Файл с кэшированным маппингом (code → test ID)
  mappingFile: path.join(__dirname, 'testy-mapping.json'),
  // Статусы Testy
  statuses: { FAILED: 1, PASSED: 2, SKIPPED: 3 },
  // Regex для извлечения кодов тест-кейсов из названий describe/it блоков
  codePattern: /\b([A-Z]+_\d+(?:-\d+)?)\b/g,
};

// ===================== HTTP-КЛИЕНТ =====================

function httpRequest(method, reqPath, data, token) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const headers = { 'Accept': 'application/json' };
    if (body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request({
      hostname: CONFIG.testy.hostname,
      port: CONFIG.testy.port,
      path: reqPath,
      method,
      headers,
    }, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} ${method} ${reqPath}: ${responseBody}`));
          } else {
            resolve(parsed);
          }
        } catch {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} ${method} ${reqPath}: ${responseBody}`));
          } else {
            resolve(responseBody);
          }
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getAllPages(basePath, token) {
  let all = [];
  let page = 1;
  while (true) {
    const sep = basePath.includes('?') ? '&' : '?';
    const data = await httpRequest('GET', `${basePath}${sep}page=${page}&page_size=100`, null, token);
    all = all.concat(data.results || []);
    if (!data.links?.next) break;
    page++;
  }
  return all;
}

// ===================== TESTY API =====================

async function getToken() {
  const data = await httpRequest('POST', '/api/token/', {
    username: CONFIG.testy.username,
    password: CONFIG.testy.password,
  });
  return data.access;
}

async function fetchAllCases(token) {
  return getAllPages(`/api/v2/cases/?project=${CONFIG.testy.projectId}`, token);
}

async function fetchTestPlans(token) {
  return getAllPages(`/api/v2/testplans/?project=${CONFIG.testy.projectId}`, token);
}

async function fetchTestsForPlan(token, planId) {
  return getAllPages(`/api/v2/testplans/${planId}/tests/`, token);
}

async function createTestPlan(token, name, caseIds) {
  const now = new Date();
  const dueDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // +1 год
  return httpRequest('POST', '/api/v2/testplans/', {
    name,
    project: CONFIG.testy.projectId,
    started_at: now.toISOString(),
    due_date: dueDate.toISOString(),
    test_cases: caseIds,
    description: 'Автоматически создан скриптом интеграции Cypress ↔ Testy',
  }, token);
}

async function createTest(token, caseId, planId) {
  return httpRequest('POST', '/api/v2/tests/', {
    project: CONFIG.testy.projectId,
    case: caseId,
    plan: planId,
  }, token);
}

async function postResult(token, testId, statusId, executionTime = 0, comment = '') {
  return httpRequest('POST', '/api/v2/results/', {
    test: testId,
    status: statusId,
    execution_time: Math.round(executionTime),
    comment,
  }, token);
}

// ===================== МАППИНГ КЕЙСОВ =====================

/**
 * Строит маппинг: код кейса → { caseId, name, suite }
 * При дубликатах кодов берёт кейс с нормальным именем (не "Кейс 177...")
 */
function buildCodeToCaseMap(cases) {
  const codeMap = {};

  for (const c of cases) {
    const code = (c.attributes?.['Уникальный идентификатор тест-кейса'] || '').trim();
    if (!code || code === '.' || code.endsWith('_')) continue; // Пропускаем мусорные коды

    if (!codeMap[code]) {
      codeMap[code] = { caseId: c.id, name: c.name, suite: c.suite.name };
    } else {
      // При дубликатах предпочитаем кейс с нормальным именем
      const existingIsJunk = codeMap[code].name.startsWith('Кейс 177');
      const newIsJunk = c.name.startsWith('Кейс 177');
      if (existingIsJunk && !newIsJunk) {
        codeMap[code] = { caseId: c.id, name: c.name, suite: c.suite.name };
      }
    }
  }

  return codeMap;
}

// ===================== ПАРСИНГ MOCHAWESOME =====================

/**
 * Извлекает коды тест-кейсов из названия describe/it блока
 * Примеры:
 *   "AU_001 Получаем список событий аудита" → ["AU_001"]
 *   "AU_002 AU_021 Тестируем фильтры" → ["AU_002", "AU_021"]
 *   "REP_128-1 Добавляем диаграмму" → ["REP_128-1"]
 *   "Начало" → []
 */
function extractCodes(title) {
  const codes = [];
  let match;
  const regex = new RegExp(CONFIG.codePattern.source, CONFIG.codePattern.flags);
  while ((match = regex.exec(title)) !== null) {
    codes.push(match[1]);
  }
  return codes;
}

/**
 * Рекурсивно обходит mochawesome-отчёт и собирает результаты по кодам.
 * Возвращает Map: code → { passed: boolean, duration: number, comment: string }
 */
function extractResultsFromReport(report) {
  const results = new Map();

  function processSuite(suite) {
    const suiteCodes = extractCodes(suite.title || '');
    const suiteTests = suite.tests || [];

    // Если describe-блок содержит коды, агрегируем результат по всем it-блокам внутри
    if (suiteCodes.length > 0) {
      const allPassed = suiteTests.every(t => t.pass);
      const totalDuration = suiteTests.reduce((sum, t) => sum + (t.duration || 0), 0);
      const failedTests = suiteTests.filter(t => t.fail);
      const comment = failedTests.length > 0
        ? `FAILED: ${failedTests.map(t => t.title + (t.err?.message ? ' — ' + t.err.message : '')).join('; ')}`
        : `OK (${suiteTests.length} тестов)`;

      for (const code of suiteCodes) {
        // Не перезаписываем, если уже есть fail (fail побеждает)
        const existing = results.get(code);
        if (!existing || (existing.passed && !allPassed)) {
          results.set(code, { passed: allPassed, duration: totalDuration, comment });
        }
      }
    }

    // Проверяем it-блоки на наличие собственных кодов
    for (const test of suiteTests) {
      const testCodes = extractCodes(test.title || '');
      for (const code of testCodes) {
        if (suiteCodes.includes(code)) continue; // Уже учтён на уровне describe
        const existing = results.get(code);
        if (!existing || (existing.passed && test.fail)) {
          results.set(code, {
            passed: test.pass,
            duration: test.duration || 0,
            comment: test.fail
              ? `FAILED: ${test.title}${test.err?.message ? ' — ' + test.err.message : ''}`
              : `OK: ${test.title}`,
          });
        }
      }
    }

    // Рекурсия по вложенным suite
    for (const child of (suite.suites || [])) {
      processSuite(child);
    }
  }

  // Mochawesome структура: results[].suites[]
  for (const result of (report.results || [])) {
    for (const suite of (result.suites || [])) {
      processSuite(suite);
    }
  }

  return results;
}

/**
 * Читает все mochawesome JSON-файлы из директории отчётов
 */
function readMochawesomeReports() {
  if (!fs.existsSync(CONFIG.reportsDir)) {
    console.log('  Директория отчётов не найдена:', CONFIG.reportsDir);
    return new Map();
  }

  const files = fs.readdirSync(CONFIG.reportsDir)
    .filter(f => f.endsWith('.json'))
    .sort((a, b) => {
      const statA = fs.statSync(path.join(CONFIG.reportsDir, a));
      const statB = fs.statSync(path.join(CONFIG.reportsDir, b));
      return statB.mtime.getTime() - statA.mtime.getTime();
    });

  if (files.length === 0) {
    console.log('  Нет JSON-файлов в', CONFIG.reportsDir);
    return new Map();
  }

  console.log(`  Найдено ${files.length} файл(ов) отчётов`);

  const allResults = new Map();

  for (const file of files) {
    try {
      const report = JSON.parse(fs.readFileSync(path.join(CONFIG.reportsDir, file), 'utf8'));
      const results = extractResultsFromReport(report);
      for (const [code, result] of results) {
        const existing = allResults.get(code);
        if (!existing || (existing.passed && !result.passed)) {
          allResults.set(code, result);
        }
      }
    } catch (e) {
      console.log(`  Ошибка чтения ${file}: ${e.message}`);
    }
  }

  return allResults;
}

// ===================== ГЛАВНАЯ ЛОГИКА =====================

async function ensureTestPlan(token, planName, caseIds) {
  // Ищем существующий план с таким именем
  const plans = await fetchTestPlans(token);
  let plan = plans.find(p => p.name === planName);

  if (plan) {
    console.log(`  Найден тест-план: "${plan.name}" (ID=${plan.id})`);
    // Получаем существующие тесты
    const existingTests = await fetchTestsForPlan(token, plan.id);
    const existingCaseIds = new Set(existingTests.map(t => t.case));

    // Добавляем отсутствующие тесты
    const missingCaseIds = caseIds.filter(id => !existingCaseIds.has(id));
    if (missingCaseIds.length > 0) {
      console.log(`  Добавляем ${missingCaseIds.length} новых тестов в план...`);
      for (const caseId of missingCaseIds) {
        try {
          await createTest(token, caseId, plan.id);
        } catch (e) {
          // Игнорируем ошибки дубликатов
        }
      }
    }

    return plan.id;
  }

  // Создаём новый план
  console.log(`  Создаём тест-план "${planName}" с ${caseIds.length} кейсами...`);
  const createResult = await createTestPlan(token, planName, caseIds);

  // API может вернуть id напрямую или нет — перечитываем список планов
  if (createResult?.id) {
    console.log(`  Создан тест-план: ID=${createResult.id}`);
    return createResult.id;
  }

  // Fallback: ищем только что созданный план
  const updatedPlans = await fetchTestPlans(token);
  plan = updatedPlans.find(p => p.name === planName);
  if (!plan) throw new Error('Тест-план создан, но не найден в списке');
  console.log(`  Создан тест-план: ID=${plan.id}`);
  return plan.id;
}

async function buildTestMapping(token, planId, codeToCaseMap) {
  // Получаем все тесты в плане
  const tests = await fetchTestsForPlan(token, planId);

  // Строим маппинг: code → test ID
  const caseIdToTestId = {};
  for (const test of tests) {
    // test.case может быть объект или число в зависимости от API
    const caseId = typeof test.case === 'object' ? test.case.id : test.case;
    caseIdToTestId[caseId] = test.id;
  }

  const codeToTestId = {};
  for (const [code, info] of Object.entries(codeToCaseMap)) {
    if (caseIdToTestId[info.caseId]) {
      codeToTestId[code] = {
        testId: caseIdToTestId[info.caseId],
        caseId: info.caseId,
        name: info.name,
        suite: info.suite,
      };
    }
  }

  return codeToTestId;
}

/**
 * Алиасы префиксов: старый код в Cypress → актуальный код в Testy.
 * Позволяет матчить старые отчёты после переименования.
 */
const PREFIX_ALIASES = {
  'CON_': 'CN_',
};

/**
 * Ищет testInfo по коду с fallback:
 *   0. Алиас префикса: CON_001 → CN_001
 *   1. Точное совпадение: REP_063_1 → REP_063_1
 *   2. Без суффикса _N / -N: REP_063_1 → REP_063, UNV_039-2 → UNV_039
 *   3. Диапазон: DEL_VT_7 → DEL_VT_7-8 (если такой есть в маппинге)
 */
function resolveTestInfo(code, codeToTestId) {
  // 0. Проверяем алиасы префиксов
  for (const [oldPrefix, newPrefix] of Object.entries(PREFIX_ALIASES)) {
    if (code.startsWith(oldPrefix)) {
      const aliased = code.replace(oldPrefix, newPrefix);
      if (codeToTestId[aliased]) return codeToTestId[aliased];
    }
  }

  // 1. Точное совпадение
  if (codeToTestId[code]) return codeToTestId[code];

  // 2. Убираем суффикс _N или -N (например REP_063_1 → REP_063, ADM_033-1 → ADM_033)
  const baseCode = code.replace(/[-_]\d+$/, '');
  if (baseCode !== code && codeToTestId[baseCode]) return codeToTestId[baseCode];

  // 3. Ищем диапазон: DEL_VT_7 может быть в Testy как DEL_VT_7-8
  for (const mappedCode of Object.keys(codeToTestId)) {
    const rangeMatch = mappedCode.match(/^(.+?)(\d+)-(\d+)$/);
    if (rangeMatch) {
      const [, prefix, from, to] = rangeMatch;
      const codeMatch = code.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`));
      if (codeMatch) {
        const num = parseInt(codeMatch[1]);
        if (num >= parseInt(from) && num <= parseInt(to)) {
          return codeToTestId[mappedCode];
        }
      }
    }
  }

  return null;
}

/**
 * Загружает результаты и сопоставляет с планом.
 * Общая логика для обоих режимов (A и B).
 */
async function uploadResults(token, planId, planName, codeToTestId, dryRun) {
  // Парсинг отчётов
  console.log('5. Чтение mochawesome-отчётов...');
  const cypressResults = readMochawesomeReports();
  console.log(`  Найдено результатов: ${cypressResults.size} кодов\n`);

  if (cypressResults.size === 0) {
    console.log('  Нет результатов для загрузки. Запустите тесты сначала.\n');
    return;
  }

  // Сопоставление и загрузка
  console.log('6. Сопоставление и загрузка результатов...\n');

  let uploaded = 0;
  let matched = 0;
  let noResult = 0;
  const noResultCodes = [];

  // Идём по кейсам плана — загружаем только то, что в плане
  for (const [code, testInfo] of Object.entries(codeToTestId)) {
    // Ищем результат Cypress для этого кода
    let cypressResult = null;

    // Прямое совпадение
    if (cypressResults.has(code)) {
      cypressResult = cypressResults.get(code);
    } else {
      // Обратный поиск: проверяем Cypress-коды через resolveTestInfo
      for (const [cypCode, res] of cypressResults) {
        const resolved = resolveTestInfo(cypCode, { [code]: testInfo });
        if (resolved) {
          cypressResult = res;
          break;
        }
      }
    }

    if (!cypressResult) {
      noResult++;
      noResultCodes.push(code);
      continue;
    }

    matched++;
    const statusId = cypressResult.passed ? CONFIG.statuses.PASSED : CONFIG.statuses.FAILED;
    const statusText = cypressResult.passed ? 'PASSED' : 'FAILED';

    if (dryRun) {
      console.log(`  [DRY] ${code} → test#${testInfo.testId} (${testInfo.name}) → ${statusText}`);
    } else {
      try {
        await postResult(token, testInfo.testId, statusId, cypressResult.duration, cypressResult.comment);
        console.log(`  ${statusText === 'PASSED' ? '+' : 'x'} ${code} → ${statusText} (${testInfo.name})`);
        uploaded++;
      } catch (e) {
        console.log(`  ! ${code} → ОШИБКА: ${e.message}`);
      }
    }
  }

  // Итоги
  const mappedCount = Object.keys(codeToTestId).length;
  console.log('\n=== Итоги ===');
  console.log(`  Тест-план:              "${planName}" (ID=${planId})`);
  console.log(`  Кейсов в плане:         ${mappedCount}`);
  console.log(`  Найдено результатов:    ${matched}`);
  console.log(`  Загружено в Testy:      ${uploaded}`);
  if (noResultCodes.length > 0) {
    console.log(`  Нет результатов Cypress (${noResult}):`);
    noResultCodes.forEach(c => {
      const info = codeToTestId[c];
      console.log(`    - ${c} (${info?.name || '?'})`);
    });
  }
  console.log(`\n  Тест-план: http://${CONFIG.testy.hostname}:${CONFIG.testy.port}/projects/${CONFIG.testy.projectId}/testplans/${planId}`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const setupOnly = args.includes('--setup');
  const listPlans = args.includes('--list');
  const planNameIdx = args.indexOf('--plan');
  const planIdIdx = args.indexOf('--plan-id');
  const planName = planNameIdx >= 0 ? args[planNameIdx + 1] : null;
  const planIdArg = planIdIdx >= 0 ? parseInt(args[planIdIdx + 1]) : null;

  // Определяем режим: A (автоматический) или B (ручной план)
  const isManualPlan = !!(planName || planIdArg);

  console.log('=== Testy Integration ===\n');

  // 1. Авторизация
  console.log('1. Авторизация...');
  const token = await getToken();
  console.log('  OK\n');

  // 2. Получение кейсов
  console.log('2. Получение кейсов из Testy...');
  const cases = await fetchAllCases(token);
  console.log(`  Всего кейсов: ${cases.length}`);

  const codeToCaseMap = buildCodeToCaseMap(cases);
  const codeCount = Object.keys(codeToCaseMap).length;
  console.log(`  Уникальных кодов: ${codeCount}\n`);

  // 3. Тест-план
  console.log('3. Тест-план...');

  // --list: показать все планы и выйти
  if (listPlans) {
    const plans = await fetchTestPlans(token);
    console.log(`\n  Доступные тест-планы (${plans.length}):\n`);
    for (const p of plans) {
      console.log(`  ID=${p.id}\t${p.name}`);
    }
    console.log('\n  Использование:');
    console.log('    node testy-integration.js --plan "Имя плана"    # загрузить в конкретный план');
    console.log('    node testy-integration.js --plan-id 5           # план по ID');
    console.log('    node testy-integration.js                       # авто-план "Cypress Автотесты"');
    return;
  }

  if (isManualPlan) {
    // ========================
    // РЕЖИМ B: ручной тест-план
    // ========================
    const plans = await fetchTestPlans(token);
    let plan;

    if (planIdArg) {
      plan = plans.find(p => p.id === planIdArg);
      if (!plan) {
        console.error(`\n  Тест-план с ID=${planIdArg} не найден.`);
        console.log('  Используйте --list для просмотра доступных планов.');
        return;
      }
    } else {
      plan = plans.find(p => p.name === planName);
      if (!plan) {
        console.error(`\n  Тест-план "${planName}" не найден.`);
        console.log('  Доступные планы:');
        for (const p of plans) {
          console.log(`    ID=${p.id}\t${p.name}`);
        }
        return;
      }
    }

    console.log(`  Режим: ручной тест-план`);
    console.log(`  Найден: "${plan.name}" (ID=${plan.id})\n`);

    // 4. Маппинг только для кейсов из этого плана
    console.log('4. Построение маппинга code → test ID...');
    const codeToTestId = await buildTestMapping(token, plan.id, codeToCaseMap);
    const mappedCount = Object.keys(codeToTestId).length;
    console.log(`  Кейсов с кодами в плане: ${mappedCount}\n`);

    if (mappedCount === 0) {
      console.log('  В этом плане нет кейсов с кодами автоматизации.');
      console.log('  Убедитесь, что в план добавлены кейсы с лейблом Automated.\n');
      return;
    }

    // 5-6. Загрузка результатов
    await uploadResults(token, plan.id, plan.name, codeToTestId, dryRun);

  } else {
    // ========================
    // РЕЖИМ A: автоматический план
    // ========================
    console.log(`  Режим: автоматический ("${CONFIG.defaultPlanName}")`);
    const caseIds = Object.values(codeToCaseMap).map(v => v.caseId);
    const planId = await ensureTestPlan(token, CONFIG.defaultPlanName, caseIds);
    console.log('');

    // 4. Маппинг
    console.log('4. Построение маппинга code → test ID...');
    const codeToTestId = await buildTestMapping(token, planId, codeToCaseMap);
    const mappedCount = Object.keys(codeToTestId).length;
    console.log(`  Замаплено: ${mappedCount} кодов\n`);

    // Сохраняем маппинг
    fs.writeFileSync(CONFIG.mappingFile, JSON.stringify({ planId, mapping: codeToTestId }, null, 2));
    console.log(`  Маппинг сохранён в ${CONFIG.mappingFile}\n`);

    if (setupOnly) {
      console.log('=== Setup завершён ===');
      return;
    }

    // 5-6. Загрузка результатов
    await uploadResults(token, planId, CONFIG.defaultPlanName, codeToTestId, dryRun);
  }
}

main().catch(e => {
  console.error('\nОшибка:', e.message);
  process.exit(1);
});
