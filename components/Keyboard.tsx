import React from 'react';

interface KeyboardProps {
  mode: 'NUMERIC' | 'ALPHA';
  onInput: (char: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
  disabled: boolean;
  usedKeys?: string[];
  loading?: boolean;
}

export const Keyboard: React.FC<KeyboardProps> = ({ 
  mode, 
  onInput, 
  onDelete, 
  onSubmit, 
  disabled,
  usedKeys = [],
  loading = false 
}) => {
  
  const getButtonClass = (key: string) => {
    const isUsed = usedKeys.includes(key);
    return `
      active:scale-95 transition-transform 
      font-mono font-bold rounded shadow-lg
      flex items-center justify-center
      ${isUsed ? 'bg-gray-800 text-gray-500 border-gray-700' : 'bg-gray-700 text-white border-gray-600 hover:bg-gray-600'}
      border-b-2 sm:border-b-4
      disabled:opacity-50 disabled:cursor-not-allowed
    `;
  };

  if (mode === 'NUMERIC') {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    return (
      <div className="grid grid-cols-3 gap-2 p-2 max-w-sm mx-auto">
        {keys.map((k) => (
          <button
            key={k}
            onClick={() => onInput(k)}
            disabled={disabled}
            className={`h-12 sm:h-14 text-xl ${getButtonClass(k)} ${k === '0' ? 'col-start-2' : ''}`}
          >
            {k}
          </button>
        ))}
        <button
          onClick={onDelete}
          disabled={disabled || loading}
          className="h-12 sm:h-14 col-start-1 row-start-4 bg-red-900/50 text-red-200 border-red-800 border-b-4 rounded font-bold text-sm"
        >
          СТЕРЕТЬ
        </button>
        <button
          onClick={onSubmit}
          disabled={disabled || loading}
          aria-busy={loading}
          className={`h-12 sm:h-14 col-start-3 row-start-4 bg-squid-pink text-white border-red-900 border-b-4 rounded font-bold text-sm flex items-center justify-center ${loading ? 'opacity-80' : ''}`}
        >
          {loading ? (
            <span className="flex items-center">
              <span className="inline-block w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin mr-2"></span>
              ОТПРАВКА...
            </span>
          ) : (
            'ВВОД'
          )}
        </button>
      </div>
    );
  }

  // Russian Cyrillic Keyboard Layout
  const rows = [
    ['Й','Ц','У','К','Е','Н','Г','Ш','Щ','З','Х','Ъ'],
    ['Ф','Ы','В','А','П','Р','О','Л','Д','Ж','Э'],
    ['Я','Ч','С','М','И','Т','Ь','Б','Ю']
  ];

  return (
    <div className="flex flex-col gap-1 p-1 w-full max-w-md mx-auto select-none">
      {rows.map((row, i) => (
        <div key={i} className="flex justify-center gap-[2px] sm:gap-1">
          {row.map((char) => (
            <button
              key={char}
              onClick={() => onInput(char)}
              disabled={disabled}
              className={`h-10 w-[8.5%] sm:h-12 sm:w-10 text-xs sm:text-sm ${getButtonClass(char)}`}
            >
              {char}
            </button>
          ))}
        </div>
      ))}
      <div className="flex justify-center gap-2 mt-2 px-1">
         <button
          onClick={onDelete}
          disabled={disabled}
          className="px-4 py-3 bg-gray-800 border-gray-600 border-b-4 rounded text-white font-bold text-xs sm:text-sm w-24"
        >
          УДАЛИТЬ
        </button>
        <button
          onClick={onSubmit}
          disabled={disabled || loading}
          aria-busy={loading}
          className={`flex-1 py-3 bg-squid-pink border-red-900 border-b-4 rounded text-white font-bold text-xs sm:text-sm flex items-center justify-center ${loading ? 'opacity-80' : ''}`}
        >
          {loading ? (
            <span className="flex items-center">
              <span className="inline-block w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin mr-2"></span>
              ОТПРАВКА...
            </span>
          ) : (
            'ПОДТВЕРДИТЬ ХОД'
          )}
        </button>
      </div>
    </div>
  );
};
