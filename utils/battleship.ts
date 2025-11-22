/**
 * Утилиты и логика для игры "Морской бой"
 */

import { Ship, ShipType, BattleshipHit, SHIP_CONFIG } from '../types';

const GRID_SIZE = 10;

/**
 * Создает пустой массив кораблей для размещения
 */
export function createEmptyShips(): Ship[] {
  return Object.entries(SHIP_CONFIG).map(([type, config]) => ({
    type: type as ShipType,
    length: config.length,
    cells: [],
    hits: 0,
    isPlaced: false,
  }));
}

/**
 * Проверяет, находится ли клетка в пределах игрового поля
 */
export function isInBounds(row: number, col: number): boolean {
  return row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE;
}

/**
 * Проверяет, занята ли клетка другим кораблем
 */
function isCellOccupied(
  row: number,
  col: number,
  placedShips: Ship[],
  includeAdjacent: boolean = true
): boolean {
  for (const ship of placedShips) {
    if (!ship.isPlaced) continue;

    for (const [shipRow, shipCol] of ship.cells) {
      if (includeAdjacent) {
        // Проверяем клетку и все соседние (включая диагонали)
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (shipRow + dr === row && shipCol + dc === col) {
              return true;
            }
          }
        }
      } else {
        // Проверяем только саму клетку
        if (shipRow === row && shipCol === col) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Проверяет валидность размещения корабля
 */
export function isValidPlacement(
  ship: Ship,
  startRow: number,
  startCol: number,
  isHorizontal: boolean,
  placedShips: Ship[]
): boolean {
  const cells: [number, number][] = [];

  // Генерируем координаты клеток корабля
  for (let i = 0; i < ship.length; i++) {
    const row = isHorizontal ? startRow : startRow + i;
    const col = isHorizontal ? startCol + i : startCol;

    // Проверяем границы
    if (!isInBounds(row, col)) {
      return false;
    }

    // Проверяем, не занята ли клетка (с учетом правила "не впритык")
    if (isCellOccupied(row, col, placedShips, true)) {
      return false;
    }

    cells.push([row, col]);
  }

  return true;
}

/**
 * Размещает корабль на поле
 */
export function placeShip(
  ship: Ship,
  startRow: number,
  startCol: number,
  isHorizontal: boolean,
  placedShips: Ship[]
): Ship | null {
  if (!isValidPlacement(ship, startRow, startCol, isHorizontal, placedShips)) {
    return null;
  }

  const cells: [number, number][] = [];
  for (let i = 0; i < ship.length; i++) {
    const row = isHorizontal ? startRow : startRow + i;
    const col = isHorizontal ? startCol + i : startCol;
    cells.push([row, col]);
  }

  return {
    ...ship,
    cells,
    isPlaced: true,
  };
}

/**
 * Генерирует случайную расстановку кораблей
 */
export function generateRandomShips(): Ship[] {
  const ships = createEmptyShips();
  const placedShips: Ship[] = [];

  for (const ship of ships) {
    let placed = false;
    let attempts = 0;
    const maxAttempts = 100;

    while (!placed && attempts < maxAttempts) {
      const startRow = Math.floor(Math.random() * GRID_SIZE);
      const startCol = Math.floor(Math.random() * GRID_SIZE);
      const isHorizontal = Math.random() > 0.5;

      const placedShip = placeShip(ship, startRow, startCol, isHorizontal, placedShips);
      if (placedShip) {
        placedShips.push(placedShip);
        placed = true;
      }

      attempts++;
    }

    if (!placed) {
      // Если не удалось разместить корабль, начинаем сначала
      return generateRandomShips();
    }
  }

  return placedShips;
}

/**
 * Проверяет попадание по клетке
 */
export function checkHit(
  row: number,
  col: number,
  ships: Ship[],
  previousHits: BattleshipHit[]
): BattleshipHit | null {
  // Проверяем, не стреляли ли уже в эту клетку
  const alreadyHit = previousHits.some(
    (hit) => hit.cell[0] === row && hit.cell[1] === col
  );

  if (alreadyHit) {
    return null; // Уже стреляли сюда
  }

  // Проверяем попадание в корабль
  for (const ship of ships) {
    const hitIndex = ship.cells.findIndex(
      ([shipRow, shipCol]) => shipRow === row && shipCol === col
    );

    if (hitIndex !== -1) {
      // Попадание!
      const newHits = ship.hits + 1;
      const isSunk = newHits >= ship.length;

      return {
        cell: [row, col],
        result: isSunk ? 'sunk' : 'hit',
        shipType: ship.type,
      };
    }
  }

  // Промах
  return {
    cell: [row, col],
    result: 'miss',
  };
}

/**
 * Обновляет корабли после попадания
 */
export function updateShipsAfterHit(
  ships: Ship[],
  hit: BattleshipHit
): Ship[] {
  if (hit.result === 'miss') {
    return ships;
  }

  return ships.map((ship) => {
    if (ship.type === hit.shipType) {
      return {
        ...ship,
        hits: ship.hits + 1,
      };
    }
    return ship;
  });
}

/**
 * Проверяет, все ли корабли потоплены
 */
export function checkWin(ships: Ship[]): boolean {
  return ships.every((ship) => ship.hits >= ship.length);
}

/**
 * Получает клетки корабля по типу
 */
export function getShipCells(ships: Ship[], shipType: ShipType): [number, number][] {
  const ship = ships.find((s) => s.type === shipType);
  return ship ? ship.cells : [];
}

/**
 * Проверяет, попали ли уже в эту клетку
 */
export function isCellHit(row: number, col: number, hits: BattleshipHit[]): boolean {
  return hits.some((hit) => hit.cell[0] === row && hit.cell[1] === col);
}

/**
 * Получает результат выстрела по клетке
 */
export function getCellHitResult(
  row: number,
  col: number,
  hits: BattleshipHit[]
): BattleshipHit | undefined {
  return hits.find((hit) => hit.cell[0] === row && hit.cell[1] === col);
}

/**
 * Проверяет, размещены ли все корабли
 */
export function areAllShipsPlaced(ships: Ship[]): boolean {
  return ships.every((ship) => ship.isPlaced && ship.cells.length === ship.length);
}

/**
 * Получает количество потопленных кораблей
 */
export function getSunkShipsCount(ships: Ship[]): number {
  return ships.filter((ship) => ship.hits >= ship.length).length;
}

/**
 * Получает статистику игры
 */
export function getGameStats(hits: BattleshipHit[]) {
  const totalShots = hits.length;
  const hitCount = hits.filter((h) => h.result === 'hit' || h.result === 'sunk').length;
  const missCount = hits.filter((h) => h.result === 'miss').length;
  const sunkCount = hits.filter((h) => h.result === 'sunk').length;
  const accuracy = totalShots > 0 ? Math.round((hitCount / totalShots) * 100) : 0;

  return {
    totalShots,
    hitCount,
    missCount,
    sunkCount,
    accuracy,
  };
}

/**
 * Конвертирует номер строки в букву (0 -> A, 1 -> B, etc.)
 */
export function rowToLetter(row: number): string {
  return String.fromCharCode(65 + row); // 65 = 'A'
}

/**
 * Конвертирует букву в номер строки (A -> 0, B -> 1, etc.)
 */
export function letterToRow(letter: string): number {
  return letter.toUpperCase().charCodeAt(0) - 65;
}

/**
 * Форматирует координаты в читаемый вид (например, [0, 0] -> "A1")
 */
export function formatCell(row: number, col: number): string {
  return `${rowToLetter(row)}${col + 1}`;
}
