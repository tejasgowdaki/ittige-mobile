import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { IconChevronDown, IconClose, IconPlus } from "@/components/icons";
import { colors, controlHeight, radius } from "@/theme";

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Title({ children }: { children: string }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Copy({ children }: { children: string }) {
  return <Text style={styles.copy}>{children}</Text>;
}

export function Label({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Field({
  label,
  children,
  quiet,
}: {
  label?: string;
  children: React.ReactNode;
  quiet?: boolean;
}) {
  return (
    <View style={styles.field}>
      {label ? <Text style={quiet ? styles.fieldLabel : styles.label}>{label}</Text> : null}
      {children}
    </View>
  );
}

export function PhoneField({
  value,
  onChangeText,
  quiet = true,
}: {
  value: string;
  onChangeText: (value: string) => void;
  quiet?: boolean;
}) {
  return (
    <Field label="Phone" quiet={quiet}>
      <View style={styles.phoneField}>
        <View style={styles.phonePrefixBox}>
          <Text style={styles.phonePrefix}>+91</Text>
        </View>
        <TextInput
          value={value}
          onChangeText={(next) => onChangeText(next.replace(/\D/g, "").slice(0, 10))}
          keyboardType="number-pad"
          placeholder="9876543210"
          placeholderTextColor={colors.muted}
          style={styles.phoneInput}
        />
      </View>
    </Field>
  );
}

function numericText(value: string, decimal: boolean) {
  if (decimal) {
    const cleaned = value.replace(/[^\d.]/g, "");
    const dot = cleaned.indexOf(".");
    if (dot === -1) return cleaned;
    return `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, "")}`;
  }
  const negative = value.startsWith("-");
  const digits = value.replace(/\D/g, "");
  return negative ? (digits ? `-${digits}` : "-") : digits;
}

type SheetScroll = {
  scrollRef: React.RefObject<ScrollView | null>;
  offsetY: React.RefObject<number>;
  keyboardHeight: React.RefObject<number>;
};

const SheetScrollContext = createContext<SheetScroll | null>(null);

function revealSheetField(sheet: SheetScroll | null, input: TextInput | null) {
  if (!sheet || !input) return;
  setTimeout(() => {
    input.measureInWindow((_x, y, _width, height) => {
      const visibleBottom = Dimensions.get("window").height - sheet.keyboardHeight.current - 48;
      const overlap = y + height - visibleBottom;
      if (overlap <= 0) return;
      sheet.scrollRef.current?.scrollTo({
        y: sheet.offsetY.current + overlap,
        animated: true,
      });
    });
  }, 320);
}

export function TextField(props: TextInputProps) {
  const decimal = props.keyboardType === "decimal-pad";
  const numeric = decimal || props.keyboardType === "number-pad" || props.keyboardType === "numeric";
  const sheetScroll = useContext(SheetScrollContext);
  const inputRef = useRef<TextInput>(null);
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      ref={inputRef}
      onFocus={(event) => {
        props.onFocus?.(event);
        revealSheetField(sheetScroll, inputRef.current);
      }}
      onChangeText={
        numeric
          ? (value) => props.onChangeText?.(numericText(value, decimal))
          : props.onChangeText
      }
      style={[styles.input, props.multiline && styles.textarea, props.style]}
    />
  );
}

export function ErrorText({ children }: { children: string | null }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function Empty({ children }: { children: string }) {
  return <Text style={styles.empty}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  pending,
  disabled,
  secondary,
  icon,
  pendingLabel = "Saving…",
}: {
  label: string;
  onPress: () => void;
  pending?: boolean;
  disabled?: boolean;
  secondary?: boolean;
  icon?: React.ReactNode;
  pendingLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || pending}
      style={[styles.button, secondary && styles.buttonSecondary, (disabled || pending) && styles.disabled]}
    >
      {icon && !pending ? icon : null}
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>
        {pending ? pendingLabel : label}
      </Text>
    </Pressable>
  );
}

export function IconButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.iconButton} accessibilityLabel={label}>
      <IconPlus size={16} color={colors.accentInk} />
    </Pressable>
  );
}

export function Row({
  title,
  subtitle,
  onPress,
  trailing,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  trailing?: string;
}) {
  const body = (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {trailing ? <Text style={styles.rowSub}>{trailing}</Text> : null}
    </View>
  );
  if (!onPress) return body;
  return <Pressable onPress={onPress}>{body}</Pressable>;
}

export function Badge({ children }: { children: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{children}</Text>
    </View>
  );
}

export function FilterLink({
  label,
  count,
  active,
  muted,
  trailing,
  onPress,
}: {
  label: string;
  count?: number;
  active?: boolean;
  muted?: boolean;
  trailing?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.filterHit, trailing && styles.filterHitTrailing]}>
      <Text style={[styles.filter, active && styles.filterActive, muted && styles.filterMuted]}>{label}</Text>
      {count !== undefined ? (
        <Text style={[styles.filterCount, active && styles.filterActive]}>{count}</Text>
      ) : null}
    </Pressable>
  );
}

export function SwitchRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.rowTitle}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: colors.accent }} />
    </View>
  );
}

export function CheckBox({
  checked,
  partial,
  disabled,
  onPress,
}: {
  checked: boolean;
  partial?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const mark = (
    <View style={[styles.checkbox, (checked || partial) && styles.checkboxOn, disabled && styles.disabled]}>
      {checked ? <Text style={styles.checkboxMark}>✓</Text> : partial ? <Text style={styles.checkboxMark}>–</Text> : null}
    </View>
  );
  if (!onPress) return mark;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: partial ? "mixed" : checked, disabled }}
    >
      {mark}
    </Pressable>
  );
}

export function SelectField({
  label,
  quiet,
  value,
  options,
  onChange,
  placeholder = "Select",
}: {
  label?: string;
  quiet?: boolean;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);
  return (
    <Field label={label} quiet={quiet}>
      <Pressable style={[styles.input, styles.select]} onPress={() => setOpen((currentOpen) => !currentOpen)}>
        <Text style={[styles.inputText, !current && styles.placeholderText]}>{current?.label || placeholder}</Text>
        <IconChevronDown size={16} color={colors.muted} />
      </Pressable>
      {open ? (
        <View style={styles.optionList}>
          {options.map((option) => (
            <Pressable
              key={`${option.value}:${option.label}`}
              style={styles.option}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <Text style={[styles.rowTitle, option.value === value && styles.filterActive]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Field>
  );
}

export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const offsetY = useRef(0);
  const keyboardHeight = useRef(0);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    if (!open) {
      keyboardHeight.current = 0;
      setKeyboardOffset(0);
      return;
    }
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (event) => {
      const height = Platform.OS === "ios" ? event.endCoordinates.height : 0;
      keyboardHeight.current = height;
      setKeyboardOffset(height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardHeight.current = 0;
      setKeyboardOffset(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [open]);

  const windowHeight = Dimensions.get("window").height;
  const liftedHeight = Math.max(280, windowHeight - keyboardOffset - 28);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <SheetScrollContext.Provider value={{ scrollRef, offsetY, keyboardHeight }}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable
            style={[
              styles.sheet,
              keyboardOffset > 0 && {
                marginBottom: keyboardOffset,
                height: liftedHeight,
                maxHeight: liftedHeight,
              },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Pressable onPress={onClose} style={styles.sheetClose} accessibilityLabel="Close">
                <IconClose size={16} color={colors.ink} />
              </Pressable>
            </View>
            <ScrollView
              ref={scrollRef}
              style={keyboardOffset > 0 ? styles.sheetScroll : undefined}
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
              onScroll={(event) => {
                offsetY.current = event.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
            >
              {children}
            </ScrollView>
          </Pressable>
        </Pressable>
      </SheetScrollContext.Provider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, paddingBottom: 32, gap: 8 },
  title: { fontFamily: "Mukta_700Bold", fontSize: 34, color: colors.ink, letterSpacing: -0.6 },
  copy: { fontFamily: "Mukta_400Regular", fontSize: 16, color: colors.muted, marginBottom: 8 },
  label: {
    fontFamily: "Mukta_600SemiBold",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.muted,
    marginBottom: 6,
  },
  fieldLabel: {
    fontFamily: "Mukta_400Regular",
    fontSize: 13,
    color: colors.muted,
    marginBottom: 6,
  },
  field: { marginBottom: 12 },
  input: {
    minHeight: controlHeight,
    borderRadius: 12,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    justifyContent: "center",
    fontFamily: "Mukta_400Regular",
    fontSize: 16,
    color: colors.ink,
  },
  textarea: { minHeight: 88, paddingTop: 12, textAlignVertical: "top" },
  inputText: { fontFamily: "Mukta_400Regular", fontSize: 16, color: colors.ink },
  placeholderText: { color: colors.muted },
  error: { color: colors.danger, fontFamily: "Mukta_500Medium", marginBottom: 8 },
  empty: { color: colors.muted, fontFamily: "Mukta_400Regular", paddingVertical: 12 },
  button: {
    minHeight: controlHeight,
    borderRadius: 999,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 18,
    marginTop: 4,
  },
  phoneField: {
    minHeight: controlHeight,
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.elevated,
    overflow: "hidden",
  },
  phonePrefixBox: {
    minHeight: controlHeight,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRightWidth: 1,
    borderRightColor: colors.line,
    backgroundColor: "rgba(58,34,24,0.04)",
  },
  phonePrefix: {
    color: colors.muted,
    fontFamily: "Mukta_700Bold",
    fontSize: 15,
    lineHeight: 20,
  },
  phoneInput: {
    flex: 1,
    minHeight: controlHeight,
    paddingHorizontal: 14,
    fontFamily: "Mukta_400Regular",
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
  },
  select: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  buttonSecondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.line },
  buttonText: { color: colors.accentInk, fontFamily: "Mukta_700Bold", fontSize: 16 },
  buttonTextSecondary: { color: colors.ink },
  disabled: { opacity: 0.55 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 12,
  },
  rowTitle: { fontFamily: "Mukta_600SemiBold", fontSize: 16, color: colors.ink },
  rowSub: { fontFamily: "Mukta_400Regular", fontSize: 13, color: colors.muted, marginTop: 2 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: colors.accent, fontFamily: "Mukta_700Bold", fontSize: 12 },
  filterHit: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, marginRight: 20 },
  filterHitTrailing: { marginLeft: "auto", marginRight: 0 },
  filter: {
    fontFamily: "Mukta_600SemiBold",
    fontSize: 15,
    color: colors.muted,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    paddingBottom: 4,
  },
  filterCount: {
    fontFamily: "Mukta_600SemiBold",
    fontSize: 15,
    color: colors.muted,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    paddingBottom: 4,
  },
  filterMuted: { color: colors.muted, fontFamily: "Mukta_500Medium" },
  filterActive: { color: colors.accent, borderBottomColor: colors.accent },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  backdrop: { flex: 1, backgroundColor: "rgba(58,34,24,0.35)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    padding: 18,
    maxHeight: "86%",
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12 },
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(58,34,24,0.03)",
  },
  sheetTitle: { fontFamily: "Mukta_700Bold", fontSize: 22, color: colors.ink },
  sheetScroll: { flex: 1 },
  sheetContent: { paddingBottom: 12 },
  option: { paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  optionList: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.elevated,
    overflow: "hidden",
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxMark: { color: colors.accentInk, fontSize: 12, lineHeight: 14, fontFamily: "Mukta_700Bold" },
});
