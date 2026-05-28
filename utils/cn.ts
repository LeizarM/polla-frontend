/**
 * cn() — Class Name utility
 *
 * Combines clsx (conditional classes) + tailwind-merge (deduplication).
 * Essential for NativeWind components to avoid class conflicts.
 *
 * Usage:
 *   cn('bg-surface p-md', isActive && 'bg-primary', className)
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
