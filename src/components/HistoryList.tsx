import React, { useState, useMemo } from 'react';
import { HistoryItem } from '../types';
import {
  Clock,
  FileText,
  Play,
  Trash2,
  Search,
  User,
  Calendar,
  Filter,
  ArrowUpDown,
  X,
  RotateCcw,
} from 'lucide-react';

interface HistoryListProps {
  history: HistoryItem[];
  onOpenDocument: (id: string, resume: boolean) => void;
  onDeleteDocument: (id: string) => void;
}

export const HistoryList: React.FC<HistoryListProps> = ({
  history,
  onOpenDocument,
  onDeleteDocument,
}) => {
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchField, setSearchField] = useState<'all' | 'name' | 'author' | 'date'>('all');
  const [selectedAuthor, setSelectedAuthor] = useState<string>('all');
  const [datePeriod, setDatePeriod] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'name-asc' | 'author-asc' | 'progress-desc'>('recent');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  if (history.length === 0) return null;

  // Format date helper
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return `Hoy, ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Extract list of unique authors from history
  const availableAuthors = useMemo(() => {
    const set = new Set<string>();
    history.forEach((item) => {
      if (item.author && item.author.trim()) {
        set.add(item.author.trim());
      }
    });
    return Array.from(set).sort();
  }, [history]);

  // Check if any filter is active
  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    searchField !== 'all' ||
    selectedAuthor !== 'all' ||
    datePeriod !== 'all' ||
    customStartDate !== '' ||
    customEndDate !== '' ||
    sortBy !== 'recent';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSearchField('all');
    setSelectedAuthor('all');
    setDatePeriod('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setSortBy('recent');
  };

  // Filter & Sort Logic
  const filteredHistory = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = startOfToday - 30 * 24 * 60 * 60 * 1000;
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

    const q = searchQuery.trim().toLowerCase();

    const result = history.filter((item) => {
      // 1. Text Search Filter (by name, author, and/or date)
      if (q) {
        const itemDateStr = formatDate(item.lastReadTimestamp).toLowerCase();
        const itemName = item.name.toLowerCase();
        const itemAuthor = (item.author || '').toLowerCase();

        if (searchField === 'all') {
          const matchName = itemName.includes(q);
          const matchAuthor = itemAuthor.includes(q);
          const matchDate = itemDateStr.includes(q);
          if (!matchName && !matchAuthor && !matchDate) return false;
        } else if (searchField === 'name') {
          if (!itemName.includes(q)) return false;
        } else if (searchField === 'author') {
          if (!itemAuthor.includes(q)) return false;
        } else if (searchField === 'date') {
          if (!itemDateStr.includes(q)) return false;
        }
      }

      // 2. Author Filter
      if (selectedAuthor !== 'all') {
        if (selectedAuthor === 'no-author') {
          if (item.author && item.author.trim()) return false;
        } else {
          if ((item.author || '').trim() !== selectedAuthor) return false;
        }
      }

      // 3. Date Period Filter
      if (datePeriod === 'today') {
        if (item.lastReadTimestamp < startOfToday) return false;
      } else if (datePeriod === 'week') {
        if (item.lastReadTimestamp < sevenDaysAgo) return false;
      } else if (datePeriod === 'month') {
        if (item.lastReadTimestamp < thirtyDaysAgo) return false;
      } else if (datePeriod === 'year') {
        if (item.lastReadTimestamp < startOfYear) return false;
      } else if (datePeriod === 'custom') {
        if (customStartDate) {
          const startTs = new Date(customStartDate).getTime();
          if (item.lastReadTimestamp < startTs) return false;
        }
        if (customEndDate) {
          // End of selected day
          const endTs = new Date(customEndDate).getTime() + 24 * 60 * 60 * 1000 - 1;
          if (item.lastReadTimestamp > endTs) return false;
        }
      }

      return true;
    });

    // 4. Sorting
    result.sort((a, b) => {
      if (sortBy === 'recent') {
        return b.lastReadTimestamp - a.lastReadTimestamp;
      } else if (sortBy === 'oldest') {
        return a.lastReadTimestamp - b.lastReadTimestamp;
      } else if (sortBy === 'name-asc') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'author-asc') {
        const authA = a.author || '';
        const authB = b.author || '';
        return authA.localeCompare(authB);
      } else if (sortBy === 'progress-desc') {
        return b.progressPercent - a.progressPercent;
      }
      return 0;
    });

    return result;
  }, [
    history,
    searchQuery,
    searchField,
    selectedAuthor,
    datePeriod,
    customStartDate,
    customEndDate,
    sortBy,
  ]);

  return (
    <div id="recent-documents-section" className="w-full max-w-4xl mx-auto px-4 mt-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 leading-tight">
              Documentos Recientes ({history.length})
            </h2>
            <p className="text-xs text-slate-400">
              Buscador inteligente por nombre, autor y fechas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpiar filtros</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAdvancedFilters((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              showAdvancedFilters || hasActiveFilters
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filtros avanzados</span>
          </button>
        </div>
      </div>

      {/* Unified Search Bar for All Versions */}
      <div className="mb-5 space-y-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Main Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder={
              searchField === 'name'
                ? 'Buscar por nombre de documento (ej. Quijote, Informe, Manual...)'
                : searchField === 'author'
                ? 'Buscar por autor (ej. Cervantes, Gabriel García, Desconocido...)'
                : searchField === 'date'
                ? 'Buscar por fecha (ej. 2026, octubre, hoy, 26/10...)'
                : 'Buscar documentos por nombre, autor o fechas...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              title="Borrar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Search Mode Tabs: Todos | Por Nombre | Por Autor | Por Fechas */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1">
            Buscar en:
          </span>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/70 p-0.5 rounded-lg text-xs overflow-x-auto">
            <button
              type="button"
              onClick={() => setSearchField('all')}
              className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${
                searchField === 'all'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Todo
            </button>
            <button
              type="button"
              onClick={() => setSearchField('name')}
              className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 ${
                searchField === 'name'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3 h-3" />
              <span>Por Nombre</span>
            </button>
            <button
              type="button"
              onClick={() => setSearchField('author')}
              className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 ${
                searchField === 'author'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <User className="w-3 h-3" />
              <span>Por Autor</span>
            </button>
            <button
              type="button"
              onClick={() => setSearchField('date')}
              className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 ${
                searchField === 'date'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>Por Fechas</span>
            </button>
          </div>
        </div>

        {/* Advanced Filters Expandable Drawer */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-150">
            {/* Filter by Author */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                <User className="w-3 h-3 text-indigo-500" />
                <span>Autor</span>
              </label>
              <select
                value={selectedAuthor}
                onChange={(e) => setSelectedAuthor(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">Todos los autores</option>
                {availableAuthors.map((author) => (
                  <option key={author} value={author}>
                    {author}
                  </option>
                ))}
                <option value="no-author">Sin autor especificado</option>
              </select>
            </div>

            {/* Filter by Date Period */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-indigo-500" />
                <span>Período de Fecha</span>
              </label>
              <select
                value={datePeriod}
                onChange={(e) => setDatePeriod(e.target.value as any)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">Cualquier fecha</option>
                <option value="today">Leídos hoy</option>
                <option value="week">Últimos 7 días</option>
                <option value="month">Este mes</option>
                <option value="year">Este año</option>
                <option value="custom">Rango personalizado...</option>
              </select>
            </div>

            {/* Sort by */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 text-indigo-500" />
                <span>Ordenar por</span>
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="recent">Fecha (Más reciente primero)</option>
                <option value="oldest">Fecha (Más antiguo primero)</option>
                <option value="name-asc">Nombre (A - Z)</option>
                <option value="author-asc">Autor (A - Z)</option>
                <option value="progress-desc">Mayor progreso de lectura</option>
              </select>
            </div>

            {/* Custom Date Inputs if 'custom' period is selected */}
            {datePeriod === 'custom' && (
              <div className="sm:col-span-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-[11px] font-medium">Desde:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-[11px] font-medium">Hasta:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200"
                  />
                </div>
                {(customStartDate || customEndDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomStartDate('');
                      setCustomEndDate('');
                    }}
                    className="text-[11px] text-rose-600 dark:text-rose-400 underline cursor-pointer"
                  >
                    Borrar rango
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Results summary pill */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
          <span>
            Mostrando <strong>{filteredHistory.length}</strong> de <strong>{history.length}</strong> documentos
          </span>
          {hasActiveFilters && (
            <span className="text-indigo-600 dark:text-indigo-400 font-medium">
              Filtros activos aplicados
            </span>
          )}
        </div>
      </div>

      {/* Grid of Results */}
      {filteredHistory.length === 0 ? (
        <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            No se encontraron documentos
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            No hay ningún documento que coincida con tu búsqueda por{' '}
            {searchField === 'name' ? 'nombre' : searchField === 'author' ? 'autor' : searchField === 'date' ? 'fecha' : 'nombre, autor o fecha'}.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer búsqueda y ver todos</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredHistory.map((item) => (
            <div
              key={item.id}
              className="group relative p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3
                        className="text-sm font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                        title={item.name}
                        onClick={() => onOpenDocument(item.id, true)}
                      >
                        {item.name}
                      </h3>

                      {/* Author Tag */}
                      <div className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        <User className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span className="truncate">
                          {item.author && item.author.trim() ? item.author : 'Autor no especificado'}
                        </span>
                      </div>

                      {/* Date & Metadata Tag */}
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          <span>{formatDate(item.lastReadTimestamp)}</span>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {item.totalPages} {item.totalPages === 1 ? 'pág' : 'págs'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{item.totalWords.toLocaleString()} pal.</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteDocument(item.id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer opacity-70 group-hover:opacity-100"
                    title="Eliminar del historial"
                    aria-label="Eliminar documento del historial"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Progress bar */}
                <div className="mt-2.5 mb-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1 font-mono">
                    <span>Progreso: Frase {item.lastSentenceIndex + 1}</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {item.progressPercent}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(2, item.progressPercent)}%` }}
                    />
                  </div>
                </div>

                {item.lastSentenceText && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 italic truncate mt-1.5">
                    "{item.lastSentenceText}..."
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <button
                  onClick={() => onOpenDocument(item.id, false)}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  Desde el inicio
                </button>

                <button
                  onClick={() => onOpenDocument(item.id, true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg transition-colors cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Continuar ({item.progressPercent}%)</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
