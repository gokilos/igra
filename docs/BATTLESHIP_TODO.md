# План реализации игры "Морской бой"

## Описание
Добавить в игру режим "Морской бой" с полноценной механикой расстановки кораблей и стрельбы.

## Задачи

### 1. База данных

#### Миграция БД
Создать файл `supabase-migration-battleship.sql`:

```sql
-- Добавить поле для хранения расстановки кораблей
ALTER TABLE games
ADD COLUMN IF NOT EXISTS creator_ships JSONB,
ADD COLUMN IF NOT EXISTS opponent_ships JSONB,
ADD COLUMN IF NOT EXISTS creator_hits JSONB DEFAULT '[]'::JSONB,
ADD COLUMN IF NOT EXISTS opponent_hits JSONB DEFAULT '[]'::JSONB;

-- Структура ships:
-- [
--   { "type": "carrier", "length": 5, "cells": [[0,0], [0,1], [0,2], [0,3], [0,4]] },
--   { "type": "battleship", "length": 4, "cells": [[2,0], [2,1], [2,2], [2,3]] },
--   ...
-- ]

-- Структура hits:
-- [
--   { "cell": [3,4], "result": "hit" | "miss" | "sunk" }
-- ]
```

#### Типы кораблей
- Авианосец (5 клеток)
- Линкор (4 клетки)
- Крейсер (3 клетки)
- Эсминец (3 клетки)
- Подводная лодка (2 клетки)

### 2. Frontend - Компоненты

#### BattleshipGrid.tsx
Компонент игрового поля 10x10:
- Отображение сетки с координатами (A-J, 1-10)
- Режим расстановки кораблей
- Режим стрельбы
- Подсветка клеток при наведении
- Визуализация попаданий/промахов
- Анимация при выстреле

```tsx
interface BattleshipGridProps {
  mode: 'setup' | 'playing';
  ships?: Ship[];
  hits?: Hit[];
  onCellClick: (row: number, col: number) => void;
  isMyTurn?: boolean;
}
```

#### ShipPlacer.tsx
Компонент для расстановки кораблей:
- Выбор корабля из списка
- Вращение корабля (горизонтально/вертикально)
- Проверка валидности расстановки
- Визуальная обратная связь

### 3. Логика игры

#### battleship.ts
Файл с логикой Морского боя:

```typescript
// Проверка валидности расстановки корабля
export function isValidPlacement(
  ships: Ship[],
  newShip: Ship,
  gridSize: number = 10
): boolean;

// Проверка попадания
export function checkHit(
  cell: [number, number],
  ships: Ship[]
): 'hit' | 'miss' | 'sunk';

// Проверка победы
export function checkWin(ships: Ship[], hits: Hit[]): boolean;

// Генерация автоматической расстановки
export function generateRandomShips(): Ship[];
```

### 4. Обновление App.tsx

#### Добавить GameMode.BATTLESHIP
```typescript
export enum GameMode {
  NONE = 'NONE',
  NUMBERS = 'NUMBERS',
  WORDS = 'WORDS',
  BATTLESHIP = 'BATTLESHIP', // Новый режим
}
```

#### State для Морского боя
```typescript
const [myShips, setMyShips] = useState<Ship[]>([]);
const [opponentShips, setOpponentShips] = useState<Ship[]>([]);
const [myHits, setMyHits] = useState<Hit[]>([]);
const [opponentHits, setOpponentHits] = useState<Hit[]>([]);
const [selectedShip, setSelectedShip] = useState<ShipType | null>(null);
const [shipOrientation, setShipOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
```

#### Обработчики
```typescript
const handleShipPlace = (ship: Ship) => {
  // Разместить корабль на поле
};

const handleFire = (row: number, col: number) => {
  // Выстрел по клетке
  // Проверка попадания
  // Обновление hits в БД
  // Переключение хода
};
```

### 5. UI/UX

#### Модальное окно создания игры
Добавить кнопку "МОРСКОЙ БОЙ" рядом с "ЦИФРЫ" и "СЛОВА"

#### Экран Setup для Морского боя
- Левая панель: список кораблей для размещения
- Центр: игровое поле 10x10
- Правая панель: кнопки вращения, автозаполнения, очистки
- Кнопка "Готов" активна только когда все корабли расставлены

#### Экран игры
- Верхнее поле: поле оппонента (для стрельбы)
- Нижнее поле: мое поле (с моими кораблями)
- Индикаторы:
  - Количество кораблей противника
  - Текущий ход
  - Статистика попаданий/промахов

### 6. Стилизация

#### Tailwind классы для клеток
```tsx
// Пустая клетка
'bg-blue-900 border border-blue-700'

// Корабль (мое поле)
'bg-gray-600 border border-gray-500'

// Промах
'bg-blue-300'

// Попадание
'bg-red-600'

// Потопленный корабль
'bg-black'

// Клетка при наведении (мой ход)
'hover:bg-yellow-300 cursor-pointer'
```

### 7. Тестирование

- [ ] Расстановка кораблей работает корректно
- [ ] Нельзя разместить корабли впритык
- [ ] Стрельба работает правильно
- [ ] Определение попадания/промаха
- [ ] Определение потопленного корабля
- [ ] Определение победы
- [ ] Синхронизация между игроками
- [ ] Таймер хода работает
- [ ] Виброотклик при попадании/промахе

## Примерный объем работы

- **База данных**: 1-2 часа
- **Компонент BattleshipGrid**: 3-4 часа
- **Компонент ShipPlacer**: 2-3 часа
- **Логика игры**: 3-4 часа
- **Интеграция с App**: 2-3 часа
- **Стилизация и анимации**: 2-3 часа
- **Тестирование**: 2-3 часа

**Итого**: ~15-22 часа работы

## Приоритет
Средний - можно реализовать после основных улучшений

## Зависимости
- Текущая система игр должна стабильно работать
- Схема БД должна быть применена
- Telegram бот должен поддерживать новый режим

## Альтернативы
- Начать с упрощенной версии (меньше кораблей, меньшее поле)
- Добавить режим игры против AI для тестирования
