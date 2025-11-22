/**
 * Компонент игрового поля для Морского боя
 */

import React, { useMemo } from 'react';
import { Ship, BattleshipHit } from '../types';
import {
  rowToLetter,
  isCellHit,
  getCellHitResult,
  isInBounds
} from '../utils/battleship';

interface BattleshipGridProps {
  mode: 'setup' | 'playing';
  ships: Ship[];
  hits: BattleshipHit[];
  onCellClick: (row: number, col: number) => void;
  isMyTurn?: boolean;
  showShips?: boolean; // Показывать ли корабли (для своего поля)
  highlightCells?: [number, number][]; // Подсветка клеток (при размещении)
  isValid?: boolean; // Валидна ли подсветка
}

const GRID_SIZE = 10;

export const BattleshipGrid: React.FC<BattleshipGridProps> = ({
  mode,
  ships,
  hits,
  onCellClick,
  isMyTurn = false,
  showShips = false,
  highlightCells = [],
  isValid = true,
}) => {
  // Создаем карту клеток с кораблями для быстрого поиска
  const shipCellsMap = useMemo(() => {
    const map = new Map<string, Ship>();
    ships.forEach((ship) => {
      ship.cells.forEach(([row, col]) => {
        map.set(`${row}-${col}`, ship);
      });
    });
    return map;
  }, [ships]);

  // Проверяет, является ли клетка частью корабля
  const isShipCell = (row: number, col: number): boolean => {
    return shipCellsMap.has(`${row}-${col}`);
  };

  // Проверяет, подсвечена ли клетка
  const isHighlighted = (row: number, col: number): boolean => {
    return highlightCells.some(([r, c]) => r === row && c === col);
  };

  // Получает класс для клетки
  const getCellClassName = (row: number, col: number): string => {
    const base = 'w-6 h-6 sm:w-8 sm:h-8 border transition-all duration-200 flex items-center justify-center text-xs font-bold';
    const hitResult = getCellHitResult(row, col, hits);
    const isShip = isShipCell(row, col);
    const isHighlight = isHighlighted(row, col);

    // В режиме setup
    if (mode === 'setup') {
      if (isHighlight) {
        return `${base} ${isValid ? 'bg-green-500/50 border-green-400' : 'bg-red-500/50 border-red-400'} cursor-pointer`;
      }
      if (showShips && isShip) {
        return `${base} bg-gray-600 border-gray-500`;
      }
      return `${base} bg-blue-900/50 border-blue-700 hover:bg-blue-800/50 cursor-pointer`;
    }

    // В режиме playing
    if (hitResult) {
      if (hitResult.result === 'hit') {
        return `${base} bg-orange-600 border-orange-500`;
      } else if (hitResult.result === 'sunk') {
        return `${base} bg-red-700 border-red-600`;
      } else {
        return `${base} bg-blue-300 border-blue-400`;
      }
    }

    // Показываем свои корабли
    if (showShips && isShip) {
      return `${base} bg-gray-600 border-gray-500`;
    }

    // Клетка доступна для выстрела
    if (isMyTurn && !hitResult) {
      return `${base} bg-blue-900/50 border-blue-700 hover:bg-yellow-300/30 cursor-pointer`;
    }

    return `${base} bg-blue-900/50 border-blue-700`;
  };

  // Получает символ для клетки
  const getCellContent = (row: number, col: number): string => {
    const hitResult = getCellHitResult(row, col, hits);

    if (hitResult) {
      if (hitResult.result === 'hit' || hitResult.result === 'sunk') {
        return '💥';
      } else {
        return '💧';
      }
    }

    return '';
  };

  return (
    <div className="inline-block">
      {/* Заголовок с буквами колонок */}
      <div className="flex mb-1">
        <div className="w-6 h-6 sm:w-8 sm:h-8" /> {/* Пустая клетка для угла */}
        {Array.from({ length: GRID_SIZE }, (_, i) => (
          <div
            key={i}
            className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center text-xs text-gray-400 font-mono"
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* Игровое поле */}
      {Array.from({ length: GRID_SIZE }, (_, row) => (
        <div key={row} className="flex">
          {/* Номер строки */}
          <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center text-xs text-gray-400 font-mono mr-1">
            {rowToLetter(row)}
          </div>

          {/* Клетки */}
          {Array.from({ length: GRID_SIZE }, (_, col) => (
            <button
              key={col}
              onClick={() => onCellClick(row, col)}
              disabled={mode === 'playing' && (!isMyTurn || isCellHit(row, col, hits))}
              className={getCellClassName(row, col)}
              aria-label={`Клетка ${rowToLetter(row)}${col + 1}`}
            >
              {getCellContent(row, col)}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
};
