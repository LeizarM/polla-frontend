/**
 * Badge — 100% NativeWind (zero StyleSheet)
 *
 * 10 status variants → color-coded via Tailwind classes.
 * Zero runtime theme lookups needed thanks to CSS vars.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

// ─── Status color map via CVA ──────────────────────────────────────────────────

const badgeVariants = cva(
  // Base
  'rounded-full px-[10px] py-[4px] self-start',
  {
    variants: {
      status: {
        open:     'bg-[rgba(59,130,246,0.18)]',
        active:   'bg-[rgba(16,185,129,0.15)]',
        approved: 'bg-[rgba(16,185,129,0.15)]',
        won:      'bg-[rgba(16,185,129,0.15)]',
        draft:    'bg-[rgba(245,158,11,0.15)]',
        pending:  'bg-[rgba(245,158,11,0.15)]',
        closed:   'bg-[rgba(239,68,68,0.15)]',
        finished: 'bg-[rgba(74,85,104,0.3)]',
        resolved: 'bg-[rgba(74,85,104,0.3)]',
        lost:     'bg-[rgba(74,85,104,0.3)]',
        blocked:  'bg-[rgba(239,68,68,0.15)]',
        rejected: 'bg-[rgba(239,68,68,0.15)]',
      },
    },
    defaultVariants: {
      status: 'pending',
    },
  },
);

const textVariants = cva(
  // Base text
  'text-caption font-bold tracking-[0.5px] uppercase',
  {
    variants: {
      status: {
        open:     'text-primary-light',
        active:   'text-success',
        approved: 'text-success',
        won:      'text-success',
        draft:    'text-warning',
        pending:  'text-warning',
        closed:   'text-error',
        finished: 'text-silver',
        resolved: 'text-silver',
        lost:     'text-silver',
        blocked:  'text-error',
        rejected: 'text-error',
      },
    },
    defaultVariants: {
      status: 'pending',
    },
  },
);

// ─── Labels ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  open:     'Abierta',
  active:   'Activo',
  approved: 'Aprobado',
  won:      'Ganado',
  draft:    'Borrador',
  pending:  'Pendiente',
  closed:   'Cerrada',
  finished: 'Finalizado',
  resolved: 'Resuelto',
  lost:     'Perdido',
  blocked:  'Bloqueado',
  rejected: 'Rechazado',
};

// ─── Props ─────────────────────────────────────────────────────────────────────

type BadgeStatus = NonNullable<VariantProps<typeof badgeVariants>['status']>;

interface BadgeProps {
  status: BadgeStatus;
  text?: string;
  className?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function Badge({ status, text, className }: BadgeProps) {
  const label = text ?? STATUS_LABELS[status] ?? status;

  return (
    <View className={cn(badgeVariants({ status }), className)}>
      <Text className={textVariants({ status })}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}
