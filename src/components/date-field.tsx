import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { addMonths, formatDisplayDate, parseDateKey, startOfMonth, toDateKey } from "@/lib/dates";
import { colors, controlHeight } from "@/theme";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function buildMonthCells(month: Date) {
  const first = startOfMonth(month);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      key: toDateKey(date),
      date,
      inMonth: date.getMonth() === month.getMonth(),
    };
  });
}

export function DateCalendar({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = parseDateKey(value);
  const todayKey = toDateKey(new Date());
  const [month, setMonth] = useState(() => startOfMonth(selected ?? new Date()));

  useEffect(() => {
    const next = parseDateKey(value);
    if (next) setMonth(startOfMonth(next));
  }, [value]);

  const cells = useMemo(() => buildMonthCells(month), [month]);
  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <View style={styles.calendar}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Previous month" style={styles.nav} onPress={() => setMonth((current) => addMonths(current, -1))}>
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <Text style={styles.month}>{monthLabel}</Text>
        <Pressable accessibilityLabel="Next month" style={styles.nav} onPress={() => setMonth((current) => addMonths(current, 1))}>
          <Text style={styles.navText}>›</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {WEEKDAYS.map((day) => (
          <Text key={day} style={styles.weekday}>
            {day}
          </Text>
        ))}
        {cells.map((cell) => {
          const selectedDay = value === cell.key;
          const today = todayKey === cell.key;
          return (
            <Pressable
              key={cell.key}
              style={[styles.day, today && !selectedDay && styles.today, selectedDay && styles.selected]}
              onPress={() => onChange(cell.key)}
            >
              <Text style={[styles.dayText, !cell.inMonth && styles.outside, today && !selectedDay && styles.todayText, selectedDay && styles.selectedText]}>
                {cell.date.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function DateField({
  label,
  value,
  onChange,
  placeholder = "Select date",
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable style={styles.trigger} onPress={() => setOpen((current) => !current)}>
        <Text style={[styles.triggerText, !value && styles.placeholder]}>
          {value ? formatDisplayDate(value) : placeholder}
        </Text>
      </Pressable>
      {open ? (
        <DateCalendar
          value={value}
          onChange={(next) => {
            onChange(next);
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 12 },
  label: { fontFamily: "Mukta_400Regular", fontSize: 13, color: colors.muted, marginBottom: 6 },
  trigger: {
    minHeight: controlHeight,
    borderRadius: 12,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  triggerText: { fontFamily: "Mukta_400Regular", fontSize: 16, color: colors.ink },
  placeholder: { color: colors.muted },
  calendar: { marginTop: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  nav: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  navText: { fontSize: 22, color: colors.ink, fontFamily: "Mukta_600SemiBold" },
  month: { fontFamily: "Mukta_700Bold", fontSize: 16, color: colors.ink },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: {
    width: "14.28%",
    textAlign: "center",
    fontFamily: "Mukta_700Bold",
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.muted,
    marginBottom: 4,
  },
  day: { width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  dayText: { fontFamily: "Mukta_600SemiBold", fontSize: 15, color: colors.ink },
  outside: { color: "rgba(58,34,24,0.35)" },
  today: { borderWidth: 1.5, borderColor: colors.accent },
  todayText: { color: colors.accent },
  selected: { backgroundColor: colors.accent },
  selectedText: { color: colors.accentInk },
});
