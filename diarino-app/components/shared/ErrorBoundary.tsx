import { Component, ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

// ↔ AUDIT FIX: the app had zero React Error Boundaries — any render-time
// exception in any screen (reel playback, live-stream screens, admin dashboard
// charts, etc.) crashed the entire app to a white/blank screen with no way
// back except a manual restart. This wraps the whole tree in _layout.tsx
// so a single screen's crash shows a recoverable in-app message instead.
// Logging stays in console.error only — never surfaced to the user, in
// line with every other error-handling path in the app (see AdminUsers/
// AdminManagement fix in the same audit pass).
//
// ↔ استثناء مبرَّر من الوضع الداكن: React Error Boundaries لازم تكون
// class components (componentDidCatch/getDerivedStateFromError مش
// متاحين لـ function components) — والـ Hooks زي useThemeColors() أصلاً
// مينفعش تتنده جوه class component. أهم من كده: شاشة الطوارئ دي المفروض
// تكون أقل اعتماد ممكن على أي حاجة تانية فى التطبيق (حتى نظام الثيم
// نفسه) عشان تفضل شغالة حتى لو السبب اللي خلّى الشاشة تكرش كان حاجة فى
// الـ providers العليا. الألوان الثابتة هنا قرار متعمّد، مش نسيان.

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack: string }) {
    // Intentionally console-only: never leak stack traces or internal
    // error details into the UI (same principle as the admin-alert fix).
    console.error("Unhandled render error caught by ErrorBoundary:", error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>حدث خطأ غير متوقع</Text>
          <Text style={styles.subtitle}>نأسف على الإزعاج، برجاء المحاولة مرة أخرى.</Text>
          <Pressable style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#0d6b4f",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
});
