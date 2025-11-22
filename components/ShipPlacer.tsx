/**
 * Компонент для размещения кораблей
 */

import React from 'react';
import { Ship, ShipType, SHIP_CONFIG } from '../types';

interface ShipPlacerProps {
  ships: Ship[];
  selectedShip: ShipType | null;
  onSelectShip: (shipType: ShipType) => void;
  orientation: 'horizontal' | 'vertical';
  onToggleOrientation: () => void;
  onRandomize: () => void;
  onClear: () => void;
  onReady: () => void;
  canSubmit: boolean;
}

export const ShipPlacer: React.FC<ShipPlacerProps> = ({
  ships,
  selectedShip,
  onSelectShip,
  orientation,
  onToggleOrientation,
  onRandomize,
  onClear,
  onReady,
  canSubmit,
}) => {
  // Получает информацию о корабле
  const getShipInfo = (shipType: ShipType) => {
    const ship = ships.find((s) => s.type === shipType);
    const config = SHIP_CONFIG[shipType];
    return { ship, config };
  };

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="text-center">
        <h3 className="text-lg font-bold text-squid-pink mb-2">РАССТАВЬ КОРАБЛИ</h3>
        <p className="text-xs text-gray-400">
          Выбери корабль и кликни на поле для размещения
        </p>
      </div>

      {/* Список кораблей */}
      <div className="space-y-2">
        {(Object.keys(SHIP_CONFIG) as ShipType[]).map((shipType) => {
          const { ship, config } = getShipInfo(shipType);
          const isPlaced = ship?.isPlaced || false;
          const isSelected = selectedShip === shipType;

          return (
            <button
              key={shipType}
              onClick={() => !isPlaced && onSelectShip(shipType)}
              disabled={isPlaced}
              className={`
                w-full p-3 rounded border-2 transition-all text-left
                ${isPlaced ? 'bg-gray-800 border-gray-700 opacity-50 cursor-not-allowed' : ''}
                ${isSelected && !isPlaced ? 'bg-squid-pink/20 border-squid-pink' : ''}
                ${!isSelected && !isPlaced ? 'bg-squid-panel border-gray-700 hover:border-squid-pink/50' : ''}
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{config.icon}</span>
                  <div>
                    <div className="text-sm font-bold text-white">
                      {config.name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {config.length} клеток
                    </div>
                  </div>
                </div>
                {isPlaced && (
                  <span className="text-squid-green text-sm font-bold">✓</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Ориентация */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 uppercase block">Ориентация:</label>
        <button
          onClick={onToggleOrientation}
          disabled={!selectedShip || getShipInfo(selectedShip).ship?.isPlaced}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm hover:border-squid-pink disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {orientation === 'horizontal' ? '➡️ Горизонтально' : '⬇️ Вертикально'}
        </button>
      </div>

      {/* Кнопки управления */}
      <div className="space-y-2">
        <button
          onClick={onRandomize}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
        >
          🎲 СЛУЧАЙНАЯ РАССТАНОВКА
        </button>

        <button
          onClick={onClear}
          className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-colors"
        >
          🗑️ ОЧИСТИТЬ ВСЁ
        </button>

        <button
          onClick={onReady}
          disabled={!canSubmit}
          className="w-full bg-squid-green hover:bg-green-600 text-black font-bold py-3 px-4 rounded transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
        >
          {canSubmit ? '✅ ГОТОВ К БОЮ' : '⏳ РАССТАВЬ ВСЕ КОРАБЛИ'}
        </button>
      </div>

      {/* Подсказка */}
      <div className="bg-blue-900/30 border border-blue-700/50 rounded p-3">
        <p className="text-xs text-blue-300">
          <strong>💡 Подсказка:</strong> Корабли не могут касаться друг друга даже углами.
        </p>
      </div>
    </div>
  );
};
