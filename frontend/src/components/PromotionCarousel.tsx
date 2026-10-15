import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Zap, Award, Sparkles, Gift, Ticket, Pause, Play, CalendarDays } from 'lucide-react';
import { cn } from '../lib/utils';

const AUTOPLAY_MS = 5000;

export interface CarouselPromotion {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string | null;
  type: string;
  multiplier?: number;
  bonusPoints?: number;
  discount?: number;
  startDate?: string;
  endDate: string;
}

const typeLabels: Record<string, string> = {
  DOBLE_PUNTOS: 'Doble Puntos',
  TRIPLE_PUNTOS: 'Triple Puntos',
  PUNTOS_EXTRA: 'Puntos Extra',
  DESCUENTO_PORCENTUAL: 'Descuento %',
  PRODUCTO_BONIFICADO: 'Producto Bonificado',
  ENVIO_GRATIS: 'Envío Gratis',
};

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  DOBLE_PUNTOS: Zap,
  TRIPLE_PUNTOS: Zap,
  PUNTOS_EXTRA: Award,
  DESCUENTO_PORCENTUAL: Sparkles,
  PRODUCTO_BONIFICADO: Gift,
  ENVIO_GRATIS: Ticket,
};

/** Degradados de respaldo cuando la promoción no tiene imagen (flyer) */
const typeGradients: Record<string, string> = {
  DOBLE_PUNTOS: 'from-purple-600 via-purple-500 to-fuchsia-500',
  TRIPLE_PUNTOS: 'from-fuchsia-600 via-purple-600 to-indigo-600',
  PUNTOS_EXTRA: 'from-amber-500 via-orange-500 to-amber-600',
  DESCUENTO_PORCENTUAL: 'from-green-500 via-emerald-500 to-teal-500',
  PRODUCTO_BONIFICADO: 'from-blue-500 via-indigo-500 to-blue-600',
  ENVIO_GRATIS: 'from-cyan-500 via-sky-500 to-blue-500',
};

interface PromotionCarouselProps {
  promotions: CarouselPromotion[];
  /** Intervalo entre slides en ms (default: 5000) */
  intervalMs?: number;
}

export default function PromotionCarousel({ promotions, intervalMs = AUTOPLAY_MS }: PromotionCarouselProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const count = promotions.length;

  // Reiniciar el índice si cambia la lista
  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  const goTo = useCallback((i: number) => {
    if (count === 0) return;
    setIndex(((i % count) + count) % count);
  }, [count]);

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  // Movimiento automático: se van pasando solas las promociones
  useEffect(() => {
    if (paused || count <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), intervalMs);
    return () => clearInterval(timer);
  }, [paused, count, intervalMs]);

  if (count === 0) return null;

  return (
    <div className="relative group">
      <style>{`
        @keyframes carousel-progress { from { width: 0% } to { width: 100% } }
      `}</style>

      <div
        className="relative overflow-hidden rounded-2xl border border-gray-200 shadow-sm bg-gray-900"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => { touchStartX.current = null; setPaused(true); }}
        onTouchEnd={(e) => {
          const start = touchStartX.current;
          touchStartX.current = null;
          if (start !== null) {
            const delta = e.changedTouches[0].clientX - start;
            if (delta > 50) prev();
            else if (delta < -50) next();
          }
          setPaused(false);
        }}
        onTouchMove={(e) => {
          if (touchStartX.current === null) touchStartX.current = e.touches[0].clientX;
        }}
        role="region"
        aria-label="Carrusel de promociones vigentes"
      >
        {/* Pista de slides */}
        <div
          className="flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {promotions.map((promo, i) => (
            <FlyerSlide key={promo.id} promo={promo} active={i === index} />
          ))}
        </div>

        {/* Flechas de navegación */}
        {count > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Promoción anterior"
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white backdrop-blur-sm transition-all hover:bg-black/50 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/60 opacity-0 group-hover:opacity-100 focus:opacity-100 max-sm:opacity-100"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              aria-label="Promoción siguiente"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white backdrop-blur-sm transition-all hover:bg-black/50 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/60 opacity-0 group-hover:opacity-100 focus:opacity-100 max-sm:opacity-100"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Contador + play/pausa */}
        {count > 1 && (
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <span className="px-2 py-1 rounded-full bg-black/40 text-white text-xs font-semibold backdrop-blur-sm">
              {index + 1} / {count}
            </span>
            <button
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? 'Reproducir carrusel' : 'Pausar carrusel'}
              className="p-1.5 rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
            >
              {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}

        {/* Barra de progreso del autoplay */}
        {count > 1 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
            {!paused && (
              <div
                key={index}
                className="h-full bg-white/80"
                style={{ animation: `carousel-progress ${intervalMs}ms linear forwards` }}
              />
            )}
          </div>
        )}
      </div>

      {/* Puntos indicadores */}
      {count > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          {promotions.map((promo, i) => (
            <button
              key={promo.id}
              onClick={() => goTo(i)}
              aria-label={`Ir a la promoción ${i + 1}: ${promo.name}`}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                i === index ? 'w-6 bg-primary-600' : 'w-2 bg-gray-300 hover:bg-gray-400'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FlyerSlideProps {
  promo: CarouselPromotion;
  active: boolean;
}

function FlyerSlide({ promo, active }: FlyerSlideProps) {
  const [imgError, setImgError] = useState(false);
  const Icon = typeIcons[promo.type] || Sparkles;
  const gradient = typeGradients[promo.type] || 'from-primary-600 via-primary-500 to-amber-400';
  const hasImage = !!promo.imageUrl && !imgError;
  const daysLeft = Math.max(0, Math.ceil((new Date(promo.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div
      className="relative w-full flex-shrink-0 bg-white"
      aria-hidden={!active}
    >
      {/* Imagen completa, sin recortes ni deformaciones */}
      {hasImage ? (
        <div className="w-full aspect-[16/10] sm:aspect-[2/1] max-h-[420px] bg-white flex items-center justify-center overflow-hidden">
          <img
            src={promo.imageUrl!}
            alt={promo.name}
            onError={() => setImgError(true)}
            className="w-full h-full object-contain"
            loading={active ? 'eager' : 'lazy'}
          />
        </div>
      ) : (
        <div className={cn('relative w-full aspect-[16/10] sm:aspect-[2/1] max-h-[420px] bg-gradient-to-br', gradient)}>
          <Icon className="absolute -right-6 -bottom-8 w-56 h-56 text-white/15 rotate-12" />
        </div>
      )}

      {/* Badge de tipo */}
      {hasImage && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 border border-gray-200 shadow-sm">
          <Icon className="w-3.5 h-3.5 text-primary-700" />
          <span className="text-xs font-semibold text-gray-900">{typeLabels[promo.type] || promo.type}</span>
        </div>
      )}

      {/* Panel de texto */}
      <div className={cn('p-4 sm:p-5 text-white bg-gradient-to-br', gradient)}>
        <h3 className="text-xl sm:text-2xl font-bold drop-shadow-sm">{promo.name}</h3>
        {promo.description && (
          <p className="mt-1 text-sm text-white/85 line-clamp-2 max-w-2xl">{promo.description}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!!promo.multiplier && promo.multiplier > 1 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-semibold">
              <Zap className="w-3 h-3" /> x{promo.multiplier} puntos
            </span>
          )}
          {!!promo.bonusPoints && promo.bonusPoints > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-semibold">
              <Award className="w-3 h-3" /> +{promo.bonusPoints} pts
            </span>
          )}
          {!!promo.discount && promo.discount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-semibold">
              <Sparkles className="w-3 h-3" /> -{promo.discount}%
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-xs font-medium">
            <CalendarDays className="w-3 h-3" />
            Válida hasta {new Date(promo.endDate).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </span>
          {daysLeft <= 7 && (
            <span className="px-2.5 py-1 rounded-full bg-red-500 text-xs font-semibold">
              ¡Últimos {daysLeft} {daysLeft === 1 ? 'día' : 'días'}!
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
