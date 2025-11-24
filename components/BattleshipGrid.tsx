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
    const base = 'w-7 h-7 sm:w-9 sm:h-9 border-2 transition-all duration-200 flex items-center justify-center text-base font-bold rounded-sm';
    const hitResult = getCellHitResult(row, col, hits);
    const isShip = isShipCell(row, col);
    const isHighlight = isHighlighted(row, col);

    // В режиме setup
    if (mode === 'setup') {
      if (isHighlight) {
        return `${base} ${isValid ? 'bg-green-500/60 border-green-400 shadow-lg shadow-green-500/50' : 'bg-red-500/60 border-red-400 shadow-lg shadow-red-500/50'} cursor-pointer`;
      }
      if (showShips && isShip) {
        return `${base} bg-gradient-to-br from-gray-600 to-gray-700 border-gray-500 shadow-md`;
      }
      return `${base} bg-gradient-to-br from-blue-900/60 to-blue-800/60 border-blue-600/80 hover:bg-blue-700/70 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/30 cursor-pointer`;
    }

    // В режиме playing
    if (hitResult) {
      if (hitResult.result === 'hit') {
        return `${base} bg-gradient-to-br from-orange-500 to-red-600 border-orange-400 shadow-lg shadow-orange-500/50`;
      } else if (hitResult.result === 'sunk') {
        return `${base} bg-gradient-to-br from-red-600 to-red-800 border-red-500 shadow-lg shadow-red-600/60`;
      } else {
        return `${base} bg-gradient-to-br from-cyan-400 to-blue-500 border-cyan-300 shadow-md`;
      }
    }

    // Показываем свои корабли
    if (showShips && isShip) {
      return `${base} bg-gradient-to-br from-gray-600 to-gray-700 border-gray-500 shadow-md`;
    }

    // Клетка доступна для выстрела
    if (isMyTurn && !hitResult) {
      return `${base} bg-gradient-to-br from-blue-900/60 to-blue-800/60 border-blue-600/80 hover:bg-yellow-400/50 hover:border-yellow-400 hover:shadow-lg hover:shadow-yellow-400/40 cursor-pointer transform hover:scale-110`;
    }

    return `${base} bg-gradient-to-br from-blue-900/60 to-blue-800/60 border-blue-700/60`;
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
    <div className="inline-block bg-gradient-to-br from-gray-900 to-gray-800 p-3 rounded-xl shadow-2xl border border-gray-700">
      {/* Заголовок с буквами колонок */}
      <div className="flex mb-2">
        <div className="w-7 h-7 sm:w-9 sm:h-9" /> {/* Пустая клетка для угла */}
        {Array.from({ length: GRID_SIZE }, (_, i) => (
          <div
            key={i}
            className="w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center text-sm text-cyan-400 font-bold font-mono"
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* Игровое поле */}
      {Array.from({ length: GRID_SIZE }, (_, row) => (
        <div key={row} className="flex">
          {/* Номер строки */}
          <div className="w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center text-sm text-cyan-400 font-bold font-mono mr-1">
            {rowToLetter(row)}
          </div>

          {/* Клетки */}
          {Array.from({ length: GRID_SIZE }, (_, col) => (
            <button
              key={col}
              onClick={() => {
                console.log('Cell clicked:', row, col, 'mode:', mode, 'isMyTurn:', isMyTurn);
                onCellClick(row, col);
              }}
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
