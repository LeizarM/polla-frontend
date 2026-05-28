/**
 * DateTimePicker — Cross-platform date/time picker
 *
 * DATE  → Web: invisible <input type="date"> overlay opens the browser picker.
 *         Native: @react-native-community/datetimepicker (iOS spinner, Android modal).
 *
 * TIME  → Universal custom HH:MM input fields (typed) on ALL platforms.
 *         No flaky native picker dependencies — types straight into hour & minute
 *         text boxes with validation. Reliable on web, iOS and Android.
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Platform } from 'react-native';
import RNDateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { theme as staticTheme } from '../../constants/theme';

type PickerMode = 'date' | 'time' | 'datetime';

interface DateTimePickerProps {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  mode?: PickerMode;
  minimumDate?: Date;
  maximumDate?: Date;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function toDDMMYYYY(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const mo  = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${mo}/${d.getFullYear()}`;
}

function toHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function toInputDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const mo  = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${mo}-${day}`;
}

function toInputDatetime(d: Date): string {
  return `${toInputDate(d)}T${toHHMM(d)}`;
}

// Detect if a hex/rgb color is "light" by averaging RGB. Used to pick
// themeVariant for the native RNDateTimePicker so it adapts to light/dark themes.
function isLightBg(color: string): boolean {
  if (!color) return false;
  const hex = color.replace('#', '').trim();
  if (hex.length === 3 || hex.length === 6) {
    const c = hex.length === 3 ? hex.split('').map(x => x + x).join('') : hex;
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 140;
  }
  return false;
}

// ─── Web overlay input style ──────────────────────────────────────────────────
// The <input> is positioned ON TOP of the styled button. It is fully interactive
// (pointer-events: auto, which is the default) so clicking it opens the browser's
// native picker. zIndex ensures it sits above the icon/text layer below it.
const WEB_OVERLAY_INPUT: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100%',
  height: '100%',
  opacity: 0,
  cursor: 'pointer',
  border: 'none',
  outline: 'none',
  padding: 0,
  margin: 0,
  background: 'transparent',
  fontSize: '16px',       // Prevents iOS auto-zoom on focus
  zIndex: 20,             // Sits above the icon/text layer
  colorScheme: 'normal' as any,
};

// Inner content layer — wraps icon + text. pointerEvents:none ensures it never
// intercepts clicks that should reach the <input> overlay above.
const WEB_INNER_LAYER: any = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 16,
  pointerEvents: 'none' as any,
  zIndex: 1,
};

// Programmatic picker open — backup for when the overlay input misses (e.g. focus
// on text via screen-reader). Uses showPicker() with focus+click fallback.
function openWebPicker(ref: React.RefObject<HTMLInputElement | null>) {
  const el = ref.current;
  if (!el) return;
  try {
    // @ts-ignore — showPicker exists on HTMLInputElement in modern browsers
    if (typeof el.showPicker === 'function') {
      el.showPicker();
      return;
    }
  } catch {
    /* fall through */
  }
  el.focus();
  el.click();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DateTimePicker({
  label,
  value,
  onChange,
  mode = 'date',
  minimumDate,
  maximumDate,
}: DateTimePickerProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // Native show-state (date pickers only — time uses TextInputs)
  const [showDate, setShowDate] = useState(false);
  const [show,     setShow]     = useState(false);

  // Web input refs (date picker)
  const webInputRef     = useRef<HTMLInputElement | null>(null);
  const webDateInputRef = useRef<HTMLInputElement | null>(null);

  const hasValue     = !!value;
  const displayValue = value ?? new Date();

  // ── TIME state: single masked input HH:MM ─────────────────────────────────────
  // Stores the displayed text with the colon auto-injected as user types.
  const [timeText, setTimeText] = useState(value ? toHHMM(value) : '');

  // Sync from parent when value changes externally
  useEffect(() => {
    setTimeText(value ? toHHMM(value) : '');
  }, [value]);

  // Mask handler: strips non-digits, formats as HH:MM, validates ranges, updates parent
  const updateTime = (input: string) => {
    // Strip non-digits, cap at 4 chars (HHMM)
    const digits = input.replace(/\D/g, '').slice(0, 4);

    // Auto-format with colon
    let formatted: string;
    if (digits.length === 0)      formatted = '';
    else if (digits.length <= 2)  formatted = digits;
    else                          formatted = `${digits.slice(0, 2)}:${digits.slice(2)}`;

    setTimeText(formatted);

    // Only update parent value when we have full HHMM digits AND they're valid
    if (digits.length === 4) {
      const h = parseInt(digits.slice(0, 2), 10);
      const m = parseInt(digits.slice(2),    10);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        const d = new Date(value ?? new Date());
        d.setHours(h, m, 0, 0);
        onChange(d);
      }
    }
  };

  // On blur, snap to last valid time if partial/invalid
  const onTimeBlur = () => {
    const digits = timeText.replace(/\D/g, '');
    if (digits.length === 4) {
      const h = parseInt(digits.slice(0, 2), 10);
      const m = parseInt(digits.slice(2),    10);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        setTimeText(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        return;
      }
    }
    // Invalid or partial — restore from value or clear
    setTimeText(value ? toHHMM(value) : '');
  };

  // ── Shared web helpers ──────────────────────────────────────────────────────
  const minAttr = !minimumDate ? undefined
    : mode === 'date'     ? toInputDate(minimumDate)
    : mode === 'datetime' ? toInputDatetime(minimumDate)
    : undefined;
  const maxAttr = !maximumDate ? undefined
    : mode === 'date'     ? toInputDate(maximumDate)
    : mode === 'datetime' ? toInputDatetime(maximumDate)
    : undefined;

  // Web DATE change handler (single-mode date)
  const handleWebChange = (e: any) => {
    const val = e.target.value;
    if (!val) return;
    const [y, mo, day] = val.split('-').map(Number);
    if (!y || !mo || !day) return;
    onChange(new Date(y, mo - 1, day));
  };

  // Datetime split — date part
  const handleWebDatePart = (e: any) => {
    const val = e.target.value;
    if (!val) return;
    const [y, mo, day] = val.split('-').map(Number);
    if (!y || !mo || !day) return;
    const updated = new Date(value ?? new Date());
    updated.setFullYear(y, mo - 1, day);
    onChange(updated);
  };

  // Inline time field JSX builder — must NOT be a nested component (would cause
  // remount-on-render and steal focus after every keystroke). Plain JSX builder
  // function returns elements that stay in the same render tree as the parent.
  const renderTimeField = (containerStyle: any) => (
    <View style={containerStyle}>
      <Ionicons
        name="time-outline" size={18}
        color={hasValue ? theme.colors.primaryLight : theme.colors.textSecondary}
        style={styles.icon}
      />
      <TextInput
        style={styles.timeMaskedInput}
        value={timeText}
        onChangeText={updateTime}
        onBlur={onTimeBlur}
        keyboardType="number-pad"
        maxLength={5}
        placeholder="__:__"
        placeholderTextColor={theme.colors.textMuted}
        selectTextOnFocus
      />
    </View>
  );

  // ── WEB ─────────────────────────────────────────────────────────────────────
  if (Platform.OS === 'web') {

    // ── datetime: date <input> overlay + custom HH:MM TextInputs ──────────────
    if (mode === 'datetime') {
      return (
        <View style={styles.container}>
          <Text style={[styles.label, hasValue && styles.labelActive]}>{label}</Text>
          <View style={styles.splitRow}>

            {/* ── Date half: native browser picker overlay ─────── */}
            <View style={[styles.splitButton, { flex: 1.2 } as any]}>
              <View style={WEB_INNER_LAYER}>
                <Ionicons
                  name="calendar-outline" size={18}
                  color={hasValue ? theme.colors.primaryLight : theme.colors.textSecondary}
                  style={styles.icon}
                />
                <Text style={[styles.valueText, !hasValue && styles.placeholder]} numberOfLines={1}>
                  {value ? toDDMMYYYY(value) : 'dd/MM/yyyy'}
                </Text>
              </View>
              <input
                ref={webDateInputRef}
                type="date"
                value={value ? toInputDate(value) : ''}
                min={minAttr}
                max={maxAttr}
                onChange={handleWebDatePart}
                onClick={() => openWebPicker(webDateInputRef)}
                style={WEB_OVERLAY_INPUT}
              />
            </View>

            {/* ── Time half: custom HH:MM TextInputs ───────────── */}
            {renderTimeField([styles.splitButton, { flex: 1 } as any])}

          </View>
        </View>
      );
    }

    // ── time: just the custom HH:MM field ────────────────────────────────────
    if (mode === 'time') {
      return (
        <View style={styles.container}>
          <Text style={[styles.label, hasValue && styles.labelActive]}>{label}</Text>
          {renderTimeField(styles.buttonContainer)}
        </View>
      );
    }

    // ── date: single button with interactive <input> overlay ─────────────────
    return (
      <View style={styles.container}>
        <Text style={[styles.label, hasValue && styles.labelActive]}>{label}</Text>
        <View style={[styles.buttonContainer] as any}>
          <View style={[WEB_INNER_LAYER, { justifyContent: 'flex-start' } as any]}>
            <Ionicons
              name="calendar-outline" size={20}
              color={hasValue ? theme.colors.primaryLight : theme.colors.textSecondary}
              style={styles.icon}
            />
            <Text style={[styles.valueText, !hasValue && styles.placeholder]} numberOfLines={1}>
              {value ? toDDMMYYYY(value) : 'dd/MM/yyyy'}
            </Text>
            <Ionicons name="chevron-down" size={15} color={theme.colors.textMuted} />
          </View>
          <input
            ref={webInputRef}
            type="date"
            value={value ? toInputDate(value) : ''}
            min={minAttr}
            max={maxAttr}
            onChange={handleWebChange}
            onClick={() => openWebPicker(webInputRef)}
            style={WEB_OVERLAY_INPUT}
          />
        </View>
      </View>
    );
  }

  // ── NATIVE: datetime (date picker + custom time field) ──────────────────────
  if (mode === 'datetime') {
    const handleDateChange = (_event: any, selectedDate?: Date) => {
      if (Platform.OS === 'android') setShowDate(false);
      if (!selectedDate) return;
      const updated = new Date(value ?? new Date());
      updated.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      onChange(updated);
    };

    return (
      <View style={styles.container}>
        <Text style={[styles.label, hasValue && styles.labelActive]}>{label}</Text>
        <View style={styles.splitRow}>
          {/* Date half — native picker on press */}
          <Pressable style={[styles.splitButton, { flex: 1.2 }]} onPress={() => setShowDate(true)}>
            <Ionicons name="calendar-outline" size={18}
              color={hasValue ? theme.colors.primaryLight : theme.colors.textSecondary}
              style={styles.icon}
            />
            <Text style={[styles.valueText, !hasValue && styles.placeholder]} numberOfLines={1}>
              {value ? toDDMMYYYY(value) : 'dd/MM/yyyy'}
            </Text>
          </Pressable>
          {/* Time half — custom HH:MM TextInputs */}
          {renderTimeField([styles.splitButton, { flex: 1 }])}
        </View>

        {showDate && (
          <View>
            {Platform.OS === 'ios' && (
              <View style={styles.iosDoneRow}>
                <Text style={styles.iosStepLabel}>Selecciona fecha</Text>
                <Pressable onPress={() => setShowDate(false)}>
                  <Text style={styles.iosDoneText}>Listo</Text>
                </Pressable>
              </View>
            )}
            <RNDateTimePicker
              value={displayValue}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              textColor={theme.colors.textPrimary}
              themeVariant={isLightBg(theme.colors.bg) ? 'light' : 'dark'}
              locale="es"
            />
          </View>
        )}
      </View>
    );
  }

  // ── NATIVE: time-only — universal HH:MM TextInputs ──────────────────────────
  if (mode === 'time') {
    return (
      <View style={styles.container}>
        <Text style={[styles.label, hasValue && styles.labelActive]}>{label}</Text>
        {renderTimeField(styles.buttonContainer)}
      </View>
    );
  }

  // ── NATIVE: date-only ───────────────────────────────────────────────────────
  const handleChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (!selectedDate) return;
    onChange(selectedDate);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, hasValue && styles.labelActive]}>{label}</Text>
      <Pressable style={styles.buttonContainer} onPress={() => setShow(true)}>
        <Ionicons
          name="calendar-outline"
          size={20}
          color={hasValue ? theme.colors.primaryLight : theme.colors.textSecondary}
          style={styles.icon}
        />
        <Text style={[styles.valueText, !hasValue && styles.placeholder]}>
          {value ? toDDMMYYYY(value) : 'dd/MM/yyyy'}
        </Text>
      </Pressable>

      {show && (
        <View>
          {Platform.OS === 'ios' && (
            <View style={styles.iosDoneRow}>
              <Pressable onPress={() => setShow(false)}>
                <Text style={styles.iosDoneText}>Listo</Text>
              </Pressable>
            </View>
          )}
          <RNDateTimePicker
            value={displayValue}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleChange}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            textColor={theme.colors.textPrimary}
            themeVariant={isLightBg(theme.colors.bg) ? 'light' : 'dark'}
            locale="es"
          />
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    container:       { marginBottom: 16 },
    label: {
      fontSize: 11,
      fontFamily: 'Poppins_500Medium',
      color: t.colors.textSecondary,
      marginBottom: 4,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.8,
    },
    labelActive: { color: t.colors.borderGlow },
    buttonContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.inputBg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.border,
      paddingHorizontal: 16,
      minHeight: 56,
      gap: 4,
      // Web: 'relative' so the overlay input is positioned inside this container
      position: 'relative' as any,
    },
    splitRow:    { flexDirection: 'row', gap: 8 },
    splitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.inputBg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.border,
      paddingHorizontal: 16,
      minHeight: 56,
      // Web: 'relative' so each overlay input is positioned inside its half
      position: 'relative' as any,
    },
    icon:        { marginRight: 8 },
    valueText: {
      fontSize: 15,
      fontFamily: 'Poppins_400Regular',
      color: t.colors.textPrimary,
      flex: 1,
    },
    placeholder: { color: t.colors.textMuted },
    timeMaskedInput: {
      flex: 1,
      fontSize: 16,
      fontFamily: 'Poppins_600SemiBold',
      color: t.colors.textPrimary,
      paddingHorizontal: 4,
      paddingVertical: 0,
      minHeight: 56,
      letterSpacing: 1.2,
      // Web: remove default input styling so it blends with our button
      ...(Platform.OS === 'web'
        ? ({ outline: 'none', border: 'none', backgroundColor: 'transparent' } as any)
        : {}),
    },
    iosDoneRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
      marginBottom: 4,
    },
    iosStepLabel: {
      fontSize: 13,
      fontFamily: 'Poppins_400Regular',
      color: t.colors.textSecondary,
    },
    iosDoneText: {
      fontSize: 15,
      fontFamily: 'Poppins_600SemiBold',
      color: t.colors.primaryLight,
    },
  });
}
